export type UserRole = 'customer' | 'admin';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'requires_action'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'shipped'
  | 'delivered'
  | 'refunded';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  sku: string | null;
  stock_qty: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  sku: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  weight_grams: number | null;
  is_active: boolean;
  is_featured: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // joined
  product_images?: ProductImage[];
  categories?: Category;
  product_variants?: ProductVariant[];
}

export interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  price: number;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
  // joined
  profiles?: Pick<Profile, 'full_name' | 'email'>;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  unit_price: number;
  quantity: number;
  total_price: number;
  selected_size: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  shipping_address: Omit<Address, 'id' | 'user_id' | 'is_default' | 'created_at' | 'updated_at'>;
  shipping_method_id: string | null;
  shipping_method_name: string | null;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
  tracking_id?: string | null;
  tracking_updated_at?: string | null;
  refunded_at?: string | null;
  refund_id?: string | null;
  refund_amount?: number | null;
  delivered_at?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  order_items?: OrderItem[];
  profiles?: Pick<Profile, 'full_name' | 'email' | 'phone'>;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  // joined
  products?: Product;
}

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  // joined
  cart_items?: CartItem[];
}

// ---- UI / Store types ----

export interface CartItemLocal {
  product: Product;
  quantity: number;
  selectedSize?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

export interface ProductFilters {
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminAnalytics {
  grossRevenue: number;
  orders24h: number;
  orders7d: number;
  bestSeller: { productId: string; productName: string; quantity: number } | null;
  statusCounts: Record<OrderStatus, number>;
}
