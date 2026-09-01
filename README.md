# CommerceJet

CommerceJet is a full-stack e-commerce storefront built with React, Supabase, and Stripe. It includes catalog browsing, guest and authenticated carts, checkout via Stripe Checkout, webhook-driven order updates, and database-backed order history.

## What is included

- Public catalog with featured products, categories, filters, and product detail pages.
- Auth flow with email/password and Google OAuth through Supabase Auth.
- Guest cart stored in localStorage and merged into the authenticated database cart on sign-in.
- Stripe Checkout created server-side through a Supabase Edge Function.
- Webhook confirmation that updates order status in the database.
- Orders page that reflects the real order lifecycle.
- RLS-protected Supabase schema, with stock handling and order immutability after payment.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router v7 |
| State | Zustand, TanStack React Query v5 |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| Payments | Stripe Checkout + Stripe Webhooks |
| Deploy | Vercel for the frontend, Supabase for backend services |

## Repository Structure

```
src/
  components/layout/   # Header, Footer, Sidebar, Topbar, RootLayout
  features/            # auth, cart, checkout, orders, products
  hooks/               # useAuth, useProducts, useOrders, useCategories
  lib/                 # api.ts, cartMerge.ts, database.types.ts, supabaseClient.ts
  routes/              # Router config and ProtectedRoute
  store/               # authStore, cartStore
  styles/              # global styles
  types/               # shared application types
supabase/
  schema.sql           # base database schema
  rls.sql              # row level security policies
  migrations/          # hardening and payment fixes
  seeds/               # mock data for initial population
  functions/           # create-checkout-session, stripe-webhook
```

## Local Setup

1. Install dependencies.
2. Copy `.env.example` to `.env` in the project root.
3. Fill in your values:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
# Display-only estimated tax rate (fraction, e.g. 0.07). Default 0. Keep in sync
# with the backend TAX_RATE. Leave 0 when using Stripe Tax.
VITE_TAX_RATE=0
```

4. Start the app.

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Database Setup

Run the SQL files in Supabase Dashboard → SQL Editor in this order:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. Every file in `supabase/migrations/` in numeric order (`001_fixes.sql` through `012_us_shipping_cleanup.sql`).
4. `supabase/seeds/002_mock_products.sql`

That gives you the base schema, the RLS policies, the payment hardening layer, the US shipping methods, and the initial mock catalog.

Full operational checklist: [supabase/SETUP_CHECKLIST.md](supabase/SETUP_CHECKLIST.md)

## Backend Secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_ANON_KEY=eyJ...
# CORS — comma-separated production origins (set before going live)
ALLOWED_ORIGINS=https://yourstore.com,https://www.yourstore.com
ALLOW_VERCEL_PREVIEWS=false
# Tax — see "Sales tax (US)" below
TAX_RATE=0
STRIPE_TAX_ENABLED=false
# Email (optional)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Your Store <support@yourstore.com>
```

The Supabase runtime injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically for Edge Functions.

`create-checkout-session` requires all of these at runtime:

- `STRIPE_SECRET_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_URL` (runtime injected)
- `SUPABASE_SERVICE_ROLE_KEY` (runtime injected)

`update-tracking` requires:

- `RESEND_API_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_URL` (runtime injected)
- `SUPABASE_SERVICE_ROLE_KEY` (runtime injected)

`handle-order-action` requires:

- `STRIPE_SECRET_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_URL` (runtime injected)
- `SUPABASE_SERVICE_ROLE_KEY` (runtime injected)

## Deploy Backend Functions

Deploy the Edge Functions after linking the project:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase functions deploy create-checkout-session
npx supabase functions deploy stripe-webhook
npx supabase functions deploy update-tracking
npx supabase functions deploy handle-order-action
```

If you run the functions locally, use the Supabase CLI and an env file that contains the edge-function secrets.

## Pre-Deploy Checkout Schema Checklist

Before testing checkout in production, verify that required migrations were applied:

- `supabase/migrations/001_fixes.sql` (adds `orders.stripe_session_id`)
- `supabase/migrations/004_variants_reviews_shipping.sql` (adds `order_items.selected_size`, `orders.shipping_method_id`, `orders.shipping_method_name`)

Recommended verification queries:

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

## Stripe Webhook Configuration

In Stripe Dashboard → Developers → Webhooks, add:

```bash
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

Listen for these events:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `refund.updated`

## Sales tax (US)

US sales tax varies by state, so the template supports two modes via Edge Function secrets:

- **Flat estimate (default).** `STRIPE_TAX_ENABLED=false` and `TAX_RATE` is a fraction
  (e.g. `0.07` = 7%, default `0`). The amount is charged as an explicit "Estimated sales
  tax" line item so the Stripe charge always equals the recorded order total. Set the
  frontend `VITE_TAX_RATE` to the same value so the cart/checkout estimate matches.
- **Stripe Tax (recommended for real US compliance).** Set `STRIPE_TAX_ENABLED=true`,
  keep `TAX_RATE=0` and `VITE_TAX_RATE=0`. The checkout function enables `automatic_tax`
  and passes the customer address; Stripe computes the correct per-jurisdiction tax, and
  the webhook writes the authoritative `tax_amount`/`total` back to the order. You must
  first enable Stripe Tax in the Stripe dashboard (register your origin address and set
  product tax codes), otherwise checkout will error.

## Transactional emails

Shipping, refund, and delivery emails are sent from the Edge Functions (via Resend) and are
**English by default, in USD/en-US**. Because Edge Functions can't read
[`storeConfig.ts`](src/config/storeConfig.ts) (it's frontend-only), their branding is set with
Edge Function secrets, all with demo-safe defaults:
`STORE_NAME`, `SUPPORT_EMAIL`, `RESEND_FROM_EMAIL`, `STORE_LOCALE`,
`STORE_BRAND_COLOR`. The shared template lives in
[`supabase/functions/_shared/store.ts`](supabase/functions/_shared/store.ts). Sign-up /
password-reset emails are sent by Supabase Auth and are customized in the Supabase dashboard.

The **currency** is not among those secrets: it must agree with what Stripe charges and what
the storefront displays, so it is a single constant in
[`supabase/functions/_shared/money.ts`](supabase/functions/_shared/money.ts) that the checkout
function, the storefront and the emails all import.

## Build and Quality Checks

```bash
npm run build
npm run lint
npm test
```

`npm run build` runs the TypeScript check and the Vite production build. `npm test` runs
the Vitest unit tests (pricing math).

## Testing checkout end-to-end (Stripe test mode)

Run a full payment in **test mode** before going live:

1. Use test keys (`sk_test_…`) and a test webhook signing secret.
2. Forward webhooks to your function while testing, e.g.
   `stripe listen --forward-to https://<project-ref>.supabase.co/functions/v1/stripe-webhook`.
3. Check out with Stripe test card `4242 4242 4242 4242`, any future expiry/CVC.
4. Confirm: the order moves to `paid`, the amount charged in Stripe equals the order
   `total` shown in the app (with Stripe Tax on, tax appears and `tax_amount` is written),
   stock is decremented, and the order shows in Orders.
5. Test a refund from the admin/order action flow and confirm the order becomes `refunded`.

## Deployment Notes

The frontend is expected to be deployed on Vercel.

Before deployment, verify:

- The frontend environment variables are set in Vercel.
- The Supabase project is linked and the Edge Functions are deployed.
- Stripe webhook delivery is working.
- The database schema and seeded data are aligned with the current code.

## Product and Order Flow

```text
pending -> processing -> paid -> shipped -> delivered
                     \-> requires_action
pending / processing / requires_action -> cancelled
failed is terminal
```

Behavioral rules:

- Stock is deducted only when an order reaches `paid`.
- Cancelling a paid order restores stock.
- The checkout page keeps the cart intact until payment confirmation is received.
- The success page waits for the webhook-backed order row before clearing the cart.

## Maintenance Guide

### Change the site name, contact details, or logo

The brand name and customer-facing contact details are centralized in
[src/config/storeConfig.ts](src/config/storeConfig.ts):

- `storeName` — the wordmark shown in the nav, sidebar, footer, login, and email subjects.
- `contactEmail`, `supportPhone`, `privacyEmail` — used by the footer, Help page, and the
  legal pages (the defaults are `example.com` / `555` placeholders — replace them).
- `countryCode`, `countryName` — shown in the footer.
- The remaining `[PLACEHOLDER]` legal/identity fields are injected into the Terms, Privacy,
  and Cookie pages; fill them before launch.

Change them once in `storeConfig.ts` — no need to edit individual components.

The browser tab logo is [public/favicon.svg](public/favicon.svg). The page `<title>` is in
[index.html](index.html).

### Change categories

Categories are defined in the database seed layer, not just in the UI.

Update these files when changing the catalog structure:

- `supabase/schema.sql`
- `supabase/migrations/001_fixes.sql`
- `supabase/seeds/002_mock_products.sql`

If you add, rename, or remove categories, make sure the `category_id` references remain valid for every product row.

The home page also uses a small icon map for category slugs in [src/features/products/pages/HomePage.tsx](src/features/products/pages/HomePage.tsx). Add or adjust icons there if you change slug names.

### Remove the mock products

The mock catalog currently lives in [supabase/seeds/002_mock_products.sql](supabase/seeds/002_mock_products.sql).

To replace mock data with real products:

1. Back up the current database.
2. Delete or truncate mock `product_images` and `products` rows in Supabase.
3. Insert the real categories first.
4. Insert the real products with valid `category_id` values.
5. Insert product images after the products exist.
6. Re-check stock, featured flags, and primary image flags.

Recommended order for a clean replacement:

```sql
DELETE FROM public.product_images;
DELETE FROM public.products;
```

Then reinsert the real catalog with SQL or with the Supabase table editor.

If you replace categories too, do that before reimporting products.

### Insert real products into the database

Use this order:

1. Categories
2. Products
3. Product images

Keep the following fields consistent with the schema:

- `slug` must be unique.
- `sku` must be unique if present.
- `price`, `stock_quantity`, and `low_stock_threshold` must be valid numbers.
- `is_primary` should be true for one image per product.
- `product_id` in `product_images` must point to an existing product.

After importing the real catalog, update any featured product rows and verify the home page content.

### Regenerate Supabase types after schema changes

If you change the schema, regenerate [src/lib/database.types.ts](src/lib/database.types.ts) so the TypeScript typing stays accurate.

The frontend depends on those generated types for the Supabase queries in [src/lib/api.ts](src/lib/api.ts).

## Useful Operational Checks

When the site is updated, confirm these flows manually:

1. Sign up and sign in.
2. Add products to the cart.
3. Complete a Stripe Checkout session.
4. Confirm the webhook updates the order status.
5. Verify the success page clears the cart only after order confirmation.
6. Check that the order appears in the Orders page.
7. Confirm stock is reduced after the `paid` transition.

## Distributing this as a template

- **Never include a real `.env` in the ZIP/package you sell.** It is gitignored, but a
  folder ZIP will include it. Ship `.env.example` only, and rotate any keys that were ever
  committed or shared.
- The frontend bundle only ever contains the public anon key; all secret keys live in Edge
  Function secrets, never in the repo.
- Fill `src/config/storeConfig.ts` and the legal pages with the licensee's real details.

## Notes

- This project uses Supabase for the real data model, so database changes should always be reflected in the SQL files, the generated types, and the README.
- If you change auth, orders, or payment logic, re-test the complete flow end to end before deployment.
