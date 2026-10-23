-- ============================================================
-- MIGRATION 022 — Variants: colour × size, per-variant price, size guides,
--                 catalogue tools
-- Run after 021_product_sizes.sql
-- ============================================================
-- 1. A second variant dimension. products.has_colors says the customer picks a
--    colour (or material, finish, …: color_label picks the word). Colours live
--    in product_colors, with their own swatch and their own photos
--    (product_images.color_id). A variant row is one combination:
--      sizes only    → size set,   color_id NULL   (021 rows, unchanged)
--      colours only  → size NULL,  color_id set
--      both          → size set,   color_id set
--    Stock stays per variant row, and products.stock_quantity is derived from
--    the rows on sale whenever the product has sizes OR colours.
-- 2. product_variants.price: a variant may cost more or less than the product
--    (50 ml vs 100 ml, a 120×180 rug vs a 160×230 one). NULL = product price.
--    products.price_min / price_max are derived, so a listing can say "from".
-- 3. Costs stay private. products.cost_price is already hidden from the API
--    (016); variant costs get their own admin-only table, and order lines
--    snapshot their unit cost into another one, for margin reporting.
-- 4. Size guides: a measurement table assigned to a product or a category.
-- 5. Order lines snapshot the colour and the SKU they sold.
-- 6. admin_save_product_variants(): the one write path for sizes, colours,
--    prices, costs and stock. admin_set_product_inventory() (021) becomes a
--    wrapper over it, so an admin app built for 021 keeps working on products
--    without colours.
-- 7. admin_duplicate_product(), admin_import_products(),
--    admin_catalog_costs(), admin_set_product_stock().
--
-- Idempotent. If 021 is ever run again, run this file again after it.
-- ============================================================

-- ============================================================
-- 0. HELPERS
-- ============================================================

-- "  50   cm " → "50 cm"; empty → NULL. Sizes and colour names are compared
-- through this, case-insensitively.
CREATE OR REPLACE FUNCTION public.normalize_label(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(btrim(regexp_replace(COALESCE(p_value, ''), '\s+', ' ', 'g')), '');
$$;

-- Why a stock figure is about to move, for the inventory log (migration 023).
-- Transaction-local: it only labels the writes of the function that sets it.
CREATE OR REPLACE FUNCTION public.set_stock_context(
  p_reason   TEXT,
  p_order_id UUID DEFAULT NULL,
  p_note     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
AS $$
  SELECT set_config('app.stock_reason', COALESCE(p_reason, ''), true),
         set_config('app.stock_order', COALESCE(p_order_id::TEXT, ''), true),
         set_config('app.stock_note', COALESCE(left(p_note, 500), ''), true);
$$;

REVOKE ALL ON FUNCTION public.set_stock_context(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 1. PRODUCTS — colours, price range
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_colors  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS color_label TEXT    NOT NULL DEFAULT 'color',
  ADD COLUMN IF NOT EXISTS price_min   NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_max   NUMERIC(10, 2);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_color_label_check;

-- Mirrored by COLOR_LABELS in src/lib/variants.ts.
ALTER TABLE public.products
  ADD CONSTRAINT products_color_label_check
    CHECK (color_label IN ('color', 'material', 'finish', 'pattern', 'style', 'scent', 'variant'));

COMMENT ON COLUMN public.products.has_colors IS
  'TRUE: the customer picks a colour (product_colors). With has_sizes too, stock is kept per colour × size. stock_quantity is then derived from product_variants.';
COMMENT ON COLUMN public.products.color_label IS
  'Word shown above the colour selector: color | material | finish | pattern | style | scent | variant.';
COMMENT ON COLUMN public.products.price_min IS
  'Derived: the lowest price among the variants on sale (or price). Lets a listing say "from".';
COMMENT ON COLUMN public.products.price_max IS
  'Derived: the highest price among the variants on sale (or price).';

-- ============================================================
-- 2. SIZE GUIDES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.size_guides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  -- ["Size", "Chest (cm)", "Waist (cm)"]
  columns     JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- [["S", "88–92", "72–76"], …] — one array of cells per row
  rows        JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT size_guides_name_check CHECK (name = btrim(name) AND length(name) BETWEEN 1 AND 80),
  CONSTRAINT size_guides_shape_check CHECK (
    jsonb_typeof(columns) = 'array'
    AND jsonb_typeof(rows) = 'array'
    AND jsonb_array_length(columns) BETWEEN 1 AND 12
    AND jsonb_array_length(rows) <= 60
  ),
  CONSTRAINT size_guides_length_check CHECK (
    length(columns::TEXT) + length(rows::TEXT) <= 20000
    AND length(COALESCE(notes, '')) <= 2000
  )
);

DROP TRIGGER IF EXISTS size_guides_updated_at ON public.size_guides;
CREATE TRIGGER size_guides_updated_at
  BEFORE UPDATE ON public.size_guides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.size_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "size_guides: public read" ON public.size_guides;
CREATE POLICY "size_guides: public read"
  ON public.size_guides FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "size_guides: admin all" ON public.size_guides;
CREATE POLICY "size_guides: admin all"
  ON public.size_guides FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NULL on a product: use its category's guide (or the parent category's).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_guide_id UUID REFERENCES public.size_guides(id) ON DELETE SET NULL;
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS size_guide_id UUID REFERENCES public.size_guides(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_size_guide
  ON public.products(size_guide_id) WHERE size_guide_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_size_guide
  ON public.categories(size_guide_id) WHERE size_guide_id IS NOT NULL;

-- products is column-granted since 016: new columns are invisible until named.
GRANT SELECT (has_colors, color_label, price_min, price_max, size_guide_id)
  ON public.products TO anon, authenticated;

-- ============================================================
-- 3. PRODUCT COLOURS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_colors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  -- '#RRGGBB'; NULL shows the name alone (materials, finishes)
  swatch      TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  -- Derived: TRUE while at least one variant of this colour is on sale.
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_colors_name_check CHECK (name = btrim(name) AND length(name) BETWEEN 1 AND 40),
  CONSTRAINT product_colors_swatch_check CHECK (swatch IS NULL OR swatch ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS product_colors_unique_name
  ON public.product_colors(product_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_product_colors_product
  ON public.product_colors(product_id);

DROP TRIGGER IF EXISTS product_colors_updated_at ON public.product_colors;
CREATE TRIGGER product_colors_updated_at
  BEFORE UPDATE ON public.product_colors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_colors ENABLE ROW LEVEL SECURITY;

-- A colour whose variants are all switched off is history (orders still name
-- it), not something to offer.
DROP POLICY IF EXISTS "product_colors: public read" ON public.product_colors;
CREATE POLICY "product_colors: public read"
  ON public.product_colors FOR SELECT
  USING (
    (
      is_active
      AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.is_active)
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "product_colors: admin all" ON public.product_colors;
CREATE POLICY "product_colors: admin all"
  ON public.product_colors FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 4. PRODUCT VARIANTS — colour, price, optional size
-- ============================================================

-- NO ACTION (checked at the end of the statement), not RESTRICT: deleting a
-- product cascades to both its colours and its variants, and RESTRICT would
-- make that depend on which cascade Postgres happens to run first.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS color_id UUID REFERENCES public.product_colors(id),
  ADD COLUMN IF NOT EXISTS price    NUMERIC(10, 2);

ALTER TABLE public.product_variants
  ALTER COLUMN size DROP NOT NULL;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_price_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_price_check CHECK (price IS NULL OR price >= 0);

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_dimension_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_dimension_check CHECK (size IS NOT NULL OR color_id IS NOT NULL);

-- 021's format check, restated for an optional size.
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_size_format_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_size_format_check CHECK (
    (size IS NULL OR (size = btrim(size) AND length(size) BETWEEN 1 AND 40))
    AND length(COALESCE(sku, '')) <= 64
  );

-- One row per combination. NULLS NOT DISTINCT: (product, no colour, 'M') and
-- (product, red, no size) are each unique, exactly like (product, size) was.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.product_variants'::regclass
       AND conname = 'product_variants_unique_combination'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_unique_combination
        UNIQUE NULLS NOT DISTINCT (product_id, color_id, size);
  END IF;
END
$$;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_unique_size;

CREATE INDEX IF NOT EXISTS idx_product_variants_color
  ON public.product_variants(color_id) WHERE color_id IS NOT NULL;

COMMENT ON COLUMN public.product_variants.price IS
  'This variant''s price; NULL = the product price.';
COMMENT ON COLUMN public.product_variants.color_id IS
  'The colour of this combination (product_colors). NULL when the product has no colours.';

-- A colour (or a photo) can only belong to its own product's variants.
CREATE OR REPLACE FUNCTION public.check_variant_color_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.color_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_colors
     WHERE id = NEW.color_id AND product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'Colour % does not belong to product %.', NEW.color_id, NEW.product_id
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_color_guard ON public.product_variants;
CREATE TRIGGER product_variants_color_guard
  BEFORE INSERT OR UPDATE OF color_id, product_id ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.check_variant_color_product();

-- ============================================================
-- 5. PRODUCT IMAGES — photos per colour
-- ============================================================

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS color_id UUID REFERENCES public.product_colors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_images_color
  ON public.product_images(color_id) WHERE color_id IS NOT NULL;

COMMENT ON COLUMN public.product_images.color_id IS
  'Shown when this colour is selected. NULL = a photo of the product as a whole.';

DROP TRIGGER IF EXISTS product_images_color_guard ON public.product_images;
CREATE TRIGGER product_images_color_guard
  BEFORE INSERT OR UPDATE OF color_id, product_id ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.check_variant_color_product();

-- ============================================================
-- 6. COSTS — admin only
-- ============================================================
-- Not a column on product_variants: that table is world-readable and selected
-- with '*', so a column there is a margin dump for every visitor (the reason
-- 016 had to column-grant products).

CREATE TABLE IF NOT EXISTS public.product_variant_costs (
  variant_id  UUID PRIMARY KEY REFERENCES public.product_variants(id) ON DELETE CASCADE,
  cost_price  NUMERIC(10, 2) NOT NULL CHECK (cost_price >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_variant_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "variant_costs: admin all" ON public.product_variant_costs;
CREATE POLICY "variant_costs: admin all"
  ON public.product_variant_costs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
REVOKE ALL ON public.product_variant_costs FROM anon;

-- ============================================================
-- 7. ORDER ITEMS — colour and SKU snapshots, cost snapshot
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selected_color TEXT,
  ADD COLUMN IF NOT EXISTS sku            TEXT;

COMMENT ON COLUMN public.order_items.selected_color IS
  'Display snapshot of the colour the customer chose (variant_id is the stock row).';
COMMENT ON COLUMN public.order_items.sku IS
  'SKU of the variant (or product) at the time of sale.';

-- What the line cost the store, captured at checkout. Separate table:
-- order_items is readable by the customer who placed the order.
CREATE TABLE IF NOT EXISTS public.order_item_costs (
  order_item_id UUID PRIMARY KEY REFERENCES public.order_items(id) ON DELETE CASCADE,
  unit_cost     NUMERIC(10, 2) NOT NULL CHECK (unit_cost >= 0)
);

ALTER TABLE public.order_item_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_item_costs FROM anon, authenticated;

-- ============================================================
-- 8. DERIVED FIGURES — stock, price range, colour availability
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_product_rollups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INTEGER;
  v_min   NUMERIC;
  v_max   NUMERIC;
BEGIN
  IF NEW.has_sizes OR NEW.has_colors THEN
    -- Negative variants (backorder depth, 013) count as zero: an oversold XL
    -- must not hide the M and L still on the shelf.
    SELECT COALESCE(SUM(GREATEST(v.stock_qty, 0)), 0)::INTEGER,
           MIN(COALESCE(v.price, NEW.price)),
           MAX(COALESCE(v.price, NEW.price))
      INTO v_stock, v_min, v_max
      FROM public.product_variants v
     WHERE v.product_id = NEW.id
       AND v.is_active;

    NEW.stock_quantity := v_stock;
    NEW.price_min := COALESCE(v_min, NEW.price);
    NEW.price_max := COALESCE(v_max, NEW.price);
  ELSE
    NEW.price_min := NEW.price;
    NEW.price_max := NEW.price;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_sized_stock ON public.products;
DROP TRIGGER IF EXISTS products_sync_rollups ON public.products;
CREATE TRIGGER products_sync_rollups
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_rollups();

DROP FUNCTION IF EXISTS public.sync_sized_product_stock();

-- Refresh what depends on a product's variants: its derived row (the BEFORE
-- trigger above does the arithmetic) and whether a colour is still on sale.
CREATE OR REPLACE FUNCTION public.refresh_variant_rollups(p_product_id UUID, p_color_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
     SET stock_quantity = stock_quantity
   WHERE id = p_product_id
     AND (has_sizes OR has_colors);

  IF p_color_id IS NOT NULL THEN
    UPDATE public.product_colors c
       SET is_active = s.on_sale
      FROM (
        SELECT EXISTS (
                 SELECT 1 FROM public.product_variants v
                  WHERE v.color_id = p_color_id AND v.is_active
               ) AS on_sale
      ) s
     WHERE c.id = p_color_id
       AND c.is_active IS DISTINCT FROM s.on_sale;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_variant_rollups(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_variant_rollups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A rename, a SKU or an ordering change moves nothing derived.
  IF TG_OP = 'UPDATE'
     AND NEW.product_id = OLD.product_id
     AND NEW.stock_qty IS NOT DISTINCT FROM OLD.stock_qty
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
     AND NEW.price     IS NOT DISTINCT FROM OLD.price
     AND NEW.color_id  IS NOT DISTINCT FROM OLD.color_id THEN
    RETURN NULL;
  END IF;

  -- Bulk writers (admin_save_product_variants, imports) refresh once at the
  -- end instead of once per row.
  IF current_setting('app.defer_rollups', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    PERFORM public.refresh_variant_rollups(OLD.product_id, OLD.color_id);
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE'
         AND (NEW.product_id IS DISTINCT FROM OLD.product_id
              OR NEW.color_id IS DISTINCT FROM OLD.color_id)) THEN
    PERFORM public.refresh_variant_rollups(NEW.product_id, NEW.color_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_touch_stock ON public.product_variants;
DROP TRIGGER IF EXISTS product_variants_touch_rollups ON public.product_variants;
CREATE TRIGGER product_variants_touch_rollups
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_variant_rollups();

DROP FUNCTION IF EXISTS public.touch_sized_product_stock();

-- Everything derived about one product, recomputed in one go.
CREATE OR REPLACE FUNCTION public.refresh_product_rollups(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products SET stock_quantity = stock_quantity WHERE id = p_product_id;

  UPDATE public.product_colors c
     SET is_active = EXISTS (
           SELECT 1 FROM public.product_variants v
            WHERE v.color_id = c.id AND v.is_active
         )
   WHERE c.product_id = p_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_product_rollups(UUID) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 9. ADMIN WRITE PATH — sizes, colours, prices, costs, stock
-- ============================================================
-- p_config:
--   has_sizes, size_label, has_colors, color_label
--   colors   [{ key, id?, name, swatch? }]            ordered; has_colors only
--   variants [{ id?, color_key?, size?, sku?, price?, cost?, is_active?,
--               stock_qty?, expected_stock_qty? }]    ordered; sizes/colours only
--            A key that is absent leaves that field as it is on an existing
--            row; a key present with null clears it (price/cost: back to the
--            product price / no cost).
--            stock_qty absent: stock left exactly as it is.
--            expected_stock_qty: the figure the editor showed; if it moved
--            (an order came in), nothing is saved.
--   stock_quantity, expected_stock     neither sizes nor colours
--   reason ('manual' | 'import'), note  for the inventory log
--
-- The lists are COMPLETE: a variant or colour left out is removed — unless an
-- order line references it, in which case it is switched off and kept, so
-- order history and refunds keep their row.
--
-- Errors meant for the admin UI carry a HINT:
--   stock_conflict — DETAIL is the variant id ('' for a product without variants)
--   sku_taken      — DETAIL is the SKU

CREATE OR REPLACE FUNCTION public.admin_save_product_variants(
  p_product_id UUID,
  p_config     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prod           public.products;
  cur            public.product_variants;
  elem           JSONB;
  v_has_sizes    BOOLEAN;
  v_has_colors   BOOLEAN;
  v_size_label   TEXT;
  v_color_label  TEXT;
  v_colors       JSONB;
  v_variants     JSONB;
  v_reason       TEXT;
  v_key          TEXT;
  v_name         TEXT;
  v_swatch       TEXT;
  v_color_id     UUID;
  v_id           UUID;
  v_size         TEXT;
  v_sku          TEXT;
  v_price        NUMERIC;
  v_cost         NUMERIC;
  v_stock        INTEGER;
  v_expected     INTEGER;
  v_active       BOOLEAN;
  v_position     BIGINT;
  v_combo        TEXT;
  v_label        TEXT;
  color_map      JSONB  := '{}'::JSONB;   -- key → colour id
  color_names    JSONB  := '{}'::JSONB;   -- key → name, for messages
  listed_colors  UUID[] := '{}';
  kept_colors    UUID[] := '{}';
  kept_ids       UUID[] := '{}';
  seen_keys      TEXT[] := '{}';
  seen_names     TEXT[] := '{}';
  seen_combos    TEXT[] := '{}';
  seen_skus      TEXT[] := '{}';
  n_deleted      INTEGER := 0;
  n_archived     INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'p_config must be a JSON object.' USING ERRCODE = '22023';
  END IF;

  v_has_sizes   := COALESCE((p_config->>'has_sizes')::BOOLEAN, FALSE);
  v_has_colors  := COALESCE((p_config->>'has_colors')::BOOLEAN, FALSE);
  v_size_label  := NULLIF(p_config->>'size_label', '');
  v_color_label := NULLIF(p_config->>'color_label', '');
  v_colors      := COALESCE(p_config->'colors', '[]'::JSONB);
  v_variants    := COALESCE(p_config->'variants', '[]'::JSONB);
  v_reason      := COALESCE(NULLIF(p_config->>'reason', ''), 'manual');

  IF v_size_label IS NOT NULL
     AND v_size_label NOT IN ('size', 'measure', 'length', 'shoe_size', 'ring_size', 'waist') THEN
    RAISE EXCEPTION 'Unknown size label "%".', v_size_label USING ERRCODE = '22023';
  END IF;
  IF v_color_label IS NOT NULL
     AND v_color_label NOT IN ('color', 'material', 'finish', 'pattern', 'style', 'scent', 'variant') THEN
    RAISE EXCEPTION 'Unknown colour label "%".', v_color_label USING ERRCODE = '22023';
  END IF;
  IF v_reason NOT IN ('manual', 'import') THEN
    RAISE EXCEPTION 'Unknown reason "%".', v_reason USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_colors) <> 'array' OR jsonb_typeof(v_variants) <> 'array' THEN
    RAISE EXCEPTION 'colors and variants must be JSON arrays.' USING ERRCODE = '22023';
  END IF;

  -- The product row is the lock every stock writer takes first.
  SELECT * INTO prod FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = '22023';
  END IF;

  -- ── 1. Validate everything before writing anything ───────────────────
  IF v_has_colors THEN
    IF jsonb_array_length(v_colors) = 0 THEN
      RAISE EXCEPTION 'A product sold by colour needs at least one colour.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(v_colors) > 50 THEN
      RAISE EXCEPTION 'Too many colours (max 50).' USING ERRCODE = '22023';
    END IF;

    FOR elem IN SELECT value FROM jsonb_array_elements(v_colors) LOOP
      v_key  := NULLIF(elem->>'key', '');
      v_name := public.normalize_label(elem->>'name');
      v_swatch := NULLIF(btrim(COALESCE(elem->>'swatch', '')), '');

      IF v_key IS NULL OR v_key = ANY (seen_keys) THEN
        RAISE EXCEPTION 'Every colour needs a unique key.' USING ERRCODE = '22023';
      END IF;
      seen_keys := seen_keys || v_key;

      IF v_name IS NULL OR length(v_name) > 40 THEN
        RAISE EXCEPTION 'Every colour needs a name of 1 to 40 characters.' USING ERRCODE = '22023';
      END IF;
      IF lower(v_name) = ANY (seen_names) THEN
        RAISE EXCEPTION 'Colour "%" is listed twice.', v_name USING ERRCODE = '22023';
      END IF;
      seen_names := seen_names || lower(v_name);
      color_names := color_names || jsonb_build_object(v_key, v_name);

      IF v_swatch IS NOT NULL AND v_swatch !~ '^#[0-9A-Fa-f]{6}$' THEN
        RAISE EXCEPTION 'Swatch for "%" must look like #RRGGBB.', v_name USING ERRCODE = '22023';
      END IF;

      IF elem->>'id' IS NOT NULL THEN
        v_color_id := (elem->>'id')::UUID;
        IF NOT EXISTS (
          SELECT 1 FROM public.product_colors
           WHERE id = v_color_id AND product_id = p_product_id
        ) THEN
          RAISE EXCEPTION 'Colour "%" does not belong to this product.', v_name USING ERRCODE = '22023';
        END IF;
        listed_colors := listed_colors || v_color_id;
      END IF;
    END LOOP;
  END IF;

  IF v_has_sizes OR v_has_colors THEN
    IF jsonb_array_length(v_variants) = 0 THEN
      RAISE EXCEPTION 'A product with sizes or colours needs at least one variant.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(v_variants) > 1000 THEN
      RAISE EXCEPTION 'Too many variants (max 1000).' USING ERRCODE = '22023';
    END IF;

    FOR elem IN SELECT value FROM jsonb_array_elements(v_variants) LOOP
      v_size := public.normalize_label(elem->>'size');
      v_key  := NULLIF(elem->>'color_key', '');

      IF v_has_sizes AND v_size IS NULL THEN
        RAISE EXCEPTION 'Every variant needs a size.' USING ERRCODE = '22023';
      END IF;
      IF NOT v_has_sizes AND v_size IS NOT NULL THEN
        RAISE EXCEPTION 'Size "%" given for a product not sold by size.', v_size USING ERRCODE = '22023';
      END IF;
      IF v_size IS NOT NULL AND length(v_size) > 40 THEN
        RAISE EXCEPTION 'A size name can be at most 40 characters.' USING ERRCODE = '22023';
      END IF;
      IF v_has_colors AND (v_key IS NULL OR NOT (v_key = ANY (seen_keys))) THEN
        RAISE EXCEPTION 'Every variant needs one of the listed colours.' USING ERRCODE = '22023';
      END IF;
      IF NOT v_has_colors AND v_key IS NOT NULL THEN
        RAISE EXCEPTION 'A colour was given for a product not sold by colour.' USING ERRCODE = '22023';
      END IF;

      v_label := concat_ws(' / ', color_names->>v_key, v_size);
      v_combo := COALESCE(v_key, '') || '|' || lower(COALESCE(v_size, ''));
      IF v_combo = ANY (seen_combos) THEN
        RAISE EXCEPTION 'Variant "%" is listed twice.', v_label USING ERRCODE = '22023';
      END IF;
      seen_combos := seen_combos || v_combo;

      IF elem ? 'sku' THEN
        v_sku := NULLIF(btrim(COALESCE(elem->>'sku', '')), '');
        IF v_sku IS NOT NULL THEN
          IF length(v_sku) > 64 THEN
            RAISE EXCEPTION 'SKU "%" is longer than 64 characters.', v_sku USING ERRCODE = '22023';
          END IF;
          IF upper(v_sku) = ANY (seen_skus) THEN
            RAISE EXCEPTION 'SKU "%" is used by two variants.', v_sku USING ERRCODE = '22023';
          END IF;
          seen_skus := seen_skus || upper(v_sku);
          IF EXISTS (
            SELECT 1 FROM public.product_variants
             WHERE upper(sku) = upper(v_sku) AND product_id <> p_product_id
          ) THEN
            RAISE EXCEPTION 'SKU "%" is already used by another product.', v_sku
              USING ERRCODE = '23505', HINT = 'sku_taken', DETAIL = v_sku;
          END IF;
        END IF;
      END IF;

      IF elem ? 'price' AND jsonb_typeof(elem->'price') <> 'null'
         AND ((elem->>'price')::NUMERIC < 0 OR (elem->>'price')::NUMERIC > 99999999) THEN
        RAISE EXCEPTION 'Price for "%" must be 0 or more.', v_label USING ERRCODE = '22023';
      END IF;
      IF elem ? 'cost' AND jsonb_typeof(elem->'cost') <> 'null'
         AND ((elem->>'cost')::NUMERIC < 0 OR (elem->>'cost')::NUMERIC > 99999999) THEN
        RAISE EXCEPTION 'Cost for "%" must be 0 or more.', v_label USING ERRCODE = '22023';
      END IF;
      IF (elem->>'stock_qty')::INTEGER < 0 OR (elem->>'stock_qty')::INTEGER > 1000000 THEN
        RAISE EXCEPTION 'Stock for "%" must be between 0 and 1,000,000.', v_label USING ERRCODE = '22023';
      END IF;

      IF elem->>'id' IS NOT NULL THEN
        v_id := (elem->>'id')::UUID;
        IF NOT EXISTS (
          SELECT 1 FROM public.product_variants
           WHERE id = v_id AND product_id = p_product_id
        ) THEN
          RAISE EXCEPTION 'Variant "%" does not belong to this product.', v_label USING ERRCODE = '22023';
        END IF;
        IF v_id = ANY (kept_ids) THEN
          RAISE EXCEPTION 'Variant "%" is listed twice.', v_label USING ERRCODE = '22023';
        END IF;
        kept_ids := kept_ids || v_id;
      END IF;
    END LOOP;
  ELSIF (p_config->>'stock_quantity')::INTEGER < 0
        OR (p_config->>'stock_quantity')::INTEGER > 1000000 THEN
    RAISE EXCEPTION 'Stock must be between 0 and 1,000,000.' USING ERRCODE = '22023';
  END IF;

  -- Every stock write below is labelled for the inventory log, and the
  -- per-row rollup refresh is deferred to one refresh at the end.
  PERFORM public.set_stock_context(v_reason, NULL, p_config->>'note');
  PERFORM set_config('app.defer_rollups', 'on', true);

  -- ── 2. Variants no longer listed: delete, or switch off if they sold ──
  -- First, so a name or SKU they held is free for the rows written below.
  FOR cur IN
    SELECT * FROM public.product_variants
     WHERE product_id = p_product_id
       AND NOT (id = ANY (kept_ids))
     ORDER BY id
       FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.order_items oi
       WHERE oi.variant_id = cur.id
          OR (oi.variant_id IS NULL
              AND cur.color_id IS NULL
              AND oi.product_id = cur.product_id
              AND oi.selected_size = cur.size)
    ) THEN
      IF cur.is_active THEN
        UPDATE public.product_variants SET is_active = FALSE WHERE id = cur.id;
        n_archived := n_archived + 1;
      END IF;
    ELSE
      DELETE FROM public.product_variants WHERE id = cur.id;
      n_deleted := n_deleted + 1;
    END IF;
  END LOOP;

  -- Colours no longer listed go too, unless a kept variant still names them.
  DELETE FROM public.product_colors pc
   WHERE pc.product_id = p_product_id
     AND NOT (pc.id = ANY (listed_colors))
     AND NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.color_id = pc.id);

  -- ── 3. Colours: write the list, in the order given ───────────────────
  IF v_has_colors THEN
    -- (product, lower(name)) is unique: swapping two names, or renaming Red
    -- to Blue while another row still says Blue, would collide halfway
    -- through. Park every renamed colour on a placeholder first.
    UPDATE public.product_colors pc
       SET name = '~' || pc.id::TEXT
      FROM jsonb_array_elements(v_colors) AS e(value)
     WHERE e.value->>'id' IS NOT NULL
       AND pc.id = (e.value->>'id')::UUID
       AND pc.name <> public.normalize_label(e.value->>'name');

    FOR elem, v_position IN
      SELECT e.value, e.ord
        FROM jsonb_array_elements(v_colors) WITH ORDINALITY AS e(value, ord)
       ORDER BY e.ord
    LOOP
      v_key      := elem->>'key';
      v_name     := public.normalize_label(elem->>'name');
      v_swatch   := NULLIF(btrim(COALESCE(elem->>'swatch', '')), '');
      v_color_id := (elem->>'id')::UUID;

      IF v_color_id IS NULL THEN
        -- Listed again after being kept for its orders: reuse it.
        SELECT id INTO v_color_id
          FROM public.product_colors
         WHERE product_id = p_product_id
           AND lower(name) = lower(v_name)
           AND NOT (id = ANY (listed_colors))
         LIMIT 1;
      ELSIF EXISTS (
        SELECT 1 FROM public.product_colors
         WHERE product_id = p_product_id
           AND lower(name) = lower(v_name)
           AND id <> v_color_id
           AND NOT (id = ANY (listed_colors))
      ) THEN
        RAISE EXCEPTION 'Colour "%" already exists, kept because it has orders. Switch that one back on instead of renaming another colour to it.', v_name
          USING ERRCODE = '22023';
      END IF;

      IF v_color_id IS NULL THEN
        INSERT INTO public.product_colors (product_id, name, swatch, sort_order)
        VALUES (p_product_id, v_name, v_swatch, v_position)
        RETURNING id INTO v_color_id;
      ELSE
        UPDATE public.product_colors
           SET name = v_name, swatch = v_swatch, sort_order = v_position
         WHERE id = v_color_id;
      END IF;

      color_map := color_map || jsonb_build_object(v_key, v_color_id);
      kept_colors := kept_colors || v_color_id;
    END LOOP;
  END IF;

  -- ── 4. Listed variants, in the order given ───────────────────────────
  IF v_has_sizes OR v_has_colors THEN
    -- Same parking as for colours: (product, colour, size) is unique, and so
    -- is a SKU — two variants swapping SKUs would collide halfway through.
    UPDATE public.product_variants pv
       SET size = '~' || pv.id::TEXT
      FROM jsonb_array_elements(v_variants) AS e(value)
     WHERE e.value->>'id' IS NOT NULL
       AND pv.id = (e.value->>'id')::UUID
       AND (pv.size IS DISTINCT FROM public.normalize_label(e.value->>'size')
            OR pv.color_id IS DISTINCT FROM (color_map->>(e.value->>'color_key'))::UUID);

    UPDATE public.product_variants pv
       SET sku = NULL
      FROM jsonb_array_elements(v_variants) AS e(value)
     WHERE e.value->>'id' IS NOT NULL
       AND pv.id = (e.value->>'id')::UUID
       AND e.value ? 'sku'
       AND pv.sku IS DISTINCT FROM NULLIF(btrim(COALESCE(e.value->>'sku', '')), '');

    FOR elem, v_position IN
      SELECT e.value, e.ord
        FROM jsonb_array_elements(v_variants) WITH ORDINALITY AS e(value, ord)
       ORDER BY e.ord
    LOOP
      v_size     := public.normalize_label(elem->>'size');
      v_color_id := (color_map->>(elem->>'color_key'))::UUID;
      v_label    := concat_ws(' / ', color_names->>(elem->>'color_key'), v_size);
      v_stock    := (elem->>'stock_qty')::INTEGER;            -- NULL: leave as is
      v_expected := (elem->>'expected_stock_qty')::INTEGER;   -- NULL: no check
      v_id       := (elem->>'id')::UUID;

      IF v_id IS NULL THEN
        -- Listed again after being switched off for having orders: reuse it.
        SELECT id INTO v_id
          FROM public.product_variants
         WHERE product_id = p_product_id
           AND color_id IS NOT DISTINCT FROM v_color_id
           AND lower(size) IS NOT DISTINCT FROM lower(v_size)
           AND NOT (id = ANY (kept_ids))
         LIMIT 1;
      ELSIF EXISTS (
        SELECT 1 FROM public.product_variants
         WHERE product_id = p_product_id
           AND color_id IS NOT DISTINCT FROM v_color_id
           AND lower(size) IS NOT DISTINCT FROM lower(v_size)
           AND id <> v_id
           AND NOT (id = ANY (kept_ids))
      ) THEN
        RAISE EXCEPTION 'Variant "%" already exists, switched off because it has orders. Switch that one back on instead of renaming another variant to it.', v_label
          USING ERRCODE = '22023';
      END IF;

      -- Every listed variant that changes SKU was parked above and other
      -- products were checked in step 1, so whoever still holds this SKU is
      -- a variant of this product kept only for its orders.
      v_sku := NULLIF(btrim(COALESCE(elem->>'sku', '')), '');
      IF elem ? 'sku' AND v_sku IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.product_variants
         WHERE sku = v_sku
           AND id IS DISTINCT FROM v_id
      ) THEN
        RAISE EXCEPTION 'SKU "%" belongs to a switched-off variant of this product. Switch that one back on, or clear its SKU first.', v_sku
          USING ERRCODE = '23505', HINT = 'sku_taken', DETAIL = v_sku;
      END IF;

      IF v_id IS NULL THEN
        INSERT INTO public.product_variants
          (product_id, color_id, size, sku, price, stock_qty, sort_order, is_active)
        VALUES (
          p_product_id,
          v_color_id,
          v_size,
          NULLIF(btrim(COALESCE(elem->>'sku', '')), ''),
          round((elem->>'price')::NUMERIC, 2),
          COALESCE(v_stock, 0),
          v_position,
          COALESCE((elem->>'is_active')::BOOLEAN, TRUE)
        )
        RETURNING id INTO v_id;
      ELSE
        SELECT * INTO cur FROM public.product_variants WHERE id = v_id FOR UPDATE;

        IF v_stock IS NOT NULL AND v_expected IS NOT NULL AND cur.stock_qty <> v_expected THEN
          RAISE EXCEPTION 'Stock for % changed from % to % while it was being edited.',
            v_label, v_expected, cur.stock_qty
            USING HINT = 'stock_conflict', DETAIL = v_id::TEXT;
        END IF;

        UPDATE public.product_variants
           SET color_id   = v_color_id,
               size       = v_size,
               sku        = CASE WHEN elem ? 'sku'
                                 THEN NULLIF(btrim(COALESCE(elem->>'sku', '')), '')
                                 ELSE sku END,
               price      = CASE WHEN elem ? 'price'
                                 THEN round((elem->>'price')::NUMERIC, 2)
                                 ELSE price END,
               -- A variant listed without an id is new to the editor, even
               -- when an old row switched off for its orders is reused for it.
               is_active  = CASE WHEN elem ? 'is_active' THEN (elem->>'is_active')::BOOLEAN
                                 WHEN elem->>'id' IS NULL THEN TRUE
                                 ELSE is_active END,
               sort_order = v_position,
               stock_qty  = COALESCE(v_stock, stock_qty)
         WHERE id = v_id;
      END IF;

      kept_ids := kept_ids || v_id;

      IF elem ? 'cost' THEN
        v_cost := round((elem->>'cost')::NUMERIC, 2);
        IF v_cost IS NULL THEN
          DELETE FROM public.product_variant_costs WHERE variant_id = v_id;
        ELSE
          INSERT INTO public.product_variant_costs (variant_id, cost_price)
          VALUES (v_id, v_cost)
          ON CONFLICT (variant_id)
            DO UPDATE SET cost_price = EXCLUDED.cost_price, updated_at = NOW();
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ── 5. The product row ────────────────────────────────────────────────
  PERFORM set_config('app.defer_rollups', 'off', true);

  IF v_has_sizes OR v_has_colors THEN
    -- products_sync_rollups derives stock and the price range.
    UPDATE public.products
       SET has_sizes   = v_has_sizes,
           has_colors  = v_has_colors,
           size_label  = COALESCE(v_size_label, size_label),
           color_label = COALESCE(v_color_label, color_label)
     WHERE id = p_product_id
    RETURNING * INTO prod;
  ELSE
    IF p_config->>'stock_quantity' IS NOT NULL
       AND p_config->>'expected_stock' IS NOT NULL
       AND NOT (prod.has_sizes OR prod.has_colors)
       AND prod.stock_quantity <> (p_config->>'expected_stock')::INTEGER THEN
      RAISE EXCEPTION 'Stock changed from % to % while it was being edited.',
        p_config->>'expected_stock', prod.stock_quantity
        USING HINT = 'stock_conflict', DETAIL = '';
    END IF;

    UPDATE public.products
       SET has_sizes      = FALSE,
           has_colors     = FALSE,
           size_label     = COALESCE(v_size_label, size_label),
           color_label    = COALESCE(v_color_label, color_label),
           stock_quantity = COALESCE((p_config->>'stock_quantity')::INTEGER, stock_quantity)
     WHERE id = p_product_id
    RETURNING * INTO prod;
  END IF;

  UPDATE public.product_colors c
     SET is_active = EXISTS (
           SELECT 1 FROM public.product_variants v
            WHERE v.color_id = c.id AND v.is_active
         )
   WHERE c.product_id = p_product_id;

  PERFORM public.set_stock_context(NULL);

  RETURN jsonb_build_object(
    'product_id',     prod.id,
    'has_sizes',      prod.has_sizes,
    'size_label',     prod.size_label,
    'has_colors',     prod.has_colors,
    'color_label',    prod.color_label,
    'stock_quantity', prod.stock_quantity,
    'price_min',      prod.price_min,
    'price_max',      prod.price_max,
    'deleted',        n_deleted,
    'archived',       n_archived,
    'color_ids',      color_map,
    'colors',         COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort_order, c.name)
        FROM public.product_colors c
       WHERE c.product_id = prod.id
    ), '[]'::JSONB),
    'variants',       COALESCE((
      SELECT jsonb_agg(
               to_jsonb(v) || jsonb_build_object('cost_price', vc.cost_price)
               ORDER BY v.sort_order, v.size
             )
        FROM public.product_variants v
        LEFT JOIN public.product_variant_costs vc ON vc.variant_id = v.id
       WHERE v.product_id = prod.id
    ), '[]'::JSONB)
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_save_product_variants(UUID, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_save_product_variants(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.admin_save_product_variants(UUID, JSONB) IS
  'Admin only. Atomically replaces a product''s colours and variants (or switches it to a single stock figure), with optimistic stock checks. Migration 022.';

-- 021's entry point, kept for an admin app built before colours existed. It
-- refuses a product with colours: saving its size-only list would remove them.
CREATE OR REPLACE FUNCTION public.admin_set_product_inventory(
  p_product_id     UUID,
  p_has_sizes      BOOLEAN,
  p_size_label     TEXT    DEFAULT NULL,
  p_variants       JSONB   DEFAULT '[]'::JSONB,
  p_stock_quantity INTEGER DEFAULT NULL,
  p_expected_stock INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_has_sizes IS NULL THEN
    RAISE EXCEPTION 'p_has_sizes is required.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND has_colors) THEN
    RAISE EXCEPTION 'This product is sold by colour. Reload the admin page to edit it.'
      USING ERRCODE = '22023';
  END IF;

  -- Null values are fine here: the new function reads an absent and a null
  -- top-level key alike. (jsonb_strip_nulls would also strip a "sku": null
  -- inside the list, and a cleared SKU would then be kept.)
  RETURN public.admin_save_product_variants(
    p_product_id,
    jsonb_build_object(
      'has_sizes',      p_has_sizes,
      'size_label',     p_size_label,
      'has_colors',     FALSE,
      'variants',       CASE WHEN p_has_sizes THEN COALESCE(p_variants, '[]'::JSONB) ELSE '[]'::JSONB END,
      'stock_quantity', p_stock_quantity,
      'expected_stock', p_expected_stock
    )
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_set_product_inventory(UUID, BOOLEAN, TEXT, JSONB, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_product_inventory(UUID, BOOLEAN, TEXT, JSONB, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.admin_set_product_inventory(UUID, BOOLEAN, TEXT, JSONB, INTEGER, INTEGER) IS
  'Admin only. Size-only predecessor of admin_save_product_variants (021); refuses products sold by colour.';

-- ============================================================
-- 10. QUICK RESTOCK — variants and single-stock products
-- ============================================================
-- p_changes [{ id, stock_qty, expected_stock_qty? }]; p_note goes to the log.

DROP FUNCTION IF EXISTS public.admin_set_variant_stock(JSONB);

CREATE OR REPLACE FUNCTION public.admin_set_variant_stock(
  p_changes JSONB,
  p_note    TEXT DEFAULT NULL
)
RETURNS SETOF public.product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem       JSONB;
  cur        public.product_variants;
  v_stock    INTEGER;
  v_expected INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_changes IS NULL
     OR jsonb_typeof(p_changes) <> 'array'
     OR jsonb_array_length(p_changes) = 0 THEN
    RAISE EXCEPTION 'p_changes must be a non-empty JSON array.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_changes) > 500 THEN
    RAISE EXCEPTION 'Too many changes (max 500).' USING ERRCODE = '22023';
  END IF;

  -- Same lock order as every other stock writer: products first, by id.
  PERFORM 1
     FROM public.products
    WHERE id IN (
            SELECT pv.product_id
              FROM public.product_variants pv
             WHERE pv.id IN (
                     SELECT (e.value->>'id')::UUID
                       FROM jsonb_array_elements(p_changes) AS e(value)
                   )
          )
    ORDER BY id
      FOR UPDATE;

  PERFORM public.set_stock_context('manual', NULL, p_note);

  FOR elem IN
    SELECT e.value
      FROM jsonb_array_elements(p_changes) AS e(value)
     ORDER BY e.value->>'id'
  LOOP
    v_stock    := (elem->>'stock_qty')::INTEGER;
    v_expected := (elem->>'expected_stock_qty')::INTEGER;

    IF v_stock IS NULL OR v_stock < 0 OR v_stock > 1000000 THEN
      RAISE EXCEPTION 'Stock must be a whole number from 0 to 1,000,000.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO cur
      FROM public.product_variants
     WHERE id = (elem->>'id')::UUID
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found.' USING ERRCODE = '22023';
    END IF;

    IF v_expected IS NOT NULL AND cur.stock_qty <> v_expected THEN
      RAISE EXCEPTION 'Stock for % changed from % to % while it was being edited.',
        COALESCE(cur.size, 'this variant'), v_expected, cur.stock_qty
        USING HINT = 'stock_conflict', DETAIL = cur.id::TEXT;
    END IF;

    UPDATE public.product_variants
       SET stock_qty = v_stock
     WHERE id = cur.id
    RETURNING * INTO cur;

    RETURN NEXT cur;
  END LOOP;

  PERFORM public.set_stock_context(NULL);
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_set_variant_stock(JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_variant_stock(JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_set_variant_stock(JSONB, TEXT) IS
  'Admin only. Sets the stock of the given variants, with optimistic checks. Migrations 021/022.';

CREATE OR REPLACE FUNCTION public.admin_set_product_stock(
  p_product_id UUID,
  p_stock      INTEGER,
  p_expected   INTEGER DEFAULT NULL,
  p_note       TEXT    DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prod public.products;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_stock IS NULL OR p_stock < 0 OR p_stock > 1000000 THEN
    RAISE EXCEPTION 'Stock must be a whole number from 0 to 1,000,000.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO prod FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = '22023';
  END IF;
  IF prod.has_sizes OR prod.has_colors THEN
    RAISE EXCEPTION 'This product keeps stock per variant.' USING ERRCODE = '22023';
  END IF;
  IF p_expected IS NOT NULL AND prod.stock_quantity <> p_expected THEN
    RAISE EXCEPTION 'Stock changed from % to % while it was being edited.', p_expected, prod.stock_quantity
      USING HINT = 'stock_conflict', DETAIL = '';
  END IF;

  PERFORM public.set_stock_context('manual', NULL, p_note);
  UPDATE public.products SET stock_quantity = p_stock WHERE id = p_product_id
  RETURNING * INTO prod;
  PERFORM public.set_stock_context(NULL);

  RETURN prod.stock_quantity;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_set_product_stock(UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_product_stock(UUID, INTEGER, INTEGER, TEXT) TO authenticated;

-- ============================================================
-- 11. COSTS FOR THE ADMIN
-- ============================================================
-- products.cost_price cannot be selected through the API at all (016), not
-- even by an admin: column grants are per role, and admins are
-- 'authenticated' like everyone else. This hands them over instead.

CREATE OR REPLACE FUNCTION public.admin_catalog_costs()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'products', COALESCE((
      SELECT jsonb_object_agg(id, cost_price) FROM public.products WHERE cost_price IS NOT NULL
    ), '{}'::JSONB),
    'variants', COALESCE((
      SELECT jsonb_object_agg(variant_id, cost_price) FROM public.product_variant_costs
    ), '{}'::JSONB)
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_catalog_costs() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_catalog_costs() TO authenticated;

-- ============================================================
-- 12. DUPLICATE A PRODUCT
-- ============================================================
-- The copy is hidden, has no SKUs (they are unique) and no stock; colours,
-- variants on sale, prices, costs and photos come along.

CREATE OR REPLACE FUNCTION public.admin_duplicate_product(
  p_product_id UUID,
  p_name       TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src         public.products;
  new_id      UUID;
  v_base      TEXT;
  v_slug      TEXT;
  n           INTEGER := 1;
  color_map   JSONB := '{}'::JSONB;
  r           RECORD;
  new_color   UUID;
  new_variant UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO src FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = '22023';
  END IF;

  v_base := left(src.slug, 70) || '-copy';
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.products WHERE slug = v_slug) LOOP
    n := n + 1;
    v_slug := v_base || '-' || n;
  END LOOP;

  PERFORM set_config('app.defer_rollups', 'on', true);

  INSERT INTO public.products (
    category_id, name, slug, description, price, compare_at_price, cost_price,
    sku, stock_quantity, low_stock_threshold, weight_grams, is_active, is_featured,
    has_sizes, size_label, has_colors, color_label, size_guide_id, metadata
  )
  VALUES (
    src.category_id,
    COALESCE(left(public.normalize_label(p_name), 200), left(src.name || ' (copy)', 200)),
    v_slug, src.description, src.price, src.compare_at_price, src.cost_price,
    NULL, 0, src.low_stock_threshold, src.weight_grams, FALSE, FALSE,
    src.has_sizes, src.size_label, src.has_colors, src.color_label, src.size_guide_id, src.metadata
  )
  RETURNING id INTO new_id;

  FOR r IN
    SELECT * FROM public.product_colors WHERE product_id = src.id ORDER BY sort_order, name
  LOOP
    INSERT INTO public.product_colors (product_id, name, swatch, sort_order, is_active)
    VALUES (new_id, r.name, r.swatch, r.sort_order, r.is_active)
    RETURNING id INTO new_color;
    color_map := color_map || jsonb_build_object(r.id::TEXT, new_color);
  END LOOP;

  FOR r IN
    SELECT v.*, vc.cost_price AS variant_cost
      FROM public.product_variants v
      LEFT JOIN public.product_variant_costs vc ON vc.variant_id = v.id
     WHERE v.product_id = src.id
       AND v.is_active
     ORDER BY v.sort_order, v.size
  LOOP
    INSERT INTO public.product_variants
      (product_id, color_id, size, sku, price, stock_qty, sort_order, is_active)
    VALUES (
      new_id, (color_map->>(r.color_id::TEXT))::UUID, r.size, NULL, r.price, 0, r.sort_order, TRUE
    )
    RETURNING id INTO new_variant;

    IF r.variant_cost IS NOT NULL THEN
      INSERT INTO public.product_variant_costs (variant_id, cost_price)
      VALUES (new_variant, r.variant_cost);
    END IF;
  END LOOP;

  INSERT INTO public.product_images (product_id, url, alt_text, sort_order, is_primary, color_id)
  SELECT new_id, i.url, i.alt_text, i.sort_order, i.is_primary, (color_map->>(i.color_id::TEXT))::UUID
    FROM public.product_images i
   WHERE i.product_id = src.id;

  -- Colours that only lived on in switched-off variants stay behind.
  DELETE FROM public.product_colors c
   WHERE c.product_id = new_id
     AND NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.color_id = c.id);

  PERFORM set_config('app.defer_rollups', 'off', true);
  PERFORM public.refresh_product_rollups(new_id);

  RETURN new_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_duplicate_product(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_duplicate_product(UUID, TEXT) TO authenticated;

-- ============================================================
-- 13. CSV IMPORT
-- ============================================================
-- The browser parses the file and sends one object per product (handle =
-- slug):
--   { slug, name?, description?, category?, price?, compare_at_price?,
--     cost_price?, sku?, is_active?, is_featured?, weight_grams?,
--     low_stock_threshold?, has_sizes, size_label?, has_colors, color_label?,
--     stock_quantity?, colors: [{ name, swatch? }],
--     variants: [{ color?, size?, sku?, price?, cost?, is_active?, stock_qty? }],
--     images: [url…] }
-- A key that is absent leaves that field alone on an existing product. For a
-- product in the file, the variant list is complete (as in the editor).
-- Products not in the file are not touched. All or nothing: one bad row and
-- nothing is imported; the error names the row.

CREATE OR REPLACE FUNCTION public.admin_import_products(
  p_products JSONB,
  p_options  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem          JSONB;
  idx           BIGINT;
  c             JSONB;
  v             JSONB;
  v_slug        TEXT;
  v_name        TEXT;
  v_cat_key     TEXT;
  v_cat_slug    TEXT;
  v_cat_id      UUID;
  v_prod_id     UUID;
  v_exists      BOOLEAN;
  v_color_name  TEXT;
  v_size        TEXT;
  v_existing    UUID;
  v_has_sizes   BOOLEAN;
  v_has_colors  BOOLEAN;
  colors        JSONB;
  variants      JSONB;
  cfg           JSONB;
  img           TEXT;
  img_pos       INTEGER;
  has_primary   BOOLEAN;
  n_images      INTEGER;
  seen_slugs    TEXT[] := '{}';
  n_created     INTEGER := 0;
  n_updated     INTEGER := 0;
  results       JSONB := '[]'::JSONB;
  create_categories BOOLEAN := COALESCE((p_options->>'create_categories')::BOOLEAN, FALSE);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_products IS NULL OR jsonb_typeof(p_products) <> 'array' OR jsonb_array_length(p_products) = 0 THEN
    RAISE EXCEPTION 'Nothing to import.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_products) > 1000 THEN
    RAISE EXCEPTION 'Too many products in one import (max 1000).' USING ERRCODE = '22023';
  END IF;

  FOR elem, idx IN
    SELECT e.value, e.ord FROM jsonb_array_elements(p_products) WITH ORDINALITY AS e(value, ord)
  LOOP
    v_slug := lower(btrim(COALESCE(elem->>'slug', '')));
    BEGIN
      IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(v_slug) > 80 THEN
        RAISE EXCEPTION 'The handle must be lowercase letters, digits and dashes (max 80).' USING ERRCODE = '22023';
      END IF;
      IF v_slug = ANY (seen_slugs) THEN
        RAISE EXCEPTION 'This handle appears twice in the file.' USING ERRCODE = '22023';
      END IF;
      seen_slugs := seen_slugs || v_slug;

      SELECT id INTO v_prod_id FROM public.products WHERE slug = v_slug;
      v_exists := FOUND;

      -- Category: matched by slug or by name; created on request.
      v_cat_id  := NULL;
      v_cat_key := public.normalize_label(elem->>'category');
      IF v_cat_key IS NOT NULL THEN
        SELECT id INTO v_cat_id
          FROM public.categories
         WHERE lower(slug) = lower(v_cat_key) OR lower(name) = lower(v_cat_key)
         ORDER BY (lower(slug) = lower(v_cat_key)) DESC
         LIMIT 1;
        IF v_cat_id IS NULL THEN
          IF NOT create_categories THEN
            RAISE EXCEPTION 'Category "%" does not exist.', v_cat_key USING ERRCODE = '22023';
          END IF;
          v_cat_slug := btrim(regexp_replace(lower(v_cat_key), '[^a-z0-9]+', '-', 'g'), '-');
          IF v_cat_slug = '' THEN
            v_cat_slug := 'category-' || substr(md5(v_cat_key), 1, 8);
          END IF;
          INSERT INTO public.categories (name, slug)
          VALUES (left(v_cat_key, 100), left(v_cat_slug, 80))
          ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
          RETURNING id INTO v_cat_id;
        END IF;
      ELSIF NOT v_exists THEN
        RAISE EXCEPTION 'A new product needs a category.' USING ERRCODE = '22023';
      END IF;

      IF elem ? 'name' THEN
        v_name := public.normalize_label(elem->>'name');
        IF v_name IS NULL OR length(v_name) > 200 THEN
          RAISE EXCEPTION 'The name must be 1 to 200 characters.' USING ERRCODE = '22023';
        END IF;
      ELSIF NOT v_exists THEN
        RAISE EXCEPTION 'A new product needs a name.' USING ERRCODE = '22023';
      END IF;
      IF length(COALESCE(elem->>'description', '')) > 10000 THEN
        RAISE EXCEPTION 'The description is longer than 10,000 characters.' USING ERRCODE = '22023';
      END IF;
      IF NOT v_exists AND (elem->>'price') IS NULL THEN
        RAISE EXCEPTION 'A new product needs a price.' USING ERRCODE = '22023';
      END IF;

      IF v_exists THEN
        UPDATE public.products SET
          name                = CASE WHEN elem ? 'name' THEN v_name ELSE name END,
          description         = CASE WHEN elem ? 'description' THEN NULLIF(btrim(elem->>'description'), '') ELSE description END,
          category_id         = COALESCE(v_cat_id, category_id),
          price               = CASE WHEN elem ? 'price' AND (elem->>'price') IS NOT NULL THEN round((elem->>'price')::NUMERIC, 2) ELSE price END,
          compare_at_price    = CASE WHEN elem ? 'compare_at_price' THEN round((elem->>'compare_at_price')::NUMERIC, 2) ELSE compare_at_price END,
          cost_price          = CASE WHEN elem ? 'cost_price' THEN round((elem->>'cost_price')::NUMERIC, 2) ELSE cost_price END,
          sku                 = CASE WHEN elem ? 'sku' THEN NULLIF(btrim(elem->>'sku'), '') ELSE sku END,
          is_active           = COALESCE((elem->>'is_active')::BOOLEAN, is_active),
          is_featured         = COALESCE((elem->>'is_featured')::BOOLEAN, is_featured),
          weight_grams        = CASE WHEN elem ? 'weight_grams' THEN (elem->>'weight_grams')::INTEGER ELSE weight_grams END,
          low_stock_threshold = COALESCE((elem->>'low_stock_threshold')::INTEGER, low_stock_threshold)
        WHERE id = v_prod_id;
        n_updated := n_updated + 1;
      ELSE
        INSERT INTO public.products (
          category_id, name, slug, description, price, compare_at_price, cost_price, sku,
          stock_quantity, low_stock_threshold, weight_grams, is_active, is_featured
        )
        VALUES (
          v_cat_id, v_name, v_slug,
          NULLIF(btrim(COALESCE(elem->>'description', '')), ''),
          round((elem->>'price')::NUMERIC, 2),
          round((elem->>'compare_at_price')::NUMERIC, 2),
          round((elem->>'cost_price')::NUMERIC, 2),
          NULLIF(btrim(COALESCE(elem->>'sku', '')), ''),
          0,
          COALESCE((elem->>'low_stock_threshold')::INTEGER, 5),
          (elem->>'weight_grams')::INTEGER,
          COALESCE((elem->>'is_active')::BOOLEAN, TRUE),
          COALESCE((elem->>'is_featured')::BOOLEAN, FALSE)
        )
        RETURNING id INTO v_prod_id;
        n_created := n_created + 1;
      END IF;

      -- Variants: matched to existing rows by colour name and size.
      v_has_sizes  := COALESCE((elem->>'has_sizes')::BOOLEAN, FALSE);
      v_has_colors := COALESCE((elem->>'has_colors')::BOOLEAN, FALSE);
      colors   := '[]'::JSONB;
      variants := '[]'::JSONB;

      IF v_has_colors THEN
        FOR c IN SELECT value FROM jsonb_array_elements(COALESCE(elem->'colors', '[]'::JSONB)) LOOP
          v_color_name := public.normalize_label(c->>'name');
          SELECT id INTO v_existing
            FROM public.product_colors
           WHERE product_id = v_prod_id AND lower(name) = lower(v_color_name);
          IF NOT FOUND THEN
            v_existing := NULL;
          END IF;
          colors := colors || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
            'key',    lower(v_color_name),
            'id',     v_existing,
            'name',   v_color_name,
            'swatch', NULLIF(btrim(COALESCE(c->>'swatch', '')), '')
          )));
        END LOOP;
      END IF;

      IF v_has_sizes OR v_has_colors THEN
        FOR v IN SELECT value FROM jsonb_array_elements(COALESCE(elem->'variants', '[]'::JSONB)) LOOP
          v_size       := public.normalize_label(v->>'size');
          v_color_name := public.normalize_label(v->>'color');

          SELECT pv.id INTO v_existing
            FROM public.product_variants pv
            LEFT JOIN public.product_colors pc ON pc.id = pv.color_id
           WHERE pv.product_id = v_prod_id
             AND lower(pv.size) IS NOT DISTINCT FROM lower(v_size)
             AND lower(pc.name) IS NOT DISTINCT FROM lower(v_color_name)
           LIMIT 1;
          IF NOT FOUND THEN
            v_existing := NULL;
          END IF;

          variants := variants || jsonb_build_array(
            jsonb_strip_nulls(jsonb_build_object(
              'id',        v_existing,
              'size',      v_size,
              'color_key', lower(v_color_name)
            ))
            || (v - 'id' - 'size' - 'color' - 'color_key' - 'expected_stock_qty')
          );
        END LOOP;
      END IF;

      cfg := jsonb_build_object(
        'has_sizes',   v_has_sizes,
        'has_colors',  v_has_colors,
        'size_label',  elem->>'size_label',
        'color_label', elem->>'color_label',
        'colors',      colors,
        'variants',    variants,
        'reason',      'import'
      );
      IF NOT (v_has_sizes OR v_has_colors) AND (elem->>'stock_quantity') IS NOT NULL THEN
        cfg := cfg || jsonb_build_object('stock_quantity', (elem->>'stock_quantity')::INTEGER);
      END IF;

      PERFORM public.admin_save_product_variants(v_prod_id, cfg);

      -- Photos: added when not already on the product; https only.
      IF jsonb_typeof(COALESCE(elem->'images', '[]'::JSONB)) <> 'array'
         OR jsonb_array_length(COALESCE(elem->'images', '[]'::JSONB)) > 20 THEN
        RAISE EXCEPTION 'At most 20 image URLs per product.' USING ERRCODE = '22023';
      END IF;
      SELECT COALESCE(MAX(sort_order), -1) + 1, bool_or(is_primary), COUNT(*)
        INTO img_pos, has_primary, n_images
        FROM public.product_images
       WHERE product_id = v_prod_id;
      has_primary := COALESCE(has_primary, FALSE);

      FOR img IN SELECT btrim(value) FROM jsonb_array_elements_text(COALESCE(elem->'images', '[]'::JSONB)) AS t(value) LOOP
        CONTINUE WHEN img = '';
        IF img !~ '^https://[^\s]+$' OR length(img) > 2000 THEN
          RAISE EXCEPTION 'Image URLs must be https:// addresses.' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.product_images WHERE product_id = v_prod_id AND url = img) THEN
          INSERT INTO public.product_images (product_id, url, sort_order, is_primary)
          VALUES (v_prod_id, img, img_pos, NOT has_primary);
          has_primary := TRUE;
          img_pos := img_pos + 1;
        END IF;
      END LOOP;

      results := results || jsonb_build_array(jsonb_build_object(
        'slug', v_slug,
        'id', v_prod_id,
        'action', CASE WHEN v_exists THEN 'updated' ELSE 'created' END
      ));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Product % ("%"): %', idx, v_slug, SQLERRM
        USING ERRCODE = SQLSTATE, HINT = 'import_row', DETAIL = idx::TEXT;
    END;
  END LOOP;

  RETURN jsonb_build_object('created', n_created, 'updated', n_updated, 'products', results);
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_import_products(JSONB, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_import_products(JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION public.admin_import_products(JSONB, JSONB) IS
  'Admin only. Creates or updates products (matched by slug) with their variants, all or nothing. Migration 022.';

-- ============================================================
-- 14. EXISTING CATALOGUE — fill the derived figures
-- ============================================================

UPDATE public.products SET stock_quantity = stock_quantity;

NOTIFY pgrst, 'reload schema';
