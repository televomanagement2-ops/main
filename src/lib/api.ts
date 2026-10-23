import { supabase } from './supabaseClient';
import type { Database, Json } from './database.types';
import type {
  Product,
  Category,
  Order,
  OrderStatus,
  Profile,
  ProductFilters,
  PaginatedResponse,
  Address,
  ShippingMethod,
  PublicProductReview,
  ProductVariant,
  ProductImage,
  ProductColor,
  AdminAnalytics,
  SizeGuide,
  OrderEvent,
  OrderRefund,
  InventoryMovement,
  MovementReason,
  LowStockItem,
  StockRequestSummary,
  StoreSettings,
  DiscountCode,
  DiscountUsage,
} from '../types';
import type { VariantsSaveConfig } from './variants';
import type { DiscountRule } from '../../supabase/functions/_shared/discounts.ts';

export type ProductUpdate = Database['public']['Tables']['products']['Update'];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Postgres/PostgREST error with the HINT our functions use as a machine code. */
type DbError = { message: string; hint?: string | null; details?: string | null; code?: string };

/** An error the UI can translate: `code` is the database function's HINT. */
export class AppError extends Error {
  readonly code: string;
  readonly detail: string | null;

  constructor(message: string, code: string, detail: string | null = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }
}

function toError(error: DbError): Error {
  if (error.hint === 'stock_conflict') {
    return new StockConflictError(error.message, error.details || null);
  }
  if (error.hint) return new AppError(error.message, error.hint, error.details ?? null);
  return error instanceof Error ? error : new Error(error.message);
}

// ============================================================
// PRODUCTS
// ============================================================

// Explicit allowlist instead of '*'. products is world-readable, and '*' was
// publishing products.cost_price — what the store pays per item — to every
// visitor holding the (public) anon key. Migration 016 revokes that column at
// the database level, which also means SELECT * is now refused for
// anon/authenticated: name the columns.
const PRODUCT_COLUMNS = [
  'id',
  'category_id',
  'name',
  'slug',
  'description',
  'price',
  'compare_at_price',
  'sku',
  'stock_quantity',
  'low_stock_threshold',
  'weight_grams',
  'is_active',
  'is_featured',
  // Granted explicitly by 021/022 (the table is column-granted).
  'has_sizes',
  'size_label',
  'has_colors',
  'color_label',
  'price_min',
  'price_max',
  'size_guide_id',
  'metadata',
  'created_at',
  'updated_at',
].join(', ');

// Listing views only need enough to render a card and link it — and the
// colours on sale, for the swatches (RLS hides colours with nothing on sale).
const PRODUCT_IMAGE_COLUMNS = 'id, url, alt_text, is_primary, sort_order, color_id';
const PRODUCT_COLOR_COLUMNS = 'id, product_id, name, swatch, sort_order, is_active, created_at, updated_at';

export async function fetchProducts(
  filters: ProductFilters = {}
): Promise<PaginatedResponse<Product>> {
  const {
    categorySlug,
    minPrice,
    maxPrice,
    search,
    featured,
    page = 1,
    pageSize = 12,
  } = filters;

  // With a category filter the join must be INNER, otherwise the filter on
  // categories.slug only nulls out the embedded category instead of
  // excluding the product rows.
  const embeds = `product_images(${PRODUCT_IMAGE_COLUMNS}), product_colors(${PRODUCT_COLOR_COLUMNS})`;
  const select = categorySlug
    ? `${PRODUCT_COLUMNS}, ${embeds}, categories!inner(*)`
    : `${PRODUCT_COLUMNS}, ${embeds}, categories(*)`;

  // 'estimated' returns the exact count for a small result set and the planner's
  // estimate for a large one. 'exact' made every page, filter and search
  // keystroke pay for a full COUNT(*) on top of the rows themselves.
  let query = supabase
    .from('products')
    .select(select, { count: 'estimated' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (categorySlug) {
    query = query.eq('categories.slug', categorySlug);
  }
  // A product with variants at several prices matches a price range it
  // overlaps: a 40–120 rug is in "50 to 100".
  if (minPrice !== undefined) query = query.gte('price_max', minPrice);
  if (maxPrice !== undefined) query = query.lte('price_min', maxPrice);
  if (featured !== undefined) query = query.eq('is_featured', featured);
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: (data as unknown as Product[]) ?? [],
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function fetchProductBySlug(slug: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, product_images(*), categories(*), product_colors(${PRODUCT_COLOR_COLUMNS})`)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) throw error;
  const product = data as unknown as Product;

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', product.id)
    .eq('is_active', true)
    .order('sort_order');

  if (!variantsError && variants) {
    product.product_variants = variants as ProductVariant[];
  }

  return product;
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `${PRODUCT_COLUMNS}, product_images(${PRODUCT_IMAGE_COLUMNS}), product_colors(${PRODUCT_COLOR_COLUMNS}), categories(*)`,
    )
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

/**
 * Fetch fresh price/stock/availability for the given products (cart sync).
 * product_variants is included because the cart clamps variant lines against
 * the CHOSEN VARIANT's stock and price — without it the sync would overwrite
 * each cart item's product with a variant-less row and silently lose both.
 */
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .select(
      `${PRODUCT_COLUMNS}, product_images(${PRODUCT_IMAGE_COLUMNS}), product_variants(*), product_colors(${PRODUCT_COLOR_COLUMNS})`,
    )
    .in('id', ids)
    .eq('is_active', true);

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

// ============================================================
// CATEGORIES
// ============================================================

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return (data as Category[]) ?? [];
}

// ============================================================
// SIZE GUIDES (migration 022)
// ============================================================

export async function fetchSizeGuides(): Promise<SizeGuide[]> {
  const { data, error } = await supabase.from('size_guides').select('*').order('name');
  if (error) throw error;
  return (data as unknown as SizeGuide[]) ?? [];
}

export async function fetchSizeGuide(id: string): Promise<SizeGuide | null> {
  const { data, error } = await supabase.from('size_guides').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as unknown as SizeGuide) ?? null;
}

export type SizeGuideInput = Pick<SizeGuide, 'name' | 'columns' | 'rows' | 'notes'> & { id?: string };

export async function saveSizeGuide(input: SizeGuideInput): Promise<SizeGuide> {
  const row = { name: input.name.trim(), columns: input.columns, rows: input.rows, notes: input.notes?.trim() || null };
  const query = input.id
    ? supabase.from('size_guides').update(row).eq('id', input.id)
    : supabase.from('size_guides').insert(row);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data as unknown as SizeGuide;
}

export async function deleteSizeGuide(id: string): Promise<void> {
  const { error } = await supabase.from('size_guides').delete().eq('id', id);
  if (error) throw error;
}

/** Assigns a guide to categories: `categoryIds` get it, the others that had it lose it. */
export async function setSizeGuideCategories(guideId: string, categoryIds: string[]): Promise<void> {
  const { error: clearError } = await supabase
    .from('categories')
    .update({ size_guide_id: null })
    .eq('size_guide_id', guideId)
    .not('id', 'in', `(${categoryIds.length ? categoryIds.join(',') : '00000000-0000-0000-0000-000000000000'})`);
  if (clearError) throw clearError;
  if (categoryIds.length > 0) {
    const { error } = await supabase.from('categories').update({ size_guide_id: guideId }).in('id', categoryIds);
    if (error) throw error;
  }
}

// ============================================================
// BACK-IN-STOCK REQUESTS (migration 023)
// ============================================================

/** Whether the shop takes "email me when it is back" requests. */
export async function fetchBackInStockEnabled(): Promise<boolean> {
  const { data, error } = await supabase.from('store_settings').select('back_in_stock_enabled').maybeSingle();
  if (error) return false;
  return Boolean(data?.back_in_stock_enabled);
}

/** 'subscribed' | 'already_subscribed'; an AppError with code disabled | invalid_email | not_found | in_stock | rate_limited. */
export async function requestStockNotification(input: {
  productId: string;
  variantId: string | null;
  email: string;
  locale: string;
}): Promise<'subscribed' | 'already_subscribed'> {
  const { data, error } = await supabase.rpc('request_stock_notification', {
    p_product_id: input.productId,
    p_variant_id: input.variantId ?? undefined,
    p_email: input.email,
    p_locale: input.locale,
  });
  if (error) throw toError(error);
  return data as 'subscribed' | 'already_subscribed';
}

// ============================================================
// PROFILE
// ============================================================

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as Profile;
}

// ============================================================
// ADDRESSES
// ============================================================

export async function fetchAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });

  if (error) throw error;
  return (data as Address[]) ?? [];
}

export async function createAddress(
  address: Omit<Address, 'id' | 'created_at' | 'updated_at'>
): Promise<Address> {
  const { data, error } = await supabase
    .from('addresses')
    .insert(address)
    .select()
    .single();

  if (error) throw error;
  return data as Address;
}

// ============================================================
// SHIPPING METHODS
// ============================================================

export async function fetchShippingMethods(): Promise<ShippingMethod[]> {
  const { data, error } = await supabase
    .from('shipping_methods')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return (data as ShippingMethod[]) ?? [];
}

// ============================================================
// PRODUCT REVIEWS
// ============================================================

// Reviews are world-readable (RLS `USING (TRUE)`), so the column list is an
// allowlist rather than `*`: author_name is the trigger-maintained display
// snapshot, and user_id stays out of the response so an anonymous visitor
// cannot enumerate the auth UUID behind every review.
const PUBLIC_REVIEW_COLUMNS = 'id, product_id, rating, body, author_name, created_at, updated_at';

export async function fetchReviews(productId: string): Promise<PublicProductReview[]> {
  const { data, error } = await supabase
    .from('product_reviews')
    .select(PUBLIC_REVIEW_COLUMNS)
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as PublicProductReview[]) ?? [];
}

export async function hasPurchasedProduct(productId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_purchased', {
    p_product_id: productId,
  });
  if (error) return false;
  return Boolean(data);
}

/**
 * Cap on a review body, mirrored by product_reviews_body_length_check in
 * migration 016. Reviews are world-readable, so an unbounded body was a blob
 * one purchaser could make every visitor of that product page download.
 */
export const REVIEW_BODY_MAX_LENGTH = 2000;

export async function submitReview(
  productId: string,
  userId: string,
  rating: number,
  body: string
): Promise<PublicProductReview> {
  const safeRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 0)));
  const safeBody = body.trim().slice(0, REVIEW_BODY_MAX_LENGTH);

  const { data, error } = await supabase
    .from('product_reviews')
    .upsert(
      { product_id: productId, user_id: userId, rating: safeRating, body: safeBody },
      { onConflict: 'product_id,user_id' }
    )
    .select(PUBLIC_REVIEW_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as PublicProductReview;
}

// ============================================================
// DISCOUNT CODES — storefront (migration 025)
// ============================================================

export type DiscountPreview =
  | ({ ok: true; id: string; description: string | null; ends_at: string | null } & DiscountRule)
  | { ok: false; reason: 'auth' | 'rate_limited' | 'not_found' | 'not_started' | 'expired' | 'exhausted' | 'already_used' };

/** What a code is worth before paying; the checkout function recomputes it. */
export async function previewDiscountCode(code: string): Promise<DiscountPreview> {
  const { data, error } = await supabase.rpc('preview_discount_code', { p_code: code });
  if (error) throw error;
  return data as unknown as DiscountPreview;
}

// ============================================================
// ORDERS
// ============================================================

export async function fetchOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as Order[]) ?? [];
}

export async function fetchOrderById(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data as unknown as Order;
}

/** An Edge Function refused: `code` is its machine code (e.g. AMOUNT_TOO_HIGH). */
export class FunctionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'FunctionError';
    this.code = code;
  }
}

async function invokeFunction<T>(
  functionName: 'handle-order-action' | 'update-tracking' | 'store-worker',
  body: Record<string, unknown>,
  errorLabel: string,
): Promise<T> {
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  let payload: (T & { error?: string; code?: string }) | null = null;
  try {
    payload = (await res.json()) as T & { error?: string; code?: string };
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new FunctionError(payload?.error || `${errorLabel} failed with status ${res.status}.`, payload?.code ?? 'UNKNOWN');
  }
  return payload as T;
}

async function invokeOrderFunction(
  functionName: 'handle-order-action' | 'update-tracking',
  body: Record<string, unknown>,
  errorLabel: string,
): Promise<Order> {
  const payload = await invokeFunction<{ order?: Order }>(functionName, body, errorLabel);
  if (!payload?.order) {
    throw new Error(`${errorLabel} did not return order details.`);
  }
  return payload.order;
}

export async function cancelOrder(orderId: string): Promise<Order> {
  return invokeOrderFunction('handle-order-action', { action: 'cancel', order_id: orderId }, 'Cancel');
}

// ============================================================
// ADMIN — ORDERS, ANALYTICS, CATALOG
// ============================================================

// orders has TWO foreign keys to profiles — user_id (the buyer) and
// refund_requested_by (migration 017). A bare `profiles(...)` embed is therefore
// ambiguous and PostgREST refuses it outright ("more than one relationship was
// found for 'orders' and 'profiles'"), which is a 300 on every admin order list
// and on every order-mutating Edge Function response. The `!constraint` hint
// names the relationship to follow: always the buyer.
export const ORDER_CUSTOMER_EMBED = 'profiles!orders_user_id_fkey(full_name, email, phone)';

export const ADMIN_ORDERS_PAGE_SIZE = 50;

export interface AdminOrdersFilters {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  needsReviewOnly?: boolean;
  /** ISO dates, inclusive. */
  from?: string;
  to?: string;
  ids?: string[];
}

function adminOrdersQuery(filters: AdminOrdersFilters, select: string, count = false) {
  const { status, needsReviewOnly, from, to, ids } = filters;
  let query = supabase
    .from('orders')
    .select(select, count ? { count: 'exact' } : undefined)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (needsReviewOnly) query = query.eq('needs_review', true);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  if (ids && ids.length > 0) query = query.in('id', ids);
  return query;
}

export async function fetchAdminOrders(
  filters: AdminOrdersFilters = {}
): Promise<PaginatedResponse<Order>> {
  const { page = 1, pageSize = ADMIN_ORDERS_PAGE_SIZE } = filters;

  const { data, error, count } = await adminOrdersQuery(
    filters,
    `*, order_items(*), ${ORDER_CUSTOMER_EMBED}`,
    true,
  ).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;

  return {
    data: (data as unknown as Order[]) ?? [],
    count: count ?? 0,
    page,
    pageSize,
  };
}

/** Every order matching the filters (for exports and printing), up to `limit`. */
export async function fetchAllAdminOrders(filters: AdminOrdersFilters = {}, limit = 5000): Promise<Order[]> {
  const out: Order[] = [];
  const batch = 500;
  for (let start = 0; start < limit; start += batch) {
    const { data, error } = await adminOrdersQuery(filters, `*, order_items(*), ${ORDER_CUSTOMER_EMBED}`).range(
      start,
      Math.min(start + batch, limit) - 1,
    );
    if (error) throw error;
    const rows = (data as unknown as Order[]) ?? [];
    out.push(...rows);
    if (rows.length < batch) break;
  }
  return out;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select(`*, order_items(*), ${ORDER_CUSTOMER_EMBED}`)
    .single();

  if (error) throw toError(error);
  return data as unknown as Order;
}

export async function updateOrderTracking(orderId: string, trackingId: string): Promise<Order> {
  // The Edge Function sets status to 'shipped' itself — the client never
  // sends a status.
  return invokeOrderFunction('update-tracking', { orderId, trackingId }, 'Tracking update');
}

export async function markOrderDelivered(orderId: string): Promise<Order> {
  return invokeOrderFunction('handle-order-action', { action: 'deliver', order_id: orderId }, 'Delivery update');
}

export interface RefundRequest {
  orderId: string;
  /** Chosen by the dialog when it opens: a double click is one refund. */
  requestId: string;
  amount: number;
  lines: { order_item_id: string; quantity: number; restock: boolean }[];
  shippingAmount: number;
  reason?: string | null;
}

/** All or part of an order: lines (restocked or not), shipping, any amount up to what is left. */
export async function refundOrderLines(request: RefundRequest): Promise<Order> {
  return invokeOrderFunction(
    'handle-order-action',
    {
      action: 'refund',
      order_id: request.orderId,
      request_id: request.requestId,
      amount: request.amount,
      lines: request.lines,
      shipping_amount: request.shippingAmount,
      reason: request.reason ?? null,
    },
    'Refund',
  );
}

/** Everything left to refund on the order. */
export async function refundOrder(orderId: string): Promise<Order> {
  return invokeOrderFunction('handle-order-action', { action: 'refund', order_id: orderId }, 'Refund');
}

/** Cancels an order: an open checkout is closed at Stripe first; a paid order is refunded in full. */
export async function adminCancelOrder(orderId: string): Promise<Order> {
  return invokeOrderFunction('handle-order-action', { action: 'cancel', order_id: orderId }, 'Cancel');
}

/** Asks Stripe what happened to an order's checkout and applies the answer. */
export async function syncOrderPayment(orderId: string): Promise<{ order: Order; stripe_status: string }> {
  return invokeFunction('handle-order-action', { action: 'sync_payment', order_id: orderId }, 'Payment check');
}

/** Accepts a payment held for review, once Stripe confirms it succeeded. */
export async function confirmOrderPayment(orderId: string): Promise<Order> {
  return invokeOrderFunction('handle-order-action', { action: 'confirm_payment', order_id: orderId }, 'Payment confirmation');
}

export async function resolveOrderReview(orderId: string, note: string | null): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_review', { p_order_id: orderId, p_note: note ?? undefined });
  if (error) throw toError(error);
}

export async function exchangeOrderItem(input: {
  orderItemId: string;
  variantId: string;
  quantity: number;
  restock: boolean;
  note?: string | null;
}): Promise<{ order_id: string; item_id: string; price_difference: number; oversold: boolean }> {
  const { data, error } = await supabase.rpc('admin_exchange_order_item', {
    p_order_item_id: input.orderItemId,
    p_variant_id: input.variantId,
    p_quantity: input.quantity,
    p_restock: input.restock,
    p_note: input.note ?? undefined,
  });
  if (error) throw toError(error);
  return data as unknown as { order_id: string; item_id: string; price_difference: number; oversold: boolean };
}

/** The timeline: status changes, tracking, refunds, exchanges, review flags and notes. */
export async function fetchOrderEvents(orderId: string): Promise<(OrderEvent & { profiles?: Pick<Profile, 'full_name' | 'email'> | null })[]> {
  const { data, error } = await supabase
    .from('order_events')
    .select('*, profiles(full_name, email)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown as (OrderEvent & { profiles?: Pick<Profile, 'full_name' | 'email'> | null })[]) ?? [];
}

export async function addOrderNote(orderId: string, actorId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('order_events')
    .insert({ order_id: orderId, kind: 'note', message: message.trim().slice(0, 2000), actor_id: actorId });
  if (error) throw error;
}

export async function deleteOrderNote(eventId: number): Promise<void> {
  const { error } = await supabase.from('order_events').delete().eq('id', eventId).eq('kind', 'note');
  if (error) throw error;
}

export async function fetchOrderRefunds(orderId: string): Promise<OrderRefund[]> {
  const { data, error } = await supabase
    .from('order_refunds')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at');
  if (error) throw error;
  return (data as unknown as OrderRefund[]) ?? [];
}

/** Issues the invoice numbers still missing; returns order id → number. */
export async function issueInvoices(orderIds: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('admin_issue_invoices', { p_order_ids: orderIds });
  if (error) throw toError(error);
  return (data as unknown as Record<string, string>) ?? {};
}

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  // Aggregates are computed in the DB by a SECURITY DEFINER function that
  // verifies is_admin() — no more downloading every order row to the client.
  const { data, error } = await supabase.rpc('admin_analytics');
  if (error) throw error;

  const raw = (data ?? {}) as {
    grossRevenue?: number;
    orders24h?: number;
    orders7d?: number;
    needsReview?: number;
    statusCounts?: Record<string, number>;
    bestSeller?: { productId: string; productName: string; quantity: number } | null;
    revenueByDay?: { day: string; revenue: number }[];
    revenueByStatus?: Record<string, number>;
    partialRefunds?: number;
    refundedTotal?: number;
    discounts30d?: number;
    margin30d?: { revenue?: number; cost?: number; coveredUnits?: number; totalUnits?: number } | null;
    lowStock?: number;
    outOfStock?: number;
    stockRequests?: number;
  };

  const statusCounts: Record<OrderStatus, number> = {
    pending: 0,
    processing: 0,
    requires_action: 0,
    paid: 0,
    failed: 0,
    cancelled: 0,
    shipped: 0,
    delivered: 0,
    refunded: 0,
  };
  for (const [status, count] of Object.entries(raw.statusCounts ?? {})) {
    if (status in statusCounts) statusCounts[status as OrderStatus] = Number(count);
  }

  return {
    grossRevenue: Number(raw.grossRevenue ?? 0),
    orders24h: Number(raw.orders24h ?? 0),
    orders7d: Number(raw.orders7d ?? 0),
    needsReview: Number(raw.needsReview ?? 0),
    bestSeller: raw.bestSeller ?? null,
    statusCounts,
    revenueByDay: raw.revenueByDay ?? [],
    revenueByStatus: (raw.revenueByStatus ?? {}) as AdminAnalytics['revenueByStatus'],
    partialRefunds: Number(raw.partialRefunds ?? 0),
    refundedTotal: Number(raw.refundedTotal ?? 0),
    discounts30d: Number(raw.discounts30d ?? 0),
    margin30d: {
      revenue: Number(raw.margin30d?.revenue ?? 0),
      cost: Number(raw.margin30d?.cost ?? 0),
      coveredUnits: Number(raw.margin30d?.coveredUnits ?? 0),
      totalUnits: Number(raw.margin30d?.totalUnits ?? 0),
    },
    lowStock: Number(raw.lowStock ?? 0),
    outOfStock: Number(raw.outOfStock ?? 0),
    stockRequests: Number(raw.stockRequests ?? 0),
  };
}

// Admin product rows carry EVERY variant and colour, switched-off ones
// included: RLS lets an admin read them, and the editor needs them.
const ADMIN_PRODUCT_SELECT = `${PRODUCT_COLUMNS}, product_images(*), categories(*), product_variants(*), product_colors(*)`;

export async function fetchAdminProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(ADMIN_PRODUCT_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

/**
 * Product fields other than stock. Stock goes through saveProductVariants /
 * setVariantStock / setProductStock, which refuse to overwrite a figure that
 * moved while the editor was open.
 */
export async function updateProduct(
  productId: string,
  updates: ProductUpdate
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select(ADMIN_PRODUCT_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as Product;
}

/**
 * Cost prices for the admin. products.cost_price cannot be selected through
 * the API at all (016), so it comes from admin_catalog_costs().
 */
export async function fetchCatalogCosts(): Promise<{ products: Record<string, number>; variants: Record<string, number> }> {
  const { data, error } = await supabase.rpc('admin_catalog_costs');
  if (error) throw error;
  const raw = (data ?? {}) as { products?: Record<string, number>; variants?: Record<string, number> };
  return { products: raw.products ?? {}, variants: raw.variants ?? {} };
}

// ============================================================
// ADMIN — STOCK AND VARIANTS (migrations 021/022)
// ============================================================

/**
 * A stock figure changed between the moment the editor loaded it and the
 * save — usually an order was paid in between. Nothing was written.
 */
export class StockConflictError extends Error {
  /** The variant whose stock moved; null for a product without variants. */
  readonly variantId: string | null;

  constructor(message: string, variantId: string | null) {
    super(message);
    this.name = 'StockConflictError';
    this.variantId = variantId;
  }
}

export interface VariantsSaveResult {
  product_id: string;
  has_sizes: boolean;
  has_colors: boolean;
  stock_quantity: number;
  /** Variants removed from the list and deleted. */
  deleted: number;
  /** Removed from the list but kept, switched off, because they have orders. */
  archived: number;
  /** Colour draft key → saved colour id. */
  color_ids: Record<string, string>;
  colors: ProductColor[];
  variants: ProductVariant[];
}

/**
 * Atomically replaces a product's colours and variants — or, with neither
 * sizes nor colours, sets its single stock figure (`stock_quantity`, checked
 * against `expected_stock`).
 */
export async function saveProductVariants(
  productId: string,
  config:
    | VariantsSaveConfig
    | {
        has_sizes: false;
        has_colors: false;
        size_label?: string;
        color_label?: string;
        stock_quantity?: number | null;
        expected_stock?: number | null;
        note?: string | null;
      },
): Promise<VariantsSaveResult> {
  const { data, error } = await supabase.rpc('admin_save_product_variants', {
    p_product_id: productId,
    p_config: config as unknown as Json,
  });
  if (error) throw toError(error);
  return data as unknown as VariantsSaveResult;
}

// A `type`, not an interface: only object types without a declared shape are
// assignable to the Json the RPC argument is typed as.
export type VariantStockChange = {
  id: string;
  stock_qty: number;
  expected_stock_qty: number;
};

/** Sets the stock of the given variants, leaving everything else about them alone. */
export async function setVariantStock(changes: VariantStockChange[], note?: string | null): Promise<ProductVariant[]> {
  const { data, error } = await supabase.rpc('admin_set_variant_stock', {
    p_changes: changes,
    p_note: note?.trim() || undefined,
  });
  if (error) throw toError(error);
  return (data as unknown as ProductVariant[]) ?? [];
}

/**
 * Sets a product's single stock figure (no variants), only if it still holds
 * `expected` — otherwise nothing is written and a StockConflictError is thrown.
 */
export async function setProductStock(
  productId: string,
  stock: number,
  expected: number,
  note?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('admin_set_product_stock', {
    p_product_id: productId,
    p_stock: stock,
    p_expected: expected,
    p_note: note?.trim() || undefined,
  });
  if (error) throw toError(error);
  return Number(data);
}

export type ProductInventory = Pick<Product, 'id' | 'stock_quantity' | 'has_sizes' | 'has_colors'> & {
  product_variants: ProductVariant[];
};

/** A product's current stock figures — what an editor rebases on after a conflict. */
export async function fetchProductInventory(productId: string): Promise<ProductInventory> {
  const { data, error } = await supabase
    .from('products')
    .select('id, stock_quantity, has_sizes, has_colors, product_variants(*)')
    .eq('id', productId)
    .single();

  if (error) throw error;
  return data as unknown as ProductInventory;
}

/** Copies a product (hidden, no SKUs, no stock) and returns the copy's id. */
export async function duplicateProduct(productId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_duplicate_product', { p_product_id: productId, p_name: name });
  if (error) throw toError(error);
  return data as string;
}

export interface ImportResult {
  created: number;
  updated: number;
  products: { slug: string; id: string; action: 'created' | 'updated' }[];
}

/** All or nothing; an AppError with code 'import_row' names the failing product (detail = its position). */
export async function importProducts(products: unknown[], options: { createCategories: boolean }): Promise<ImportResult> {
  const { data, error } = await supabase.rpc('admin_import_products', {
    p_products: products as unknown as Json,
    p_options: { create_categories: options.createCategories },
  });
  if (error) throw toError(error);
  return data as unknown as ImportResult;
}

// ============================================================
// ADMIN — PRODUCT CREATION, IMAGES, CATEGORIES
// ============================================================

export type ProductInput = {
  name: string;
  category_id: string;
  price: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  description?: string | null;
  sku?: string | null;
  stock_quantity?: number;
  low_stock_threshold?: number;
  weight_grams?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
  size_guide_id?: string | null;
  slug?: string;
};

export async function createProduct(input: ProductInput): Promise<Product> {
  // Resolve a unique slug (the products.slug column is UNIQUE).
  const base = (input.slug?.trim() || slugify(input.name)) || `product-${Date.now()}`;
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      slug,
      category_id: input.category_id,
      price: input.price,
      compare_at_price: input.compare_at_price ?? null,
      cost_price: input.cost_price ?? null,
      description: input.description ?? null,
      sku: input.sku || null,
      stock_quantity: input.stock_quantity ?? 0,
      low_stock_threshold: input.low_stock_threshold ?? 5,
      weight_grams: input.weight_grams ?? null,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
      size_guide_id: input.size_guide_id ?? null,
    })
    .select(ADMIN_PRODUCT_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as Product;
}

/** Upload an image file to the product-images bucket; returns its public URL. */
export async function uploadProductImage(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function addProductImages(
  productId: string,
  images: { url: string; alt_text?: string | null; is_primary?: boolean; sort_order?: number; color_id?: string | null }[]
): Promise<ProductImage[]> {
  const rows = images.map((img, i) => ({
    product_id: productId,
    url: img.url,
    alt_text: img.alt_text ?? null,
    is_primary: img.is_primary ?? i === 0,
    sort_order: img.sort_order ?? i,
    color_id: img.color_id ?? null,
  }));
  const { data, error } = await supabase.from('product_images').insert(rows).select();
  if (error) throw error;
  return (data as ProductImage[]) ?? [];
}

/** Which colour a photo shows (null: the product as a whole). */
export async function setImageColor(imageId: string, colorId: string | null): Promise<void> {
  const { error } = await supabase.from('product_images').update({ color_id: colorId }).eq('id', imageId);
  if (error) throw error;
}

export async function deleteProductImage(imageId: string): Promise<void> {
  const { error } = await supabase.from('product_images').delete().eq('id', imageId);
  if (error) throw error;
}

export async function setPrimaryProductImage(productId: string, imageId: string): Promise<void> {
  // One primary per product (enforced by a partial unique index): clear, then set.
  await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
    .eq('is_primary', true);
  const { error } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId);
  if (error) throw error;
}

export async function fetchAdminCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error) throw error;
  return (data as Category[]) ?? [];
}

export async function createCategory(name: string): Promise<Category> {
  const slug = slugify(name) || `category-${Date.now()}`;
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, slug })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

// ============================================================
// ADMIN — INVENTORY, ALERTS, SETTINGS (migration 023)
// ============================================================

export const MOVEMENTS_PAGE_SIZE = 50;

export interface MovementFilters {
  page?: number;
  productId?: string;
  reason?: MovementReason;
  from?: string;
  to?: string;
}

const MOVEMENT_SELECT = '*, products(name, slug), profiles(full_name, email)';

export async function fetchInventoryMovements(
  filters: MovementFilters = {},
): Promise<PaginatedResponse<InventoryMovement>> {
  const { page = 1, productId, reason, from, to } = filters;
  let query = supabase
    .from('inventory_movements')
    .select(MOVEMENT_SELECT, { count: 'estimated' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * MOVEMENTS_PAGE_SIZE, page * MOVEMENTS_PAGE_SIZE - 1);
  if (productId) query = query.eq('product_id', productId);
  if (reason) query = query.eq('reason', reason);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    data: (data as unknown as InventoryMovement[]) ?? [],
    count: count ?? 0,
    page,
    pageSize: MOVEMENTS_PAGE_SIZE,
  };
}

/** Every movement matching the filters, for a CSV export (up to `limit`). */
export async function fetchAllInventoryMovements(filters: MovementFilters = {}, limit = 20000): Promise<InventoryMovement[]> {
  const out: InventoryMovement[] = [];
  const batch = 1000;
  for (let start = 0; start < limit; start += batch) {
    let query = supabase
      .from('inventory_movements')
      .select(MOVEMENT_SELECT)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, Math.min(start + batch, limit) - 1);
    if (filters.productId) query = query.eq('product_id', filters.productId);
    if (filters.reason) query = query.eq('reason', filters.reason);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data as unknown as InventoryMovement[]) ?? [];
    out.push(...rows);
    if (rows.length < batch) break;
  }
  return out;
}

export async function fetchLowStock(): Promise<LowStockItem[]> {
  const { data, error } = await supabase.rpc('admin_low_stock', { p_limit: 2000 });
  if (error) throw error;
  return (data as unknown as LowStockItem[]) ?? [];
}

export async function fetchStockRequests(): Promise<StockRequestSummary[]> {
  const { data, error } = await supabase.rpc('admin_stock_requests');
  if (error) throw error;
  return (data as unknown as StockRequestSummary[]) ?? [];
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase.rpc('admin_get_store_settings');
  if (error) throw error;
  return data as unknown as StoreSettings;
}

export async function updateStoreSettings(
  settings: Partial<Pick<StoreSettings, 'back_in_stock_enabled' | 'low_stock_alerts' | 'alert_emails'>>,
): Promise<StoreSettings> {
  const { data, error } = await supabase.rpc('admin_update_store_settings', { p_settings: settings as Json });
  if (error) throw toError(error);
  return data as unknown as StoreSettings;
}

/** Runs the scheduled emails now (back-in-stock and/or the low-stock digest). */
export async function runStoreWorker(task: 'back_in_stock' | 'low_stock' | 'all'): Promise<{
  backInStock?: { sent: number; failed: number };
  lowStock?: { items: number; sent: number; skipped?: string };
}> {
  return invokeFunction('store-worker', { task }, 'Send');
}

// ============================================================
// ADMIN — DISCOUNT CODES (migration 025)
// ============================================================

export async function fetchDiscountCodes(): Promise<DiscountCode[]> {
  const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as DiscountCode[]) ?? [];
}

export async function fetchDiscountUsage(): Promise<DiscountUsage[]> {
  const { data, error } = await supabase.rpc('admin_discount_usage');
  if (error) throw error;
  return (data as unknown as DiscountUsage[]) ?? [];
}

export type DiscountCodeInput = Omit<DiscountCode, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export async function saveDiscountCode(input: DiscountCodeInput): Promise<DiscountCode> {
  const { id } = input;
  // Only the editable columns: a row read back from the list also carries
  // created_at / updated_at.
  const row = {
    code: input.code,
    description: input.description,
    kind: input.kind,
    value: input.value,
    min_subtotal: input.min_subtotal,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    usage_limit: input.usage_limit,
    per_customer_limit: input.per_customer_limit,
    applies_to: input.applies_to,
    category_ids: input.category_ids,
    product_ids: input.product_ids,
    exclude_sale_items: input.exclude_sale_items,
    is_active: input.is_active,
  };
  const query = id
    ? supabase.from('discount_codes').update(row).eq('id', id)
    : supabase.from('discount_codes').insert(row);
  const { data, error } = await query.select('*').single();
  if (error) {
    if (error.code === '23505') throw new AppError(error.message, 'code_taken');
    throw error;
  }
  return data as unknown as DiscountCode;
}

/** Codes that were used cannot be deleted (their orders keep them); switch them off instead. */
export async function deleteDiscountCode(id: string): Promise<void> {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') throw new AppError(error.message, 'code_used');
    throw error;
  }
}
