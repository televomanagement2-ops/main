import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderEmail, escapeHtml, STORE_NAME } from '../_shared/store.ts';
import { getCorsHeaders, isForbiddenOrigin } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { sendOrderConfirmationEmail, sendRefundEmail } from '../_shared/order-emails.ts';
import { decide, dollars } from '../_shared/webhook-logic.ts';
import { refundRemaining, shippingPaid } from '../_shared/refunds.ts';

const STRIPE_API_VERSION = '2025-03-31.basil';

// Customer self-service cancel+refund abuse limit: max refunds per rolling 24 h.
const MAX_SELF_REFUNDS_PER_DAY = 3;

// Statuses where no money has moved yet: cancelling only needs the Stripe
// Checkout session closed, never a refund.
const PRE_PAYMENT_STATUSES = ['pending', 'processing', 'requires_action'];
const REFUNDABLE_STATUSES = ['paid', 'shipped', 'delivered'];

// cancel: the buyer, or an admin. Everything else: admins only.
//   refund          — all or part of an order (lines, quantities, restock,
//                     shipping, amount); repeatable until nothing is left
//   deliver         — a shipped order arrived
//   sync_payment    — ask Stripe what happened to an open checkout (the
//                     webhook may have missed it) and apply the answer
//   confirm_payment — accept a payment held for review (requires_action)
const ADMIN_ACTIONS = ['refund', 'deliver', 'sync_payment', 'confirm_payment'];
const KNOWN_ACTIONS = ['cancel', ...ADMIN_ACTIONS];

// Same as create-checkout-session / stripe-webhook (see there).
const stripeTaxEnabled = (Deno.env.get('STRIPE_TAX_ENABLED') ?? 'false').toLowerCase() === 'true';

// orders has TWO foreign keys to profiles — user_id (the buyer) and
// refund_requested_by (migration 017). A bare `profiles(...)` embed is ambiguous
// and PostgREST refuses it ("more than one relationship was found for 'orders'
// and 'profiles'"), which failed every action AFTER the money had already
// moved. The `!constraint` hint names the relationship to follow: the buyer.
const ORDER_WITH_CUSTOMER =
  '*, order_items(*), profiles!orders_user_id_fkey(full_name, email, phone)';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// HINTs raised by the refund functions (migration 024) → HTTP status.
const REFUND_HINT_STATUS: Record<string, number> = {
  order_not_found: 404,
  not_refundable: 409,
  no_payment: 409,
  invalid_amount: 400,
  amount_too_high: 400,
  shipping_too_high: 400,
  invalid_line: 400,
};

class OrderActionError extends Error {
  status: number;
  code: string;
  phase: string;

  constructor(status: number, code: string, phase: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.phase = phase;
  }
}

function jsonResponse(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function toOrderActionError(err: unknown): OrderActionError {
  if (err instanceof OrderActionError) return err;

  if (err && typeof err === 'object') {
    const maybeStripe = err as { type?: string; message?: string };
    if (typeof maybeStripe.type === 'string' && maybeStripe.type.startsWith('Stripe')) {
      return new OrderActionError(
        502,
        'STRIPE_ERROR',
        'stripe',
        maybeStripe.message || 'The Stripe API call failed.',
      );
    }
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return new OrderActionError(500, 'UNHANDLED_ERROR', 'unknown', message);
}

/** A database function refused: turn its HINT into the client's error code. */
function rpcError(error: { message: string; hint?: string | null }, phase: string): OrderActionError {
  const hint = error.hint ?? '';
  if (hint in REFUND_HINT_STATUS) {
    return new OrderActionError(REFUND_HINT_STATUS[hint], hint.toUpperCase(), phase, error.message);
  }
  return new OrderActionError(500, 'DB_ERROR', phase, error.message);
}

function requireStripe(): Stripe {
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecret) {
    throw new OrderActionError(
      500,
      'CONFIG_MISSING_SECRETS',
      'config.validate_secrets',
      'Missing required Edge Function secret: STRIPE_SECRET_KEY',
    );
  }
  return new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
}

interface RefundLineInput {
  order_item_id: string;
  quantity: number;
  restock: boolean;
}

/** Validates the client's refund lines; the database re-checks the quantities. */
function parseLines(raw: unknown): RefundLineInput[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw) || raw.length > 100) {
    throw new OrderActionError(400, 'INVALID_LINE', 'refund.validate', 'Invalid refund lines.');
  }
  return raw.map((entry) => {
    const line = (entry ?? {}) as { order_item_id?: unknown; quantity?: unknown; restock?: unknown };
    const quantity = Math.trunc(Number(line.quantity));
    if (typeof line.order_item_id !== 'string' || !UUID_PATTERN.test(line.order_item_id) || !(quantity > 0)) {
      throw new OrderActionError(400, 'INVALID_LINE', 'refund.validate', 'Invalid refund lines.');
    }
    return { order_item_id: line.order_item_id, quantity, restock: line.restock === true };
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  // Fail closed on an unauthorized browser origin rather than doing the work
  // and only withholding the CORS header (matches create-checkout-session).
  if (isForbiddenOrigin(origin)) {
    return jsonResponse({
      error: 'Origin not allowed.',
      code: 'ORIGIN_NOT_ALLOWED',
      phase: 'request.validate_origin',
    }, 403, origin);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!anonKey) missing.push('SUPABASE_ANON_KEY');
      throw new OrderActionError(
        500,
        'CONFIG_MISSING_SECRETS',
        'config.validate_secrets',
        `Missing required Edge Function secrets: ${missing.join(', ')}`,
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new OrderActionError(401, 'AUTH_MISSING_HEADER', 'auth.validate_header', 'Missing Authorization header.');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      throw new OrderActionError(
        401,
        'AUTH_INVALID_SESSION',
        'auth.get_user',
        `Invalid or expired session. (${authError?.message ?? 'user not found'})`,
      );
    }

    const body = await req.json();
    const action = String(body?.action ?? '').trim();
    const orderId = String(body?.order_id ?? body?.orderId ?? '').trim();

    if (!action || !orderId) {
      throw new OrderActionError(400, 'VALIDATION_MISSING_FIELDS', 'request.validate', 'Missing action or order_id.');
    }
    if (!KNOWN_ACTIONS.includes(action)) {
      throw new OrderActionError(400, 'VALIDATION_UNKNOWN_ACTION', 'request.validate', 'Unknown action.');
    }
    if (!UUID_PATTERN.test(orderId)) {
      throw new OrderActionError(404, 'ORDER_NOT_FOUND', 'request.validate', 'Order not found.');
    }

    // The service role writes: the database's order guard (migration 024)
    // refuses a signed-in user settling an open payment directly, so these
    // actions are the only way to do it — after checking with Stripe.
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── SECURITY: authorise BEFORE touching the order.
    // The admin check needs no order at all, so it runs first: a non-admin
    // asking for an admin action is turned away without a lookup, and
    // therefore learns nothing about whether the id exists. Ownership for
    // 'cancel' needs the row, so it is checked immediately after the fetch and
    // answers 404 — not 403 — so an authenticated user cannot tell a real
    // order belonging to someone else from an id that was never issued.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError) {
      throw new OrderActionError(500, 'DB_PROFILE_LOOKUP_ERROR', 'db.fetch_profile', profileError.message);
    }
    const isAdmin = profile?.role === 'admin';
    if (ADMIN_ACTIONS.includes(action) && !isAdmin) {
      throw new OrderActionError(403, 'AUTH_NOT_ADMIN', 'auth.authorize_admin', 'Admin access required.');
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, user_id, status, total, subtotal, shipping_cost, shipping_discount, discount_amount, tax_amount, refund_amount, stripe_session_id, stripe_payment_intent_id, needs_review',
      )
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new OrderActionError(404, 'ORDER_NOT_FOUND', 'db.fetch_order', 'Order not found.');
    }
    if (action === 'cancel' && !isAdmin && order.user_id !== user.id) {
      throw new OrderActionError(404, 'ORDER_NOT_FOUND', 'auth.authorize_owner', 'Order not found.');
    }

    const loadOrder = async () => {
      const { data, error } = await supabase.from('orders').select(ORDER_WITH_CUSTOMER).eq('id', orderId).single();
      if (error || !data) {
        throw new OrderActionError(500, 'DB_ORDER_FETCH_ERROR', 'db.fetch_order', error?.message ?? 'Order not found.');
      }
      return data;
    };

    /**
     * Refund through order_refunds (migration 024): validated and recorded
     * first, then sent to Stripe with the request id as idempotency key (a
     * double click is one refund), then applied — refunded counts, stock for
     * the lines marked restock, and 'refunded' once nothing is left.
     */
    const refund = async (params: {
      requestId: string;
      amount: number;
      lines: RefundLineInput[];
      shipping: number;
      reason: string | null;
      source: 'admin' | 'customer';
    }) => {
      if (!order.stripe_payment_intent_id) {
        throw new OrderActionError(409, 'NO_PAYMENT', 'refund.validate', 'Order is missing its Stripe payment.');
      }

      const { data: begun, error: beginError } = await supabase.rpc('begin_order_refund', {
        p_request_id: params.requestId,
        p_order_id: order.id,
        p_amount: params.amount,
        p_lines: params.lines,
        p_shipping: params.shipping,
        p_reason: params.reason,
        p_source: params.source,
        p_actor: user.id,
      });
      if (beginError) throw rpcError(beginError, 'refund.begin');
      const started = begun as { existing: boolean; stripe_refund_id: string | null; amount: number };

      let stripeRefundId = started.stripe_refund_id;
      let stripeStatus = 'pending';
      if (!stripeRefundId) {
        const stripe = requireStripe();
        try {
          const created = await stripe.refunds.create(
            {
              payment_intent: order.stripe_payment_intent_id,
              amount: Math.round(Number(started.amount) * 100),
              metadata: { order_id: order.id, refund_request_id: params.requestId },
            },
            { idempotencyKey: `refund_${params.requestId}` },
          );
          stripeRefundId = created.id;
          stripeStatus = created.status ?? 'pending';
        } catch (stripeErr) {
          await supabase.rpc('abandon_order_refund', { p_request_id: params.requestId });
          throw stripeErr;
        }
      }

      const { data: completed, error: completeError } = await supabase.rpc('complete_order_refund', {
        p_request_id: params.requestId,
        p_stripe_refund_id: stripeRefundId,
        p_status: stripeStatus,
      });
      if (completeError) throw rpcError(completeError, 'refund.complete');
      const done = completed as { full: boolean };

      const updated = await loadOrder();
      const customer = (updated as { profiles?: { email?: string; full_name?: string } }).profiles;
      if (customer?.email && !started.existing) {
        sendRefundEmail({
          toEmail: customer.email,
          customerName: customer.full_name ?? 'Customer',
          orderId: order.id,
          refundAmount: Number(started.amount),
          partial: !done.full,
        }).catch((emailErr) => console.error('Refund email failed (non-blocking):', emailErr));
      }
      return updated;
    };

    /** Every unit not yet refunded, and the shipping not yet refunded. */
    const everythingLeft = async (restock: boolean) => {
      const [{ data: items, error: itemsError }, { data: refunds, error: refundsError }] = await Promise.all([
        supabase.from('order_items').select('id, quantity, refunded_quantity').eq('order_id', order.id),
        supabase.from('order_refunds').select('shipping_amount, status').eq('order_id', order.id),
      ]);
      if (itemsError || refundsError) {
        throw new OrderActionError(500, 'DB_ORDER_FETCH_ERROR', 'refund.prepare', (itemsError ?? refundsError)!.message);
      }
      const lines = (items ?? [])
        .filter((item) => item.quantity - item.refunded_quantity > 0)
        .map((item) => ({ order_item_id: item.id as string, quantity: item.quantity - item.refunded_quantity, restock }));
      const shippingDone = (refunds ?? [])
        .filter((r) => ['pending', 'requires_action', 'succeeded'].includes(r.status as string))
        .reduce((sum, r) => sum + Number(r.shipping_amount), 0);
      const shipping = Math.max(0, Math.round((shippingPaid(order) - shippingDone) * 100) / 100);
      return { lines, shipping, amount: refundRemaining(order) };
    };

    // ── cancel ──────────────────────────────────────────────────────────
    if (action === 'cancel') {
      // ── Pre-payment cancel: no money has moved, so there is nothing to
      // refund — but the Stripe Checkout session stays payable for an hour
      // after it is created. Cancelling the order row while leaving that
      // session open is what used to charge a customer for an order the
      // transition guard then refused to mark paid, parking it in
      // needs_review. So: expire the session first, and refuse the cancel
      // outright if the payment has already gone through in the meantime.
      if (PRE_PAYMENT_STATUSES.includes(order.status)) {
        if (order.stripe_session_id) {
          const stripe = requireStripe();
          const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);

          if (session.payment_status === 'paid' || session.status === 'complete') {
            throw new OrderActionError(
              409,
              'ORDER_ALREADY_PAID',
              'cancel.validate',
              'Payment for this order has already completed. Check the payment with Stripe, then refund it if needed.',
            );
          }
          if (session.status === 'open') {
            await stripe.checkout.sessions.expire(order.stripe_session_id);
          }
        }

        // Re-assert the pre-payment status in the WHERE clause: the webhook may
        // have marked the order paid between the check above and this write.
        const { data: cancelled, error: cancelError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId)
          .in('status', PRE_PAYMENT_STATUSES)
          .select(ORDER_WITH_CUSTOMER)
          .maybeSingle();

        if (cancelError) {
          throw new OrderActionError(500, 'DB_ORDER_UPDATE_ERROR', 'db.update_order', cancelError.message);
        }
        if (!cancelled) {
          throw new OrderActionError(
            409,
            'ORDER_NOT_CANCELABLE',
            'cancel.validate',
            'The order changed status while it was being cancelled. Reload and try again.',
          );
        }
        return jsonResponse({ order: cancelled }, 200, origin);
      }

      // Cancelling a PAID (not yet shipped) order: a full refund of what is
      // left, every line back on the shelf (the goods never left), and the
      // order moves to 'refunded'.
      if (order.status !== 'paid') {
        throw new OrderActionError(
          409,
          'ORDER_NOT_CANCELABLE',
          'cancel.validate',
          `Order status ${order.status} is not cancelable.`,
        );
      }

      if (!isAdmin) {
        // Rate limit: instant self-refunds are convenient but abusable
        // (buy→cancel loops cost the store Stripe fees). Counts refunds the
        // CUSTOMER initiated, not every refund touching their orders.
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: recentRefunds, error: refundCountErr } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('refund_requested_by', user.id)
          .gte('refunded_at', oneDayAgo);

        if (refundCountErr) {
          throw new OrderActionError(500, 'DB_RATE_LIMIT_ERROR', 'cancel.rate_limit', refundCountErr.message);
        }
        if ((recentRefunds ?? 0) >= MAX_SELF_REFUNDS_PER_DAY) {
          throw new OrderActionError(
            429,
            'RATE_LIMITED',
            'cancel.rate_limit',
            'Too many cancellations in the last 24 hours. Please contact support.',
          );
        }
      }

      const left = await everythingLeft(true);
      const updated = await refund({
        // One cancellation per order: the key makes a double click one refund.
        requestId: await uuidFrom(`cancel:${order.id}`),
        amount: left.amount,
        lines: left.lines,
        shipping: left.shipping,
        reason: isAdmin ? 'Order cancelled by the shop' : 'Order cancelled by the customer',
        source: isAdmin ? 'admin' : 'customer',
      });
      return jsonResponse({ order: updated }, 200, origin);
    }

    // ── refund ──────────────────────────────────────────────────────────
    if (action === 'refund') {
      if (!REFUNDABLE_STATUSES.includes(order.status)) {
        throw new OrderActionError(409, 'NOT_REFUNDABLE', 'refund.validate', `Order status ${order.status} is not refundable.`);
      }

      const requestId =
        typeof body?.request_id === 'string' && UUID_PATTERN.test(body.request_id)
          ? body.request_id
          : crypto.randomUUID();
      const reason =
        typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;
      const lines = parseLines(body?.lines);

      let amount: number;
      let shipping = Math.max(0, Number(body?.shipping_amount ?? 0) || 0);
      let refundLines: RefundLineInput[];
      if (body?.amount == null && lines == null) {
        // Everything that is left (what the admin apps before line refunds
        // sent). Goods that never shipped go back on the shelf.
        const left = await everythingLeft(order.status === 'paid');
        amount = left.amount;
        shipping = left.shipping;
        refundLines = left.lines;
      } else {
        amount = Math.round(Number(body?.amount) * 100) / 100;
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new OrderActionError(400, 'INVALID_AMOUNT', 'refund.validate', 'Invalid refund amount.');
        }
        refundLines = lines ?? [];
      }

      const updated = await refund({ requestId, amount, lines: refundLines, shipping, reason, source: 'admin' });
      return jsonResponse({ order: updated }, 200, origin);
    }

    // ── deliver ─────────────────────────────────────────────────────────
    if (action === 'deliver') {
      if (order.status !== 'shipped') {
        throw new OrderActionError(
          409,
          'ORDER_NOT_DELIVERABLE',
          'deliver.validate',
          `Order status ${order.status} cannot be marked as delivered.`,
        );
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', 'shipped')
        .select(ORDER_WITH_CUSTOMER)
        .maybeSingle();

      if (updateError || !updatedOrder) {
        throw new OrderActionError(
          updateError ? 500 : 409,
          updateError ? 'DB_ORDER_UPDATE_ERROR' : 'ORDER_NOT_DELIVERABLE',
          'db.update_order',
          updateError?.message ?? 'The order changed status meanwhile. Reload and try again.',
        );
      }

      // Send delivery notification email (non-blocking)
      const customer = (updatedOrder as { profiles?: { email?: string; full_name?: string } }).profiles;
      if (customer?.email) {
        const customerName = customer.full_name ?? 'Customer';
        sendEmail({
          to: customer.email,
          subject: `Your ${STORE_NAME} order has been delivered`,
          html: renderEmail({
            eyebrow: 'Delivery confirmed',
            heading: `Your order has arrived, ${escapeHtml(customerName)}.`,
            bodyHtml: `
              <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">
                The carrier has completed delivery. We hope everything is exactly as you expected.
              </p>
              <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0;">
                If you have any questions about your order, received the wrong item, or need help, just reply to this email — our team responds within 24 hours.
              </p>
            `,
          }),
          text: `Hi ${customerName},\n\nYour ${STORE_NAME} order has been delivered.\n\nWe hope everything is exactly as you expected.\n\nIf you have any questions or problems, just reply to this email — our team responds within 24 hours.\n\nThanks for shopping with ${STORE_NAME}.`,
        }).catch((emailErr) => {
          console.error('Delivery email failed (non-blocking):', emailErr);
        });
      }

      return jsonResponse({ order: updatedOrder }, 200, origin);
    }

    // ── sync_payment ────────────────────────────────────────────────────
    // An order still waiting for payment: ask Stripe what became of its
    // checkout and apply the answer exactly as the webhook would have.
    if (action === 'sync_payment') {
      if (!PRE_PAYMENT_STATUSES.includes(order.status)) {
        return jsonResponse({ order: await loadOrder(), stripe_status: 'settled' }, 200, origin);
      }
      if (!order.stripe_session_id) {
        throw new OrderActionError(409, 'NO_CHECKOUT_SESSION', 'sync.validate', 'This order never reached Stripe.');
      }

      const stripe = requireStripe();
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      const state = { id: order.id, status: order.status, total: Number(order.total) };

      let decision: ReturnType<typeof decide> | null = null;
      if (session.status === 'complete') {
        decision = decide(
          {
            type: 'checkout.session.completed',
            orderId: order.id,
            sessionId: session.id,
            paymentIntentId:
              typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
            paymentStatus: session.payment_status,
            amountTotal: typeof session.amount_total === 'number' ? session.amount_total : null,
            amountTax:
              typeof session.total_details?.amount_tax === 'number' ? session.total_details.amount_tax : null,
          },
          state,
          { stripeTaxEnabled },
        );
      } else if (session.status === 'expired') {
        decision = decide({ type: 'checkout.session.expired', orderId: order.id, sessionId: session.id }, state);
      }

      if (decision?.action === 'update') {
        const { error: updateError } = await supabase
          .from('orders')
          .update(decision.updates)
          .eq('id', order.id)
          .in('status', PRE_PAYMENT_STATUSES);
        if (updateError) {
          throw new OrderActionError(500, 'DB_ORDER_UPDATE_ERROR', 'sync.update_order', updateError.message);
        }
        await supabase.from('order_events').insert({
          order_id: order.id,
          kind: 'payment',
          data: { checked_with_stripe: true, session_status: session.status, payment_status: session.payment_status },
          actor_id: user.id,
        });
        if (decision.sendConfirmationEmail) {
          sendOrderConfirmationEmail(supabase, order.id).catch((emailErr) =>
            console.error('Order confirmation email failed (non-blocking):', emailErr),
          );
        }
      }

      return jsonResponse({ order: await loadOrder(), stripe_status: session.status }, 200, origin);
    }

    // ── confirm_payment ─────────────────────────────────────────────────
    // A payment held for review (the charge did not match the recorded total,
    // or the webhook parked the order). Stripe must say the money arrived; the
    // order then takes the amount actually charged as its total.
    if (action === 'confirm_payment') {
      if (order.status !== 'requires_action') {
        throw new OrderActionError(409, 'ORDER_NOT_HELD', 'confirm.validate', 'Only a payment held for review can be confirmed.');
      }
      if (!order.stripe_payment_intent_id) {
        throw new OrderActionError(409, 'NO_PAYMENT', 'confirm.validate', 'This order has no Stripe payment to confirm.');
      }

      const stripe = requireStripe();
      const intent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      if (intent.status !== 'succeeded') {
        throw new OrderActionError(
          409,
          'PAYMENT_NOT_SUCCEEDED',
          'confirm.validate',
          `Stripe reports this payment as "${intent.status}", not succeeded.`,
        );
      }

      const charged = dollars(intent.amount_received ?? intent.amount);
      const { data: confirmed, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'paid', total: charged, needs_review: false, review_reason: null })
        .eq('id', order.id)
        .eq('status', 'requires_action')
        .select('id')
        .maybeSingle();
      if (updateError || !confirmed) {
        throw new OrderActionError(
          updateError ? 500 : 409,
          updateError ? 'DB_ORDER_UPDATE_ERROR' : 'ORDER_NOT_HELD',
          'confirm.update_order',
          updateError?.message ?? 'The order changed status meanwhile. Reload and try again.',
        );
      }

      await supabase.from('order_events').insert({
        order_id: order.id,
        kind: 'payment',
        data: { confirmed: true, recorded_total: Number(order.total), charged },
        actor_id: user.id,
      });
      sendOrderConfirmationEmail(supabase, order.id).catch((emailErr) =>
        console.error('Order confirmation email failed (non-blocking):', emailErr),
      );

      return jsonResponse({ order: await loadOrder() }, 200, origin);
    }

    throw new OrderActionError(400, 'VALIDATION_UNKNOWN_ACTION', 'request.validate', 'Unknown action.');
  } catch (err) {
    const actionErr = toOrderActionError(err);
    return jsonResponse(
      {
        error: actionErr.message,
        code: actionErr.code,
        phase: actionErr.phase,
      },
      actionErr.status,
      origin,
    );
  }
});

/** A stable UUID derived from a string (SHA-256, version 4 layout). */
async function uuidFrom(seed: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
