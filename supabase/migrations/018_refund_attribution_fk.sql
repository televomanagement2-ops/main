-- ============================================================
-- MIGRATION 018 — orders.refund_requested_by: delete behaviour + embed docs
-- Run after 017_international_shipping.sql
-- ============================================================
-- IMPORTANT: if 016_abuse_limits_and_indexes.sql has not been applied to this
-- database, run it BEFORE this file. It is idempotent, and one of its effects
-- (the narrowed "orders: owner cancel" policy) is a fix this migration assumes
-- is already in place.
--
-- 1. refund_requested_by was added in 017 with no ON DELETE action, so it
--    defaults to NO ACTION. That column points at whoever ASKED for the refund,
--    which for an admin-issued refund is the ADMIN — on somebody else's order.
--    The result: an operator's profile can no longer be deleted once they have
--    refunded anything, and because profiles.id cascades from auth.users, the
--    auth deletion itself fails with a foreign-key error that names a table the
--    operator never touched. SET NULL is the right action: the attribution is
--    only used by the self-service refund rate limit, which already treats NULL
--    as "not customer-initiated" (see 017's comment on historical rows).
--
--    orders.user_id deliberately keeps ON DELETE RESTRICT — an order must not
--    lose its buyer.
--
-- 2. Documents the embed ambiguity 017 introduced. See below.
-- ============================================================

-- ============================================================
-- 1. refund_requested_by — ON DELETE SET NULL
-- ============================================================

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_refund_requested_by_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_refund_requested_by_fkey
    FOREIGN KEY (refund_requested_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ============================================================
-- 2. THE EMBED AMBIGUITY — read this before adding a profiles join
-- ============================================================
-- With refund_requested_by in place, public.orders references public.profiles
-- TWICE. PostgREST cannot guess which one a `profiles(...)` embed means and
-- refuses the whole request:
--
--   PGRST201 — Could not embed because more than one relationship was found
--              for 'orders' and 'profiles'
--
-- That is a hard failure, not a degraded response: between 017 and this
-- migration it broke the admin order list, every order-mutating Edge Function
-- reply (including the ones that run AFTER the Stripe refund has succeeded),
-- and the order confirmation email the webhook sends.
--
-- Every embed of profiles from orders must therefore name the relationship:
--
--   .select('*, order_items(*), profiles!orders_user_id_fkey(full_name, email)')
--
-- The constraint names are pinned by this migration and by schema.sql, so the
-- hint is stable. `src/lib/api.ts` exports ORDER_CUSTOMER_EMBED for the client.

COMMENT ON CONSTRAINT orders_refund_requested_by_fkey ON public.orders IS
  'Second FK from orders to profiles. Makes a bare profiles(...) embed ambiguous (PGRST201) — embeds must use the profiles!orders_user_id_fkey hint to reach the buyer.';

COMMENT ON CONSTRAINT orders_user_id_fkey ON public.orders IS
  'The buyer. This is the relationship PostgREST embeds must name explicitly: profiles!orders_user_id_fkey(...).';

NOTIFY pgrst, 'reload schema';
