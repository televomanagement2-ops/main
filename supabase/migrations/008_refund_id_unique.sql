-- ============================================================
-- MIGRATION 008 — Add UNIQUE constraint to refund_id
-- Run after 007_refund_status.sql
-- ============================================================

-- Add UNIQUE constraint to refund_id to prevent duplicate refunds
ALTER TABLE public.orders
  ADD CONSTRAINT orders_refund_id_unique UNIQUE (refund_id);

-- Add index for faster lookups by refund_id
CREATE INDEX IF NOT EXISTS idx_orders_refund_id
  ON public.orders(refund_id)
  WHERE refund_id IS NOT NULL;
