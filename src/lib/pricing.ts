// ─────────────────────────────────────────────────────────────────────────────
// Order math — single source of truth for subtotal → tax → total.
//
// The tax shown here is a DISPLAY ESTIMATE only. The authoritative amount the
// customer is charged is computed by Stripe at checkout (and, when Stripe Tax is
// enabled, per the customer's address). Keep VITE_TAX_RATE in sync with the
// backend `TAX_RATE` env used by the create-checkout-session function.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configured display tax rate as a fraction (e.g. 0.07 = 7%).
 * Defaults to 0 — a fresh template shows no tax until the operator sets a rate
 * or enables Stripe Tax.
 */
export const TAX_RATE: number = parseRate(import.meta.env.VITE_TAX_RATE);

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  taxRate: number;
  tax: number;
  total: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function parseRate(raw: unknown): number {
  const n = raw == null || raw === '' ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Compute order totals. Tax is applied to (subtotal + shipping), matching the
 * server. All returned values are rounded to the cent.
 */
export function computeOrderTotals(
  subtotal: number,
  shipping = 0,
  taxRate: number = TAX_RATE,
): OrderTotals {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeShipping = Math.max(0, Number(shipping) || 0);
  const safeRate = parseRate(taxRate);
  const tax = round2((safeSubtotal + safeShipping) * safeRate);
  const total = round2(safeSubtotal + safeShipping + tax);
  return {
    subtotal: round2(safeSubtotal),
    shipping: round2(safeShipping),
    taxRate: safeRate,
    tax,
    total,
  };
}
