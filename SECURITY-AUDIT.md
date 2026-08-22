# CommerceJet — Security & Payments Audit

_Last reviewed: 2026-08-22 (full-codebase review; previous pass 2026-06-22). Scope: the
whole repository — Edge Functions, schema/RLS/migrations, the client data layer, auth and
routing, headers, CI, and secret handling. Stack: React 19 + Vite frontend, Supabase
(Postgres + RLS, Deno Edge Functions), Stripe Checkout._

## Summary

The payment architecture is fundamentally sound: amounts are recomputed server-side from
the database, the Stripe webhook signature is verified, refunds are idempotent, and orders
become immutable after payment.

The **2026-06-22** pass found one real money discrepancy (tax recorded but never charged),
now fixed.

The **2026-08-22** full review found **no directly exploitable high-severity
vulnerability**, and fixed five issues: the amount reconciliation this document previously
claimed but which was never actually implemented in code; a duplicate-line-item bypass of
the checkout stock caps; `set_user_role()` authorising by elimination rather than by
allowlist; CORS trusting every `*.vercel.app` host; and reviewer `user_id` exposed on the
public reviews endpoint. Details below, each with the code location and its test coverage.

> **Keep this file honest.** A security document that asserts a control the code does not
> implement is worse than no document — it manufactures false assurance. The reconciliation
> entry below was in exactly that state between the two reviews. If you change a control,
> change this file in the same commit.

## Findings & status

### FIXED — Tax recorded but not charged (correctness / legal)
`create-checkout-session` recorded `order.total = subtotal + shipping + 10% tax`, but the
Stripe session line items contained only products + shipping (`automatic_tax` disabled).
Stripe therefore charged `subtotal + shipping`, while the order claimed tax was collected —
an accounting and legal discrepancy (you would record/owe tax you never actually collected).

- **Fix:** tax is now added as an explicit Stripe line item, so the amount charged equals
  the recorded `order.total`. See `supabase/functions/create-checkout-session/index.ts`.
- **Recommended next step (jurisdiction-correct US sales tax):** migrate to **Stripe Tax**
  (`automatic_tax: { enabled: true }` + product tax codes + billing-address collection) and
  persist the authoritative `session.total_details.amount_tax` from the webhook instead of a
  flat 10% estimate. This requires Stripe dashboard configuration (tax registration), so it
  is a deploy task, not a code-only change. The flat 10% is currently labeled "Estimated
  sales tax" to the customer.

### FIXED — No charged-vs-recorded amount reconciliation (defense in depth)
The webhook marked orders `paid` without comparing the amount Stripe charged against the
order total, so any future price/tax drift or tampering could be auto-fulfilled silently.
Worse, it *adopted* Stripe's figure as the new `order.total`, so an underpayment would have
rewritten the recorded total to match itself and left no trace.

- **Fix:** both paid-marking events (`checkout.session.completed` and
  `payment_intent.succeeded`) now reconcile **before** adopting anything. The comparison is
  in integer cents (doing it in dollars makes the tolerance itself unreliable —
  `100.01 - 100` is `0.010000000000005` in IEEE-754) with a one-cent tolerance. On a
  mismatch the order is held in `requires_action`, flagged `needs_review` with a
  `review_reason`, the confirmation email is suppressed, the recorded total is left
  untouched, and a loud error is logged. The Stripe session/payment-intent ids are still
  recorded so the operator can investigate and refund.
  See `decide()` / `reconcileAmount()` in `supabase/functions/_shared/webhook-logic.ts`,
  covered by the `amount reconciliation (M4)` tests in `webhook-logic.test.ts`.
- **Stripe Tax mode:** when `STRIPE_TAX_ENABLED=true` the recorded total legitimately
  excludes tax, so reconciliation subtracts `total_details.amount_tax` before comparing.
  `payment_intent.succeeded` carries no tax breakdown, so there it asserts only that Stripe
  never collected *less* than recorded. **`STRIPE_TAX_ENABLED` must be set identically on
  `create-checkout-session` and `stripe-webhook`** — a mismatch parks paid orders for
  review (fail-safe, but noisy).

### FIXED — Duplicate line items bypassed the stock and quantity caps
`create-checkout-session` de-duplicated product ids for the *lookup* but ran the
`MAX_QUANTITY_PER_ITEM` and stock checks **per line item**. Fifty separate lines of the same
product, each at the stock limit, passed every individual check and produced one order for
50× the available stock. The DB deliberately allows negative stock (backorder depth,
migration 013), so there was no backstop. Reachable by anyone who can call the function with
hand-written JSON — the storefront cart is not the trust boundary.

- **Fix:** lines are collapsed by `(product_id, selected_size)` and the quantities summed
  **before** validation. The variant check uses the merged per-size total; the product-level
  stock check uses the total across all sizes of that product, because
  `products.stock_quantity` is shared across variants (the deduct trigger decrements it for
  every order item regardless of size). Merging also produces cleaner Stripe line items.
  See `supabase/functions/create-checkout-session/index.ts`.

### FIXED — `set_user_role()` authorised by elimination
Migration 014 refused the call only when a JWT `role` claim was present and not an admin, so
a **NULL** `jwt_role` (no `request.jwt.claims`) fell through to the allowed path. That was
deliberate — it is how the first admin is bootstrapped from the SQL Editor — and it was not
reachable over the REST API (EXECUTE revoked from `anon`; PostgREST always populates the
claim). It was still the wrong shape: any execution context lacking the GUC (pg_cron,
database webhooks, triggers, a future `SECURITY DEFINER` caller) got full role escalation.

- **Fix:** inverted to an allowlist — a direct database session, `service_role`, or an
  existing admin. Everything else is refused explicitly. The bootstrap uses `session_user`
  (not `current_user`, which inside a `SECURITY DEFINER` function is the function owner and
  therefore useless for authorisation). See
  `supabase/migrations/015_set_user_role_deny_by_default.sql`.

### FIXED — CORS trusted every `*.vercel.app` host
`ALLOW_VERCEL_PREVIEWS=true` matched any hostname ending in `.vercel.app` — a domain anyone
can deploy a free project on. Not cross-user exploitable (sessions live in origin-scoped
`localStorage`, no cookies, `Access-Control-Allow-Credentials` is never sent), but far wider
than intended.

- **Fix:** previews now additionally require `VERCEL_PREVIEW_PREFIX` (your project's
  hostname prefix) and HTTPS, and are rejected with a loud warning if it is unset. A literal
  `*` in `ALLOWED_ORIGINS` still works as an explicit opt-in but now logs a warning at
  startup. `handle-order-action` and `update-tracking` also fail closed with a 403 on an
  unauthorised browser origin instead of merely omitting the CORS header, matching
  `create-checkout-session`. Requests with **no** `Origin` header are still accepted —
  those are server-to-server callers, still authenticated by their bearer token.
  See `supabase/functions/_shared/cors.ts`.

### FIXED — Reviewer `user_id` exposed publicly
`product_reviews` is world-readable (RLS `USING (TRUE)`) and `fetchReviews` selected `*`,
returning every reviewer's auth UUID to anonymous visitors. Migration 013 had already fixed
the more serious email leak via the `author_name` snapshot; this was the leftover.

- **Fix:** the review queries now use an explicit column allowlist that omits `user_id`
  (`PUBLIC_REVIEW_COLUMNS` / the `PublicProductReview` type). See `src/lib/api.ts`.

### VERIFIED OK — Server-side pricing (no client trust)
Product and shipping prices are read from the DB (`products`, `shipping_methods`); any
client-supplied `price`/`name`/`shipping_cost` is ignored. Subtotal, tax, and total are
recomputed server-side. Stock is validated before checkout, against quantities summed across
duplicate lines.

### VERIFIED OK — Webhook authenticity & idempotency
Signatures are verified via `stripe.webhooks.constructEventAsync` with
`STRIPE_WEBHOOK_SECRET`; missing/invalid signatures return 400. Replays are de-duplicated
via the `processed_stripe_events` table (event id primary key).

### VERIFIED OK — Refunds
Customer cancel and admin refund both use a Stripe idempotency key (`refund_${orderId}`)
and a `refund_id` lock, preventing double refunds. Admin refunds verify the admin role and
cap the amount at the order total.

### VERIFIED OK — Order immutability
A DB trigger blocks changes to financial fields (`subtotal`, `tax_amount`, `total`,
`shipping_cost`, `shipping_address`) once an order is `paid`
(`supabase/migrations/003_payment_hardening.sql`).

### VERIFIED OK — AuthZ / IDOR
Row Level Security restricts orders, order items, addresses, carts to their owner (admins
via a `SECURITY DEFINER is_admin()` with a pinned `search_path`). Users cannot change their
own `role`. Edge Functions validate the JWT and re-check ownership/admin on sensitive
actions. No IDOR found on order read/cancel.

### VERIFIED OK — Injection / XSS / secrets
Queries go through the parameterized Supabase SDK (no raw SQL from user input). No
`dangerouslySetInnerHTML`/`innerHTML`/`eval`. The frontend ships only the **public** anon
key; secret keys (Stripe, service role, Resend) live in Edge Function env, not in the repo.
`.env` is gitignored.

### NOTE — Dead stylesheets
`src/App.css` and `src/index.css` are not imported anywhere (legacy template cruft). They
reference their own local tokens and have no runtime effect. Safe to delete later; left in
place to avoid unrelated churn.

## Pre-production checklist

- [ ] Set `ALLOWED_ORIGINS` (Edge Function secret) to the real production domain(s), and
      make sure it does **not** contain `*` (the function logs a warning if it does).
- [ ] Set `ALLOW_VERCEL_PREVIEWS=false` in production to disable preview-subdomain CORS.
      If you leave it on for a staging project, also set `VERCEL_PREVIEW_PREFIX` — previews
      are rejected without it.
- [ ] Set `STRIPE_TAX_ENABLED` to the **same** value on `create-checkout-session` and
      `stripe-webhook`, or paid orders will be parked for review by amount reconciliation.
- [ ] Confirm `STRIPE_WEBHOOK_SECRET` is set and the webhook endpoint is registered in the
      Stripe dashboard for the events handled (`checkout.session.completed`,
      `payment_intent.succeeded`/`payment_failed`, `checkout.session.expired`,
      `charge.refunded`, `refund.updated`).
- [ ] Switch Stripe keys from test to **live** mode for production.
- [ ] (Recommended) Configure **Stripe Tax** and set `STRIPE_TAX_ENABLED=true` for correct
      per-jurisdiction US sales tax. Until then the flat `TAX_RATE` (a fraction, e.g. `0.07`;
      **default `0`** — a fresh install charges no tax) is added as an explicit
      "Estimated sales tax" line item, so the amount charged equals the recorded total.
      Keep `TAX_RATE` in sync with the frontend `VITE_TAX_RATE`.
- [ ] Confirm all migrations (incl. `003_payment_hardening.sql`) are applied to prod.
- [ ] Confirm `.env` is excluded from all deployments (frontend bundle must contain only
      the public anon key).
- [ ] Run a full test-mode checkout → webhook → refund and confirm the Stripe charge equals
      the order total shown in the app.
