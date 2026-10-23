-- ============================================================
-- MIGRATION 025 — Discount codes
-- Run after 024_order_operations.sql
-- ============================================================
-- orders.discount_amount has existed since the first schema and was always 0.
-- This migration gives it a source:
--
-- 1. discount_codes: percent off, fixed amount off, or free shipping; an
--    optional minimum subtotal, validity window, total usage limit and
--    per-customer limit; all products, some categories, or some products;
--    optionally excluding items already on sale (compare_at_price).
-- 2. discount_redemptions: one row per order that used a code. A use counts
--    while its order is alive — an abandoned checkout (cancelled by the
--    expiry job) or a failed payment gives the use back.
-- 3. preview_discount_code(): what the checkout page calls to show the
--    discount before paying (throttled per account). The discount itself is
--    computed and charged by create-checkout-session, from the database rows,
--    with the shared rules in supabase/functions/_shared/discounts.ts.
-- 4. reserve_discount(): the checkout function's atomic "take one use" —
--    locks the code, so a code limited to 100 uses is never used 101 times.
--
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL,
  description        TEXT,
  kind               TEXT NOT NULL,
  -- percent: 1–100; fixed: an amount in the store currency; free_shipping: 0
  value              NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_subtotal       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  usage_limit        INTEGER,
  per_customer_limit INTEGER,
  applies_to         TEXT NOT NULL DEFAULT 'all',
  category_ids       UUID[] NOT NULL DEFAULT '{}',
  product_ids        UUID[] NOT NULL DEFAULT '{}',
  exclude_sale_items BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discount_codes_code_check CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  CONSTRAINT discount_codes_kind_check CHECK (kind IN ('percent', 'fixed', 'free_shipping')),
  CONSTRAINT discount_codes_value_check CHECK (
    (kind = 'percent' AND value > 0 AND value <= 100)
    OR (kind = 'fixed' AND value > 0)
    OR (kind = 'free_shipping' AND value = 0)
  ),
  CONSTRAINT discount_codes_min_subtotal_check CHECK (min_subtotal >= 0),
  CONSTRAINT discount_codes_window_check CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT discount_codes_limits_check CHECK (
    (usage_limit IS NULL OR usage_limit > 0)
    AND (per_customer_limit IS NULL OR per_customer_limit > 0)
  ),
  CONSTRAINT discount_codes_scope_check CHECK (
    applies_to IN ('all', 'categories', 'products')
    AND (applies_to <> 'categories' OR cardinality(category_ids) > 0)
    AND (applies_to <> 'products' OR cardinality(product_ids) > 0)
    AND cardinality(category_ids) <= 200
    AND cardinality(product_ids) <= 500
  ),
  CONSTRAINT discount_codes_description_check CHECK (length(COALESCE(description, '')) <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_code_key ON public.discount_codes(code);

DROP TRIGGER IF EXISTS discount_codes_updated_at ON public.discount_codes;
CREATE TRIGGER discount_codes_updated_at
  BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Codes are a secret until handed out: no public read, the storefront asks
-- preview_discount_code() about one code at a time.
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discount_codes: admin all" ON public.discount_codes;
CREATE POLICY "discount_codes: admin all"
  ON public.discount_codes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.discount_codes FROM anon;

CREATE TABLE IF NOT EXISTS public.discount_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: a code that was used is history; switch it off instead.
  discount_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE RESTRICT,
  order_id    UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount      NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_discount
  ON public.discount_redemptions(discount_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_user
  ON public.discount_redemptions(discount_id, user_id);

ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discount_redemptions: admin read" ON public.discount_redemptions;
CREATE POLICY "discount_redemptions: admin read"
  ON public.discount_redemptions FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON public.discount_redemptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.discount_redemptions FROM authenticated;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES public.discount_codes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_discount ON public.orders(discount_id) WHERE discount_id IS NOT NULL;

-- Failed previews, for throttling guesses (kept a day).
CREATE TABLE IF NOT EXISTS public.discount_attempts (
  user_id    UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discount_attempts ON public.discount_attempts(user_id, created_at);
ALTER TABLE public.discount_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discount_attempts FROM anon, authenticated;

-- Uses that still count: the order is not cancelled or failed.
CREATE OR REPLACE FUNCTION public.discount_uses(p_discount_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.discount_redemptions r
    JOIN public.orders o ON o.id = r.order_id
   WHERE r.discount_id = p_discount_id
     AND o.status NOT IN ('cancelled', 'failed')
     AND (p_user_id IS NULL OR r.user_id = p_user_id);
$$;

REVOKE ALL ON FUNCTION public.discount_uses(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Why a code cannot be used right now (NULL = it can).
CREATE OR REPLACE FUNCTION public.discount_unavailable_reason(d public.discount_codes, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT d.is_active THEN 'not_found'
    WHEN d.starts_at IS NOT NULL AND d.starts_at > NOW() THEN 'not_started'
    WHEN d.ends_at IS NOT NULL AND d.ends_at <= NOW() THEN 'expired'
    WHEN d.usage_limit IS NOT NULL AND public.discount_uses(d.id) >= d.usage_limit THEN 'exhausted'
    WHEN d.per_customer_limit IS NOT NULL AND p_user_id IS NOT NULL
         AND public.discount_uses(d.id, p_user_id) >= d.per_customer_limit THEN 'already_used'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.discount_unavailable_reason(public.discount_codes, UUID) FROM PUBLIC, anon, authenticated;

-- The checkout page's question: "can I use this code, and on what?".
-- Returns { ok: true, code, kind, value, … rules } or { ok: false, reason }
-- with reason: auth | rate_limited | not_found | not_started | expired |
-- exhausted | already_used.
CREATE OR REPLACE FUNCTION public.preview_discount_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_code   TEXT := upper(btrim(COALESCE(p_code, '')));
  d        public.discount_codes;
  v_reason TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'auth');
  END IF;

  IF (
    SELECT COUNT(*) FROM public.discount_attempts
     WHERE user_id = v_uid AND created_at > NOW() - INTERVAL '15 minutes'
  ) >= 10 THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'rate_limited');
  END IF;

  SELECT * INTO d FROM public.discount_codes WHERE code = v_code;
  IF NOT FOUND OR NOT d.is_active THEN
    INSERT INTO public.discount_attempts (user_id) VALUES (v_uid);
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
  END IF;

  v_reason := public.discount_unavailable_reason(d, v_uid);
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', v_reason);
  END IF;

  RETURN jsonb_build_object(
    'ok',                 TRUE,
    'id',                 d.id,
    'code',               d.code,
    'description',        d.description,
    'kind',               d.kind,
    'value',              d.value,
    'min_subtotal',       d.min_subtotal,
    'applies_to',         d.applies_to,
    'category_ids',       to_jsonb(d.category_ids),
    'product_ids',        to_jsonb(d.product_ids),
    'exclude_sale_items', d.exclude_sale_items,
    'ends_at',            d.ends_at
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.preview_discount_code(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.preview_discount_code(TEXT) TO authenticated;

-- Checkout (service role): takes one use of the code for this order, or
-- raises with HINT discount_<reason>. The order and its lines are already
-- written; the caller deletes the order if this fails.
CREATE OR REPLACE FUNCTION public.reserve_discount(
  p_discount_id UUID,
  p_order_id    UUID,
  p_user_id     UUID,
  p_amount      NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d        public.discount_codes;
  v_reason TEXT;
BEGIN
  SELECT * INTO d FROM public.discount_codes WHERE id = p_discount_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discount code not found.' USING HINT = 'discount_not_found';
  END IF;

  v_reason := public.discount_unavailable_reason(d, p_user_id);
  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Discount code % cannot be used: %.', d.code, v_reason
      USING HINT = 'discount_' || v_reason;
  END IF;

  INSERT INTO public.discount_redemptions (discount_id, order_id, user_id, amount)
  VALUES (d.id, p_order_id, (SELECT p.id FROM public.profiles p WHERE p.id = p_user_id), round(p_amount, 2));

  UPDATE public.orders SET discount_id = d.id WHERE id = p_order_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.reserve_discount(UUID, UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_discount(UUID, UUID, UUID, NUMERIC) TO service_role;

-- Usage per code for the admin list.
CREATE OR REPLACE FUNCTION public.admin_discount_usage()
RETURNS TABLE (
  discount_id    UUID,
  uses           INTEGER,
  paid_uses      INTEGER,
  discount_total NUMERIC,
  revenue        NUMERIC,
  last_used_at   TIMESTAMPTZ
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
  SELECT r.discount_id,
         (COUNT(*) FILTER (WHERE o.status NOT IN ('cancelled', 'failed')))::INTEGER,
         (COUNT(*) FILTER (WHERE o.status IN ('paid', 'shipped', 'delivered')))::INTEGER,
         COALESCE(ROUND(SUM(r.amount) FILTER (WHERE o.status IN ('paid', 'shipped', 'delivered')), 2), 0),
         COALESCE(ROUND(SUM(o.total) FILTER (WHERE o.status IN ('paid', 'shipped', 'delivered')), 2), 0),
         MAX(r.created_at)
    FROM public.discount_redemptions r
    JOIN public.orders o ON o.id = r.order_id
   GROUP BY r.discount_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_discount_usage() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_discount_usage() TO authenticated;

-- Failed previews are only needed for the 15-minute throttle.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-discount-attempts',
      '55 3 * * *',
      $job$DELETE FROM public.discount_attempts WHERE created_at < NOW() - INTERVAL '1 day'$job$
    );
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
