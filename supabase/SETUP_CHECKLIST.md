# Supabase + Stripe Setup Checklist

## 1. Supabase Database

### Run SQL files in this order (Supabase Dashboard → SQL Editor)

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. **Every file in `supabase/migrations/` in numeric order**, `001_fixes.sql` through
   `012_us_shipping_cleanup.sql`. Run each one. Note there are two `004_*` files
   (`004_cart_rls_nullguard.sql` and `004_variants_reviews_shipping.sql`) — run both.
   The latest, `012_us_shipping_cleanup.sql`, removes the non-US "Poste" shipping method.
4. `supabase/seeds/002_mock_products.sql` ← optional sample products

### Verify tables exist
Go to **Table Editor** and confirm these tables are present:
- profiles, categories, products, product_images
- addresses, orders, order_items
- carts, cart_items
- processed_stripe_events

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
# Restrict which website origins may call the functions from a browser
# (comma-separated). STRONGLY recommended in production.
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
# Optional
# Auto-allow any *.vercel.app origin (handy while the Vercel preview domain
# changes between deploys). Set to "false" once on your final custom domain.
ALLOW_VERCEL_PREVIEWS=true
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
If `ALLOWED_ORIGINS` is left unset, CORS falls back to `*` (fine for local dev,
not recommended in production). When set, only those origins (plus `*.vercel.app`
unless `ALLOW_VERCEL_PREVIEWS=false`) are accepted; a non-matching origin gets no
`Access-Control-Allow-Origin` header and the browser reports "Failed to fetch".

> **If your site domain changes** (e.g. a new Vercel URL), you must update
> `ALLOWED_ORIGINS` here **and** the Supabase Auth URL Configuration below, then
> redeploy the three browser-facing functions.

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
5. After payment: redirected to /checkout/success
6. Check orders table: status should be `paid`
7. Check stock_quantity decreased for ordered products

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
