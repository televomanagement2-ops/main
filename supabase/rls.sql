-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- HELPER: check if current user is admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Re-runnable policy setup: drop existing policies before creating them.
DROP POLICY IF EXISTS "profiles: owner read" ON public.profiles;
DROP POLICY IF EXISTS "profiles: owner update" ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin update" ON public.profiles;

DROP POLICY IF EXISTS "categories: public read" ON public.categories;
DROP POLICY IF EXISTS "categories: admin insert" ON public.categories;
DROP POLICY IF EXISTS "categories: admin update" ON public.categories;
DROP POLICY IF EXISTS "categories: admin delete" ON public.categories;

DROP POLICY IF EXISTS "products: public read active" ON public.products;
DROP POLICY IF EXISTS "products: admin insert" ON public.products;
DROP POLICY IF EXISTS "products: admin update" ON public.products;
DROP POLICY IF EXISTS "products: admin delete" ON public.products;

DROP POLICY IF EXISTS "product_images: public read" ON public.product_images;
DROP POLICY IF EXISTS "product_images: admin insert" ON public.product_images;
DROP POLICY IF EXISTS "product_images: admin update" ON public.product_images;
DROP POLICY IF EXISTS "product_images: admin delete" ON public.product_images;

DROP POLICY IF EXISTS "addresses: owner select" ON public.addresses;
DROP POLICY IF EXISTS "addresses: owner insert" ON public.addresses;
DROP POLICY IF EXISTS "addresses: owner update" ON public.addresses;
DROP POLICY IF EXISTS "addresses: owner delete" ON public.addresses;

DROP POLICY IF EXISTS "orders: owner select" ON public.orders;
DROP POLICY IF EXISTS "orders: owner insert" ON public.orders;
DROP POLICY IF EXISTS "orders: owner cancel" ON public.orders;
DROP POLICY IF EXISTS "orders: admin update" ON public.orders;

DROP POLICY IF EXISTS "order_items: owner select" ON public.order_items;
DROP POLICY IF EXISTS "order_items: owner insert" ON public.order_items;

DROP POLICY IF EXISTS "carts: owner select" ON public.carts;
DROP POLICY IF EXISTS "carts: owner insert" ON public.carts;
DROP POLICY IF EXISTS "carts: owner delete" ON public.carts;

DROP POLICY IF EXISTS "cart_items: owner select" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items: owner insert" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items: owner update" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items: owner delete" ON public.cart_items;

-- ============================================================
-- PROFILES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users read/update their own profile; admins read all
CREATE POLICY "profiles: owner read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles: owner update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));
  -- Prevents self-promotion to admin

CREATE POLICY "profiles: admin update"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- ============================================================
-- CATEGORIES
-- ============================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories: public read"
  ON public.categories FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "categories: admin insert"
  ON public.categories FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "categories: admin update"
  ON public.categories FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "categories: admin delete"
  ON public.categories FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- PRODUCTS
-- ============================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products: public read active"
  ON public.products FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "products: admin insert"
  ON public.products FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "products: admin update"
  ON public.products FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "products: admin delete"
  ON public.products FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_images: public read"
  ON public.product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND (p.is_active = TRUE OR public.is_admin())
    )
  );

CREATE POLICY "product_images: admin insert"
  ON public.product_images FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "product_images: admin update"
  ON public.product_images FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "product_images: admin delete"
  ON public.product_images FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- ADDRESSES
-- ============================================================

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addresses: owner select"
  ON public.addresses FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "addresses: owner insert"
  ON public.addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "addresses: owner update"
  ON public.addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "addresses: owner delete"
  ON public.addresses FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- ORDERS
-- ============================================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: owner select"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "orders: owner insert"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Customers can only cancel; admins can set any status
CREATE POLICY "orders: owner cancel"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    status = 'cancelled' AND
    (SELECT status FROM public.orders WHERE id = orders.id) = 'pending'
  );

CREATE POLICY "orders: admin update"
  ON public.orders FOR UPDATE
  USING (public.is_admin());

-- ============================================================
-- ORDER ITEMS
-- ============================================================

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items: owner select"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "order_items: owner insert"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

-- ============================================================
-- CARTS
-- ============================================================

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carts: owner select"
  ON public.carts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "carts: owner insert"
  ON public.carts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "carts: owner delete"
  ON public.carts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- CART ITEMS
-- ============================================================

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_items: owner select"
  ON public.cart_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "cart_items: owner insert"
  ON public.cart_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "cart_items: owner update"
  ON public.cart_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "cart_items: owner delete"
  ON public.cart_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND c.user_id = auth.uid()
    )
  );
