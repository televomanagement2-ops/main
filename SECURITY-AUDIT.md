# CommerceJet — Security & Payments Audit

_Last reviewed: 2026-08-25 (pre-launch review; previous passes 2026-08-22, 2026-06-22).
Scope: the whole repository — Edge Functions, schema/RLS/migrations, the client data layer,
auth and routing, headers, CI, dependencies, and secret handling. Stack: React 19 + Vite
frontend, Supabase (Postgres + RLS, Deno Edge Functions), Stripe Checkout._

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
public reviews endpoint.

The **2026-08-25** pre-launch review again found **no directly exploitable high-severity
vulnerability from an unauthenticated attacker**, and fixed eight issues: `products.cost_price`
(the store's margin) readable by any visitor; a shipping address accepted with no validation
of type, length or destination country; unbounded rows and text writable by any registered
account; a partial admin refund silently marking the order fully refunded and restoring all
stock; an authorisation check running after an order lookup that leaked order existence; a
customer-cancellable `processing` order whose Stripe session stayed payable; deploy
configuration for `verify_jwt` sitting in a path the CLI never reads; and a dependency
advisory. Details below, each with the code location and its test coverage.

> **Keep this file honest.** A security document that asserts a control the code does not
> implement is worse than no document — it manufactures false assurance. The reconciliation
> entry below was in exactly that state between the two reviews. If you change a control,
> change this file in the same commit.

## Findings & status

### FIXED (2026-08-25) — `products.cost_price` published to every visitor
`products` is world-readable (RLS `products: public read active`) and every client query
selected `*`, so `cost_price` — what the store pays per item, i.e. its margin on the whole
catalog — came back to anyone. RLS is row-level and could not help, and the anon key is
public by design, so `GET /rest/v1/products?select=name,price,cost_price` was a complete
margin dump for any visitor. No UI has ever read the column.

- **Fix:** column-level grants. Migration 016 revokes table-wide `SELECT` on `products`
  from `anon`/`authenticated` and re-grants every column *except* `cost_price` (derived
  from the live table, so a project with extra columns keeps them). `service_role` keeps
  full access for reporting. Consequence: `SELECT *` on `products` is now refused for API
  roles, so `src/lib/api.ts` names its columns via `PRODUCT_COLUMNS`.
- **Verify:** `select has_column_privilege('anon','public.products','cost_price','SELECT');`
  must be `false`.

### FIXED (2026-08-25) — Shipping address accepted without validation
`create-checkout-session` checked only that six address fields were *truthy*, then wrote the
object verbatim into the `orders.shipping_address` JSONB and, with Stripe Tax on, into
`stripe.customers.create`. There was no check of type, length or destination. An
authenticated caller posting hand-written JSON could persist arbitrarily large blobs, send
non-strings (`String({})` is `"[object Object]"`, which passes a presence check and reaches
the warehouse as a real address), and order to **any country** — the country list and postal
patterns lived only in the checkout form, and the cart is not the trust boundary.

- **Fix:** `sanitizeAddress()` in `supabase/functions/_shared/address.ts` — string-typed
  fields, control characters stripped, per-field length caps, country allowlist, postal
  pattern re-checked server-side, and a return value containing only the eight known keys
  so unknown ones are dropped. The module is the single source of truth: the checkout form
  imports the same country list, patterns and caps, so the two cannot drift. Backstopped by
  `orders_shipping_address_size_check` in migration 016.
- **Tests:** `supabase/functions/_shared/address.test.ts` (19 cases, including the
  `[object Object]` coercion, the country allowlist and the boundary lengths).

### FIXED (2026-08-25) — Unbounded writes from any registered account
`addresses` had an ownership-only INSERT policy, no per-user row cap and no column length
limits, so one signed-up account could write unlimited rows of unlimited `TEXT`.
`product_reviews.body` had no length cap either, and reviews are served to every anonymous
visitor of the product page.

- **Fix:** migration 016 adds `CHECK` length constraints on `addresses`,
  `product_reviews.body` (2000), and `profiles.full_name`/`phone` (the latter feeds the
  `author_name` review snapshot), plus a `BEFORE INSERT` trigger capping saved addresses at
  20 per user. Client-side, the address form and the review textarea carry matching
  `maxLength`, and `submitReview()` trims and clamps. The constraints are added `NOT VALID`
  and validated separately, so pre-existing oversize rows are reported rather than aborting
  the migration — new and updated rows are constrained either way.

### FIXED (2026-08-25) — Partial admin refund marked the order fully refunded
`handle-order-action`'s `refund` action always wrote `status: 'refunded'`, whatever `amount`
was passed. `refunded` is not a label: `manage_stock_on_status_change()` (migration 013)
puts **every** line back into stock on `paid → refunded`, and `admin_analytics()` drops the
order from revenue. Refunding $10 of a $500 order did both. The Finance UI only issues full
refunds, so this was latent — but `refundOrder(orderId, amount?)` exposes the parameter and
any admin could reach it over the API.

- **Fix:** the order moves to `refunded` only when the refund covers the total
  (`refundValue >= order.total - 0.005`); a partial refund records `refund_amount` and
  leaves the order fulfillable. Same rule already used for `charge.refunded` in
  `_shared/webhook-logic.ts`, now applied on both paths.

### FIXED (2026-08-25) — Authorisation ran after the order lookup
`handle-order-action` fetched the order and checked `refund_id` **before** verifying that
the caller owned it, so the responses distinguished `404 ORDER_NOT_FOUND`,
`409 ORDER_ALREADY_REFUNDED` and `403 AUTH_NOT_OWNER` for any order id. UUIDv4 made
enumeration impractical, but the shape was wrong.

- **Fix:** the admin check for `refund`/`deliver` needs no order at all and now runs before
  the lookup; ownership for `cancel` is checked immediately after the fetch and answers a
  uniform `404`. `refund_id` is checked only once the caller is entitled to the row.

### FIXED (2026-08-25) — A customer could cancel a still-payable order
The `orders: owner cancel` RLS policy allowed `processing → cancelled` directly over
PostgREST. A Stripe Checkout session stays payable for an hour, so cancelling the row and
then paying took the money for an order the transition guard refused to mark `paid`, parking
it in `needs_review`. It failed safe, but only if the operator watches that queue.

- **Fix:** migration 016 narrows the policy to `status = 'pending'` (no Stripe session
  open yet). Pre-payment cancels now go through `handle-order-action`, which retrieves the
  session, **refuses the cancel** if payment already completed, expires the session
  otherwise, and re-asserts the pre-payment status in the `UPDATE ... WHERE` so it cannot
  race the webhook.

### FIXED (2026-08-25) — `verify_jwt` config in a path the CLI does not read
`supabase/functions/<name>/config.toml` is not a location the Supabase CLI reads; function
settings come from `supabase/config.toml`, which did not exist. The three files declaring
`verify_jwt = false` were inert, so `supabase functions deploy` fell back to `true`. On
`stripe-webhook` that means the gateway rejects Stripe's (signature-authenticated, JWT-less)
POST with 401 before the function runs: paid orders never reach `paid`, and the
expire-pending-orders cron cancels them two hours later with the card already charged. The
live deployment was configured correctly by hand, so this was a redeploy/reinstall trap
rather than an active outage.

- **Fix:** `supabase/config.toml` declares `verify_jwt` for all four functions; the three
  inert files are deleted; `SETUP_CHECKLIST.md` documents the one-line `curl` that
  distinguishes a reachable webhook (400) from a gateway-blocked one (401).

### FIXED (2026-08-25) — Dependency advisory
`react-router`/`react-router-dom` 7.18.1 carried GHSA-qwww-vcr4-c8h2 (CSRF bypass in RSC
mode). The app uses `createBrowserRouter` in data mode and no RSC, so the vulnerable path
was not reachable — bumped to 7.18.2 regardless. `npm audit` is clean for production and
dev dependencies.

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

### NOTE (2026-08-25) — Legal and contact placeholders still unfilled
`src/config/storeConfig.ts` still carries `[SELLER_LEGAL_NAME]`, `[SELLER_ENTITY_TYPE]`,
`[BUSINESS_ADDRESS]`, `[GOVERNING_STATE]`, `[ARBITRATION_BODY]`, `[RETURN_WINDOW]`,
`support@example.com` and `privacy@example.com`. Those values are injected **verbatim** into
the Privacy Policy, Terms and Cookie Policy, so a live store collecting personal data would
name its data controller as `[SELLER_LEGAL_NAME]` (GDPR Art. 13). `hasUnfilledPlaceholders()`
exists in that file but is not called anywhere. Deliberately left to the operator — nobody
else can supply these — but it is a launch blocker, not cosmetic.

Related: `_shared/store.ts` defaults `SUPPORT_EMAIL` to `support@example.com`. Without
`RESEND_FROM_EMAIL` pointing at a domain verified in Resend, transactional mail sends from a
non-existent address and fails SPF/DKIM.

### NOTE (2026-08-25) — `supabase/.temp` in git history
The Supabase CLI cache (project ref + organization id) is present in eight historical
commits; it is correctly `.gitignore`d now. The project ref is public anyway — it is in the
frontend bundle as `VITE_SUPABASE_URL` — so there is no exposure to fix, but the history
should be scrubbed before handing the repository to a licensee.

### NOTE — Dead stylesheets
`src/App.css` and `src/index.css` are not imported anywhere (legacy template cruft). They
reference their own local tokens and have no runtime effect. Safe to delete later; left in
place to avoid unrelated churn.

## Pre-production checklist

- [ ] Apply migrations **015 and 016** — both are security migrations. Then run the
      verification queries in `supabase/SETUP_CHECKLIST.md` (`set_user_role` allowlist form,
      the four length constraints, and `has_column_privilege('anon', …, 'cost_price')`
      returning false).
- [ ] `curl -X POST https://<ref>.supabase.co/functions/v1/stripe-webhook` must return
      **400**, not 401. A 401 means the gateway is rejecting Stripe before the function runs.
- [ ] Fill in `src/config/storeConfig.ts` — the legal pages render the placeholders verbatim.
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
