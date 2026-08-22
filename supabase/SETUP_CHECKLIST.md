# Supabase + Stripe Setup Checklist

## 1. Supabase Database

### Run SQL files in this order (Supabase Dashboard → SQL Editor)

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. **Every file in `supabase/migrations/` in numeric order**, `001_fixes.sql` through
   `014_role_management.sql`. Run each one.
   > Already-migrated database (ran 001–013 before)? Only run
   > `014_role_management.sql`, then `NOTIFY pgrst, 'reload schema';`
4. `supabase/seeds/002_mock_products.sql` ← optional sample products

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
# Optional: STORE_CURRENCY (default USD), STORE_LOCALE (default en-US),
# STORE_BRAND_COLOR (default #111111).
```
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

---

## 5. Deploy Edge Functions

Install Supabase CLI if not already: `npm install -g supabase`

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy update-tracking
supabase functions deploy handle-order-action
```

> Deploy **all four** functions. `handle-order-action` powers cancellations,
> refunds and delivery; `update-tracking` sends the shipping email.

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
