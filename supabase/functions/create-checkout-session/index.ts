import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
      console.error('[checkout] ABORT: missing secrets');
      return new Response(JSON.stringify({
        error: 'Missing required Edge Function secrets.',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAnon = createClient(supabaseUrl, anonKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing Authorization header.',
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: `Invalid or expired session. (${authError?.message ?? 'user not found'})`,
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      return new Response(JSON.stringify({ error: 'No items provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate shipping address fields
    const addr = shipping_address ?? {};
    const requiredAddrFields = ['full_name', 'line1', 'city', 'state', 'postal_code', 'country'];
    const missingFields = requiredAddrFields.filter((f) => !addr[f]);
    if (missingFields.length > 0) {
      return new Response(JSON.stringify({
        error: `Missing shipping address fields: ${missingFields.join(', ')}`,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[checkout] items:', items.length, '| user:', user.id);

    const subtotal = items.reduce(
      (sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity,
      0,
    );
    const shippingCostNum = Number(shipping_cost) || 0;
    const tax = Math.round((subtotal + shippingCostNum) * 0.1 * 100) / 100;
    const orderTotal = Math.round((subtotal + shippingCostNum + tax) * 100) / 100;

    // Create order
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
      throw orderErr;
    }
    console.log('[checkout] order created:', order.id);

    // Insert order items (with optional selected_size)
    const orderItems = items.map((i: {
      product_id: string;
      name: string;
      price: number;
      quantity: number;
      selected_size?: string | null;
    }) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.name,
      quantity: i.quantity,
      unit_price: i.price,
      total_price: Math.round(i.price * i.quantity * 100) / 100,
      selected_size: i.selected_size ?? null,
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) {
      console.error('[checkout] order_items insert error:', itemsErr.message);
      throw itemsErr;
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
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url,
        cancel_url,
        metadata: { order_id: order.id, user_id: user.id },
        automatic_tax: { enabled: false },
      });
      console.log('[checkout] Stripe session created:', session.id);
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      console.error('[checkout] Stripe session create error:', msg);
      throw stripeErr;
    }

    await supabase
      .from('orders')
      .update({ stripe_session_id: session.id, status: 'processing' })
      .eq('id', order.id);

    console.log('[checkout] done — returning checkout URL');
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[checkout] unhandled error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
