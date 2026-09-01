# CommerceJet — Complete Project Documentation

> **What this file is.** A single, self-contained technical reference for the whole project:
> the services it runs on, the domains and URLs involved, how CORS / CSP / auth / payments are
> wired, the database in its final migrated state, every Edge Function, and a map of the source
> code. Read this first if you have never seen the repository; the other documents (listed in
> [§2](#2-map-of-the-existing-documentation)) are task-specific and assume you already know the
> shape of the system.
>
> _Last regenerated: 2026-08-26. Reflects migrations `001` → `016` and the four deployed Edge
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
  overlay (⌘K / Ctrl-K), product detail pages with size variants and verified-purchase reviews.
- Accounts: email/password plus Google OAuth, password reset, profile, saved addresses.
- Cart: `localStorage` only (there is **no** database cart), reconciled against the live
  catalogue on load.
- Checkout: Stripe Checkout, created server-side; success/cancel pages driven by the real
  order row.
- Orders: customer order history, order detail, self-service cancel/refund before shipment.
- Admin: dashboard, order queue, catalogue editor with image upload, finance/refunds.
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
| [`docs/02_products_setup.md`](docs/02_products_setup.md) | Buyer | Data model, removing demo catalogue, three ways to add products |  |
| [`docs/03_supabase_setup.md`](docs/03_supabase_setup.md) | Buyer | Project creation, SQL order, keys, Google OAuth, secrets, function deploy, first admin |  |
| [`docs/04_github_vercel_deploy.md`](docs/04_github_vercel_deploy.md) | Buyer | Build, push, import into Vercel, env vars, auto-redeploy |  |
| [`docs/05_domain_and_cors.md`](docs/05_domain_and_cors.md) | Buyer | Custom domain, Supabase Auth URLs, Google origins, `ALLOWED_ORIGINS` |  |
| [`docs/06_stripe_setup.md`](docs/06_stripe_setup.md) | Buyer | Keys, webhook + events, sales tax modes, test payment, go-live |  |

The `docs/*.html` files are exported copies of the matching `.md` sources, meant for PDF
distribution to buyers. Edit the Markdown; regenerate the HTML.

**Precedence.** When a buyer guide and this file disagree, the code wins; check the source
location cited here. Buyer guides intentionally simplify (e.g. `docs/03` still says "run
migrations through `014`" — the correct answer is through `016`, and `015`/`016` are security
migrations, not polish).

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
        │                                   stock, immutability
        │                                 · RPC: admin_analytics,
        │                                   has_purchased, set_user_role
        │
        │  (2) Bearer JWT + apikey, POST
        ├──────────────────────────────► Supabase Edge Functions (Deno)
        │                                 · create-checkout-session
        │                                 · handle-order-action
        │                                 · update-tracking
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
| **Edge Functions (Deno)** | Checkout, webhook, order actions, tracking + emails | `supabase/functions/*`, `supabase/config.toml` |

Extensions used: `uuid-ossp` (PKs), `pg_trgm` (product-name search index), `pg_cron`
(stale-order expiry — **must be enabled manually**).

The frontend talks to Postgres through PostgREST with the **public anon key**; privilege is
enforced by RLS, never by key secrecy. The `service_role` key exists only inside Edge
Functions, where Supabase injects it automatically.

### 4.2 Stripe — payments

Stripe Checkout (hosted payment page) in `mode: 'payment'`, card only. Card data never touches
this codebase. Stripe API version is pinned in every function:
`const STRIPE_API_VERSION = '2025-03-31.basil'`.

Six webhook events are handled — see [§15.2](#152-stripe-webhook). Stripe Tax is optional and
off by default ([§16.4](#164-sales-tax)).

### 4.3 Resend — transactional email

Optional but recommended. Without `RESEND_API_KEY`, every send is skipped with a console
warning and the flow continues (see [`_shared/email.ts`](supabase/functions/_shared/email.ts)).
Sends order confirmation, shipping, refund and delivery emails. Sign-up and password-reset
emails come from **Supabase Auth**, not from this code.

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
and imported by the three browser-facing functions. `stripe-webhook` does not use it — Stripe
is a server, not a browser, so CORS is irrelevant there.

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
  uses `resolveAllowedOrigin()`; `handle-order-action` and `update-tracking` use
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
| `SUPABASE_ANON_KEY` | checkout, order-action, update-tracking | Used to validate the caller's JWT via `auth.getUser()` |
| `ALLOWED_ORIGINS` | all browser-facing | **Required.** Fails closed when unset |
| `ALLOW_VERCEL_PREVIEWS` | all browser-facing | Default `false` |
| `VERCEL_PREVIEW_PREFIX` | all browser-facing | Required when previews are enabled |
| `TAX_RATE` | checkout | Flat fraction used when Stripe Tax is off. Default `0` |
| `STRIPE_TAX_ENABLED` | checkout **and** webhook | **Must be identical in both**, or paid orders get parked for review |
| `RESEND_API_KEY` | webhook, order-action, update-tracking | Optional; without it emails are skipped |
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

| | checkout | webhook | order-action | update-tracking |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | ✅ | ✅ (lazy, refund/cancel paths) | — |
| `STRIPE_WEBHOOK_SECRET` | — | ✅ | — | — |
| `SUPABASE_URL` *(injected)* | ✅ | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` *(injected)* | ✅ | ✅ | ✅ | ✅ |
| `SUPABASE_ANON_KEY` | ✅ | — | ✅ | ✅ |
| CORS trio | ✅ | — | ✅ | ✅ |
| `TAX_RATE` / `STRIPE_TAX_ENABLED` | ✅ | `STRIPE_TAX_ENABLED` only | — | — |
| `RESEND_*` / `STORE_*` | — | ✅ | ✅ | ✅ |

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
│   ├── assets/                    Bundled images (hero.png and friends)
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
│   ├── lib/                       api, supabaseClient, queryClient, pricing, stock, i18n, types
│   ├── routes/                    Router config + ProtectedRoute / AdminRoute
│   ├── store/                     Zustand stores
│   ├── styles/                    tokens → base → primitives → storefront → admin
│   ├── types/index.ts             Shared application types
│   └── main.tsx                   Entry point
├── supabase/
│   ├── config.toml                ★ verify_jwt per function — the only file the CLI reads
│   ├── functions/
│   │   ├── _shared/               address, cors, email, store, webhook-logic (+ tests)
│   │   ├── create-checkout-session/index.ts
│   │   ├── handle-order-action/index.ts
│   │   ├── stripe-webhook/index.ts
│   │   └── update-tracking/index.ts
│   ├── migrations/001…016.sql     Applied in numeric order
│   ├── seeds/002_mock_products.sql  35 demo products across 4 categories
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
| `['products','detail',slug]` | `useProduct` | Also loads active variants |
| `['products','featured']` | `useFeaturedProducts` | Limit 8 |
| `['categories']` | `useCategories` | `staleTime` 30 min |
| `['shipping-methods']` | `useShippingMethods` | `staleTime` 10 min |
| `['orders', userId]` | `useOrders` | |
| `['order', orderId]` | `useOrder` | |
| `['order-by-session', sessionId]` | inline in `CheckoutSuccessPage` | Retries 4× with exponential backoff while waiting for the webhook |
| `['addresses', userId]` | `useAddresses` | |
| `['reviews', productId]` | `useReviews` | |
| `['has-purchased', productId, userId]` | `useHasPurchased` | RPC-backed review gate |
| `['admin-orders', filters]` | `useAdminOrders` | Page size 50 |
| `['admin-products']` / `['admin-categories']` | `useAdminProducts` etc. | |
| `['admin-analytics']` | `useAdminAnalytics` | Single RPC call |

Mutations invalidate `['admin-orders']` and `['admin-analytics']` together, so the dashboard
never disagrees with the order queue.

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

- **Line identity** is `productId::selectedSize`, so two sizes of one product are separate
  lines.
- **Quantity caps** come from [`src/lib/stock.ts`](src/lib/stock.ts), never from raw
  `stock_quantity`. That module encodes three rules that used to be scattered and disagreeing:
  1. Stock can be **negative** (migration 013 allows oversell depth), so `sellableStock()`
     clamps at 0 — otherwise `Math.min(qty, -5)` would put a negative quantity in the cart.
  2. For a sized line the binding limit is the **variant's** stock.
  3. `products.stock_quantity` is still an upper bound for a sized line, because checkout
     deducts from both counters — so `availableStock()` takes the **min** of the two.
- **`syncWithCatalog(products)`** (driven by `useCartSync` on mount) adopts fresh prices and
  images, drops products that vanished or were deactivated, clamps quantities, and returns
  `true` when the shopper should be told. Failure is non-fatal: the server re-validates
  everything at checkout anyway.

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
| `fetchProductBySlug(slug)` | `products` + `product_variants` | Active variants loaded separately, ordered by `sort_order` |
| `fetchFeaturedProducts()` | `products` | `is_featured`, limit 8 |
| `fetchProductsByIds(ids)` | `products` + variants | Cart sync; variants included so per-size limits survive |
| `fetchCategories()` | `categories` | Active only, by `sort_order` |
| `fetchProfile(userId)` | `profiles` | |
| `fetchAddresses` / `createAddress` | `addresses` | |
| `fetchShippingMethods()` | `shipping_methods` | Active only |
| `fetchReviews(productId)` | `product_reviews` | Allowlisted columns |
| `hasPurchasedProduct(id)` | RPC `has_purchased` | Gates the review form |
| `submitReview(...)` | `product_reviews` upsert | Rating clamped 1–5, body trimmed to `REVIEW_BODY_MAX_LENGTH` (2000) |
| `fetchOrders` / `fetchOrderById` | `orders` + `order_items` | RLS scopes to owner |
| `cancelOrder(orderId)` | → `handle-order-action` | Never a direct table write |
| `fetchAdminOrders(filters)` | `orders` + items + profile | Page size 50, `status` and `needsReviewOnly` filters, exact count |
| `updateOrderStatus` | `orders` | Direct write; DB transition guard still applies |
| `updateOrderTracking` | → `update-tracking` | Client never sends a status |
| `markOrderDelivered` / `refundOrder` | → `handle-order-action` | |
| `fetchAdminAnalytics()` | RPC `admin_analytics` | Aggregates computed in the DB, not by downloading every order |
| `fetchAdminProducts` / `createProduct` / `updateProduct` | `products` | `createProduct` resolves a unique slug with up to 5 attempts |
| `uploadProductImage(file)` | Storage `product-images` | Random UUID filename; returns the public URL |
| `addProductImages` / `deleteProductImage` / `setPrimaryProductImage` | `product_images` | Primary is clear-then-set (a partial unique index enforces one per product) |
| `fetchAdminCategories` / `createCategory` | `categories` | |

`invokeOrderFunction()` is the shared Edge Function caller: it pulls a fresh access token from
`supabase.auth.getSession()`, sends `Authorization: Bearer …` plus `apikey`, and surfaces the
function's JSON `error` field as the thrown message.

### 9.6 Feature modules

Each module owns its pages, and where useful its own components and constants.

| Module | Pages | Notable behaviour |
|---|---|---|
| `features/products` | `HomePage`, `ProductListPage`, `ProductDetailPage` | Home falls back to newest products when nothing is flagged featured; detail page handles variants, reviews and related products. `HomePage` carries a slug→icon map — update it if you rename category slugs |
| `features/cart` | `CartPage` (+ `CartItemRow`) | Mirrors the drawer with a wider view |
| `features/checkout` | `CheckoutPage`, `CheckoutSuccessPage`, `CheckoutCancelPage` | Address form imports the country list, postal patterns and length caps **from the Edge Function's shared module** so client and server cannot drift. Success page polls for the webhook-created order before clearing the cart |
| `features/orders` | `OrdersPage`, `OrderDetailPage` | Only `paid` orders are cancellable from the UI; error codes are mapped to human messages |
| `features/auth` | `LoginPage`, `AuthCallbackPage`, `ResetPasswordPage` | Email/password + Google; sign-up collects `full_name` into user metadata |
| `features/profile` | `ProfilePage` | Open orders, "buy again", sign-out, admin entry when applicable |
| `features/settings` | `SettingsPage` | Theme, language, cookie preferences, location/analytics toggles, app version |
| `features/help` | `HelpPage` | Contact details read from `storeConfig` |
| `features/legal` | `PrivacyPage`, `PrivacyPolicyPage`, `TermsPage`, `CookiePolicyPage` | Text lives in `constants/{privacy,terms,cookie}Data.ts`; `LegalDocument` renders all three identically and runs `fillPlaceholders()` from `storeConfig` |
| `features/admin` | `AdminDashboardPage`, `AdminOrdersPage`, `AdminCatalogPage`, `AdminFinancePage` | See [§19](#19-admin-console) |

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
| `Drawer`, `Badge`, `Spinner`, `Skeletons`, `SkeletonCard`, `ErrorMessage`, `Toaster`, `Reveal`, `BackButton`, `Wordmark`, `icons` | Primitives |

### 9.8 Business-logic modules

| Module | Responsibility |
|---|---|
| [`lib/pricing.ts`](src/lib/pricing.ts) | `computeOrderTotals(subtotal, shipping, taxRate)` — tax applies to **subtotal + shipping**, matching the server. Everything rounded to the cent; invalid or negative inputs collapse to 0. Display estimate only |
| [`lib/stock.ts`](src/lib/stock.ts) | `sellableStock`, `availableStock`, `isSoldOut` — see [§9.4](#94-the-cart) |
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
via Edge Function secrets; legal text is translated inside `features/legal/constants/*`.

---

## 12. Database

Everything lives in the `public` schema. What follows is the **final state after migration 016**,
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
(self-FK, ON DELETE SET NULL), `sort_order`, `is_active`, timestamps. Indexes on `slug`,
`parent_id`.

**`products`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `category_id` | UUID NOT NULL | FK → `categories` ON DELETE **RESTRICT** |
| `name`, `slug` (UNIQUE), `description` | TEXT | `slug` is the product URL |
| `price` | NUMERIC(10,2) ≥ 0 | |
| `compare_at_price` | NUMERIC(10,2) ≥ 0 | Struck-through "before" price |
| `cost_price` | NUMERIC(10,2) ≥ 0 | 🔒 **Not readable by `anon`/`authenticated`** (016) |
| `sku` | TEXT UNIQUE | |
| `stock_quantity` | INTEGER NOT NULL DEFAULT 0 | **No `>= 0` constraint** — negative = backorder depth |
| `low_stock_threshold` | INTEGER DEFAULT 5 | |
| `weight_grams` | INTEGER ≥ 0 | |
| `is_active`, `is_featured` | BOOLEAN | |
| `metadata` | JSONB | |

Indexes: `slug`, `category_id`, `is_active`, `is_featured`, `price`, a **GIN trigram** index on
`name` (so the storefront's `ILIKE '%term%'` search stops sequentially scanning), and a partial
`created_at DESC WHERE is_active` index for listing pages.

**`product_images`** — `product_id` (CASCADE), `url`, `alt_text`, `sort_order`, `is_primary`.
A **partial unique index** enforces at most one primary image per product.

**`product_variants`** (migration 004) — `product_id` (CASCADE), `size`, `sku`, `stock_qty`
(may go negative), `sort_order`, `is_active`, UNIQUE `(product_id, size)`.

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
| `refund_id` (UNIQUE), `refund_amount`, `refunded_at` | TEXT / NUMERIC / TIMESTAMPTZ | `refund_id` is the per-order refund lock |
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
`unit_price`, `quantity` > 0, `total_price`, `selected_size`.

A CHECK enforces `total_price = ROUND(unit_price * quantity, 2)`, so a line can never disagree
with its own arithmetic.

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
| `enforce_order_items_immutability()` | BEFORE INS/UPD/DEL on `order_items` | Blocks any line change once the parent order is paid |
| `manage_stock_on_status_change()` | **BEFORE** UPDATE on `orders`, SECURITY DEFINER | Deducts on first `paid`, restores on `failed`/`cancelled`/`refunded` from `paid`, handles variant stock, and flags `needs_review = true, review_reason = 'oversold'` when a counter goes negative. **Never raises** — the customer has already been charged |
| `check_pending_order_limit()` | BEFORE INS/UPD on `orders` | Max **10** open (`pending`+`processing`) orders per user |
| `check_address_limit()` | BEFORE INSERT on `addresses` | Max **20** saved addresses per user |
| `set_review_author_name()` | BEFORE INS/UPD on `product_reviews`, SECURITY DEFINER | Snapshots the reviewer's display name |
| `has_purchased(p_product_id)` | SQL, STABLE, SECURITY DEFINER | True when `auth.uid()` has a `paid`/`shipped`/`delivered` order containing the product. Gates review writes |
| `expire_stale_pending_orders()` | plpgsql, returns INTEGER | Cancels `pending`/`processing` orders older than **2 hours**. Run by pg_cron |
| `admin_analytics()` | plpgsql, STABLE, SECURITY DEFINER, returns JSONB | Dashboard aggregates; raises `Admin access required` unless `is_admin()` |
| `set_user_role(email, role)` | plpgsql, SECURITY DEFINER, returns JSONB | The supported promote/demote path ([§13.4](#134-role-assignment)) |

**`admin_analytics()` returns:** `grossRevenue`, `orders24h`, `orders7d`, `needsReview`,
`statusCounts`, `bestSeller`, `revenueByDay` (last 30 days), `revenueByStatus`. Revenue counts
only `paid`, `shipped`, `delivered`.

### 12.12 The scheduled job (required)

Enable `pg_cron` (Dashboard → Database → Extensions), then:

```sql
SELECT cron.schedule('expire-pending-orders', '*/15 * * * *',
  $$SELECT public.expire_stale_pending_orders()$$);
```

**The 1 h / 2 h relationship is load-bearing.** Stripe Checkout sessions are created with
`expires_at = now + 1 hour`; the cron only cancels orders older than 2 hours. The gap guarantees
the cron can never cancel an order whose session is still payable — the race that used to
produce paid-but-cancelled orders.

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
| `products` | `is_active` or admin | admin | admin (`price ≥ 0`, `stock_quantity ≥ 0` in WITH CHECK) | admin |
| `product_images` | parent product visible | admin | admin | admin |
| `product_variants` | `is_active` | admin | admin | admin |
| `shipping_methods` | `is_active` | admin | admin | admin |
| `addresses` | owner or admin | owner | owner | owner |
| `orders` | owner or admin | **nobody** (service role only) | owner: `pending` → `cancelled` only, financial + Stripe fields must be unchanged; admin: any | — |
| `order_items` | parent order visible | **nobody** (service role only) | — | — |
| `product_reviews` | **everyone** (`USING (TRUE)`) | owner **and** `has_purchased()` | owner **and** `has_purchased()` | owner |
| `processed_stripe_events` | `USING (false)` — nobody | — | — | — |
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
is why `src/lib/api.ts` names columns via `PRODUCT_COLUMNS`.

Verify with:

```sql
select has_column_privilege('anon','public.products','cost_price','SELECT');  -- must be false
```

### 13.3 What is deliberately public

- The **anon key** — it is in the client bundle by design.
- The **Supabase project ref** — it is inside `VITE_SUPABASE_URL`.
- Active products, their images and variants, active categories, active shipping methods, and
  **all product reviews** (minus `user_id`).

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

Run `schema.sql` → `rls.sql` → migrations `001`…`016` in numeric order → optionally
`seeds/002_mock_products.sql`. Already-migrated database? Run whatever is newer than your last
one, then `NOTIFY pgrst, 'reload schema';`

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
  "items": [{ "product_id": "uuid", "quantity": 2, "selected_size": "M" }],
  "shipping_address": { "full_name": "", "line1": "", "line2": null,
                        "city": "", "state": "", "postal_code": "",
                        "country": "US", "phone": null },
  "shipping_method_id": "uuid"
}
```

**Response:** `{ "url": "https://checkout.stripe.com/…" }` — the client redirects there.

**Pipeline**

1. Validate that all required secrets are present.
2. **Resolve the origin.** `resolveAllowedOrigin(origin)` must return a value; the Stripe
   `success_url` / `cancel_url` are built from it and **never** from the request body — otherwise
   a forged request could bounce the buyer to an attacker-controlled site.
3. Verify the JWT.
4. Validate `items` (non-empty, ≤ 50 lines).
5. **Sanitise the address** with `sanitizeAddress()` — type-checked strings, control characters
   stripped, per-field caps, country allowlist, postal pattern re-checked, and a return value
   containing only the eight known keys so unknown ones are dropped. This is not cosmetic: a
   presence check accepted `String({})` → `"[object Object]"` as a real address, and let orders
   through for countries the store does not ship to.
6. **Rate limit:** ≤ 10 orders per user per rolling hour (the DB pending-order trigger is the
   backstop and surfaces as `P0001` → `429 RATE_LIMITED`).
7. **Merge duplicate lines** by `(product_id, selected_size)` **before** validating. Checking each
   line independently let 50 separate lines of one product each pass the stock cap and oversell
   by 50×.
8. Load products from the DB (service role) and validate: exists, active, quantity ≤ 100,
   product-level stock against the **combined** quantity across sizes (product stock is shared
   across variants), variant exists and has stock.
9. Resolve shipping cost from `shipping_methods` — never from the client — and check the
   method's `countries` against the address. Omitting `shipping_method_id` while a method
   exists for that country is now a `400 SHIPPING_METHOD_REQUIRED`: it used to mean free
   shipping to anywhere, which only a hand-written request ever took advantage of.
10. Compute `subtotal`, `tax`, `total` server-side.
11. Insert the `orders` row (`pending`), then `order_items`. If the lines fail, the order is
    deleted (best-effort rollback) so no orphan order remains.
12. Build Stripe line items from DB-resolved data; append shipping, and — in flat-rate mode —
    an explicit **"Estimated sales tax"** line so the charge equals the recorded total.
13. Create the session (`expires_at = now + 1 h`, `client_reference_id` and metadata carrying
    `order_id`/`user_id` on both the session and the payment intent). If Stripe fails, the order
    is marked `failed`.
14. Write `stripe_session_id` and move the order to `processing`; return the URL.

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
   `skip`, `invalid`, or `update`.
5. Apply the update; optionally fire the confirmation email (fire-and-forget — a Resend hiccup
   must not fail the webhook).
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
- Partial refunds record `refund_amount` but keep the order `paid`; only a refund covering the
  total moves it to `refunded`.
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

**Purpose:** customer cancel, admin refund, admin mark-delivered.
**Auth:** own JWT verification, then per-action authorisation. **CORS:** fail-closed.

**Request:** `{ "action": "cancel" | "refund" | "deliver", "order_id": "uuid", "amount"?: number }`
**Response:** `{ "order": { …with order_items and profile… } }`

**Authorisation order is deliberate.** The admin check for `refund`/`deliver` needs no order at
all, so it runs **before** the lookup — a non-admin is turned away without learning whether the
id exists. Ownership for `cancel` is checked immediately after the fetch and answers a uniform
`404`, not `403`. `refund_id` is only checked once the caller is entitled to the row. (Previously
the responses distinguished `404`, `409 ALREADY_REFUNDED` and `403 NOT_OWNER` for any order id.)

| Action | Who | Behaviour |
|---|---|---|
| `cancel` (pre-payment: `pending`/`processing`/`requires_action`) | order owner | Retrieves the Stripe session; **refuses** with `409 ORDER_ALREADY_PAID` if payment completed; expires an open session; then updates with the pre-payment status re-asserted in the `WHERE` so it cannot race the webhook |
| `cancel` (`paid`) | order owner | Full Stripe refund with idempotency key `refund_${orderId}`, order → `refunded`, refund email. Rate limited to **3 self-refunds per rolling 24 h**, counted via `refund_requested_by` — the limit used to filter on `user_id`, so three partial refunds the *shop* issued as goodwill locked the customer out of cancelling for a day. `refunded` (not `cancelled`) keeps the later `charge.refunded` webhook idempotent |
| `refund` | admin | Optional partial `amount`, capped at the order total. **Only a full refund** (`refundValue ≥ total − 0.005`) moves the order to `refunded` — that status restores every line's stock and drops the order from revenue, so a $10 refund on a $500 order used to do both. Partial refunds record the amount and leave the order fulfillable |
| `deliver` | admin | `shipped` → `delivered`, sets `delivered_at`, sends the delivery email |

The Stripe idempotency key means two concurrent requests create exactly **one** refund object;
`refund_id` is the per-order lock. A second, differently-sized refund must be issued from the
Stripe dashboard.

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

### 15.5 Shared modules

| Module | Exports | Notes |
|---|---|---|
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
   │                       │                        │ resolve prices ───────────────────────►│
   │                       │                        │ insert order(pending) + items ────────►│
   │                       │                        │ create session ───►│                   │
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
| Concurrent refund requests | Stripe idempotency key `refund_${orderId}` + `refund_id` UNIQUE lock |
| Client-supplied prices | Everything re-read from the DB server-side |
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
| `paid` → `refunded` | customer self-cancel, admin refund, or refund webhooks |
| `paid` → `shipped` | `update-tracking` |
| `shipped` → `delivered` | `handle-order-action` (`deliver`) |
| Any legal jump | admin, via the Orders page — the guard still applies |

### 17.2 Stock rules

- **Deducted only on the first transition to `paid`**, from a pre-payment status. Both
  `products.stock_quantity` and, for sized lines, `product_variants.stock_qty` are decremented.
- **Restored** on `paid` → `failed` / `cancelled` / `refunded`.
- **Negative stock is legal.** The `>= 0` constraints were dropped on purpose: the negative
  number *is* the backorder depth.
- **Paid orders are always honoured.** The trigger never raises — an exception here used to make
  the webhook fail forever on a paid-but-oversold order (money taken, order stuck).
- Oversell flags the order: `needs_review = true`, `review_reason = 'oversold'`. Flagged orders
  get a red **Needs review** badge in Admin → Orders (with a dedicated filter) and a counter on
  the dashboard.

Clearing a flag after handling it:

```sql
UPDATE public.orders SET needs_review = false, review_reason = null WHERE id = '<order-id>';
```

### 17.3 `needs_review` reasons

| Reason | Set by | Meaning |
|---|---|---|
| `oversold` | stock trigger | A counter went negative — restock or contact the customer |
| `amount mismatch: …` | webhook reconciliation | Stripe charged something other than the recorded total. Order held in `requires_action`, no confirmation email. Investigate and refund if needed |
| `<event>: <db error>` | webhook business-rule park | A Stripe event was rejected by a DB rule (e.g. paid event arriving after cancellation) |

---

## 18. Transactional email

| Email | Sent by | Trigger |
|---|---|---|
| Order confirmation | `stripe-webhook` | Order reaches `paid` (suppressed when held for review) |
| Shipping + tracking | `update-tracking` | Admin adds a tracking number |
| Refund confirmation | `handle-order-action` | Customer self-cancel of a paid order, or admin refund |
| Delivery confirmation | `handle-order-action` | Admin marks an order delivered |
| Sign-up / password reset / magic link | **Supabase Auth** | Customised in Supabase → Authentication → Email Templates |

All four code-sent emails go through `sendEmail()` → Resend, are **English**, and are wrapped by
`renderEmail()` (coloured header with the store name, body, footer). Every user-supplied value
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
| **Dashboard** (`/admin`) | Revenue chart (7/30 days with period-over-period delta), gross revenue, orders in 24 h / 7 d, `needs_review` counter, status breakdown, best seller, recent orders. One `admin_analytics()` RPC call |
| **Orders** (`/admin/orders`) | Paginated queue (50/page), filter by status and by "needs review", order drawer with items and customer, status changes constrained to legal transitions, tracking entry (→ `update-tracking`), mark delivered |
| **Catalogue** (`/admin/catalog`) | Active/archive tabs, search, inline stock edit, create/edit product drawer with multi-file image upload to Storage (first upload becomes primary), create category inline, toggle active/featured |
| **Finance** (`/admin/finance`) | Revenue by status, refundable orders (`paid`/`shipped`/`delivered`), refund drawer (→ `handle-order-action`) |

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

**80 tests across 4 files**, all passing at the time of writing. They cover the money-and-stock
logic that is expensive to get wrong:

| File | Covers |
|---|---|
| [`src/lib/pricing.test.ts`](src/lib/pricing.test.ts) | Tax base is `subtotal + shipping`; cent rounding; invalid/negative rates and inputs |
| [`src/store/cartStore.test.ts`](src/store/cartStore.test.ts) | Line identity per size, quantity clamping, catalogue sync (price adoption, dropped/deactivated products, variant-stock clamping, oversold products) |
| [`supabase/functions/_shared/webhook-logic.test.ts`](supabase/functions/_shared/webhook-logic.test.ts) | The full decision matrix: paid transitions, downgrade guards, partial vs full refunds, and every amount-reconciliation case in both tax modes |
| [`supabase/functions/_shared/address.test.ts`](supabase/functions/_shared/address.test.ts) | 19 cases: the `[object Object]` coercion, country allowlist, boundary lengths, postal patterns |

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
```

Deploy **all four**. `supabase/config.toml` carries the `verify_jwt` settings and is the only
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

- [ ] All migrations applied through **016**; verification queries pass (`set_user_role`
      allowlist form, the four length constraints, `has_column_privilege('anon', …,
      'cost_price')` = `false`).
- [ ] RLS shows **Enabled** on every table.
- [ ] pg_cron enabled and `expire-pending-orders` scheduled.
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
customer, refund, or investigate the amount mismatch in Stripe), then clear the flag with the
`UPDATE` in [§17.2](#172-stock-rules).

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
- Refunds are idempotent (Stripe key + a `UNIQUE` lock) and amount-capped.
- CORS fails closed; redirect URLs are built only from a verified origin.
- Queries go through the parameterised Supabase SDK. No `dangerouslySetInnerHTML`, `innerHTML`
  or `eval` anywhere. Email HTML escapes every user-supplied value.
- Abuse limits at both layers: rate limits in the functions, CHECK constraints and triggers in
  the database.

**Deliberately public:** the anon key, the project ref, active catalogue data, and reviews
without `user_id`.

**The operator's responsibility:** filling the legal placeholders, setting `ALLOWED_ORIGINS`,
keeping `STRIPE_TAX_ENABLED` in sync, applying migrations 015/016, and rotating keys.

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
| `docs/03_supabase_setup.md` says "migrations through 014" | Should say **016**; 015 and 016 are security migrations | Developer |
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
| `src/lib/pricing.ts` | Order totals (display estimate) |
| `src/lib/stock.ts` | Stock arithmetic |
| `src/lib/i18n.ts` / `i18nCopy.ts` | Dictionaries and the `useI18n()` hook |
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
| `supabase/migrations/001…016.sql` | Schema evolution ([§14](#14-migration-history)) |
| `supabase/seeds/002_mock_products.sql` | 35 demo products across 4 categories, 3 images each |
| `supabase/functions/create-checkout-session/index.ts` | Cart → order → Stripe session |
| `supabase/functions/stripe-webhook/index.ts` | Authoritative order-state updater |
| `supabase/functions/handle-order-action/index.ts` | Cancel / refund / deliver |
| `supabase/functions/update-tracking/index.ts` | Tracking + shipping email |
| `supabase/functions/_shared/*.ts` | CORS, address, store branding, email, webhook logic (+ 2 test files) |

---

## Appendix B — limits and constants

| Limit | Value | Enforced in |
|---|---|---|
| Line items per checkout | 50 | `create-checkout-session` |
| Quantity per merged line | 100 | `create-checkout-session` |
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
| `VALIDATION_NO_ITEMS` / `VALIDATION_TOO_MANY_ITEMS` / `VALIDATION_MISSING_PRODUCT_ID` / `INVALID_QUANTITY` | 400 | Malformed cart |
| `VALIDATION_INVALID_SHIPPING_ADDRESS` / `…_MISSING_SHIPPING_ADDRESS_FIELDS` / `…_TOO_LONG` / `VALIDATION_COUNTRY_NOT_SUPPORTED` / `VALIDATION_INVALID_POSTAL_CODE` | 400 | Address rejected by `sanitizeAddress()` |
| `RATE_LIMITED` | 429 | Hourly order cap or DB pending-order limit |
| `PRODUCT_NOT_FOUND` | 400 | Unknown product id |
| `PRODUCT_INACTIVE` / `INSUFFICIENT_STOCK` / `VARIANT_NOT_FOUND` | 409 | Not purchasable right now |
| `SHIPPING_METHOD_UNAVAILABLE` | 400 | Method missing or inactive |
| `DB_*_ERROR` | 500 | Database failure at the named phase |
| `STRIPE_SESSION_ERROR` / `STRIPE_SESSION_MISSING_URL` | 502 | Stripe API failure |
| `UNHANDLED_ERROR` | 500 | Anything else |

**`handle-order-action`**

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_MISSING_FIELDS` / `VALIDATION_UNKNOWN_ACTION` | 400 | Bad request |
| `AUTH_MISSING_HEADER` / `AUTH_INVALID_SESSION` | 401 | Auth |
| `AUTH_NOT_ADMIN` | 403 | Non-admin asked for `refund`/`deliver` |
| `ORDER_NOT_FOUND` | 404 | Unknown order — **also** returned when the caller does not own it |
| `ORDER_ALREADY_REFUNDED` | 409 | `refund_id` already set |
| `ORDER_ALREADY_PAID` | 409 | Cancel attempted after the Stripe session completed |
| `ORDER_NOT_CANCELABLE` / `ORDER_NOT_REFUNDABLE` / `ORDER_NOT_DELIVERABLE` | 409 | Wrong status for the action |
| `ORDER_MISSING_PAYMENT_INTENT` | 400 | Nothing to refund against |
| `INVALID_REFUND_AMOUNT` / `REFUND_AMOUNT_TOO_HIGH` | 400 | Bad partial-refund amount |
| `RATE_LIMITED` | 429 | More than 3 self-refunds in 24 h |
| `STRIPE_REFUND_ERROR` | 502 | Stripe API failure |

**`stripe-webhook`** returns `{ received: true }` (200), `{ received: true, duplicate: true }`
(200, already processed), `400` (missing or invalid signature), or `500` (transient — Stripe
should retry).
