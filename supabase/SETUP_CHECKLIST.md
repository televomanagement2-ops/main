# Supabase + Stripe Setup Checklist

## 1. Supabase Database

### Run SQL files in this order (Supabase Dashboard → SQL Editor)

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/migrations/001_fixes.sql`
4. `supabase/migrations/002_rls_hardening.sql`
5. `supabase/migrations/003_payment_hardening.sql`
6. `supabase/seeds/002_mock_products.sql` ← 200 products

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
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

---

## 4. Stripe Setup

1. Create account at [stripe.com](https://stripe.com)
2. Dashboard → Developers → API keys
   - Copy **Publishable key** (for future Stripe Elements if needed)
   - Copy **Secret key** → add as `STRIPE_SECRET_KEY` in Supabase secrets
3. Deploy Edge Functions (step 5 first)
4. Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
5. Copy **Signing secret** → add as `STRIPE_WEBHOOK_SECRET` in Supabase secrets

---

## 5. Deploy Edge Functions

Install Supabase CLI if not already: `npm install -g supabase`

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

Test locally first:
```bash
supabase start
supabase functions serve create-checkout-session --env-file .env.local
```

---

## 6. Test the Full Flow

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
