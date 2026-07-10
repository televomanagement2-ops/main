-- ============================================================
-- MIGRATION 013 — Payment reliability & security hardening
-- Run after 012_us_shipping_cleanup.sql
-- ============================================================
-- 1.  Backorder policy: paid orders are ALWAYS honored. Stock may go
--     negative; oversold orders are flagged needs_review for the operator.
-- 2.  Product-variant stock is deducted/restored alongside product stock.
-- 3.  Pending-order limit re-instated (cap 10; reverses migration 006).
-- 4.  Clients can no longer INSERT orders (only the checkout Edge Function
--     using the service role does).
-- 5.  profiles: column-level UPDATE lockdown (full_name, phone, avatar_url).
-- 6.  product_reviews.author_name snapshot (public reviews no longer join
--     profiles, which leaked reviewer emails to any authenticated user).
-- 7.  product-images bucket: 5 MB limit + raster image MIME whitelist.
-- 8.  Seed fix: the XL t-shirt variant was attached to the USB-C hub.
-- 9.  DB cart removed (localStorage cart is the single source of truth).
-- 10. admin_analytics() RPC: aggregates computed in the DB instead of
--     shipping every order row to the admin dashboard.
-- ============================================================

-- ============================================================
-- 1. ORDERS — needs_review flag + oversell-friendly stock rules
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS needs_review  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_needs_review
  ON public.orders(needs_review)
  WHERE needs_review = TRUE;

-- Allow negative stock: an oversold paid order deducts below zero and the
-- negative number IS the backorder depth the operator has to cover.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_quantity_check;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_stock_qty_check;

-- Rewrite stock management as a BEFORE UPDATE trigger so it can flag the
-- order row itself (NEW.needs_review) instead of raising — a RAISE here used
-- to make the Stripe webhook fail forever on paid-but-oversold orders (money
-- taken, order stuck). SECURITY DEFINER: stock adjustments must not depend on
-- the caller's RLS grants on products/product_variants.
CREATE OR REPLACE FUNCTION public.manage_stock_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  remaining INTEGER;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- DEDUCT when reaching 'paid' from a pre-payment state. Never reject:
  -- the customer has already been charged.
  IF NEW.status = 'paid' AND OLD.status IN ('pending', 'processing', 'requires_action') THEN
    FOR item IN
      SELECT product_id, quantity, selected_size
        FROM public.order_items
       WHERE order_id = NEW.id
    LOOP
      UPDATE public.products
         SET stock_quantity = stock_quantity - item.quantity
       WHERE id = item.product_id
       RETURNING stock_quantity INTO remaining;

      IF remaining IS NOT NULL AND remaining < 0 THEN
        NEW.needs_review  := TRUE;
        NEW.review_reason := COALESCE(NEW.review_reason, 'oversold');
      END IF;

      IF item.selected_size IS NOT NULL THEN
        UPDATE public.product_variants
           SET stock_qty = stock_qty - item.quantity
         WHERE product_id = item.product_id
           AND size = item.selected_size
         RETURNING stock_qty INTO remaining;

        IF remaining IS NOT NULL AND remaining < 0 THEN
          NEW.needs_review  := TRUE;
          NEW.review_reason := COALESCE(NEW.review_reason, 'oversold');
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- RESTORE when a paid order fails / is cancelled / is refunded.
  IF NEW.status IN ('failed', 'cancelled', 'refunded') AND OLD.status = 'paid' THEN
    UPDATE public.products p
       SET stock_quantity = p.stock_quantity + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id
       AND oi.product_id = p.id;

    UPDATE public.product_variants pv
       SET stock_qty = pv.stock_qty + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id
       AND oi.product_id = pv.product_id
       AND oi.selected_size = pv.size;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the old AFTER trigger with a BEFORE trigger (needed to set
-- NEW.needs_review on the same row).
DROP TRIGGER IF EXISTS orders_manage_stock ON public.orders;
CREATE TRIGGER orders_manage_stock
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.manage_stock_on_status_change();

-- ============================================================
-- 2. PENDING ORDER LIMIT — reinstated (reverses migration 006), cap 10
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_pending_order_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'processing') THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.orders
    WHERE user_id = NEW.user_id
      AND status IN ('pending', 'processing')
      AND id IS DISTINCT FROM NEW.id  -- exclude self on UPDATE
  ) >= 10 THEN
    RAISE EXCEPTION
      'User % has too many open orders. Complete or cancel existing orders first.',
      NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_pending_limit ON public.orders;
CREATE TRIGGER orders_pending_limit
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.check_pending_order_limit();

-- ============================================================
-- 3. ORDERS RLS — clients never INSERT orders directly.
--    Orders are created exclusively by create-checkout-session
--    (service role, which bypasses RLS).
-- ============================================================

DROP POLICY IF EXISTS "orders: owner insert" ON public.orders;

-- ============================================================
-- 4. PROFILES — column-level UPDATE lockdown.
--    RLS already blocks role self-promotion; this also stops users from
--    rewriting their own email (kept in sync with auth.users) or id.
-- ============================================================

REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, avatar_url) ON public.profiles TO authenticated;

-- ============================================================
-- 5. PRODUCT REVIEWS — snapshot author name, stop leaking emails
-- ============================================================

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS author_name TEXT;

-- SECURITY DEFINER so the profiles lookup works regardless of the caller's
-- RLS visibility (mirrors has_purchased from migration 010).
CREATE OR REPLACE FUNCTION public.set_review_author_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.author_name := (SELECT full_name FROM public.profiles WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_reviews_author_name ON public.product_reviews;
CREATE TRIGGER product_reviews_author_name
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_review_author_name();

-- Backfill existing reviews
UPDATE public.product_reviews r
   SET author_name = p.full_name
  FROM public.profiles p
 WHERE p.id = r.user_id
   AND r.author_name IS NULL;

-- ============================================================
-- 6. STORAGE — size + MIME constraints on product images (no SVG:
--    SVG can carry scripts and the bucket is publicly readable)
-- ============================================================

UPDATE storage.buckets
   SET file_size_limit = 5242880,  -- 5 MB
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 WHERE id = 'product-images';

-- ============================================================
-- 7. SEED FIX — the XL t-shirt variant was attached to the USB-C hub
-- ============================================================

DELETE FROM public.product_variants
 WHERE product_id = 'b1000000-0000-0000-0000-000000000005';

INSERT INTO public.product_variants (product_id, size, sku, stock_qty, sort_order)
VALUES ('b1000000-0000-0000-0000-000000000003', 'XL', 'CCT-XL-WHT', 20, 5)
ON CONFLICT (product_id, size) DO NOTHING;

-- ============================================================
-- 8. DROP THE DB CART — the localStorage cart is the single cart.
--    (Owner decision: removes merge complexity and a dead API surface.)
-- ============================================================

DROP TABLE IF EXISTS public.cart_items;
DROP TABLE IF EXISTS public.carts;

-- ============================================================
-- 9. ADMIN ANALYTICS RPC — replaces the client-side load-everything logic
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_analytics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'grossRevenue', COALESCE((
      SELECT ROUND(SUM(total), 2)
      FROM public.orders
      WHERE status IN ('paid', 'shipped', 'delivered')
    ), 0),
    'orders24h', (
      SELECT COUNT(*)
      FROM public.orders
      WHERE status IN ('paid', 'shipped', 'delivered')
        AND created_at >= NOW() - INTERVAL '24 hours'
    ),
    'orders7d', (
      SELECT COUNT(*)
      FROM public.orders
      WHERE status IN ('paid', 'shipped', 'delivered')
        AND created_at >= NOW() - INTERVAL '7 days'
    ),
    'needsReview', (
      SELECT COUNT(*) FROM public.orders WHERE needs_review = TRUE
    ),
    'statusCounts', COALESCE((
      SELECT jsonb_object_agg(s.status, s.cnt)
      FROM (
        SELECT status::text AS status, COUNT(*) AS cnt
        FROM public.orders
        GROUP BY status
      ) s
    ), '{}'::jsonb),
    'bestSeller', (
      SELECT jsonb_build_object(
        'productId', oi.product_id,
        'productName', MAX(oi.product_name),
        'quantity', SUM(oi.quantity)
      )
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.status IN ('paid', 'shipped', 'delivered')
      GROUP BY oi.product_id
      ORDER BY SUM(oi.quantity) DESC
      LIMIT 1
    ),
    'revenueByDay', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object('day', d.day, 'revenue', d.revenue)
               ORDER BY d.day
             )
      FROM (
        SELECT DATE(created_at) AS day, ROUND(SUM(total), 2) AS revenue
        FROM public.orders
        WHERE status IN ('paid', 'shipped', 'delivered')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
      ) d
    ), '[]'::jsonb),
    'revenueByStatus', COALESCE((
      SELECT jsonb_object_agg(r.status, r.revenue)
      FROM (
        SELECT status::text AS status, ROUND(SUM(total), 2) AS revenue
        FROM public.orders
        WHERE status IN ('paid', 'shipped', 'delivered')
        GROUP BY status
      ) r
    ), '{}'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
