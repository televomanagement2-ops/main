# CommerceJet — Store Owner Setup & Handover Guide

Welcome. This guide is for the **store operator** (the person/company that licensed this
software and will run the store). Follow it end-to-end before going live. It links to
[`supabase/SETUP_CHECKLIST.md`](supabase/SETUP_CHECKLIST.md) for the detailed backend steps.

> **You are the seller and data controller of your store.** The legal documents shipped
> with this software are configurable **templates**, not legal advice. You are responsible
> for completing them with your real details and having them reviewed for your market.
> See [`EULA.md`](EULA.md).

---

## Step 1 — Your business & legal details (required)

Open [`src/config/storeConfig.ts`](src/config/storeConfig.ts) and replace every
`[PLACEHOLDER]` with your real information. You edit this **once** and it populates the
Terms of Service, Privacy Policy, and Cookie Policy in all four languages automatically.

| Field | What to put |
|---|---|
| `storeName` | Your public brand name |
| `sellerLegalName` / `sellerEntityType` | Registered legal name + entity type (LLC, Inc., Ltd…) |
| `businessAddress` | Full registered address |
| `contactEmail` / `supportPhone` | Customer-facing contact for orders/returns/support |
| `privacyEmail` | Email for privacy requests |
| `governingState` | U.S. state whose law governs your Terms |
| `arbitrationBody` | Arbitration provider for U.S. disputes |
| `returnWindow` | Your return window in days (e.g. `30`) |
| `euResponsiblePerson` / `euResponsibleContact` | **Required only if you sell to the EU** (GPSR) |
| `euRepresentative` | GDPR Art. 27 EU/UK representative, if appointed |

Also update brand contact details in the site footer
([`src/components/layout/Footer.tsx`](src/components/layout/Footer.tsx)): support email,
phone, and copyright name.

> Tip: any value you leave as `[...]` will appear literally on the legal pages, so it is
> obvious what is still missing. Do not go live with `[PLACEHOLDER]` values visible.

---

## Step 2 — Backend infrastructure (Supabase, Stripe, Resend)

Each store runs on **its own** Supabase project and **its own** Stripe/Resend accounts.
Follow [`supabase/SETUP_CHECKLIST.md`](supabase/SETUP_CHECKLIST.md):

1. Create a Supabase project; run the SQL files (schema, RLS, migrations, seed) in order.
2. Configure Google OAuth (optional) and the frontend `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Create a Stripe account; add the webhook endpoint and events.
4. Set the Edge Function **secrets** (Supabase → Settings → Edge Functions → Secrets):
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`,
   and **`ALLOWED_ORIGINS`** (see Step 3).
5. Deploy **all four** Edge Functions: `create-checkout-session`, `stripe-webhook`,
   `update-tracking`, `handle-order-action`.

---

## Step 3 — Security: lock the API to your domain

The Edge Functions only accept browser requests from origins you explicitly allow. Without
this step the API is open to `*` — fine for local dev, **not acceptable in production**.

### Where to find your domain

- **Vercel deployment**: log in to [vercel.com](https://vercel.com) → your project →
  **Settings → Domains**. Copy the production URL (e.g. `https://your-store.vercel.app`).
  If you have a custom domain (e.g. `https://mystore.com`), add that too.
- **Custom domain on another host**: whatever URL your store is served from.

### How to set it in Supabase

1. Go to [supabase.com](https://supabase.com) → your project → **Settings** (left sidebar)
   → **Edge Functions** → **Secrets**.
2. Click **Add secret**.
3. Name: `ALLOWED_ORIGINS`  
   Value: your URL(s), comma-separated, no spaces, no trailing slash:
   ```
   https://your-store.vercel.app,https://www.mystore.com
   ```
4. Click **Save**. No redeploy needed — secrets are read at runtime.

> Include every origin where the store is accessible. If you use both `www` and non-`www`,
> include both. Do not include local dev URLs in production (they'd be ignored by browsers
> anyway due to CORS, but it is cleaner not to list them).

Other security notes (already built in): customer prices are recomputed server-side from
the database (no price tampering), card data never touches your servers (Stripe), Row Level
Security is enforced on all tables. See [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md).

---

## Step 4 — Make the first admin

After signing up your own account, promote it to admin in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@your-domain.com';
```

Admins access `/admin` (dashboard, orders, catalog, finance).

---

## Step 5 — Legal compliance (your responsibility)

- **Complete** all values in Step 1 and have your Terms / Privacy / Cookie pages reviewed
  for your jurisdiction(s).
- **United States:** the docs cover CCPA/CPRA and other state laws, "we do not sell" +
  Global Privacy Control, and include binding arbitration + class-action waiver (with a
  30-day opt-out). Confirm `governingState` and your return policy.
- **Selling to the EU/EEA (optional):** the docs already include EU consumer rights
  (14-day withdrawal, 2-year legal guarantee), GDPR, and the discontinued ODR note.
  Before selling to EU consumers you must additionally:
  - appoint an **EU responsible person (GPSR)** and fill `euResponsiblePerson` /
    `euResponsibleContact`;
  - publish an **accessibility statement (European Accessibility Act)** and meet
    EN 301 549 / WCAG 2.1 AA.
- The cookie banner is granular and consent is logged for 12 months; no extra CMP needed.

---

## Step 6 — Go-live checklist

- [ ] `src/config/storeConfig.ts` fully filled (no `[...]` left).
- [ ] Footer contact details updated.
- [ ] Supabase migrations applied; RLS enabled on every table.
- [ ] All four Edge Functions deployed; secrets set, including `ALLOWED_ORIGINS`.
- [ ] Stripe in **live** mode; webhook endpoint + events configured; test purchase verified.
- [ ] First admin account promoted.
- [ ] Legal pages reviewed; (EU) GPSR responsible person + accessibility statement in place.
- [ ] HTTPS enforced on your domain.

---

*Need a translated version of this guide for your buyers? It can be provided in IT/ES/FR.*
