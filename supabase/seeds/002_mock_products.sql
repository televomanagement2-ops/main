-- 200 seeded products with stable image URLs across 4 categories
-- Run this in Supabase SQL editor AFTER schema.sql and rls.sql

BEGIN;

-- Legacy c100 mock products can be referenced by order_items (FK RESTRICT),
-- so we do a safe soft-retire instead of deleting them.
UPDATE public.products
SET
  is_active = FALSE,
  is_featured = FALSE,
  updated_at = now()
WHERE id::text LIKE 'c1000000-%';

WITH category_config AS (
  SELECT *
  FROM (
    VALUES
      (1, 'a1000000-0000-0000-0000-000000000001'::uuid, 'electronics', 'ELEC', 'Electronics'),
      (2, 'a1000000-0000-0000-0000-000000000002'::uuid, 'clothing', 'CLTH', 'Clothing'),
      (3, 'a1000000-0000-0000-0000-000000000003'::uuid, 'home-garden', 'HOME', 'Home and Garden'),
      (4, 'a1000000-0000-0000-0000-000000000004'::uuid, 'smartphone', 'SMRT', 'Smartphone Accessories')
  ) AS c(category_index, category_id, slug_prefix, sku_prefix, category_label)
),
generated AS (
  SELECT
    ('d2000000-0000-0000-0000-' || lpad(((c.category_index - 1) * 50 + n)::text, 12, '0'))::uuid AS id,
    c.category_id,
    c.category_label || ' Studio Item ' || lpad(n::text, 2, '0') AS name,
    c.slug_prefix || '-studio-item-' || lpad(n::text, 3, '0') AS slug,
    'Curated ' || lower(c.category_label) || ' product designed for daily use, reliability, and balanced value.' AS description,
    round((16 + c.category_index * 8 + n * 1.89)::numeric, 2) AS price,
    CASE
      WHEN n % 3 = 0 THEN round((16 + c.category_index * 8 + n * 1.89)::numeric * 1.18, 2)
      ELSE NULL
    END AS compare_at_price,
    'D2-' || c.sku_prefix || '-' || lpad(n::text, 3, '0') AS sku,
    (24 + ((n * 7 + c.category_index * 13) % 180))::int AS stock_quantity,
    n IN (3, 9, 15, 21, 27, 33, 39, 45) AS is_featured,
    TRUE AS is_active
  FROM category_config c
  CROSS JOIN generate_series(1, 50) AS n
)
INSERT INTO public.products
  (id, category_id, name, slug, description, price, compare_at_price, sku, stock_quantity, is_featured, is_active)
SELECT
  id,
  category_id,
  name,
  slug,
  description,
  price,
  compare_at_price,
  sku,
  stock_quantity,
  is_featured,
  is_active
FROM generated
ON CONFLICT (slug) DO UPDATE
SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  sku = EXCLUDED.sku,
  stock_quantity = EXCLUDED.stock_quantity,
  is_featured = EXCLUDED.is_featured,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT
  p.id,
  'https://picsum.photos/seed/' || p.slug || '/1200/1200' AS url,
  p.name AS alt_text,
  0 AS sort_order,
  TRUE AS is_primary
FROM public.products p
WHERE p.id::text LIKE 'd2000000-%'
ON CONFLICT (product_id) WHERE (is_primary) DO UPDATE
SET
  url = EXCLUDED.url,
  alt_text = EXCLUDED.alt_text,
  sort_order = 0;

COMMIT;