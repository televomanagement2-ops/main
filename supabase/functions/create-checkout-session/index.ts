import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveAllowedOrigin, getCorsHeaders } from '../_shared/cors.ts';
import { sanitizeAddress } from '../_shared/address.ts';
import { STRIPE_CURRENCY } from '../_shared/money.ts';
import {
  mergeItems,
  productIdsNeedingVariants,
  resolveLines,
  type CatalogColor,
  type CatalogProduct,
  type CatalogVariant,
} from '../_shared/checkout-lines.ts';
import {
  computeDiscount,
  normalizeDiscountCode,
  DISCOUNT_CODE_PATTERN,
  type DiscountRule,
} from '../_shared/discounts.ts';

const STRIPE_API_VERSION = '2025-03-31.basil';

// Abuse limit: a legitimate shopper never needs more than this. The per-order
// line and quantity caps live in _shared/checkout-lines.ts.
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

// Stripe Checkout refuses a payment below about half a unit of the currency
// (USD/EUR 0.50). A discount that brings an order under it is refused here,
// with a message, instead of failing at Stripe after the order was written.
const MIN_CHARGE = 0.5;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Why a discount code was refused, as the storefront shows it. */
const DISCOUNT_ERRORS: Record<string, { status: number; message: string }> = {
  not_found: { status: 400, message: 'This discount code does not exist.' },
  not_started: { status: 400, message: 'This discount code is not active yet.' },
  expired: { status: 400, message: 'This discount code has expired.' },
  exhausted: { status: 409, message: 'This discount code has been used up.' },
  already_used: { status: 409, message: 'You have already used this discount code.' },
  min_subtotal: { status: 400, message: 'Your order does not reach the minimum for this discount code.' },
  no_eligible_items: { status: 400, message: 'This discount code does not apply to the items in your cart.' },
  no_effect: { status: 400, message: 'This discount code does not change your order total.' },
};

const discountError = (reason: string) =>
  new CheckoutHttpError(
    DISCOUNT_ERRORS[reason]?.status ?? 400,
    `DISCOUNT_${reason.toUpperCase()}`,
    'request.discount',
    DISCOUNT_ERRORS[reason]?.message ?? 'This discount code cannot be used.',
  );

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

    // The code only; what it is worth is decided below from the database.
    let discountCode: string | null = null;
    if (body?.discount_code != null && String(body.discount_code).trim() !== '') {
      discountCode = normalizeDiscountCode(String(body.discount_code));
      if (!DISCOUNT_CODE_PATTERN.test(discountCode)) {
        throw discountError('not_found');
      }
    }

    // ── SECURITY: never trust client-supplied prices, names or images. The
    // client only sends product_id / variant_id / quantity; duplicate lines
    // are collapsed here so every stock check below sees the real total.
    const itemsCheck = mergeItems(items);
    if (!itemsCheck.ok) {
      return jsonResponse({
        error: itemsCheck.message,
        code: itemsCheck.code,
        phase: itemsCheck.phase,
      }, itemsCheck.status);
    }
    const mergedItems = itemsCheck.items;

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

    console.log('[checkout] items:', mergedItems.length);

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

    // Everything a line is worth is resolved from the database (service role).
    const productIds = [...new Set(mergedItems.map((i) => i.product_id))];

    // The service role reads cost_price, which the API hides from everyone
    // else (016): it is snapshotted on the order for margin reporting.
    const { data: dbProducts, error: productsErr } = await supabase
      .from('products')
      .select(
        'id, name, price, compare_at_price, cost_price, sku, category_id, is_active, stock_quantity, has_sizes, has_colors, product_images(url, is_primary, color_id, sort_order)',
      )
      .in('id', productIds);

    if (productsErr) {
      throw new CheckoutHttpError(
        500,
        'DB_PRODUCT_LOOKUP_ERROR',
        'db.fetch_products',
        `Failed to load products: ${productsErr.message}`,
      );
    }
    const products = (dbProducts ?? []) as CatalogProduct[];

    // ── Variant enforcement: a product with sizes or colours needs a variant
    // that is on sale and has stock — the selectors in the browser are not the
    // trust boundary. Only ACTIVE variants are loaded: one switched off is not
    // for sale.
    let activeVariants: CatalogVariant[] = [];
    let colors: CatalogColor[] = [];
    const variantProductIds = productIdsNeedingVariants(mergedItems, products);
    if (variantProductIds.length > 0) {
      const [variantsRes, colorsRes] = await Promise.all([
        supabase
          .from('product_variants')
          .select('id, product_id, color_id, size, sku, price, stock_qty')
          .in('product_id', variantProductIds)
          .eq('is_active', true),
        supabase.from('product_colors').select('id, name').in('product_id', variantProductIds),
      ]);

      if (variantsRes.error || colorsRes.error) {
        throw new CheckoutHttpError(
          500,
          'DB_VARIANT_LOOKUP_ERROR',
          'db.fetch_variants',
          `Failed to load product variants: ${(variantsRes.error ?? colorsRes.error)?.message}`,
        );
      }
      activeVariants = (variantsRes.data ?? []) as CatalogVariant[];
      colors = (colorsRes.data ?? []) as CatalogColor[];

      if (activeVariants.length > 0) {
        const { data: costs } = await supabase
          .from('product_variant_costs')
          .select('variant_id, cost_price')
          .in('variant_id', activeVariants.map((v) => v.id));
        const costByVariant = new Map((costs ?? []).map((c) => [c.variant_id as string, c.cost_price]));
        activeVariants = activeVariants.map((v) => ({ ...v, cost_price: costByVariant.get(v.id) ?? null }));
      }
    }

    const resolution = resolveLines(mergedItems, products, activeVariants, colors);
    if (!resolution.ok) {
      throw new CheckoutHttpError(resolution.status, resolution.code, resolution.phase, resolution.message);
    }
    const resolvedItems = resolution.lines;

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

    const subtotal = round2(resolvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0));

    // ── Discount code: the rules come from the database (service role — codes
    // are not readable through the API), the arithmetic from the shared
    // module the checkout page previews with. Usage limits are enforced
    // atomically once the order exists (reserve_discount, below).
    let discountId: string | null = null;
    let itemsDiscount = 0;
    let shippingDiscount = 0;
    let allocations: Record<string, number> = {};
    if (discountCode) {
      const { data: code, error: codeErr } = await supabase
        .from('discount_codes')
        .select('id, code, kind, value, min_subtotal, applies_to, category_ids, product_ids, exclude_sale_items, is_active, starts_at, ends_at')
        .eq('code', discountCode)
        .maybeSingle();
      if (codeErr) {
        throw new CheckoutHttpError(500, 'DB_DISCOUNT_LOOKUP_ERROR', 'db.fetch_discount', codeErr.message);
      }
      if (!code || !code.is_active) throw discountError('not_found');
      const now = Date.now();
      if (code.starts_at && Date.parse(code.starts_at) > now) throw discountError('not_started');
      if (code.ends_at && Date.parse(code.ends_at) <= now) throw discountError('expired');

      // A code for a category also covers its sub-categories.
      let ancestors: ((id: string) => string[]) | undefined;
      if (code.applies_to === 'categories') {
        const { data: cats } = await supabase.from('categories').select('id, parent_id');
        const parentOf = new Map((cats ?? []).map((c) => [c.id as string, (c.parent_id as string | null) ?? null]));
        ancestors = (id: string) => {
          const chain: string[] = [];
          for (let cur: string | null = id; cur && !chain.includes(cur); cur = parentOf.get(cur) ?? null) {
            chain.push(cur);
          }
          return chain;
        };
      }

      const outcome = computeDiscount(
        code as unknown as DiscountRule,
        resolvedItems.map((line, index) => ({
          key: String(index),
          product_id: line.product_id,
          category_id: line.category_id,
          unit_price: line.unit_price,
          quantity: line.quantity,
          on_sale: line.on_sale,
        })),
        resolvedShippingCost,
        ancestors,
      );
      if (!outcome.ok) throw discountError(outcome.reason);

      discountId = code.id as string;
      itemsDiscount = outcome.items;
      shippingDiscount = outcome.shipping;
      allocations = outcome.allocations;
    }
    const discountTotal = round2(itemsDiscount + shippingDiscount);

    // When Stripe Tax is on, Stripe computes the real tax at payment and the
    // webhook writes the authoritative tax_amount/total back to the order. Until
    // then we record tax as 0 (estimate). Otherwise apply the flat TAX_RATE, on
    // what is actually charged: after the discount.
    const taxable = round2(subtotal - itemsDiscount + resolvedShippingCost - shippingDiscount);
    const tax = stripeTaxEnabled ? 0 : round2(taxable * TAX_RATE);
    const orderTotal = round2(taxable + tax);
    let orderId: string | null = null;

    if (discountTotal > 0 && orderTotal < MIN_CHARGE) {
      return jsonResponse({
        error: 'After the discount the order total is too low to be paid by card.',
        code: 'CHECKOUT_TOTAL_TOO_LOW',
        phase: 'request.discount',
      }, 400);
    }

    // Create order
    console.log('[checkout] phase=db.insert_order');
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'pending',
        total: orderTotal,
        subtotal,
        tax_amount: tax,
        shipping_cost: resolvedShippingCost,
        discount_amount: discountTotal,
        shipping_discount: shippingDiscount,
        discount_code: discountId ? discountCode : null,
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

    // Insert order items (prices and images resolved from DB). variant_id is
    // the row the paid order takes its stock from (migrations 021/022);
    // selected_size / selected_color / sku stay as what the customer saw.
    const orderItems = resolvedItems.map((i, index) => ({
      order_id: order.id,
      product_id: i.product_id,
      variant_id: i.variant_id,
      product_name: i.name,
      product_image: i.image,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: round2(i.unit_price * i.quantity),
      selected_size: i.selected_size,
      selected_color: i.selected_color,
      sku: i.sku,
      discount_amount: allocations[String(index)] ?? 0,
    }));

    console.log('[checkout] phase=db.insert_order_items');
    const { data: insertedItems, error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select('id, product_id, variant_id');
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

    // What each line cost the store, for the margin report. Best-effort: a
    // missing cost never blocks a sale.
    // Each resolved line is one (product, variant) pair, so that pair finds it
    // whatever order the rows come back in.
    const costByLine = new Map(resolvedItems.map((i) => [`${i.product_id}:${i.variant_id ?? ''}`, i.unit_cost]));
    const itemCosts = (insertedItems ?? []).flatMap((row) => {
      const cost = costByLine.get(`${row.product_id}:${row.variant_id ?? ''}`);
      return cost == null ? [] : [{ order_item_id: row.id as string, unit_cost: cost }];
    });
    if (itemCosts.length > 0) {
      const { error: costErr } = await supabase.from('order_item_costs').insert(itemCosts);
      if (costErr) console.error('[checkout] order_item_costs insert error:', costErr.message);
    }

    // ── Take one use of the discount code — atomic, so a code limited to 100
    // uses is never used 101 times by two shoppers at once.
    if (discountId) {
      const { error: reserveErr } = await supabase.rpc('reserve_discount', {
        p_discount_id: discountId,
        p_order_id: order.id,
        p_user_id: user.id,
        p_amount: discountTotal,
      });
      if (reserveErr) {
        await supabase.from('orders').delete().eq('id', order.id);
        const hint = String((reserveErr as { hint?: string }).hint ?? '');
        throw discountError(hint.startsWith('discount_') ? hint.slice('discount_'.length) : 'not_found');
      }
    }

    // Build Stripe line items from resolved (DB-trusted) data
    const lineItems = resolvedItems.map((i) => {
      const option = [i.selected_color, i.selected_size].filter(Boolean).join(' / ');
      return {
        price_data: {
          currency: STRIPE_CURRENCY,
          product_data: {
            name: option ? `${i.name} (${option})` : i.name,
            ...(i.image ? { images: [i.image] } : {}),
          },
          unit_amount: Math.round(i.unit_price * 100),
        },
        quantity: i.quantity,
      };
    });

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
      const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

      // The discount travels to Stripe as a one-off coupon for exactly the
      // amount computed above, so the hosted page shows the code and the
      // charge equals the recorded total. Line prices stay the real prices.
      let couponId: string | null = null;
      if (discountTotal > 0) {
        console.log('[checkout] phase=stripe.create_coupon');
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(discountTotal * 100),
          currency: STRIPE_CURRENCY,
          duration: 'once',
          max_redemptions: 1,
          redeem_by: expiresAt + 600,
          name: (discountCode ?? 'Discount').slice(0, 40),
          metadata: { order_id: order.id },
        });
        couponId = coupon.id;
      }

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
        expires_at: expiresAt,
        client_reference_id: order.id,
        metadata: { order_id: order.id, user_id: user.id },
        payment_intent_data: {
          metadata: { order_id: order.id, user_id: user.id },
        },
        automatic_tax: { enabled: stripeTaxEnabled },
        ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
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
