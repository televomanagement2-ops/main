import { supabase } from './supabaseClient';
import type {
  Product,
  Category,
  Order,
  OrderItem,
  Cart,
  CartItem,
  Profile,
  ProductFilters,
  PaginatedResponse,
  Address,
  ShippingMethod,
  ProductReview,
} from '../types';

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

export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .in('status', ['paid']);

  if (error) throw error;
}

export async function createOrder(
  order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'order_items'>,
  items: Omit<OrderItem, 'id' | 'order_id' | 'created_at'>[]
): Promise<Order> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: newOrder, error: orderErr } = await client
    .from('orders')
    .insert(order)
    .select()
    .single();

  if (orderErr) throw orderErr;

  const orderItems = items.map((item) => ({
    ...item,
    order_id: (newOrder as unknown as Order).id,
  }));

  const { error: itemsErr } = await client
    .from('order_items')
    .insert(orderItems);

  if (itemsErr) throw itemsErr;

  return newOrder as unknown as Order;
}
