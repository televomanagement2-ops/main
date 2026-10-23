# CommerceJet — Stripe Setup

**Accept payments, confirm orders & charge sales tax.**

## Contents

1. Create your Stripe account
2. Add the secret key to Supabase
3. Create the webhook
4. Add the webhook secret to Supabase
5. Configure sales tax (US)
6. Test a payment
7. Go live (test → production)

> **Note —** The checkout flow: the app creates a Stripe Checkout session → the customer pays
> on Stripe → Stripe notifies your backend via a **webhook** → the order is marked paid and
> stock is reduced. Both the secret key and the webhook are required for orders to complete.

---

## 1. Create your Stripe account

Sign up at [stripe.com](https://stripe.com). Build everything in **Test mode** (toggle in the
dashboard) with fake cards before going live.

---

## 2. Add the secret key to Supabase

Stripe → Developers → API keys. Copy the **Secret key** (`sk_test_…` in test mode). Add it as
a Supabase Edge Function secret (Supabase → Project Settings → Edge Functions → Secrets):

```
STRIPE_SECRET_KEY=sk_test_...
```

> **Important —** The secret key is private — it lives only in Supabase secrets, never in the
> frontend or in GitHub.

---

## 3. Create the webhook

Stripe → Developers → Webhooks → Add endpoint. Endpoint URL (your deployed function):

```
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

Select these events:

| Event | Why |
|---|---|
| `checkout.session.completed` | Payment finished → mark order paid. |
| `checkout.session.expired` | Checkout abandoned → cancel order. |
| `payment_intent.succeeded` | Payment confirmed. |
| `payment_intent.payment_failed` | Payment failed → mark failed. |
| `charge.refunded` | Refund issued (from the admin or the Stripe dashboard) → record it on the order. |
| `refund.updated` | Refund status changed (e.g. failed) → update the record and flag the order. |

---

## 4. Add the webhook secret to Supabase

After creating the endpoint, Stripe shows a **Signing secret** (`whsec_…`). Add it as a
secret:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Important —** This lets your backend verify that webhook calls really came from Stripe. If
> it's wrong or missing, you'll see "400 signature" errors and orders stay pending after
> payment.

---

## 5. Configure sales tax (US)

US sales tax varies by state. The template supports two modes via Edge Function secrets:

**A. Flat estimate (default).** Keep `STRIPE_TAX_ENABLED=false` and set `TAX_RATE` to a
fraction (e.g. `0.07` = 7%, default `0`). The tax is charged as an explicit line item so the
Stripe charge always equals the recorded order total. Set the frontend `VITE_TAX_RATE` to the
same value so the cart estimate matches.

```
TAX_RATE=0
STRIPE_TAX_ENABLED=false
```

**B. Stripe Tax (recommended for real US compliance).** Set `STRIPE_TAX_ENABLED=true` and keep
`TAX_RATE=0` / `VITE_TAX_RATE=0`. Checkout enables `automatic_tax`, passes the customer
address, and Stripe computes the correct per-jurisdiction tax; the webhook then writes the
authoritative tax/total back to the order.

```
TAX_RATE=0
STRIPE_TAX_ENABLED=true
```

> **Important —** Mode B requires Stripe Tax to be **enabled in the Stripe dashboard** (register
> your origin address and set product tax codes), otherwise checkout will error. Until then,
> use mode A.

---

## 6. Test a payment

With Stripe in **Test mode**, check out on your site with a test card:

| Field | Value |
|---|---|
| Card number | `4242 4242 4242 4242` |
| Expiry | Any future date (e.g. `12/34`) |
| CVC | Any 3 digits |
| ZIP | Any value |

After paying you should land on the success page, the order should show as **paid** in the
`orders` table, stock should decrease, and the customer receives an order-confirmation email
(when `RESEND_API_KEY` is configured). (In Stripe → Developers → Webhooks you can inspect
and resend each delivery — useful if an order stays pending. Resending a processed event is
safe: the webhook answers `duplicate: true` and changes nothing.)

Good to know about the payment flow:

- **Checkout sessions expire after 1 hour**; the pg_cron job (guide 03) cancels the
  matching order after 2 hours, so it can never cancel a still-payable session.
- **Paid orders are always honored.** If stock runs out between two concurrent checkouts,
  both orders are marked paid, stock goes negative, and the later order is flagged
  **needs_review** in Admin → Orders (badge + filter). See `supabase/SETUP_CHECKLIST.md`.
- **Refunds.** Refund from Admin → Orders → the order → **Refunds**: choose the lines and
  quantities (and whether each goes back in stock) and the shipping; the amount is suggested
  and can be changed, and you can refund again later until nothing is left. Refunds made in
  the Stripe dashboard are recorded too, one by one. A partial refund keeps the order `paid`;
  only a full one moves it to `refunded` — and, if it had not shipped yet, puts its goods back
  in stock. A refund that fails flags the order **needs_review**.
- **Waiting payments.** An order still waiting for payment has **Check with Stripe** (applies
  what Stripe says, if the webhook was missed) and **Cancel order**, which closes the Stripe
  checkout first so it can no longer be paid. An order held for review after an amount
  mismatch has **Confirm payment**, once Stripe shows it as paid.
- **Discount codes** (Admin → Discounts) need nothing in Stripe: each checkout gets a one-off
  coupon for exactly the discount the store computed, so the Stripe receipt shows it and the
  amount charged matches the order.

---

## 7. Go live (test → production)

Switch the Stripe dashboard to **Live mode** and repeat: copy the live secret key, create a
live webhook endpoint (same URL, same events), and update the two Supabase secrets
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) with the live values.

> **Important —** Live and test keys are separate. After switching, run one real low-value
> purchase to confirm the whole flow works in production, then refund it from the Stripe
> dashboard.
