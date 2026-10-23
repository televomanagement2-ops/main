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
  /** Measurement table shown for this category's products (migration 022). */
  size_guide_id?: string | null;
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
  /** Shown when this colour is selected; null = a photo of the product as a whole. */
  color_id?: string | null;
  created_at: string;
}

/**
 * The word shown above a product's size selector (products.size_label,
 * migration 021). Mirrored by SIZE_LABELS in src/lib/sizes.ts.
 */
export type SizeLabel = 'size' | 'measure' | 'length' | 'shoe_size' | 'ring_size' | 'waist';

/**
 * The word shown above a product's colour selector (products.color_label,
 * migration 022). Mirrored by COLOR_LABELS in src/lib/variants.ts.
 */
export type ColorLabel = 'color' | 'material' | 'finish' | 'pattern' | 'style' | 'scent' | 'variant';

/** A colour (or material, finish…) of a product, with its own photos. */
export interface ProductColor {
  id: string;
  product_id: string;
  name: string;
  /** '#RRGGBB', or null to show the name alone. */
  swatch: string | null;
  sort_order: number;
  /** Derived: TRUE while at least one variant of this colour is on sale. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * One sellable combination of a product — a size, a colour, or a colour in a
 * size — with its own stock counter (and optionally its own price).
 */
export interface ProductVariant {
  id: string;
  product_id: string;
  /** Null when the product is sold by colour only. */
  size: string | null;
  /** Null when the product is sold by size only. */
  color_id: string | null;
  /** This variant's price; null = the product price. */
  price: number | null;
  sku: string | null;
  /** May be negative: units sold beyond stock (backorder depth, migration 013). */
  stock_qty: number;
  sort_order: number;
  /** FALSE: not for sale, and hidden from the storefront. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Admin only: what one unit costs the store (product_variant_costs). */
  cost_price?: number | null;
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
  /**
   * For a sized product this is DERIVED by the database: the sum of the
   * non-negative stock of its active sizes (migration 021). It cannot be
   * written directly; change the sizes instead.
   */
  stock_quantity: number;
  low_stock_threshold: number;
  weight_grams: number | null;
  is_active: boolean;
  is_featured: boolean;
  /** Sold by size: checkout requires one, and stock is kept per size. */
  has_sizes: boolean;
  size_label: SizeLabel;
  /** Sold by colour (or material…): with has_sizes, stock is per colour × size. */
  has_colors: boolean;
  color_label: ColorLabel;
  /** Derived: lowest / highest price among the variants on sale (or price). */
  price_min: number | null;
  price_max: number | null;
  /** Null: the category's size guide (or none). */
  size_guide_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // joined
  product_images?: ProductImage[];
  categories?: Category;
  product_variants?: ProductVariant[];
  product_colors?: ProductColor[];
}

/** A measurement table shown next to the size selector (migration 022). */
export interface SizeGuide {
  id: string;
  name: string;
  columns: string[];
  rows: string[][];
  notes: string | null;
  created_at: string;
  updated_at: string;
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
  /** ISO country codes this method is offered for; null = everywhere. */
  countries: string[] | null;
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
  // Snapshot of the reviewer's display name (set by a DB trigger) — public
  // reviews no longer join profiles, which leaked reviewer emails.
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A review as it is read back from the API. `product_reviews` is world-readable
 * (RLS `USING (TRUE)`), so the reviewer's `user_id` is deliberately never
 * selected — `author_name` is the display snapshot the UI actually renders.
 */
export type PublicProductReview = Omit<ProductReview, 'user_id'>;

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  unit_price: number;
  quantity: number;
  total_price: number;
  /** Display snapshot of the size the customer chose. */
  selected_size: string | null;
  /** Display snapshot of the colour the customer chose (migration 022). */
  selected_color?: string | null;
  /** SKU at the time of sale. */
  sku?: string | null;
  /** The variant row the line took its stock from (migration 021). */
  variant_id?: string | null;
  /** Units refunded / put back into stock so far (migration 024). */
  refunded_quantity?: number;
  restocked_quantity?: number;
  /** This line's share of the order's discount code (migration 025). */
  discount_amount?: number;
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
  /** Who asked for the refund — keeps admin refunds out of the customer's rate limit. */
  refund_requested_by?: string | null;
  delivered_at?: string | null;
  // Operator attention flag (e.g. 'oversold', or a webhook business-rule
  // rejection). Paid orders are always honored; this surfaces the ones that
  // need manual follow-up.
  needs_review?: boolean;
  review_reason?: string | null;
  /** Discount code used, and the part of discount_amount taken off shipping. */
  discount_code?: string | null;
  discount_id?: string | null;
  shipping_discount?: number;
  /** Issued on first print (migration 024). */
  invoice_number?: string | null;
  invoice_issued_at?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  order_items?: OrderItem[];
  profiles?: Pick<Profile, 'full_name' | 'email' | 'phone'>;
}

// ---- UI / Store types ----

export interface CartItemLocal {
  product: Product;
  quantity: number;
  /** The variant (size and/or colour) this line is for. */
  variantId?: string | null;
  /** Display labels of the variant, as chosen. */
  selectedSize?: string | null;
  selectedColor?: string | null;
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
  needsReview: number;
  bestSeller: { productId: string; productName: string; quantity: number } | null;
  statusCounts: Record<OrderStatus, number>;
  /** Daily gross revenue over the last 30 days (days without sales omitted). */
  revenueByDay: { day: string; revenue: number }[];
  /** Gross revenue split by order status (revenue statuses only). */
  revenueByStatus: Partial<Record<OrderStatus, number>>;
  /** Refunds on orders still counted in grossRevenue. */
  partialRefunds: number;
  /** Every refund ever made. */
  refundedTotal: number;
  /** Discount codes, last 30 days. */
  discounts30d: number;
  /** Product margin, last 30 days, over lines whose cost was known. */
  margin30d: { revenue: number; cost: number; coveredUnits: number; totalUnits: number };
  /** Items at or under their threshold, with stock / sold out. */
  lowStock: number;
  outOfStock: number;
  /** Open back-in-stock requests. */
  stockRequests: number;
}

// ---- Operations (migrations 023–025) ----

export type OrderEventKind =
  | 'note'
  | 'status'
  | 'tracking'
  | 'refund'
  | 'exchange'
  | 'review'
  | 'payment'
  | 'invoice'
  | 'email';

export interface OrderEvent {
  id: number;
  order_id: string;
  kind: OrderEventKind;
  message: string | null;
  data: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

export interface OrderRefund {
  id: string;
  order_id: string;
  stripe_refund_id: string | null;
  amount: number;
  status: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled';
  source: 'admin' | 'customer' | 'stripe';
  reason: string | null;
  lines: { order_item_id: string; quantity: number; restock: boolean }[];
  shipping_amount: number;
  applied_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type MovementReason =
  | 'sale'
  | 'cancel'
  | 'refund'
  | 'return'
  | 'exchange'
  | 'manual'
  | 'import'
  | 'initial'
  | 'other';

export interface InventoryMovement {
  id: number;
  product_id: string;
  variant_id: string | null;
  variant_label: string | null;
  delta: number;
  stock_after: number;
  reason: MovementReason;
  detail: 'variant_removed' | 'to_variants' | 'to_single' | null;
  order_id: string | null;
  actor_id: string | null;
  note: string | null;
  created_at: string;
  products?: Pick<Product, 'name' | 'slug'> | null;
  profiles?: Pick<Profile, 'full_name' | 'email'> | null;
}

export interface LowStockItem {
  product_id: string;
  product_name: string;
  slug: string;
  image_url: string | null;
  variant_id: string | null;
  variant_label: string | null;
  sku: string | null;
  stock: number;
  threshold: number;
  /** Customers waiting for it (back-in-stock requests). */
  waiting: number;
}

export interface StockRequestSummary {
  product_id: string;
  product_name: string;
  slug: string;
  variant_id: string | null;
  variant_label: string | null;
  waiting: number;
  oldest: string | null;
  stock: number;
  notified_30d: number;
}

export interface StoreSettings {
  back_in_stock_enabled: boolean;
  low_stock_alerts: boolean;
  /** Empty: every admin account. */
  alert_emails: string[];
  admin_emails: string[];
  updated_at: string;
}

export type DiscountKind = 'percent' | 'fixed' | 'free_shipping';
export type DiscountScope = 'all' | 'categories' | 'products';

export interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  kind: DiscountKind;
  value: number;
  min_subtotal: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  applies_to: DiscountScope;
  category_ids: string[];
  product_ids: string[];
  exclude_sale_items: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountUsage {
  discount_id: string;
  uses: number;
  paid_uses: number;
  discount_total: number;
  revenue: number;
  last_used_at: string | null;
}
