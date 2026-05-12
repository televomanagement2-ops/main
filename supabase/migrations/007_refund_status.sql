-- ============================================================
-- MIGRATION 007 — Refund status support
-- Run after 006_remove_order_limit.sql
-- ============================================================

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';

-- Update status transition guard to allow refunds
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'pending'         AND NEW.status IN ('processing', 'requires_action', 'paid', 'failed', 'cancelled')) OR
    (OLD.status = 'processing'      AND NEW.status IN ('requires_action', 'paid', 'failed', 'cancelled')) OR
    (OLD.status = 'requires_action' AND NEW.status IN ('paid', 'failed', 'cancelled')) OR
    (OLD.status = 'paid'            AND NEW.status IN ('shipped', 'cancelled', 'refunded')) OR
    (OLD.status = 'shipped'         AND NEW.status IN ('delivered', 'refunded')) OR
    (OLD.status = 'delivered'       AND NEW.status = 'refunded')
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % → % (order %)',
      OLD.status, NEW.status, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_transition ON public.orders;
CREATE TRIGGER orders_status_transition
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();

-- Keep orders immutable after payment or refund
CREATE OR REPLACE FUNCTION public.enforce_order_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status NOT IN ('paid', 'shipped', 'delivered', 'refunded') THEN
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS orders_immutability_check ON public.orders;
CREATE TRIGGER orders_immutability_check
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_immutability();

-- order_items immutability after payment or refund
CREATE OR REPLACE FUNCTION public.enforce_order_items_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = COALESCE(NEW.order_id, OLD.order_id)
      AND status IN ('paid', 'shipped', 'delivered', 'refunded')
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

-- Handle stock when refunding a paid order
CREATE OR REPLACE FUNCTION public.manage_stock_on_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

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

  IF NEW.status IN ('failed', 'cancelled', 'refunded') AND OLD.status = 'paid' THEN
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
