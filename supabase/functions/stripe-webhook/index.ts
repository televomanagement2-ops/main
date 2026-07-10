import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { formatMoney, renderEmail, escapeHtml, STORE_NAME } from '../_shared/store.ts';
import { sendEmail } from '../_shared/email.ts';
import { decide, type OrderState, type WebhookEventInfo } from '../_shared/webhook-logic.ts';

const STRIPE_API_VERSION = '2025-03-31.basil';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

let stripe: Stripe | null = null;
let supabase: ReturnType<typeof createClient> | null = null;

type SupabaseClient = ReturnType<typeof createClient>;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getStripeClient() {
  if (!stripe) {
    stripe = new Stripe(stripeSecret!, { apiVersion: STRIPE_API_VERSION });
  }
  return stripe;
}

function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  }
  return supabase;
}

function toId(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.id === 'string') return value.id;
  return null;
}

/**
 * Postgres raised a business-rule rejection (transition guard, immutability
 * trigger, CHECK constraint). Stripe retrying the exact same event can never
 * succeed — so we park the order (needs_review) and ACK with 200 instead of
 * letting the webhook fail forever on an order whose money was already taken.
 */
class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function isBusinessRuleCode(code: string | undefined, message: string): boolean {
  if (code === 'P0001') return true; // plpgsql RAISE EXCEPTION
  if (code && /^23/.test(code)) return true; // integrity constraint violations
  return /Invalid order status transition|immutable/i.test(message);
}

async function updateOrder(
  client: SupabaseClient,
  ids: { orderId?: string | null; sessionId?: string | null; paymentIntentId?: string | null },
  updates: Record<string, unknown>,
): Promise<string> {
  let query = client.from('orders').update(updates);
  if (ids.orderId) query = query.eq('id', ids.orderId);
  else if (ids.sessionId) query = query.eq('stripe_session_id', ids.sessionId);
  else if (ids.paymentIntentId) query = query.eq('stripe_payment_intent_id', ids.paymentIntentId);
  else throw new Error('No identifier available to update order');

  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code;
    if (isBusinessRuleCode(code, error.message)) {
      throw new BusinessRuleError(error.message);
    }
    throw new Error(`Order update failed: ${error.message}`);
  }
  if (!data) throw new Error(`Order not found for ${JSON.stringify(ids)}`);
  return data.id as string;
}

async function fetchOrder(
  client: SupabaseClient,
  ids: { orderId?: string | null; sessionId?: string | null; paymentIntentId?: string | null },
): Promise<OrderState | null> {
  let query = client.from('orders').select('id, status, total');
  if (ids.orderId) query = query.eq('id', ids.orderId);
  else if (ids.sessionId) query = query.eq('stripe_session_id', ids.sessionId);
  else if (ids.paymentIntentId) query = query.eq('stripe_payment_intent_id', ids.paymentIntentId);
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id as string,
    status: data.status as string,
    total: data.total == null ? null : Number(data.total),
  };
}

/** Map a verified Stripe event to the plain summary the decision logic uses. */
function mapEvent(event: Stripe.Event): WebhookEventInfo | null {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        type: 'checkout.session.completed',
        orderId: session.metadata?.order_id ?? session.client_reference_id ?? null,
        sessionId: session.id ?? null,
        paymentIntentId: toId(session.payment_intent),
        paymentStatus: session.payment_status,
        amountTotal: typeof session.amount_total === 'number' ? session.amount_total : null,
        amountTax:
          typeof session.total_details?.amount_tax === 'number'
            ? session.total_details.amount_tax
            : null,
      };
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      return {
        type: 'payment_intent.succeeded',
        orderId: pi.metadata?.order_id ?? null,
        paymentIntentId: pi.id,
        amountReceived: typeof pi.amount_received === 'number' ? pi.amount_received : null,
      };
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      return {
        type: 'payment_intent.payment_failed',
        orderId: pi.metadata?.order_id ?? null,
        paymentIntentId: pi.id,
      };
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        type: 'checkout.session.expired',
        orderId: session.metadata?.order_id ?? null,
        sessionId: session.id ?? null,
      };
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      return {
        type: 'charge.refunded',
        paymentIntentId: toId(charge.payment_intent),
        amountRefunded: charge.amount_refunded ?? 0,
        amountCharged: charge.amount ?? 0,
      };
    }
    case 'refund.updated': {
      const refund = event.data.object as Stripe.Refund;
      return {
        type: 'refund.updated',
        paymentIntentId: toId(refund.payment_intent),
        refundId: refund.id,
        refundStatus: refund.status ?? '',
        amount: refund.amount ?? 0,
        createdAt: refund.created ? new Date(refund.created * 1000).toISOString() : null,
      };
    }
    default:
      return null; // unhandled event type — recorded and ACKed
  }
}

/** Order confirmation email — fire-and-forget from the webhook. */
async function sendOrderConfirmationEmail(client: SupabaseClient, orderId: string) {
  const { data: order, error } = await client
    .from('orders')
    .select(
      'id, total, shipping_cost, shipping_method_name, order_items(product_name, quantity, unit_price, selected_size), profiles(email, full_name)',
    )
    .eq('id', orderId)
    .single();

  if (error || !order) {
    throw new Error(`Confirmation email lookup failed: ${error?.message ?? 'order not found'}`);
  }

  const profile = order.profiles as { email?: string; full_name?: string } | null;
  const customerEmail = profile?.email;
  if (!customerEmail) {
    console.warn(`[webhook] order ${orderId}: no customer email — skipping confirmation`);
    return;
  }

  const customerName = profile?.full_name || 'there';
  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const items = (order.order_items ?? []) as Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    selected_size: string | null;
  }>;

  const itemRowsHtml = items
    .map((item) => {
      const name = escapeHtml(
        item.selected_size ? `${item.product_name} (${item.selected_size})` : item.product_name,
      );
      return `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #444;">${name} × ${item.quantity}</td>
          <td style="padding: 8px 0; font-size: 14px; color: #444; text-align: right;">${formatMoney(Number(item.unit_price) * item.quantity)}</td>
        </tr>`;
    })
    .join('');

  const itemLinesText = items
    .map(
      (item) =>
        `- ${item.selected_size ? `${item.product_name} (${item.selected_size})` : item.product_name} × ${item.quantity}: ${formatMoney(Number(item.unit_price) * item.quantity)}`,
    )
    .join('\n');

  await sendEmail({
    to: customerEmail,
    subject: `Order confirmed — #${shortOrderId}`,
    html: renderEmail({
      eyebrow: 'Order confirmed',
      heading: `Thanks for your order, ${escapeHtml(customerName)}!`,
      bodyHtml: `
        <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">
          We've received your payment for order <strong>#${shortOrderId}</strong> and we're getting it ready to ship.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 16px;">
          ${itemRowsHtml}
          <tr>
            <td style="padding: 12px 0 0; font-size: 15px; font-weight: 700; border-top: 1px solid #eee;">Total</td>
            <td style="padding: 12px 0 0; font-size: 15px; font-weight: 700; text-align: right; border-top: 1px solid #eee;">${formatMoney(Number(order.total))}</td>
          </tr>
        </table>
        <p style="font-size: 14px; color: #666; line-height: 1.7; margin: 0;">
          We'll email you tracking details as soon as your order ships. Questions? Just reply to this email.
        </p>
      `,
    }),
    text: `Hi ${customerName},\n\nWe've received your payment for order #${shortOrderId}.\n\n${itemLinesText}\n\nTotal: ${formatMoney(Number(order.total))}\n\nWe'll email you tracking details as soon as it ships.\n\nThanks for shopping with ${STORE_NAME}.`,
  });
}

Deno.serve(async (req) => {
  const missing: string[] = [];
  if (!stripeSecret) missing.push('STRIPE_SECRET_KEY');
  if (!webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    return jsonResponse({
      error: `Missing required secrets: ${missing.join(', ')}`,
    }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing stripe-signature' }, 400);
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await getStripeClient().webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Webhook signature verification failed: ${message}` }, 400);
  }

  const client = getSupabaseClient();

  // ── Idempotency: claim the event FIRST (insert-first, not check-then-insert,
  // so two concurrent deliveries can't both process it). Zero rows returned
  // means another delivery already claimed this event id.
  const { data: claimed, error: claimError } = await client
    .from('processed_stripe_events')
    .upsert(
      { event_id: event.id, event_type: event.type },
      { onConflict: 'event_id', ignoreDuplicates: true },
    )
    .select('event_id');

  if (claimError) {
    return jsonResponse({ error: claimError.message }, 500);
  }
  if (!claimed || claimed.length === 0) {
    return jsonResponse({ received: true, duplicate: true });
  }

  // On transient failures we must release the claim before returning 500,
  // otherwise Stripe's retry would be swallowed as a "duplicate".
  const releaseClaim = async () => {
    const { error } = await client
      .from('processed_stripe_events')
      .delete()
      .eq('event_id', event.id);
    if (error) {
      console.error(`[webhook] failed to release claim for ${event.id}: ${error.message}`);
    }
  };

  const info = mapEvent(event);

  try {
    let updatedOrderId: string | null = null;

    if (info) {
      const ids = {
        orderId: 'orderId' in info ? info.orderId : null,
        sessionId: 'sessionId' in info ? info.sessionId : null,
        paymentIntentId: 'paymentIntentId' in info ? info.paymentIntentId : null,
      };

      const order = await fetchOrder(client, ids);
      const decision = decide(info, order);

      switch (decision.action) {
        case 'skip':
          console.log(`[webhook] ${event.type} skipped: ${decision.reason}`);
          updatedOrderId = order?.id ?? null;
          break;

        case 'invalid':
          // Malformed event payload — retrying can't fix it; record and ACK.
          console.error(`[webhook] ${event.type} invalid: ${decision.reason}`);
          break;

        case 'update': {
          try {
            updatedOrderId = await updateOrder(client, ids, decision.updates);

            if (decision.sendConfirmationEmail && updatedOrderId) {
              // Fire-and-forget: a Resend hiccup must not fail the webhook.
              sendOrderConfirmationEmail(client, updatedOrderId).catch((emailErr) => {
                console.error('Order confirmation email failed (non-blocking):', emailErr);
              });
            }
          } catch (err) {
            if (!(err instanceof BusinessRuleError)) throw err;

            // Business-rule rejection (e.g. paid event arriving after the
            // order was cancelled): park the order for the operator instead
            // of failing forever — the customer's money was already taken.
            console.error(
              `[webhook] ${event.type} rejected by business rules — parking order: ${err.message}`,
            );
            if (order) {
              const { error: parkError } = await client
                .from('orders')
                .update({
                  needs_review: true,
                  review_reason: `${event.type}: ${err.message}`.slice(0, 500),
                })
                .eq('id', order.id);
              if (parkError) {
                // Couldn't even park it — treat as transient so Stripe retries.
                throw new Error(`Failed to park order ${order.id}: ${parkError.message}`);
              }
              updatedOrderId = order.id;
            }
          }
          break;
        }
      }
    }

    // Attach the affected order to the processed-event record for debugging.
    const orderIdFromMetadata =
      (event.data.object as { metadata?: { order_id?: string } }).metadata?.order_id ?? null;
    const { error: recordError } = await client
      .from('processed_stripe_events')
      .update({ order_id: updatedOrderId ?? orderIdFromMetadata })
      .eq('event_id', event.id);
    if (recordError) {
      console.error(`[webhook] failed to record order id: ${recordError.message}`);
    }

    return jsonResponse({ received: true });
  } catch (err) {
    // Transient failure (network / Supabase 5xx / order not visible yet):
    // release the idempotency claim and let Stripe retry.
    const message = err instanceof Error ? err.message : 'Handler error';
    console.error(`[webhook] ${event.type} transient failure: ${message}`);
    await releaseClaim();
    return jsonResponse({ error: message }, 500);
  }
});
