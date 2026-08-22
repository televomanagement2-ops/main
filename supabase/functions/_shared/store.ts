// ─────────────────────────────────────────────────────────────────────────────
// Shared store/brand configuration for Edge Functions (transactional emails).
//
// Edge Functions run in Deno and CANNOT import the frontend's
// src/config/storeConfig.ts. Brand details for emails are configured here via
// Edge Function secrets, with demo-safe defaults so everything works out of the
// box. The store operator overrides them in Supabase → Edge Functions → Secrets:
//
//   STORE_NAME          Public brand name shown in emails (default "AURUM")
//   SUPPORT_EMAIL       Reply/support address (default "support@example.com")
//   RESEND_FROM_EMAIL   Full "from" header; overrides the two above if set
//   STORE_CURRENCY      ISO currency for money in emails (default "USD")
//   STORE_LOCALE        Locale for number/currency formatting (default "en-US")
//   STORE_BRAND_COLOR   Header color in emails (default "#111111")
// ─────────────────────────────────────────────────────────────────────────────

export const STORE_NAME = Deno.env.get('STORE_NAME') ?? 'AURUM';
export const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? 'support@example.com';
export const FROM_EMAIL =
  Deno.env.get('RESEND_FROM_EMAIL') ?? `${STORE_NAME} <${SUPPORT_EMAIL}>`;
export const STORE_CURRENCY = Deno.env.get('STORE_CURRENCY') ?? 'USD';
export const STORE_LOCALE = Deno.env.get('STORE_LOCALE') ?? 'en-US';
export const BRAND_COLOR = Deno.env.get('STORE_BRAND_COLOR') ?? '#111111';

/** Escape user-supplied text before embedding it in email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a money amount using the store currency + locale. */
export function formatMoney(amount: number, currency: string = STORE_CURRENCY): string {
  return new Intl.NumberFormat(STORE_LOCALE, { style: 'currency', currency }).format(amount);
}

/**
 * Wrap an email body in a consistent, brandable layout: a colored header with the
 * store name, the content, and a footer. `bodyHtml` is trusted HTML built by the
 * caller; escape any user-supplied values with escapeHtml() before passing them in.
 */
export function renderEmail(opts: { eyebrow?: string; heading: string; bodyHtml: string }): string {
  const { eyebrow, heading, bodyHtml } = opts;
  const year = new Date().getFullYear();
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
      <div style="background: ${BRAND_COLOR}; padding: 24px 32px;">
        <p style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: 0.04em;">${escapeHtml(STORE_NAME)}</p>
      </div>
      <div style="padding: 40px 32px; color: #111;">
        ${eyebrow ? `<p style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px;">${escapeHtml(eyebrow)}</p>` : ''}
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 24px; line-height: 1.3;">${heading}</h1>
        ${bodyHtml}
        <div style="border-top: 1px solid #eee; padding-top: 24px; margin-top: 32px;">
          <p style="font-size: 13px; color: #888; margin: 0;">Thanks for shopping with ${escapeHtml(STORE_NAME)}.</p>
          <p style="font-size: 13px; color: #bbb; margin: 4px 0 0;">© ${year} ${escapeHtml(STORE_NAME)}. All rights reserved.</p>
        </div>
      </div>
    </div>`;
}
