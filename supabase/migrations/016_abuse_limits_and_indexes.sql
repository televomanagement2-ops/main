-- ============================================================
-- MIGRATION 016 — Abuse limits, cancel-window tightening, search index
-- Run after 015_set_user_role_deny_by_default.sql
-- ============================================================
-- 1. addresses: per-column length caps + a per-user row cap. The INSERT policy
--    (rls.sql) only checks ownership, so any signed-up account could write
--    unbounded rows of unbounded TEXT.
-- 2. product_reviews.body: length cap. A verified purchaser's review is served
--    to every anonymous visitor of the product page.
-- 3. orders.shipping_address: size cap on the JSONB snapshot.
-- 4. "orders: owner cancel": narrowed from pending/processing/requires_action
--    to pending only. Cancelling a 'processing' order over PostgREST left the
--    Stripe session payable; paying it afterwards took the money and parked the
--    order in needs_review. Pre-payment cancels now go through
--    handle-order-action, which expires the Stripe session first.
-- 5. products.name: trigram index so the storefront's ILIKE '%term%' search
--    stops doing a sequential scan.
--
-- The CHECK constraints are added NOT VALID and validated separately: new and
-- updated rows are constrained immediately either way, while pre-existing rows
-- that violate them are REPORTED instead of aborting the whole migration.
-- ============================================================

-- ============================================================
-- 1. ADDRESSES — length caps
-- ============================================================

ALTER TABLE public.addresses
  DROP CONSTRAINT IF EXISTS addresses_field_length_check;

ALTER TABLE public.addresses
  ADD CONSTRAINT addresses_field_length_check CHECK (
    length(full_name)             <= 120 AND
    length(line1)                 <= 200 AND
    length(COALESCE(line2, ''))   <= 200 AND
    length(city)                  <= 100 AND
    length(state)                 <= 100 AND
    length(postal_code)           <=  20 AND
    length(country)               <=   2 AND
    length(COALESCE(phone, ''))   <=  32
  ) NOT VALID;

-- ============================================================
-- 2. ADDRESSES — per-user row cap
-- ============================================================
-- Twenty saved addresses is far beyond any real shopper and far below what a
-- script needs to be worth running. The service role is NOT exempt: nothing
-- server-side creates addresses on a user's behalf.

CREATE OR REPLACE FUNCTION public.check_address_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.addresses
    WHERE user_id = NEW.user_id
  ) >= 20 THEN
    RAISE EXCEPTION
      'Address limit reached for user % (max 20). Delete an existing address first.',
      NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS addresses_limit ON public.addresses;
CREATE TRIGGER addresses_limit
  BEFORE INSERT ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.check_address_limit();

-- ============================================================
-- 3. PRODUCT REVIEWS — body length cap
-- ============================================================

ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_body_length_check;

ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_body_length_check
    CHECK (length(COALESCE(body, '')) <= 2000) NOT VALID;

-- author_name is written by the set_review_author_name() trigger from the
-- profile, and profiles.full_name is user-controlled — cap it at the source.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_full_name_length_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length_check CHECK (
    length(COALESCE(full_name, '')) <= 120 AND
    length(COALESCE(phone, ''))     <=  32
  ) NOT VALID;

-- ============================================================
-- 4. ORDERS — shipping_address size cap
-- ============================================================
-- The Edge Function now sanitises and whitelists the address keys, so this is
-- the backstop for anything that reaches the table by another route.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shipping_address_size_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_address_size_check
    CHECK (length(shipping_address::text) <= 2000) NOT VALID;

-- ============================================================
-- 5. VALIDATE the new constraints, reporting instead of aborting
-- ============================================================

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('public.addresses',       'addresses_field_length_check'),
      ('public.product_reviews', 'product_reviews_body_length_check'),
      ('public.profiles',        'profiles_full_name_length_check'),
      ('public.orders',          'orders_shipping_address_size_check')
    ) AS t(tbl, con)
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.con);
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING
        'Constraint % on % is enforced for NEW rows but existing rows violate it. Find and fix them, then run: ALTER TABLE % VALIDATE CONSTRAINT %;',
        c.con, c.tbl, c.tbl, c.con;
    END;
  END LOOP;
END
$$;

-- ============================================================
-- 6. ORDERS RLS — narrow the customer cancel window to 'pending'
-- ============================================================
-- USING is evaluated against the row as it is COMMITTED, so this is what
-- decides which orders a customer may target. 'processing' means a Stripe
-- Checkout session is open and payable for up to an hour: cancelling it here
-- and paying it afterwards charged the card for an order the transition guard
-- then refused to mark paid.

DROP POLICY IF EXISTS "orders: owner cancel" ON public.orders;

CREATE POLICY "orders: owner cancel"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'pending'           -- no open Stripe session yet
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'cancelled'
    AND stripe_session_id        IS NOT DISTINCT FROM (SELECT stripe_session_id        FROM public.orders WHERE id = orders.id)
    AND stripe_payment_intent_id IS NOT DISTINCT FROM (SELECT stripe_payment_intent_id FROM public.orders WHERE id = orders.id)
    AND total    = (SELECT total    FROM public.orders WHERE id = orders.id)
    AND subtotal = (SELECT subtotal FROM public.orders WHERE id = orders.id)
  );

-- ============================================================
-- 7. PRODUCTS — stop publishing cost_price
-- ============================================================
-- products is world-readable (RLS "products: public read active") and the
-- client selected '*', so products.cost_price — what the store PAYS for each
-- item, i.e. its margin on every product — was returned to anyone. RLS is
-- row-level and cannot help here; the anon key is public by design, so
--   GET /rest/v1/products?select=name,price,cost_price
-- was a complete margin dump for any visitor.
--
-- Column-level grants are the fix. Note the consequence: with these in place a
-- SELECT * on products is refused for anon/authenticated, so every query must
-- name its columns (src/lib/api.ts does). The column list is derived from the
-- live table rather than hard-coded, so a project that has added its own
-- columns keeps them readable instead of silently losing them.

DO $$
DECLARE
  cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'products'
     AND column_name <> 'cost_price';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.products not found — run schema.sql first.';
  END IF;

  REVOKE SELECT ON public.products FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.products TO anon, authenticated', cols);

  RAISE NOTICE 'products.cost_price is no longer readable by anon/authenticated.';
END
$$;

-- The service role (Edge Functions, dashboard tooling) keeps full access, which
-- is where any cost/margin reporting belongs.
GRANT SELECT ON public.products TO service_role;

-- ============================================================
-- 8. SEARCH INDEX — trigram on products.name
-- ============================================================
-- fetchProducts() searches with ILIKE '%term%'. A leading wildcard cannot use a
-- B-tree index, so every keystroke was a sequential scan over the catalog.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING GIN (name gin_trgm_ops);

-- Storefront lists always filter is_active and sort by created_at.
CREATE INDEX IF NOT EXISTS idx_products_active_created
  ON public.products(created_at DESC)
  WHERE is_active = TRUE;

NOTIFY pgrst, 'reload schema';
