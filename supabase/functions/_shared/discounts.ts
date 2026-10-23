// ─────────────────────────────────────────────────────────────────────────────
// Discount codes: what a code takes off a cart.
//
// Imported by BOTH create-checkout-session (which charges it) and the checkout
// page (which previews it), like address.ts and money.ts — so the figure the
// shopper sees before paying is computed by the same code that computes what
// Stripe is asked for. The database (migration 025) only stores the rules and
// counts the uses; the arithmetic lives here, in integer cents.
// ─────────────────────────────────────────────────────────────────────────────

export type DiscountKind = 'percent' | 'fixed' | 'free_shipping';
export type DiscountScope = 'all' | 'categories' | 'products';

/** Mirrors discount_codes_code_check (migration 025). */
export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

export interface DiscountRule {
  code: string;
  kind: DiscountKind;
  value: number | string;
  min_subtotal: number | string;
  applies_to: DiscountScope;
  category_ids: readonly string[];
  product_ids: readonly string[];
  exclude_sale_items: boolean;
}

export interface DiscountLine {
  /** Stable id of the line, the key of its allocation. */
  key: string;
  product_id: string;
  category_id: string | null;
  unit_price: number;
  quantity: number;
  /** Sold below its compare-at price. */
  on_sale: boolean;
}

export type DiscountFailure = 'min_subtotal' | 'no_eligible_items' | 'no_effect';

export type DiscountOutcome =
  | {
      ok: true;
      /** Taken off the items, split across them in `allocations`. */
      items: number;
      /** Taken off shipping (a free-shipping code). */
      shipping: number;
      total: number;
      eligibleSubtotal: number;
      /** Line key → its share of `items`. Sums exactly to `items`. */
      allocations: Record<string, number>;
    }
  | { ok: false; reason: DiscountFailure; minSubtotal: number };

/** "  summer-10 " → "SUMMER-10". */
export const normalizeDiscountCode = (raw: string): string => raw.trim().toUpperCase();

const cents = (amount: number | string): number => Math.round(Number(amount) * 100);
const units = (value: number): number => Math.round(value) / 100;

/**
 * What `rule` takes off these lines (and off `shippingCost`, for a
 * free-shipping code).
 *
 * `ancestors` maps a category to itself and its parents, so a code for
 * "Clothing" also covers a product filed under "Clothing › Shirts". Without
 * it, only the product's own category counts.
 */
export function computeDiscount(
  rule: DiscountRule,
  lines: readonly DiscountLine[],
  shippingCost: number,
  ancestors?: (categoryId: string) => readonly string[],
): DiscountOutcome {
  const minSubtotal = units(cents(rule.min_subtotal));
  const lineCents = (line: DiscountLine) => cents(line.unit_price) * line.quantity;
  const subtotal = lines.reduce((sum, line) => sum + lineCents(line), 0);

  if (subtotal < cents(rule.min_subtotal)) {
    return { ok: false, reason: 'min_subtotal', minSubtotal };
  }

  const categoryIds = new Set(rule.category_ids);
  const productIds = new Set(rule.product_ids);
  const eligible = lines.filter((line) => {
    if (rule.exclude_sale_items && line.on_sale) return false;
    if (rule.applies_to === 'products') return productIds.has(line.product_id);
    if (rule.applies_to === 'categories') {
      if (!line.category_id) return false;
      const chain = ancestors ? ancestors(line.category_id) : [line.category_id];
      return chain.some((id) => categoryIds.has(id));
    }
    return true;
  });
  const eligibleCents = eligible.reduce((sum, line) => sum + lineCents(line), 0);

  let itemsCents = 0;
  let shippingCents = 0;
  if (rule.kind === 'percent') {
    itemsCents = Math.round((eligibleCents * Number(rule.value)) / 100);
  } else if (rule.kind === 'fixed') {
    itemsCents = Math.min(cents(rule.value), eligibleCents);
  } else {
    shippingCents = Math.max(0, cents(shippingCost));
  }
  itemsCents = Math.min(Math.max(itemsCents, 0), eligibleCents);

  if (itemsCents + shippingCents === 0) {
    return {
      ok: false,
      reason: rule.kind !== 'free_shipping' && eligible.length === 0 ? 'no_eligible_items' : 'no_effect',
      minSubtotal,
    };
  }

  // Split the items discount across the eligible lines in proportion to their
  // value, in whole cents that add up exactly (largest remainder). A refund of
  // one line later gives back that line's share, not an average.
  const allocations: Record<string, number> = {};
  if (itemsCents > 0) {
    const shares = eligible.map((line, index) => {
      const exact = (itemsCents * lineCents(line)) / eligibleCents;
      return { key: line.key, index, base: Math.floor(exact), rest: exact - Math.floor(exact) };
    });
    let left = itemsCents - shares.reduce((sum, s) => sum + s.base, 0);
    for (const share of [...shares].sort((a, b) => b.rest - a.rest || a.index - b.index)) {
      if (left <= 0) break;
      share.base += 1;
      left -= 1;
    }
    for (const share of shares) allocations[share.key] = units(share.base);
  }

  return {
    ok: true,
    items: units(itemsCents),
    shipping: units(shippingCents),
    total: units(itemsCents + shippingCents),
    eligibleSubtotal: units(eligibleCents),
    allocations,
  };
}
