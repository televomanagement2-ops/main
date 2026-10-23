-- ============================================================
-- MIGRATION 023 — Inventory log, low-stock alerts, back-in-stock requests
-- Run after 022_catalog_variants.sql
-- ============================================================
-- 1. inventory_movements: every change to a stock counter, with why (sale,
--    refund, return, exchange, manual edit, import…), which order, who, and
--    an optional note. Written by triggers, so no path can move stock without
--    leaving a line — including the Table Editor.
-- 2. store_settings: one row of switches the admin can change from the app
--    (low-stock emails and their recipients, back-in-stock requests).
-- 3. Low stock: the items at or under their product's threshold, for the
--    dashboard and for an hourly email digest that only mentions an item the
--    first time it drops (it can alert again once it has been restocked).
-- 4. stock_notifications: "email me when it is back" for a sold-out product
--    or variant. The store-worker Edge Function sends them once the item has
--    stock again.
-- 5. pg_net + Vault: pg_cron calls the store-worker function. The endpoint and
--    its shared secret live in Vault (see supabase/SETUP_CHECKLIST.md); until
--    they are set, the scheduled calls do nothing.
--
-- Idempotent.
-- ============================================================

-- ============================================================
-- 1. INVENTORY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id    UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  -- "Red / M" at the time of the movement; survives a rename or a delete
  variant_label TEXT,
  delta         INTEGER NOT NULL,
  stock_after   INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  -- machine detail the app translates: variant_removed | to_variants | to_single
  detail        TEXT,
  order_id      UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_movements_reason_check CHECK (
    reason IN ('sale', 'cancel', 'refund', 'return', 'exchange', 'manual', 'import', 'initial', 'other')
  ),
  CONSTRAINT inventory_movements_note_check CHECK (length(COALESCE(note, '')) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
  ON public.inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created
  ON public.inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order
  ON public.inventory_movements(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant
  ON public.inventory_movements(variant_id) WHERE variant_id IS NOT NULL;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_movements: admin read" ON public.inventory_movements;
CREATE POLICY "inventory_movements: admin read"
  ON public.inventory_movements FOR SELECT
  USING (public.is_admin());

-- History is written by the triggers below and never edited.
REVOKE ALL ON public.inventory_movements FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_movements FROM authenticated;

-- A write with no context set: an admin's own edit, or something else.
CREATE OR REPLACE FUNCTION public.stock_default_reason()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND public.is_admin() THEN 'manual' ELSE 'other' END;
$$;

REVOKE ALL ON FUNCTION public.stock_default_reason() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_variant_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    public.product_variants;
  v_delta  INTEGER;
  v_after  INTEGER;
  v_reason TEXT := NULLIF(current_setting('app.stock_reason', true), '');
  v_detail TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock_qty = 0 THEN
      RETURN NULL;
    END IF;
    v_row   := NEW;
    v_delta := NEW.stock_qty;
    v_after := NEW.stock_qty;
    IF v_reason IS NULL OR v_reason = 'manual' THEN
      v_reason := 'initial';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.stock_qty = OLD.stock_qty THEN
      RETURN NULL;
    END IF;
    v_row   := NEW;
    v_delta := NEW.stock_qty - OLD.stock_qty;
    v_after := NEW.stock_qty;
  ELSE
    IF OLD.stock_qty = 0 THEN
      RETURN NULL;
    END IF;
    -- The product itself is being deleted (cascade): nothing to log against.
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = OLD.product_id) THEN
      RETURN NULL;
    END IF;
    v_row    := OLD;
    v_delta  := -OLD.stock_qty;
    v_after  := 0;
    v_detail := 'variant_removed';
  END IF;

  INSERT INTO public.inventory_movements
    (product_id, variant_id, variant_label, delta, stock_after, reason, detail, order_id, actor_id, note)
  VALUES (
    v_row.product_id,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_row.id END,
    concat_ws(' / ', (SELECT c.name FROM public.product_colors c WHERE c.id = v_row.color_id), v_row.size),
    v_delta,
    v_after,
    COALESCE(v_reason, public.stock_default_reason()),
    v_detail,
    NULLIF(current_setting('app.stock_order', true), '')::UUID,
    (SELECT p.id FROM public.profiles p WHERE p.id = auth.uid()),
    NULLIF(current_setting('app.stock_note', true), '')
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_variants_log_stock ON public.product_variants;
CREATE TRIGGER product_variants_log_stock
  AFTER INSERT OR UPDATE OF stock_qty OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.log_variant_stock();

-- A product without variants carries its own counter. A product with
-- variants has a derived total, which is not logged: its variants are.
CREATE OR REPLACE FUNCTION public.log_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := NULLIF(current_setting('app.stock_reason', true), '');
  new_var  BOOLEAN := NEW.has_sizes OR NEW.has_colors;
  old_var  BOOLEAN;
  v_delta  INTEGER;
  v_after  INTEGER;
  v_detail TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF new_var OR NEW.stock_quantity = 0 THEN
      RETURN NULL;
    END IF;
    v_delta := NEW.stock_quantity;
    v_after := NEW.stock_quantity;
    IF v_reason IS NULL OR v_reason = 'manual' THEN
      v_reason := 'initial';
    END IF;
  ELSE
    old_var := OLD.has_sizes OR OLD.has_colors;
    IF NOT old_var AND NOT new_var THEN
      IF NEW.stock_quantity = OLD.stock_quantity THEN
        RETURN NULL;
      END IF;
      v_delta := NEW.stock_quantity - OLD.stock_quantity;
      v_after := NEW.stock_quantity;
    ELSIF NOT old_var AND new_var THEN
      -- The single counter is retired; the variants' own stock is logged as
      -- they are created.
      IF OLD.stock_quantity = 0 THEN
        RETURN NULL;
      END IF;
      v_delta  := -OLD.stock_quantity;
      v_after  := 0;
      v_detail := 'to_variants';
    ELSIF old_var AND NOT new_var THEN
      IF NEW.stock_quantity = 0 THEN
        RETURN NULL;
      END IF;
      v_delta  := NEW.stock_quantity;
      v_after  := NEW.stock_quantity;
      v_detail := 'to_single';
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.inventory_movements
    (product_id, delta, stock_after, reason, detail, order_id, actor_id, note)
  VALUES (
    NEW.id,
    v_delta,
    v_after,
    COALESCE(v_reason, public.stock_default_reason()),
    v_detail,
    NULLIF(current_setting('app.stock_order', true), '')::UUID,
    (SELECT p.id FROM public.profiles p WHERE p.id = auth.uid()),
    NULLIF(current_setting('app.stock_note', true), '')
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS products_log_stock ON public.products;
CREATE TRIGGER products_log_stock
  AFTER INSERT OR UPDATE OF stock_quantity, has_sizes, has_colors ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_stock();

-- ============================================================
-- 2. STORE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_settings (
  id                    BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  back_in_stock_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  low_stock_alerts      BOOLEAN NOT NULL DEFAULT TRUE,
  -- empty: every admin account
  alert_emails          TEXT[]  NOT NULL DEFAULT '{}',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_settings_alert_emails_check CHECK (cardinality(alert_emails) <= 10)
);

INSERT INTO public.store_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS store_settings_updated_at ON public.store_settings;
CREATE TRIGGER store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_settings: public read" ON public.store_settings;
CREATE POLICY "store_settings: public read"
  ON public.store_settings FOR SELECT
  USING (TRUE);

-- The storefront may read the public switch and nothing else; the admin goes
-- through the two functions below.
REVOKE ALL ON public.store_settings FROM anon, authenticated;
GRANT SELECT (id, back_in_stock_enabled) ON public.store_settings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_store_settings()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT to_jsonb(s) || jsonb_build_object(
             'admin_emails', COALESCE((
               SELECT jsonb_agg(p.email ORDER BY p.email)
                 FROM public.profiles p
                WHERE p.role = 'admin'
             ), '[]'::JSONB)
           )
      FROM public.store_settings s
     WHERE s.id
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_get_store_settings() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_store_settings() TO authenticated;

-- p_settings: { back_in_stock_enabled?, low_stock_alerts?, alert_emails? }
CREATE OR REPLACE FUNCTION public.admin_update_store_settings(p_settings JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emails TEXT[];
  v_email  TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'p_settings must be a JSON object.' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'alert_emails' THEN
    IF jsonb_typeof(p_settings->'alert_emails') <> 'array' THEN
      RAISE EXCEPTION 'alert_emails must be a list.' USING ERRCODE = '22023';
    END IF;
    v_emails := '{}';
    FOR v_email IN SELECT lower(btrim(value)) FROM jsonb_array_elements_text(p_settings->'alert_emails') AS t(value) LOOP
      CONTINUE WHEN v_email = '' OR v_email = ANY (v_emails);
      IF length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION '"%" is not a valid email address.', v_email
          USING ERRCODE = '22023', HINT = 'invalid_email', DETAIL = v_email;
      END IF;
      v_emails := v_emails || v_email;
    END LOOP;
    IF cardinality(v_emails) > 10 THEN
      RAISE EXCEPTION 'At most 10 alert recipients.' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.store_settings
     SET back_in_stock_enabled = COALESCE((p_settings->>'back_in_stock_enabled')::BOOLEAN, back_in_stock_enabled),
         low_stock_alerts      = COALESCE((p_settings->>'low_stock_alerts')::BOOLEAN, low_stock_alerts),
         alert_emails          = COALESCE(v_emails, alert_emails)
   WHERE id;

  RETURN public.admin_get_store_settings();
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_update_store_settings(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_update_store_settings(JSONB) TO authenticated;

-- ============================================================
-- 3. LOW STOCK
-- ============================================================
-- At or under the product's low_stock_threshold, products on sale only. A
-- product with variants is judged variant by variant: the total can look
-- healthy while M is gone.

CREATE OR REPLACE FUNCTION public.low_stock_items()
RETURNS TABLE (
  product_id    UUID,
  product_name  TEXT,
  slug          TEXT,
  variant_id    UUID,
  color_id      UUID,
  variant_label TEXT,
  sku           TEXT,
  stock         INTEGER,
  threshold     INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.slug, NULL::UUID, NULL::UUID, NULL::TEXT, p.sku,
         p.stock_quantity, p.low_stock_threshold
    FROM public.products p
   WHERE p.is_active
     AND NOT (p.has_sizes OR p.has_colors)
     AND p.stock_quantity <= p.low_stock_threshold
  UNION ALL
  SELECT p.id, p.name, p.slug, v.id, v.color_id, concat_ws(' / ', c.name, v.size),
         COALESCE(v.sku, p.sku), v.stock_qty, p.low_stock_threshold
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    LEFT JOIN public.product_colors c ON c.id = v.color_id
   WHERE p.is_active
     AND (p.has_sizes OR p.has_colors)
     AND v.is_active
     AND v.stock_qty <= p.low_stock_threshold;
$$;

REVOKE ALL ON FUNCTION public.low_stock_items() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_low_stock(p_limit INTEGER DEFAULT 500)
RETURNS TABLE (
  product_id    UUID,
  product_name  TEXT,
  slug          TEXT,
  image_url     TEXT,
  variant_id    UUID,
  variant_label TEXT,
  sku           TEXT,
  stock         INTEGER,
  threshold     INTEGER,
  waiting       INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT i.product_id,
         i.product_name,
         i.slug,
         (SELECT im.url
            FROM public.product_images im
           WHERE im.product_id = i.product_id
           ORDER BY (i.color_id IS NOT NULL AND im.color_id = i.color_id) DESC,
                    im.is_primary DESC,
                    im.sort_order
           LIMIT 1),
         i.variant_id,
         i.variant_label,
         i.sku,
         i.stock,
         i.threshold,
         -- customers waiting for it (back-in-stock requests)
         (SELECT COUNT(*)::INTEGER
            FROM public.stock_notifications n
           WHERE n.product_id = i.product_id
             AND n.variant_id IS NOT DISTINCT FROM i.variant_id
             AND n.notified_at IS NULL)
    FROM public.low_stock_items() i
   ORDER BY i.stock, i.product_name, i.variant_label
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
END;
$$;

-- ============================================================
-- 4. BACK-IN-STOCK REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  locale      TEXT NOT NULL DEFAULT 'en',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  CONSTRAINT stock_notifications_email_check CHECK (
    email = lower(btrim(email))
    AND length(email) BETWEEN 3 AND 254
    AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT stock_notifications_locale_check CHECK (locale IN ('en', 'it', 'es', 'fr'))
);

-- One open request per item and address.
CREATE UNIQUE INDEX IF NOT EXISTS stock_notifications_pending_unique
  ON public.stock_notifications (product_id, variant_id, email) NULLS NOT DISTINCT
  WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_notifications_pending
  ON public.stock_notifications (created_at) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_notifications_email
  ON public.stock_notifications (email) WHERE notified_at IS NULL;

ALTER TABLE public.stock_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_notifications: admin read" ON public.stock_notifications;
CREATE POLICY "stock_notifications: admin read"
  ON public.stock_notifications FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "stock_notifications: admin delete" ON public.stock_notifications;
CREATE POLICY "stock_notifications: admin delete"
  ON public.stock_notifications FOR DELETE
  USING (public.is_admin());

REVOKE ALL ON public.stock_notifications FROM anon;
REVOKE INSERT, UPDATE, TRUNCATE ON public.stock_notifications FROM authenticated;

-- Rate limiting by requester. Only a hash of the address is kept, for a day.
CREATE TABLE IF NOT EXISTS public.stock_notification_attempts (
  requester_hash TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_notification_attempts
  ON public.stock_notification_attempts (requester_hash, created_at);
ALTER TABLE public.stock_notification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stock_notification_attempts FROM anon, authenticated;

-- Callable by anyone (signed in or not). Errors carry a HINT the storefront
-- translates: disabled | invalid_email | not_found | in_stock | rate_limited.
-- Returns 'subscribed' or 'already_subscribed'.
CREATE OR REPLACE FUNCTION public.request_stock_notification(
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL,
  p_email      TEXT DEFAULT NULL,
  p_locale     TEXT DEFAULT 'en'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prod       public.products;
  var        public.product_variants;
  v_uid      UUID := auth.uid();
  v_email    TEXT := lower(btrim(COALESCE(p_email, '')));
  v_locale   TEXT := CASE WHEN p_locale IN ('en', 'it', 'es', 'fr') THEN p_locale ELSE 'en' END;
  v_ip       TEXT;
  v_hash     TEXT;
  v_inserted INTEGER;
BEGIN
  IF NOT COALESCE((SELECT back_in_stock_enabled FROM public.store_settings WHERE id), TRUE) THEN
    RAISE EXCEPTION 'Back-in-stock requests are switched off.' USING HINT = 'disabled';
  END IF;

  IF v_email = '' AND v_uid IS NOT NULL THEN
    SELECT lower(btrim(email)) INTO v_email FROM public.profiles WHERE id = v_uid;
  END IF;
  IF v_email IS NULL OR length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING HINT = 'invalid_email';
  END IF;

  SELECT * INTO prod FROM public.products WHERE id = p_product_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.' USING HINT = 'not_found';
  END IF;

  IF prod.has_sizes OR prod.has_colors THEN
    SELECT * INTO var
      FROM public.product_variants
     WHERE id = p_variant_id AND product_id = prod.id AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found.' USING HINT = 'not_found';
    END IF;
    IF var.stock_qty > 0 THEN
      RAISE EXCEPTION 'This item is in stock.' USING HINT = 'in_stock';
    END IF;
  ELSE
    IF p_variant_id IS NOT NULL THEN
      RAISE EXCEPTION 'Variant not found.' USING HINT = 'not_found';
    END IF;
    IF prod.stock_quantity > 0 THEN
      RAISE EXCEPTION 'This item is in stock.' USING HINT = 'in_stock';
    END IF;
  END IF;

  -- A script submitting other people's addresses gets 20 per hour per
  -- network address, and no address collects more than 25 open requests.
  BEGIN
    v_ip := btrim(split_part(
      COALESCE(current_setting('request.headers', true)::JSON->>'x-forwarded-for', ''), ',', 1));
  EXCEPTION WHEN OTHERS THEN
    v_ip := '';
  END;
  IF v_ip <> '' THEN
    v_hash := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');
    IF (
      SELECT COUNT(*) FROM public.stock_notification_attempts
       WHERE requester_hash = v_hash
         AND created_at > NOW() - INTERVAL '1 hour'
    ) >= 20 THEN
      RAISE EXCEPTION 'Too many requests. Please try again later.' USING HINT = 'rate_limited';
    END IF;
  END IF;
  IF (
    SELECT COUNT(*) FROM public.stock_notifications
     WHERE email = v_email AND notified_at IS NULL
  ) >= 25 THEN
    RAISE EXCEPTION 'Too many open requests for this address.' USING HINT = 'rate_limited';
  END IF;

  INSERT INTO public.stock_notifications (product_id, variant_id, email, user_id, locale)
  VALUES (
    prod.id,
    CASE WHEN prod.has_sizes OR prod.has_colors THEN var.id END,
    v_email,
    (SELECT p.id FROM public.profiles p WHERE p.id = v_uid),
    v_locale
  )
  ON CONFLICT (product_id, variant_id, email) WHERE notified_at IS NULL DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_hash IS NOT NULL AND v_inserted > 0 THEN
    INSERT INTO public.stock_notification_attempts (requester_hash) VALUES (v_hash);
  END IF;

  RETURN CASE WHEN v_inserted > 0 THEN 'subscribed' ELSE 'already_subscribed' END;
END;
$$;

REVOKE ALL     ON FUNCTION public.request_stock_notification(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.request_stock_notification(UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- Demand for the admin: what customers are waiting for, and how many.
CREATE OR REPLACE FUNCTION public.admin_stock_requests()
RETURNS TABLE (
  product_id    UUID,
  product_name  TEXT,
  slug          TEXT,
  variant_id    UUID,
  variant_label TEXT,
  waiting       INTEGER,
  oldest        TIMESTAMPTZ,
  stock         INTEGER,
  notified_30d  INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT n.product_id,
         p.name,
         p.slug,
         n.variant_id,
         concat_ws(' / ', c.name, v.size),
         (COUNT(*) FILTER (WHERE n.notified_at IS NULL))::INTEGER,
         MIN(n.created_at) FILTER (WHERE n.notified_at IS NULL),
         COALESCE(v.stock_qty, p.stock_quantity),
         (COUNT(*) FILTER (WHERE n.notified_at > NOW() - INTERVAL '30 days'))::INTEGER
    FROM public.stock_notifications n
    JOIN public.products p ON p.id = n.product_id
    LEFT JOIN public.product_variants v ON v.id = n.variant_id
    LEFT JOIN public.product_colors c ON c.id = v.color_id
   GROUP BY n.product_id, p.name, p.slug, n.variant_id, c.name, v.size, v.stock_qty, p.stock_quantity
  HAVING COUNT(*) FILTER (WHERE n.notified_at IS NULL) > 0
      OR COUNT(*) FILTER (WHERE n.notified_at > NOW() - INTERVAL '30 days') > 0
   ORDER BY 6 DESC, 7;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_stock_requests() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_stock_requests() TO authenticated;
REVOKE ALL     ON FUNCTION public.admin_low_stock(INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_low_stock(INTEGER) TO authenticated;

-- ── Worker side (service role only) ─────────────────────────────────────
-- Claims the requests whose item has stock again: they are marked notified
-- in the same statement, so two workers never email the same person. The
-- worker hands back the ones it failed to send.

CREATE OR REPLACE FUNCTION public.claim_stock_notifications(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id            UUID,
  email         TEXT,
  locale        TEXT,
  product_id    UUID,
  product_name  TEXT,
  slug          TEXT,
  variant_label TEXT,
  image_url     TEXT,
  price         NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT n.id
      FROM public.stock_notifications n
      JOIN public.products p ON p.id = n.product_id AND p.is_active
      LEFT JOIN public.product_variants v ON v.id = n.variant_id
     WHERE n.notified_at IS NULL
       AND CASE
             WHEN n.variant_id IS NULL
               THEN NOT (p.has_sizes OR p.has_colors) AND p.stock_quantity > 0
             ELSE v.is_active AND v.stock_qty > 0
           END
     ORDER BY n.created_at
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
       FOR UPDATE OF n SKIP LOCKED
  ),
  marked AS (
    UPDATE public.stock_notifications s
       SET notified_at = NOW()
      FROM due
     WHERE s.id = due.id
    RETURNING s.id, s.email, s.locale, s.product_id, s.variant_id
  )
  SELECT m.id,
         m.email,
         m.locale,
         p.id,
         p.name,
         p.slug,
         concat_ws(' / ', c.name, v.size),
         (SELECT im.url
            FROM public.product_images im
           WHERE im.product_id = p.id
           ORDER BY (v.color_id IS NOT NULL AND im.color_id = v.color_id) DESC,
                    im.is_primary DESC,
                    im.sort_order
           LIMIT 1),
         COALESCE(v.price, p.price)
    FROM marked m
    JOIN public.products p ON p.id = m.product_id
    LEFT JOIN public.product_variants v ON v.id = m.variant_id
    LEFT JOIN public.product_colors c ON c.id = v.color_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock_notifications(p_ids UUID[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.stock_notifications SET notified_at = NULL WHERE id = ANY (p_ids);
$$;

REVOKE ALL     ON FUNCTION public.claim_stock_notifications(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL     ON FUNCTION public.release_stock_notifications(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_stock_notifications(INTEGER) TO service_role;
GRANT  EXECUTE ON FUNCTION public.release_stock_notifications(UUID[]) TO service_role;

-- ============================================================
-- 5. LOW-STOCK DIGEST STATE
-- ============================================================
-- Remembers which items an email already mentioned. An item that recovers
-- (back above its threshold) is forgotten, so its next drop alerts again.

CREATE TABLE IF NOT EXISTS public.low_stock_alert_state (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT low_stock_alert_state_unique UNIQUE NULLS NOT DISTINCT (product_id, variant_id)
);

ALTER TABLE public.low_stock_alert_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.low_stock_alert_state FROM anon, authenticated;

-- { enabled, recipients: [email], items: [{ product_id, variant_id, … }] }
CREATE OR REPLACE FUNCTION public.low_stock_digest_candidates()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings public.store_settings;
BEGIN
  SELECT * INTO settings FROM public.store_settings WHERE id;

  DELETE FROM public.low_stock_alert_state s
   WHERE NOT EXISTS (
           SELECT 1 FROM public.low_stock_items() i
            WHERE i.product_id = s.product_id
              AND i.variant_id IS NOT DISTINCT FROM s.variant_id
         );

  RETURN jsonb_build_object(
    'enabled', COALESCE(settings.low_stock_alerts, TRUE),
    'recipients', to_jsonb(
      CASE
        WHEN cardinality(COALESCE(settings.alert_emails, '{}')) > 0 THEN settings.alert_emails
        ELSE ARRAY(SELECT p.email FROM public.profiles p WHERE p.role = 'admin' ORDER BY p.email)
      END
    ),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.stock, x.product_name)
        FROM (
          SELECT i.product_id, i.product_name, i.slug, i.variant_id, i.variant_label, i.sku,
                 i.stock, i.threshold
            FROM public.low_stock_items() i
           WHERE NOT EXISTS (
                   SELECT 1 FROM public.low_stock_alert_state s
                    WHERE s.product_id = i.product_id
                      AND s.variant_id IS NOT DISTINCT FROM i.variant_id
                 )
           ORDER BY i.stock, i.product_name
           LIMIT 200
        ) x
    ), '[]'::JSONB)
  );
END;
$$;

-- p_items: [{ product_id, variant_id }] — the ones the email went out for.
CREATE OR REPLACE FUNCTION public.mark_low_stock_alerted(p_items JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.low_stock_alert_state (product_id, variant_id)
  SELECT (e.value->>'product_id')::UUID, (e.value->>'variant_id')::UUID
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB)) AS e(value)
   WHERE EXISTS (SELECT 1 FROM public.products p WHERE p.id = (e.value->>'product_id')::UUID)
  ON CONFLICT ON CONSTRAINT low_stock_alert_state_unique DO NOTHING;
$$;

REVOKE ALL     ON FUNCTION public.low_stock_digest_candidates() FROM PUBLIC, anon, authenticated;
REVOKE ALL     ON FUNCTION public.mark_low_stock_alerted(JSONB) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.low_stock_digest_candidates() TO service_role;
GRANT  EXECUTE ON FUNCTION public.mark_low_stock_alerted(JSONB) TO service_role;

-- ============================================================
-- 6. SCHEDULING — pg_cron calls the store-worker Edge Function
-- ============================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_net could not be enabled (%). Enable it under Database → Extensions, then run this migration again.', SQLERRM;
END
$$;

-- Reads the endpoint and its secret from Vault. Both are set once per
-- project (supabase/SETUP_CHECKLIST.md); until then this returns NULL and
-- does nothing.
CREATE OR REPLACE FUNCTION public.invoke_store_worker(p_task TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
  v_id     BIGINT;
BEGIN
  IF to_regnamespace('vault') IS NULL OR to_regnamespace('net') IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
     INTO v_url USING 'store_worker_url';
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
     INTO v_secret USING 'store_worker_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 20000)'
     INTO v_id
    USING v_url,
          jsonb_build_object('task', p_task),
          jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_store_worker(TEXT) FROM PUBLIC, anon, authenticated;

-- Requests are kept no longer than they are useful.
CREATE OR REPLACE FUNCTION public.purge_stock_requests()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.stock_notifications
   WHERE (notified_at IS NOT NULL AND notified_at < NOW() - INTERVAL '90 days')
      OR (notified_at IS NULL AND created_at < NOW() - INTERVAL '180 days');
  DELETE FROM public.stock_notification_attempts
   WHERE created_at < NOW() - INTERVAL '1 day';
$$;

REVOKE ALL ON FUNCTION public.purge_stock_requests() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'store-worker-back-in-stock',
      '*/10 * * * *',
      $job$SELECT public.invoke_store_worker('back_in_stock')$job$
    );
    PERFORM cron.schedule(
      'store-worker-low-stock',
      '7 * * * *',
      $job$SELECT public.invoke_store_worker('low_stock')$job$
    );
    PERFORM cron.schedule(
      'purge-stock-requests',
      '50 3 * * *',
      $job$SELECT public.purge_stock_requests()$job$
    );
  ELSE
    RAISE WARNING 'pg_cron is not installed: back-in-stock emails and low-stock digests will not be sent. Run 020 first, then this file again.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
