-- ============================================================
-- MIGRATION 005 — Admin tracking + refunds metadata
-- Run after 004_variants_reviews_shipping.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2) CHECK (refund_amount >= 0),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_id
  ON public.orders(tracking_id)
  WHERE tracking_id IS NOT NULL;
