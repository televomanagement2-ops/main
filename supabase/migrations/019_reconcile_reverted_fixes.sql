-- ============================================================
-- MIGRATION 019 — Re-assert fixes that re-running older files reverts
-- Run after 018_refund_attribution_fk.sql
-- ============================================================
-- schema.sql and 004 are written to be re-runnable, and both put back objects
-- that later migrations replaced. A database where either was run again after
-- the migrations ends up with:
--
-- 1. The pre-001 stock triggers (from schema.sql):
--      order_item_deduct_stock  AFTER INSERT ON order_items
--      order_restore_stock      AFTER UPDATE ON orders
--    The first deducts stock when create-checkout-session writes the order
--    lines — before any payment — and raises 'Insufficient stock' instead of
--    following the backorder policy (013). manage_stock_on_status_change (013)
--    then deducts the same lines AGAIN when the order reaches 'paid', so every
--    paid order took its stock twice. The second restores stock on any cancel,
--    including pre-payment cancels that never held stock under 013's model.
--
-- 2. The pre-010 review policies (from 004): any signed-in account could
--    review any product, purchased or not.
--
-- schema.sql no longer creates the legacy triggers, but a database that already
-- re-ran an old copy still has them. Everything below is idempotent: it only
-- asserts the intended end state, so it is safe to run again whenever an
-- earlier file has been re-run.
-- ============================================================

-- ============================================================
-- 1. LEGACY STOCK TRIGGERS — stock moves only on status changes (013)
-- ============================================================

DROP TRIGGER IF EXISTS order_item_deduct_stock ON public.order_items;
DROP FUNCTION IF EXISTS public.deduct_stock();

DROP TRIGGER IF EXISTS order_restore_stock ON public.orders;
DROP FUNCTION IF EXISTS public.restore_stock();

-- ============================================================
-- 2. REVIEWS — verified purchasers only (010)
-- ============================================================

DROP POLICY IF EXISTS "reviews: owner insert" ON public.product_reviews;
CREATE POLICY "reviews: owner insert"
  ON public.product_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_purchased(product_id)
  );

DROP POLICY IF EXISTS "reviews: owner update" ON public.product_reviews;
CREATE POLICY "reviews: owner update"
  ON public.product_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_purchased(product_id)
  );

NOTIFY pgrst, 'reload schema';
