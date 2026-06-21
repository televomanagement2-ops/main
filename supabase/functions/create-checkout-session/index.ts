import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Origins allowed to call this function from a browser. Set the ALLOWED_ORIGINS
// secret to a comma-separated list (e.g. "https://commercejet.com,https://www.commercejet.com").
// Falls back to "*" only if unset, so local dev keeps working before deploy config.
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function getCorsHeaders(origin: string | null) {
  const allowOrigin = allowedOrigins.includes('*')
    ? '*'
    : (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  } as Record<string, string>;
}

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
  const origin = req.headers.get('Origin');
  const jsonResponse = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }

  try {
    console.log('[checkout] phase=config.start');
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

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

    console.log('[checkout] items:', items.length);

    // ── SECURITY: never trust client-supplied prices. Resolve authoritative
    // prices, names and availability from the database (service role). The
    // client `price`/`name`/`shipping_cost` fields are ignored entirely.
    type CheckoutItem = {
      product_id: string;
      quantity: number;
      image?: string | null;
      selected_size?: string | null;
    };
    const requestedItems = items as CheckoutItem[];

    const productIds = [...new Set(requestedItems.map((i) => i.product_id))];
    if (productIds.some((id) => !id)) {
      return jsonResponse({
        error: 'One or more items are missing product_id.',
        code: 'VALIDATION_MISSING_PRODUCT_ID',
        phase: 'request.validate_items',
      }, 400);
    }

    const { data: dbProducts, error: productsErr } = await supabase
      .from('products')
      .select('id, name, price, is_active, stock_quantity')
      .in('id', productIds);

    if (productsErr) {
      throw new CheckoutHttpError(
        500,
        'DB_PRODUCT_LOOKUP_ERROR',
        'db.fetch_products',
        `Failed to load products: ${productsErr.message}`,
      );
    }

    const productById = new Map((dbProducts ?? []).map((p) => [p.id as string, p]));

    // Build trusted line items from DB data only.
    const resolvedItems = requestedItems.map((i) => {
      const product = productById.get(i.product_id);
      if (!product) {
        throw new CheckoutHttpError(
          400,
          'PRODUCT_NOT_FOUND',
          'request.resolve_prices',
          `Product ${i.product_id} does not exist.`,
        );
      }
      if (product.is_active === false) {
        throw new CheckoutHttpError(
          409,
          'PRODUCT_INACTIVE',
          'request.resolve_prices',
          `Product "${product.name}" is no longer available.`,
        );
      }
      const quantity = Math.trunc(Number(i.quantity));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new CheckoutHttpError(
          400,
          'INVALID_QUANTITY',
          'request.resolve_prices',
          `Invalid quantity for product "${product.name}".`,
        );
      }
      if (typeof product.stock_quantity === 'number' && quantity > product.stock_quantity) {
        throw new CheckoutHttpError(
          409,
          'INSUFFICIENT_STOCK',
          'request.resolve_prices',
          `Insufficient stock for "${product.name}".`,
        );
      }
      const unitPrice = Math.round(Number(product.price) * 100) / 100;
      return {
        product_id: product.id as string,
        name: product.name as string,
        unit_price: unitPrice,
        quantity,
        image: i.image ?? null,
        selected_size: i.selected_size ?? null,
      };
    });

    // ── SECURITY: resolve shipping cost from the DB, never from the client.
    let resolvedShippingCost = 0;
    let resolvedShippingName: string | null = null;
    if (shipping_method_id) {
      const { data: method, error: methodErr } = await supabase
        .from('shipping_methods')
        .select('id, name, price, is_active')
        .eq('id', shipping_method_id)
        .maybeSingle();

      if (methodErr) {
        throw new CheckoutHttpError(
          500,
          'DB_SHIPPING_LOOKUP_ERROR',
          'db.fetch_shipping_method',
          `Failed to load shipping method: ${methodErr.message}`,
        );
      }
      if (!method || method.is_active === false) {
        return jsonResponse({
          error: 'Selected shipping method is not available.',
          code: 'SHIPPING_METHOD_UNAVAILABLE',
          phase: 'request.resolve_shipping',
        }, 400);
      }
      resolvedShippingCost = Math.round(Number(method.price) * 100) / 100;
      resolvedShippingName = method.name as string;
    }

    const subtotal = Math.round(
      resolvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) * 100,
    ) / 100;
    const tax = Math.round((subtotal + resolvedShippingCost) * 0.1 * 100) / 100;
    const orderTotal = Math.round((subtotal + resolvedShippingCost + tax) * 100) / 100;
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
        shipping_cost: resolvedShippingCost,
        shipping_address: addr,
        shipping_method_id: shipping_method_id || null,
        shipping_method_name: resolvedShippingName,
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

    // Insert order items (prices resolved from DB, with optional selected_size)
    const orderItems = resolvedItems.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.name,
      product_image: i.image,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: Math.round(i.unit_price * i.quantity * 100) / 100,
      selected_size: i.selected_size,
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

    // Build Stripe line items from resolved (DB-trusted) data
    const lineItems = resolvedItems.map((i) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: i.selected_size ? `${i.name} (${i.selected_size})` : i.name,
          ...(i.image ? { images: [i.image] } : {}),
        },
        unit_amount: Math.round(i.unit_price * 100),
      },
      quantity: i.quantity,
    }));

    if (resolvedShippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `Shipping — ${resolvedShippingName ?? 'Standard'}` },
          unit_amount: Math.round(resolvedShippingCost * 100),
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
