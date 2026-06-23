# CommerceJet — Start Here

**Your roadmap to launching the store.**

Welcome, and thank you for your purchase! CommerceJet is a complete, production-ready
e-commerce storefront built with **React, Vite, Supabase and Stripe**. This package contains
the full source code plus step-by-step guides that take you from zero to a live, paid store.

> **Note —** You don't need to be a developer to launch this store, but you should be
> comfortable copying values between dashboards (Supabase, Stripe, Vercel) and running a few
> terminal commands. Take it one guide at a time.

## What you need (all have free tiers)

- **Node.js (LTS)** — to install and build the project locally.
- **GitHub** account — to host your code.
- **Supabase** account — database, authentication, and backend functions.
- **Stripe** account — to accept payments.
- **Vercel** account — to host the website.
- **Resend** account (optional) — to send shipping/refund/delivery emails.
- A **custom domain** (optional) — e.g. `yourstore.com`.

## Recommended reading order

1. **03 — Supabase Setup.** Create the database, enable login (incl. Google), deploy the
   backend functions. This is the foundation; do it first.
2. **06 — Stripe Setup.** Connect payments, the webhook that confirms orders, and sales tax.
3. **04 — GitHub & Vercel Deploy.** Put the site online.
4. **05 — Domain & CORS.** Connect your domain and lock down cross-origin access.
5. **01 — Brand Customization.** Make it yours: name, logo, colors, emails, languages.
6. **02 — Products Setup.** Remove the demo catalog and add your real products.

> **Tip —** You can read 01 (Brand) and 02 (Products) any time. But get the store *working*
> first (03, 06, 04), then personalize it.

## The 60-second overview

| Layer | Technology | What it does |
|---|---|---|
| Frontend | React 19 + Vite | The website your customers see. |
| Hosting | Vercel | Serves the website on the internet. |
| Database & Auth | Supabase | Stores products, orders, users; handles login. |
| Backend logic | Supabase Edge Functions | Checkout, webhooks, tracking, refunds, emails. |
| Payments | Stripe | Processes card payments securely. |
| Emails | Resend (optional) | Sends shipping/refund/delivery emails. |

This store ships with **four** Edge Functions: `create-checkout-session`, `stripe-webhook`,
`update-tracking`, and `handle-order-action`.

> **Important —** Never commit your `.env` file or share your secret keys. Use the provided
> `.env.example` as a template and keep your real keys private. If you distribute the project
> as a ZIP, delete `.env` first.

*For the full technical reference see `README.md`, `HANDOVER_GUIDE.md`, and
`supabase/SETUP_CHECKLIST.md`.*
