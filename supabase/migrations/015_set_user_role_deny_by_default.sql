-- ============================================================
-- MIGRATION 015 — set_user_role(): deny by default
-- Run after 014_role_management.sql
-- ============================================================
-- Migration 014 authorised the function by ELIMINATION:
--
--     IF jwt_role IS NOT NULL AND jwt_role <> 'service_role'
--        AND NOT public.is_admin() THEN  RAISE 'Admin access required'
--
-- so a NULL jwt_role (no `request.jwt.claims` GUC) fell through to the
-- ALLOWED path. That is fine for the SQL-Editor bootstrap it was written for,
-- and it is not reachable over the REST API today (EXECUTE is revoked from
-- anon, and every PostgREST request carries a JWT whose `role` claim is set).
--
-- It is still the wrong shape: it grants full role escalation to ANY execution
-- context that happens not to have the GUC. A pg_cron job, a database webhook,
-- a trigger, or any future SECURITY DEFINER function that calls this one lands
-- on the allowed branch. One forgotten caller turns into privilege escalation.
--
-- This migration inverts it into an allowlist. Nothing about the supported
-- workflow changes: the SQL Editor bootstrap still works, Edge Functions still
-- work, admins still work — everything else is now refused explicitly.
--
-- Why session_user and not current_user:
--   • Inside a SECURITY DEFINER function `current_user` is the function OWNER,
--     so it is the same value no matter who called — useless for authorisation.
--   • `session_user` is the role the connection authenticated as and is NOT
--     changed by SECURITY DEFINER or by SET ROLE. PostgREST always connects as
--     `authenticator` and then SET ROLE anon/authenticated/service_role, so
--     session_user cleanly separates "holds database credentials" from
--     "holds an API token".
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_user_role(
  user_email TEXT,
  new_role   public.user_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims    JSONB := NULLIF(current_setting('request.jwt.claims', TRUE), '')::JSONB;
  jwt_role  TEXT  := claims->>'role';
  -- A direct database session: SQL Editor, psql, migrations, pg_cron. Every
  -- API request arrives as `authenticator` (then SET ROLE), so these four are
  -- the only role names that can represent API traffic.
  is_direct_session BOOLEAN :=
    session_user NOT IN ('authenticator', 'anon', 'authenticated', 'service_role');
  target    public.profiles;
  admin_cnt INTEGER;
BEGIN
  -- ── Authorisation: allowlist. Anything not named here is refused.
  IF NOT (
    is_direct_session                 -- bootstrap: SQL Editor / psql
    OR jwt_role = 'service_role'      -- Edge Functions
    OR public.is_admin()              -- an existing admin, via the API
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO target
    FROM public.profiles
   WHERE lower(email) = lower(btrim(user_email));

  IF target.id IS NULL THEN
    RAISE EXCEPTION
      'No profile found for %. The account must sign up first (check auth.users).',
      user_email
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Demoting the last admin would lock everyone out of /admin, and only a
  -- SQL Editor session could undo it. Refuse.
  IF target.role = 'admin' AND new_role <> 'admin' THEN
    SELECT COUNT(*) INTO admin_cnt FROM public.profiles WHERE role = 'admin';
    IF admin_cnt <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last admin. Promote another account first.'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  UPDATE public.profiles
     SET role = new_role
   WHERE id = target.id
   RETURNING * INTO target;

  RETURN jsonb_build_object(
    'id',    target.id,
    'email', target.email,
    'role',  target.role
  );
END;
$$;

-- Re-affirm the grants (idempotent; unchanged from migration 014).
REVOKE ALL     ON FUNCTION public.set_user_role(TEXT, public.user_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_user_role(TEXT, public.user_role) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_user_role(TEXT, public.user_role) IS
  'Assign the admin/customer role by email. Allowlist: direct DB session (SQL Editor/psql), service_role, or an existing admin. Everything else is refused.';

NOTIFY pgrst, 'reload schema';
