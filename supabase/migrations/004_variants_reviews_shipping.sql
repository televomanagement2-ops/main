-- ============================================================
-- MIGRATION 004 — Product Variants, Reviews, Shipping Methods
-- Safe to run idempotently (uses IF NOT EXISTS / DO $$ blocks)
-- ============================================================

-- ============================================================
-- 1. PRODUCT VARIANTS (sizes for clothing)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size         TEXT NOT NULL,          -- e.g. 'XS', 'S', 'M', 'L', 'XL', 'XXL'
  sku          TEXT,
  stock_qty    INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_variants_unique_size UNIQUE (product_id, size)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON public.product_variants(product_id);

DROP TRIGGER IF EXISTS product_variants_updated_at ON public.product_variants;
CREATE TRIGGER product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed clothing variants for the existing Classic Cotton T-Shirt
INSERT INTO public.product_variants (product_id, size, sku, stock_qty, sort_order)
VALUES
  ('b1000000-0000-0000-0000-000000000003', 'XS',  'CCT-XS-WHT', 40, 1),
  ('b1000000-0000-0000-0000-000000000003', 'S',   'CCT-S-WHT',  80, 2),
  ('b1000000-0000-0000-0000-000000000003', 'M',   'CCT-M-WHT',  90, 3),
  ('b1000000-0000-0000-0000-000000000003', 'L',   'CCT-L-WHT',  70, 4),
  ('b1000000-0000-0000-0000-000000000005', 'XL',  'CCT-XL-WHT', 20, 5)
ON CONFLICT (product_id, size) DO NOTHING;

-- ============================================================
-- 2. ADD size COLUMN TO order_items (snapshot chosen size)
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selected_size TEXT;

-- ============================================================
-- 3. SHIPPING METHODS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.shipping_methods (id, name, description, price, estimated_days_min, estimated_days_max, sort_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Standard',   'Regular postal delivery',           0.00, 5,  10, 1),
  ('c1000000-0000-0000-0000-000000000002', 'Express',    'Fast tracked delivery',             9.99, 2,   3, 2),
  ('c1000000-0000-0000-0000-000000000003', 'Overnight',  'Next business day guaranteed',     19.99, 1,   1, 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. ADD shipping_method fields TO orders
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_method_id   UUID REFERENCES public.shipping_methods(id),
  ADD COLUMN IF NOT EXISTS shipping_method_name TEXT;

-- ============================================================
-- 5. PRODUCT REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_reviews_one_per_user UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product
  ON public.product_reviews(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_user
  ON public.product_reviews(user_id);

DROP TRIGGER IF EXISTS product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- product_variants: public read, admin write
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variants: public read"  ON public.product_variants;
CREATE POLICY "variants: public read"
  ON public.product_variants FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "variants: admin all"    ON public.product_variants;
CREATE POLICY "variants: admin all"
  ON public.product_variants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- shipping_methods: public read, admin write
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping: public read"  ON public.shipping_methods;
CREATE POLICY "shipping: public read"
  ON public.shipping_methods FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "shipping: admin all"    ON public.shipping_methods;
CREATE POLICY "shipping: admin all"
  ON public.shipping_methods FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- product_reviews: public read; authenticated users write own
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews: public read"   ON public.product_reviews;
CREATE POLICY "reviews: public read"
  ON public.product_reviews FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "reviews: owner insert"  ON public.product_reviews;
CREATE POLICY "reviews: owner insert"
  ON public.product_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews: owner update"  ON public.product_reviews;
CREATE POLICY "reviews: owner update"
  ON public.product_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews: owner delete"  ON public.product_reviews;
CREATE POLICY "reviews: owner delete"
  ON public.product_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 7. ZERO-OUT compare_at_price (remove discounts from data)
-- ============================================================

UPDATE public.products
  SET compare_at_price = NULL
  WHERE compare_at_price IS NOT NULL;
