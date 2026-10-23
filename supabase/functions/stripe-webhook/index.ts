import Stripe from 'npm:stripe@18';
import { createClient, type SupabaseClient as Client } from 'npm:@supabase/supabase-js@2';
import { sendOrderConfirmationEmail } from '../_shared/order-emails.ts';
import { decide, dollars, type OrderState, type WebhookEventInfo } from '../_shared/webhook-logic.ts';

const STRIPE_API_VERSION = '2025-03-31.basil';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// MUST match create-checkout-session: it decides whether the recorded order
// total already includes tax, which is what amount reconciliation compares
// against. Setting it in only one of the two functions will park paid orders
// for review (fail-safe, but noisy) — keep the secret in sync.
const stripeTaxEnabled =
  (Deno.env.get('STRIPE_TAX_ENABLED') ?? 'false').toLowerCase() === 'true';

// The generated database types are not available to the functions, so the
// client is untyped.
/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore no-explicit-any
type SupabaseClient = Client<any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

let stripe: Stripe | null = null;
let supabase: SupabaseClient | null = null;

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

/**
 * Mirror every refund of a payment from Stripe into order_refunds and update
 * the order (sync_order_refunds, migration 024). Reading Stripe instead of the
 * event payload is what makes several partial refunds — including ones made
 * in the Stripe Dashboard — add up correctly. Returns the order id, or null
 * when no order uses this payment.
 */
async function syncRefunds(client: SupabaseClient, paymentIntentId: string): Promise<string | null> {
  const stripeClient = getStripeClient();
  const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  const charge = (typeof intent.latest_charge === 'object' ? intent.latest_charge : null) as Stripe.Charge | null;
  const refunds = await stripeClient.refunds.list({ payment_intent: paymentIntentId, limit: 100 });

  const { data, error } = await client.rpc('sync_order_refunds', {
    p_payment_intent: paymentIntentId,
    p_refunds: refunds.data.map((refund) => ({
      id: refund.id,
      amount: dollars(refund.amount ?? 0),
      status: refund.status ?? 'pending',
      request_id: refund.metadata?.refund_request_id ?? null,
      created: refund.created ? new Date(refund.created * 1000).toISOString() : null,
    })),
    p_amount_refunded: charge ? dollars(charge.amount_refunded ?? 0) : null,
    p_amount_charged: charge ? dollars(charge.amount ?? 0) : null,
  });

  if (error) {
    const code = (error as { code?: string }).code;
    if (isBusinessRuleCode(code, error.message)) throw new BusinessRuleError(error.message);
    throw new Error(`Refund sync failed: ${error.message}`);
  }
  return (data as string | null) ?? null;
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
      webhookSecret!, // checked with the other secrets above
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
      const decision = decide(info, order, { stripeTaxEnabled });

      switch (decision.action) {
        case 'skip':
          console.log(`[webhook] ${event.type} skipped: ${decision.reason}`);
          updatedOrderId = order?.id ?? null;
          break;

        case 'invalid':
          // Malformed event payload — retrying can't fix it; record and ACK.
          console.error(`[webhook] ${event.type} invalid: ${decision.reason}`);
          break;

        case 'sync_refunds': {
          try {
            updatedOrderId = await syncRefunds(client, decision.paymentIntentId);
          } catch (err) {
            if (!(err instanceof BusinessRuleError)) throw err;
            console.error(`[webhook] ${event.type} refund sync rejected by business rules: ${err.message}`);
            if (order) {
              const { error: parkError } = await client
                .from('orders')
                .update({ needs_review: true, review_reason: `${event.type}: ${err.message}`.slice(0, 500) })
                .eq('id', order.id);
              if (parkError) throw new Error(`Failed to park order ${order.id}: ${parkError.message}`);
              updatedOrderId = order.id;
            }
          }
          break;
        }

        case 'update': {
          try {
            if (decision.updates.needs_review) {
              // Loud on purpose: the charge did not reconcile against the
              // recorded total, so the order is held instead of fulfilled.
              console.error(
                `[webhook] ${event.type} HELD FOR REVIEW (order ${order?.id ?? 'unknown'}): ${decision.updates.review_reason}`,
              );
            }
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
