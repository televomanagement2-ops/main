# CommerceJet — GitHub & Vercel Deploy

**Put your store online.**

## Contents

1. Test the build locally
2. Push the code to GitHub
3. Import the project into Vercel
4. Add environment variables
5. Deploy & verify
6. How updates work

> **Note —** Vercel hosts the frontend. It connects to your GitHub repo and rebuilds
> automatically every time you push. Do the Supabase guide (03) first — you'll need your
> Supabase URL and anon key here.

---

## 1. Test the build locally first

```bash
npm install
npm run build
```

This must finish with no errors before you deploy. If it builds locally, it builds on Vercel.

---

## 2. Push the code to GitHub

Create a repository at [github.com/new](https://github.com/new) (private is fine). Then:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

> **Important —** Make sure your real `.env` is **not** committed. The included `.gitignore`
> already excludes it — keep it that way. Only `.env.example` (placeholders) should be in the
> repo. If you ever distribute the project as a ZIP, delete `.env` first.

---

## 3. Import the project into Vercel

Go to [vercel.com](https://vercel.com) → Add New… → Project → import your GitHub repo. Vercel
auto-detects Vite. Confirm (usually auto-filled): **Framework** = Vite, **Build Command** =
`npm run build`, **Output Directory** = `dist`, **Install Command** = `npm install`.

> **Note —** The included `vercel.json` adds the SPA rewrite rule (all routes → `/index.html`)
> so React Router deep links work. No manual config needed.

---

## 4. Add environment variables

In the Vercel import screen (or later under Project → Settings → Environment Variables), add:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
VITE_TAX_RATE=0
```

> **Important —** Only variables starting with `VITE_` are exposed to the frontend. Never put
> secret keys (Stripe secret, `service_role`) in Vercel frontend variables — those belong in
> Supabase Edge Function secrets.

---

## 5. Deploy & verify

Click **Deploy**. After ~1 minute you'll get a live URL like `your-repo.vercel.app`.

- Open the URL — the storefront loads.
- Sign in / sign up — confirms it reaches Supabase.
- Browse products and add to cart.

> **Note —** Checkout won't fully work until Stripe is configured (guide 06) and, ideally,
> your custom domain + CORS are set (guide 05).

---

## 6. How updates work

Any change you push to the `main` branch triggers an automatic rebuild and redeploy on Vercel:

```bash
git add .
git commit -m "Describe your change"
git push
```
