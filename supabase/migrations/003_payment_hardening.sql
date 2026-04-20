-- ============================================================
-- MIGRATION 003 — Payment hardening, idempotency, immutability
-- Run after 001_fixes.sql and 002_rls_hardening.sql
-- ============================================================

-- ============================================================
-- 1. ADD 'processing' AND 'requires_action' TO ORDER STATUS
--    pending → processing → paid / failed
--    pending → processing → requires_action → paid / failed
--    Any paid → shipped → delivered
--    pending | processing | requires_action → cancelled
-- ============================================================

-- Policies below reference orders.status, so drop before changing type.
DROP POLICY IF EXISTS "orders: owner insert" ON public.orders;
DROP POLICY IF EXISTS "orders: owner cancel" ON public.orders;

-- Migrate column off the enum so we can replace it safely
ALTER TABLE public.orders
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE TEXT;

DROP TYPE IF EXISTS order_status;

CREATE TYPE order_status AS ENUM (
  'pending',           -- order created, no payment attempt yet
  'processing',        -- Stripe session opened / charge in flight
  'requires_action',   -- 3DS / bank redirect required
  'paid',              -- payment_intent.succeeded webhook received
  'failed',            -- payment_intent.payment_failed
  'cancelled',         -- cancelled before payment completes
  'shipped',           -- fulfillment dispatched
  'delivered'          -- confirmed delivery
);

ALTER TABLE public.orders
  ALTER COLUMN status TYPE order_status USING status::order_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- Recreate policies after status enum is replaced.
CREATE POLICY "orders: owner insert"
  ON public.orders FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

CREATE POLICY "orders: owner cancel"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status IN ('pending', 'processing', 'requires_action')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'cancelled'
    AND stripe_session_id        IS NOT DISTINCT FROM (SELECT stripe_session_id        FROM public.orders WHERE id = orders.id)
    AND stripe_payment_intent_id IS NOT DISTINCT FROM (SELECT stripe_payment_intent_id FROM public.orders WHERE id = orders.id)
    AND total    = (SELECT total    FROM public.orders WHERE id = orders.id)
    AND subtotal = (SELECT subtotal FROM public.orders WHERE id = orders.id)
  );

-- Replace transition guard with expanded ruleset
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'pending'          AND NEW.status IN ('processing', 'cancelled')) OR
    (OLD.status = 'processing'       AND NEW.status IN ('paid', 'failed', 'requires_action', 'cancelled')) OR
    (OLD.status = 'requires_action'  AND NEW.status IN ('paid', 'failed', 'cancelled')) OR
    (OLD.status = 'paid'             AND NEW.status = 'shipped') OR
    (OLD.status = 'shipped'          AND NEW.status = 'delivered')
    -- failed / cancelled / delivered are terminal
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % → % (order %)',
      OLD.status, NEW.status, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. WEBHOOK IDEMPOTENCY via processed_events table
--    More flexible than a unique constraint: handles retries,
--    lets you log event type and timestamps for debugging.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id     TEXT PRIMARY KEY,          -- Stripe evt_xxx id
  event_type   TEXT NOT NULL,             -- e.g. payment_intent.succeeded
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_events_order
  ON public.processed_stripe_events(order_id);

-- RLS: only service role (webhook handler) can touch this table
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- No customer-facing policies — service role bypasses RLS by default.
-- Explicit deny for anon/authenticated to be safe:
DROP POLICY IF EXISTS "stripe_events: no customer access"
  ON public.processed_stripe_events;

CREATE POLICY "stripe_events: no customer access"
  ON public.processed_stripe_events
  FOR ALL
  USING (false);

-- ============================================================
-- 3. ORDER IMMUTABILITY after 'paid'
--    Trigger fires BEFORE UPDATE; blocks changes to financial
--    fields and order_items once payment is confirmed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_order_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only enforce once an order has been paid
  IF OLD.status NOT IN ('paid', 'shipped', 'delivered') THEN
    RETURN NEW;
  END IF;

  -- These fields must never change after payment
  IF (
    NEW.subtotal          IS DISTINCT FROM OLD.subtotal          OR
    NEW.shipping_cost     IS DISTINCT FROM OLD.shipping_cost     OR
    NEW.tax_amount        IS DISTINCT FROM OLD.tax_amount        OR
    NEW.discount_amount   IS DISTINCT FROM OLD.discount_amount   OR
    NEW.total             IS DISTINCT FROM OLD.total             OR
    NEW.shipping_address  IS DISTINCT FROM OLD.shipping_address  OR
    NEW.user_id           IS DISTINCT FROM OLD.user_id
  ) THEN
    RAISE EXCEPTION
      'Order % is immutable after payment: financial and address fields cannot be changed.',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Runs BEFORE the transition guard so the exception message is clear
DROP TRIGGER IF EXISTS orders_immutability_check ON public.orders;
CREATE TRIGGER orders_immutability_check
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_immutability();

-- order_items: block all writes once parent order is paid
CREATE OR REPLACE FUNCTION public.enforce_order_items_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = COALESCE(NEW.order_id, OLD.order_id)
      AND status IN ('paid', 'shipped', 'delivered')
  ) THEN
    RAISE EXCEPTION
      'Cannot modify order_items for a paid/shipped order (order_id: %)',
      COALESCE(NEW.order_id, OLD.order_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS order_items_immutability ON public.order_items;
CREATE TRIGGER order_items_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_items_immutability();

-- ============================================================
-- 4. PENDING ORDER LIMIT — max 3 pending/processing orders per user
--    Prevents cart-spamming and stock soft-holds.
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
  ) >= 3 THEN
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
-- 5. AUTO-EXPIRE stale pending orders (>2 hours old)
--    Run this via a Supabase pg_cron job:
--      SELECT cron.schedule('expire-pending-orders', '*/15 * * * *',
--        $$SELECT public.expire_stale_pending_orders()$$);
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_stale_pending_orders()
RETURNS INTEGER LANGUAGE plpgsql AS $$
BEGIN
  RETURN (
    WITH expired AS (
    UPDATE public.orders
       SET status = 'cancelled'
     WHERE status IN ('pending', 'processing')
       AND created_at < NOW() - INTERVAL '2 hours'
     RETURNING id
    )
    SELECT COUNT(*) FROM expired
  );
END;
$$;

-- ============================================================
-- 6. UPDATE stock management trigger to handle new statuses
--    processing/requires_action don't touch stock yet — only 'paid' does.
-- ============================================================

CREATE OR REPLACE FUNCTION public.manage_stock_on_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- DEDUCT only when reaching 'paid' from a pre-payment state
  IF NEW.status = 'paid' AND OLD.status IN ('pending', 'processing', 'requires_action') THEN
    FOR item IN
      SELECT product_id, quantity
        FROM public.order_items
       WHERE order_id = NEW.id
    LOOP
      UPDATE public.products
         SET stock_quantity = stock_quantity - item.quantity
       WHERE id = item.product_id
         AND stock_quantity >= item.quantity;

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'Insufficient stock for product % when confirming order %',
          item.product_id, NEW.id;
      END IF;
    END LOOP;
  END IF;

  -- RESTORE when cancelled/failed from a pre-payment state
  -- (stock was never deducted for pre-payment states, nothing to restore)
  IF NEW.status IN ('failed', 'cancelled') AND OLD.status = 'paid' THEN
    UPDATE public.products p
       SET stock_quantity = p.stock_quantity + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id
       AND oi.product_id = p.id;
  END IF;

  RETURN NEW;
END;
$$;
