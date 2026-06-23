# CommerceJet — Domain & CORS

**Connect your domain and secure cross-origin access.**

## Contents

1. Connect a custom domain in Vercel
2. Update Supabase Auth URLs
3. Update Google OAuth origins
4. Lock down CORS for production
5. Verify everything

> **Note —** "CORS" controls which websites may call your backend functions from a browser.
> During development the functions accept any origin (`*`); before going live, restrict them
> to your own domain. **This is done entirely with a secret — no code editing.**

---

## 1. Connect a custom domain in Vercel

Vercel → Project → Settings → Domains → Add. Enter your domain (e.g. `yourstore.com`). Vercel
shows the DNS records to create at your registrar (an A record for the root, or a CNAME to
`cname.vercel-dns.com` for `www`/subdomains). Vercel issues HTTPS automatically once DNS is
verified.

---

## 2. Update Supabase Auth URLs

The app redirects users back to your site after login. Tell Supabase the address:

Supabase → Authentication → URL Configuration → set **Site URL** to `https://yourstore.com`
and add it (and `https://www.yourstore.com`) to **Redirect URLs** (as `https://yourstore.com/**`).

> **Important —** Skip this and Google login / email links may redirect to the wrong address
> (or to localhost) after authentication.

---

## 3. Update Google OAuth origins

In Google Cloud Console → your OAuth client:

- Keep the Supabase callback as the **Authorized redirect URI**:
  `https://<project-ref>.supabase.co/auth/v1/callback`
- Add your live domain under **Authorized JavaScript origins**: `https://yourstore.com`

---

## 4. Lock down CORS for production

CORS is **configured by a secret, not by editing code**. The browser-facing Edge Functions
(`create-checkout-session`, `update-tracking`, `handle-order-action`) read the
`ALLOWED_ORIGINS` secret at runtime.

1. Supabase → Project Settings → Edge Functions → Secrets → Add secret.
2. Name: `ALLOWED_ORIGINS` — Value: your origin(s), comma-separated, no spaces, no trailing
   slash:
   ```
   https://yourstore.com,https://www.yourstore.com
   ```
3. (Optional) While the Vercel preview subdomain keeps changing, any `*.vercel.app` origin is
   accepted automatically. To turn that off once on your final domain, add:
   ```
   ALLOW_VERCEL_PREVIEWS=false
   ```
4. Save. **No redeploy needed** — secrets are read at runtime. If `ALLOWED_ORIGINS` is unset,
   CORS falls back to `*` (fine for dev, not for production).

> **Note —** The `stripe-webhook` function is called by Stripe's servers (not a browser), so
> it doesn't use CORS. CORS is not the security boundary — every privileged call still
> requires a valid login token and passes server-side role/ownership checks.

---

## 5. Verify everything

- Visit `https://yourstore.com` — site loads over HTTPS.
- Log in with email and with Google — you're returned to your domain, logged in.
- Add to cart → checkout → you reach Stripe, with **no CORS error** in the browser console.

> **Important —** If checkout shows a CORS error after restricting origins, double-check that
> `ALLOWED_ORIGINS` matches your site exactly (https, no trailing slash) and includes every
> origin you serve from (both `www` and non-`www`).
