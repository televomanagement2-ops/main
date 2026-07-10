-- ============================================================
-- PRODUCTION FIXES — run this AFTER schema.sql + rls.sql
-- Safe to run on a fresh DB or as a migration on existing data.
-- ============================================================

-- ============================================================
-- FIX 1: ORDER STATUS — replace enum, add valid-transition guard
-- ============================================================
-- Adds 'processing' and 'requires_action' (used by Stripe webhook)
-- Removes 'confirmed' and 'refunded' (not mapped to any Stripe event)
-- Lifecycle: pending → requires_action → paid → shipped → delivered
--            pending → processing → paid → shipped → delivered
--            pending/processing/requires_action → failed / cancelled

-- Step 1a: migrate existing rows away from values being removed
-- 'confirmed' and 'processing' (old) → 'pending'  (will re-enter processing via webhook)
-- 'refunded' → 'cancelled'
UPDATE public.orders SET status = 'pending'   WHERE status::text = 'confirmed';
UPDATE public.orders SET status = 'cancelled' WHERE status::text = 'refunded';

-- Step 1b: drop RLS policies that reference the status column so PostgreSQL
-- allows the column type change, then recreate them after.
DROP POLICY IF EXISTS "orders: owner cancel" ON public.orders;
DROP POLICY IF EXISTS "orders: admin update"  ON public.orders;

-- rename old enum, create clean one, swap column, drop old
ALTER TYPE order_status RENAME TO order_status_old;

CREATE TYPE order_status AS ENUM (
  'pending',          -- created, awaiting Stripe redirect
  'processing',       -- Stripe session open / payment in flight
  'requires_action',  -- 3DS or additional action required
  'paid',             -- Stripe confirmed payment
  'failed',           -- Stripe payment failed
  'cancelled',        -- cancelled before payment completes
  'shipped',          -- fulfillment dispatched
  'delivered'         -- confirmed delivery
);

ALTER TABLE public.orders
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE order_status
    USING status::text::order_status,
  ALTER COLUMN status SET DEFAULT 'pending';

DROP TYPE order_status_old;

-- Step 1c: enforce valid transitions at the DB level.
-- Prevents any caller (including service-role) from making illegal jumps.
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'pending'          AND NEW.status IN ('processing', 'requires_action', 'paid', 'failed', 'cancelled')) OR
    (OLD.status = 'processing'       AND NEW.status IN ('requires_action', 'paid', 'failed', 'cancelled')) OR
    (OLD.status = 'requires_action'  AND NEW.status IN ('paid', 'failed', 'cancelled')) OR
    (OLD.status = 'paid'             AND NEW.status IN ('shipped', 'cancelled')) OR
    (OLD.status = 'shipped'          AND NEW.status = 'delivered')
    -- failed / cancelled / delivered are terminal
  ) THEN
    RAISE EXCEPTION
      'Invalid order status transition: % → % (order %)',
      OLD.status, NEW.status, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_transition ON public.orders;
CREATE TRIGGER orders_status_transition
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();

-- Recreate the RLS policies dropped above (now status column is the new enum type)
CREATE POLICY "orders: owner cancel"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    status = 'cancelled' AND
    (SELECT status FROM public.orders WHERE id = orders.id) = 'pending'
  );

CREATE POLICY "orders: admin update"
  ON public.orders FOR UPDATE
  USING (public.is_admin());

-- ============================================================
-- FIX 2: STOCK MANAGEMENT — deduct on 'paid', restore on cancel
-- ============================================================
-- OLD: stock deducted on order_items INSERT (before payment confirmed).
-- NEW: deduct only when status reaches 'paid'; restore on failed/cancelled
--      IF order was previously paid. Row-level FOR UPDATE prevents races.

DROP TRIGGER IF EXISTS order_item_deduct_stock ON public.order_items;
DROP FUNCTION IF EXISTS public.deduct_stock();

DROP TRIGGER IF EXISTS order_restore_stock ON public.orders;
DROP FUNCTION IF EXISTS public.restore_stock();

CREATE OR REPLACE FUNCTION public.manage_stock_on_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- DEDUCT: any path that lands on 'paid' for the first time
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

  -- RESTORE: order fails or is cancelled after payment was already taken
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

DROP TRIGGER IF EXISTS orders_manage_stock ON public.orders;
CREATE TRIGGER orders_manage_stock
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.manage_stock_on_status_change();

-- ============================================================
-- FIX 3: STRIPE FIELDS — add stripe_session_id
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_session
  ON public.orders(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_intent
  ON public.orders(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- (FIX 4 removed: the DB cart no longer exists — localStorage cart only.)

-- ============================================================
-- FIX 5: DATA INTEGRITY — price/quantity checks on order_items
-- ============================================================
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_unit_price_check,
  ADD  CONSTRAINT order_items_unit_price_check  CHECK (unit_price >= 0),
  DROP CONSTRAINT IF EXISTS order_items_total_price_check,
  ADD  CONSTRAINT order_items_total_price_check
    CHECK (total_price = ROUND(unit_price * quantity, 2));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shipping_address_check,
  ADD  CONSTRAINT orders_shipping_address_check CHECK (
    shipping_address ? 'full_name' AND
    shipping_address ? 'line1'     AND
    shipping_address ? 'city'      AND
    shipping_address ? 'state'     AND
    shipping_address ? 'postal_code' AND
    shipping_address ? 'country'
  );

-- ============================================================
-- FIX 6: INDEXES — fill any remaining gaps
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category  ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id     ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON public.orders(user_id, created_at DESC);
