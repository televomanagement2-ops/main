-- ============================================================
-- CART RLS NULL-GUARD
-- Adds explicit auth.uid() IS NOT NULL short-circuit to
-- cart_items INSERT policy so that unauthenticated upserts
-- fail immediately without performing the carts JOIN.
-- Also hardens the SELECT policy for consistency.
-- Idempotent: DROP POLICY IF EXISTS before every CREATE.
-- ============================================================

-- cart_items INSERT: deny immediately when uid is null
DROP POLICY IF EXISTS "cart_items: owner insert" ON public.cart_items;

CREATE POLICY "cart_items: owner insert"
  ON public.cart_items FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id
        AND c.user_id = auth.uid()
    )
  );

-- cart_items UPDATE: same null-guard on USING and WITH CHECK
DROP POLICY IF EXISTS "cart_items: owner update" ON public.cart_items;

CREATE POLICY "cart_items: owner update"
  ON public.cart_items FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND c.user_id = auth.uid()
    )
  );

-- cart_items SELECT: add null-guard for completeness
DROP POLICY IF EXISTS "cart_items: owner select" ON public.cart_items;

CREATE POLICY "cart_items: owner select"
  ON public.cart_items FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND c.user_id = auth.uid()
    )
  );

-- cart_items DELETE: add null-guard
DROP POLICY IF EXISTS "cart_items: owner delete" ON public.cart_items;

CREATE POLICY "cart_items: owner delete"
  ON public.cart_items FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_id AND c.user_id = auth.uid()
    )
  );

-- carts INSERT already has null-guard from 002_rls_hardening.sql — no change needed.
