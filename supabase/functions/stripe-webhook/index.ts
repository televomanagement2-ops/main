import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
  }

  // Idempotency guard — ignore already-processed events
  const { data: existing } = await supabase
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) break;

        const paymentStatus = session.payment_status;
        const newStatus = paymentStatus === 'paid' ? 'paid' : 'requires_action';

        await supabase
          .from('orders')
          .update({
            status: newStatus,
            stripe_payment_intent_id: session.payment_intent as string ?? null,
          })
          .eq('id', orderId);
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('stripe_payment_intent_id', pi.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await supabase
          .from('orders')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', pi.id);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) break;
        await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId)
          .in('status', ['pending', 'processing']);
        break;
      }

      default:
        // unhandled event type — still record it to avoid reprocessing
        break;
    }

    // Mark event as processed
    await supabase.from('processed_stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      order_id: (event.data.object as { metadata?: { order_id?: string } }).metadata?.order_id ?? null,
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
