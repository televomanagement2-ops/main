-- ============================================================
-- MIGRATION 021 — Sized products: per-size stock is the source of truth
-- Run after 020_stale_order_expiry_cron.sql
-- ============================================================
-- product_variants (004) has held one stock counter per size since the start,
-- but nothing kept it in step with products.stock_quantity: the order trigger
-- decremented BOTH, the admin could only edit the product total, and sizes
-- could only be managed in SQL. Two counters for one shelf drift apart, and
-- the storefront reads one while checkout validates the other.
--
-- 1. products.has_sizes / products.size_label. A sized product's stock is
--    DERIVED: the sum of the sellable stock of its sizes on sale, kept current
--    by triggers on both tables. An unsized product keeps its own counter,
--    exactly as before. size_label only picks the word the storefront shows
--    above the selector (Size, Measure, Length, Shoe size, Ring size, Waist).
-- 2. order_items.variant_id: each line points at the size row it sold, so a
--    refund restores the right row even after the size is renamed. The
--    selected_size text stays as the display snapshot. Historical lines are
--    linked by the size they recorded.
-- 3. manage_stock_on_status_change() rewritten. It moves the size's counter
--    for sized lines and the product's counter for unsized ones; it locks the
--    products involved in a fixed order first (two orders paid at the same
--    moment could deadlock); and it restores line by line — the old set-based
--    restore applied only ONE line per product, so refunding an order with
--    two sizes of the same item gave back only one of them.
-- 4. "products: admin update" no longer requires stock_quantity >= 0. That
--    check (002) predates the backorder policy (013) and made every edit of an
--    oversold product fail with an RLS error — hiding it, repricing it, anything.
-- 5. admin_set_product_inventory() / admin_set_variant_stock(): the admin's
--    write path for sizes and stock. Atomic, admin-only, and optimistic: a form
--    opened before an order came in cannot silently overwrite that order's
--    deduction.
--
-- Idempotent. If 013, 007 or 005 (which also define the stock trigger) is ever
-- run again, run this file again after it.
-- ============================================================

-- ============================================================
-- 1. PRODUCTS — has_sizes, size_label
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_sizes  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS size_label TEXT    NOT NULL DEFAULT 'size';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_size_label_check;

-- Mirrored by SIZE_LABELS in src/lib/sizes.ts, which maps each value to a
-- translated word. Add a value in both places, or the storefront falls back
-- to "Size".
ALTER TABLE public.products
  ADD CONSTRAINT products_size_label_check
    CHECK (size_label IN ('size', 'measure', 'length', 'shoe_size', 'ring_size', 'waist'));

COMMENT ON COLUMN public.products.has_sizes IS
  'TRUE: sold by size. stock_quantity is then derived from product_variants (sum of non-negative stock_qty over active sizes) and checkout requires a size. FALSE: stock_quantity is managed directly.';

COMMENT ON COLUMN public.products.size_label IS
  'Word shown above the size selector: size | measure | length | shoe_size | ring_size | waist.';

-- 016 replaced the table-wide SELECT grant with an explicit column list (to
-- keep cost_price private), so a new column stays invisible to the storefront
-- until it is granted here.
GRANT SELECT (has_sizes, size_label) ON public.products TO anon, authenticated;

-- ============================================================
-- 2. PRODUCT VARIANTS — label and SKU hygiene
-- ============================================================

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_size_format_check;

-- Size names are compared trimmed and case-insensitively by the admin RPC;
-- this keeps hand-written rows from carrying stray whitespace past it.
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_size_format_check CHECK (
    size = btrim(size)
    AND length(size) BETWEEN 1 AND 40
    AND length(COALESCE(sku, '')) <= 64
  ) NOT VALID;

-- A SKU names one shelf position. products.sku is already UNIQUE.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku
    ON public.product_variants (sku)
    WHERE sku IS NOT NULL;
EXCEPTION WHEN unique_violation THEN
  RAISE WARNING
    'Two sizes share a SKU, so size SKUs are not unique-indexed yet. Find them with: SELECT sku, count(*) FROM public.product_variants WHERE sku IS NOT NULL GROUP BY sku HAVING count(*) > 1; then run this migration again.';
END
$$;

-- ============================================================
-- 3. ORDER ITEMS — the size row each line sold
-- ============================================================
-- RESTRICT: a size that appears on an order is history and must not vanish.
-- admin_set_product_inventory() switches such a size off instead of deleting
-- it, so this only ever stops a hand-written DELETE.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID
    REFERENCES public.product_variants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_order_items_variant
  ON public.order_items(variant_id)
  WHERE variant_id IS NOT NULL;

COMMENT ON COLUMN public.order_items.variant_id IS
  'The product_variants row this line sold (set by create-checkout-session). selected_size remains the display snapshot.';

-- Link historical lines to the size they recorded. order_items_immutability
-- (003/007) refuses any write to the lines of a paid order; this only fills in
-- the link — no amount, quantity or snapshot changes — so the guard is lifted
-- for this one statement. Inside a DO block the three steps are one atomic
-- statement: if the UPDATE fails, the trigger is never left disabled.
DO $$
DECLARE
  linked INTEGER;
  has_guard BOOLEAN := EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.order_items'::regclass
       AND tgname = 'order_items_immutability'
  );
BEGIN
  IF has_guard THEN
    ALTER TABLE public.order_items DISABLE TRIGGER order_items_immutability;
  END IF;

  UPDATE public.order_items oi
     SET variant_id = v.id
    FROM public.product_variants v
   WHERE oi.variant_id IS NULL
     AND oi.selected_size IS NOT NULL
     AND v.product_id = oi.product_id
     AND v.size = oi.selected_size;
  GET DIAGNOSTICS linked = ROW_COUNT;

  IF has_guard THEN
    ALTER TABLE public.order_items ENABLE TRIGGER order_items_immutability;
  END IF;

  RAISE NOTICE 'Linked % historical order line(s) to their size row.', linked;
END
$$;

-- ============================================================
-- 4. DERIVED STOCK FOR SIZED PRODUCTS
-- ============================================================
-- Negative sizes (backorder depth, see 013) count as zero: an oversold XL
-- must not hide the M and L still on the shelf. Sizes switched off are not
-- for sale, so they do not count either.

CREATE OR REPLACE FUNCTION public.sized_product_stock(p_product_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(GREATEST(stock_qty, 0)), 0)::INTEGER
    FROM public.product_variants
   WHERE product_id = p_product_id
     AND is_active;
$$;

REVOKE ALL ON FUNCTION public.sized_product_stock(UUID) FROM PUBLIC, anon, authenticated;

-- Whoever writes a sized product — the admin form, a seed, the Table Editor —
-- its total is recomputed rather than trusted.
CREATE OR REPLACE FUNCTION public.sync_sized_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.has_sizes THEN
    NEW.stock_quantity := public.sized_product_stock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_sized_stock ON public.products;
CREATE TRIGGER products_sync_sized_stock
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_sized_product_stock();

-- Any change to a size's stock or availability refreshes its product's total.
CREATE OR REPLACE FUNCTION public.touch_sized_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A rename, a SKU or an ordering change does not move the total.
  IF TG_OP = 'UPDATE'
     AND NEW.product_id = OLD.product_id
     AND NEW.stock_qty IS NOT DISTINCT FROM OLD.stock_qty
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NULL;
  END IF;

  -- products_sync_sized_stock recomputes the total on any update of a sized
  -- product; these statements exist to fire it.
  IF TG_OP <> 'INSERT' THEN
    UPDATE public.products
       SET stock_quantity = public.sized_product_stock(id)
     WHERE id = OLD.product_id
       AND has_sizes;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.product_id <> OLD.product_id) THEN
    UPDATE public.products
       SET stock_quantity = public.sized_product_stock(id)
     WHERE id = NEW.product_id
       AND has_sizes;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_touch_stock ON public.product_variants;
CREATE TRIGGER product_variants_touch_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_sized_product_stock();

-- ============================================================
-- 5. STOCK MOVEMENTS ON ORDER STATUS CHANGES
-- ============================================================
-- Same policy as 013: deduct on the first 'paid', restore when a paid order
-- fails / is cancelled / is refunded, never raise (the customer has already
-- been charged), flag needs_review when a counter goes negative.

CREATE OR REPLACE FUNCTION public.manage_stock_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  direction INTEGER;
  item      RECORD;
  remaining INTEGER;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'paid' AND OLD.status IN ('pending', 'processing', 'requires_action') THEN
    direction := -1;
  ELSIF NEW.status IN ('failed', 'cancelled', 'refunded') AND OLD.status = 'paid' THEN
    direction := 1;
  ELSE
    RETURN NEW;
  END IF;

  -- Every product this order touches, locked in id order before any size row.
  -- The admin stock functions take the same locks in the same order, so two
  -- writers can no longer each hold a row the other is waiting for.
  PERFORM 1
     FROM public.products
    WHERE id IN (SELECT product_id FROM public.order_items WHERE order_id = NEW.id)
    ORDER BY id
      FOR UPDATE;

  FOR item IN
    SELECT oi.product_id,
           oi.quantity,
           p.has_sizes,
           -- Lines written before 021 carry no variant_id; they resolve by
           -- the size they recorded.
           COALESCE(
             oi.variant_id,
             (SELECT v.id
                FROM public.product_variants v
               WHERE v.product_id = oi.product_id
                 AND v.size = oi.selected_size)
           ) AS variant_id
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = NEW.id
     ORDER BY oi.product_id, oi.id
  LOOP
    IF item.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
         SET stock_qty = stock_qty + direction * item.quantity
       WHERE id = item.variant_id
       RETURNING stock_qty INTO remaining;

      IF direction < 0 AND remaining < 0 THEN
        NEW.needs_review  := TRUE;
        NEW.review_reason := COALESCE(NEW.review_reason, 'oversold');
      END IF;
    ELSIF item.has_sizes AND direction < 0 THEN
      -- A sized product sold without a size that matches a stock row.
      -- Checkout refuses this since 021, so only a hand-written line gets
      -- here: the order is honored, and flagged instead of taking no stock.
      NEW.needs_review  := TRUE;
      NEW.review_reason := COALESCE(NEW.review_reason, 'size not matched to stock');
    END IF;

    -- A sized product's total follows its sizes (products_sync_sized_stock);
    -- only an unsized product carries its own counter.
    IF NOT item.has_sizes THEN
      UPDATE public.products
         SET stock_quantity = stock_quantity + direction * item.quantity
       WHERE id = item.product_id
       RETURNING stock_quantity INTO remaining;

      IF direction < 0 AND remaining < 0 THEN
        NEW.needs_review  := TRUE;
        NEW.review_reason := COALESCE(NEW.review_reason, 'oversold');
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- BEFORE, so the function can flag the order row itself. 005 and 007 created
-- this trigger as AFTER UPDATE (where NEW changes are discarded); re-running
-- either of them used to silently disable the oversold flag.
DROP TRIGGER IF EXISTS orders_manage_stock ON public.orders;
CREATE TRIGGER orders_manage_stock
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.manage_stock_on_status_change();

-- ============================================================
-- 6. PRODUCTS RLS — allow editing an oversold product
-- ============================================================

DROP POLICY IF EXISTS "products: admin update" ON public.products;
CREATE POLICY "products: admin update"
  ON public.products FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin() AND price >= 0);

-- ============================================================
-- 7. ADMIN WRITE PATH FOR SIZES AND STOCK
-- ============================================================
-- Errors meant for the admin UI carry a HINT the client can translate:
--   stock_conflict — DETAIL holds the size name (empty for an unsized product)

-- Replace a product's size list in one transaction.
--
--   p_has_sizes       TRUE: p_variants is the complete, ordered list of sizes.
--                     FALSE: the product is unsized; every size row goes.
--   p_size_label      optional new label (see products_size_label_check)
--   p_variants        [{ id?, size, sku?, is_active?, stock_qty?, expected_stock_qty? }]
--                     id      — an existing size of this product; omit for a new one
--                     stock_qty omitted — stock left exactly as it is
--                     expected_stock_qty — the stock the editor was showing; if it
--                     has changed since (an order came in), nothing is saved
--   p_stock_quantity  unsized only: the new stock; NULL leaves it as it is
--   p_expected_stock  unsized only: same optimistic check as expected_stock_qty
--
-- A size dropped from the list is deleted, unless an order line references it:
-- then it is switched off instead, so order history and refunds keep their row.
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
DECLARE
  prod        public.products;
  cur         public.product_variants;
  elem        JSONB;
  v_id        UUID;
  v_size      TEXT;
  v_sku       TEXT;
  v_stock     INTEGER;
  v_expected  INTEGER;
  v_active    BOOLEAN;
  v_position  BIGINT;
  kept_ids    UUID[] := '{}';
  seen_sizes  TEXT[] := '{}';
  seen_skus   TEXT[] := '{}';
  n_deleted   INTEGER := 0;
  n_archived  INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_has_sizes IS NULL THEN
    RAISE EXCEPTION 'p_has_sizes is required.' USING ERRCODE = '22023';
  END IF;

  IF p_size_label IS NOT NULL
     AND p_size_label NOT IN ('size', 'measure', 'length', 'shoe_size', 'ring_size', 'waist') THEN
    RAISE EXCEPTION 'Unknown size label "%".', p_size_label USING ERRCODE = '22023';
  END IF;

  p_variants := COALESCE(p_variants, '[]'::JSONB);
  IF jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'p_variants must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  -- The product row is the lock every stock writer takes first.
  SELECT * INTO prod FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING ERRCODE = '22023';
  END IF;

  -- ── 1. Validate the whole list before writing anything ────────────────
  IF p_has_sizes THEN
    IF jsonb_array_length(p_variants) = 0 THEN
      RAISE EXCEPTION 'A product with sizes needs at least one size.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_variants) > 100 THEN
      RAISE EXCEPTION 'Too many sizes (max 100).' USING ERRCODE = '22023';
    END IF;

    FOR elem IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
      v_size := btrim(COALESCE(elem->>'size', ''));
      IF v_size = '' OR length(v_size) > 40 THEN
        RAISE EXCEPTION 'Every size needs a name of 1 to 40 characters.' USING ERRCODE = '22023';
      END IF;
      IF lower(v_size) = ANY (seen_sizes) THEN
        RAISE EXCEPTION 'Size "%" is listed twice.', v_size USING ERRCODE = '22023';
      END IF;
      seen_sizes := seen_sizes || lower(v_size);

      v_sku := NULLIF(btrim(COALESCE(elem->>'sku', '')), '');
      IF v_sku IS NOT NULL THEN
        IF length(v_sku) > 64 THEN
          RAISE EXCEPTION 'SKU "%" is longer than 64 characters.', v_sku USING ERRCODE = '22023';
        END IF;
        IF upper(v_sku) = ANY (seen_skus) THEN
          RAISE EXCEPTION 'SKU "%" is used by two sizes.', v_sku USING ERRCODE = '22023';
        END IF;
        seen_skus := seen_skus || upper(v_sku);
      END IF;

      IF (elem->>'stock_qty')::INTEGER < 0 THEN
        RAISE EXCEPTION 'Stock for size "%" cannot be negative.', v_size USING ERRCODE = '22023';
      END IF;

      IF elem->>'id' IS NOT NULL THEN
        v_id := (elem->>'id')::UUID;
        IF NOT EXISTS (
          SELECT 1 FROM public.product_variants
           WHERE id = v_id AND product_id = p_product_id
        ) THEN
          RAISE EXCEPTION 'Size "%" does not belong to this product.', v_size USING ERRCODE = '22023';
        END IF;
        kept_ids := kept_ids || v_id;
      END IF;
    END LOOP;
  ELSIF p_stock_quantity < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative.' USING ERRCODE = '22023';
  END IF;

  -- ── 2. Sizes no longer listed: delete, or switch off if they sold ─────
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

  -- ── 3. Write the listed sizes, in the order given ─────────────────────
  IF p_has_sizes THEN
    -- (product_id, size) is unique, so swapping two labels — or renaming M to
    -- L while another row still says L — would collide halfway through. Park
    -- every renamed row on a placeholder first.
    UPDATE public.product_variants pv
       SET size = '~' || pv.id::TEXT
      FROM jsonb_array_elements(p_variants) AS e(value)
     WHERE e.value->>'id' IS NOT NULL
       AND pv.id = (e.value->>'id')::UUID
       AND pv.size <> btrim(e.value->>'size');

    FOR elem, v_position IN
      SELECT e.value, e.ord
        FROM jsonb_array_elements(p_variants) WITH ORDINALITY AS e(value, ord)
       ORDER BY e.ord
    LOOP
      v_size     := btrim(elem->>'size');
      v_sku      := NULLIF(btrim(COALESCE(elem->>'sku', '')), '');
      v_active   := COALESCE((elem->>'is_active')::BOOLEAN, TRUE);
      v_stock    := (elem->>'stock_qty')::INTEGER;            -- NULL: leave as is
      v_expected := (elem->>'expected_stock_qty')::INTEGER;   -- NULL: no check
      v_id       := (elem->>'id')::UUID;

      IF v_id IS NULL THEN
        -- Listed again after being switched off for having orders: reuse it.
        SELECT id INTO v_id
          FROM public.product_variants
         WHERE product_id = p_product_id
           AND lower(size) = lower(v_size)
           AND NOT (id = ANY (kept_ids))
         LIMIT 1;
      ELSIF EXISTS (
        SELECT 1 FROM public.product_variants
         WHERE product_id = p_product_id
           AND lower(size) = lower(v_size)
           AND id <> v_id
           AND NOT (id = ANY (kept_ids))
      ) THEN
        RAISE EXCEPTION 'Size "%" already exists, switched off because it has orders. Switch that one back on instead of renaming another size to it.', v_size
          USING ERRCODE = '22023';
      END IF;

      IF v_id IS NULL THEN
        INSERT INTO public.product_variants (product_id, size, sku, stock_qty, sort_order, is_active)
        VALUES (p_product_id, v_size, v_sku, COALESCE(v_stock, 0), v_position, v_active);
      ELSE
        SELECT * INTO cur FROM public.product_variants WHERE id = v_id FOR UPDATE;

        IF v_stock IS NOT NULL AND v_expected IS NOT NULL AND cur.stock_qty <> v_expected THEN
          RAISE EXCEPTION 'Stock for size % changed from % to % while it was being edited.',
            v_size, v_expected, cur.stock_qty
            USING HINT = 'stock_conflict', DETAIL = v_size;
        END IF;

        UPDATE public.product_variants
           SET size       = v_size,
               sku        = v_sku,
               sort_order = v_position,
               is_active  = v_active,
               stock_qty  = COALESCE(v_stock, stock_qty)
         WHERE id = v_id;

        kept_ids := kept_ids || v_id;
      END IF;
    END LOOP;
  END IF;

  -- ── 4. The product row ────────────────────────────────────────────────
  IF p_has_sizes THEN
    -- products_sync_sized_stock derives stock_quantity from the sizes.
    UPDATE public.products
       SET has_sizes  = TRUE,
           size_label = COALESCE(p_size_label, size_label)
     WHERE id = p_product_id
    RETURNING * INTO prod;
  ELSE
    IF p_stock_quantity IS NOT NULL
       AND p_expected_stock IS NOT NULL
       AND NOT prod.has_sizes
       AND prod.stock_quantity <> p_expected_stock THEN
      RAISE EXCEPTION 'Stock changed from % to % while it was being edited.',
        p_expected_stock, prod.stock_quantity
        USING HINT = 'stock_conflict', DETAIL = '';
    END IF;

    UPDATE public.products
       SET has_sizes      = FALSE,
           size_label     = COALESCE(p_size_label, size_label),
           stock_quantity = COALESCE(p_stock_quantity, stock_quantity)
     WHERE id = p_product_id
    RETURNING * INTO prod;
  END IF;

  RETURN jsonb_build_object(
    'product_id',     prod.id,
    'has_sizes',      prod.has_sizes,
    'size_label',     prod.size_label,
    'stock_quantity', prod.stock_quantity,
    'deleted',        n_deleted,
    'archived',       n_archived,
    'variants',       COALESCE((
      SELECT jsonb_agg(to_jsonb(pv) ORDER BY pv.sort_order, pv.size)
        FROM public.product_variants pv
       WHERE pv.product_id = prod.id
    ), '[]'::JSONB)
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_set_product_inventory(UUID, BOOLEAN, TEXT, JSONB, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_product_inventory(UUID, BOOLEAN, TEXT, JSONB, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.admin_set_product_inventory(UUID, BOOLEAN, TEXT, JSONB, INTEGER, INTEGER) IS
  'Admin only. Atomically replaces a product''s size list (or switches it to unsized stock), with optimistic stock checks. Migration 021.';

-- Set the stock of individual sizes — the catalog's quick restock — without
-- touching anything else about them.
--
--   p_changes  [{ id, stock_qty, expected_stock_qty? }]
CREATE OR REPLACE FUNCTION public.admin_set_variant_stock(p_changes JSONB)
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
  IF jsonb_array_length(p_changes) > 200 THEN
    RAISE EXCEPTION 'Too many changes (max 200).' USING ERRCODE = '22023';
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

  FOR elem IN
    SELECT e.value
      FROM jsonb_array_elements(p_changes) AS e(value)
     ORDER BY e.value->>'id'
  LOOP
    v_stock    := (elem->>'stock_qty')::INTEGER;
    v_expected := (elem->>'expected_stock_qty')::INTEGER;

    IF v_stock IS NULL OR v_stock < 0 THEN
      RAISE EXCEPTION 'Stock must be a whole number, 0 or more.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO cur
      FROM public.product_variants
     WHERE id = (elem->>'id')::UUID
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Size not found.' USING ERRCODE = '22023';
    END IF;

    IF v_expected IS NOT NULL AND cur.stock_qty <> v_expected THEN
      RAISE EXCEPTION 'Stock for size % changed from % to % while it was being edited.',
        cur.size, v_expected, cur.stock_qty
        USING HINT = 'stock_conflict', DETAIL = cur.size;
    END IF;

    UPDATE public.product_variants
       SET stock_qty = v_stock
     WHERE id = cur.id
    RETURNING * INTO cur;

    RETURN NEXT cur;
  END LOOP;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_set_variant_stock(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_variant_stock(JSONB) TO authenticated;

COMMENT ON FUNCTION public.admin_set_variant_stock(JSONB) IS
  'Admin only. Sets the stock of the given sizes, with optimistic checks. Migration 021.';

-- ============================================================
-- 8. EXISTING CATALOGUE — products that already have sizes
-- ============================================================
-- Any product with a size on sale becomes a sized product. Its total is
-- recomputed by the trigger above; a total that disagreed with its sizes is
-- reported, because it changes what the storefront shows.

DO $$
DECLARE
  r         RECORD;
  new_total INTEGER;
  switched  INTEGER := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.name, p.stock_quantity
      FROM public.products p
     WHERE NOT p.has_sizes
       AND EXISTS (
             SELECT 1 FROM public.product_variants v
              WHERE v.product_id = p.id AND v.is_active
           )
     ORDER BY p.id
  LOOP
    UPDATE public.products
       SET has_sizes = TRUE
     WHERE id = r.id
    RETURNING stock_quantity INTO new_total;

    switched := switched + 1;
    IF new_total <> r.stock_quantity THEN
      RAISE NOTICE '"%": stock % -> % (now the sum of its sizes on sale).',
        r.name, r.stock_quantity, new_total;
    END IF;
  END LOOP;

  RAISE NOTICE '% product(s) now use per-size stock.', switched;
END
$$;

-- ============================================================
-- 9. VALIDATE the new constraint, reporting instead of aborting
-- ============================================================

DO $$
BEGIN
  ALTER TABLE public.product_variants VALIDATE CONSTRAINT product_variants_size_format_check;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING
    'product_variants_size_format_check is enforced for new rows, but existing sizes have untrimmed or over-long names or SKUs. Fix them, then run: ALTER TABLE public.product_variants VALIDATE CONSTRAINT product_variants_size_format_check;';
END
$$;

NOTIFY pgrst, 'reload schema';
