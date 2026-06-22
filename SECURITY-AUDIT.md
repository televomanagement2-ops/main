# CommerceJet — Security & Payments Audit

_Last reviewed: 2026-06-22. Scope: payment correctness and cybersecurity, with emphasis
on anything touching money. Stack: React 19 + Vite frontend, Supabase (Postgres + RLS,
Deno Edge Functions), Stripe Checkout._

## Summary

The payment architecture is fundamentally sound: amounts are recomputed server-side from
the database, the Stripe webhook signature is verified, refunds are idempotent, and orders
become immutable after payment. This audit found **one real money discrepancy** (tax was
recorded but never charged), which has been fixed, plus defense-in-depth reconciliation and
a configuration checklist for production.

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

- **Fix:** both paid-marking events (`checkout.session.completed` and
  `payment_intent.succeeded`) now compare the charged amount (cents) to `order.total`. On a
  mismatch beyond one cent, the order is held in `requires_action` for manual review and a
  loud error is logged. See `supabase/functions/stripe-webhook/index.ts`.

### VERIFIED OK — Server-side pricing (no client trust)
Product and shipping prices are read from the DB (`products`, `shipping_methods`); any
client-supplied `price`/`name`/`shipping_cost` is ignored. Subtotal, tax, and total are
recomputed server-side. Stock is validated before checkout.

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

- [ ] Set `ALLOWED_ORIGINS` (Edge Function secret) to the real production domain(s).
- [ ] Set `ALLOW_VERCEL_PREVIEWS=false` in production to disable preview-subdomain CORS.
- [ ] Confirm `STRIPE_WEBHOOK_SECRET` is set and the webhook endpoint is registered in the
      Stripe dashboard for the events handled (`checkout.session.completed`,
      `payment_intent.succeeded`/`payment_failed`, `checkout.session.expired`,
      `charge.refunded`, `refund.updated`).
- [ ] Switch Stripe keys from test to **live** mode for production.
- [ ] (Recommended) Configure **Stripe Tax** and switch to `automatic_tax` for correct
      per-jurisdiction US sales tax; until then the flat 10% estimate is what is charged.
- [ ] Confirm all migrations (incl. `003_payment_hardening.sql`) are applied to prod.
- [ ] Confirm `.env` is excluded from all deployments (frontend bundle must contain only
      the public anon key).
- [ ] Run a full test-mode checkout → webhook → refund and confirm the Stripe charge equals
      the order total shown in the app.
