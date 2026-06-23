# CommerceJet — Brand Customization

**Name, logo, colors, emails & languages.**

## Contents

1. Change the store name & contact details
2. Change the logo & favicon
3. Change the brand colors (light & dark mode)
4. Personalize the automatic emails
5. Languages & translations
6. Rebuild and verify

---

## 1. Change the store name & contact details

The brand name and customer-facing contact details are **centralized in one file**:
[`src/config/storeConfig.ts`](../src/config/storeConfig.ts). Edit it once — the values flow
into the navbar, sidebar, footer, login page, Help page, and the legal pages (in all
languages). You do **not** need to edit individual components.

| Field | What to put |
|---|---|
| `storeName` | Your public brand name (shown across the UI) |
| `contactEmail` | Customer support email |
| `supportPhone` | Support phone number |
| `privacyEmail` | Privacy/data-protection email |
| `countryCode` / `countryName` | Shown in the footer (your location) |
| `sellerLegalName`, `businessAddress`, `governingState`, … | Legal `[PLACEHOLDER]` fields injected into Terms / Privacy / Cookie pages |

> **Note —** The default `contactEmail`/`privacyEmail` are `example.com` placeholders and the
> legal fields are `[PLACEHOLDER]` tokens, so unfilled values are obvious. Fill them all
> before going live.

The browser tab **title** is in [`index.html`](../index.html) (`<title>`).

---

## 2. Change the logo & favicon

The favicon (browser-tab logo) is [`public/favicon.svg`](../public/favicon.svg), referenced
in `index.html`. Replace the file (keep the same name, or update the `<link rel="icon">` tag
if you rename it).

The in-app wordmark is rendered from `storeConfig.storeName` as text, so changing the store
name in step 1 updates it everywhere automatically.

---

## 3. Change the brand colors

All colors are CSS custom properties in
[`src/styles/globals.css`](../src/styles/globals.css). The primary accent is `--accent`
near the top of the file:

```css
--accent:        #14110E;  /* primary brand ink */
--accent-hover:  #000000;
--accent-subtle: #F4F2EF;  /* light accent wash */
```

The site has a full **dark theme**; its overrides live further down the same file under the
`html.dark { … }` block — update the dark `--accent` there too so both themes match.

> **Note —** Light/dark/system mode is controlled by
> [`src/store/themeStore.ts`](../src/store/themeStore.ts) and remembered in the browser. You
> don't need to touch it to change colors.

---

## 4. Personalize the automatic emails

Transactional emails (shipped, refund, delivered) are sent by the Edge Functions and are
**English by default**. Because Edge Functions run in Deno and can't read `storeConfig.ts`,
their branding is configured with **Edge Function secrets** (Supabase → Project Settings →
Edge Functions → Secrets). All have safe defaults, so set only what you want to change:

```
STORE_NAME=Your Store
SUPPORT_EMAIL=support@yourstore.com
RESEND_FROM_EMAIL=Your Store <support@yourstore.com>
STORE_CURRENCY=USD
STORE_LOCALE=en-US
STORE_BRAND_COLOR=#111111
```

The shared email template lives in
[`supabase/functions/_shared/store.ts`](../supabase/functions/_shared/store.ts) if you want to
customize the layout itself. Redeploy `update-tracking` and `handle-order-action` after code
changes (secret changes need no redeploy).

> **Note —** Sign-up confirmation, password-reset, and magic-link emails are sent by
> **Supabase Auth**, not this code. Customize them under Supabase → Authentication → Email
> Templates.

---

## 5. Languages & translations

The store ships with **4 languages**: English (default), Italian, Spanish, French. All UI
text lives in [`src/lib/i18n.ts`](../src/lib/i18n.ts), organized by language. To change
wording, edit the values in the relevant language section. The default language and the
language selector options are in
[`src/store/preferencesStore.ts`](../src/store/preferencesStore.ts).

To add a language, copy an existing block in `i18n.ts`, translate it, and add it to
`LANGUAGE_OPTIONS` / `AppLanguageCode` in `preferencesStore.ts`.

---

## 6. Rebuild and verify

```bash
npm install
npm run dev    # preview locally at http://localhost:5173
npm run build  # production build, must finish with no errors
```

Click through the navbar, footer, mobile menu, and a product page to confirm the new name,
logo, and colors appear everywhere.
