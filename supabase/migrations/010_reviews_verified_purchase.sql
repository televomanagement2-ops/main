-- ============================================================
-- MIGRATION 010 — Reviews only by verified purchasers
-- Run after 009_delivered_at.sql
-- ============================================================
-- Previously any authenticated user could review any product. Now a user may
-- only review a product they actually bought (order in paid/shipped/delivered).

-- SECURITY DEFINER so the existence check can read orders/order_items
-- regardless of the caller's RLS; it is still scoped to auth.uid().
CREATE OR REPLACE FUNCTION public.has_purchased(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.user_id = auth.uid()
      AND oi.product_id = p_product_id
      AND o.status IN ('paid', 'shipped', 'delivered')
  );
$$;

-- INSERT: must own the row AND have purchased the product.
DROP POLICY IF EXISTS "reviews: owner insert" ON public.product_reviews;
CREATE POLICY "reviews: owner insert"
  ON public.product_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_purchased(product_id)
  );

-- UPDATE: owner only, and the purchase requirement still holds.
DROP POLICY IF EXISTS "reviews: owner update" ON public.product_reviews;
CREATE POLICY "reviews: owner update"
  ON public.product_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_purchased(product_id)
  );

-- (SELECT public read and DELETE owner-only policies from migration 004 are unchanged.)
