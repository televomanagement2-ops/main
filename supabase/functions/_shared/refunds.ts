// ─────────────────────────────────────────────────────────────────────────────
// Refund arithmetic: what returning some lines (and some shipping) is worth.
//
// Shared by the admin's refund dialog (the suggestion it shows) and
// handle-order-action (which refunds a whole order's remainder). The admin
// may still type a different amount; the database caps every refund at what
// is left to refund (begin_order_refund, migration 024).
// ─────────────────────────────────────────────────────────────────────────────

export interface RefundableOrder {
  total: number;
  subtotal: number;
  shipping_cost: number;
  shipping_discount?: number | null;
  discount_amount?: number | null;
  tax_amount: number;
  /** Refunded so far. */
  refund_amount?: number | null;
}

export interface RefundableLine {
  id: string;
  unit_price: number;
  quantity: number;
  /** The line's share of the order's discount code. */
  discount_amount?: number | null;
  refunded_quantity?: number | null;
}

export interface RefundPick {
  order_item_id: string;
  quantity: number;
}

export interface RefundSuggestion {
  items: number;
  shipping: number;
  tax: number;
  /** items + shipping + tax, capped at what is left to refund. */
  total: number;
  /** True when the cap applied. */
  capped: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What is left to refund on the order. */
export function refundRemaining(order: RefundableOrder): number {
  return Math.max(0, round2(Number(order.total) - Number(order.refund_amount ?? 0)));
}

/** Units of a line not refunded yet. */
export function refundableUnits(line: RefundableLine): number {
  return Math.max(0, line.quantity - (line.refunded_quantity ?? 0));
}

/** The shipping the customer actually paid (after a free-shipping code). */
export function shippingPaid(order: RefundableOrder): number {
  return Math.max(0, round2(Number(order.shipping_cost) - Number(order.shipping_discount ?? 0)));
}

/**
 * The refund for these units and this much shipping: each line at what was
 * paid for it (its price less its discount share), plus the tax charged on
 * that, in proportion — tax was charged on items + shipping after discounts.
 */
export function suggestRefund(
  order: RefundableOrder,
  lines: readonly RefundableLine[],
  picks: readonly RefundPick[],
  shipping: number,
): RefundSuggestion {
  const byId = new Map(lines.map((line) => [line.id, line]));

  let items = 0;
  for (const pick of picks) {
    const line = byId.get(pick.order_item_id);
    if (!line || line.quantity <= 0) continue;
    const quantity = Math.min(Math.max(0, Math.trunc(pick.quantity)), refundableUnits(line));
    const perUnitDiscount = Number(line.discount_amount ?? 0) / line.quantity;
    items += (Number(line.unit_price) - perUnitDiscount) * quantity;
  }

  const shippingAmount = Math.min(Math.max(0, shipping), shippingPaid(order));
  const taxBase =
    Number(order.subtotal) - Number(order.discount_amount ?? 0) + Number(order.shipping_cost);
  const tax =
    Number(order.tax_amount) > 0 && taxBase > 0
      ? ((items + shippingAmount) / taxBase) * Number(order.tax_amount)
      : 0;

  const raw = round2(round2(items) + round2(shippingAmount) + round2(tax));
  const remaining = refundRemaining(order);
  return {
    items: round2(items),
    shipping: round2(shippingAmount),
    tax: round2(tax),
    total: Math.min(raw, remaining),
    capped: raw > remaining,
  };
}
