# CommerceJet — Complete Project Documentation

> **What this file is.** A single, self-contained technical reference for the whole project:
> the services it runs on, the domains and URLs involved, how CORS / CSP / auth / payments are
> wired, the database in its final migrated state, every Edge Function, and a map of the source
> code. Read this first if you have never seen the repository; the other documents (listed in
> [§2](#2-map-of-the-existing-documentation)) are task-specific and assume you already know the
> shape of the system.
>
> _Last regenerated: 2026-10-23. Reflects migrations `001` → `026` and the five deployed Edge
> Functions._

---

## Table of contents

1. [What CommerceJet is](#1-what-commercejet-is)
2. [Map of the existing documentation](#2-map-of-the-existing-documentation)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [External services and accounts](#4-external-services-and-accounts)
5. [Domains, URLs and endpoints](#5-domains-urls-and-endpoints)
6. [CORS, CSP and security headers](#6-cors-csp-and-security-headers)
7. [Environment variables and secrets](#7-environment-variables-and-secrets)
8. [Repository layout](#8-repository-layout)
9. [Frontend architecture](#9-frontend-architecture)
10. [Design system and theming](#10-design-system-and-theming)
11. [Internationalisation](#11-internationalisation)
12. [Database](#12-database)
13. [Row Level Security and grants](#13-row-level-security-and-grants)
14. [Migration history](#14-migration-history)
15. [Edge Functions](#15-edge-functions)
16. [Payments: end-to-end flow](#16-payments-end-to-end-flow)
17. [Order lifecycle and stock](#17-order-lifecycle-and-stock)
18. [Transactional email](#18-transactional-email)
19. [Admin console](#19-admin-console)
20. [Local development, testing and CI](#20-local-development-testing-and-ci)
21. [Deployment](#21-deployment)
22. [Operations runbook](#22-operations-runbook)
23. [Security model summary](#23-security-model-summary)
24. [Known gaps and open items](#24-known-gaps-and-open-items)
25. [Appendix A — file-by-file index](#appendix-a--file-by-file-index)
26. [Appendix B — limits and constants](#appendix-b--limits-and-constants)
27. [Appendix C — API error codes](#appendix-c--api-error-codes)

---

## 1. What CommerceJet is

CommerceJet is a **full-stack e-commerce storefront** delivered as a licensable source-code
template. One codebase runs both the customer-facing store and the operator's admin console.

**Product surface**

- Public catalogue: home page with featured products, category browsing, filters, search
  overlay (⌘K / Ctrl-K), product detail pages with size and colour variants (photos per
  colour, a price per variant, size guides), "email me when it is back" for sold-out choices,
  and verified-purchase reviews.
- Accounts: email/password plus Google OAuth, password reset, profile, saved addresses.
- Cart: `localStorage` only (there is **no** database cart), one line per variant,
  reconciled against the live catalogue on load.
- Checkout: Stripe Checkout, created server-side, with discount codes; success/cancel pages
  driven by the real order row.
- Orders: customer order history, order detail (with discounts and partial refunds),
  self-service cancel/refund before shipment.
- Admin: dashboard, order queue (timeline, notes, partial refunds, exchanges, payment checks,
  packing slips and invoices, CSV export), catalogue editor (variants, compare-at price and
  cost, duplicate, CSV import/export), inventory (stock history, low stock, restock requests,
  alerts), discount codes, size guides, finance.
- Legal: Terms, Privacy, Cookie Policy rendered from a single config file, plus a self-hosted
  granular cookie-consent banner.
- Four UI languages: English (default), Italian, Spanish, French.

**Delivery model.** The repository ships to a store operator (licensee) who runs it on **their
own** Supabase, Stripe, Resend and Vercel accounts. The demo brand in the code is **AURUM**;
brand, contact and legal identity are centralised in
[`src/config/storeConfig.ts`](src/config/storeConfig.ts) so the operator edits one file. See
[`EULA.md`](EULA.md) for the licence template and [`HANDOVER_GUIDE.md`](HANDOVER_GUIDE.md) for
the operator's own onboarding path.

**Market defaults.** US-first: USD currency, `en-US` locale, US sales-tax handling, US-style
shipping methods. The store ships to eight countries (see [§12.9](#129-shipping-countries)).

---

## 2. Map of the existing documentation

| Document | Audience | What it covers | When to read it |
|---|---|---|---|
| **This file** | Developer / maintainer | Everything: services, domains, CORS, DB, functions, code map | First |
| [`README.md`](README.md) | Developer | Install, DB setup order, secrets, function deploy, tax modes, maintenance recipes | Setting up a dev machine |
| [`HANDOVER_GUIDE.md`](HANDOVER_GUIDE.md) | Store operator | 6-step launch path: legal details → infra → CORS → first admin → compliance → go-live | Handing the store to a licensee |
| [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) | Developer / auditor | 13 findings (fixed + verified), each with code location and test coverage; pre-production checklist | Before any release; after touching payments/RLS |
| [`ROADMAP.md`](ROADMAP.md) | Developer | Production-hardening plan and owner decisions (oversell policy, self-refund, no DB cart). **Truncated mid–Phase 1a** | Historical context for migration 013 |
| [`EULA.md`](EULA.md) | Licensor | Software licence template (placeholders to fill) | Selling a licence |
| [`supabase/SETUP_CHECKLIST.md`](supabase/SETUP_CHECKLIST.md) | Operator / developer | Backend checklist, verification SQL, pg_cron job, backorder policy, common pitfalls | Provisioning a Supabase project |
| [`tools/README.md`](tools/README.md) | Developer | Supabase CLI install and common commands | First CLI use |
| [`docs/00_start_here.md`](docs/00_start_here.md) | Buyer | Roadmap, required accounts, 60-second stack overview | Buyer onboarding |
| [`docs/01_brand_customization.md`](docs/01_brand_customization.md) | Buyer | Name, logo, colours, email branding, languages |  |
| [`docs/02_products_setup.md`](docs/02_products_setup.md) | Buyer | Data model, removing demo catalogue, three ways to add products, sizes and colours, size guides, CSV import/export, stock day to day |  |
| [`docs/03_supabase_setup.md`](docs/03_supabase_setup.md) | Buyer | Project creation, SQL order, keys, Google OAuth, secrets, function deploy, first admin |  |
| [`docs/04_github_vercel_deploy.md`](docs/04_github_vercel_deploy.md) | Buyer | Build, push, import into Vercel, env vars, auto-redeploy |  |
| [`docs/05_domain_and_cors.md`](docs/05_domain_and_cors.md) | Buyer | Custom domain, Supabase Auth URLs, Google origins, `ALLOWED_ORIGINS` |  |
| [`docs/06_stripe_setup.md`](docs/06_stripe_setup.md) | Buyer | Keys, webhook + events, sales tax modes, test payment, go-live |  |

The `docs/*.html` files are exported copies of the matching `.md` sources, meant for PDF
distribution to buyers. Edit the Markdown; regenerate the HTML.

**Precedence.** When a buyer guide and this file disagree, the code wins; check the source
location cited here. Buyer guides intentionally simplify (they list what to run and click, not
why); `supabase/SETUP_CHECKLIST.md` carries the verification queries.

---

## 3. Architecture at a glance

```text
                    ┌──────────────────────────────────────────┐
   Browser          │  Vercel (static hosting + CDN + headers) │
   (React SPA) ─────┤  · SPA rewrite  /(.*) → /index.html      │
        │           │  · CSP, HSTS, X-Frame-Options, …         │
        │           └──────────────────────────────────────────┘
        │
        │  (1) anon key + user JWT, PostgREST
        ├──────────────────────────────► Supabase Postgres
        │                                 · RLS on every table
        │                                 · triggers: status guard,
        │                                   stock, immutability,
        │                                   stock log, order timeline
        │                                 · RPC: admin_analytics,
        │                                   has_purchased, set_user_role,
        │                                   admin_save_product_variants,
        │                                   preview_discount_code, …
        │                                 · pg_cron → pg_net ─┐
        │                                                      │ x-worker-secret
        │  (2) Bearer JWT + apikey, POST                       ▼
        ├──────────────────────────────► Supabase Edge Functions (Deno)
        │                                 · create-checkout-session
        │                                 · handle-order-action
        │                                 · update-tracking
        │                                 · store-worker ──► Resend
        │                                        │
        │  (3) Supabase Auth (email + Google)    │ service role
        ├──────────────────────────────► GoTrue  │ (bypasses RLS)
        │                                        ▼
        │                                 Postgres (writes orders)
        │                                        │
        │  (4) redirect to hosted checkout       │ Stripe API
        └──────────────────────────────► Stripe ─┘
                                            │
                          (5) signed webhook│POST
                                            ▼
                                   stripe-webhook (Deno)
                                            │
                                   ┌────────┴─────────┐
                                   ▼                  ▼
                              Postgres            Resend (email)
```

**Trust boundaries**

| Boundary | Enforced by |
|---|---|
| Browser → Postgres | RLS policies + column grants; the anon key is public by design |
| Browser → Edge Function | Origin allowlist (fail-closed) **and** JWT verification **and** per-action role/ownership checks |
| Edge Function → Postgres | Service role (bypasses RLS) — all authorisation is explicit in function code |
| Stripe → Edge Function | Webhook signature (`stripe.webhooks.constructEventAsync`), never a JWT |
| Prices / stock / shipping cost | Always re-read from the database server-side; client input is ignored |

The storefront cart is **not** a trust boundary: anyone can POST hand-written JSON to
`create-checkout-session`, so every cap and validation exists server-side as well.

---

## 4. External services and accounts

Each store instance needs its own set of accounts. All have free tiers adequate for launch.

### 4.1 Supabase — database, auth, storage, serverless backend

The single backend. Four sub-services are used:

| Sub-service | Used for | Where configured |
|---|---|---|
| **Postgres** | All application data: catalogue, orders, profiles, reviews, addresses | `supabase/schema.sql`, `rls.sql`, `migrations/*.sql` |
| **Auth (GoTrue)** | Email/password + Google OAuth, password reset, session refresh | Dashboard → Authentication |
| **Storage** | `product-images` bucket (public read, admin write, 5 MB, raster only) | `migrations/011`, `013` |
| **Edge Functions (Deno)** | Checkout, webhook, order actions, tracking, scheduled store emails | `supabase/functions/*`, `supabase/config.toml` |

Extensions used: `uuid-ossp` (PKs), `pg_trgm` (product-name search index), `pg_cron`
(stale-order expiry and the store's scheduled jobs — enabled by migration `020`), `pg_net`
(lets those jobs call the `store-worker` function — migration `023`) and **Vault** (holds the
function's address and shared secret — set by hand, see [§12.12](#1212-the-scheduled-job-required)).

The frontend talks to Postgres through PostgREST with the **public anon key**; privilege is
enforced by RLS, never by key secrecy. The `service_role` key exists only inside Edge
Functions, where Supabase injects it automatically.

### 4.2 Stripe — payments

Stripe Checkout (hosted payment page) in `mode: 'payment'`, with whatever payment methods are
enabled in the Stripe Dashboard (`payment_method_types` is deliberately not set). Card data
never touches this codebase. Discount codes reach Stripe as a one-off coupon per session
([§15.1](#151-create-checkout-session)). Stripe API version is pinned in every function:
`const STRIPE_API_VERSION = '2025-03-31.basil'`.

Six webhook events are handled — see [§15.2](#152-stripe-webhook). Stripe Tax is optional and
off by default ([§16.4](#164-sales-tax)).

### 4.3 Resend — transactional email

Optional but recommended. Without `RESEND_API_KEY`, every send is skipped with a console
warning and the flow continues (see [`_shared/email.ts`](supabase/functions/_shared/email.ts)).
Sends order confirmation, shipping, refund and delivery emails, the back-in-stock emails and
the admins' low-stock digest. Sign-up and password-reset emails come from **Supabase Auth**,
not from this code.

### 4.4 Vercel — frontend hosting

Static hosting for the Vite build, plus the SPA rewrite and all security response headers
([`vercel.json`](vercel.json)). Auto-deploys on push to `main`. Framework preset: Vite,
build `npm run build`, output `dist`, install `npm install`.

### 4.5 GitHub — source and CI

Repository host; GitHub Actions runs typecheck + lint + tests on every push to `main` and every
pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

### 4.6 Google Cloud — OAuth provider (optional)

Only needed for "Continue with Google". One OAuth 2.0 Web client, with the Supabase callback
as the authorised redirect URI and the live site as an authorised JavaScript origin.

### 4.7 Service dependency map

| If this is down / misconfigured | Effect |
|---|---|
| Supabase Postgres | Whole app fails (catalogue, auth, orders) |
| Supabase Edge Functions | Checkout, cancel, refund, tracking fail; browsing still works |
| `stripe-webhook` unreachable (e.g. `verify_jwt = true`) | Cards are charged but orders never reach `paid`; the cron cancels them after 2 h — **worst failure mode in the system** |
| Stripe | No new payments; existing orders unaffected |
| Resend | Emails silently skipped; orders unaffected |
| `store-worker` Vault secrets missing / `STORE_WORKER_SECRET` mismatch | Back-in-stock and low-stock emails are not sent (requests wait, nothing is lost); everything else unaffected |
| Vercel | Site offline; backend unaffected |

---

## 5. Domains, URLs and endpoints

Nothing in the code hardcodes a domain. Every URL is derived from environment variables or
from the verified request origin.

### 5.1 The URLs involved

| # | URL | Owner | Set where |
|---|---|---|---|
| 1 | `http://localhost:5173` | Vite dev server | fixed default |
| 2 | `https://<project>.vercel.app` | Vercel production/preview | Vercel |
| 3 | `https://yourstore.com` (+ `www`) | Custom domain | Registrar DNS → Vercel → Settings → Domains |
| 4 | `https://<project-ref>.supabase.co` | Supabase API root | `VITE_SUPABASE_URL` |
| 5 | `https://<project-ref>.supabase.co/functions/v1/<name>` | Edge Function endpoints | derived from #4 |
| 6 | `https://<project-ref>.supabase.co/auth/v1/callback` | Google OAuth redirect URI | Google Cloud Console |
| 7 | `https://api.resend.com/emails` | Resend API | fixed |
| 8 | `https://api.stripe.com` | Stripe API (server-side only) | fixed |

### 5.2 Where each URL must be registered

Changing the site domain means updating **four** places. Missing any one produces a
distinctive symptom:

| Place | Value | Symptom if stale |
|---|---|---|
| Vercel → Settings → Domains | the domain itself | site not served |
| Supabase → Edge Functions → Secrets → `ALLOWED_ORIGINS` | comma-separated origins, no trailing slash | checkout returns **403 `ORIGIN_NOT_ALLOWED`**, browser reports "Failed to fetch" |
| Supabase → Authentication → URL Configuration → **Site URL** + **Redirect URLs** (`https://domain/**`) | the domain | after sign-in the user is bounced to the **old** domain |
| Google Cloud → OAuth client → Authorized JavaScript origins | the domain | Google sign-in blocked |

The Google **redirect URI** stays pointed at Supabase (#6) and never changes with the site
domain.

### 5.3 Frontend routes

Defined in [`src/routes/index.tsx`](src/routes/index.tsx) with `createBrowserRouter` (React
Router v7, data mode). Three route trees, three shells.

| Path | Component | Guard | Shell | Loading |
|---|---|---|---|---|
| `/` | `HomePage` | — | `StoreLayout` | eager |
| `/products` | `ProductListPage` | — | `StoreLayout` | eager |
| `/products/:slug` | `ProductDetailPage` | — | `StoreLayout` | eager |
| `/cart` | `CartPage` | `ProtectedRoute` | `StoreLayout` | eager |
| `/checkout` | `CheckoutPage` | `ProtectedRoute` | `StoreLayout` | eager |
| `/checkout/success` | `CheckoutSuccessPage` | `ProtectedRoute` | `StoreLayout` | eager |
| `/checkout/cancel` | `CheckoutCancelPage` | `ProtectedRoute` | `StoreLayout` | eager |
| `/orders` | `OrdersPage` | `ProtectedRoute` | `StoreLayout` | eager |
| `/orders/:orderId` | `OrderDetailPage` | `ProtectedRoute` | `StoreLayout` | eager |
| `/profile` | `ProfilePage` | `ProtectedRoute` | `StoreLayout` | eager |
| `/settings` | `SettingsPage` | `ProtectedRoute` | `StoreLayout` | eager |
| `/help` | `HelpPage` | — | `StoreLayout` | eager |
| `/privacy` | `PrivacyPage` | — | `StoreLayout` | **lazy** |
| `/privacy-policy` | `PrivacyPolicyPage` | — | `StoreLayout` | **lazy** |
| `/terms` | `TermsPage` | — | `StoreLayout` | **lazy** |
| `/cookies` | `CookiePolicyPage` | — | `StoreLayout` | **lazy** |
| `*` | redirect → `/` | — | `StoreLayout` | — |
| `/login` | `LoginPage` | — | `BareLayout` | eager |
| `/auth/callback` | `AuthCallbackPage` | — | `BareLayout` | eager |
| `/auth/reset` | `ResetPasswordPage` | — | `BareLayout` | eager |
| `/admin` | `AdminDashboardPage` | `AuthBoundary` + `AdminRoute` | `AdminLayout` | **lazy** |
| `/admin/orders` | `AdminOrdersPage` | idem | `AdminLayout` | **lazy** |
| `/admin/catalog` | `AdminCatalogPage` | idem | `AdminLayout` | **lazy** |
| `/admin/finance` | `AdminFinancePage` | idem | `AdminLayout` | **lazy** |
| `/admin/inventory` | `AdminInventoryPage` | idem | `AdminLayout` | **lazy** |
| `/admin/discounts` | `AdminDiscountsPage` | idem | `AdminLayout` | **lazy** |
| `/admin/size-guides` | `AdminSizeGuidesPage` | idem | `AdminLayout` | **lazy** |
| `/admin/print?doc=packing\|invoice&orders=…` | `OrderPrintPage` | idem | none (printed page) | **lazy** |

**Why the lazy split.** The admin console pulls in `recharts` and the legal pages carry three
policies in four languages; neither is on any storefront path, so a static import would put
both in the bundle every visitor downloads before the first product renders. The `named()`
helper in `routes/index.tsx` unwraps named exports for `React.lazy`, which expects a `default`.

**Deep links.** Because this is a client-routed SPA, the `vercel.json` rewrite
`/(.*) → /index.html` is what makes `https://yourstore.com/products/foo` resolve on a cold
load rather than 404.

---

## 6. CORS, CSP and security headers

### 6.1 CORS on the Edge Functions

Implemented once in [`supabase/functions/_shared/cors.ts`](supabase/functions/_shared/cors.ts)
and imported by the four browser-facing functions (`store-worker` counts: the admin's "Send
now" calls it from the app; its scheduled calls come from pg_net, with no `Origin`).
`stripe-webhook` does not use it — Stripe is a server, not a browser, so CORS is irrelevant
there.

**Configuration (runtime secrets — no redeploy needed to change them):**

| Secret | Default | Meaning |
|---|---|---|
| `ALLOWED_ORIGINS` | *(unset)* | Comma-separated exact origins. No spaces, no trailing slash. Include both `www` and apex if you serve both. Local dev: `http://localhost:5173` |
| `ALLOW_VERCEL_PREVIEWS` | `false` | Accept preview deployments of **this** project |
| `VERCEL_PREVIEW_PREFIX` | *(unset)* | **Required** when previews are on: your project's hostname prefix |

**Behaviour**

- **Fails closed.** With `ALLOWED_ORIGINS` unset, *every* browser origin is rejected and the
  module logs a warning at startup. Checkout returns `403` because the Stripe redirect URLs are
  built from the caller's *verified* origin — an unverifiable origin cannot be trusted to
  receive the buyer back.
- **Preview matching is prefix-scoped.** `.vercel.app` alone is not a trust boundary (anyone can
  deploy a free project there), so previews additionally require HTTPS and a hostname that is
  exactly `<prefix>.vercel.app` or starts with `<prefix>-`. Without `VERCEL_PREVIEW_PREFIX`,
  previews are rejected and a warning is logged.
- **A literal `*`** in `ALLOWED_ORIGINS` still works as an explicit opt-in, echoes the concrete
  request origin (never the literal `*`), and logs a loud warning at startup.
- **No `Origin` header → accepted.** That is a server-to-server or CLI caller, still
  authenticated by its bearer token. Only browsers send `Origin`.
- **Unauthorised origin → hard 403**, not merely a missing header. `create-checkout-session`
  uses `resolveAllowedOrigin()`; `handle-order-action`, `update-tracking` and `store-worker` use
  `isForbiddenOrigin()`. Both fail the request outright.
- `Access-Control-Allow-Credentials` is **never** sent. Sessions live in origin-scoped
  `localStorage`, not cookies, so there is no ambient authority to leak.

**Exported API**

| Function | Returns | Used for |
|---|---|---|
| `resolveAllowedOrigin(origin)` | the origin to echo, or `null` | Building `success_url` / `cancel_url` and the ACAO header |
| `isForbiddenOrigin(origin)` | `true` when a browser origin is present and unauthorised | Fail-closed 403 gate |
| `getCorsHeaders(origin)` | header map (`Vary: Origin` always; ACAO only when authorised) | Every response, including `OPTIONS` preflight |

> **CORS is not the security boundary.** Every privileged call also requires a valid login token
> and passes server-side role/ownership checks. The allowlist only limits which websites a
> browser may call the API from.

### 6.2 JWT verification at the gateway

Set **only** in [`supabase/config.toml`](supabase/config.toml) — the only file the Supabase CLI
reads function settings from. Per-function `config.toml` files were deleted because the CLI
never read them, which silently left every function at the default `verify_jwt = true`.

| Function | `verify_jwt` | Why |
|---|---|---|
| `create-checkout-session` | `false` | Verifies its own JWT in-function so it can return a JSON error the checkout page can display, instead of an opaque gateway 401 |
| `stripe-webhook` | **`false`** | **Must stay false.** Stripe authenticates with a signature and sends no `Authorization` header; with verification on, the gateway rejects it with 401 *before the function runs* |
| `handle-order-action` | `false` | Verifies its own JWT, then authorises per action (owner / admin) |
| `update-tracking` | `true` | Admin-only and always called with a real user token, so the gateway check is a free extra layer |
| `store-worker` | **`false`** | pg_cron calls it with the shared `x-worker-secret` header, not a JWT. The function accepts that secret (constant-time compare, ≥ 16 chars) or an admin's session, nothing else |

**Verification after deploy** (no auth header on purpose):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

- `400` → correct. The function ran and refused a request with no `stripe-signature`.
- `401` → the gateway blocked it. Turn Verify JWT off in the dashboard, or redeploy with
  `--no-verify-jwt`.

### 6.3 Response headers (Vercel)

From [`vercel.json`](vercel.json), applied to every path:

| Header | Value | Effect |
|---|---|---|
| `Content-Security-Policy` | see below | Blocks injected scripts and unexpected network egress |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing |
| `X-Frame-Options` | `DENY` | No framing (legacy companion to `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No path leakage to third parties |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS only, 2 years |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self)` | Disables camera/mic; geolocation same-origin only (Settings page offers a location toggle) |

**CSP directives**

```
default-src 'self';
script-src  'self';                       ← no inline scripts anywhere
connect-src 'self' https://*.supabase.co; ← PostgREST, Auth, Storage, Functions
img-src     'self' data: https:;          ← product images from any HTTPS CDN
style-src   'self' 'unsafe-inline';       ← inline styles used by components
font-src    'self' data:;                 ← fonts are self-hosted
object-src  'none'; frame-src 'none'; frame-ancestors 'none';
base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

Two consequences worth knowing:

- `script-src 'self'` is why the pre-paint theme script lives in
  [`public/theme-init.js`](public/theme-init.js) as an external file instead of inline.
- Fonts are self-hosted WOFF2 under `public/fonts/` (SIL OFL) so no third-party font request is
  made and `font-src` can stay `'self'`.

If you add an analytics or chat provider, you must extend `connect-src` (and possibly
`script-src`) or the browser will block it.

---

## 7. Environment variables and secrets

Three tiers, and they must never be mixed up.

### 7.1 Frontend (`.env` locally, Vercel env vars in production)

Only `VITE_`-prefixed variables are exposed to the client bundle. Everything here is **public
by design** — it ships inside the JavaScript any visitor can read.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | — | Supabase project URL. The client throws at startup if missing |
| `VITE_SUPABASE_ANON_KEY` | ✅ | — | Public anon key. Privilege comes from RLS, not from secrecy |
| `VITE_TAX_RATE` | — | `0` | **Display-only** tax estimate as a fraction (`0.07` = 7%). Keep in sync with backend `TAX_RATE`; set `0` when Stripe Tax is on |
| `VITE_APP_VERSION` | — | `1.0.0` | Version string shown on the Settings page |

Template: [`.env.example`](.env.example). `.env` is gitignored and must never be included in a
distributed ZIP.

### 7.2 Edge Function secrets (Supabase → Project Settings → Edge Functions → Secrets)

Read at runtime — changing a secret needs no redeploy.

| Secret | Required by | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | checkout, webhook, order-action | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | webhook | `whsec_…` — the endpoint's **signing secret**, not an API key |
| `SUPABASE_ANON_KEY` | checkout, order-action, update-tracking, store-worker | Used to validate the caller's JWT via `auth.getUser()` |
| `ALLOWED_ORIGINS` | all browser-facing | **Required.** Fails closed when unset. `store-worker` also takes its first entry as the site address for email links when `SITE_URL` is unset |
| `ALLOW_VERCEL_PREVIEWS` | all browser-facing | Default `false` |
| `VERCEL_PREVIEW_PREFIX` | all browser-facing | Required when previews are enabled |
| `TAX_RATE` | checkout | Flat fraction used when Stripe Tax is off. Default `0` |
| `STRIPE_TAX_ENABLED` | checkout **and** webhook | **Must be identical in both**, or paid orders get parked for review |
| `RESEND_API_KEY` | webhook, order-action, update-tracking, store-worker | Optional; without it emails are skipped |
| `STORE_WORKER_SECRET` | store-worker | **Required for the store emails.** Same value as the `store_worker_secret` Vault entry; at least 16 characters (32+ recommended) |
| `SITE_URL` | store-worker | Optional. Storefront address for links in the back-in-stock and low-stock emails |
| `RESEND_FROM_EMAIL` | email | Full `From` header. Domain must be verified in Resend or mail fails SPF/DKIM |
| `STORE_NAME` | email | Default `AURUM` |
| `SUPPORT_EMAIL` | email | Default `support@example.com` — **replace before launch** |
| `STORE_LOCALE` | email | Default `en-US` |
| `STORE_BRAND_COLOR` | email | Default `#111111` |

> **The currency is not on this list, deliberately.** It was `STORE_CURRENCY`, read only by
> the email module while `create-checkout-session` hard-coded `'usd'` and the storefront
> hard-coded `'USD'` — so setting it made the store charge dollars and email euros. It is now
> the literal `STORE_CURRENCY` in [`_shared/money.ts`](supabase/functions/_shared/money.ts),
> imported by all three. A constant cannot drift from itself.

### 7.3 Runtime-injected (never set by hand)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the Supabase Edge runtime. The
service-role key **bypasses RLS entirely** — it must never appear in `.env`, in the frontend, or
in the repository.

### 7.4 Per-function requirement matrix

| | checkout | webhook | order-action | update-tracking | store-worker |
|---|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | ✅ | ✅ (lazy, refund/cancel/payment-check paths) | — | — |
| `STRIPE_WEBHOOK_SECRET` | — | ✅ | — | — | — |
| `SUPABASE_URL` *(injected)* | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` *(injected)* | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SUPABASE_ANON_KEY` | ✅ | — | ✅ | ✅ | ✅ (admin "Send now") |
| CORS trio | ✅ | — | ✅ | ✅ | ✅ |
| `TAX_RATE` / `STRIPE_TAX_ENABLED` | ✅ | `STRIPE_TAX_ENABLED` only | — | — | — |
| `RESEND_*` / `STORE_*` | — | ✅ | ✅ | ✅ | ✅ |
| `STORE_WORKER_SECRET` / `SITE_URL` | — | — | — | — | ✅ |

Missing secrets are reported as a `500 CONFIG_MISSING_SECRETS` naming exactly which ones.

---

## 8. Repository layout

```text
CommerceJet/
├── .github/workflows/ci.yml       CI: typecheck → lint → test
├── docs/                          Buyer guides (00–06), .md sources + .html exports
├── public/                        Static assets copied verbatim into the build
│   ├── favicon.svg                Browser-tab logo (referenced by index.html)
│   ├── fonts/*.woff2              Self-hosted Instrument Serif + Inter (SIL OFL)
│   ├── icons.svg                  SVG sprite
│   └── theme-init.js              Pre-paint theme application (external for CSP)
├── src/
│   ├── assets/                    Bundled images (story.jpg: homepage editorial photograph)
│   ├── components/                Cross-feature UI
│   │   ├── cart/CartDrawer.tsx
│   │   ├── consent/CookieConsentBanner.tsx
│   │   ├── layout/                AuthBoundary, MobileMenu, SiteFooter, SiteHeader, StoreLayout
│   │   ├── search/SearchOverlay.tsx
│   │   └── ui/                    Badge, Drawer, ErrorMessage, Media, Reveal, Skeletons,
│   │                              Spinner, StatusIndicator, Toaster, Wordmark, icons, …
│   ├── config/storeConfig.ts      ★ Single place the operator fills in brand + legal identity
│   ├── features/                  Feature modules (see §9.6)
│   ├── hooks/                     React Query wrappers + auth listener
│   ├── lib/                       api, supabaseClient, queryClient, pricing, stock, variants,
│   │                              sizes, csv / productCsv / orderCsv, i18n (+ decks), types
│   ├── routes/                    Router config + ProtectedRoute / AdminRoute
│   ├── store/                     Zustand stores
│   ├── styles/                    tokens → base → primitives → storefront → admin
│   ├── types/index.ts             Shared application types
│   └── main.tsx                   Entry point
├── supabase/
│   ├── config.toml                ★ verify_jwt per function — the only file the CLI reads
│   ├── functions/
│   │   ├── _shared/               address, checkout-lines, cors, discounts, email, money,
│   │   │                          order-emails, refunds, store, webhook-logic (+ tests)
│   │   ├── create-checkout-session/index.ts
│   │   ├── handle-order-action/index.ts
│   │   ├── store-worker/index.ts
│   │   ├── stripe-webhook/index.ts
│   │   └── update-tracking/index.ts
│   ├── migrations/001…026.sql     Applied in numeric order
│   ├── seeds/002_mock_products.sql  40 demo products across 5 categories (sizes, one sold
│   │                              by colour, a size guide)
│   ├── schema.sql                 Base tables, enums, triggers
│   ├── rls.sql                    Base RLS policies + is_admin()
│   └── SETUP_CHECKLIST.md
├── tools/README.md                Supabase CLI usage
├── index.html                     HTML shell: title, favicon, fonts, theme-color, theme-init
├── vercel.json                    SPA rewrite + security headers
├── vite.config.ts                 Vite + React plugin (no custom config)
├── eslint.config.js               Flat config: js + ts + react-hooks + react-refresh
├── tsconfig*.json                 Project references: app (src) + node (vite.config)
└── package.json                   Scripts and dependencies
```

**Gitignored / not shipped:** `node_modules`, `dist`, `.env*`, `.vercel`, `supabase/.temp`
(the CLI cache, which contains the project ref and organisation id), local editor settings.

---

## 9. Frontend architecture

### 9.1 Stack

| Layer | Choice | Version |
|---|---|---|
| UI | React | 19 |
| Language | TypeScript | ~6.0 |
| Build | Vite | 8 |
| Routing | React Router DOM (data mode) | 7.18.2 |
| Server state | TanStack React Query | 5 |
| Client state | Zustand (with `persist`) | 5 |
| Charts | Recharts | 2 (admin only, lazy) |
| Backend SDK | `@supabase/supabase-js` | 2 |
| Tests | Vitest | 4 |

No CSS framework: styling is hand-written CSS with custom properties ([§10](#10-design-system-and-theming)).

### 9.2 Bootstrap sequence

1. [`index.html`](index.html) — sets `<title>`, favicon, `theme-color`, `viewport-fit=cover`
   (required for `env(safe-area-inset-*)` to resolve on notched phones), preloads the two
   display fonts, and loads `/theme-init.js`.
2. [`public/theme-init.js`](public/theme-init.js) — reads the persisted theme from
   `localStorage` and toggles `html.dark` **before first paint**, so there is no flash.
3. [`src/main.tsx`](src/main.tsx) — `initTheme()`, then renders
   `<StrictMode><QueryClientProvider><AppRouter/>`.
4. A layout shell mounts `useAuthListener()`, which hydrates the auth store from the existing
   session and subscribes to `onAuthStateChange`.

### 9.3 State management

**Server state — React Query.** Defaults in [`src/lib/queryClient.ts`](src/lib/queryClient.ts):
`staleTime` 5 min, `gcTime` 10 min, `retry` 1, `refetchOnWindowFocus` false, mutations never
retry.

| Query key | Hook | Notes |
|---|---|---|
| `['products','list',filters]` | `useProducts` | Filters are part of the key |
| `['products','detail',slug]` | `useProduct` | Also loads active variants and colours |
| `['products','featured']` | `useFeaturedProducts` | Limit 8 |
| `['categories']` | `useCategories` | `staleTime` 30 min |
| `['shipping-methods']` | `useShippingMethods` | `staleTime` 10 min |
| `['orders', userId]` | `useOrders` | |
| `['order', orderId]` | `useOrder` | |
| `['order-by-session', sessionId]` | inline in `CheckoutSuccessPage` | Retries 4× with exponential backoff while waiting for the webhook |
| `['addresses', userId]` | `useAddresses` | |
| `['reviews', productId]` | `useReviews` | |
| `['has-purchased', productId, userId]` | `useHasPurchased` | RPC-backed review gate |
| `['size-guides']` / `['size-guides', id]` | `useSizeGuides` / `useSizeGuide` | The product page loads one guide only when its drawer opens |
| `['store-settings','back-in-stock']` | `useBackInStockEnabled` | Whether the "Notify me" form is offered |
| `['admin-orders', filters]` | `useAdminOrders` | Page size 50 |
| `['admin-order', id, 'events' \| 'refunds']` | `useOrderEvents` / `useOrderRefunds` | Timeline and refund list of the open order |
| `['admin-products']` / `['admin-products','costs']` / `['admin-categories']` | `useAdminProducts`, `useCatalogCosts`, … | Costs come from an admin-only RPC |
| `['admin-inventory', 'low-stock' \| 'movements' \| 'requests', …]` | `useInventory` hooks | |
| `['admin-settings']` | `useStoreSettings` | Alert and back-in-stock switches |
| `['admin-discounts']` / `['admin-discounts','usage']` | `useDiscounts` hooks | |
| `['admin-analytics']` | `useAdminAnalytics` | Single RPC call |

Mutations invalidate `['admin-orders']` and `['admin-analytics']` together, so the dashboard
never disagrees with the order queue; anything that moves stock also invalidates
`['admin-products']`, `['admin-inventory']` and the storefront's `['products']`.

**Client state — Zustand.** Persisted stores use `localStorage` with explicit `partialize`, so
only the intended slice survives a reload.

| Store | File | Persisted key | Holds |
|---|---|---|---|
| `useCartStore` | `store/cartStore.ts` | `aurum-cart` | Cart lines (`items` only) |
| `useAuthStore` | `store/authStore.ts` | — (memory) | `user`, `session`, `profile`, `profileStatus`, `isLoading` |
| `useThemeStore` | `store/themeStore.ts` | `aurum-theme` | `light` \| `dark` \| `system` |
| `usePreferencesStore` | `store/preferencesStore.ts` | `aurum-preferences` | UI language |
| `useCookieConsentStore` | `store/cookieConsentStore.ts` | `aurum-cookie-consent` | Consent status, categories, `decidedAt` |
| `useUiStore` | `store/uiStore.ts` | — | Which overlay surface is open (`search` \| `cart` \| `menu`) — mutually exclusive |
| `useToastStore` | `store/toastStore.ts` | — | Transient toasts (auto-dismiss 3.2 s) |

Two details worth carrying in your head:

- **`authStore.profileStatus`** (`idle` / `loading` / `loaded` / `error`) exists so `AdminRoute`
  can distinguish "profile not loaded yet" (spinner) from "loaded and not an admin" (redirect).
  Without it, a hard refresh on `/admin` bounced admins to the home page.
- **`cookieConsentStore`** re-prompts after 12 months via `onRehydrateStorage`, per EDPB
  guidance. `hasAnalyticsConsent()` is the single read helper.

### 9.4 The cart

`localStorage` is the only cart — migration `013` dropped the `carts`/`cart_items` tables
entirely (owner decision recorded in `ROADMAP.md`).

- **Line identity** is `cartLineKey()`: `productId::variantId`, so two sizes or colours of one
  product are separate lines. A line saved before variant ids existed (`productId::size:M`) is
  migrated to its variant id by the next catalogue sync, and duplicates are merged.
- **Line display** (`selectedColor` / `selectedSize`, price, photo) comes from the variant:
  `unitPrice()` uses the variant's own price when it has one, and `cartLineImage()` the chosen
  colour's photo.
- **Quantity caps** come from [`src/lib/stock.ts`](src/lib/stock.ts), never from raw
  `stock_quantity`. That module encodes three rules that used to be scattered and disagreeing:
  1. Stock can be **negative** (migration 013 allows oversell depth), so `sellableStock()`
     clamps at 0 — otherwise `Math.min(qty, -5)` would put a negative quantity in the cart.
  2. For a line with a variant (size and/or colour) the binding limit is the **variant's**
     stock. A loaded list without that variant (or with it switched off) means it is not on
     sale, so the line gets 0; only an unloaded list (listing queries) falls back to the
     product total.
  3. `products.stock_quantity` is still an upper bound — `availableStock()` takes the **min**
     of the two. Since migrations 021/022 it is derived from the variants on sale, so it only
     binds when the variant itself has been switched off.
- **Variant choice** (`variantChoiceFits()`): a product with sizes or colours can only be added
  with a variant, one without only without — both are what checkout would refuse.
- **`syncWithCatalog(products)`** (driven by `useCartSync` on mount) adopts fresh prices and
  images, drops products that vanished or were deactivated, drops lines whose variant no longer
  fits the product (sizes or colours switched on or off), clamps quantities, and returns `true`
  when the shopper should be told. Failure is non-fatal: the server re-validates everything at
  checkout anyway.

### 9.5 Data layer — `src/lib/api.ts`

Every Supabase call lives here; components never build queries. Two column allowlists exist for
security reasons and must not be replaced with `*`:

| Constant | Why |
|---|---|
| `PRODUCT_COLUMNS` | `products` is world-readable and `*` published `cost_price` — the store's margin — to any visitor. Migration 016 revokes table-wide `SELECT` for `anon`/`authenticated`, so `SELECT *` on `products` is now **refused** and columns must be named |
| `PUBLIC_REVIEW_COLUMNS` | `product_reviews` is world-readable (`USING (TRUE)`); omitting `user_id` stops anonymous visitors enumerating the auth UUID behind every review. `author_name` is the trigger-maintained display snapshot |

| Function | Reads/writes | Notes |
|---|---|---|
| `fetchProducts(filters)` | `products` | Paginated (default 12). `count: 'estimated'` so filters and search keystrokes don't pay for a full `COUNT(*)`. Category filter uses `categories!inner` — a left join would only null the embed, not exclude rows |
| `fetchProductBySlug(slug)` | `products` + `product_variants` + `product_colors` | Active variants and colours, ordered by `sort_order`; images carry their `color_id` |
| `fetchFeaturedProducts()` | `products` | `is_featured`, limit 8 |
| `fetchProductsByIds(ids)` | `products` + variants | Cart sync; variants included so per-size limits survive |
| `fetchCategories()` | `categories` | Active only, by `sort_order` |
| `fetchSizeGuide(id)` / `fetchSizeGuides()` / `saveSizeGuide` / `deleteSizeGuide` / `setSizeGuideCategories` | `size_guides`, `categories.size_guide_id` | Public read; writes admin-only by RLS |
| `fetchBackInStockEnabled()` / `requestStockNotification(…)` | `store_settings` / RPC `request_stock_notification` | The "Notify me" form; HINT codes become `AppError.code` (`invalid_email`, `rate_limited`, …) |
| `previewDiscountCode(code)` | RPC `preview_discount_code` | What a code would do, before paying; the real discount is computed again by the checkout function |
| `fetchProfile(userId)` | `profiles` | |
| `fetchAddresses` / `createAddress` | `addresses` | |
| `fetchShippingMethods()` | `shipping_methods` | Active only |
| `fetchReviews(productId)` | `product_reviews` | Allowlisted columns |
| `hasPurchasedProduct(id)` | RPC `has_purchased` | Gates the review form |
| `submitReview(...)` | `product_reviews` upsert | Rating clamped 1–5, body trimmed to `REVIEW_BODY_MAX_LENGTH` (2000) |
| `fetchOrders` / `fetchOrderById` | `orders` + `order_items` | RLS scopes to owner |
| `cancelOrder(orderId)` | → `handle-order-action` | Never a direct table write |
| `fetchAdminOrders(filters)` | `orders` + items + profile | Page size 50, `status`, `needsReviewOnly` and date filters, exact count |
| `fetchAllAdminOrders(filters \| { ids })` | idem | Every matching order (pages of 500, up to 5,000) for CSV export and printing |
| `updateOrderStatus` | `orders` | Direct write; DB transition guard still applies (and 024 refuses settling a `processing` / `requires_action` order this way) |
| `updateOrderTracking` | → `update-tracking` | Client never sends a status |
| `markOrderDelivered` / `refundOrder` / `refundOrderLines(…)` | → `handle-order-action` | `refundOrderLines` sends a client request id (the refund's idempotency key), the lines, quantities, restock flags and shipping |
| `adminCancelOrder` / `syncOrderPayment` / `confirmOrderPayment` | → `handle-order-action` | Pre-payment orders: close the Stripe session and cancel, apply what Stripe says, or confirm a held payment |
| `exchangeOrderItem(…)` / `resolveOrderReview(…)` / `issueInvoices(ids)` | RPCs `admin_exchange_order_item`, `admin_resolve_review`, `admin_issue_invoices` | |
| `fetchOrderEvents` / `addOrderNote` / `deleteOrderNote` / `fetchOrderRefunds` | `order_events`, `order_refunds` | The order timeline. Admins can only insert `note` rows, signed as themselves, and delete `note` rows; every other event is written by triggers and functions |
| `fetchAdminAnalytics()` | RPC `admin_analytics` | Aggregates computed in the DB, not by downloading every order |
| `fetchAdminProducts` / `createProduct` / `updateProduct` | `products` (+ every variant and colour, inactive included) | `createProduct` resolves a unique slug with up to 5 attempts. `updateProduct` is for non-stock fields |
| `fetchCatalogCosts()` | RPC `admin_catalog_costs` | Product and variant costs (hidden from the public API) |
| `saveProductVariants(id, config)` | RPC `admin_save_product_variants` | The product editor's single write path for sizes, colours, variant prices/costs and stock. Throws `StockConflictError` (with the variant id) when a figure moved since the editor loaded it, `AppError('sku_taken')` for a duplicate SKU |
| `setVariantStock(changes, note)` / `setProductStock(id, stock, expected, note)` | RPCs `admin_set_variant_stock` / `admin_set_product_stock` | Quick restock from the catalogue or the inventory page, same optimistic check; the note goes to the stock history |
| `fetchProductInventory(id)` | `products` + variants | Current figures an editor rebases on after a conflict |
| `duplicateProduct(id, name)` / `importProducts(rows, options)` | RPCs `admin_duplicate_product` / `admin_import_products` | An import failure is `AppError('import_row')` with the row index |
| `uploadProductImage(file)` | Storage `product-images` | Random UUID filename; returns the public URL |
| `addProductImages` / `deleteProductImage` / `setPrimaryProductImage` / `setImageColor` | `product_images` | Primary is clear-then-set (a partial unique index enforces one per product) |
| `fetchAdminCategories` / `createCategory` | `categories` | |
| `fetchInventoryMovements(filters)` / `fetchAllInventoryMovements` / `fetchLowStock` / `fetchStockRequests` | `inventory_movements`, RPCs `admin_low_stock`, `admin_stock_requests` | |
| `fetchStoreSettings` / `updateStoreSettings` / `runStoreWorker(task)` | RPCs `admin_get_store_settings` / `admin_update_store_settings`, → `store-worker` | |
| `fetchDiscountCodes` / `fetchDiscountUsage` / `saveDiscountCode` / `deleteDiscountCode` | `discount_codes`, RPC `admin_discount_usage` | A used code cannot be deleted (`AppError('code_used')`); a duplicate code is `AppError('code_taken')` |

`invokeOrderFunction()` is the shared Edge Function caller: it pulls a fresh access token from
`supabase.auth.getSession()`, sends `Authorization: Bearer …` plus `apikey`, and surfaces the
function's JSON `error` field as the thrown message.

### 9.6 Feature modules

Each module owns its pages, and where useful its own components and constants.

| Module | Pages | Notable behaviour |
|---|---|---|
| `features/products` | `HomePage`, `ProductListPage`, `ProductDetailPage` | Home falls back to newest products when nothing is flagged featured; detail page handles colours (`?color=` in the URL, gallery per colour), sizes, the variant's own price, the size guide drawer, "Notify me" for a sold-out choice, reviews and related products. `HomePage` carries a slug→icon map — update it if you rename category slugs |
| `features/cart` | `CartPage` (+ `CartItemRow`, `CartLineOptions`) | Mirrors the drawer with a wider view; each line shows its colour and size |
| `features/checkout` | `CheckoutPage`, `CheckoutSuccessPage`, `CheckoutCancelPage` | Address form imports the country list, postal patterns and length caps **from the Edge Function's shared module** so client and server cannot drift. The discount field previews a code with `preview_discount_code` and `computeDiscount()` (the same module the checkout function uses). Success page polls for the webhook-created order before clearing the cart |
| `features/orders` | `OrdersPage`, `OrderDetailPage` | Only `paid` orders are cancellable from the UI; error codes are mapped to human messages |
| `features/auth` | `LoginPage`, `AuthCallbackPage`, `ResetPasswordPage` | Email/password + Google; sign-up collects `full_name` into user metadata |
| `features/profile` | `ProfilePage` | Open orders, "buy again", sign-out, admin entry when applicable |
| `features/settings` | `SettingsPage` | Theme, language, cookie preferences, location/analytics toggles, app version |
| `features/help` | `HelpPage` | Contact details read from `storeConfig` |
| `features/legal` | `PrivacyPage`, `PrivacyPolicyPage`, `TermsPage`, `CookiePolicyPage` | Text lives in `constants/{privacy,terms,cookie}Data.ts`; `LegalDocument` renders all three identically and runs `fillPlaceholders()` from `storeConfig` |
| `features/admin` | `AdminDashboardPage`, `AdminOrdersPage`, `AdminCatalogPage`, `AdminFinancePage`, `AdminInventoryPage`, `AdminDiscountsPage`, `AdminSizeGuidesPage`, `OrderPrintPage` | See [§19](#19-admin-console) |

### 9.7 Shared components

| Component | Purpose |
|---|---|
| `StoreLayout` | Storefront shell: header, main, footer, plus the mutually exclusive overlays. Binds ⌘K/Ctrl-K to search; every navigation closes surfaces and scrolls to top |
| `AuthBoundary` / `BareLayout` | Mount the auth listener above route guards (otherwise guards would wait forever) |
| `AdminLayout` | Admin shell: recessed rail + raised workspace |
| `SiteHeader`, `SiteFooter`, `MobileMenu` | Navigation; footer and menu read `storeConfig` |
| `SearchOverlay` | Command-palette search over products and categories, keyboard driven |
| `CartDrawer` | The bag as a sheet; quantity edits happen in place |
| `CookieConsentBanner` | Granular consent; "Reject all" has equal prominence |
| `Media` | Image with fixed aspect ratios and optional slow hover zoom |
| `StatusIndicator` | One status vocabulary for the whole product — a dot carries tone, the word carries meaning, so state is never colour-only |
| `SizeGuideTable` | A size guide as the shopper sees it; also the admin's live preview |
| `Drawer`, `Badge`, `Spinner`, `Skeletons`, `SkeletonCard`, `ErrorMessage`, `Toaster`, `Reveal`, `BackButton`, `Wordmark`, `icons` | Primitives |

### 9.8 Business-logic modules

| Module | Responsibility |
|---|---|
| [`lib/pricing.ts`](src/lib/pricing.ts) | `computeOrderTotals(subtotal, shipping, taxRate, discount)` — tax applies to **subtotal + shipping after the discount**, matching the server. `unitPrice` / `lineTotal` / `cartSubtotal` use the variant's own price when it has one. Everything rounded to the cent; invalid or negative inputs collapse to 0. Display estimate only |
| [`lib/stock.ts`](src/lib/stock.ts) | `sellableStock`, `lineVariant`, `availableStock`, `variantChoiceFits`, `variantFitsShape`, `isSoldOut` — see [§9.4](#94-the-cart) |
| [`lib/variants.ts`](src/lib/variants.ts) | Storefront helpers (sellable colours and variants, labels, price range, images per colour) and the product editor's draft model: build from a product, edit cells, validate, and turn into the `admin_save_product_variants` payload |
| [`lib/sizes.ts`](src/lib/sizes.ts) | Size labels, presets, name/SKU limits, stock-input parsing |
| [`lib/csv.ts`](src/lib/csv.ts), [`lib/productCsv.ts`](src/lib/productCsv.ts), [`lib/orderCsv.ts`](src/lib/orderCsv.ts) | CSV writing/reading (BOM, `,` or `;` by language, formula-injection guard, separator detection), the catalogue import plan and the order exports |
| [`supabase/functions/_shared/discounts.ts`](supabase/functions/_shared/discounts.ts) | **Shared with the backend.** `computeDiscount()` in integer cents (largest-remainder allocation per line), code normalisation and pattern |
| [`supabase/functions/_shared/refunds.ts`](supabase/functions/_shared/refunds.ts) | **Shared with the backend.** What is left to refund and the suggested amount for chosen lines (with their share of discount and tax) |
| [`config/storeConfig.ts`](src/config/storeConfig.ts) | Brand, contact and legal identity; `fillPlaceholders()` injects values into legal text; `hasUnfilledPlaceholders()` reports unfilled tokens (currently defined but not called anywhere) |
| [`supabase/functions/_shared/address.ts`](supabase/functions/_shared/address.ts) | **Shared with the backend.** Shipping countries, postal patterns, field caps, `sanitizeAddress()` |
| [`lib/supabaseClient.ts`](src/lib/supabaseClient.ts) | Typed client; `persistSession`, `autoRefreshToken`, `detectSessionInUrl` all on. Throws a helpful error if env vars are missing |
| [`lib/database.types.ts`](src/lib/database.types.ts) | Generated from the schema — regenerate after any migration (see [§22.7](#227-regenerate-database-types)) |
| [`types/index.ts`](src/types/index.ts) | Hand-written application types: `Product`, `Order`, `OrderItem`, `Profile`, `Address`, `ShippingMethod`, `PublicProductReview`, `CartItemLocal`, `AdminAnalytics`, … |

---

## 10. Design system and theming

**Load order matters** — [`src/styles/globals.css`](src/styles/globals.css) imports in this
sequence, and later files depend on earlier ones:

```
tokens.css      vocabulary: @font-face, colours, spacing, radii, durations
base.css        document reset and element defaults
primitives.css  shared components: buttons, fields, cards, panels
storefront.css  editorial expression: photographic, low density, asymmetric
admin.css       operational expression: structured, higher density, precise
```

Two expressions, one vocabulary: components never hardcode a colour, size, radius or duration —
they reference tokens.

**Theming.** Light is the default and is deliberately **not** derived from the OS: a visitor who
has never chosen gets the light store even on a dark device. Dark applies only on an explicit
`dark`, or an explicit `system` chosen in Settings.

- `html.dark` is the switch; dark overrides live in the same token file.
- `theme-init.js` applies the class before first paint; `themeStore.applyTheme()` keeps it in
  sync afterwards and repaints the `<meta name="theme-color">` (`#F7F5F1` light, `#0E0D0B`
  dark, kept in step with `--paper`).
- The `system` choice subscribes to `prefers-color-scheme` changes at runtime.

**Fonts.** Instrument Serif (editorial voice) and Inter (interface), self-hosted WOFF2 with
`unicode-range` subsets and `font-display: swap`. The two latin faces are `<link rel="preload">`ed
because they carry the first line the visitor reads.

**Brand colour.** The accent tokens are near the top of the token file; change them in both the
light and dark blocks. Email branding is separate — it is set by the `STORE_BRAND_COLOR` secret
because Edge Functions cannot import frontend CSS.

---

## 11. Internationalisation

Four languages: `en` (default), `it`, `es`, `fr`.

| File | Role |
|---|---|
| [`src/lib/i18n.ts`](src/lib/i18n.ts) | Base dictionary (~2,900 lines) and the `useI18n()` hook |
| [`src/lib/i18nCopy.ts`](src/lib/i18nCopy.ts) | "Editorial copy deck" — newer surfaces (home sections, search, cart drawer, admin) kept together so the brand voice reads as one piece. **Deep-merged over** the base dictionary: a key present in both wins from here |
| [`src/lib/i18nCommerce.ts`](src/lib/i18nCommerce.ts) | "Commerce copy deck" — variants, size guides, back-in-stock, inventory, discounts, refunds and exchanges, exports and printed documents. Merged after the editorial deck |
| [`src/lib/i18n.test.ts`](src/lib/i18n.test.ts) | Fails when the code uses a key English lacks, a template key (`` `admin.inventory.reason.${r}` ``) has no section behind it, or Italian, Spanish or French differ from English in keys or `{{placeholders}}` |
| [`src/store/preferencesStore.ts`](src/store/preferencesStore.ts) | Current language + `LANGUAGE_OPTIONS` (label, flag, country) |

`useI18n()` returns:

| Member | Behaviour |
|---|---|
| `t(key, params?)` | Dot-path lookup, falls back to English, then to the key itself. `{{name}}` interpolation |
| `tCount(key, count, params?)` | `Intl.PluralRules` on the active locale; looks for `key.<form>`, then `key.other` |
| `locale` | `en-US` / `it-IT` / `es-ES` / `fr-FR` |
| `formatCurrency(value)` | `Intl.NumberFormat`, currency fixed to **USD** |
| `formatDate` / `formatDateTime` | `Intl.DateTimeFormat` on the active locale |

**Adding a language:** copy an existing block in `i18n.ts`, translate it, add the matching block
in `i18nCopy.ts`, then extend `AppLanguageCode` and `LANGUAGE_OPTIONS`. Note the existing
non-English dictionaries avoid accented characters for consistency. Currency stays USD
regardless of language — only formatting changes.

Emails and legal placeholders are **not** part of this system: emails are English and configured
via Edge Function secrets (the back-in-stock emails carry their own en/it/es/fr copy inside
`store-worker`, picked by the language the customer browsed in); legal text is translated inside
`features/legal/constants/*`.

---

## 12. Database

Everything lives in the `public` schema. What follows is the **final state after migration 026**,
not the state of `schema.sql` alone.

### 12.1 Enums

| Type | Values |
|---|---|
| `user_role` | `customer`, `admin` |
| `order_status` | `pending`, `processing`, `requires_action`, `paid`, `failed`, `cancelled`, `shipped`, `delivered`, `refunded` |

### 12.2 `profiles` — extends `auth.users`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | TEXT NOT NULL | Mirrored from auth; not user-writable |
| `full_name` | TEXT | ≤ 120 chars (016); feeds the review `author_name` snapshot |
| `avatar_url` | TEXT | |
| `role` | `user_role` NOT NULL DEFAULT `customer` | **Not writable through the API at all** |
| `phone` | TEXT | ≤ 32 chars (016) |
| `created_at` / `updated_at` | TIMESTAMPTZ | `updated_at` maintained by trigger |

Created automatically on signup by `handle_new_user()`. Since migration 014 that function is
failure-proof (`COALESCE` for a null email, `ON CONFLICT DO NOTHING`) — the old version could
abort signup with "Database error saving new user" and leave the account profile-less.

### 12.3 Catalogue

**`categories`** — `id`, `name`, `slug` (UNIQUE), `description`, `image_url`, `parent_id`
(self-FK, ON DELETE SET NULL), `sort_order`, `is_active`, `size_guide_id` (022, FK →
`size_guides` ON DELETE SET NULL — the guide its products show), timestamps. Indexes on `slug`,
`parent_id`.

**`products`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `category_id` | UUID NOT NULL | FK → `categories` ON DELETE **RESTRICT** |
| `name`, `slug` (UNIQUE), `description` | TEXT | `slug` is the product URL |
| `price` | NUMERIC(10,2) ≥ 0 | |
| `compare_at_price` | NUMERIC(10,2) ≥ 0 | Struck-through "before" price |
| `cost_price` | NUMERIC(10,2) ≥ 0 | 🔒 **Not readable by `anon`/`authenticated`** (016); admins read it through `admin_catalog_costs()` |
| `sku` | TEXT UNIQUE | |
| `stock_quantity` | INTEGER NOT NULL DEFAULT 0 | **No `>= 0` constraint** — negative = backorder depth. For a product with variants it is **derived** (see below) |
| `low_stock_threshold` | INTEGER DEFAULT 5 | For a product with variants it applies to each variant |
| `weight_grams` | INTEGER ≥ 0 | |
| `is_active`, `is_featured` | BOOLEAN | |
| `has_sizes` | BOOLEAN NOT NULL DEFAULT FALSE | Sold by size (021): checkout requires a size, stock is kept per size |
| `size_label` | TEXT NOT NULL DEFAULT `size` | The word above the size selector: `size`, `measure`, `length`, `shoe_size`, `ring_size`, `waist` (CHECK) |
| `has_colors` | BOOLEAN NOT NULL DEFAULT FALSE | Sold by colour (022). With `has_sizes` too, stock is kept per colour × size |
| `color_label` | TEXT NOT NULL DEFAULT `color` | `color`, `material`, `finish`, `pattern`, `style`, `scent`, `variant` (CHECK) |
| `price_min` / `price_max` | NUMERIC(10,2) | **Derived** (022): lowest / highest price among the variants on sale (or `price`), for "From …" and the price filter |
| `size_guide_id` | UUID | FK → `size_guides` ON DELETE SET NULL; NULL = the category's guide |
| `metadata` | JSONB | |

**Derived figures (021, 022).** When `has_sizes` or `has_colors` is true, `stock_quantity` is
the sum of `GREATEST(stock_qty, 0)` over the product's **active** variants — a backordered
variant counts as 0 so it cannot hide the ones still on the shelf, and a switched-off variant is
not for sale. `price_min` / `price_max` follow the variants' own prices (an empty price is the
product price). `products_sync_rollups` (BEFORE INSERT/UPDATE on `products`) recomputes them on
every write, whoever makes it, and `product_variants_touch_rollups` (AFTER INSERT/UPDATE/DELETE
on variants) refreshes them — and each colour's derived `is_active` — whenever a variant changes.
A product without variants keeps its own counter exactly as before. (Bulk writers set the
transaction-local `app.defer_rollups` flag and refresh once at the end.)

Indexes: `slug`, `category_id`, `is_active`, `is_featured`, `price`, a **GIN trigram** index on
`name` (so the storefront's `ILIKE '%term%'` search stops sequentially scanning), and a partial
`created_at DESC WHERE is_active` index for listing pages.

**`product_images`** — `product_id` (CASCADE), `url`, `alt_text`, `sort_order`, `is_primary`,
`color_id` (022, FK → `product_colors` ON DELETE SET NULL — NULL = a photo of the product as a
whole, shown for every colour). A **partial unique index** enforces at most one primary image
per product.

**`product_colors`** (022) — `product_id` (CASCADE), `name` (trimmed, 1–40 chars, unique per
product case-insensitively), `swatch` (`#RRGGBB` or NULL = shown by name), `sort_order`,
`is_active` (**derived**: true while the colour has a variant on sale), timestamps. The public
can read only active colours of active products.

**`product_variants`** (migration 004) — one row per size, per colour, or per colour × size:
`product_id` (CASCADE), `size` (trimmed, 1–40 chars, NULL when sold by colour only), `color_id`
(022, FK → `product_colors`, NULL when sold by size only; a CHECK requires one of the two, and a
trigger requires the colour to belong to the same product), `price` (022, NULL = product price),
`sku` (≤ 64 chars, unique when set), `stock_qty` (may go negative), `sort_order`, `is_active`
(switched off = not for sale and hidden from the storefront), UNIQUE NULLS NOT DISTINCT
`(product_id, color_id, size)`. A variant referenced by an order line cannot be deleted
(`order_items.variant_id` is `ON DELETE RESTRICT`); the admin functions switch it off instead.

**`product_variant_costs`** (022) — `variant_id` PK (CASCADE), `cost_price`. Admin-only table:
variant costs stay out of the public API like `products.cost_price`.

**`size_guides`** (022) — `name`, `columns` (JSONB array of headings, 1–12), `rows` (JSONB array
of string arrays, ≤ 60), `notes`, timestamps. Public read, admin write. Attached through
`products.size_guide_id` or `categories.size_guide_id`.

### 12.4 `addresses`

`user_id` (CASCADE), `full_name`, `line1`, `line2`, `city`, `state`, `postal_code`,
`country` (default `US`), `phone`, `is_default`, timestamps.

Limits from migration 016: per-field length CHECK (`full_name` 120, `line1`/`line2` 200,
`city`/`state` 100, `postal_code` 20, `country` 2, `phone` 32) and a `BEFORE INSERT` trigger
capping saved addresses at **20 per user**. The service role is *not* exempt — nothing
server-side creates addresses on a user's behalf.

### 12.5 `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL | FK → `profiles` ON DELETE **RESTRICT** |
| `status` | `order_status` DEFAULT `pending` | Transitions guarded by trigger |
| `subtotal`, `shipping_cost`, `tax_amount`, `discount_amount`, `total` | NUMERIC(10,2) ≥ 0 | Immutable after payment |
| `shipping_address` | JSONB NOT NULL | Snapshot. CHECK: must contain `full_name`, `line1`, `city`, `state`, `postal_code`, `country`; serialised length ≤ 2000 (016) |
| `shipping_method_id` / `shipping_method_name` | UUID FK / TEXT | Name is a snapshot |
| `stripe_session_id` | TEXT UNIQUE | |
| `stripe_payment_intent_id` | TEXT UNIQUE | |
| `tracking_id`, `tracking_updated_at` | TEXT / TIMESTAMPTZ | |
| `refund_id` (UNIQUE), `refund_amount`, `refunded_at` | TEXT / NUMERIC / TIMESTAMPTZ | Since 024: the latest Stripe refund id, the **total** refunded so far and when; every refund is a row of `order_refunds` |
| `discount_code`, `discount_id`, `shipping_discount` | TEXT / UUID FK / NUMERIC | 024/025: the code used (snapshot), its row, and the part of `discount_amount` taken off shipping |
| `invoice_number`, `invoice_issued_at` | TEXT UNIQUE / TIMESTAMPTZ | 024: `YYYY-00001`, issued on first print |
| `delivered_at` | TIMESTAMPTZ | |
| `needs_review` | BOOLEAN DEFAULT FALSE | Operator attention flag |
| `review_reason` | TEXT | e.g. `oversold`, or a webhook business-rule rejection |
| `notes` | TEXT | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Indexes: `user_id`, `status`, `created_at DESC`, `(user_id, created_at DESC)`, partial indexes on
`stripe_session_id`, `stripe_payment_intent_id`, `tracking_id`, `refund_id`, `delivered_at`, and
`needs_review WHERE TRUE`.

### 12.6 `order_items`

`order_id` (CASCADE), `product_id` (RESTRICT), snapshots `product_name` / `product_image`,
`unit_price`, `quantity` > 0, `total_price`, `selected_size` (the label the customer saw),
`variant_id` (021, FK → `product_variants` ON DELETE RESTRICT — the variant row the line takes
its stock from, so a refund finds it even after the size or colour is renamed; historical lines
were linked by their `selected_size`), `selected_color` and `sku` (022, snapshots),
`discount_amount` (024, the line's share of the discount code), `refunded_quantity` and
`restocked_quantity` (024, units refunded / put back in stock so far).

A CHECK enforces `total_price = ROUND(unit_price * quantity, 2)`, so a line can never disagree
with its own arithmetic. Lines are immutable once the order is paid, except the refund and
exchange counters, which only the refund and exchange functions may move (they open a
transaction-local allowlist, `app.order_items_write`).

**`order_item_costs`** (022) — `order_item_id` PK (CASCADE), `unit_cost`: what one unit cost
the store when it was sold (written by the checkout function, admin-only), for the margin.

### 12.6b Order operations, inventory and discounts (022–025)

| Table | Holds | Access |
|---|---|---|
| `order_events` (024) | The order timeline: `kind` (`note`, `status`, `tracking`, `refund`, `exchange`, `review`, `payment`, `invoice`, `email`), `message`, `data` JSONB, `actor_id` | Admin read; admins insert/delete only `note` rows; the rest is written by triggers and functions |
| `order_refunds` (024) | Every refund: amount, `status` (Stripe's), `source` (`admin`, `customer`, `stripe`), reason, `lines` (order line, quantity, restock), `shipping_amount`, `stripe_refund_id`, `applied_at` | Admin read; written only by the refund functions |
| `invoice_counters` (024) | `year` → `last_number`, for gapless invoice numbers | Functions only |
| `inventory_movements` (023) | One row per stock change: product, variant (+ label snapshot), `delta`, `stock_after`, `reason` (`sale`, `cancel`, `refund`, `return`, `exchange`, `manual`, `import`, `initial`, `other`), `detail`, order, actor, note | Admin read; written only by triggers |
| `store_settings` (023) | One row: `back_in_stock_enabled`, `low_stock_alerts`, `alert_emails` | `anon` reads only `back_in_stock_enabled`; admins through `admin_get/update_store_settings()` |
| `stock_notifications` (023) | "Email me when it is back": product, variant, email (lower-cased), user, locale, `notified_at` | Admin read/delete; shoppers add requests only through `request_stock_notification()`, the worker claims them through service-role functions |
| `stock_notification_attempts` (023) | SHA-256 of the requester (IP), for the rate limit (20 an hour) | Functions only |
| `low_stock_alert_state` (023) | Items already reported in a digest, until restocked | Functions only |
| `discount_codes` (025) | `code` (unique, `[A-Z0-9][A-Z0-9_-]{2,39}`), `kind` (`percent`, `fixed`, `free_shipping`), `value`, `min_subtotal`, `starts_at` / `ends_at`, `usage_limit`, `per_customer_limit`, `applies_to` (`all`, `categories`, `products`) + id arrays, `exclude_sale_items`, `is_active` | Admin only; shoppers use `preview_discount_code()` |
| `discount_redemptions` (025) | One row per order that used a code (`order_id` UNIQUE, amount); a code with redemptions cannot be deleted | Functions only (admins read) |
| `discount_attempts` (025) | Failed previews, for the throttle | Functions only |

**Stock history context.** Writers describe a change before making it with the
transaction-local settings `app.stock_reason`, `app.stock_order` and `app.stock_note`
(`set_stock_context()`); the logging triggers read them, so every movement has a reason no
matter which code path moved the stock.

### 12.7 `product_reviews`

`product_id` (CASCADE), `user_id` (CASCADE), `rating` 1–5, `body` (≤ 2000 chars),
`author_name` (snapshot written by trigger), timestamps, UNIQUE `(product_id, user_id)`.

`author_name` exists because public reviews used to join `profiles`, which leaked reviewer
emails. The client never selects `user_id`.

### 12.8 `shipping_methods`

`name`, `description`, `price` ≥ 0, `estimated_days_min/max`, `is_active`, `sort_order`,
`countries TEXT[]`.

`countries` scopes a method to a set of ISO codes; **`NULL` means "offered everywhere"**, which
is what keeps pre-017 rows behaving as they did. Until migration 017 the table was flat, so
Standard shipped to Australia for the same $0.00 it charged in-state.

Seeded after 017: **Standard** $0.00, **Express** $9.99, **Overnight** $19.99 — all scoped to
`{US}` — plus **International Standard** $14.99 (8–21 days) and **International Express**
$29.99 (3–7 days) for the other seven countries. Those international prices are
**placeholders**; the migration prints a `NOTICE` telling the operator to set real rates.
Migration 012 removed a legacy non-US option.

Enforcement is server-side: [`create-checkout-session`](supabase/functions/create-checkout-session/index.ts)
rejects a method that does not cover the shipping address country, and rejects a request that
omits `shipping_method_id` while methods exist for that country — omitting it used to mean free
shipping anywhere. The storefront filters the list by country as a convenience only.

There is **no admin UI** for this table; the operator edits it in SQL. That is why the
`countries` CHECK is only a cardinality bound (an empty array would silently mean "ships
nowhere"): a regex over the elements would need `array_to_string`, which Postgres marks
`STABLE` and therefore refuses inside a CHECK.

### 12.9 Shipping countries

Defined once in [`_shared/address.ts`](supabase/functions/_shared/address.ts) and imported by
both the checkout form and the Edge Function:

`US`, `CA`, `GB`, `AU`, `DE`, `FR`, `IT`, `ES` — each with a postal-code regex validated on both
sides. Extend the array to enable more, and give the new country a shipping method
([§12.8](#128-shipping_methods)) or checkout to it is blocked.

`STATE_REQUIRED_COUNTRIES` (`US`, `CA`, `AU`) is the subset whose addresses carry an
administrative area the buyer knows and the carrier uses. Everywhere else `state` is accepted
but optional, and normalises to `''` — requiring it globally made a German or British shopper
invent a value at the most expensive point in the funnel. It is not hidden for the others,
because Italy and Spain do use a province.

### 12.10 `processed_stripe_events`

`event_id` TEXT PK (the Stripe `evt_…` id), `event_type`, `processed_at`, `order_id` (FK, SET
NULL). RLS `FOR ALL USING (false)` — no API role can read or write it; only the service role
touches it. This table is the webhook's idempotency ledger.

### 12.11 Functions and triggers

| Object | Kind | Purpose |
|---|---|---|
| `handle_new_user()` | Trigger on `auth.users` AFTER INSERT | Creates the profile row; never fails a signup |
| `set_updated_at()` | Trigger fn | Maintains `updated_at` on profiles, categories, products, addresses, orders, variants, reviews |
| `is_admin()` | SQL, STABLE, SECURITY DEFINER, pinned `search_path` | The admin predicate used throughout RLS |
| `get_my_role()` | SQL, STABLE, SECURITY DEFINER | Reads the committed role; used by the profile-update policy |
| `validate_order_status_transition()` | BEFORE UPDATE on `orders` | Rejects illegal status jumps — applies to admins and the service role too |
| `enforce_order_immutability()` | BEFORE UPDATE on `orders` | Blocks changes to financial fields, `shipping_address` and `user_id` once `paid`/`shipped`/`delivered`/`refunded` |
| `enforce_order_items_immutability()` | BEFORE INS/UPD/DEL on `order_items` | Blocks any line change once the parent order is paid — except the refund/exchange counters, which only the functions below may move |
| `manage_stock_on_status_change()` | **BEFORE** UPDATE on `orders`, SECURITY DEFINER | Deducts on first `paid`, restores on `failed`/`cancelled`/`refunded` from `paid` — line by line, moving the variant row (`variant_id`, or the recorded size for older lines) or the product counter, and only the units not already put back by a partial refund (`restocked_quantity`). Locks the products involved in id order first. Flags `needs_review = true, review_reason = 'oversold'` when a counter goes negative. **Never raises** — the customer has already been charged |
| `guard_order_status_actions()` / `log_order_changes()` | BEFORE UPDATE OF status / AFTER UPDATE on `orders` (024) | A signed-in session cannot move `processing` / `requires_action` to `paid`, `failed` or `cancelled` (HINT `use_order_action`); status, tracking and review changes are written to `order_events` |
| `sized_product_stock(product_id)` | SQL, STABLE | The derived total of a product with variants (sum of active variants, negatives as 0). Not callable through the API |
| `sync_product_rollups()` / `touch_variant_rollups()` | BEFORE INS/UPD on `products` / AFTER INS/UPD/DEL on `product_variants`, SECURITY DEFINER (022) | Keep `stock_quantity`, `price_min`, `price_max` and colour availability derived ([§12.3](#123-catalogue)) |
| `log_variant_stock()` / `log_product_stock()` | AFTER INSERT/UPDATE (and variant DELETE) triggers (023) | Write every stock change to `inventory_movements` with the reason set by the writer (`set_stock_context()`); a new product or variant logs its opening stock |
| `admin_save_product_variants(product_id, config)` | plpgsql, SECURITY DEFINER, returns JSONB (022) | Admin only. **The** write path for sizes, colours, variant prices/costs and stock: validates names, swatches and SKUs, renames without collisions, removes unlisted variants — or switches them off when an order line references them — and refuses (HINT `stock_conflict`, DETAIL = variant id) a figure that moved since the editor read it, or a taken SKU (HINT `sku_taken`) |
| `admin_set_product_inventory(...)` | plpgsql, SECURITY DEFINER (021 → wrapper since 022) | Kept so an admin app built for 021 keeps working on products without colours |
| `admin_set_variant_stock(changes, note)` / `admin_set_product_stock(id, stock, expected, note)` | plpgsql, SECURITY DEFINER | Admin only. Quick restock with the same optimistic check; the note goes to the stock history |
| `admin_catalog_costs()` / `admin_duplicate_product()` / `admin_import_products()` | plpgsql, SECURITY DEFINER (022, 026) | Costs for the editor; a hidden, SKU-less, zero-stock copy; the all-or-nothing CSV import (HINT `import_row`, DETAIL = row index) |
| `request_stock_notification(…)` | plpgsql, SECURITY DEFINER, `anon` + `authenticated` (023) | A back-in-stock request, refused with a HINT (`disabled`, `invalid_email`, `not_found`, `in_stock`, `rate_limited`) |
| `admin_low_stock()` / `admin_stock_requests()` / `admin_get_store_settings()` / `admin_update_store_settings()` | Admin only (023) | The inventory page |
| `claim_stock_notifications()` / `release_stock_notifications()` / `low_stock_digest_candidates()` / `mark_low_stock_alerted()` / `invoke_store_worker()` / `purge_stock_requests()` | Service role / pg_cron only (023) | The scheduled emails |
| `begin_order_refund()` / `complete_order_refund()` / `abandon_order_refund()` / `sync_order_refunds()` | Service role only (024) | Refund bookkeeping, idempotent on a request id; [§16.3](#163-idempotency-and-money-safety) |
| `admin_exchange_order_item()` / `admin_resolve_review()` / `admin_issue_invoices()` | Admin only (024) | Exchanges (stock moves both ways), closing a review flag with a note, invoice numbers |
| `preview_discount_code(code)` | `authenticated`, throttled (025) | What a code would do: `ok` plus the rule, or a reason (`not_found`, `expired`, …) |
| `reserve_discount(…)` / `discount_uses()` / `discount_unavailable_reason()` / `admin_discount_usage()` | Service role / admin (025) | Atomic "take one use" for the checkout function; usage figures for the admin |
| `check_pending_order_limit()` | BEFORE INS/UPD on `orders` | Max **10** open (`pending`+`processing`) orders per user |
| `check_address_limit()` | BEFORE INSERT on `addresses` | Max **20** saved addresses per user |
| `set_review_author_name()` | BEFORE INS/UPD on `product_reviews`, SECURITY DEFINER | Snapshots the reviewer's display name |
| `has_purchased(p_product_id)` | SQL, STABLE, SECURITY DEFINER | True when `auth.uid()` has a `paid`/`shipped`/`delivered` order containing the product. Gates review writes |
| `expire_stale_pending_orders()` | plpgsql, SECURITY DEFINER, returns INTEGER | Cancels `pending`/`processing` orders older than **2 hours**. Run by pg_cron; not callable through the API (020) |
| `admin_analytics()` | plpgsql, STABLE, SECURITY DEFINER, returns JSONB | Dashboard aggregates; raises `Admin access required` unless `is_admin()` |
| `set_user_role(email, role)` | plpgsql, SECURITY DEFINER, returns JSONB | The supported promote/demote path ([§13.4](#134-role-assignment)) |

**`admin_analytics()` returns:** `grossRevenue`, `partialRefunds`, `refundedTotal`, `orders24h`,
`orders7d`, `needsReview`, `statusCounts`, `bestSeller`, `revenueByDay` (last 30 days),
`revenueByStatus`, `discounts30d`, `margin30d` (revenue net of discount shares and refunded
units, cost, and how many of the units sold had a known cost), `lowStock`, `outOfStock`,
`stockRequests`. Revenue counts only `paid`, `shipped`, `delivered`.

### 12.12 The scheduled job (required)

Migration `020_stale_order_expiry_cron.sql` enables `pg_cron` and schedules two jobs (re-running
it is safe — a job name replaces the job of the same name):

| Job | Schedule | Does |
|---|---|---|
| `expire-pending-orders` | `*/15 * * * *` | `SELECT public.expire_stale_pending_orders()` |
| `purge-cron-history` | `30 3 * * 0` | Deletes `cron.job_run_details` rows older than 14 days |

It also runs the expiry once, so orders that were already stale are cancelled immediately. If the
extension cannot be enabled (a self-hosted Postgres without it), 020 prints a `WARNING` with the
manual steps instead of failing. Check the schedule and recent runs with:

```sql
SELECT jobname, schedule, active FROM cron.job;
SELECT status, return_message, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**The 1 h / 2 h relationship is load-bearing.** Stripe Checkout sessions are created with
`expires_at = now + 1 hour`; the cron only cancels orders older than 2 hours. The gap guarantees
the cron can never cancel an order whose session is still payable — the race that used to
produce paid-but-cancelled orders.

**The store's jobs (023, 025).** Four more jobs are scheduled the same way:

| Job | Schedule | Does |
|---|---|---|
| `store-worker-back-in-stock` | `*/10 * * * *` | `invoke_store_worker('back_in_stock')` — emails everyone waiting for an item that has stock again |
| `store-worker-low-stock` | `7 * * * *` | `invoke_store_worker('low_stock')` — one digest of the items that just reached their threshold |
| `purge-stock-requests` | `50 3 * * *` | Deletes requests notified more than 90 days ago (or never, after 180) and day-old rate-limit rows |
| `purge-discount-attempts` | `55 3 * * *` | Deletes day-old failed discount previews |

`invoke_store_worker()` posts to the `store-worker` function through **pg_net**, reading its
address and shared secret from **Vault** (`store_worker_url`, `store_worker_secret`); until both
exist it returns NULL and does nothing. The function needs the same secret as
`STORE_WORKER_SECRET` ([§15.5](#155-store-worker)). Check a call with
`SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;`.

### 12.13 Storage

Bucket `product-images`: public read, admin-only write, **5 MB** limit, MIME allowlist
`image/jpeg`, `image/png`, `image/webp`, `image/gif`. **SVG is deliberately excluded** — it can
carry scripts and the bucket is publicly readable.

---

## 13. Row Level Security and grants

RLS is enabled on every application table. `is_admin()` is `SECURITY DEFINER` with a pinned
`search_path`, so it cannot be hijacked.

### 13.1 Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | owner or admin | *(trigger only)* | owner (role unchangeable, via `get_my_role()`); admin any | — |
| `categories` | `is_active` or admin | admin | admin | admin |
| `products` | `is_active` or admin | admin | admin (`price ≥ 0` in WITH CHECK; 021 dropped `stock_quantity ≥ 0`, which blocked every edit of an oversold product) | admin |
| `product_images` | parent product visible | admin | admin | admin |
| `product_variants` | `is_active` | admin | admin | admin |
| `product_colors` (022) | active colour of an active product, or admin | admin | admin | admin |
| `product_variant_costs` (022) | admin | admin | admin | admin |
| `order_item_costs` (022) | nobody through the API (written by the checkout function, read by `admin_analytics()`) | — | — | — |
| `size_guides` (022) | everyone | admin | admin | admin |
| `shipping_methods` | `is_active` | admin | admin | admin |
| `addresses` | owner or admin | owner | owner | owner |
| `orders` | owner or admin | **nobody** (service role only) | owner: `pending` → `cancelled` only, financial + Stripe fields must be unchanged; admin: any (but see the 024 action guard) | — |
| `order_items` | parent order visible | **nobody** (service role only) | — | — |
| `order_events` (024) | admin | admin, `note` rows signed as themselves | — | admin, `note` rows |
| `order_refunds` (024) | admin | — (functions) | — | — |
| `inventory_movements` (023) | admin | — (triggers) | — | — |
| `store_settings` (023) | everyone, but only `id` and `back_in_stock_enabled` are granted | — | — (admin through `admin_update_store_settings()`) | — |
| `stock_notifications` (023) | admin | — (`request_stock_notification()`) | — | admin |
| `discount_codes` (025) | admin | admin | admin | admin (a used code is protected by its redemptions' `RESTRICT`) |
| `discount_redemptions` (025) | admin | — (`reserve_discount()`) | — | — |
| `product_reviews` | **everyone** (`USING (TRUE)`) | owner **and** `has_purchased()` | owner **and** `has_purchased()` | owner |
| `processed_stripe_events` | `USING (false)` — nobody | — | — | — |
| `invoice_counters`, `stock_notification_attempts`, `low_stock_alert_state`, `discount_attempts` | nobody (functions only) | — | — | — |
| `storage.objects` (`product-images`) | everyone | admin | admin | admin |

Three of these deserve their reasoning:

- **`orders` INSERT is closed to clients** (013). Orders exist only because
  `create-checkout-session` created them with the service role, which is what makes the recorded
  total trustworthy.
- **`orders` owner cancel is `pending`-only** (016). A `processing` order has an open Stripe
  session that stays payable for an hour; cancelling the row and then paying took the money for
  an order the transition guard refused to mark `paid`. Pre-payment cancels now go through
  `handle-order-action`, which expires the session first.
- **`order_items` INSERT was dropped** (002). Lines are written server-side only.

### 13.2 Column-level grants

RLS is row-level and cannot hide a column, so two things are enforced with grants instead:

```sql
-- profiles: users may only change their own display fields
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT  UPDATE (full_name, phone, avatar_url) ON public.profiles TO authenticated;

-- products: cost_price is not published to visitors (migration 016)
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT  SELECT (<every column except cost_price>) ON public.products TO anon, authenticated;
GRANT  SELECT ON public.products TO service_role;
```

The 016 column list is derived from the live table, so a project that added its own columns
keeps them readable. **Consequence:** `SELECT *` on `products` is refused for API roles — this
is why `src/lib/api.ts` names columns via `PRODUCT_COLUMNS`. It also means a column added
**after** 016 is invisible to the storefront until granted: 021 runs
`GRANT SELECT (has_sizes, size_label) ON public.products TO anon, authenticated`, 022 does the
same for `has_colors, color_label, price_min, price_max, size_guide_id`, and any future column
needs the same. `store_settings` (023) uses the same technique: the API roles may read only
`id` and `back_in_stock_enabled`, never the alert recipients.

Verify with:

```sql
select has_column_privilege('anon','public.products','cost_price','SELECT');  -- must be false
```

### 13.3 What is deliberately public

- The **anon key** — it is in the client bundle by design.
- The **Supabase project ref** — it is inside `VITE_SUPABASE_URL`.
- Active products, their images, variants and colours, size guides, active categories, active
  shipping methods, whether back-in-stock requests are on, and **all product reviews** (minus
  `user_id`). Variant prices are public; costs are not.

Everything else requires a session, and ownership is re-checked server-side.

### 13.4 Role assignment

The `role` column is not writable through the app or the API at all — that is exactly what stops
a customer promoting themselves. Use the supported function:

```sql
select public.set_user_role('you@your-domain.com', 'admin');   -- or 'customer'
```

Authorisation is an **allowlist** (migration 015 — 014 authorised by elimination, so any context
without a JWT claim fell through to the allowed path):

1. a direct database session (SQL Editor, psql, migrations, pg_cron) — this is how the first
   admin is bootstrapped; or
2. `jwt_role = 'service_role'`; or
3. an existing admin via the API.

Everything else is refused with `42501`. `EXECUTE` is revoked from `anon`. The function also
refuses to demote the **last** admin, so you cannot lock yourself out.

It uses `session_user`, not `current_user`: inside a `SECURITY DEFINER` function `current_user`
is the function owner and is useless for authorisation, while `session_user` is the role the
connection authenticated as and is unaffected by `SET ROLE`.

---

## 14. Migration history

Run `schema.sql` → `rls.sql` → migrations `001`…`026` in numeric order → optionally
`seeds/002_mock_products.sql`. Already-migrated database? Run whatever is newer than your last
one, then `NOTIFY pgrst, 'reload schema';`

**Re-running older files** is not supported, but the repair rules are: after any older file, run
019; after `005`, `007`, `013` or `021`, run `021` → `022` → `024` → `026`; after `003`, run
`024`. `004` and `013` stop with an error once 022 is in (their sizes target the uniqueness rule
022 replaced) and never need to be re-run.

| # | File | What it does |
|---|---|---|
| 001 | `fixes.sql` | Rebuilds the `order_status` enum; adds the transition guard; moves stock deduction from "item inserted" to "order paid"; adds `stripe_session_id`; `order_items` integrity CHECKs; indexes |
| 002 | `rls_hardening.sql` | Pins `is_admin()`; rebuilds order policies; **drops customer INSERT on `order_items`**; closes the profile self-promotion gap via `get_my_role()` |
| 003 | `payment_hardening.sql` | `processed_stripe_events` (idempotency); order + line immutability after payment; pending-order limit (3); `expire_stale_pending_orders()` |
| 004 | `variants_reviews_shipping.sql` | `product_variants`, `order_items.selected_size`, `shipping_methods`, `orders.shipping_method_*`, `product_reviews` + their RLS |
| 005 | `admin_tracking_refunds.sql` | `tracking_id`, `tracking_updated_at`, `refund_id`, `refund_amount`, `refunded_at` |
| 006 | `remove_order_limit.sql` | Drops the pending-order limit (later reversed by 013) |
| 007 | `refund_status.sql` | Adds `refunded` to the enum; extends the transition guard, immutability and stock rules to cover refunds |
| 008 | `refund_id_unique.sql` | UNIQUE + index on `refund_id` — prevents duplicate refunds |
| 009 | `delivered_at.sql` | `orders.delivered_at` |
| 010 | `reviews_verified_purchase.sql` | `has_purchased()`; reviews now require an actual purchase |
| 011 | `product_storage.sql` | `product-images` bucket + policies |
| 012 | `us_shipping_cleanup.sql` | Removes a legacy non-US shipping method |
| 013 | `payment_reliability.sql` | **Large.** Backorder policy (`needs_review`, negative stock allowed, stock trigger rewritten as BEFORE UPDATE, variant stock handled); pending limit back at 10; clients can no longer INSERT orders; profile column lockdown; `author_name` snapshot; bucket size/MIME limits; **drops the DB cart**; `admin_analytics()` RPC |
| 014 | `role_management.sql` | Failure-proof `handle_new_user()`; profile backfill; `set_user_role()`; grants |
| 015 | `set_user_role_deny_by_default.sql` | 🔒 Turns `set_user_role()` from authorise-by-elimination into an allowlist |
| 016 | `abuse_limits_and_indexes.sql` | 🔒 Address/review/profile/shipping-address length caps; 20-address cap; cancel window narrowed to `pending`; **`cost_price` revoked from API roles**; trigram + partial search indexes |
| 017 | `international_shipping.sql` | `shipping_methods.countries` (NULL = everywhere) + US/international seed; `orders.refund_requested_by` (keeps admin refunds out of the customer's rate limit); `orders.tracking_id` length cap |
| 018 | `refund_attribution_fk.sql` | `orders.refund_requested_by` gets `ON DELETE SET NULL` (017 left it `NO ACTION`, which blocked deleting any operator who had issued a refund); documents the `profiles` embed ambiguity 017 introduced |
| 019 | `reconcile_reverted_fixes.sql` | Idempotent repair: drops the insert-time stock triggers an old `schema.sql` re-creates (every paid order deducted stock twice) and restores 010's verified-purchase review policies that re-running `004` reverts. Re-run it after re-running any older file |
| 020 | `stale_order_expiry_cron.sql` | Enables `pg_cron` and schedules `expire-pending-orders` (every 15 min) + a weekly purge of the job history; `expire_stale_pending_orders()` becomes SECURITY DEFINER and is no longer callable through the API; runs it once |
| 021 | `product_sizes.sql` | **Sized products.** `products.has_sizes` / `size_label` (granted to the API roles); derived stock for sized products (two triggers); `order_items.variant_id` (+ backfill of historical lines); stock trigger rewritten (per-line restore — the old one restored one line per product — and product locks in id order); `products: admin update` no longer requires `stock_quantity ≥ 0`; admin RPCs `admin_set_product_inventory` / `admin_set_variant_stock`; size/SKU constraints; existing products with sizes switched to per-size stock. Re-run it after re-running 005, 007 or 013 (they redefine the stock trigger) |
| 022 | `catalog_variants.sql` | **Colours and variant prices.** `product_colors`; `products.has_colors` / `color_label` / `price_min` / `price_max` / `size_guide_id`; `product_variants.color_id` / `price`, nullable `size`, uniqueness per product × colour × size; `product_images.color_id`; `size_guides` (+ `categories.size_guide_id`); private `product_variant_costs` and `order_item_costs`; `order_items.selected_color` / `sku`; derived rollups (stock, price range, colour availability); `admin_save_product_variants()` (021's RPC becomes a wrapper), `admin_set_product_stock()`, `admin_catalog_costs()`, `admin_duplicate_product()`, `admin_import_products()` |
| 023 | `inventory_and_alerts.sql` | `inventory_movements` + logging triggers; `store_settings`; low-stock list and digest state; back-in-stock requests (`request_stock_notification()`, rate-limited) and the worker's claim/release functions; `pg_net` + `invoke_store_worker()` (Vault) and three cron jobs |
| 024 | `order_operations.sql` | `order_events` (timeline, notes) + triggers; `order_refunds` and the refund functions (partial, line by line, idempotent; Stripe-side refunds mirrored); `order_items.refunded_quantity` / `restocked_quantity` / `discount_amount`; final stock trigger; exchanges; invoice numbers; the status action guard; `admin_analytics()` v2; backfill of historical refunds. Re-run it after 003, 005, 007, 013 or 021 |
| 025 | `discount_codes.sql` | `discount_codes`, `discount_redemptions`, `discount_attempts`, `orders.discount_id`; `preview_discount_code()` (throttled), `reserve_discount()` (atomic), usage figures; a daily purge job |
| 026 | `import_keeps_variants.sql` | `admin_import_products()` leaves a product's variants alone when the file has no size or colour column |

> **`orders` references `profiles` twice** (`user_id` and, since 017, `refund_requested_by`), so a
> bare `profiles(...)` embed is rejected by PostgREST with
> `PGRST201 — more than one relationship was found for 'orders' and 'profiles'`. Every embed must
> name the relationship: `profiles!orders_user_id_fkey(...)`. The client-side constant is
> `ORDER_CUSTOMER_EMBED` in [`src/lib/api.ts`](src/lib/api.ts).

> **015 and 016 are security migrations, not optional polish.** A database left at 014 has three
> gaps: role escalation from any GUC-less execution context, unbounded writes from any registered
> account, and a full margin dump readable by every visitor.

Verification queries for 015/016 are in
[`supabase/SETUP_CHECKLIST.md`](supabase/SETUP_CHECKLIST.md). If 016 reports a `WARNING` about a
constraint it could not validate, some pre-existing row exceeds the new cap: the cap is already
enforced for new and updated rows — find and shorten the offending rows, then run the
`VALIDATE CONSTRAINT` statement the warning printed.

---

## 15. Edge Functions

Deno runtime, deployed with the Supabase CLI. Shared code lives in `_shared/` and is bundled
into each function at deploy time.

### 15.1 `create-checkout-session`

**Purpose:** turn a cart into a database order plus a Stripe Checkout session.
**Auth:** own JWT verification (`supabaseAnon.auth.getUser(token)`). **CORS:** required and
fail-closed. **Method:** POST (+ OPTIONS).

**Request**

```jsonc
{
  "items": [{ "product_id": "uuid", "quantity": 2, "variant_id": "uuid" }],
  "shipping_address": { "full_name": "", "line1": "", "line2": null,
                        "city": "", "state": "", "postal_code": "",
                        "country": "US", "phone": null },
  "shipping_method_id": "uuid",
  "discount_code": "SPRING10"          // optional
}
```

(A line may still carry the pre-022 `"selected_size": "M"` instead of `variant_id`; it is
resolved to the size row without a colour.)

**Response:** `{ "url": "https://checkout.stripe.com/…" }` — the client redirects there.

**Pipeline**

1. Validate that all required secrets are present.
2. **Resolve the origin.** `resolveAllowedOrigin(origin)` must return a value; the Stripe
   `success_url` / `cancel_url` are built from it and **never** from the request body — otherwise
   a forged request could bounce the buyer to an attacker-controlled site.
3. Verify the JWT.
4. Validate `items` (non-empty, ≤ 50 lines, UUID product and variant ids, string sizes ≤ 40
   chars) and merge duplicates — see step 7. The line logic lives in the pure module
   [`_shared/checkout-lines.ts`](supabase/functions/_shared/checkout-lines.ts), unit-tested from
   Vitest.
5. **Sanitise the address** with `sanitizeAddress()` — type-checked strings, control characters
   stripped, per-field caps, country allowlist, postal pattern re-checked, and a return value
   containing only the eight known keys so unknown ones are dropped. This is not cosmetic: a
   presence check accepted `String({})` → `"[object Object]"` as a real address, and let orders
   through for countries the store does not ship to.
6. **Rate limit:** ≤ 10 orders per user per rolling hour (the DB pending-order trigger is the
   backstop and surfaces as `P0001` → `429 RATE_LIMITED`).
7. **Merge duplicate lines** by `(product_id, variant_id)` (or the legacy size) **before**
   validating. Checking each line independently let 50 separate lines of one product each pass
   the stock cap and oversell by 50×.
8. Load products, their active variants and colours, and costs from the DB (service role) and
   validate: exists, active, quantity ≤ 100, product-level stock against the **combined**
   quantity across variants, and the variant rules — a product with sizes or colours
   **requires** a variant (`400 VARIANT_REQUIRED` / `SIZE_REQUIRED`; the selector lives in the
   browser and used to be bypassable), one without refuses it (`400 SIZE_NOT_APPLICABLE`), and
   the variant must be **active** and have stock (`409 VARIANT_NOT_FOUND` /
   `INSUFFICIENT_STOCK`). Each line takes its **unit price from the variant** (or the product),
   records the variant in `order_items.variant_id` and snapshots its colour, size and SKU.
9. Resolve shipping cost from `shipping_methods` — never from the client — and check the
   method's `countries` against the address. Omitting `shipping_method_id` while a method
   exists for that country is now a `400 SHIPPING_METHOD_REQUIRED`: it used to mean free
   shipping to anywhere, which only a hand-written request ever took advantage of.
10. **Discount code** (optional): load the code, check it is usable (window, limits, minimum,
    scope) and compute the discount with
    [`_shared/discounts.ts`](supabase/functions/_shared/discounts.ts) — the module the checkout
    page previews with — allocating it across the lines (and shipping, for free shipping) in
    integer cents. A refusal is `400`/`409 DISCOUNT_<REASON>` (`DISCOUNT_EXPIRED`,
    `DISCOUNT_MIN_SUBTOTAL`, …). A discounted order must still be at least 0.50 to charge
    (`400 CHECKOUT_TOTAL_TOO_LOW`).
11. Compute `subtotal`, `discount`, `tax` (on the discounted base) and `total` server-side.
12. Insert the `orders` row (`pending`, with `discount_code` / `discount_id` /
    `shipping_discount`), then `order_items` (with each line's discount share) and
    `order_item_costs`. If the lines fail, the order is deleted (best-effort rollback) so no
    orphan order remains. Then `reserve_discount()` takes one use of the code atomically; if
    the code ran out meanwhile, the order is deleted and the request refused.
13. Build Stripe line items from DB-resolved data (the colour and size in the name); append
    shipping, and — in flat-rate mode — an explicit **"Estimated sales tax"** line so the charge
    equals the recorded total. A discount becomes a **one-off Stripe coupon** for exactly the
    computed amount (`max_redemptions: 1`, `redeem_by` = session expiry + 10 min), attached to
    the session, so the hosted page shows it and the charge equals the order.
14. Create the session (`expires_at = now + 1 h`, `client_reference_id` and metadata carrying
    `order_id`/`user_id` on both the session and the payment intent). If Stripe fails, the order
    is marked `failed` (which gives the discount use back).
15. Write `stripe_session_id` and move the order to `processing`; return the URL.

With Stripe Tax on, the function first creates a Stripe customer carrying the shipping address
(so the buyer does not retype it) and sets `customer_update: { address: 'auto' }`.

**Payment methods are not pinned.** The session deliberately omits `payment_method_types`:
Checkout Sessions use dynamic payment methods by default, showing what is enabled in the Stripe
Dashboard filtered by amount, currency and buyer country. Passing `['card']` was an override
that switched that off, so a Dutch or German buyer never saw iDEAL, Bancontact or Klarna.
(`automatic_payment_methods` is a PaymentIntent parameter and is **not** valid here.) Note the
currency coupling: the local European methods are EUR-only, so they appear only once
`STORE_CURRENCY` is `'EUR'`.

### 15.2 `stripe-webhook`

**Purpose:** the authoritative order-state updater. **Auth:** Stripe signature only —
`verify_jwt = false` is mandatory. **CORS:** none (not browser-facing).

**Events handled:** `checkout.session.completed`, `payment_intent.succeeded`,
`payment_intent.payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.updated`.
Unhandled types are recorded and ACKed.

**Pipeline**

1. Verify the signature with `constructEventAsync`; missing or invalid → `400`.
2. **Claim the event first** — insert into `processed_stripe_events` with
   `ignoreDuplicates`. Insert-first (rather than check-then-insert) means two concurrent
   deliveries cannot both process the same event. Zero rows back → respond
   `{ received: true, duplicate: true }`.
3. Map the event to a plain summary and load the current order state.
4. Ask [`_shared/webhook-logic.ts`](supabase/functions/_shared/webhook-logic.ts) for a decision:
   `skip`, `invalid`, `update`, or — for `charge.refunded` / `refund.updated` — `sync_refunds`.
5. Apply the update; optionally fire the confirmation email (fire-and-forget — a Resend hiccup
   must not fail the webhook). **`sync_refunds`** retrieves the PaymentIntent and lists all its
   refunds, then hands them to `sync_order_refunds()`: every refund — including ones issued in
   the Stripe Dashboard — becomes a row of `order_refunds` (`source = 'stripe'` when the app did
   not start it), `refund_amount` becomes the total, a full refund moves the order to `refunded`,
   and a failed refund flags the order for review.
6. Record the affected `order_id` on the processed-event row for debugging.

**Failure handling — the distinction that matters**

| Kind | Detection | Response |
|---|---|---|
| **Business-rule rejection** (transition guard, immutability trigger, CHECK) | Postgres code `P0001`, `23*`, or a message matching *"Invalid order status transition"* / *"immutable"* | The order is parked (`needs_review` + reason) and the webhook **ACKs 200**. Retrying the identical event can never succeed, and the money was already taken |
| **Transient failure** (network, Supabase 5xx, order not visible yet) | anything else | The idempotency claim is **released** and the webhook returns 500 so Stripe retries. Without the release, the retry would be swallowed as a duplicate |

**Decision logic (`_shared/webhook-logic.ts`)** is deliberately dependency-free — no Deno, Stripe
or Supabase imports — so the whole transition matrix is unit-testable from Vitest. Invariants:

- A paid order is **never** downgraded by a late failure or expiry event
  (`FINAL_STATUSES = paid, shipped, delivered, refunded`).
- Partial refunds keep the order `paid`; only refunds covering the total move it to
  `refunded` (decided in the database by `sync_order_refunds()`, from Stripe's own total).
- **Amount reconciliation before adoption.** Both paid-marking events compare what Stripe charged
  against the total recorded at session creation, in **integer cents** with a 1-cent tolerance
  (doing it in dollars makes the tolerance itself unreliable — `100.01 - 100` is
  `0.010000000000005` in IEEE-754). On mismatch the order is held in `requires_action`, flagged
  `needs_review`, the confirmation email is suppressed, the recorded total is left untouched, and
  a loud error is logged — an underpayment can never silently rewrite the total to match itself.
  Under Stripe Tax the comparison subtracts `total_details.amount_tax`;
  `payment_intent.succeeded` carries no tax breakdown, so there it asserts only that Stripe never
  collected *less* than recorded.

### 15.3 `handle-order-action`

**Purpose:** cancellations, refunds (all or part), payment checks and delivery.
**Auth:** own JWT verification, then per-action authorisation. **CORS:** fail-closed.

**Request:** `{ "action": "cancel" | "refund" | "deliver" | "sync_payment" | "confirm_payment",
"order_id": "uuid", … }` — a refund may add `request_id` (UUID), `amount`, `lines`
(`[{ order_item_id, quantity, restock }]`), `shipping_amount` and `reason`.
**Response:** `{ "order": { …with order_items and profile… } }` (`sync_payment` adds
`stripe_status`).

**Authorisation order is deliberate.** The admin check for every action except `cancel` needs
no order at all, so it runs **before** the lookup — a non-admin is turned away without learning
whether the id exists. Ownership for `cancel` (the buyer, or an admin) is checked immediately
after the fetch and answers a uniform `404`, not `403`.

| Action | Who | Behaviour |
|---|---|---|
| `cancel` (pre-payment: `pending`/`processing`/`requires_action`) | order owner or admin | Retrieves the Stripe session; **refuses** with `409 ORDER_ALREADY_PAID` if payment completed; expires an open session; then updates with the pre-payment status re-asserted in the `WHERE` so it cannot race the webhook |
| `cancel` (`paid`) | order owner or admin | Refunds everything that is left (goods back on the shelf), order → `refunded`, refund email. A buyer is rate limited to **3 self-refunds per rolling 24 h**, counted via `refund_requested_by`. The request id is derived from the order id, so a double click is one refund |
| `refund` | admin | Lines and quantities (each with or without restock), shipping, an amount and a reason — or, with none of those, everything left. Repeatable until nothing is left; the database caps every refund at the remainder (`400 AMOUNT_TOO_HIGH`, …). **Only refunds covering the total** move the order to `refunded`; a partial refund leaves it fulfillable and puts back in stock exactly the units marked restock |
| `deliver` | admin | `shipped` → `delivered`, sets `delivered_at`, sends the delivery email |
| `sync_payment` | admin | For an order still waiting for payment: retrieves its Checkout session and applies what Stripe says exactly as the webhook would have (paid / expired), logging a `payment` event. `stripe_status` is `open`, `complete`, `expired`, or `settled` when the order was no longer waiting |
| `confirm_payment` | admin | For a `requires_action` order held after an amount mismatch: if Stripe says the PaymentIntent **succeeded**, the order becomes `paid` with the amount actually charged as its total, the review flag is cleared and the confirmation email is sent |

**How a refund is made (idempotent end to end).** `begin_order_refund()` records the request
under its `request_id` (or returns the existing one — a retry never refunds twice) after the
database has checked status, amounts and lines; the function then creates the Stripe refund
with idempotency key `refund_<request_id>` and metadata `refund_request_id`;
`complete_order_refund()` applies it (refunded/restocked counters, stock, status, timeline). If
Stripe refuses, `abandon_order_refund()` drops the record. The webhook's `sync_order_refunds()`
later sees the same refund and recognises it by that metadata.

### 15.4 `update-tracking`

**Purpose:** record a tracking number and notify the customer.
**Auth:** gateway JWT (`verify_jwt = true`) **plus** an in-function admin role check.
**CORS:** fail-closed.

**Request:** `{ "orderId": "…", "trackingId": "…" }`

Sets `tracking_id`, `tracking_updated_at` and `status: 'shipped'`. **The status is never taken
from the client** — adding tracking *means* the order shipped, and an arbitrary client status
could corrupt the lifecycle. The shipping email is fire-and-forget: the order is already
committed as shipped, so a Resend failure must not turn the response into an error (the admin
would retry and hit a confusing `shipped → shipped` no-op).

**This is the only route that ships an order.** The admin status dropdown deliberately offers
no transition out of `paid` ([`AdminOrdersPage.tsx`](src/features/admin/pages/AdminOrdersPage.tsx)):
it writes to PostgREST directly, so `paid → shipped` there marked the order shipped with no
tracking number and **no email to the customer** — and because the tracking field only accepted
a `paid` order, it could then never be filled in. The field now accepts `paid` **and**
`shipped`, so a wrong number can be corrected (the transition guard treats `shipped → shipped`
as a no-op, and the customer gets the corrected number).

The update asserts `status IN ('paid','shipped')` in the `WHERE` clause rather than reading the
row first, so it cannot race the webhook. No matching row is disambiguated on the error path
only: `404 ORDER_NOT_FOUND` if the id does not exist, `409 ORDER_NOT_SHIPPABLE` if it does.

### 15.5 `store-worker`

**Purpose:** the store's scheduled emails. **Auth:** the shared `x-worker-secret` header
(pg_cron through pg_net; constant-time compare with `STORE_WORKER_SECRET`, which must be at least
16 characters) **or** an admin's session (the "Send now" / "Check and send now" buttons).
`verify_jwt = false`. **CORS:** fail-closed for browser callers.

**Request:** `{ "task": "back_in_stock" | "low_stock" | "all" }` (no body = `all`).
**Response:** `{ task, backInStock?: { sent, failed }, lowStock?: { items, sent, skipped? } }`.

| Task | Does |
|---|---|
| `back_in_stock` | Claims waiting requests whose item has stock again (`claim_stock_notifications()`, batches of 50, `FOR UPDATE SKIP LOCKED`), emails each customer in the language they browsed in (en/it/es/fr) with a link to the product, and releases the ones whose email failed so the next run retries them |
| `low_stock` | Reads `low_stock_digest_candidates()` — off when disabled, recipients = Admin → Inventory → Alerts or every admin — and sends one digest of the items that just reached their threshold; `mark_low_stock_alerted()` runs only once someone actually got it, so a failed send is retried. `skipped` is `disabled` or `no_recipients` |

Runs stay under a 40-second budget; whatever is left waits for the next run. Links use
`SITE_URL`, else the first `ALLOWED_ORIGINS` entry.

### 15.6 Shared modules

| Module | Exports | Notes |
|---|---|---|
| [`_shared/checkout-lines.ts`](supabase/functions/_shared/checkout-lines.ts) | `mergeItems`, `productIdsNeedingVariants`, `resolveLines` | Pure: cart lines → priced, stock-checked order lines (variant, colour, SKU, unit cost). Unit-tested |
| [`_shared/discounts.ts`](supabase/functions/_shared/discounts.ts) | `computeDiscount`, `normalizeDiscountCode`, `DISCOUNT_CODE_PATTERN` | **Imported by the storefront too.** Integer-cent arithmetic; the checkout page's preview and the charge cannot disagree. Unit-tested |
| [`_shared/refunds.ts`](supabase/functions/_shared/refunds.ts) | `refundRemaining`, `refundableUnits`, `shippingPaid`, `suggestRefund` | **Imported by the admin too.** Unit-tested |
| [`_shared/order-emails.ts`](supabase/functions/_shared/order-emails.ts) | `sendOrderConfirmationEmail`, `sendRefundEmail` | Shared by the webhook and the order actions (colour/size per line, discount, partial refunds) |
| [`_shared/cors.ts`](supabase/functions/_shared/cors.ts) | `resolveAllowedOrigin`, `isForbiddenOrigin`, `getCorsHeaders` | See [§6.1](#61-cors-on-the-edge-functions) |
| [`_shared/address.ts`](supabase/functions/_shared/address.ts) | `SHIPPING_COUNTRIES`, `POSTAL_PATTERNS`, `isValidPostalCode`, `STATE_REQUIRED_COUNTRIES`, `isStateRequired`, `ADDRESS_MAX_LENGTHS`, `sanitizeAddress` | **Imported by the React checkout form too** — kept free of Deno and browser APIs so both runtimes can load it. The caps mirror migration 016's CHECK constraints; change one, change the other |
| [`_shared/money.ts`](supabase/functions/_shared/money.ts) | `STORE_CURRENCY`, `STRIPE_CURRENCY`, `formatMoneyIn` | **Imported by the storefront too.** The one definition of what the store charges in — a literal, not a secret, precisely so Stripe, the UI and the emails cannot disagree |
| [`_shared/store.ts`](supabase/functions/_shared/store.ts) | `STORE_NAME`, `SUPPORT_EMAIL`, `FROM_EMAIL`, `STORE_LOCALE`, `BRAND_COLOR`, `escapeHtml`, `formatMoney`, `renderEmail` | Edge Functions cannot import `storeConfig.ts`, so email branding comes from secrets. Re-exports `STORE_CURRENCY` from `money.ts`; `STORE_LOCALE` stays a secret because formatting is a property of the reader, not of the money |
| [`_shared/email.ts`](supabase/functions/_shared/email.ts) | `sendEmail` | POSTs to Resend; no API key → warn and skip |
| [`_shared/webhook-logic.ts`](supabase/functions/_shared/webhook-logic.ts) | `decide`, `reconcileAmount`, `FINAL_STATUSES`, `PRE_PAYMENT_STATUSES`, `dollars`, `AMOUNT_TOLERANCE_CENTS` | Pure; unit-tested |

---

## 16. Payments: end-to-end flow

### 16.1 The happy path

```text
Customer                Frontend              Edge Function            Stripe             Postgres
   │  fills address        │                        │                    │                   │
   │  clicks Pay ─────────►│                        │                    │                   │
   │                       │ POST create-checkout-  │                    │                   │
   │                       │ session (JWT+apikey) ─►│                    │                   │
   │                       │                        │ validate origin,   │                   │
   │                       │                        │ JWT, address,      │                   │
   │                       │                        │ merge lines,       │                   │
   │                       │                        │ resolve prices, discount ─────────────►│
   │                       │                        │ insert order(pending) + items,         │
   │                       │                        │ reserve discount use ─────────────────►│
   │                       │                        │ (coupon +) session►│                   │
   │                       │                        │ order → processing ───────────────────►│
   │                       │◄── { url } ────────────│                    │                   │
   │◄─ redirect ───────────│                        │                    │                   │
   │  pays on Stripe ─────────────────────────────────────────────────► │                   │
   │                                                 checkout.session.completed (signed)     │
   │                                                │◄───────────────────│                   │
   │                                                │ claim event, reconcile amount,         │
   │                                                │ order → paid, adopt total ────────────►│
   │                                                │                    │  stock trigger    │
   │                                                │ confirmation email │                   │
   │◄─ redirect to /checkout/success?session_id=…                        │                   │
   │   page polls orders by stripe_session_id (retry ×4, backoff) ─────────────────────────►│
   │   order found → cart cleared exactly once                                               │
```

### 16.2 Why the cart is cleared late

The success page waits for the webhook-created order row before clearing the cart. If the
webhook is slow, the customer keeps their cart instead of losing it while the order is
uncertain, and the page shows "Payment received" rather than a false confirmation.

### 16.3 Idempotency and money safety

| Risk | Control |
|---|---|
| Duplicate webhook delivery | `processed_stripe_events` claim-first insert |
| Concurrent or repeated refund requests | One `order_refunds` row per client request id (`begin_order_refund()` returns the existing one), Stripe idempotency key `refund_<request_id>`, and every refund capped by the database at what is left |
| Refunds made in the Stripe Dashboard | `sync_order_refunds()` mirrors every refund of the PaymentIntent from Stripe's own list, matching the app's by metadata |
| Client-supplied prices and discounts | Everything re-read from the DB server-side; the discount is recomputed from the code's row and charged as a single-use coupon for exactly that amount |
| A limited code used too often | `reserve_discount()` locks the code row while it counts uses |
| Underpayment / drift | Cent-exact reconciliation before adopting Stripe's figure |
| Order edited after payment | Immutability triggers on `orders` and `order_items` |
| Illegal status jumps | `validate_order_status_transition()` — applies to admins and service role |
| Cancel-then-pay race | Cancel expires the Stripe session first and re-asserts the status in the `WHERE` |
| Stale abandoned orders | `expire_stale_pending_orders()` at 2 h, safely after the 1 h session TTL |

### 16.4 Sales tax

Two modes, chosen by Edge Function secrets:

| | **Flat estimate (default)** | **Stripe Tax (recommended for US compliance)** |
|---|---|---|
| Secrets | `STRIPE_TAX_ENABLED=false`, `TAX_RATE=0.07` | `STRIPE_TAX_ENABLED=true`, `TAX_RATE=0` |
| Frontend | `VITE_TAX_RATE` = same fraction | `VITE_TAX_RATE=0` |
| How it is charged | Explicit **"Estimated sales tax"** line item, so the Stripe charge equals the recorded `order.total` | `automatic_tax` on; Stripe computes per-jurisdiction tax and the webhook writes the authoritative `tax_amount`/`total` back |
| Prerequisite | none | Stripe Tax enabled in the dashboard (origin address registered, product tax codes set) — otherwise checkout errors |

> `STRIPE_TAX_ENABLED` **must be identical on `create-checkout-session` and `stripe-webhook`.**
> A mismatch parks every paid order for review — fail-safe, but noisy.

Default `TAX_RATE` is `0`: a fresh install charges no tax until the operator opts in.

---

## 17. Order lifecycle and stock

### 17.1 Status machine

```text
                 ┌──────────────► failed (terminal)
                 │
  pending ───► processing ───► requires_action ───► paid ───► shipped ───► delivered
     │             │                  │              │          │             │
     │             │                  │              │          │             │
     └─────────────┴──────────────────┴──► cancelled │          │             │
                                          (terminal) └──────────┴─────────────┴──► refunded
```

Enforced by `validate_order_status_transition()`:

| From | Allowed to |
|---|---|
| `pending` | `processing`, `requires_action`, `paid`, `failed`, `cancelled` |
| `processing` | `requires_action`, `paid`, `failed`, `cancelled` |
| `requires_action` | `paid`, `failed`, `cancelled` |
| `paid` | `shipped`, `cancelled`, `refunded` |
| `shipped` | `delivered`, `refunded` |
| `delivered` | `refunded` |
| `failed`, `cancelled`, `refunded` | *(terminal)* |

Who moves what:

| Transition | Actor |
|---|---|
| → `pending` | `create-checkout-session` (order insert) |
| `pending` → `processing` | `create-checkout-session` after the Stripe session exists |
| → `paid` / `requires_action` / `failed` / `cancelled` (expiry) | `stripe-webhook` |
| `pending` → `cancelled` | customer, via RLS **or** `handle-order-action` |
| `processing`/`requires_action` → `cancelled` | `handle-order-action` only (it expires the session first) |
| `processing`/`requires_action` → `paid` / `failed` | `stripe-webhook`, or `handle-order-action` (`sync_payment`, `confirm_payment`) |
| `paid`/`shipped`/`delivered` → `refunded` | customer self-cancel, admin refunds covering the total, or refund webhooks |
| `paid` → `shipped` | `update-tracking` |
| `shipped` → `delivered` | `handle-order-action` (`deliver`) |
| Any other legal jump | admin, via the Orders page — the guard still applies |

Since 024 a signed-in session (any user, admins included) can no longer move a `processing` or
`requires_action` order to `paid`, `failed` or `cancelled` by writing the row: Stripe has to be
asked first, which only the order actions do (`orders_action_guard`, HINT `use_order_action`).
The service role and pg_cron are unaffected.

### 17.2 Stock rules

- **Deducted only on the first transition to `paid`**, from a pre-payment status. A line with a
  variant decrements its variant row (`product_variants.stock_qty`) and the product total
  follows automatically (derived, migrations 021/022); a line without one decrements
  `products.stock_quantity`.
- **Restored** on `paid` → `failed` / `cancelled` / `refunded`, line by line (an order with two
  sizes of the same product gets both back) — minus whatever a partial refund already put back
  (`restocked_quantity`). A full refund of a shipped or delivered order puts nothing back: the
  goods are with the customer.
- **Partial refunds and returns** put back exactly the units the admin marked "restock";
  **exchanges** (`admin_exchange_order_item()`) take the new variant and, optionally, put the
  returned one back, in one transaction. Each line can never be refunded or restocked beyond
  its quantity.
- **Every change is logged** in `inventory_movements` with its reason, order, actor and note
  ([§12.6b](#126b-order-operations-inventory-and-discounts-022025)).
- **One writer at a time per product.** The order trigger and the admin stock functions lock
  the product rows first, in id order, so concurrent orders and restocks queue instead of
  deadlocking.
- **The admin never overwrites a moved figure.** Every stock write from the admin carries the
  figure it replaces; if a paid order changed it meanwhile, nothing is written and the editor
  shows the current one (`StockConflictError`).
- **Negative stock is legal.** The `>= 0` constraints were dropped on purpose: the negative
  number *is* the backorder depth.
- **Paid orders are always honoured.** The trigger never raises — an exception here used to make
  the webhook fail forever on a paid-but-oversold order (money taken, order stuck).
- Oversell flags the order: `needs_review = true`, `review_reason = 'oversold'`. Flagged orders
  get a red **Needs review** badge in Admin → Orders (with a dedicated filter) and a counter on
  the dashboard.

Clearing a flag after handling it: **Mark as resolved** in the order (with an optional note —
`admin_resolve_review()`, logged in the timeline), or in SQL:

```sql
UPDATE public.orders SET needs_review = false, review_reason = null WHERE id = '<order-id>';
```

### 17.3 `needs_review` reasons

| Reason | Set by | Meaning |
|---|---|---|
| `oversold` | stock trigger | A counter went negative — restock or contact the customer |
| `amount mismatch: …` | webhook reconciliation | Stripe charged something other than the recorded total. Order held in `requires_action`, no confirmation email. Investigate and refund if needed |
| `<event>: <db error>` | webhook business-rule park | A Stripe event was rejected by a DB rule (e.g. paid event arriving after cancellation) |
| `refund failed: <ids>` | `sync_order_refunds()` | Stripe reports a refund as failed or cancelled — the money did not go back; issue it again or contact the customer |

---

## 18. Transactional email

| Email | Sent by | Trigger |
|---|---|---|
| Order confirmation | `stripe-webhook` (or `handle-order-action` when a payment is recovered or confirmed) | Order reaches `paid` (suppressed when held for review); lists colour/size and the discount |
| Shipping + tracking | `update-tracking` | Admin adds a tracking number |
| Refund confirmation | `handle-order-action` | Customer self-cancel of a paid order, or admin refund (says "partial" for a partial one) |
| Delivery confirmation | `handle-order-action` | Admin marks an order delivered |
| Back in stock | `store-worker` | An item someone asked about has stock again (in the customer's language) |
| Low-stock digest | `store-worker` | Items just reached their threshold (to the alert recipients, in `STORE_LOCALE`'s language) |
| Sign-up / password reset / magic link | **Supabase Auth** | Customised in Supabase → Authentication → Email Templates |

All code-sent emails go through `sendEmail()` → Resend, are **English** (except the two
`store-worker` emails, which carry en/it/es/fr copy), and are wrapped by `renderEmail()`
(coloured header with the store name, body, footer). Every user-supplied value
passes through `escapeHtml()` before being embedded. Money is formatted with `STORE_CURRENCY` +
`STORE_LOCALE`.

Every send is **fire-and-forget**: the state change is already committed, so a Resend failure is
logged and never turns a successful operation into an error response.

Branding comes from secrets, not from `storeConfig.ts`, because Edge Functions run in Deno and
cannot import frontend modules. Without a `RESEND_FROM_EMAIL` on a domain verified in Resend,
mail sends from a non-existent address and fails SPF/DKIM.

---

## 19. Admin console

Reachable at `/admin` for accounts whose `profiles.role = 'admin'`. Once promoted, an **Admin**
entry appears in the site header, the mobile menu and the profile page (reload after the role
change so the app picks it up). See [§13.4](#134-role-assignment) for promotion.

| Page | Capabilities |
|---|---|
| **Dashboard** (`/admin`) | Revenue chart (7/30 days with period-over-period delta), gross revenue, orders in 24 h / 7 d, `needs_review` counter, status breakdown, best seller, recent orders, and a stock & promotions strip (out of stock, running low, restock requests, discounts given). One `admin_analytics()` RPC call |
| **Orders** (`/admin/orders`) | Paginated queue (50/page), filter by status, "needs review" and dates; select orders to print packing slips or invoices (`/admin/print`) or export orders / order lines as CSV. The order panel: items with colour/size, SKU, discount share and refunded units; status changes constrained to legal transitions; tracking (→ `update-tracking`); mark delivered; for a waiting payment **Check with Stripe**, **Confirm payment**, **Cancel order**; **Refund** line by line (with restock and shipping, repeatable); **Exchange** a line to another variant; resolve a review flag with a note; the timeline with internal notes |
| **Catalogue** (`/admin/catalog`) | Active/archive tabs, search (also by variant SKU), inline stock edit, per-variant stock chips (grouped by colour) with low/sold-out tones and a **Restock** row, price range and compare-at price, **Duplicate**, **Import CSV** / **Export CSV**, create/edit product drawer, create category inline, toggle active/featured |
| **Inventory** (`/admin/inventory`) | Running low (with a restock panel and waiting counts), stock movements (filters, CSV export), restock requests ("Send now"), alerts (low-stock emails and recipients, back-in-stock requests on/off, "Check and send now") |
| **Discounts** (`/admin/discounts`) | Codes with value, conditions, uses, amount discounted and state (active, scheduled, expired, used up, off); create/edit drawer; switch off; delete (only while unused); copy code |
| **Size guides** (`/admin/size-guides`) | Guides with their categories and product count; editor with templates (tops, shoes, trousers, rings), a cell grid (≤ 12 × 60), notes, categories and a live preview |
| **Finance** (`/admin/finance`) | Revenue by status, net revenue (after partial refunds), refunds, discounts and product margin (from the costs recorded at sale), the refund queue (orders with something left to refund) and refund drawer (→ `handle-order-action`) |

**Variants in the product drawer** (`VariantEditor`): the **Sold by size** and **Sold by colour**
switches with the words shown to customers; size presets (Clothing XS–XL / XXS–3XL, Numeric
38–54, Shoes EU 35–46, Rings 5–9, Waist 26–38, S·M·L) and free-text sizes (`S, M, L` adds
three); colour presets and custom colours with a swatch (or name only); one row per size,
colour or colour × size with SKU (suggested from the product SKU), stock, on-sale switch and —
with **Price and cost per variant** — its own price and cost; set-all helpers and fill-empty-SKUs.
Photos can be tagged with a colour. The editor model is pure and tested
([`src/lib/variants.ts`](src/lib/variants.ts)): an untouched negative figure stays valid
(backorder depth), only changed figures are sent and always with the one they replace, and an
unchanged configuration is not written at all. Removing a variant that has orders switches it
off; turning both switches off returns the product to one stock figure. The drawer also edits
the compare-at price, the cost (with the margin), the size guide, and shows the product's stock
history.

Guarding is two-layer: `AdminRoute` waits for `profileStatus` before deciding (so a hard refresh
does not bounce an admin home), and every privileged operation is re-authorised server-side —
`admin_analytics()` raises without `is_admin()`, and the Edge Functions check the role
themselves.

---

## 20. Local development, testing and CI

### 20.1 Setup

```bash
# Prerequisites: Node.js LTS (CI uses 22)
npm install
cp .env.example .env        # then fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                 # http://localhost:5173
```

For checkout to work locally, add `http://localhost:5173` to the `ALLOWED_ORIGINS` secret —
CORS fails closed, so an unset value rejects even localhost.

### 20.2 Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server on 5173 |
| `npm run build` | `tsc -b` (project references) then `vite build` → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint flat config over the repo |
| `npm test` | `vitest run` |

### 20.3 Test suites

**199 tests across 14 files**, all passing at the time of writing. They cover the money-and-stock
logic that is expensive to get wrong:

| File | Covers |
|---|---|
| [`src/lib/pricing.test.ts`](src/lib/pricing.test.ts) | Tax base is `subtotal + shipping` after the discount; variant prices; cent rounding; invalid/negative rates and inputs |
| [`src/lib/sizes.test.ts`](src/lib/sizes.test.ts) | Size labels, presets, name normalisation, stock parsing |
| [`src/lib/variants.test.ts`](src/lib/variants.test.ts) | The variant editor model: building from a product (only variants of the product's shape), adding/removing colours and sizes, switching dimensions on and off, validation, derived total, the RPC payload (stock only when changed, with the figure it replaces), change detection, rebasing after a conflict; storefront helpers (price range, images per colour) |
| [`src/store/cartStore.test.ts`](src/store/cartStore.test.ts) | Line identity per variant, legacy size lines migrated and merged, quantity clamping, catalogue sync (price adoption, dropped/deactivated products, variant-stock clamping, oversold products, products whose sizes or colours were switched on or off) |
| [`src/lib/csv.test.ts`](src/lib/csv.test.ts), [`productCsv.test.ts`](src/lib/productCsv.test.ts), [`orderCsv.test.ts`](src/lib/orderCsv.test.ts) | Both CSV dialects, quoting and the formula-injection guard, separator detection; catalogue export → import round trip, missing columns left alone (variants included), the problems that stop an import; order and line exports |
| [`src/lib/i18n.test.ts`](src/lib/i18n.test.ts) | Every key the code uses exists; Italian, Spanish and French have the same keys and placeholders as English |
| [`supabase/functions/_shared/checkout-lines.test.ts`](supabase/functions/_shared/checkout-lines.test.ts) | Checkout line resolution: duplicate merging, malformed input, variant required / not applicable / not on sale, per-variant and combined stock, variant prices, colour/SKU/cost snapshots, `variant_id` assignment |
| [`supabase/functions/_shared/discounts.test.ts`](supabase/functions/_shared/discounts.test.ts) | Percentage, fixed and free-shipping codes; minimum, scope (categories with their subcategories, products), sale exclusion; cent-exact allocation across lines |
| [`supabase/functions/_shared/refunds.test.ts`](supabase/functions/_shared/refunds.test.ts) | What is left to refund, refundable units, the suggested amount with discount and tax shares |
| [`supabase/functions/_shared/webhook-logic.test.ts`](supabase/functions/_shared/webhook-logic.test.ts) | The full decision matrix: paid transitions, downgrade guards, refund events handed to the refund sync, and every amount-reconciliation case in both tax modes |
| [`supabase/functions/_shared/address.test.ts`](supabase/functions/_shared/address.test.ts) | The `[object Object]` coercion, country allowlist, boundary lengths, postal patterns |
| [`supabase/functions/_shared/money.test.ts`](supabase/functions/_shared/money.test.ts) | The single store currency: ISO code, Stripe's lower-case form, locale-dependent punctuation |

There is no Vitest config file — the defaults pick up `**/*.test.ts` outside `node_modules`.
`tsconfig.app.json` excludes test files from the app build.

### 20.4 CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) — on push to `main` and on every pull
request: Node 22 with npm cache → `npm ci` → `npx tsc -b` → `npx eslint .` → `npx vitest run`.

### 20.5 Running Edge Functions locally

```bash
npx supabase start
npx supabase functions serve create-checkout-session --env-file .env.local
```

`.env.local` must carry the Edge Function secrets (never commit it).

---

## 21. Deployment

### 21.1 Frontend → Vercel

1. Push to GitHub.
2. Vercel → Add New → Project → import the repo. It auto-detects Vite (build `npm run build`,
   output `dist`).
3. Add the `VITE_*` environment variables.
4. Deploy. `vercel.json` supplies the SPA rewrite and all security headers — no manual config.
5. Every push to `main` triggers a rebuild.

**Never** put a Stripe secret or the service-role key in Vercel environment variables. Only
`VITE_`-prefixed values belong there, and everything with that prefix is public.

### 21.2 Backend → Supabase

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # also writes project_id into supabase/config.toml
npx supabase functions deploy create-checkout-session
npx supabase functions deploy stripe-webhook
npx supabase functions deploy update-tracking
npx supabase functions deploy handle-order-action
npx supabase functions deploy store-worker
```

Deploy **all five**, after the migrations they depend on (022–025 for checkout, the webhook
and the order actions). Then store the `store-worker` address and secret in Vault
([§12.12](#1212-the-scheduled-job-required)). `supabase/config.toml` carries the `verify_jwt`
settings and is the only
file the CLI reads them from — leave it alone unless you know why you are changing it
([§6.2](#62-jwt-verification-at-the-gateway)). Its `project_id` is a placeholder on purpose:
`supabase link` fills it in, and deploys target the linked project regardless.

Secrets are runtime values — changing one needs no redeploy. Changing function **code** does.

### 21.3 Stripe webhook

Endpoint: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`, subscribed to
`checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`,
`payment_intent.payment_failed`, `charge.refunded`, `refund.updated`. Copy the signing secret
into `STRIPE_WEBHOOK_SECRET`.

### 21.4 Release checklist

Consolidated from `SECURITY-AUDIT.md`, `HANDOVER_GUIDE.md` and `SETUP_CHECKLIST.md`:

- [ ] All migrations applied through **026**; verification queries pass (`set_user_role`
      allowlist form, the four length constraints, `has_column_privilege('anon', …,
      'cost_price')` = `false`).
- [ ] RLS shows **Enabled** on every table.
- [ ] `SELECT jobname FROM cron.job` lists `expire-pending-orders` (migration 020) and the
      `store-worker-*` and `purge-*` jobs (023, 025); the Vault entries `store_worker_url` /
      `store_worker_secret` exist and `SELECT public.invoke_store_worker('low_stock')` answers 200
      in `net._http_response`.
- [ ] Invoice details (`taxId`, `invoiceNotes` in `storeConfig.ts`) filled and the invoice layout
      checked against local requirements.
- [ ] `curl -X POST …/functions/v1/stripe-webhook` returns **400**, not 401.
- [ ] `ALLOWED_ORIGINS` set to the real production origins; no `*`; `ALLOW_VERCEL_PREVIEWS=false`
      (or a `VERCEL_PREVIEW_PREFIX` set alongside it).
- [ ] `STRIPE_TAX_ENABLED` identical on checkout and webhook.
- [ ] Stripe in **live** mode; webhook endpoint and events registered; one real low-value
      purchase verified end-to-end, then refunded.
- [ ] `src/config/storeConfig.ts` fully filled — no `[PLACEHOLDER]` left; legal pages reviewed.
- [ ] Email branding secrets set; a test shipping/refund/delivery email received with the right
      brand and a verified sender domain.
- [ ] Supabase Auth **Site URL** + **Redirect URLs** point at the current domain.
- [ ] First admin promoted.
- [ ] `.env` excluded from every deployment and from any distributed ZIP.
- [ ] HTTPS enforced on the domain.

---

## 22. Operations runbook

### 22.1 Promote an admin

```sql
select public.set_user_role('you@your-domain.com', 'admin');  -- or 'customer'
```

`No profile found for …` means the account has not signed up yet or its profile row is missing:

```sql
select u.email, coalesce(p.role::text,'MISSING PROFILE') as role
  from auth.users u left join public.profiles p on p.id = u.id
 order by u.created_at desc;
```

A `NULL` role means the profile row is missing — re-run `014_role_management.sql`, which
backfills them.

### 22.2 Replace the demo catalogue

```sql
DELETE FROM public.product_images;
DELETE FROM public.products;
-- optionally: DELETE FROM public.categories;  (insert your own BEFORE products)
```

Then add products via Admin → Catalogue (easiest), the Supabase Table Editor, or SQL. Keep
`slug` unique, `sku` unique when present, exactly one image with `is_primary = TRUE`, and valid
`category_id` references. If you rename category slugs, update the icon map in
[`HomePage.tsx`](src/features/products/pages/HomePage.tsx).

### 22.3 Change the brand

`src/config/storeConfig.ts` (name, contacts, country, legal identity) → `public/favicon.svg` →
`<title>` in `index.html` → accent tokens in `src/styles/tokens.css` (light **and** dark) →
email secrets (`STORE_NAME`, `SUPPORT_EMAIL`, `RESEND_FROM_EMAIL`, `STORE_BRAND_COLOR`).

### 22.4 Change the domain

Do all four steps in [§5.2](#52-where-each-url-must-be-registered). The most commonly forgotten
one is the Supabase Auth **Site URL**, whose symptom is being redirected to the previous domain
after sign-in.

### 22.5 Handle a `needs_review` order

Admin → Orders → filter "Needs review". Read `review_reason`, act (restock, contact the
customer, refund, or investigate the amount mismatch in Stripe — **Confirm payment** if Stripe
shows it paid), then **Mark as resolved** with a note (or the `UPDATE` in
[§17.2](#172-stock-rules)).

### 22.5b Store emails are not arriving

1. `SELECT public.invoke_store_worker('low_stock');` — `NULL` means a Vault entry is missing (or
   pg_net is off).
2. `SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;` — `401`
   means `STORE_WORKER_SECRET` and the `store_worker_secret` Vault entry differ (or the secret
   is shorter than 16 characters); `404` means `store-worker` is not deployed or the URL is wrong.
3. Admin → Inventory → Alerts: low-stock emails on, a recipient (or an admin account) present;
   "email me when it is back" on. Restock requests wait until the item has stock **and** is on
   sale.
4. `RESEND_API_KEY` / `RESEND_FROM_EMAIL` as for every other email.

### 22.6 Rotate keys

Supabase → Settings → API → Reset the service-role key (and the anon key if it leaked). Then
update the Vercel environment variables and redeploy the Edge Functions. The service-role key
bypasses RLS entirely, so treat any exposure as urgent.

### 22.7 Regenerate database types

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

Run this after every schema change — `src/lib/api.ts` relies on those types. Also update
`src/types/index.ts` if the change affects an application-level shape.

### 22.8 A paid order never reached `paid`

1. Check `curl -X POST …/functions/v1/stripe-webhook` → must be **400**, not 401.
2. Stripe → Developers → Webhooks: inspect the delivery. Resending a processed event is safe —
   the webhook answers `duplicate: true` and changes nothing.
3. Confirm `STRIPE_WEBHOOK_SECRET` is the endpoint's **signing secret**, not an API key.
4. Check the function logs for a business-rule park or an amount mismatch.

---

## 23. Security model summary

**Enforced by construction**

- Prices, shipping costs, stock and totals are recomputed server-side from the database; client
  input is never trusted.
- Card data never reaches this codebase — Stripe Checkout is hosted.
- The frontend bundle contains only the public anon key. Every secret lives in Edge Function
  secrets.
- RLS on every table, plus column grants where RLS cannot reach (`cost_price`,
  `profiles.role`/`email`).
- Orders and their lines are immutable after payment; status transitions are validated in the
  database for every caller including admins and the service role.
- Webhook authenticity by signature; replay protection by an event ledger.
- Refunds are idempotent (a client request id that is also the Stripe idempotency key) and
  capped by the database at what is left; refunds made in Stripe are mirrored, never trusted
  from the client.
- Discounts are recomputed server-side from the code's row and charged as a single-use coupon
  for exactly that amount; a code's uses are counted under a row lock.
- Costs (product, variant and per order line) and alert recipients are never readable by the
  public API.
- CORS fails closed; redirect URLs are built only from a verified origin.
- Queries go through the parameterised Supabase SDK. No `dangerouslySetInnerHTML`, `innerHTML`
  or `eval` anywhere. Email HTML escapes every user-supplied value.
- Abuse limits at both layers: rate limits in the functions, CHECK constraints and triggers in
  the database.

**Deliberately public:** the anon key, the project ref, active catalogue data, and reviews
without `user_id`.

**The operator's responsibility:** filling the legal placeholders, setting `ALLOWED_ORIGINS`,
keeping `STRIPE_TAX_ENABLED` in sync, applying migrations 015/016, keeping
`STORE_WORKER_SECRET` long and secret, and rotating keys.

Full finding-by-finding detail, each with its code location and test coverage, is in
[`SECURITY-AUDIT.md`](SECURITY-AUDIT.md). That file carries a rule worth repeating: **if you
change a control, change that file in the same commit** — a security document that asserts a
control the code does not implement is worse than no document.

---

## 24. Known gaps and open items

Carried over from `SECURITY-AUDIT.md` and `ROADMAP.md`, still open at the time of writing:

| Item | Impact | Owner |
|---|---|---|
| `src/config/storeConfig.ts` still holds `[SELLER_LEGAL_NAME]`, `[BUSINESS_ADDRESS]`, `[GOVERNING_STATE]`, `[ARBITRATION_BODY]`, `[RETURN_WINDOW]`, `support@example.com`, `privacy@example.com` | These render **verbatim** in the Privacy Policy, Terms and Cookie Policy. A live store would name its data controller as `[SELLER_LEGAL_NAME]` (GDPR Art. 13) | **Launch blocker** — operator |
| `hasUnfilledPlaceholders()` exists but is never called | No automated warning about the above | Developer |
| `supabase/.temp` present in eight historical commits | Correctly gitignored now; the project ref is public anyway, so nothing to fix — but scrub history before handing the repo to a licensee | Developer |
| `ROADMAP.md` truncated mid–Phase 1a | The described work has landed (migration 013), but the file no longer reflects reality | Developer |
| Invoices are a template | `OrderPrintPage` prints numbered invoices from the order data; VAT breakdown, legal wording and e-invoicing (e.g. Italy's SdI) depend on the seller's country and are not implemented | Operator / developer |
| Checkout error messages from the server are English | The checkout page translates its own validation and the discount preview, but a refusal returned by `create-checkout-session` (e.g. a code that ran out between preview and payment) is shown as the function's English message | Developer |
| `package.json` `name` is `"project"`, `version` `0.0.0` | Cosmetic | Developer |
| Frontend `formatCurrency` is hardcoded to USD | Fine for the US-first template; a multi-currency store would need work in `i18n.ts`, `pricing.ts` and the checkout function | Developer |
| No end-to-end / browser tests | The payment path is covered by unit tests on pure logic only; the full flow is verified manually | Developer |

---

## Appendix A — file-by-file index

### Configuration and infrastructure

| File | Purpose |
|---|---|
| `package.json` | Scripts, dependencies |
| `vite.config.ts` | Vite + React plugin |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | Project references; app targets ES2023, bundler resolution, strict unused checks, tests excluded |
| `eslint.config.js` | Flat config: js + typescript-eslint + react-hooks + react-refresh; ignores `dist` |
| `vercel.json` | SPA rewrite + six security headers |
| `index.html` | HTML shell |
| `.env.example` | Environment template with inline documentation |
| `.gitignore` | Excludes `node_modules`, `dist`, `.env*`, `.vercel`, `supabase/.temp`, local editor settings |
| `.github/workflows/ci.yml` | CI pipeline |
| `supabase/config.toml` | Per-function `verify_jwt` |

### Frontend source

| File | Purpose |
|---|---|
| `src/main.tsx` | Entry: theme init, QueryClientProvider, router |
| `src/routes/index.tsx` | Router config, lazy chunks, `deferred()` suspense wrapper |
| `src/routes/ProtectedRoute.tsx` | Requires a session; remembers the intended path |
| `src/routes/AdminRoute.tsx` | Requires session **and** loaded admin profile |
| `src/lib/supabaseClient.ts` | Typed Supabase client |
| `src/lib/api.ts` | Every database and function call |
| `src/lib/queryClient.ts` | React Query defaults |
| `src/lib/pricing.ts` | Order totals (display estimate), variant-aware line prices |
| `src/lib/stock.ts` | Stock arithmetic |
| `src/lib/variants.ts` / `sizes.ts` | Variant helpers and the product editor's draft model |
| `src/lib/csv.ts` / `productCsv.ts` / `orderCsv.ts` | CSV dialects, catalogue import/export, order exports |
| `src/lib/cartLines.ts` / `printDocuments.ts` | Cart line photo and link; opening the printable documents |
| `src/lib/i18n.ts` / `i18nCopy.ts` / `i18nCommerce.ts` | Dictionaries and the `useI18n()` hook |
| `src/lib/database.types.ts` | Generated Supabase types |
| `src/types/index.ts` | Application types |
| `src/config/storeConfig.ts` | Brand + legal identity, placeholder filling |
| `src/store/*.ts` | Seven Zustand stores ([§9.3](#93-state-management)) |
| `src/hooks/*.ts` | Eleven hooks: auth listener + React Query wrappers |
| `src/components/**` | Layout shells, overlays, UI primitives |
| `src/features/**` | Ten feature modules ([§9.6](#96-feature-modules)) |
| `src/styles/*.css` | Five-file cascade ([§10](#10-design-system-and-theming)) |

### Backend source

| File | Purpose |
|---|---|
| `supabase/schema.sql` | Base tables, enums, triggers, initial seed |
| `supabase/rls.sql` | Base policies + `is_admin()` |
| `supabase/migrations/001…026.sql` | Schema evolution ([§14](#14-migration-history)) |
| `supabase/seeds/002_mock_products.sql` | 40 demo products across 5 categories (luxury ready-to-wear and accessories), 70 units each — split across XS–XL for ready-to-wear, across two colours for the braided belt — plus a Ready-to-Wear size guide; images served from the demo project's `product-images/catalog/` |
| `supabase/functions/create-checkout-session/index.ts` | Cart → order → Stripe session |
| `supabase/functions/stripe-webhook/index.ts` | Authoritative order-state updater |
| `supabase/functions/handle-order-action/index.ts` | Cancel / refund (all or part) / deliver / payment check / payment confirmation |
| `supabase/functions/update-tracking/index.ts` | Tracking + shipping email |
| `supabase/functions/store-worker/index.ts` | Back-in-stock emails and the low-stock digest |
| `supabase/functions/_shared/*.ts` | CORS, address, money, store branding, email, order emails, checkout lines, discounts, refunds, webhook logic (+ 6 test files) |

---

## Appendix B — limits and constants

| Limit | Value | Enforced in |
|---|---|---|
| Line items per checkout | 50 | `_shared/checkout-lines.ts` |
| Quantity per merged line | 100 | `_shared/checkout-lines.ts` |
| Sizes per product / size name / size SKU | 100 / 40 chars / 64 chars | `admin_save_product_variants()` + CHECK constraint |
| Colour name / swatch | 40 chars / `#RRGGBB` | CHECK constraints |
| Size guide | 12 columns × 60 rows, 2000-char notes | CHECK constraints |
| CSV import | 1000 products per file, 10 MB, 20 image URLs per product | `ImportProductsDrawer`, `planImport()`, `admin_import_products()` |
| Discount code | 3–40 chars `[A-Z0-9][A-Z0-9_-]*` | `DISCOUNT_CODE_PATTERN` + CHECK constraint |
| Minimum discounted charge | 0.50 | `create-checkout-session` |
| Back-in-stock requests | 20 per requester per hour | `request_stock_notification()` |
| Low-stock alert recipients | 10 | `admin_update_store_settings()` |
| `store-worker` run | 40 s budget, batches of 50 | `store-worker` |
| `STORE_WORKER_SECRET` | ≥ 16 chars (32+ recommended) | `store-worker` |
| Order export / print | 5,000 orders per export, 200 per print run | `fetchAllAdminOrders()`, `OrderPrintPage` |
| Orders per user per hour | 10 | `create-checkout-session` |
| Open (`pending`+`processing`) orders per user | 10 | `check_pending_order_limit()` trigger |
| Stripe Checkout session TTL | 1 hour | `create-checkout-session` |
| Stale-order cancellation age | 2 hours | `expire_stale_pending_orders()` + pg_cron every 15 min |
| Customer self-refunds per 24 h | 3 | `handle-order-action` |
| Saved addresses per user | 20 | `check_address_limit()` trigger |
| Review body | 2000 chars | `submitReview()` + CHECK constraint |
| `orders.shipping_address` serialised | 2000 chars | CHECK constraint |
| Address fields | 120 / 200 / 200 / 100 / 100 / 20 / 2 / 32 | `ADDRESS_MAX_LENGTHS` + CHECK constraint |
| `profiles.full_name` / `phone` | 120 / 32 | CHECK constraint |
| Product image upload | 5 MB, jpeg/png/webp/gif | Storage bucket config |
| Amount reconciliation tolerance | 1 cent | `webhook-logic.ts` |
| Full-refund tolerance | $0.005 | `handle-order-action`, `webhook-logic.ts` |
| Products per catalogue page | 12 (admin orders: 50) | `api.ts` |
| Featured products on home | 8 | `fetchFeaturedProducts()` |
| Profile fetch timeout | 8 s, one retry | `useAuth.ts` |
| Toast lifetime | 3.2 s | `toastStore.ts` |
| Cookie consent re-prompt | 12 months | `cookieConsentStore.ts` |

---

## Appendix C — API error codes

Edge Functions answer with `{ error, code, phase }`. Useful when reading logs or writing UI
messages.

**`create-checkout-session`**

| Code | Status | Meaning |
|---|---|---|
| `CONFIG_MISSING_SECRETS` | 500 | Named secrets are unset |
| `ORIGIN_NOT_ALLOWED` | 403 | Origin not in `ALLOWED_ORIGINS` |
| `AUTH_MISSING_HEADER` / `AUTH_INVALID_SESSION` | 401 | No or invalid bearer token |
| `VALIDATION_NO_ITEMS` / `VALIDATION_TOO_MANY_ITEMS` / `VALIDATION_MISSING_PRODUCT_ID` / `VALIDATION_INVALID_PRODUCT_ID` / `VALIDATION_INVALID_VARIANT` / `VALIDATION_INVALID_SIZE` / `INVALID_QUANTITY` | 400 | Malformed cart |
| `VALIDATION_INVALID_SHIPPING_ADDRESS` / `…_MISSING_SHIPPING_ADDRESS_FIELDS` / `…_TOO_LONG` / `VALIDATION_COUNTRY_NOT_SUPPORTED` / `VALIDATION_INVALID_POSTAL_CODE` | 400 | Address rejected by `sanitizeAddress()` |
| `RATE_LIMITED` | 429 | Hourly order cap or DB pending-order limit |
| `PRODUCT_NOT_FOUND` | 400 | Unknown product id |
| `VARIANT_REQUIRED` / `SIZE_REQUIRED` / `SIZE_NOT_APPLICABLE` | 400 | A product with variants bought without one, or the reverse |
| `PRODUCT_INACTIVE` / `INSUFFICIENT_STOCK` / `VARIANT_NOT_FOUND` | 409 | Not purchasable right now |
| `SHIPPING_METHOD_UNAVAILABLE` / `SHIPPING_METHOD_NOT_AVAILABLE_FOR_COUNTRY` / `SHIPPING_METHOD_REQUIRED` | 400 | Method missing, inactive, not for that country, or omitted |
| `DISCOUNT_NOT_FOUND` / `…_NOT_STARTED` / `…_EXPIRED` / `…_MIN_SUBTOTAL` / `…_NO_ELIGIBLE_ITEMS` / `…_NO_EFFECT` | 400 | The code cannot be used on this order |
| `DISCOUNT_EXHAUSTED` / `DISCOUNT_ALREADY_USED` | 409 | No uses left, or this customer's are used |
| `CHECKOUT_TOTAL_TOO_LOW` | 400 | The discounted total is under the minimum card charge |
| `DB_*_ERROR` | 500 | Database failure at the named phase |
| `STRIPE_SESSION_ERROR` / `STRIPE_SESSION_MISSING_URL` | 502 | Stripe API failure |
| `UNHANDLED_ERROR` | 500 | Anything else |

**`handle-order-action`**

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_MISSING_FIELDS` / `VALIDATION_UNKNOWN_ACTION` | 400 | Bad request |
| `AUTH_MISSING_HEADER` / `AUTH_INVALID_SESSION` | 401 | Auth |
| `AUTH_NOT_ADMIN` | 403 | Non-admin asked for an admin action |
| `ORDER_NOT_FOUND` | 404 | Unknown order — **also** returned when the caller does not own it |
| `ORDER_ALREADY_PAID` | 409 | Cancel attempted after the Stripe session completed |
| `ORDER_NOT_CANCELABLE` / `NOT_REFUNDABLE` / `ORDER_NOT_DELIVERABLE` / `ORDER_NOT_HELD` | 409 | Wrong status for the action |
| `NO_PAYMENT` / `NO_CHECKOUT_SESSION` | 409 | Nothing in Stripe to refund, confirm or check |
| `PAYMENT_NOT_SUCCEEDED` | 409 | `confirm_payment`: Stripe does not report the payment as succeeded |
| `INVALID_AMOUNT` / `AMOUNT_TOO_HIGH` / `SHIPPING_TOO_HIGH` / `INVALID_LINE` | 400 | Refund refused by the database (more than is left, bad lines) |
| `RATE_LIMITED` | 429 | More than 3 self-refunds in 24 h |
| `STRIPE_ERROR` | 502 | Stripe API failure (the refund record is abandoned, nothing is half-applied) |

**`store-worker`** answers `401 AUTH_MISSING` / `AUTH_INVALID_SESSION` (no secret and no session),
`403 ORIGIN_NOT_ALLOWED` / `AUTH_NOT_ADMIN`, or `200` with the task's figures.

**`stripe-webhook`** returns `{ received: true }` (200), `{ received: true, duplicate: true }`
(200, already processed), `400` (missing or invalid signature), or `500` (transient — Stripe
should retry).
