# Supabase + Stripe Setup Checklist

## 1. Supabase Database

### Run SQL files in this order (Supabase Dashboard → SQL Editor)

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. **Every file in `supabase/migrations/` in numeric order**, `001_fixes.sql` through
   `017_international_shipping.sql`. Run each one — do not stop early.
   > Already-migrated database? Run whatever is newer than your last one, then
   > `NOTIFY pgrst, 'reload schema';`
   >
   > **015 and 016 are security migrations, not optional polish.** 015 turns
   > `set_user_role()` from authorise-by-elimination into an allowlist. 016 adds the
   > anti-abuse limits, narrows the customer cancel window, and stops publishing
   > `products.cost_price` to every visitor. A database left at 014 has all three gaps.
   >
   > **017 changes what you charge for shipping.** It scopes the three stock methods
   > to the US and adds international ones at placeholder prices. Before this, one
   > flat rate applied to every destination — Standard shipped to Australia for the
   > same 0.00 it charged in-state. Read the `NOTICE` it prints and set your real
   > rates; see "Configure your shipping zones" below.
4. `supabase/seeds/002_mock_products.sql` ← optional sample products

### Verify the security migrations actually landed

```sql
-- 015: must print the allowlist form (looks for "is_direct_session").
select case
         when pg_get_functiondef(p.oid) like '%is_direct_session%' then 'OK — 015 applied'
         else 'STALE — re-run 015_set_user_role_deny_by_default.sql'
       end as set_user_role_status
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'set_user_role';

-- 016: the four abuse limits and the cost_price lockdown.
select conname from pg_constraint
 where conname in ('addresses_field_length_check',
                   'product_reviews_body_length_check',
                   'profiles_full_name_length_check',
                   'orders_shipping_address_size_check');

select has_column_privilege('anon', 'public.products', 'cost_price', 'SELECT')
       as anon_can_read_cost_price;  -- must be false
```

If `016` reported a `WARNING` about a constraint it could not validate, some pre-existing
row is longer than the new cap. The cap is already enforced for new and updated rows; find
and shorten the offending rows, then run the `VALIDATE CONSTRAINT` statement the warning
printed.

### Assign the admin role

`014_role_management.sql` installs `set_user_role()`. After signing up in the app:

```sql
select public.set_user_role('you@your-domain.com', 'admin');  -- or 'customer'
```

The `role` column is not writable through the app or the API (that is what stops customers
from promoting themselves), so role changes belong here. Unlike a hand-edit in the Table
Editor, the function refuses to demote the last admin and tells you when the account has no
profile row yet.

Check who is what:

```sql
select u.email, coalesce(p.role::text, 'MISSING PROFILE') as role
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by u.created_at desc;
```

### Schedule the stale-order cron (REQUIRED)

Orders abandoned before payment must be auto-cancelled or they pile up as
`pending`/`processing` forever. Dashboard → Database → Extensions → enable
**pg_cron**, then run in the SQL Editor:

```sql
SELECT cron.schedule('expire-pending-orders', '*/15 * * * *',
  $$SELECT public.expire_stale_pending_orders()$$);
```

(Checkout sessions expire after 1 hour; the cron cancels their orders after 2,
so it can never cancel an order whose Stripe session is still payable.)

### Verify tables exist
Go to **Table Editor** and confirm these tables are present:
- profiles, categories, products, product_images, product_variants
- addresses, orders, order_items, shipping_methods, product_reviews
- processed_stripe_events

(There is **no** carts/cart_items table — the storefront cart lives in
localStorage; migration 013 drops the legacy tables.)

### Verify RLS is ON
Dashboard → Table Editor → each table → RLS badge must show "Enabled".

### Verify profile trigger
Dashboard → Database → Functions → look for `handle_new_user`.
Test: create a user via Auth → Profiles table should auto-populate.

### Verify auth.users integration
Dashboard → Authentication → Users. After signing up via the app, the user
should appear here AND a row should appear in `public.profiles`.

---

## 2. Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials → OAuth 2.0 Client ID
3. Authorised redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret
5. Supabase Dashboard → Authentication → Providers → Google
6. Paste Client ID + Secret → Save
7. Verify: try "Continue with Google" in the app

### Auth URL Configuration (controls post-login redirects)

Supabase Dashboard → **Authentication** → **URL Configuration**:
- **Site URL**: your live site origin, e.g. `https://your-domain.com`.
- **Redirect URLs**: add `https://your-domain.com/**` (and any extra domains/preview URLs).

> If this points at an old/stale domain, users get redirected there after sign-in,
> Google login, or email confirmation. Update it whenever the site domain changes.

---

## 3. Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### Edge Functions (Supabase Dashboard → Settings → Edge Functions → Secrets)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_ANON_KEY=eyJ...
RESEND_API_KEY=re_...
# REQUIRED. Which website origins may call the functions from a browser
# (comma-separated). Checkout redirect URLs are also built from the caller's
# origin, so an unset value means checkout returns 403.
# Local dev: ALLOWED_ORIGINS=http://localhost:5173
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
# Optional. Auto-allow any *.vercel.app origin (handy while the Vercel preview
# domain changes between deploys). Defaults to false — keep it false in
# production; set "true" only while testing on preview URLs.
ALLOW_VERCEL_PREVIEWS=false
# Sales tax. Flat fraction (e.g. 0.07) used when Stripe Tax is OFF; default 0.
# Set STRIPE_TAX_ENABLED=true to use Stripe Tax (real per-state US sales tax;
# requires Stripe Tax configured in the Stripe dashboard).
TAX_RATE=0
STRIPE_TAX_ENABLED=false
# Transactional email branding (shipping/refund/delivery emails). Defaults are
# demo-safe; override to rebrand. RESEND_FROM_EMAIL sets the "from" header.
RESEND_FROM_EMAIL=Your Store <support@your-domain.com>
STORE_NAME=Your Store
SUPPORT_EMAIL=support@your-domain.com
# Optional: STORE_LOCALE (default en-US), STORE_BRAND_COLOR (default #111111).
```

> **The currency is NOT a secret here.** It used to be, and that was the bug: an
> operator who set `STORE_CURRENCY=EUR` got euro signs in the confirmation email
> while Stripe still charged the card in dollars, because the checkout function
> and the storefront had their own hard-coded copies. It now lives in
> `supabase/functions/_shared/money.ts`, a single file both the Edge Functions
> and the storefront import — see "Set your currency" under Stripe Setup below.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
CORS **fails closed**: if `ALLOWED_ORIGINS` is unset, every browser origin is
rejected (the functions log a warning). When set, only those origins (plus
`*.vercel.app` when `ALLOW_VERCEL_PREVIEWS=true`) are accepted; a non-matching
origin gets no `Access-Control-Allow-Origin` header and the browser reports
"Failed to fetch".

> **If your site domain changes** (e.g. a new Vercel URL), you must update
> `ALLOWED_ORIGINS` here **and** the Supabase Auth URL Configuration below, then
> redeploy the three browser-facing functions.

### Key rotation

If your repo (or a copy of it) ever contained real Supabase credentials or the
project ref was exposed, rotate keys: Dashboard → Settings → API → **Reset**
the service-role key (and anon key if leaked). Then update the Vercel env vars
and re-deploy the Edge Functions. Never commit `.env` or ship it in a template
ZIP — the service-role key bypasses RLS entirely.

---

## 4. Stripe Setup

1. Create account at [stripe.com](https://stripe.com)
2. Dashboard → Developers → API keys
   - Copy **Publishable key** (for future Stripe Elements if needed)
   - Copy **Secret key** → add as `STRIPE_SECRET_KEY` in Supabase secrets
   - Add `SUPABASE_ANON_KEY` in Supabase Edge Function secrets (required by `create-checkout-session` auth validation)
3. Deploy Edge Functions (step 5 first)
4. Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
       - `charge.refunded`
       - `refund.updated`
5. Copy **Signing secret** → add as `STRIPE_WEBHOOK_SECRET` in Supabase secrets

### Set your currency

Edit `STORE_CURRENCY` in **`supabase/functions/_shared/money.ts`** (default `'USD'`).
That one constant is imported by the checkout function, the storefront and the
emails, so there is no second place to keep in sync. It must be a currency
enabled on your Stripe account. Redeploy the Edge Functions and rebuild the
frontend after changing it.

### Enable the payment methods you want

Dashboard → Settings → **Payment methods**. Checkout now uses whatever is enabled
there, filtered by amount, currency and buyer country — the code no longer pins
the session to cards.

> **The local European methods are currency-bound.** iDEAL and Bancontact are
> EUR-only, so with `STORE_CURRENCY = 'USD'` a Dutch shopper still sees only
> cards no matter what you tick in the Dashboard. Selling into the eurozone means
> setting the currency to `'EUR'` as well.

### Configure your shipping zones

`shipping_methods.countries` is an array of ISO country codes, UPPERCASE.
`NULL` means "offered everywhere". Migration 017 leaves you with US-only stock
methods plus two international ones at **placeholder prices** — change them:

```sql
-- What am I currently offering, and where?
SELECT name, price, countries FROM public.shipping_methods WHERE is_active ORDER BY sort_order;

-- Example: charge 19.99 to the EU, 24.99 to the rest of the world
UPDATE public.shipping_methods SET price = 19.99, countries = ARRAY['DE','FR','IT','ES']
 WHERE id = 'c1000000-0000-0000-0000-000000000005';
```

Two rules worth knowing:

- Every country in `SHIPPING_COUNTRIES` (`supabase/functions/_shared/address.ts`)
  needs at least one method covering it, or checkout to that country is blocked
  with "we do not ship there yet". Those two lists are what you are promising.
- If you do **not** ship from the US, re-scope the three stock methods — 017 set
  them to `ARRAY['US']` on the assumption of a US seller.

---

## 5. Deploy Edge Functions

Install Supabase CLI if not already: `npm install -g supabase`

```bash
supabase login
supabase link --project-ref <your-project-ref>   # also writes project_id into supabase/config.toml
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy update-tracking
supabase functions deploy handle-order-action
```

> Deploy **all four** functions. `handle-order-action` powers cancellations,
> refunds and delivery; `update-tracking` sends the shipping email.

### JWT verification is set in `supabase/config.toml` — leave it alone

`supabase/config.toml` declares `verify_jwt` per function, and it is the **only** file the
CLI reads that from. `stripe-webhook` must stay `verify_jwt = false`: Stripe authenticates
its POST with a signature, not a JWT, so with verification on the platform gateway rejects
it with **401 before the function runs**. Paid orders then never reach `paid` — no stock
deduction, no confirmation email — and the expire-pending-orders cron cancels them two
hours later with the customer's card already charged.

Verify after deploying (no auth header on purpose):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

- **400** → correct. The function ran and refused a request with no `stripe-signature`.
- **401** → the gateway blocked it. Dashboard → Edge Functions → `stripe-webhook` → turn
  **Verify JWT** off, or redeploy with `--no-verify-jwt`.

Test locally first:
```bash
supabase start
supabase functions serve create-checkout-session --env-file .env.local
```

---

## 6. Test the Full Flow

Before running checkout E2E, confirm production schema includes required checkout columns:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
   and table_name = 'orders'
   and column_name in ('stripe_session_id', 'shipping_method_id', 'shipping_method_name')
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'public'
   and table_name = 'order_items'
   and column_name in ('selected_size')
order by column_name;
```

If any column is missing, apply at least:

- `supabase/migrations/001_fixes.sql`
- `supabase/migrations/004_variants_reviews_shipping.sql`

1. Sign up → check profiles table has a row
2. Add products to cart → verify cart persists on refresh
3. Go to /checkout → click Pay → should redirect to Stripe
4. Use test card `4242 4242 4242 4242` exp `12/34` CVC `123`
5. After payment: redirected to /checkout/success + order confirmation email
6. Check orders table: status should be `paid`
7. Check stock_quantity decreased for ordered products (and `stock_qty` on the
   matching product_variants row when a size was selected)

### Backorder policy (`needs_review`)

Paid orders are **always honored** — the stock trigger never rejects a payment.
If two buyers race for the last unit, both orders become `paid`, stock goes
negative (the negative number = units to re-order), and the later order is
flagged `needs_review = true` with `review_reason = 'oversold'`. Flagged orders
show a red **Needs review** badge in Admin → Orders (with a dedicated filter)
and a counter on the admin dashboard. Review them, restock or contact the
customer, then clear the flag:

```sql
UPDATE public.orders SET needs_review = false, review_reason = null WHERE id = '<order-id>';
```

---

## 7. Common Pitfalls

| Problem | Fix |
|---|---|
| "Missing Supabase env vars" | Restart `npm run dev` after editing `.env` |
| Google OAuth redirect fails | Redirect URI must exactly match — include `/auth/v1/callback` not just `/callback` |
| Stripe webhook 400 signature error | `STRIPE_WEBHOOK_SECRET` must be the signing secret from Stripe, not the API key |
| Orders stay `pending` after payment | Webhook not deployed or wrong event selected |
| RLS blocks service role | Service role key bypasses RLS — use it only in Edge Functions, never in frontend |
| Edge Function 401 | Pass `Authorization: Bearer <jwt>` header from `supabase.auth.getSession()` |
