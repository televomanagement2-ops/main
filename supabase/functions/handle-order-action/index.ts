import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { formatMoney, renderEmail, escapeHtml, STORE_NAME } from '../_shared/store.ts';
import { getCorsHeaders, isForbiddenOrigin } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';

const STRIPE_API_VERSION = '2025-03-31.basil';

// Customer self-service cancel+refund abuse limit: max refunds per rolling 24 h.
const MAX_SELF_REFUNDS_PER_DAY = 3;

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
        'STRIPE_REFUND_ERROR',
        'stripe.refunds.create',
        maybeStripe.message || 'Stripe API call failed while creating refund.',
      );
    }
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return new OrderActionError(500, 'UNHANDLED_ERROR', 'unknown', message);
}

async function sendRefundEmail(params: {
  toEmail: string;
  customerName: string;
  orderId: string;
  refundAmount: number;
  currency?: string;
}) {
  const { toEmail, customerName, orderId, refundAmount, currency } = params;
  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const formattedAmount = formatMoney(refundAmount, currency);
  const safeName = escapeHtml(customerName);

  await sendEmail({
    to: toEmail,
    subject: `Refund confirmed for your order #${shortOrderId}`,
    html: renderEmail({
      eyebrow: 'Refund processed',
      heading: `Your refund is on its way, ${safeName}.`,
      bodyHtml: `
        <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">
          Your refund of <strong>${formattedAmount}</strong> for order <strong>#${shortOrderId}</strong> has been processed successfully.
        </p>
        <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">
          The funds will be credited back to your original payment method within <strong>3–5 business days</strong>, depending on your bank.
        </p>
        <p style="font-size: 14px; color: #666; line-height: 1.7; margin: 0;">
          Questions? Just reply to this email and our team will help.
        </p>
      `,
    }),
    text: `Hi ${customerName},\n\nYour refund of ${formattedAmount} for order #${shortOrderId} has been processed.\n\nThe funds will arrive within 3-5 business days, depending on your bank.\n\nThanks for shopping with ${STORE_NAME}.`,
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
    // Only supabase secrets are required for all actions; stripe secret is checked inside the refund path
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
    const amount = body?.amount;

    if (!action || !orderId) {
      throw new OrderActionError(400, 'VALIDATION_MISSING_FIELDS', 'request.validate', 'Missing action or order_id.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, total, stripe_payment_intent_id, refund_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new OrderActionError(404, 'ORDER_NOT_FOUND', 'db.fetch_order', 'Order not found.');
    }

    if (order.refund_id) {
      throw new OrderActionError(409, 'ORDER_ALREADY_REFUNDED', 'refund.validate', 'Order already refunded.');
    }

    if (action === 'cancel') {
      // Customer-initiated cancellation of a PAID (not yet shipped) order:
      // issue a FULL Stripe refund and move the order to 'refunded'. Using
      // 'refunded' (not 'cancelled') keeps the subsequent charge.refunded /
      // refund.updated webhooks idempotent (refunded → refunded is a no-op).
      if (order.user_id !== user.id) {
        throw new OrderActionError(403, 'AUTH_NOT_OWNER', 'auth.authorize_owner', 'Order ownership required.');
      }

      if (order.status !== 'paid') {
        throw new OrderActionError(
          409,
          'ORDER_NOT_CANCELABLE',
          'cancel.validate',
          `Order status ${order.status} is not cancelable.`,
        );
      }

      // Rate limit: instant self-refunds are convenient but abusable
      // (buy→cancel loops cost the store Stripe fees). Cap per rolling 24 h.
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentRefunds, error: refundCountErr } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('refunded_at', oneDayAgo);

      if (refundCountErr) {
        throw new OrderActionError(
          500,
          'DB_RATE_LIMIT_ERROR',
          'cancel.rate_limit',
          `Failed to check refund rate: ${refundCountErr.message}`,
        );
      }
      if ((recentRefunds ?? 0) >= MAX_SELF_REFUNDS_PER_DAY) {
        throw new OrderActionError(
          429,
          'RATE_LIMITED',
          'cancel.rate_limit',
          'Too many cancellations in the last 24 hours. Please contact support.',
        );
      }

      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeSecret) {
        throw new OrderActionError(
          500,
          'CONFIG_MISSING_SECRETS',
          'config.validate_secrets',
          'Missing required Edge Function secret: STRIPE_SECRET_KEY',
        );
      }

      if (!order.stripe_payment_intent_id) {
        throw new OrderActionError(
          400,
          'ORDER_MISSING_PAYMENT_INTENT',
          'cancel.validate',
          'Order is missing Stripe payment intent id.',
        );
      }

      // Full refund only — never trust any client-supplied amount on cancel.
      // The idempotency key (derived from the order) guarantees that two
      // concurrent requests (double-click / race) create exactly ONE Stripe
      // refund: the second call returns the same refund object instead of
      // issuing a second real refund.
      const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
      const refund = await stripe.refunds.create(
        { payment_intent: order.stripe_payment_intent_id },
        { idempotencyKey: `refund_${orderId}` },
      );

      const refundValue = Math.round(
        (refund.amount ?? Math.round(Number(order.total) * 100)) / 100 * 100,
      ) / 100;

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
          refund_id: refund.id,
          refund_amount: refundValue,
          refunded_at: refund.created
            ? new Date(refund.created * 1000).toISOString()
            : new Date().toISOString(),
          status: 'refunded',
        })
        .eq('id', orderId)
        .select('*, order_items(*), profiles(full_name, email, phone)')
        .single();

      if (updateError || !updatedOrder) {
        throw new OrderActionError(
          500,
          'DB_ORDER_UPDATE_ERROR',
          'db.update_order',
          updateError?.message ?? 'Failed to update order after cancellation refund.',
        );
      }

      // Refund confirmation email (non-blocking: failure does not affect the response)
      const profile = (updatedOrder as { profiles?: { email?: string; full_name?: string } }).profiles;
      if (profile?.email) {
        sendRefundEmail({
          toEmail: profile.email,
          customerName: profile.full_name ?? 'Customer',
          orderId,
          refundAmount: refundValue,
        }).catch((emailErr) => {
          console.error('Cancellation refund email failed (non-blocking):', emailErr);
        });
      }

      return jsonResponse({ order: updatedOrder }, 200, origin);
    }

    if (action === 'refund') {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new OrderActionError(500, 'DB_PROFILE_LOOKUP_ERROR', 'db.fetch_profile', profileError.message);
      }

      if (profile?.role !== 'admin') {
        throw new OrderActionError(403, 'AUTH_NOT_ADMIN', 'auth.authorize_admin', 'Admin access required.');
      }

      const refundableStatuses = ['paid', 'shipped', 'delivered'] as const;
      if (!refundableStatuses.includes(order.status as (typeof refundableStatuses)[number])) {
        throw new OrderActionError(
          409,
          'ORDER_NOT_REFUNDABLE',
          'refund.validate',
          `Order status ${order.status} is not refundable.`,
        );
      }

      // Validate stripe secret only when actually needed
      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeSecret) {
        throw new OrderActionError(
          500,
          'CONFIG_MISSING_SECRETS',
          'config.validate_secrets',
          'Missing required Edge Function secret: STRIPE_SECRET_KEY',
        );
      }

      if (!order.stripe_payment_intent_id) {
        throw new OrderActionError(
          400,
          'ORDER_MISSING_PAYMENT_INTENT',
          'refund.validate',
          'Order is missing Stripe payment intent id.',
        );
      }

      let refundAmount: number | null = null;
      let refundAmountCents: number | undefined;
      if (amount != null) {
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
          throw new OrderActionError(400, 'INVALID_REFUND_AMOUNT', 'refund.validate', 'Invalid refund amount.');
        }
        const rounded = Math.round(numericAmount * 100) / 100;
        if (rounded > Number(order.total)) {
          throw new OrderActionError(400, 'REFUND_AMOUNT_TOO_HIGH', 'refund.validate', 'Refund exceeds order total.');
        }
        refundAmount = rounded;
        refundAmountCents = Math.round(rounded * 100);
      }

      // Idempotency key (derived from the order) guarantees that two concurrent
      // admin refund requests create exactly ONE Stripe refund instead of two
      // real refunds. After the first refund the order is locked via refund_id.
      const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
      const refund = await stripe.refunds.create(
        {
          payment_intent: order.stripe_payment_intent_id,
          ...(refundAmountCents ? { amount: refundAmountCents } : {}),
        },
        { idempotencyKey: `refund_${orderId}` },
      );

      const refundValue = refundAmount ?? Math.round((refund.amount ?? 0) / 100 * 100) / 100;

      // Always mark as refunded once Stripe accepts the refund request,
      // regardless of refund.status ('succeeded' or 'pending').
      const updatePayload: Record<string, unknown> = {
        refund_id: refund.id,
        refund_amount: refundValue,
        refunded_at: refund.created
          ? new Date(refund.created * 1000).toISOString()
          : new Date().toISOString(),
        status: 'refunded',
      };

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select('*, order_items(*), profiles(full_name, email, phone)')
        .single();

      if (updateError || !updatedOrder) {
        throw new OrderActionError(
          500,
          'DB_ORDER_UPDATE_ERROR',
          'db.update_order',
          updateError?.message ?? 'Failed to update order after refund.',
        );
      }

      // Send refund confirmation email (non-blocking: failure does not affect the refund response)
      const customer = (updatedOrder as { profiles?: { email?: string; full_name?: string } }).profiles;
      if (customer?.email) {
        sendRefundEmail({
          toEmail: customer.email,
          customerName: customer.full_name ?? 'Customer',
          orderId,
          refundAmount: refundValue,
        }).catch((emailErr) => {
          console.error('Refund email failed (non-blocking):', emailErr);
        });
      }

      return jsonResponse({ order: updatedOrder }, 200, origin);
    }

    if (action === 'deliver') {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new OrderActionError(500, 'DB_PROFILE_LOOKUP_ERROR', 'db.fetch_profile', profileError.message);
      }

      if (profile?.role !== 'admin') {
        throw new OrderActionError(403, 'AUTH_NOT_ADMIN', 'auth.authorize_admin', 'Admin access required.');
      }

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
        .select('*, order_items(*), profiles(full_name, email, phone)')
        .single();

      if (updateError || !updatedOrder) {
        throw new OrderActionError(
          500,
          'DB_ORDER_UPDATE_ERROR',
          'db.update_order',
          updateError?.message ?? 'Failed to mark order as delivered.',
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
