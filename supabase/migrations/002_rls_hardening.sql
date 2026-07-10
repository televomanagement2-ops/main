-- ============================================================
-- RLS HARDENING — run after 001_fixes.sql
-- Drops and recreates affected policies cleanly.
-- ============================================================

-- ============================================================
-- FIX: is_admin() — make it truly immutable within a transaction.
-- STABLE lets PG cache the result per query; SECURITY DEFINER
-- with fixed search_path prevents search_path hijacking.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- ORDERS — rebuild policies around the new status model
-- ============================================================
DROP POLICY IF EXISTS "orders: owner cancel"  ON public.orders;
DROP POLICY IF EXISTS "orders: owner insert"  ON public.orders;
DROP POLICY IF EXISTS "orders: admin update"  ON public.orders;

-- Customers can INSERT only their own order, only in 'pending' status.
-- This prevents a frontend from creating a pre-paid order.
CREATE POLICY "orders: owner insert"
  ON public.orders FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- Customers may only cancel their own pending orders.
-- USING filters which rows can be targeted; WITH CHECK validates the
-- proposed new row. Neither has access to OLD in RLS — the transition
-- guard trigger (validate_order_status_transition) enforces that the
-- *current* DB status is 'pending' before the jump to 'cancelled'.
CREATE POLICY "orders: owner cancel"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'pending'           -- can only target a pending order
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'cancelled'         -- proposed status must be cancelled
    -- Prevent customers from modifying financial or Stripe fields.
    -- These are validated by comparing the proposed value against the
    -- current committed value via a sub-select.
    AND stripe_session_id        IS NOT DISTINCT FROM (SELECT stripe_session_id        FROM public.orders WHERE id = orders.id)
    AND stripe_payment_intent_id IS NOT DISTINCT FROM (SELECT stripe_payment_intent_id FROM public.orders WHERE id = orders.id)
    AND total    = (SELECT total    FROM public.orders WHERE id = orders.id)
    AND subtotal = (SELECT subtotal FROM public.orders WHERE id = orders.id)
  );

-- Admins get full UPDATE access. Status transitions are still
-- validated by the validate_order_status_transition trigger,
-- so even admins cannot make illegal jumps.
CREATE POLICY "orders: admin update"
  ON public.orders FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- ORDER ITEMS — customers must NOT be able to insert order_items
-- directly. Items are written server-side (Edge Function / service
-- role) after payment confirmation. The INSERT policy is dropped.
-- ============================================================
DROP POLICY IF EXISTS "order_items: owner insert" ON public.order_items;

-- SELECT stays: customers can read their own order items.
-- No INSERT/UPDATE/DELETE for customers — only service role can write.

-- (Cart RLS sections removed: the DB cart no longer exists.)

-- ============================================================
-- PROFILES — plug the self-promotion gap more explicitly.
-- The original WITH CHECK used a subquery that could be tricked
-- by a concurrent UPDATE. Replace with a tighter SECURITY DEFINER
-- function that reads the committed role.
-- ============================================================
DROP POLICY IF EXISTS "profiles: owner update"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin update"  ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Owner update: cannot change their own role
CREATE POLICY "profiles: owner update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id AND NOT public.is_admin())
  WITH CHECK (
    auth.uid() = id
    AND role = public.get_my_role()   -- role must remain unchanged
  );

-- Admin update: separate policy, can change any profile including roles
CREATE POLICY "profiles: admin update"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- PRODUCTS — add WITH CHECK to UPDATE policy so admins can't
-- accidentally set price to negative (belt-and-suspenders with
-- the CHECK constraint on the table).
-- ============================================================
DROP POLICY IF EXISTS "products: admin update" ON public.products;

CREATE POLICY "products: admin update"
  ON public.products FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (
    public.is_admin()
    AND price >= 0
    AND stock_quantity >= 0
  );
