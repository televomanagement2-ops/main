import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveAllowedOrigin, getCorsHeaders } from '../_shared/cors.ts';
import { sanitizeAddress } from '../_shared/address.ts';
import { STRIPE_CURRENCY } from '../_shared/money.ts';

const STRIPE_API_VERSION = '2025-03-31.basil';

// Abuse limits: a legitimate shopper never needs more than this.
const MAX_LINE_ITEMS = 50;
const MAX_QUANTITY_PER_ITEM = 100;
const MAX_ORDERS_PER_HOUR = 10;

// Checkout sessions expire after 1 hour (Stripe minimum is 30 minutes). This
// MUST stay below the 2-hour window of expire_stale_pending_orders(): the cron
// can then never cancel an order whose session is still payable — the race that
// used to produce paid-but-cancelled orders.
const SESSION_TTL_SECONDS = 60 * 60;

// ── Tax configuration ────────────────────────────────────────────────────────
// STRIPE_TAX_ENABLED=true uses Stripe Tax to compute the correct per-jurisdiction
// US sales tax at checkout (requires Stripe Tax configured in the dashboard). When
// false (default), a flat estimate of TAX_RATE (fraction, e.g. 0.07) is charged as
// an explicit line item. TAX_RATE defaults to 0 — a fresh template charges no tax
// until the operator either sets a rate or enables Stripe Tax. Keep TAX_RATE in
// sync with the frontend VITE_TAX_RATE.
const stripeTaxEnabled = (Deno.env.get('STRIPE_TAX_ENABLED') ?? 'false').toLowerCase() === 'true';
const TAX_RATE = (() => {
  const n = Number(Deno.env.get('TAX_RATE') ?? '0');
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

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

    // ── SECURITY: redirect URLs are built server-side from the request Origin,
    // never taken from the request body. The origin must be explicitly allowed
    // (fail closed) — otherwise a forged request could bounce the buyer, and
    // the Stripe success URL, to an attacker-controlled site.
    const trustedOrigin = resolveAllowedOrigin(origin);
    if (!trustedOrigin) {
      return jsonResponse({
        error: 'Origin not allowed.',
        code: 'ORIGIN_NOT_ALLOWED',
        phase: 'request.validate_origin',
      }, 403);
    }

    console.log('[checkout] phase=client.init');
    const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
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
    const { items, shipping_address, shipping_method_id } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({
        error: 'No items provided',
        code: 'VALIDATION_NO_ITEMS',
        phase: 'request.validate_items',
      }, 400);
    }
    if (items.length > MAX_LINE_ITEMS) {
      return jsonResponse({
        error: `Too many line items (max ${MAX_LINE_ITEMS}).`,
        code: 'VALIDATION_TOO_MANY_ITEMS',
        phase: 'request.validate_items',
      }, 400);
    }

    // ── SECURITY: validate, normalise and whitelist the shipping address.
    // It is persisted verbatim into the orders.shipping_address JSONB and, with
    // Stripe Tax on, sent to stripe.customers.create — so a presence check was
    // not enough: unbounded blobs, non-string values and countries the store
    // does not ship to all got through. The country list and postal patterns
    // live in _shared/address.ts, shared with the checkout form, so the two can
    // never drift apart.
    const addressCheck = sanitizeAddress(shipping_address);
    if (!addressCheck.ok) {
      return jsonResponse({
        error: addressCheck.message,
        code: addressCheck.code,
        phase: 'request.validate_shipping_address',
      }, 400);
    }
    const addr = addressCheck.address;

    console.log('[checkout] items:', items.length);

    // ── RATE LIMIT: cap checkout attempts per user per hour. The DB
    // pending-order-limit trigger (migration 013) is the backstop.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentOrders, error: rateErr } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (rateErr) {
      throw new CheckoutHttpError(
        500,
        'DB_RATE_LIMIT_ERROR',
        'db.rate_limit',
        `Failed to check order rate: ${rateErr.message}`,
      );
    }
    if ((recentOrders ?? 0) >= MAX_ORDERS_PER_HOUR) {
      return jsonResponse({
        error: 'Too many checkout attempts. Please try again later.',
        code: 'RATE_LIMITED',
        phase: 'request.rate_limit',
      }, 429);
    }

    // ── SECURITY: never trust client-supplied prices, names or images.
    // Everything is resolved from the database (service role); the client
    // only sends product_id / quantity / selected_size.
    type CheckoutItem = {
      product_id: string;
      quantity: number;
      selected_size?: string | null;
    };
    const requestedItems = items as CheckoutItem[];

    if (requestedItems.some((i) => !i || !i.product_id)) {
      return jsonResponse({
        error: 'One or more items are missing product_id.',
        code: 'VALIDATION_MISSING_PRODUCT_ID',
        phase: 'request.validate_items',
      }, 400);
    }

    // ── SECURITY: collapse duplicate lines BEFORE validating. The stock and
    // quantity checks below are only meaningful against the TOTAL quantity
    // requested for a variant. Checking each line independently let 50 separate
    // lines of the same product, each at the stock limit, pass individually and
    // oversell by 50× (the DB deliberately allows negative stock, so there is
    // no backstop there).
    const variantKey = (productId: string, size: string | null) => `${productId}::${size ?? ''}`;

    const merged = new Map<
      string,
      { product_id: string; selected_size: string | null; quantity: number }
    >();
    for (const i of requestedItems) {
      const quantity = Math.trunc(Number(i.quantity));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return jsonResponse({
          error: 'Invalid quantity.',
          code: 'INVALID_QUANTITY',
          phase: 'request.validate_items',
        }, 400);
      }
      const size = i.selected_size ?? null;
      const key = variantKey(i.product_id, size);
      const existing = merged.get(key);
      if (existing) existing.quantity += quantity;
      else merged.set(key, { product_id: i.product_id, selected_size: size, quantity });
    }
    const mergedItems = [...merged.values()];

    // products.stock_quantity is shared across every size of a product (the
    // deduct trigger decrements it for each order_item regardless of variant),
    // so the product-level check has to use the combined total, not per-size.
    const quantityByProduct = new Map<string, number>();
    for (const i of mergedItems) {
      quantityByProduct.set(i.product_id, (quantityByProduct.get(i.product_id) ?? 0) + i.quantity);
    }

    const productIds = [...quantityByProduct.keys()];

    const { data: dbProducts, error: productsErr } = await supabase
      .from('products')
      .select('id, name, price, is_active, stock_quantity, product_images(url, is_primary)')
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

    // ── Variant enforcement: a sized item must reference an active variant
    // with sufficient stock — the size selector can't be bypassed.
    const sizedItems = mergedItems.filter((i) => i.selected_size);
    let variantStock = new Map<string, { stock_qty: number }>();
    if (sizedItems.length > 0) {
      const { data: variants, error: variantsErr } = await supabase
        .from('product_variants')
        .select('product_id, size, stock_qty')
        .in('product_id', [...new Set(sizedItems.map((i) => i.product_id))])
        .eq('is_active', true);

      if (variantsErr) {
        throw new CheckoutHttpError(
          500,
          'DB_VARIANT_LOOKUP_ERROR',
          'db.fetch_variants',
          `Failed to load product variants: ${variantsErr.message}`,
        );
      }
      variantStock = new Map(
        (variants ?? []).map((v) => [
          variantKey(v.product_id as string, v.size as string),
          { stock_qty: Number(v.stock_qty) },
        ]),
      );
    }

    // Build trusted line items from DB data only.
    const resolvedItems = mergedItems.map((i) => {
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
      // Already summed across duplicate lines and validated as a positive
      // integer while merging.
      const quantity = i.quantity;
      if (quantity > MAX_QUANTITY_PER_ITEM) {
        throw new CheckoutHttpError(
          400,
          'INVALID_QUANTITY',
          'request.resolve_prices',
          `Invalid quantity for product "${product.name}" (max ${MAX_QUANTITY_PER_ITEM}).`,
        );
      }
      // Combined across every size of this product — product stock is shared.
      const productTotal = quantityByProduct.get(i.product_id) ?? quantity;
      if (typeof product.stock_quantity === 'number' && productTotal > product.stock_quantity) {
        throw new CheckoutHttpError(
          409,
          'INSUFFICIENT_STOCK',
          'request.resolve_prices',
          `Insufficient stock for "${product.name}".`,
        );
      }
      if (i.selected_size) {
        const variant = variantStock.get(variantKey(i.product_id, i.selected_size));
        if (!variant) {
          throw new CheckoutHttpError(
            409,
            'VARIANT_NOT_FOUND',
            'request.resolve_variants',
            `Size "${i.selected_size}" is not available for "${product.name}".`,
          );
        }
        if (variant.stock_qty < quantity) {
          throw new CheckoutHttpError(
            409,
            'INSUFFICIENT_STOCK',
            'request.resolve_variants',
            `Insufficient stock for "${product.name}" size ${i.selected_size}.`,
          );
        }
      }
      const unitPrice = Math.round(Number(product.price) * 100) / 100;
      const images = (product.product_images ?? []) as { url: string; is_primary: boolean }[];
      const image = images.find((img) => img.is_primary)?.url ?? images[0]?.url ?? null;
      return {
        product_id: product.id as string,
        name: product.name as string,
        unit_price: unitPrice,
        quantity,
        image,
        selected_size: i.selected_size ?? null,
      };
    });

    // ── SECURITY: resolve shipping cost from the DB, never from the client.
    // `countries` scopes a method to a set of ISO codes; NULL means it is
    // offered everywhere (migration 017).
    let resolvedShippingCost = 0;
    let resolvedShippingName: string | null = null;
    if (shipping_method_id) {
      const { data: method, error: methodErr } = await supabase
        .from('shipping_methods')
        .select('id, name, price, is_active, countries')
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

      // The storefront filters the list by country, but the client is never the
      // trust boundary: a hand-written request could name the cheap domestic
      // method for an overseas address.
      const methodCountries = (method.countries ?? null) as string[] | null;
      if (methodCountries && !methodCountries.some((c) => String(c).toUpperCase() === addr.country)) {
        return jsonResponse({
          error: `"${method.name}" is not available for ${addr.country}.`,
          code: 'SHIPPING_METHOD_NOT_AVAILABLE_FOR_COUNTRY',
          phase: 'request.resolve_shipping',
        }, 400);
      }

      resolvedShippingCost = Math.round(Number(method.price) * 100) / 100;
      resolvedShippingName = method.name as string;
    } else {
      // ── Omitting shipping_method_id used to mean free shipping, anywhere.
      // The storefront always sends one, so only a hand-written request took
      // this path — and it got an overseas parcel carried for nothing. If the
      // store publishes any method for this country, choosing one is mandatory.
      // addr.country is interpolated into the filter, which is only safe because
      // sanitizeAddress() has already narrowed it to one of the literal codes in
      // SHIPPING_COUNTRIES — never take this shortcut with a raw body value.
      const { count: availableMethods, error: availErr } = await supabase
        .from('shipping_methods')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(`countries.is.null,countries.cs.{${addr.country}}`);

      if (availErr) {
        throw new CheckoutHttpError(
          500,
          'DB_SHIPPING_LOOKUP_ERROR',
          'db.fetch_shipping_method',
          `Failed to load shipping methods: ${availErr.message}`,
        );
      }
      if ((availableMethods ?? 0) > 0) {
        return jsonResponse({
          error: 'A shipping method must be selected for this destination.',
          code: 'SHIPPING_METHOD_REQUIRED',
          phase: 'request.resolve_shipping',
        }, 400);
      }
    }

    const subtotal = Math.round(
      resolvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) * 100,
    ) / 100;
    // When Stripe Tax is on, Stripe computes the real tax at payment and the
    // webhook writes the authoritative tax_amount/total back to the order. Until
    // then we record tax as 0 (estimate). Otherwise apply the flat TAX_RATE.
    const tax = stripeTaxEnabled
      ? 0
      : Math.round((subtotal + resolvedShippingCost) * TAX_RATE * 100) / 100;
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
      // The DB pending-order-limit trigger surfaces as a P0001 error here.
      if ((orderErr as { code?: string }).code === 'P0001') {
        return jsonResponse({
          error: 'Too many open orders. Complete or cancel existing orders first.',
          code: 'RATE_LIMITED',
          phase: 'db.insert_order',
        }, 429);
      }
      throw new CheckoutHttpError(
        500,
        'DB_ORDER_INSERT_ERROR',
        'db.insert_order',
        `Failed to create order: ${orderErr.message}`,
      );
    }
    orderId = order.id;
    console.log('[checkout] order created:', order.id);

    // Insert order items (prices and images resolved from DB)
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
        currency: STRIPE_CURRENCY,
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
          currency: STRIPE_CURRENCY,
          product_data: { name: `Shipping — ${resolvedShippingName ?? 'Standard'}` },
          unit_amount: Math.round(resolvedShippingCost * 100),
        },
        quantity: 1,
      });
    }

    // Flat-rate mode only: charge the estimated tax as an explicit line item so the
    // amount Stripe collects equals the order.total we recorded above. With Stripe
    // Tax enabled, tax is 0 here and Stripe adds the real tax itself.
    if (!stripeTaxEnabled && tax > 0) {
      lineItems.push({
        price_data: {
          currency: STRIPE_CURRENCY,
          product_data: { name: 'Estimated sales tax' },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    let session;
    try {
      console.log('[checkout] phase=stripe.create_session');
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        // payment_method_types is deliberately NOT set. Checkout Sessions use
        // dynamic payment methods by default — Stripe shows what is enabled in
        // the Dashboard, filtered by amount, currency and country. Passing
        // ['card'] was an override that switched that off, so a Dutch or German
        // shopper never saw iDEAL, Bancontact or Klarna even with those enabled.
        // Note the currency dependency: the local European methods are EUR-only,
        // so they only appear once STORE_CURRENCY (_shared/money.ts) is 'EUR'.
        line_items: lineItems,
        mode: 'payment',
        // Server-built redirect URLs on the verified origin (never client input).
        success_url: `${trustedOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${trustedOrigin}/checkout/cancel`,
        // Expire well before the stale-pending-order cron (2 h) fires.
        expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
        client_reference_id: order.id,
        metadata: { order_id: order.id, user_id: user.id },
        payment_intent_data: {
          metadata: { order_id: order.id, user_id: user.id },
        },
        automatic_tax: { enabled: stripeTaxEnabled },
      };

      if (stripeTaxEnabled) {
        // Stripe Tax needs a customer address to compute jurisdiction tax. Reuse the
        // shipping address the buyer already entered so they don't re-type it, and let
        // Stripe update it if they edit it on the hosted page.
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: addr.full_name,
          address: {
            line1: addr.line1,
            line2: addr.line2 ?? undefined,
            city: addr.city,
            state: addr.state,
            postal_code: addr.postal_code,
            country: addr.country,
          },
        });
        sessionParams.customer = customer.id;
        sessionParams.customer_update = { address: 'auto' };
      }

      session = await stripe.checkout.sessions.create(sessionParams);
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
