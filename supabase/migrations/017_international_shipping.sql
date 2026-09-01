-- ============================================================
-- MIGRATION 017 — International shipping, refund attribution, tracking cap
-- Run after 016_abuse_limits_and_indexes.sql
-- ============================================================
-- 1. shipping_methods.countries: a method can now be scoped to a set of ISO
--    country codes. NULL means "available everywhere", which is what keeps
--    every existing row behaving exactly as it did before this migration.
--    Until now the table was flat — Standard cost 0.00 whether the parcel went
--    to the next state or to Australia, which is a structural loss for a store
--    that ships internationally.
-- 2. Seed: the three stock methods are scoped to the US and international
--    counterparts are added, so a fresh install is not shipping worldwide for
--    free. Existing rows are only touched if the operator has not scoped them
--    already.
-- 3. orders.refund_requested_by: who asked for the refund. The self-service
--    refund rate limit counted every refund on the customer's orders, so three
--    PARTIAL refunds issued by the shop locked the customer out of cancelling
--    for 24 hours. The limit now counts only refunds the customer initiated.
-- 4. orders.tracking_id length cap — migration 016 capped addresses, reviews
--    and names but left this one unbounded.
--
-- The CHECK constraints are added NOT VALID and validated separately: new and
-- updated rows are constrained immediately either way, while pre-existing rows
-- that violate them are REPORTED instead of aborting the whole migration.
-- ============================================================

-- ============================================================
-- 1. SHIPPING METHODS — per-country availability
-- ============================================================

ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS countries TEXT[];

COMMENT ON COLUMN public.shipping_methods.countries IS
  'ISO 3166-1 alpha-2 codes this method is offered for, UPPERCASE. NULL = every country the store ships to. Must stay a subset of SHIPPING_COUNTRIES in supabase/functions/_shared/address.ts.';

ALTER TABLE public.shipping_methods
  DROP CONSTRAINT IF EXISTS shipping_methods_countries_check;

-- Deliberately only a cardinality check. A regex over the array contents would
-- need array_to_string(), which Postgres marks STABLE rather than IMMUTABLE and
-- therefore refuses inside a CHECK; the subquery form (unnest + EXISTS) is
-- forbidden in CHECK constraints outright. cardinality() IS immutable and buys
-- the one thing worth enforcing here: an EMPTY array would mean "ships nowhere"
-- and would silently hide the method from every customer. The uppercase
-- two-letter convention is held up by the seed below, by the documentation, and
-- by the normalised comparison in create-checkout-session — there is no admin UI
-- on this table, only the operator writes to it.
ALTER TABLE public.shipping_methods
  ADD CONSTRAINT shipping_methods_countries_check CHECK (
    countries IS NULL OR cardinality(countries) BETWEEN 1 AND 250
  ) NOT VALID;

-- ============================================================
-- 2. SEED — stop shipping worldwide for free
-- ============================================================
-- Only rows still left unscoped are touched, so an operator who has already
-- configured their own zones is not overwritten.

UPDATE public.shipping_methods
   SET countries = ARRAY['US']
 WHERE id IN (
         'c1000000-0000-0000-0000-000000000001',  -- Standard
         'c1000000-0000-0000-0000-000000000002',  -- Express
         'c1000000-0000-0000-0000-000000000003'   -- Overnight
       )
   AND countries IS NULL;

INSERT INTO public.shipping_methods
  (id, name, description, price, estimated_days_min, estimated_days_max, sort_order, countries)
VALUES
  (
    'c1000000-0000-0000-0000-000000000005',
    'International Standard',
    'Tracked international delivery. Import duties and taxes are not included.',
    14.99, 8, 21, 4,
    ARRAY['CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES']
  ),
  (
    'c1000000-0000-0000-0000-000000000006',
    'International Express',
    'Priority international delivery. Import duties and taxes are not included.',
    29.99, 3, 7, 5,
    ARRAY['CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES']
  )
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '---';
  RAISE NOTICE 'Shipping methods are now scoped by country.';
  RAISE NOTICE 'The stock methods (Standard/Express/Overnight) were scoped to US';
  RAISE NOTICE 'and two international methods were added with PLACEHOLDER prices.';
  RAISE NOTICE 'If you do not ship from the US, or your real rates differ, edit';
  RAISE NOTICE 'public.shipping_methods now — every country listed there is a';
  RAISE NOTICE 'country you are promising to ship to at that price.';
  RAISE NOTICE '---';
END
$$;

-- ============================================================
-- 3. ORDERS — who requested the refund
-- ============================================================
-- Left NULL for historical rows on purpose: an unattributed past refund then
-- does NOT count against the customer's limit. That errs permissive rather than
-- locking someone out over a refund they never asked for.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_requested_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.orders.refund_requested_by IS
  'Profile that initiated the refund (customer self-cancel or admin). Used by the self-service refund rate limit so admin-issued partial refunds do not count against the customer.';

-- The rate limit filters on (refund_requested_by, refunded_at).
CREATE INDEX IF NOT EXISTS idx_orders_refund_requested_by
  ON public.orders(refund_requested_by, refunded_at)
  WHERE refund_requested_by IS NOT NULL;

-- ============================================================
-- 4. ORDERS — tracking_id length cap
-- ============================================================
-- No carrier uses a tracking number anywhere near this long; 100 is generous
-- and still bounds what an admin can write into a field that is rendered into
-- customer email.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_tracking_id_length_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_tracking_id_length_check
    CHECK (length(COALESCE(tracking_id, '')) <= 100) NOT VALID;

-- ============================================================
-- 5. VALIDATE the new constraints, reporting instead of aborting
-- ============================================================

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('public.shipping_methods', 'shipping_methods_countries_check'),
      ('public.orders',           'orders_tracking_id_length_check')
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

NOTIFY pgrst, 'reload schema';
