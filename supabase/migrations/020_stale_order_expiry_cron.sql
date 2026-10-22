-- ============================================================
-- MIGRATION 020 — Schedule the stale-order expiry job (pg_cron)
-- Run after 019_reconcile_reverted_fixes.sql
-- ============================================================
-- expire_stale_pending_orders() (migration 003) has always been documented as
-- REQUIRED, but scheduling it was a manual step: enable pg_cron in the
-- dashboard, then run cron.schedule() by hand. A project where nobody did
-- keeps every abandoned checkout in 'pending' / 'processing' forever: each one
-- counts against the customer's open-order cap (check_pending_order_limit,
-- 10 per user) and sits in the admin's "open payments" queue.
--
-- This migration makes the step part of the schema:
--   1. expire_stale_pending_orders(): SECURITY DEFINER with a pinned
--      search_path, so it behaves the same whichever role the job runs as,
--      and EXECUTE revoked from the API roles. It used to be callable by any
--      visitor through /rest/v1/rpc/expire_stale_pending_orders.
--   2. pg_cron enabled and the job scheduled every 15 minutes. cron.schedule()
--      with a job name replaces an existing job of that name, so a project
--      that already scheduled it by hand ends up with exactly one job.
--   3. A weekly purge of cron.job_run_details, which otherwise grows by about
--      a hundred rows a day for as long as the store runs.
--   4. One immediate run, so orders that are already stale do not wait for
--      the first tick.
--
-- If pg_cron cannot be enabled (a self-hosted Postgres without the
-- extension), the migration does NOT fail: it prints a WARNING with the manual
-- steps, and the function changes above still apply.
-- ============================================================

-- ============================================================
-- 1. THE EXPIRY FUNCTION
-- ============================================================
-- Two hours is well past the 1-hour lifetime of a Stripe Checkout session
-- (SESSION_TTL_SECONDS in create-checkout-session), so a session that is still
-- payable is never cancelled underneath the customer. If a payment does land
-- on an order this job already cancelled (a webhook outage longer than an
-- hour), the webhook parks the order with needs_review instead of losing it.
--
-- requires_action is deliberately left alone: delayed payment methods settle
-- over days, and an order held for an amount mismatch is the operator's call.
-- Stock is untouched — it only moves on 'paid' (migration 013).

CREATE OR REPLACE FUNCTION public.expire_stale_pending_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.orders
       SET status = 'cancelled'
     WHERE status IN ('pending', 'processing')
       AND created_at < NOW() - INTERVAL '2 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$;

-- The job runs as the database owner; nothing on the API side needs it.
REVOKE ALL     ON FUNCTION public.expire_stale_pending_orders() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_stale_pending_orders() TO service_role;

COMMENT ON FUNCTION public.expire_stale_pending_orders() IS
  'Cancels pending/processing orders older than 2 hours. Scheduled by pg_cron as job "expire-pending-orders" (migration 020).';

-- ============================================================
-- 2. ENABLE pg_cron
-- ============================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING
    'pg_cron could not be enabled (%). Enable it in Dashboard -> Database -> Extensions, then run this migration again.',
    SQLERRM;
END
$$;

-- ============================================================
-- 3. SCHEDULE THE JOBS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE WARNING
      'pg_cron is not installed, so stale orders will NOT expire automatically. After enabling it, run this migration again, or schedule the job by hand: SELECT cron.schedule(''expire-pending-orders'', ''*/15 * * * *'', ''SELECT public.expire_stale_pending_orders()'');';
    RETURN;
  END IF;

  -- What the dashboard grants when it enables the extension, so the jobs and
  -- their history stay readable and purgeable by the postgres role.
  BEGIN
    GRANT USAGE ON SCHEMA cron TO postgres;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipped the cron grants: this role cannot grant on schema cron (it usually holds them already).';
  END;

  PERFORM cron.schedule(
    'expire-pending-orders',
    '*/15 * * * *',
    'SELECT public.expire_stale_pending_orders()'
  );

  PERFORM cron.schedule(
    'purge-cron-history',
    '30 3 * * 0',
    $cmd$DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '14 days'$cmd$
  );

  RAISE NOTICE 'pg_cron jobs scheduled: expire-pending-orders (every 15 min), purge-cron-history (weekly).';
END
$$;

-- ============================================================
-- 4. FIRST RUN
-- ============================================================

DO $$
DECLARE
  expired_now INTEGER;
BEGIN
  expired_now := public.expire_stale_pending_orders();
  RAISE NOTICE 'expire_stale_pending_orders(): % stale order(s) cancelled now.', expired_now;
END
$$;

NOTIFY pgrst, 'reload schema';
