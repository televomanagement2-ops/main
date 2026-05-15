-- ============================================================
-- MIGRATION 009 — Add delivered_at timestamp to orders
-- Run after 008_refund_id_unique.sql
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivered_at
  ON public.orders(delivered_at)
  WHERE delivered_at IS NOT NULL;
