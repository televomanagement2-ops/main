// ─────────────────────────────────────────────────────────────────────────────
// Store currency: the single definition of what money the store charges in.
//
// This file is imported by BOTH the Edge Functions (Deno) and the storefront
// (Vite/React), exactly like _shared/address.ts. That is the whole point.
// The currency used to live in three places that could disagree:
//
//   • create-checkout-session hard-coded 'usd' on every Stripe line item,
//   • the storefront hard-coded 'USD' in Intl.NumberFormat,
//   • the emails read a STORE_CURRENCY Edge Function secret — which was not
//     even listed in .env.example.
//
// An operator who set STORE_CURRENCY=EUR therefore charged the card in dollars
// and told the customer "€" in the confirmation email. A constant cannot drift
// from itself, so the divergence is gone by construction rather than by
// discipline: there is no second value to keep in sync.
//
// Keep this file free of Deno and browser APIs so both runtimes can load it —
// which also means the value is a literal, NOT an environment variable.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ISO 4217 currency the store charges in. The licensee changes THIS value, once.
 *
 * It must be a currency enabled on your Stripe account. It also decides which
 * payment methods Stripe can offer: the local European methods (iDEAL,
 * Bancontact) are EUR-only, so a store left on 'USD' will only ever show cards
 * to a Dutch customer no matter what is enabled in the Stripe Dashboard.
 */
export const STORE_CURRENCY = 'USD';

/** Lower-case form Stripe's API expects on `price_data.currency`. */
export const STRIPE_CURRENCY = STORE_CURRENCY.toLowerCase();

/**
 * Format an amount in the store currency for a given locale.
 *
 * Currency and locale are deliberately separate arguments: the currency is a
 * property of the STORE (what the card is charged in) and must never vary,
 * while the locale is a property of the READER (how the number is punctuated)
 * and legitimately differs between the storefront's language picker and the
 * transactional emails.
 */
export function formatMoneyIn(
  amount: number,
  locale: string,
  currency: string = STORE_CURRENCY,
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
