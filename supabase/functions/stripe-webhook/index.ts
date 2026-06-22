import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2024-06-20';

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

async function updateOrderById(
  client: SupabaseClient,
  orderId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await client
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Order update failed: ${error.message}`);
  if (!data) throw new Error(`Order not found for id ${orderId}`);
  return data.id as string;
}

async function updateOrderBySessionId(
  client: SupabaseClient,
  sessionId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await client
    .from('orders')
    .update(updates)
    .eq('stripe_session_id', sessionId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Order update failed: ${error.message}`);
  if (!data) throw new Error(`Order not found for session ${sessionId}`);
  return data.id as string;
}

async function updateOrderByPaymentIntentId(
  client: SupabaseClient,
  paymentIntentId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await client
    .from('orders')
    .update(updates)
    .eq('stripe_payment_intent_id', paymentIntentId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Order update failed: ${error.message}`);
  if (!data) throw new Error(`Order not found for payment_intent ${paymentIntentId}`);
  return data.id as string;
}

const FINAL_STATUSES = ['paid', 'shipped', 'delivered'];
const dollars = (cents: number) => Math.round(cents) / 100;

/**
 * Look up an order's current state by whichever identifier the event carries.
 * Used to (a) avoid touching financial fields after the order is already paid —
 * the DB immutability trigger forbids it — and (b) adopt Stripe's authoritative
 * amount as the order total. Returns null if the order can't be found.
 */
async function fetchOrder(
  client: SupabaseClient,
  ids: { orderId?: string | null; sessionId?: string | null; paymentIntentId?: string | null }
): Promise<{ id: string; status: string; total: number | null } | null> {
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

  const { data: existing, error: existingError } = await client
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existingError) {
    return jsonResponse({ error: existingError.message }, 500);
  }

  if (existing) {
    return jsonResponse({ received: true, duplicate: true });
  }

  let updatedOrderId: string | null = null;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id ?? session.client_reference_id ?? null;
        const paymentStatus = session.payment_status;
        const isPaid = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
        const paymentIntentId = toId(session.payment_intent);

        // This is the authoritative event for fulfillment: it carries the final
        // amount charged and (with Stripe Tax) the tax breakdown.
        const order = await fetchOrder(client, { orderId, sessionId: session.id });
        const alreadyFinal = !!order && FINAL_STATUSES.includes(order.status);

        const updates: Record<string, unknown> = {};
        if (paymentIntentId) updates.stripe_payment_intent_id = paymentIntentId;
        if (session.id) updates.stripe_session_id = session.id;

        // Don't downgrade an order another event already finalized; only set status
        // while it's still pre-payment (the immutability trigger also forbids it).
        if (!alreadyFinal) {
          updates.status = isPaid ? 'paid' : 'requires_action';

          // Adopt Stripe's amount as the source of truth — the line items were built
          // server-side from DB prices, so the charged amount can't be tampered. With
          // Stripe Tax this is where the per-jurisdiction tax lands on the order.
          if (isPaid && typeof session.amount_total === 'number') {
            updates.total = dollars(session.amount_total);
            if (typeof session.total_details?.amount_tax === 'number') {
              updates.tax_amount = dollars(session.total_details.amount_tax);
            }
            if (order && order.total != null && Math.abs((updates.total as number) - order.total) > 0.01) {
              console.log(
                `[webhook] order ${order.id} total ${order.total} → ${updates.total} (authoritative from Stripe)`,
              );
            }
          }
        }

        if (orderId) {
          updatedOrderId = await updateOrderById(client, orderId, updates);
        } else if (session.id) {
          updatedOrderId = await updateOrderBySessionId(client, session.id, updates);
        } else {
          throw new Error('Missing order_id and session.id on checkout.session.completed');
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id ?? null;

        // Backup confirmation. checkout.session.completed normally owns the paid
        // transition + totals; here we always record the payment_intent id, and only
        // mark paid (adopting the captured amount as the total) if no other event has
        // already finalized the order — so we never fight the immutability trigger.
        const order = await fetchOrder(client, { orderId, paymentIntentId: pi.id });
        const alreadyFinal = !!order && FINAL_STATUSES.includes(order.status);

        const updates: Record<string, unknown> = { stripe_payment_intent_id: pi.id };
        if (!alreadyFinal) {
          updates.status = 'paid';
          if (typeof pi.amount_received === 'number') {
            updates.total = dollars(pi.amount_received);
          }
        }

        if (orderId) {
          updatedOrderId = await updateOrderById(client, orderId, updates);
        } else {
          updatedOrderId = await updateOrderByPaymentIntentId(client, pi.id, updates);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id ?? null;
        const updates: Record<string, unknown> = {
          status: 'failed',
          stripe_payment_intent_id: pi.id,
        };

        if (orderId) {
          updatedOrderId = await updateOrderById(client, orderId, updates);
        } else {
          updatedOrderId = await updateOrderByPaymentIntentId(client, pi.id, updates);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id ?? null;
        const updates: Record<string, unknown> = { status: 'cancelled' };

        if (orderId) {
          updatedOrderId = await updateOrderById(client, orderId, updates);
        } else if (session.id) {
          updatedOrderId = await updateOrderBySessionId(client, session.id, updates);
        } else {
          throw new Error('Missing order_id and session.id on checkout.session.expired');
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = toId(charge.payment_intent);
        if (!paymentIntentId) {
          throw new Error('charge.refunded missing payment_intent');
        }

        const refundAmount = Math.round(((charge.amount_refunded ?? 0) / 100) * 100) / 100;
        const updates: Record<string, unknown> = {
          status: 'refunded',
          refund_amount: refundAmount,
          refunded_at: new Date().toISOString(),
        };

        updatedOrderId = await updateOrderByPaymentIntentId(client, paymentIntentId, updates);
        break;
      }

      case 'refund.updated': {
        const refund = event.data.object as Stripe.Refund;
        if (refund.status !== 'succeeded') break;

        const paymentIntentId = toId(refund.payment_intent);
        if (!paymentIntentId) {
          throw new Error('refund.updated missing payment_intent');
        }

        const refundAmount = Math.round(((refund.amount ?? 0) / 100) * 100) / 100;
        const refundedAt = refund.created
          ? new Date(refund.created * 1000).toISOString()
          : new Date().toISOString();

        const updates: Record<string, unknown> = {
          status: 'refunded',
          refund_id: refund.id,
          refund_amount: refundAmount,
          refunded_at: refundedAt,
        };

        updatedOrderId = await updateOrderByPaymentIntentId(client, paymentIntentId, updates);
        break;
      }

      default:
        // Unhandled event type — still record to avoid reprocessing.
        break;
    }

    const orderIdFromMetadata =
      (event.data.object as { metadata?: { order_id?: string } }).metadata?.order_id ?? null;

    const { error: insertError } = await client.from('processed_stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      order_id: updatedOrderId ?? orderIdFromMetadata,
    });

    if (insertError) {
      throw new Error(`Failed to record processed event: ${insertError.message}`);
    }

    return jsonResponse({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error';
    return jsonResponse({ error: message }, 500);
  }
});
