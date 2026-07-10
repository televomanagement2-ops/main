# Production Readiness Roadmap

Tracking file for the production-hardening plan (full audit → fix). Each item is
checked off as it lands. Severity codes (C/H/M/L) reference the audit findings.

**Owner decisions baked into this plan:**
- Oversell: honor paid orders, allow negative stock, flag `needs_review` (no auto-refund).
- Self-refund: keep instant customer cancel+refund pre-shipment, rate-limited.
- DB cart: removed entirely — localStorage cart is the only cart.

---

## Phase 0 — Repo & secrets hygiene (H8)

- [x] Untrack `supabase/.temp` (leaked project ref / org id / pooler URL)
- [x] Untrack `.claude/settings.local.json`
- [ ] Add `.claude/settings.local.json` to `.gitignore`
- [x] Remove `tools/supabase.exe` + `tools/supabase.tar.gz` (130 MB binaries)
- [ ] Rewrite `tools/README.md` to point at official Supabase CLI install
- [ ] `.env`: remove `SUPABASE_SERVICE_ROLE_KEY` + dead `VITE_IUBENDA_*` vars
- [x] Delete duplicate Italian `SECURITY_AUDIT.md`
- [ ] **OPERATOR:** rotate service-role (+ anon) key in Supabase dashboard

## Phase 1 — Payments core

### 1a. Migration `013_payment_reliability.sql`
- [ ] `orders.needs_review` + `orders.review_reason` columns
- [ ] Drop `CHECK (stock_quantity >= 0)` on products / `stock_qty` on variants (allow oversell depth)
- [ ] Rewrite `manage_stock_on_status_change()` as BEFORE UPDATE: deduct without RAISE, flag oversold (C1), handle variant stock (H5)
- [ ] Re-add pending-order limit trigger, cap 10 (H2, reverses 006)
- [ ] Drop `orders: owner insert` RLS policy (H2)
- [ ] Profiles column lockdown: revoke UPDATE, grant only `full_name, phone, avatar_url