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
8. Make the first admin

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
   `026_import_keeps_variants.sql`. Run each one.
4. `supabase/seeds/002_mock_products.sql` — optional demo catalog (skip if you'll add your
   own products right away)

> **Important —** Run the migrations in order. They build on each other; skipping one can
> leave the checkout schema incomplete. If your database already ran some of them, run every
> file newer than your last one, then `NOTIFY pgrst, 'reload schema';`. Re-ran `schema.sql`
> or an older migration on a migrated database? Run `019_reconcile_reverted_fixes.sql` again
> afterwards — it puts back the fixes those files revert. (Re-ran `005`, `007`, `013` or
> `021`? Run `021`, `022`, `024` and `026` again too, in that order. Re-ran `003`? Run `024`
> again.)

`014_role_management.sql` installs `set_user_role()`, the supported way to make somebody an
admin (or put them back to customer) — see *Make the first admin* below.

`020_stale_order_expiry_cron.sql` switches on the stale-order cleanup (**required** —
otherwise abandoned checkouts stay `pending` forever): it enables **pg_cron** and schedules
the job to run every 15 minutes. Check it is scheduled:

```sql
SELECT jobname, schedule, active FROM cron.job;
```

> **Note —** If 020 printed a warning that pg_cron could not be enabled, enable it in
> Dashboard → Database → Extensions → **pg_cron**, then run 020 again.

`021_product_sizes.sql` adds stock per size for clothing and anything sold by measurement —
manage it from the admin (see *Products Setup*).

`022` to `026` add the rest of the catalogue and order tools, all managed from the admin:

| Migration | What it adds |
|---|---|
| `022_catalog_variants.sql` | Colours (or materials, finishes…) with swatches and photos per colour, stock per colour × size, a price and a private cost per variant, size guides, product duplication and CSV import/export. |
| `023_inventory_and_alerts.sql` | The stock history (every sale, refund, restock…), low-stock emails to the admins and "email me when it is back" for customers — switch these on in step 6. |
| `024_order_operations.sql` | Order timeline and internal notes, partial refunds line by line, exchanges to another size or colour, packing slips and invoices. |
| `025_discount_codes.sql` | Discount codes: percentage, fixed amount or free shipping, with limits and dates. |
| `026_import_keeps_variants.sql` | A CSV import without size/colour columns leaves the variants untouched. |

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
# Store emails (low stock, back in stock) — see step 6
STORE_WORKER_SECRET=<32+ random characters>
SITE_URL=https://yourstore.com          # optional; links in those emails
```

> **Note —** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
> Supabase — you do not add them yourself.

---

## 6. Deploy the Edge Functions

Install the Supabase CLI, log in, link your project, and deploy the **five** functions:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy update-tracking
supabase functions deploy handle-order-action
supabase functions deploy store-worker
```

| Function | What it does |
|---|---|
| `create-checkout-session` | Starts a Stripe payment for the cart (with its discount code, if any). |
| `stripe-webhook` | Confirms payment, updates the order status and records refunds made in Stripe. |
| `update-tracking` | Saves tracking info & emails the customer. |
| `handle-order-action` | Order actions (cancel, refund all or part, check a payment with Stripe, mark delivered) + emails. |
| `store-worker` | Sends the low-stock digest and the back-in-stock emails, on a schedule. |

> **Important —** Run the migrations (step 2) before deploying: the functions read and write
> the columns they add.

### Switch on the store emails

Migration 023 schedules the low-stock digest (hourly) and the back-in-stock emails (every 10
minutes); they call `store-worker` with a shared secret, kept in two places:

1. Pick a long random value (32+ characters, e.g. `openssl rand -hex 32`) and add it as the
   `STORE_WORKER_SECRET` secret (step 5).
2. In **SQL Editor**, store the same value and the function's address in Vault:

   ```sql
   SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/store-worker', 'store_worker_url');
   SELECT vault.create_secret('<the same random value>', 'store_worker_secret');
   ```

3. Test it: Admin → Inventory → Alerts → **Check and send now**.

Recipients (default: every admin) and the customer "email me when it is back" option are set
on that same page. `supabase/SETUP_CHECKLIST.md` has the queries to check the schedule.

---

## 7. Quick test

- Sign up in the app → a row appears in Authentication → Users and in the `profiles` table.
- Try "Continue with Google".
- Confirm each table shows **RLS enabled** in the Table Editor.

> **Tip —** Common pitfalls and fixes are listed in `supabase/SETUP_CHECKLIST.md`.

---

## 8. Make the first admin

Sign up with the account you want to run the store from, then in **SQL Editor** run:

```sql
select public.set_user_role('you@your-domain.com', 'admin');
```

It returns the id, email and new role of the account it changed. To put somebody back to
customer, use `'customer'` — the function refuses to demote the *last* admin, so you cannot
lock yourself out.

Sign out and back in (or reload the page): **Admin** now appears in the site header, in the
mobile menu, and on your profile page, and it opens the dashboard at `/admin`.

> **Why not edit the column by hand?** Through the app and the API the `role` column is not
> writable at all — that is what stops a customer from promoting themselves. Editing the
> cell in the Table Editor or a plain `update` in the SQL Editor still works (both run as
> the database owner), but they skip the last-admin check and say nothing when the account
> simply has no profile row yet. `set_user_role()` (installed by
> `014_role_management.sql`) is the supported path.

**If it says `No profile found for ...`** the account has not signed up yet, or its profile
row is missing. Check with:

```sql
select u.id, u.email, p.role
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by u.created_at desc;
```

A `role` of `NULL` means the profile row is missing — re-run `014_role_management.sql`,
which backfills them, then try again.
