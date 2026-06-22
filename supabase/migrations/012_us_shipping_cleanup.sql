-- ============================================================
-- MIGRATION 012 — US template: remove non-US "Poste" shipping method
-- ============================================================
-- The base seed (migration 004) historically included an Italian
-- "Poste Italiane" option. For a US-market store it is removed here so
-- any database that already ran the old seed is cleaned up. Idempotent.

DELETE FROM public.shipping_methods
WHERE id = 'c1000000-0000-0000-0000-000000000004';
