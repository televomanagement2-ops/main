# CommerceJet — Supabase Setup

**Database, login (incl. Google), and backend functions.**

## Contents

1. Create the Supabase project
2. Create the database (run the SQL files)
3. Get your frontend keys
4. Enable login (email + Google)
5. Set the backend secrets
6. Deploy the Edge Functions
7. Quick test

> **Note —** Supabase is your backend: database, user authentication, and serverless Edge
> Functions for checkout, webhooks, and emails. Do this guide first.

---

## 1. Create the Supabase project

Go to [supabase.com](https://supabase.com) → New Project. Choose a name and a strong database
password (save it). Wait ~2 minutes for it to provision. Your project gets a URL like
`https://<project-ref>.supabase.co`. You'll use `<project-ref>` repeatedly.

---

## 2. Create the database

Open Dashboard → SQL Editor and run, **in this exact order** (paste each file's contents and
click Run):

1. `supabase/schema.sql` — tables & types
2. `supabase/rls.sql` — security policies
3. **Every file in `supabase/migrations/` in numeric order** — `001_fixes.sql` through
   `013_payment_reliability.sql`. Run each one.
4. `supabase/seeds/002_mock_products.sql` — optional demo catalog (skip if you'll add your
   own products right away)

> **Important —** Run the migrations in order. They build on each other; skipping one can
> leave the checkout schema incomplete. If your database already ran 001–012, only run
> `013_payment_reliability.sql`, then `NOTIFY pgrst, 'reload schema';`

Then schedule the stale-order cleanup (**required** — otherwise abandoned checkouts stay
`pending` forever). Dashboard → Database → Extensions → enable **pg_cron**, then run:

```sql
SELECT cron.schedule('expire-pending-orders', '*/15 * * * *',
  $$SELECT public.expire_stale_pending_orders()$$);
```

> **Tip —** `supabase/SETUP_CHECKLIST.md` contains verification queries to confirm every
> required column exists, plus how the `needs_review` backorder flag works.

---

## 3. Get your frontend keys

Dashboard → Project Settings → API. Copy:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

Put them in your local `.env` (copy from `.env.example`). You'll also add them to Vercel later.

> **Important —** The `service_role` key is a secret with full database access. Never put it
> in the frontend `.env` or the browser — it's only used by Edge Functions, where Supabase
> injects it automatically.

---

## 4. Enable login (email + Google)

**Email/password** works out of the box (optionally require email confirmation under
Authentication → Providers → Email).

**Google login (OAuth):**
1. Google Cloud Console → create a project → APIs & Services → Credentials → OAuth client ID
   (Web application).
2. Authorized redirect URI (exactly): `https://<project-ref>.supabase.co/auth/v1/callback`
3. Copy the Client ID + Secret.
4. Supabase → Authentication → Providers → Google → enable, paste Client ID + Secret → Save.

> **Note —** After you connect a custom domain (see guide 05), also set your Site URL +
> Redirect URLs under Authentication → URL Configuration, because the app redirects back using
> your live domain.

---

## 5. Set the backend secrets

Dashboard → Project Settings → Edge Functions → Secrets. Add:

```
STRIPE_SECRET_KEY=sk_test_...        # from Stripe (see guide 06)
STRIPE_WEBHOOK_SECRET=whsec_...       # from Stripe webhook (see guide 06)
SUPABASE_ANON_KEY=eyJ...              # same anon key as the frontend
# REQUIRED — CORS fails closed: with this unset, browsers cannot call the
# functions at all, and checkout returns 403 (redirect URLs are built from the
# caller's origin). Local dev: http://localhost:5173
ALLOWED_ORIGINS=https://yourstore.com # see guide 05 (CORS)
ALLOW_VERCEL_PREVIEWS=false           # default false; "true" only on previews
# Sales tax (see guide 06)
TAX_RATE=0
STRIPE_TAX_ENABLED=false
# Email (optional, for shipping/refund/delivery notifications)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Your Store <support@yourstore.com>
STORE_NAME=Your Store
SUPPORT_EMAIL=support@yourstore.com
```

> **Note —** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
> Supabase — you do not add them yourself.

---

## 6. Deploy the Edge Functions

Install the Supabase CLI, log in, link your project, and deploy the **four** functions:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy update-tracking
supabase functions deploy handle-order-action
```

| Function | What it does |
|---|---|
| `create-checkout-session` | Starts a Stripe payment for the cart. |
| `stripe-webhook` | Confirms payment & updates the order status. |
| `update-tracking` | Saves tracking info & emails the customer. |
| `handle-order-action` | Order actions (cancel, refund, mark delivered) + emails. |

---

## 7. Quick test

- Sign up in the app → a row appears in Authentication → Users and in the `profiles` table.
- Try "Continue with Google".
- Confirm each table shows **RLS enabled** in the Table Editor.

> **Tip —** Common pitfalls and fixes are listed in `supabase/SETUP_CHECKLIST.md`.
