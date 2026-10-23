-- ============================================================
-- MIGRATION 024 — Order operations: timeline, partial refunds, returns,
--                 exchanges, invoices
-- Run after 023_inventory_and_alerts.sql
-- ============================================================
-- 1. order_events: one timeline per order — status changes, tracking,
--    refunds, exchanges, review flags (all written by triggers or by the
--    functions below) and the admin's internal notes.
-- 2. order_refunds: every refund of an order, not just the last one. A refund
--    can name lines and quantities, and say for each line whether the goods go
--    back on the shelf. order_items.refunded_quantity / restocked_quantity
--    keep count, so a later full refund or cancellation only puts back what
--    has not been put back already.
--    Before this, one order could be refunded exactly once (the Stripe
--    idempotency key was the order id) and a partial refund never touched
--    stock.
-- 3. manage_stock_on_status_change() learns restocked_quantity, has_colors
--    and the inventory log's reasons.
-- 4. admin_exchange_order_item(): swap a line to another size or colour of
--    the same product (the whole line or part of it), moving stock both ways.
-- 5. Invoice numbers: gapless per calendar year, issued on first print.
-- 6. A processing / requires_action order can no longer be cancelled, failed
--    or marked paid by a signed-in user writing the row directly: the Stripe
--    session has to be closed (or checked) first, which only the order
--    actions do. (The service role and pg_cron are unaffected.)
-- 7. admin_analytics() gains refunds, discounts, margin and stock figures.
-- 8. Discount bookkeeping columns used by 025 (orders.discount_code,
--    orders.shipping_discount, order_items.discount_amount).
--
-- Idempotent. If 003, 005, 007, 013 or 021 is ever run again, run this file
-- again after it (they define the stock and immutability triggers).
-- ============================================================

-- ============================================================
-- 1. COLUMNS
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS refunded_quantity  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restocked_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_refunded_quantity_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_refunded_quantity_check CHECK (refunded_quantity BETWEEN 0 AND quantity);
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_restocked_quantity_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_restocked_quantity_check CHECK (restocked_quantity BETWEEN 0 AND quantity);
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_discount_amount_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_discount_amount_check CHECK (discount_amount >= 0 AND discount_amount <= total_price);

COMMENT ON COLUMN public.order_items.refunded_quantity IS
  'Units of this line refunded so far.';
COMMENT ON COLUMN public.order_items.restocked_quantity IS
  'Units of this line put back into stock so far (returned, cancelled or refunded before shipping).';
COMMENT ON COLUMN public.order_items.discount_amount IS
  'This line''s share of the order''s discount code (migration 025).';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_number    TEXT,
  ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMPTZ;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_shipping_discount_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_discount_check
    CHECK (shipping_discount >= 0 AND shipping_discount <= shipping_cost AND shipping_discount <= discount_amount);

CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_key
  ON public.orders(invoice_number) WHERE invoice_number IS NOT NULL;

COMMENT ON COLUMN public.orders.shipping_discount IS
  'Part of discount_amount that applies to shipping (a free-shipping code).';

-- ============================================================
-- 2. IMMUTABILITY — what may still change after payment
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_order_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status NOT IN ('paid', 'shipped', 'delivered', 'refunded') THEN
    RETURN NEW;
  END IF;

  IF (NEW.subtotal, NEW.shipping_cost, NEW.tax_amount, NEW.discount_amount, NEW.shipping_discount,
      NEW.discount_code, NEW.total, NEW.shipping_address, NEW.user_id)
     IS DISTINCT FROM
     (OLD.subtotal, OLD.shipping_cost, OLD.tax_amount, OLD.discount_amount, OLD.shipping_discount,
      OLD.discount_code, OLD.total, OLD.shipping_address, OLD.user_id) THEN
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

-- The lines of a paid order stay frozen, except through two doors that only
-- the functions in this file open (transaction-local app.order_items_write):
--   refund   — refunded_quantity / restocked_quantity only
--   exchange — the variant and its snapshot, and a split of the line in two
--              (quantity, total and discount share move, the unit price never)
CREATE OR REPLACE FUNCTION public.enforce_order_items_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ctx     TEXT := NULLIF(current_setting('app.order_items_write', true), '');
  allowed TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.orders
     WHERE id = COALESCE(NEW.order_id, OLD.order_id)
       AND status IN ('paid', 'shipped', 'delivered', 'refunded')
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' AND ctx IN ('refund', 'exchange') THEN
    allowed := CASE ctx
      WHEN 'refund' THEN
        ARRAY['refunded_quantity', 'restocked_quantity']
      ELSE
        ARRAY['variant_id', 'selected_size', 'selected_color', 'sku', 'product_image',
              'quantity', 'total_price', 'discount_amount', 'refunded_quantity', 'restocked_quantity']
    END;
    IF (to_jsonb(NEW) - allowed) IS NOT DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' AND ctx = 'exchange' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Cannot modify order_items for a paid/shipped order (order_id: %)',
    COALESCE(NEW.order_id, OLD.order_id);
END;
$$;

DROP TRIGGER IF EXISTS order_items_immutability ON public.order_items;
CREATE TRIGGER order_items_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_items_immutability();

-- rls.sql once let a customer add lines to their own unpaid order. No live
-- database should still have it; this makes sure.
DROP POLICY IF EXISTS "order_items: owner insert" ON public.order_items;

-- ============================================================
-- 3. ORDER TIMELINE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.order_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  message     TEXT,
  data        JSONB,
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_events_kind_check CHECK (
    kind IN ('note', 'status', 'tracking', 'refund', 'exchange', 'review', 'payment', 'invoice', 'email')
  ),
  CONSTRAINT order_events_message_check CHECK (length(COALESCE(message, '')) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_order_events_order
  ON public.order_events(order_id, created_at);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_events: admin read" ON public.order_events;
CREATE POLICY "order_events: admin read"
  ON public.order_events FOR SELECT
  USING (public.is_admin());

-- Admins write notes only, signed as themselves. Everything else in the
-- timeline is written by the database.
DROP POLICY IF EXISTS "order_events: admin note" ON public.order_events;
CREATE POLICY "order_events: admin note"
  ON public.order_events FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND kind = 'note'
    AND actor_id = auth.uid()
    AND length(btrim(COALESCE(message, ''))) BETWEEN 1 AND 2000
  );

DROP POLICY IF EXISTS "order_events: admin delete note" ON public.order_events;
CREATE POLICY "order_events: admin delete note"
  ON public.order_events FOR DELETE
  USING (public.is_admin() AND kind = 'note');

REVOKE ALL ON public.order_events FROM anon;
REVOKE UPDATE, TRUNCATE ON public.order_events FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := (SELECT p.id FROM public.profiles p WHERE p.id = auth.uid());
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events (order_id, kind, data, actor_id)
    VALUES (NEW.id, 'status', jsonb_build_object('from', OLD.status, 'to', NEW.status), v_actor);
  END IF;

  IF NEW.tracking_id IS DISTINCT FROM OLD.tracking_id AND NEW.tracking_id IS NOT NULL THEN
    INSERT INTO public.order_events (order_id, kind, data, actor_id)
    VALUES (NEW.id, 'tracking', jsonb_build_object('tracking_id', NEW.tracking_id), v_actor);
  END IF;

  IF NEW.needs_review IS DISTINCT FROM OLD.needs_review THEN
    INSERT INTO public.order_events (order_id, kind, data, actor_id)
    VALUES (
      NEW.id,
      'review',
      jsonb_build_object(
        'flagged', NEW.needs_review,
        'reason', CASE WHEN NEW.needs_review THEN NEW.review_reason ELSE OLD.review_reason END
      ),
      v_actor
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS orders_log_changes ON public.orders;
CREATE TRIGGER orders_log_changes
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_changes();

-- Clears the "needs review" flag (the reason stays in the timeline).
CREATE OR REPLACE FUNCTION public.admin_resolve_review(p_order_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders
     SET needs_review = FALSE, review_reason = NULL
   WHERE id = p_order_id AND needs_review;

  IF public.normalize_label(p_note) IS NOT NULL THEN
    INSERT INTO public.order_events (order_id, kind, message, actor_id)
    VALUES (p_order_id, 'note', left(btrim(p_note), 2000), auth.uid());
  END IF;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_resolve_review(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_resolve_review(UUID, TEXT) TO authenticated;

-- ============================================================
-- 4. STOCK ON STATUS CHANGES (final form)
-- ============================================================
-- Same policy as 013/021: deduct on the first 'paid', restore when a paid
-- order fails / is cancelled / is refunded, never raise (the customer has
-- already been charged), flag needs_review when a counter goes negative.
-- New here:
--   • only what has not been put back already is restored (a line returned
--     through a partial refund was restocked then);
--   • app.skip_auto_restock: a refund issued through complete_order_refund()
--     has already restocked exactly the lines the admin chose;
--   • a refund after shipping restocks nothing (the goods are with the
--     customer) but marks every line refunded;
--   • products with colours behave like products with sizes;
--   • every movement is labelled for the inventory log.

CREATE OR REPLACE FUNCTION public.manage_stock_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  direction    INTEGER;
  item         RECORD;
  qty          INTEGER;
  remaining    INTEGER;
  skip_restock BOOLEAN := current_setting('app.skip_auto_restock', true) = 'on';
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'refunded' AND OLD.status IN ('shipped', 'delivered') THEN
    PERFORM set_config('app.order_items_write', 'refund', true);
    UPDATE public.order_items
       SET refunded_quantity = quantity
     WHERE order_id = NEW.id
       AND refunded_quantity <> quantity;
    PERFORM set_config('app.order_items_write', '', true);
    RETURN NEW;
  END IF;

  IF NEW.status = 'paid' AND OLD.status IN ('pending', 'processing', 'requires_action') THEN
    direction := -1;
  ELSIF NEW.status IN ('failed', 'cancelled', 'refunded') AND OLD.status = 'paid' THEN
    direction := 1;
  ELSE
    RETURN NEW;
  END IF;

  -- Every product this order touches, locked in id order before any variant
  -- row: every stock writer takes the same locks in the same order.
  PERFORM 1
     FROM public.products
    WHERE id IN (SELECT product_id FROM public.order_items WHERE order_id = NEW.id)
    ORDER BY id
      FOR UPDATE;

  PERFORM public.set_stock_context(
    CASE WHEN direction < 0 THEN 'sale'
         WHEN NEW.status = 'refunded' THEN 'refund'
         ELSE 'cancel' END,
    NEW.id,
    NULL
  );
  PERFORM set_config('app.order_items_write', 'refund', true);

  FOR item IN
    SELECT oi.id,
           oi.product_id,
           oi.quantity,
           oi.restocked_quantity,
           (p.has_sizes OR p.has_colors) AS has_variants,
           -- Lines written before 021 carry no variant_id; they resolve by
           -- the size they recorded.
           COALESCE(
             oi.variant_id,
             (SELECT v.id
                FROM public.product_variants v
               WHERE v.product_id = oi.product_id
                 AND v.color_id IS NULL
                 AND v.size = oi.selected_size)
           ) AS variant_id
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = NEW.id
     ORDER BY oi.product_id, oi.id
  LOOP
    IF direction < 0 THEN
      qty := item.quantity;
    ELSIF skip_restock THEN
      qty := 0;
    ELSE
      qty := item.quantity - item.restocked_quantity;
    END IF;

    IF qty > 0 THEN
      IF item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
           SET stock_qty = stock_qty + direction * qty
         WHERE id = item.variant_id
         RETURNING stock_qty INTO remaining;

        IF direction < 0 AND remaining < 0 THEN
          NEW.needs_review  := TRUE;
          NEW.review_reason := COALESCE(NEW.review_reason, 'oversold');
        END IF;
      ELSIF item.has_variants AND direction < 0 THEN
        -- Sold without a variant that matches a stock row. Checkout refuses
        -- this, so only a hand-written line gets here: honoured, flagged.
        NEW.needs_review  := TRUE;
        NEW.review_reason := COALESCE(NEW.review_reason, 'variant not matched to stock');
      END IF;

      -- A product with variants has a derived total; only one without
      -- carries its own counter.
      IF NOT item.has_variants THEN
        UPDATE public.products
           SET stock_quantity = stock_quantity + direction * qty
         WHERE id = item.product_id
         RETURNING stock_quantity INTO remaining;

        IF direction < 0 AND remaining < 0 THEN
          NEW.needs_review  := TRUE;
          NEW.review_reason := COALESCE(NEW.review_reason, 'oversold');
        END IF;
      END IF;
    END IF;

    IF direction > 0 THEN
      UPDATE public.order_items
         SET restocked_quantity = CASE WHEN skip_restock THEN restocked_quantity ELSE quantity END,
             refunded_quantity  = CASE WHEN NEW.status = 'refunded' THEN quantity ELSE refunded_quantity END
       WHERE id = item.id;
    END IF;
  END LOOP;

  PERFORM set_config('app.order_items_write', '', true);
  PERFORM public.set_stock_context(NULL);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_manage_stock ON public.orders;
CREATE TRIGGER orders_manage_stock
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.manage_stock_on_status_change();

-- ============================================================
-- 5. REFUNDS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.order_refunds (
  -- Chosen by the caller for a new refund: it doubles as the Stripe
  -- idempotency key, so a double click is one refund, not two.
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_refund_id TEXT UNIQUE,
  amount           NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  status           TEXT NOT NULL DEFAULT 'pending',
  source           TEXT NOT NULL DEFAULT 'admin',
  reason           TEXT,
  -- [{ order_item_id, quantity, restock }]
  lines            JSONB NOT NULL DEFAULT '[]'::JSONB,
  shipping_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  applied_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_refunds_status_check CHECK (status IN ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')),
  CONSTRAINT order_refunds_source_check CHECK (source IN ('admin', 'customer', 'stripe')),
  CONSTRAINT order_refunds_reason_check CHECK (length(COALESCE(reason, '')) <= 500),
  CONSTRAINT order_refunds_lines_check CHECK (jsonb_typeof(lines) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order ON public.order_refunds(order_id);

DROP TRIGGER IF EXISTS order_refunds_updated_at ON public.order_refunds;
CREATE TRIGGER order_refunds_updated_at
  BEFORE UPDATE ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_refunds: admin read" ON public.order_refunds;
CREATE POLICY "order_refunds: admin read"
  ON public.order_refunds FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON public.order_refunds FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_refunds FROM authenticated;

-- Refunds that count against what is left to refund.
CREATE OR REPLACE FUNCTION public.order_refunded_total(p_order_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
    FROM public.order_refunds
   WHERE order_id = p_order_id
     AND status IN ('pending', 'requires_action', 'succeeded');
$$;

REVOKE ALL ON FUNCTION public.order_refunded_total(UUID) FROM PUBLIC, anon, authenticated;

-- Step 1 of a refund (service role, before Stripe is called): validates
-- against what is left to refund and records the request. Idempotent on
-- p_request_id. Errors carry a HINT for the admin UI:
-- order_not_found | not_refundable | no_payment | invalid_amount |
-- amount_too_high (DETAIL = what is left) | shipping_too_high | invalid_line
CREATE OR REPLACE FUNCTION public.begin_order_refund(
  p_request_id UUID,
  p_order_id   UUID,
  p_amount     NUMERIC,
  p_lines      JSONB   DEFAULT '[]'::JSONB,
  p_shipping   NUMERIC DEFAULT 0,
  p_reason     TEXT    DEFAULT NULL,
  p_source     TEXT    DEFAULT 'admin',
  p_actor      UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord           public.orders;
  existing      public.order_refunds;
  item          public.order_items;
  elem          JSONB;
  v_lines       JSONB := '[]'::JSONB;
  v_seen        UUID[] := '{}';
  v_qty         INTEGER;
  v_pending     INTEGER;
  v_refunded    NUMERIC;
  v_ship_done   NUMERIC;
  v_remaining   NUMERIC;
  v_amount      NUMERIC := round(p_amount, 2);
  v_shipping    NUMERIC := round(COALESCE(p_shipping, 0), 2);
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A refund request id is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = '22023', HINT = 'order_not_found';
  END IF;

  SELECT * INTO existing FROM public.order_refunds WHERE id = p_request_id;
  IF FOUND THEN
    IF existing.order_id <> p_order_id THEN
      RAISE EXCEPTION 'This refund request belongs to another order.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
      'id', existing.id, 'existing', TRUE, 'status', existing.status,
      'stripe_refund_id', existing.stripe_refund_id, 'amount', existing.amount,
      'payment_intent', ord.stripe_payment_intent_id
    );
  END IF;

  IF ord.status NOT IN ('paid', 'shipped', 'delivered') THEN
    RAISE EXCEPTION 'An order in status % cannot be refunded.', ord.status
      USING ERRCODE = '22023', HINT = 'not_refundable';
  END IF;
  IF ord.stripe_payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'This order has no Stripe payment to refund.' USING ERRCODE = '22023', HINT = 'no_payment';
  END IF;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(shipping_amount), 0)
    INTO v_refunded, v_ship_done
    FROM public.order_refunds
   WHERE order_id = ord.id
     AND status IN ('pending', 'requires_action', 'succeeded');
  -- A refund recorded only on the order (before this table) still counts.
  v_refunded  := GREATEST(v_refunded, COALESCE(ord.refund_amount, 0));
  v_remaining := ord.total - v_refunded;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'The refund amount must be more than zero.' USING ERRCODE = '22023', HINT = 'invalid_amount';
  END IF;
  IF v_amount > v_remaining + 0.005 THEN
    RAISE EXCEPTION 'Only % is left to refund on this order.', v_remaining
      USING ERRCODE = '22023', HINT = 'amount_too_high', DETAIL = v_remaining::TEXT;
  END IF;
  IF v_shipping < 0 OR v_shipping > ord.shipping_cost - ord.shipping_discount - v_ship_done + 0.005 THEN
    RAISE EXCEPTION 'The shipping refund is more than the shipping paid.' USING ERRCODE = '22023', HINT = 'shipping_too_high';
  END IF;

  IF jsonb_typeof(COALESCE(p_lines, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'p_lines must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  FOR elem IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::JSONB)) LOOP
    SELECT * INTO item
      FROM public.order_items
     WHERE id = (elem->>'order_item_id')::UUID
       AND order_id = ord.id;
    IF NOT FOUND OR item.id = ANY (v_seen) THEN
      RAISE EXCEPTION 'A refunded line is not on this order, or is listed twice.'
        USING ERRCODE = '22023', HINT = 'invalid_line';
    END IF;
    v_seen := v_seen || item.id;

    -- Units promised by refunds that have not been applied yet.
    SELECT COALESCE(SUM((l.value->>'quantity')::INTEGER), 0)
      INTO v_pending
      FROM public.order_refunds r
     CROSS JOIN LATERAL jsonb_array_elements(r.lines) AS l(value)
     WHERE r.order_id = ord.id
       AND r.applied_at IS NULL
       AND r.status IN ('pending', 'requires_action', 'succeeded')
       AND (l.value->>'order_item_id')::UUID = item.id;

    v_qty := (elem->>'quantity')::INTEGER;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > item.quantity - item.refunded_quantity - v_pending THEN
      RAISE EXCEPTION 'Line "%" has only % unit(s) left to refund.',
        item.product_name, item.quantity - item.refunded_quantity - v_pending
        USING ERRCODE = '22023', HINT = 'invalid_line', DETAIL = item.id::TEXT;
    END IF;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'order_item_id', item.id,
      'quantity',      v_qty,
      'restock',       COALESCE((elem->>'restock')::BOOLEAN, FALSE)
    ));
  END LOOP;

  INSERT INTO public.order_refunds
    (id, order_id, amount, status, source, reason, lines, shipping_amount, created_by)
  VALUES (
    p_request_id, ord.id, v_amount, 'pending',
    CASE WHEN p_source IN ('admin', 'customer', 'stripe') THEN p_source ELSE 'admin' END,
    NULLIF(btrim(left(COALESCE(p_reason, ''), 500)), ''),
    v_lines, v_shipping,
    (SELECT p.id FROM public.profiles p WHERE p.id = p_actor)
  );

  RETURN jsonb_build_object(
    'id', p_request_id, 'existing', FALSE, 'status', 'pending', 'amount', v_amount,
    'payment_intent', ord.stripe_payment_intent_id, 'remaining', v_remaining
  );
END;
$$;

-- Stripe refused the refund: nothing happened, drop the request.
CREATE OR REPLACE FUNCTION public.abandon_order_refund(p_request_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.order_refunds
   WHERE id = p_request_id
     AND stripe_refund_id IS NULL
     AND applied_at IS NULL;
$$;

-- Step 2 (service role, once Stripe has accepted the refund): links the
-- Stripe refund, applies the lines — refunded counts, and stock for the lines
-- marked restock — and updates the order. A refund that covers what is left
-- moves the order to 'refunded'.
CREATE OR REPLACE FUNCTION public.complete_order_refund(
  p_request_id       UUID,
  p_stripe_refund_id TEXT,
  p_status           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r            public.order_refunds;
  ord          public.orders;
  item         public.order_items;
  elem         JSONB;
  v_qty        INTEGER;
  v_restock    INTEGER;
  v_variant    UUID;
  v_varied     BOOLEAN;
  v_total      NUMERIC;
  v_full       BOOLEAN;
  v_order_id   UUID;
BEGIN
  SELECT order_id INTO v_order_id FROM public.order_refunds WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund request not found.' USING ERRCODE = '22023';
  END IF;

  -- Same order as begin_order_refund and the webhook: the order row first.
  SELECT * INTO ord FROM public.orders WHERE id = v_order_id FOR UPDATE;

  UPDATE public.order_refunds
     SET stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id),
         status = CASE WHEN p_status IN ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')
                       THEN p_status ELSE status END
   WHERE id = p_request_id
  RETURNING * INTO r;

  IF r.applied_at IS NULL AND r.status IN ('pending', 'requires_action', 'succeeded') THEN
    PERFORM 1
       FROM public.products
      WHERE id IN (
              SELECT oi.product_id
                FROM public.order_items oi
               WHERE oi.id IN (SELECT (l.value->>'order_item_id')::UUID FROM jsonb_array_elements(r.lines) AS l(value))
            )
      ORDER BY id
        FOR UPDATE;

    PERFORM public.set_stock_context('return', ord.id, r.reason);
    PERFORM set_config('app.order_items_write', 'refund', true);

    FOR elem IN SELECT value FROM jsonb_array_elements(r.lines) LOOP
      SELECT * INTO item
        FROM public.order_items
       WHERE id = (elem->>'order_item_id')::UUID
         FOR UPDATE;
      CONTINUE WHEN NOT FOUND;

      v_qty := LEAST((elem->>'quantity')::INTEGER, item.quantity - item.refunded_quantity);
      CONTINUE WHEN v_qty <= 0;

      v_restock := CASE
                     WHEN COALESCE((elem->>'restock')::BOOLEAN, FALSE)
                       THEN LEAST(v_qty, item.quantity - item.restocked_quantity)
                     ELSE 0
                   END;

      UPDATE public.order_items
         SET refunded_quantity  = refunded_quantity + v_qty,
             restocked_quantity = restocked_quantity + v_restock
       WHERE id = item.id;

      IF v_restock > 0 THEN
        SELECT (p.has_sizes OR p.has_colors) INTO v_varied FROM public.products p WHERE p.id = item.product_id;
        v_variant := COALESCE(
          item.variant_id,
          (SELECT v.id FROM public.product_variants v
            WHERE v.product_id = item.product_id
              AND v.color_id IS NULL
              AND v.size = item.selected_size)
        );
        IF v_variant IS NOT NULL THEN
          UPDATE public.product_variants SET stock_qty = stock_qty + v_restock WHERE id = v_variant;
        END IF;
        IF NOT v_varied THEN
          UPDATE public.products SET stock_quantity = stock_quantity + v_restock WHERE id = item.product_id;
        END IF;
      END IF;
    END LOOP;

    UPDATE public.order_refunds SET applied_at = NOW() WHERE id = r.id;
    PERFORM set_config('app.order_items_write', '', true);
    PERFORM public.set_stock_context(NULL);
  END IF;

  v_total := public.order_refunded_total(ord.id);
  v_full  := v_total >= ord.total - 0.005;

  -- The lines this refund covers were handled above, exactly as asked (a
  -- damaged item may stay off the shelf): the status change must not put the
  -- rest back on its own.
  IF v_full AND ord.status IN ('paid', 'shipped', 'delivered') THEN
    PERFORM set_config('app.skip_auto_restock', 'on', true);
  END IF;

  UPDATE public.orders
     SET refund_amount       = v_total,
         refunded_at         = NOW(),
         refund_id           = COALESCE(r.stripe_refund_id, refund_id),
         refund_requested_by = COALESCE(r.created_by, refund_requested_by),
         status              = CASE
                                 WHEN v_full AND status IN ('paid', 'shipped', 'delivered')
                                   THEN 'refunded'::order_status
                                 ELSE status
                               END
   WHERE id = ord.id
  RETURNING * INTO ord;

  PERFORM set_config('app.skip_auto_restock', '', true);

  INSERT INTO public.order_events (order_id, kind, message, data, actor_id)
  VALUES (
    ord.id, 'refund', r.reason,
    jsonb_build_object(
      'refund_id', r.id, 'amount', r.amount, 'shipping', r.shipping_amount, 'lines', r.lines,
      'status', r.status, 'source', r.source, 'stripe_refund_id', r.stripe_refund_id
    ),
    r.created_by
  );

  RETURN jsonb_build_object(
    'order_id', ord.id, 'refund_id', r.id, 'refund_amount', v_total,
    'full', v_full, 'status', ord.status
  );
END;
$$;

-- The webhook's view (service role): mirrors every Stripe refund of a
-- payment — including ones issued from the Stripe Dashboard — and updates the
-- order. p_refunds: [{ id, amount (in currency units), status, request_id?,
-- created? }]. A full refund made outside the app moves a paid order to
-- 'refunded', which puts its lines back in stock as before; one the app is
-- still applying does not.
CREATE OR REPLACE FUNCTION public.sync_order_refunds(
  p_payment_intent  TEXT,
  p_refunds         JSONB,
  p_amount_refunded NUMERIC,
  p_amount_charged  NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord        public.orders;
  elem       JSONB;
  v_row_id   UUID;
  v_status   TEXT;
  v_failed   TEXT[] := '{}';
  v_inserted BOOLEAN;
  v_full     BOOLEAN;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE stripe_payment_intent_id = p_payment_intent FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  FOR elem IN SELECT value FROM jsonb_array_elements(COALESCE(p_refunds, '[]'::JSONB)) LOOP
    v_status := CASE
                  WHEN elem->>'status' IN ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')
                    THEN elem->>'status'
                  ELSE 'pending'
                END;
    v_inserted := FALSE;

    SELECT id INTO v_row_id FROM public.order_refunds WHERE stripe_refund_id = elem->>'id';
    IF NOT FOUND AND (elem->>'request_id') ~ '^[0-9a-fA-F-]{36}$' THEN
      SELECT id INTO v_row_id
        FROM public.order_refunds
       WHERE id = (elem->>'request_id')::UUID AND order_id = ord.id;
    END IF;

    IF v_row_id IS NOT NULL THEN
      UPDATE public.order_refunds
         SET stripe_refund_id = elem->>'id', status = v_status
       WHERE id = v_row_id;
    ELSE
      INSERT INTO public.order_refunds
        (order_id, stripe_refund_id, amount, status, source, applied_at, created_at)
      VALUES (
        ord.id, elem->>'id', round((elem->>'amount')::NUMERIC, 2), v_status, 'stripe', NOW(),
        COALESCE((elem->>'created')::TIMESTAMPTZ, NOW())
      )
      RETURNING id INTO v_row_id;
      v_inserted := TRUE;

      INSERT INTO public.order_events (order_id, kind, data)
      VALUES (ord.id, 'refund', jsonb_build_object(
        'refund_id', v_row_id, 'amount', round((elem->>'amount')::NUMERIC, 2),
        'status', v_status, 'source', 'stripe', 'stripe_refund_id', elem->>'id'
      ));
    END IF;

    IF v_status IN ('failed', 'canceled') THEN
      v_failed := v_failed || (elem->>'id');
    END IF;
    v_row_id := NULL;
  END LOOP;

  v_full := p_amount_charged IS NOT NULL
            AND p_amount_refunded IS NOT NULL
            AND p_amount_refunded >= p_amount_charged - 0.005;

  IF v_full AND ord.status IN ('paid', 'shipped', 'delivered')
     AND EXISTS (
       SELECT 1 FROM public.order_refunds
        WHERE order_id = ord.id AND applied_at IS NULL AND source <> 'stripe'
     ) THEN
    PERFORM set_config('app.skip_auto_restock', 'on', true);
  END IF;

  UPDATE public.orders
     SET refund_amount = COALESCE(p_amount_refunded, public.order_refunded_total(ord.id)),
         refunded_at   = NOW(),
         status        = CASE
                           WHEN v_full AND status IN ('paid', 'shipped', 'delivered')
                             THEN 'refunded'::order_status
                           ELSE status
                         END,
         needs_review  = needs_review OR cardinality(v_failed) > 0,
         review_reason = CASE
                           WHEN cardinality(v_failed) > 0
                             THEN COALESCE(review_reason, 'refund failed: ' || array_to_string(v_failed, ', '))
                           ELSE review_reason
                         END
   WHERE id = ord.id;

  PERFORM set_config('app.skip_auto_restock', '', true);
  RETURN ord.id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_order_refund(UUID, UUID, NUMERIC, JSONB, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.abandon_order_refund(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_order_refund(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_order_refunds(TEXT, JSONB, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_order_refund(UUID, UUID, NUMERIC, JSONB, NUMERIC, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.abandon_order_refund(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_order_refund(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_order_refunds(TEXT, JSONB, NUMERIC, NUMERIC) TO service_role;

-- ============================================================
-- 6. EXCHANGES — another size or colour of the same product
-- ============================================================
-- The whole line, or part of it (the line is split in two at the same unit
-- price, so the order's totals never move). The new variant's stock goes
-- down; with p_restock the old one's goes back up. A price difference
-- between the variants is reported, never charged or refunded here.

CREATE OR REPLACE FUNCTION public.admin_exchange_order_item(
  p_order_item_id UUID,
  p_variant_id    UUID,
  p_quantity      INTEGER,
  p_restock       BOOLEAN DEFAULT TRUE,
  p_note          TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item         public.order_items;
  ord          public.orders;
  prod         public.products;
  new_v        public.product_variants;
  v_old_id     UUID;
  v_new_color  TEXT;
  v_old_label  TEXT;
  v_new_label  TEXT;
  v_new_image  TEXT;
  v_new_item   UUID;
  v_remaining  INTEGER;
  v_discount   NUMERIC;
  v_price_diff NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO item FROM public.order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order line not found.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO ord FROM public.orders WHERE id = item.order_id FOR UPDATE;
  IF ord.status NOT IN ('paid', 'shipped', 'delivered') THEN
    RAISE EXCEPTION 'Only a paid, shipped or delivered order can have a line exchanged.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO prod FROM public.products WHERE id = item.product_id FOR UPDATE;
  IF NOT (prod.has_sizes OR prod.has_colors) THEN
    RAISE EXCEPTION 'This product has no sizes or colours to exchange.' USING ERRCODE = '22023';
  END IF;

  -- Re-read the line now that the order is locked.
  SELECT * INTO item FROM public.order_items WHERE id = p_order_item_id FOR UPDATE;

  SELECT * INTO new_v FROM public.product_variants WHERE id = p_variant_id AND product_id = prod.id;
  IF NOT FOUND OR NOT new_v.is_active
     OR (prod.has_sizes AND new_v.size IS NULL)
     OR (prod.has_colors AND new_v.color_id IS NULL) THEN
    RAISE EXCEPTION 'Choose a variant of the same product that is on sale.' USING ERRCODE = '22023';
  END IF;

  v_old_id := COALESCE(
    item.variant_id,
    (SELECT v.id FROM public.product_variants v
      WHERE v.product_id = item.product_id AND v.color_id IS NULL AND v.size = item.selected_size)
  );
  IF new_v.id = v_old_id THEN
    RAISE EXCEPTION 'That is already the variant on the order.' USING ERRCODE = '22023';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > item.quantity - item.refunded_quantity THEN
    RAISE EXCEPTION 'Only % unit(s) of this line can be exchanged.', item.quantity - item.refunded_quantity
      USING ERRCODE = '22023';
  END IF;

  SELECT c.name INTO v_new_color FROM public.product_colors c WHERE c.id = new_v.color_id;
  v_old_label := concat_ws(' / ', item.selected_color, item.selected_size);
  v_new_label := concat_ws(' / ', v_new_color, new_v.size);
  v_price_diff := COALESCE(new_v.price, prod.price) - item.unit_price;
  SELECT im.url INTO v_new_image
    FROM public.product_images im
   WHERE im.product_id = prod.id
     AND new_v.color_id IS NOT NULL
     AND im.color_id = new_v.color_id
   ORDER BY im.is_primary DESC, im.sort_order
   LIMIT 1;

  PERFORM set_config('app.order_items_write', 'exchange', true);
  PERFORM public.set_stock_context('exchange', ord.id, p_note);

  IF p_quantity = item.quantity THEN
    UPDATE public.order_items
       SET variant_id     = new_v.id,
           selected_size  = new_v.size,
           selected_color = v_new_color,
           sku            = COALESCE(new_v.sku, prod.sku),
           product_image  = COALESCE(v_new_image, product_image)
     WHERE id = item.id;
    v_new_item := item.id;
  ELSE
    v_discount := round(item.discount_amount * p_quantity / item.quantity, 2);

    UPDATE public.order_items
       SET quantity        = quantity - p_quantity,
           total_price     = round(unit_price * (quantity - p_quantity), 2),
           discount_amount = discount_amount - v_discount
     WHERE id = item.id;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, product_image, unit_price, quantity,
      total_price, selected_size, selected_color, sku, discount_amount
    )
    VALUES (
      item.order_id, item.product_id, new_v.id, item.product_name,
      COALESCE(v_new_image, item.product_image), item.unit_price, p_quantity,
      round(item.unit_price * p_quantity, 2), new_v.size, v_new_color,
      COALESCE(new_v.sku, prod.sku), v_discount
    )
    RETURNING id INTO v_new_item;

    INSERT INTO public.order_item_costs (order_item_id, unit_cost)
    SELECT v_new_item, oc.unit_cost FROM public.order_item_costs oc WHERE oc.order_item_id = item.id;
  END IF;

  IF p_restock AND v_old_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock_qty = stock_qty + p_quantity WHERE id = v_old_id;
  END IF;

  UPDATE public.product_variants
     SET stock_qty = stock_qty - p_quantity
   WHERE id = new_v.id
  RETURNING stock_qty INTO v_remaining;

  PERFORM set_config('app.order_items_write', '', true);
  PERFORM public.set_stock_context(NULL);

  IF v_remaining < 0 THEN
    UPDATE public.orders
       SET needs_review = TRUE,
           review_reason = COALESCE(review_reason, 'oversold (exchange)')
     WHERE id = ord.id;
  END IF;

  INSERT INTO public.order_events (order_id, kind, message, data, actor_id)
  VALUES (
    ord.id, 'exchange', NULLIF(btrim(left(COALESCE(p_note, ''), 2000)), ''),
    jsonb_build_object(
      'item_id', item.id, 'new_item_id', v_new_item, 'product', item.product_name,
      'from', v_old_label, 'to', v_new_label, 'quantity', p_quantity,
      'restocked', p_restock AND v_old_id IS NOT NULL, 'price_difference', v_price_diff
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'order_id', ord.id, 'item_id', v_new_item, 'price_difference', v_price_diff,
    'oversold', v_remaining < 0
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_exchange_order_item(UUID, UUID, INTEGER, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_exchange_order_item(UUID, UUID, INTEGER, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- 7. INVOICE NUMBERS
-- ============================================================
-- Gapless within a calendar year (UTC): a number is drawn only when an
-- invoice is first issued, and the counter row is locked while it is.

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  year        INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_counters FROM anon, authenticated;

-- Issues the missing numbers, oldest order first; returns { order_id: number }.
CREATE OR REPLACE FUNCTION public.admin_issue_invoices(p_order_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord     RECORD;
  v_year  INTEGER := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'UTC'))::INTEGER;
  v_n     INTEGER;
  v_num   TEXT;
  result  JSONB := '{}'::JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_order_ids IS NULL OR cardinality(p_order_ids) = 0 OR cardinality(p_order_ids) > 200 THEN
    RAISE EXCEPTION 'Give 1 to 200 orders.' USING ERRCODE = '22023';
  END IF;

  FOR ord IN
    SELECT id, status, invoice_number
      FROM public.orders
     WHERE id = ANY (p_order_ids)
     ORDER BY created_at, id
       FOR UPDATE
  LOOP
    IF ord.invoice_number IS NOT NULL THEN
      result := result || jsonb_build_object(ord.id::TEXT, ord.invoice_number);
      CONTINUE;
    END IF;
    CONTINUE WHEN ord.status NOT IN ('paid', 'shipped', 'delivered', 'refunded');

    INSERT INTO public.invoice_counters (year, last_number)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE SET last_number = public.invoice_counters.last_number + 1
    RETURNING last_number INTO v_n;

    v_num := v_year::TEXT || '-' || lpad(v_n::TEXT, 5, '0');

    UPDATE public.orders
       SET invoice_number = v_num, invoice_issued_at = NOW()
     WHERE id = ord.id;

    INSERT INTO public.order_events (order_id, kind, data, actor_id)
    VALUES (ord.id, 'invoice', jsonb_build_object('invoice_number', v_num), auth.uid());

    result := result || jsonb_build_object(ord.id::TEXT, v_num);
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_issue_invoices(UUID[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_issue_invoices(UUID[]) TO authenticated;

-- ============================================================
-- 8. NO DIRECT SETTLING OF AN OPEN PAYMENT
-- ============================================================
-- 'processing' means a Stripe Checkout session is open and payable;
-- 'requires_action' is a payment held for review. Cancelling or failing
-- either from the admin's status menu left the session payable (money taken
-- for a cancelled order), and marking one paid skipped the check that the
-- money actually arrived. The order actions in handle-order-action do it
-- properly, as the service role, so only a signed-in user's direct write is
-- refused here.

CREATE OR REPLACE FUNCTION public.guard_order_status_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND auth.uid() IS NOT NULL
     AND OLD.status IN ('processing', 'requires_action')
     AND NEW.status IN ('paid', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'A % order is settled through the order actions, which check or close the Stripe session first.', OLD.status
      USING HINT = 'use_order_action';
  END IF;
  RETURN NEW;
END;
$$;

-- Named to run before the other BEFORE UPDATE triggers (they fire in name order).
DROP TRIGGER IF EXISTS orders_action_guard ON public.orders;
CREATE TRIGGER orders_action_guard
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_status_actions();

-- ============================================================
-- 9. ANALYTICS
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_analytics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'grossRevenue', COALESCE((
      SELECT ROUND(SUM(total), 2)
        FROM public.orders
       WHERE status IN ('paid', 'shipped', 'delivered')
    ), 0),
    -- Partial refunds on orders still counted in grossRevenue.
    'partialRefunds', COALESCE((
      SELECT ROUND(SUM(refund_amount), 2)
        FROM public.orders
       WHERE status IN ('paid', 'shipped', 'delivered')
         AND refund_amount > 0
    ), 0),
    'refundedTotal', COALESCE((
      SELECT ROUND(SUM(refund_amount), 2)
        FROM public.orders
       WHERE refund_amount > 0
    ), 0),
    'orders24h', (
      SELECT COUNT(*)
        FROM public.orders
       WHERE status IN ('paid', 'shipped', 'delivered')
         AND created_at >= NOW() - INTERVAL '24 hours'
    ),
    'orders7d', (
      SELECT COUNT(*)
        FROM public.orders
       WHERE status IN ('paid', 'shipped', 'delivered')
         AND created_at >= NOW() - INTERVAL '7 days'
    ),
    'needsReview', (
      SELECT COUNT(*) FROM public.orders WHERE needs_review = TRUE
    ),
    'statusCounts', COALESCE((
      SELECT jsonb_object_agg(s.status, s.cnt)
        FROM (
          SELECT status::TEXT AS status, COUNT(*) AS cnt
            FROM public.orders
           GROUP BY status
        ) s
    ), '{}'::JSONB),
    'bestSeller', (
      SELECT jsonb_build_object(
               'productId', oi.product_id,
               'productName', MAX(oi.product_name),
               'quantity', SUM(oi.quantity - oi.refunded_quantity)
             )
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
       WHERE o.status IN ('paid', 'shipped', 'delivered')
       GROUP BY oi.product_id
       ORDER BY SUM(oi.quantity - oi.refunded_quantity) DESC
       LIMIT 1
    ),
    'revenueByDay', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'revenue', d.revenue) ORDER BY d.day)
        FROM (
          SELECT DATE(created_at) AS day, ROUND(SUM(total), 2) AS revenue
            FROM public.orders
           WHERE status IN ('paid', 'shipped', 'delivered')
             AND created_at >= NOW() - INTERVAL '30 days'
           GROUP BY DATE(created_at)
        ) d
    ), '[]'::JSONB),
    'revenueByStatus', COALESCE((
      SELECT jsonb_object_agg(r.status, r.revenue)
        FROM (
          SELECT status::TEXT AS status, ROUND(SUM(total), 2) AS revenue
            FROM public.orders
           WHERE status IN ('paid', 'shipped', 'delivered')
           GROUP BY status
        ) r
    ), '{}'::JSONB),
    'discounts30d', COALESCE((
      SELECT ROUND(SUM(discount_amount), 2)
        FROM public.orders
       WHERE status IN ('paid', 'shipped', 'delivered', 'refunded')
         AND created_at >= NOW() - INTERVAL '30 days'
    ), 0),
    -- Product margin over the last 30 days: lines whose cost was known at
    -- checkout, net of their discount share and of refunded units.
    'margin30d', (
      SELECT jsonb_build_object(
               'revenue',      COALESCE(ROUND(SUM(l.net) FILTER (WHERE l.unit_cost IS NOT NULL), 2), 0),
               'cost',         COALESCE(ROUND(SUM(l.unit_cost * l.units) FILTER (WHERE l.unit_cost IS NOT NULL), 2), 0),
               'coveredUnits', COALESCE(SUM(l.units) FILTER (WHERE l.unit_cost IS NOT NULL), 0),
               'totalUnits',   COALESCE(SUM(l.units), 0)
             )
        FROM (
          SELECT oi.quantity - oi.refunded_quantity AS units,
                 (oi.unit_price - oi.discount_amount / oi.quantity) * (oi.quantity - oi.refunded_quantity) AS net,
                 oc.unit_cost
            FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            LEFT JOIN public.order_item_costs oc ON oc.order_item_id = oi.id
           WHERE o.status IN ('paid', 'shipped', 'delivered')
             AND o.created_at >= NOW() - INTERVAL '30 days'
        ) l
    ),
    'lowStock', (SELECT COUNT(*) FROM public.low_stock_items() i WHERE i.stock > 0),
    'outOfStock', (SELECT COUNT(*) FROM public.low_stock_items() i WHERE i.stock <= 0),
    'stockRequests', (SELECT COUNT(*) FROM public.stock_notifications WHERE notified_at IS NULL)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 10. HISTORY — refunds recorded before this migration
-- ============================================================

DO $$
DECLARE
  n_rows INTEGER;
BEGIN
  -- Each refunded order gets one refund row (the amount the order recorded).
  INSERT INTO public.order_refunds
    (order_id, stripe_refund_id, amount, status, source, applied_at, created_by, created_at)
  SELECT o.id,
         o.refund_id,
         o.refund_amount,
         'succeeded',
         CASE WHEN o.refund_requested_by = o.user_id THEN 'customer' ELSE 'admin' END,
         COALESCE(o.refunded_at, o.updated_at),
         o.refund_requested_by,
         COALESCE(o.refunded_at, o.updated_at)
    FROM public.orders o
   WHERE o.refund_amount > 0
     AND NOT EXISTS (SELECT 1 FROM public.order_refunds r WHERE r.order_id = o.id)
     AND (o.refund_id IS NULL OR NOT EXISTS (
           SELECT 1 FROM public.order_refunds r WHERE r.stripe_refund_id = o.refund_id
         ));
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  RAISE NOTICE 'Recorded % historical refund(s).', n_rows;

  -- Lines of fully refunded orders are refunded; those refunded before they
  -- shipped went back into stock (013's paid → refunded restore).
  PERFORM set_config('app.order_items_write', 'refund', true);
  UPDATE public.order_items oi
     SET refunded_quantity  = oi.quantity,
         restocked_quantity = CASE
                                WHEN o.tracking_id IS NULL AND o.delivered_at IS NULL THEN oi.quantity
                                ELSE oi.restocked_quantity
                              END
    FROM public.orders o
   WHERE o.id = oi.order_id
     AND o.status = 'refunded'
     AND oi.refunded_quantity <> oi.quantity;
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  PERFORM set_config('app.order_items_write', '', true);
  RAISE NOTICE 'Marked % line(s) of refunded orders as refunded.', n_rows;
END
$$;

NOTIFY pgrst, 'reload schema';
