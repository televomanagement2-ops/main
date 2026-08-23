import { supabase } from './supabaseClient';
import type { Database } from './database.types';
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
  AdminAnalytics,
} from '../types';

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

// ============================================================
// PRODUCTS
// ============================================================

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
  const select = categorySlug
    ? '*, product_images(*), categories!inner(*)'
    : '*, product_images(*), categories(*)';

  let query = supabase
    .from('products')
    .select(select, { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (categorySlug) {
    query = query.eq('categories.slug', categorySlug);
  }
  if (minPrice !== undefined) query = query.gte('price', minPrice);
  if (maxPrice !== undefined) query = query.lte('price', maxPrice);
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
    .select('*, product_images(*), categories(*)')
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
    .select('*, product_images(*), categories(*)')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

/**
 * Fetch fresh price/stock/availability for the given products (cart sync).
 * product_variants is included because the cart clamps sized lines against the
 * SELECTED SIZE's stock — without it the sync would overwrite each cart item's
 * product with a variant-less row and silently lose that limit.
 */
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*), product_variants(*)')
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

export async function submitReview(
  productId: string,
  userId: string,
  rating: number,
  body: string
): Promise<PublicProductReview> {
  const { data, error } = await supabase
    .from('product_reviews')
    .upsert(
      { product_id: productId, user_id: userId, rating, body },
      { onConflict: 'product_id,user_id' }
    )
    .select(PUBLIC_REVIEW_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as PublicProductReview;
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

async function invokeOrderFunction(
  functionName: 'handle-order-action' | 'update-tracking',
  body: Record<string, unknown>,
  errorLabel: string,
): Promise<Order> {
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

  let payload: { order?: Order; error?: string } | null = null;
  try {
    payload = (await res.json()) as { order?: Order; error?: string };
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || `${errorLabel} failed with status ${res.status}.`);
  }

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

export const ADMIN_ORDERS_PAGE_SIZE = 50;

export interface AdminOrdersFilters {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  needsReviewOnly?: boolean;
}

export async function fetchAdminOrders(
  filters: AdminOrdersFilters = {}
): Promise<PaginatedResponse<Order>> {
  const { page = 1, pageSize = ADMIN_ORDERS_PAGE_SIZE, status, needsReviewOnly } = filters;

  let query = supabase
    .from('orders')
    .select('*, order_items(*), profiles(full_name, email, phone)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq('status', status);
  if (needsReviewOnly) query = query.eq('needs_review', true);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: (data as unknown as Order[]) ?? [],
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select('*, order_items(*), profiles(full_name, email, phone)')
    .single();

  if (error) throw error;
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

export async function refundOrder(orderId: string, amount?: number): Promise<Order> {
  return invokeOrderFunction('handle-order-action', { action: 'refund', order_id: orderId, amount }, 'Refund');
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
  };
}

export async function fetchAdminProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*), categories(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as Product[]) ?? [];
}

export async function updateProduct(
  productId: string,
  updates: ProductUpdate
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select('*, product_images(*), categories(*)')
    .single();

  if (error) throw error;
  return data as unknown as Product;
}

// ============================================================
// ADMIN — PRODUCT CREATION, IMAGES, CATEGORIES
// ============================================================

export type ProductInput = {
  name: string;
  category_id: string;
  price: number;
  description?: string | null;
  sku?: string | null;
  stock_quantity?: number;
  low_stock_threshold?: number;
  weight_grams?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
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
      description: input.description ?? null,
      sku: input.sku || null,
      stock_quantity: input.stock_quantity ?? 0,
      low_stock_threshold: input.low_stock_threshold ?? 5,
      weight_grams: input.weight_grams ?? null,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
    })
    .select('*, product_images(*), categories(*)')
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
  images: { url: string; alt_text?: string | null; is_primary?: boolean; sort_order?: number }[]
): Promise<ProductImage[]> {
  const rows = images.map((img, i) => ({
    product_id: productId,
    url: img.url,
    alt_text: img.alt_text ?? null,
    is_primary: img.is_primary ?? i === 0,
    sort_order: img.sort_order ?? i,
  }));
  const { data, error } = await supabase.from('product_images').insert(rows).select();
  if (error) throw error;
  return (data as ProductImage[]) ?? [];
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
