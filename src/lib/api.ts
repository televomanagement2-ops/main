import { supabase } from './supabaseClient';
import type {
  Product,
  Category,
  Order,
  OrderStatus,
  Cart,
  CartItem,
  Profile,
  ProductFilters,
  PaginatedResponse,
  Address,
  ShippingMethod,
  ProductReview,
  ProductImage,
  AdminAnalytics,
} from '../types';

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

  let query = supabase
    .from('products')
    .select(
      `*, product_images(*), categories(*)`,
      { count: 'exact' }
    )
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

  // Fetch variants separately — table may not exist before migration 004
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: variants } = await (supabase as any)
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('sort_order');
    if (variants) product.product_variants = variants;
  } catch {
    // migration not yet applied — variants simply absent
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
  return (data as unknown as Category[]) ?? [];
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
  return data as unknown as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Profile;
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
  return (data as unknown as Address[]) ?? [];
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
  return data as unknown as Address;
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
  return (data as unknown as ShippingMethod[]) ?? [];
}

// ============================================================
// PRODUCT REVIEWS
// ============================================================

export async function fetchReviews(productId: string): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from('product_reviews')
    .select('*, profiles(full_name, email)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as ProductReview[]) ?? [];
}

export async function hasPurchasedProduct(productId: string): Promise<boolean> {
  // Calls the SECURITY DEFINER function added in migration 010. Returns false
  // if the function is missing (migration not yet applied) or on any error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('has_purchased', {
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
): Promise<ProductReview> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from('product_reviews')
    .upsert(
      { product_id: productId, user_id: userId, rating, body },
      { onConflict: 'product_id,user_id' }
    )
    .select('*, profiles(full_name, email)')
    .single();

  if (error) throw error;
  return data as ProductReview;
}

// ============================================================
// CART (server-side, authenticated)
// ============================================================

export async function fetchOrCreateCart(userId: string): Promise<Cart> {
  const { data: existing, error: fetchErr } = await supabase
    .from('carts')
    .select('*, cart_items(*, products(*, product_images(*)))')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) return existing as unknown as Cart;

  const { data: created, error: createErr } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('*, cart_items(*, products(*, product_images(*)))')
    .single();

  if (createErr) throw createErr;
  return created as unknown as Cart;
}

export async function upsertCartItem(
  cartId: string,
  productId: string,
  quantity: number
): Promise<CartItem> {
  const { data, error } = await supabase
    .from('cart_items')
    .upsert(
      { cart_id: cartId, product_id: productId, quantity },
      { onConflict: 'cart_id,product_id' }
    )
    .select('*, products(*, product_images(*))')
    .single();

  if (error) throw error;
  return data as unknown as CartItem;
}

export async function deleteCartItem(cartItemId: string): Promise<void> {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId);

  if (error) throw error;
}

export async function clearCartItems(cartId: string): Promise<void> {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('cart_id', cartId);

  if (error) throw error;
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

export async function cancelOrder(orderId: string): Promise<Order> {
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/handle-order-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ action: 'cancel', order_id: orderId }),
  });

  let payload: { order?: Order; error?: string } | null = null;
  try {
    payload = (await res.json()) as { order?: Order; error?: string };
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Cancel failed with status ${res.status}.`);
  }

  if (!payload?.order) {
    throw new Error('Cancel did not return order details.');
  }

  return payload.order;
}

// ============================================================
// ADMIN — ORDERS, ANALYTICS, CATALOG
// ============================================================

export async function fetchAdminOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), profiles(full_name, email, phone)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as Order[]) ?? [];
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

export async function updateOrderTracking(
  orderId: string,
  trackingId: string,
  status: OrderStatus = 'shipped'
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

  const res = await fetch(`${supabaseUrl}/functions/v1/update-tracking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ orderId, trackingId, status }),
  });

  let payload: { order?: Order; error?: string } | null = null;
  try {
    payload = (await res.json()) as { order?: Order; error?: string };
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Tracking update failed with status ${res.status}.`);
  }

  if (!payload?.order) {
    throw new Error('Tracking update did not return order details.');
  }

  return payload.order;
}

export async function markOrderDelivered(orderId: string): Promise<Order> {
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/handle-order-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ action: 'deliver', order_id: orderId }),
  });

  let payload: { order?: Order; error?: string } | null = null;
  try {
    payload = (await res.json()) as { order?: Order; error?: string };
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Delivery update failed with status ${res.status}.`);
  }

  if (!payload?.order) {
    throw new Error('Delivery update did not return order details.');
  }

  return payload.order;
}

export async function refundOrder(orderId: string, amount?: number): Promise<Order> {
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/handle-order-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ action: 'refund', order_id: orderId, amount }),
  });

  let payload: { order?: Order; error?: string } | null = null;
  try {
    payload = (await res.json()) as { order?: Order; error?: string };
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Refund failed with status ${res.status}.`);
  }

  if (!payload?.order) {
    throw new Error('Refund did not return order details.');
  }

  return payload.order;
}

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('status, total, created_at');

  if (error) throw error;

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

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let grossRevenue = 0;
  let orders24h = 0;
  let orders7d = 0;

  (orders ?? []).forEach((order) => {
    const status = order.status as OrderStatus;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    if (status === 'paid' || status === 'shipped' || status === 'delivered') {
      const createdAtMs = new Date(order.created_at as string).getTime();
      const total = Number(order.total ?? 0);
      grossRevenue += total;
      if (createdAtMs >= now - dayMs) orders24h += 1;
      if (createdAtMs >= now - dayMs * 7) orders7d += 1;
    }
  });

  // Best seller by quantity
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('product_id, product_name, quantity, orders!inner(status)')
    .in('orders.status', ['paid', 'shipped', 'delivered']);

  if (itemsError) throw itemsError;

  const quantityByProduct = new Map<string, { name: string; quantity: number }>();
  (items ?? []).forEach((item) => {
    const key = item.product_id as string;
    const current = quantityByProduct.get(key) ?? {
      name: item.product_name as string,
      quantity: 0,
    };
    current.quantity += Number(item.quantity ?? 0);
    quantityByProduct.set(key, current);
  });

  let bestSeller: AdminAnalytics['bestSeller'] = null;
  quantityByProduct.forEach((value, productId) => {
    if (!bestSeller || value.quantity > bestSeller.quantity) {
      bestSeller = { productId, productName: value.name, quantity: value.quantity };
    }
  });

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    orders24h,
    orders7d,
    bestSeller,
    statusCounts,
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
  updates: Partial<Product>
): Promise<Product> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Resolve a unique slug (the products.slug column is UNIQUE).
  const base = (input.slug?.trim() || slugify(input.name)) || `product-${Date.now()}`;
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await client
      .from('products')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data, error } = await client
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const rows = images.map((img, i) => ({
    product_id: productId,
    url: img.url,
    alt_text: img.alt_text ?? null,
    is_primary: img.is_primary ?? i === 0,
    sort_order: img.sort_order ?? i,
  }));
  const { data, error } = await client.from('product_images').insert(rows).select();
  if (error) throw error;
  return data as ProductImage[];
}

export async function deleteProductImage(imageId: string): Promise<void> {
  const { error } = await supabase.from('product_images').delete().eq('id', imageId);
  if (error) throw error;
}

export async function setPrimaryProductImage(productId: string, imageId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  // One primary per product (enforced by a partial unique index): clear, then set.
  await client
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
    .eq('is_primary', true);
  const { error } = await client.from('product_images').update({ is_primary: true }).eq('id', imageId);
  if (error) throw error;
}

export async function fetchAdminCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error) throw error;
  return (data as unknown as Category[]) ?? [];
}

export async function createCategory(name: string): Promise<Category> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const slug = slugify(name) || `category-${Date.now()}`;
  const { data, error } = await client
    .from('categories')
    .insert({ name, slug })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}
