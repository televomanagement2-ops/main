-- ============================================================
-- MIGRATION 026 — CSV import leaves variants alone when the file has none
-- Run after 025_discount_codes.sql
-- ============================================================
-- admin_import_products (migration 022) treated every product in the file as
-- carrying its complete variant list. A file without size and colour columns
-- — say, handle and price only, to update prices — therefore switched every
-- product sold by size or colour back to a single stock.
--
-- Now a product sent without has_sizes and has_colors keeps its variants as
-- they are; only the stock of a product without variants is applied. When one
-- of the two keys is sent, the other keeps the product's current setting (and
-- a product sold by colour, imported from a file with sizes only, is refused
-- with the row named, instead of losing its colours).
--
-- The browser side (src/lib/productCsv.ts) sends the keys only when the file
-- has the matching column.
--
-- Idempotent.
-- ============================================================

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
  v_cur_sizes   BOOLEAN;
  v_cur_colors  BOOLEAN;
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

      SELECT has_sizes, has_colors INTO v_cur_sizes, v_cur_colors
        FROM public.products
       WHERE id = v_prod_id;

      IF NOT (elem ? 'has_sizes' OR elem ? 'has_colors') THEN
        -- No size or colour column in the file: the variants stay as they
        -- are. Only a product without variants takes the stock figure.
        IF NOT (v_cur_sizes OR v_cur_colors) AND (elem->>'stock_quantity') IS NOT NULL THEN
          PERFORM public.admin_save_product_variants(v_prod_id, jsonb_build_object(
            'has_sizes',      FALSE,
            'has_colors',     FALSE,
            'stock_quantity', (elem->>'stock_quantity')::INTEGER,
            'reason',         'import'
          ));
        END IF;
      ELSE
        -- Variants: matched to existing rows by colour name and size. A
        -- dimension the file does not mention keeps the product's setting.
        v_has_sizes  := COALESCE((elem->>'has_sizes')::BOOLEAN, v_cur_sizes);
        v_has_colors := COALESCE((elem->>'has_colors')::BOOLEAN, v_cur_colors);
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
      END IF;

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
  'Admin only. Creates or updates products (matched by slug), all or nothing. Variants are replaced only for products sent with has_sizes/has_colors. Migrations 022, 026.';

NOTIFY pgrst, 'reload schema';
