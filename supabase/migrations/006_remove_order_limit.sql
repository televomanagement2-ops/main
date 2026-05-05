-- ============================================================
-- MIGRATION 006 — Remove pending order limit
-- ============================================================

DROP TRIGGER IF EXISTS orders_pending_limit ON public.orders;
DROP FUNCTION IF EXISTS public.check_pending_order_limit() CASCADE;
