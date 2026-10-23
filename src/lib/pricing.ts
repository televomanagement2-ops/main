// ─────────────────────────────────────────────────────────────────────────────
// Order math — single source of truth for subtotal → discount → tax → total.
//
// The tax shown here is a DISPLAY ESTIMATE only. The authoritative amount the
// customer is charged is computed by Stripe at checkout (and, when Stripe Tax is
// enabled, per the customer's address). Keep VITE_TAX_RATE in sync with the
// backend `TAX_RATE` env used by the create-checkout-session function.
// ─────────────────────────────────────────────────────────────────────────────

import type { CartItemLocal, Product } from '../types';
import { lineVariant } from './stock';
import { variantPrice } from './variants';

/**
 * Configured display tax rate as a fraction (e.g. 0.07 = 7%).
 * Defaults to 0 — a fresh template shows no tax until the operator sets a rate
 * or enables Stripe Tax.
 */
export const TAX_RATE: number = parseRate(import.meta.env.VITE_TAX_RATE);

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  /** Taken off by a discount code (items + shipping). */
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
}

/** What a discount code takes off — the shape of computeDiscount's result. */
export interface DiscountAmounts {
  items: number;
  shipping: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function parseRate(raw: unknown): number {
  const n = raw == null || raw === '' ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Compute order totals. Tax is applied to what is charged — subtotal and
 * shipping, after any discount — matching create-checkout-session. All
 * returned values are rounded to the cent.
 */
export function computeOrderTotals(
  subtotal: number,
  shipping = 0,
  taxRate: number = TAX_RATE,
  discount: DiscountAmounts = { items: 0, shipping: 0 },
): OrderTotals {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeShipping = Math.max(0, Number(shipping) || 0);
  const itemsOff = Math.min(Math.max(0, Number(discount.items) || 0), safeSubtotal);
  const shippingOff = Math.min(Math.max(0, Number(discount.shipping) || 0), safeShipping);
  const safeRate = parseRate(taxRate);
  const taxable = safeSubtotal - itemsOff + safeShipping - shippingOff;
  const tax = round2(taxable * safeRate);
  const total = round2(taxable + tax);
  return {
    subtotal: round2(safeSubtotal),
    shipping: round2(safeShipping),
    discount: round2(itemsOff + shippingOff),
    taxRate: safeRate,
    tax,
    total,
  };
}

/** The price of one unit of a cart line: its variant's price, or the product's. */
export function unitPrice(product: Product, variantId?: string | null, legacySize?: string | null): number {
  const variant = lineVariant(product, variantId, legacySize);
  return variantPrice(product, variant ?? null);
}

export function lineTotal(item: CartItemLocal): number {
  return round2(unitPrice(item.product, item.variantId, item.selectedSize) * item.quantity);
}

export function cartSubtotal(items: readonly CartItemLocal[]): number {
  return round2(items.reduce((sum, item) => sum + lineTotal(item), 0));
}
