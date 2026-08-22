-- ============================================================
-- MIGRATION 014 — Role management (admin / customer)
-- Run after 013_payment_reliability.sql
-- ============================================================
-- Why this exists: migration 013 locked profile writes down to
-- (full_name, phone, avatar_url) for the `authenticated` role, which is
-- correct — nobody promotes themselves — but it left no supported way to
-- assign a role at all. This migration adds one:
--
--     select public.set_user_role('you@your-domain.com', 'admin');
--     select public.set_user_role('someone@else.com',   'customer');
--
-- Run it in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- From there the call is unauthenticated at the Postgres level and always
-- allowed — that is how the FIRST admin is created. Through the API the
-- same function requires the caller to already be an admin.
--
-- 1. handle_new_user(): never lets a signup fail, never leaves a user
--    without a profile row (there was nothing to set a role on).
-- 2. Backfill: profile rows for any auth.users left without one.
-- 3. set_user_role(): the supported way to promote / demote.
-- 4. Grants: re-affirmed explicitly so the dashboard and the Edge
--    Functions (service role) can always write profiles.
-- ============================================================

-- ============================================================
-- 1. PROFILE CREATION ON SIGNUP — made failure-proof
-- ============================================================
-- The old version inserted blindly: a duplicate id (re-created user) or a
-- NULL email (phone / some OAuth providers — the column is NOT NULL) raised
-- inside an AFTER INSERT trigger on auth.users, which aborts the whole
-- signup with "Database error saving new user" and leaves no profile.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- The trigger and the backfill below touch auth.users, which this role may
-- not own on a hardened project. They are guarded so a permission error
-- reports itself instead of rolling back the whole migration — the role
-- management in section 3 is what matters and must land either way.

DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE
    'Skipped on_auth_user_created: this role cannot manage triggers on auth.users. The existing trigger is unchanged.';
END
$$;

-- ============================================================
-- 2. BACKFILL — every account gets its profile row
-- ============================================================
-- Accounts created while the trigger was failing have no profile: they can
-- sign in but have no role, so the app treats them as a customer forever
-- and there is no row to edit in the Table Editor.

DO $$
DECLARE
  created INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  SELECT
    u.id,
    COALESCE(u.email, u.raw_user_meta_data->>'email', ''),
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'avatar_url'
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS created = ROW_COUNT;
  RAISE NOTICE 'Backfilled % missing profile row(s).', created;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipped profile backfill: this role cannot read auth.users.';
END
$$;

-- ============================================================
-- 3. set_user_role() — the supported promote / demote path
-- ============================================================
-- SECURITY DEFINER: it must write the `role` column, which no API role is
-- granted. Authorisation is explicit instead:
--   • no JWT (SQL Editor, psql, direct connection) → allowed. Bootstrap.
--   • role = service_role (Edge Functions)         → allowed.
--   • any other JWT (anon / authenticated)         → must be an admin.
-- EXECUTE is also revoked from anon, so an anonymous call never reaches
-- the body at all.

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
  target    public.profiles;
  admin_cnt INTEGER;
BEGIN
  IF jwt_role IS NOT NULL AND jwt_role <> 'service_role' AND NOT public.is_admin() THEN
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

REVOKE ALL     ON FUNCTION public.set_user_role(TEXT, public.user_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_user_role(TEXT, public.user_role) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_user_role(TEXT, public.user_role) IS
  'Assign the admin/customer role by email. SQL Editor and service role always; via the API, admins only.';

-- ============================================================
-- 4. GRANTS — re-affirmed (idempotent)
-- ============================================================
-- Customers still write only their own display fields; role/email/id stay
-- out of reach. The service role (Edge Functions, dashboard tooling) keeps
-- full access to the table.

REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT  UPDATE (full_name, phone, avatar_url) ON public.profiles TO authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- Make the new function visible to the REST API immediately.
NOTIFY pgrst, 'reload schema';
