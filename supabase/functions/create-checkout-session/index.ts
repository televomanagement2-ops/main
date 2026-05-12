import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

class CheckoutHttpError extends Error {
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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toCheckoutHttpError(err: unknown): CheckoutHttpError {
  if (err instanceof CheckoutHttpError) return err;

  if (err && typeof err === 'object') {
    const maybeStripe = err as { type?: string; message?: string };
    if (typeof maybeStripe.type === 'string' && maybeStripe.type.startsWith('Stripe')) {
      return new CheckoutHttpError(
        502,
        'STRIPE_SESSION_ERROR',
        'stripe.create_session',
        maybeStripe.message || 'Stripe API call failed while creating checkout session.',
      );
    }
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return new CheckoutHttpError(500, 'UNHANDLED_ERROR', 'unknown', message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[checkout] phase=config.start');
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    console.log('[checkout] secrets present:', {
      STRIPE_SECRET_KEY: Boolean(stripeSecret),
      SUPABASE_URL: Boolean(supabaseUrl),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceRoleKey),
      SUPABASE_ANON_KEY: Boolean(anonKey),
    });

    if (!stripeSecret || !supabaseUrl || !serviceRoleKey || !anonKey) {
      const missing: string[] = [];
      if (!stripeSecret) missing.push('STRIPE_SECRET_KEY');
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!anonKey) missing.push('SUPABASE_ANON_KEY');
      console.error('[checkout] phase=config.error missing secrets:', missing.join(', '));
      return jsonResponse({
        error: `Missing required Edge Function secrets: ${missing.join(', ')}`,
        code: 'CONFIG_MISSING_SECRETS',
        phase: 'config.validate_secrets',
      }, 500);
    }

    console.log('[checkout] phase=client.init');
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAnon = createClient(supabaseUrl, anonKey);

    console.log('[checkout] phase=auth.validate_header');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({
        error: 'Missing Authorization header.',
        code: 'AUTH_MISSING_HEADER',
        phase: 'auth.validate_header',
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[checkout] phase=auth.get_user');
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({
        error: `Invalid or expired session. (${authError?.message ?? 'user not found'})`,
        code: 'AUTH_INVALID_SESSION',
        phase: 'auth.get_user',
      }, 401);
    }

    console.log('[checkout] phase=request.parse_json');
    const body = await req.json();
    const {
      items,
      success_url,
      cancel_url,
      shipping_address,
      shipping_method_id,
      shipping_method_name,
      shipping_cost = 0,
    } = body;

    if (!items?.length) {
      return jsonResponse({
        error: 'No items provided',
        code: 'VALIDATION_NO_ITEMS',
        phase: 'request.validate_items',
      }, 400);
    }

    // Validate shipping address fields
    const addr = shipping_address ?? {};
    const requiredAddrFields = ['full_name', 'line1', 'city', 'state', 'postal_code', 'country'];
    const missingFields = requiredAddrFields.filter((f) => !addr[f]);
    if (missingFields.length > 0) {
      return jsonResponse({
        error: `Missing shipping address fields: ${missingFields.join(', ')}`,
        code: 'VALIDATION_MISSING_SHIPPING_ADDRESS_FIELDS',
        phase: 'request.validate_shipping_address',
      }, 400);
    }

    console.log('[checkout] items:', items.length, '| user:', user.id);

    const subtotal = items.reduce(
      (sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity,
      0,
    );
    const shippingCostNum = Number(shipping_cost) || 0;
    const tax = Math.round((subtotal + shippingCostNum) * 0.1 * 100) / 100;
    const orderTotal = Math.round((subtotal + shippingCostNum + tax) * 100) / 100;
    let orderId: string | null = null;

    // Create order
    console.log('[checkout] phase=db.insert_order');
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'pending',
        total: orderTotal,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: tax,
        shipping_cost: shippingCostNum,
        shipping_address: addr,
        shipping_method_id: shipping_method_id || null,
        shipping_method_name: shipping_method_name || null,
      })
      .select()
      .single();

    if (orderErr) {
      console.error('[checkout] order insert error:', orderErr.message);
      throw new CheckoutHttpError(
        500,
        'DB_ORDER_INSERT_ERROR',
        'db.insert_order',
        `Failed to create order: ${orderErr.message}`,
      );
    }
    orderId = order.id;
    console.log('[checkout] order created:', order.id);

    // Insert order items (with optional selected_size)
    const orderItems = items.map((i: {
      product_id: string;
      name: string;
      price: number;
      quantity: number;
      image?: string | null;
      selected_size?: string | null;
    }) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.name,
      product_image: i.image ?? null,
      quantity: i.quantity,
      unit_price: i.price,
      total_price: Math.round(i.price * i.quantity * 100) / 100,
      selected_size: i.selected_size ?? null,
    }));

    console.log('[checkout] phase=db.insert_order_items');
    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) {
      console.error('[checkout] order_items insert error:', itemsErr.message);
      // Best-effort rollback to avoid orphan pending order without items.
      await supabase.from('orders').delete().eq('id', order.id);
      throw new CheckoutHttpError(
        500,
        'DB_ORDER_ITEMS_INSERT_ERROR',
        'db.insert_order_items',
        `Failed to create order items: ${itemsErr.message}`,
      );
    }

    // Build Stripe line items — include shipping as a separate line if non-zero
    const lineItems = items.map((i: {
      name: string;
      price: number;
      quantity: number;
      image?: string | null;
      selected_size?: string | null;
    }) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: i.selected_size ? `${i.name} (${i.selected_size})` : i.name,
          ...(i.image ? { images: [i.image] } : {}),
        },
        unit_amount: Math.round(i.price * 100),
      },
      quantity: i.quantity,
    }));

    if (shippingCostNum > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `Shipping — ${shipping_method_name ?? 'Standard'}` },
          unit_amount: Math.round(shippingCostNum * 100),
        },
        quantity: 1,
      });
    }

    let session;
    try {
      console.log('[checkout] phase=stripe.create_session');
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url,
        cancel_url,
        client_reference_id: order.id,
        metadata: { order_id: order.id, user_id: user.id },
        payment_intent_data: {
          metadata: { order_id: order.id, user_id: user.id },
        },
        automatic_tax: { enabled: false },
      });
      console.log('[checkout] Stripe session created:', session.id);
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      console.error('[checkout] Stripe session create error:', msg);
      if (orderId) {
        await supabase
          .from('orders')
          .update({ status: 'failed' })
          .eq('id', orderId)
          .in('status', ['pending', 'processing', 'requires_action']);
      }
      throw new CheckoutHttpError(
        502,
        'STRIPE_SESSION_ERROR',
        'stripe.create_session',
        msg,
      );
    }

    console.log('[checkout] phase=db.update_order_processing');
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ stripe_session_id: session.id, status: 'processing' })
      .eq('id', order.id);

    if (updateErr) {
      console.error('[checkout] order update error:', updateErr.message);
      throw new CheckoutHttpError(
        500,
        'DB_ORDER_UPDATE_ERROR',
        'db.update_order_processing',
        `Failed to update order with Stripe session: ${updateErr.message}`,
      );
    }

    console.log('[checkout] done — returning checkout URL');
    if (!session.url) {
      throw new CheckoutHttpError(
        502,
        'STRIPE_SESSION_MISSING_URL',
        'stripe.session_response',
        'Stripe did not return a redirect URL.',
      );
    }
    return jsonResponse({ url: session.url });
  } catch (err) {
    const checkoutErr = toCheckoutHttpError(err);
    console.error('[checkout] failure:', {
      code: checkoutErr.code,
      status: checkoutErr.status,
      phase: checkoutErr.phase,
      message: checkoutErr.message,
    });
    return jsonResponse(
      {
        error: checkoutErr.message,
        code: checkoutErr.code,
        phase: checkoutErr.phase,
      },
      checkoutErr.status,
    );
  }
});
