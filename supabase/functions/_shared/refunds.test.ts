import { describe, expect, it } from 'vitest';
import { refundRemaining, shippingPaid, suggestRefund, type RefundableLine, type RefundableOrder } from './refunds';

// Two shirts at 50 and a cap at 20, 10% code (12 off: 10 on the shirts, 2 on
// the cap), 10 shipping, 10% flat tax on (120 - 12 + 10) = 11.80.
const order: RefundableOrder = {
  subtotal: 120,
  discount_amount: 12,
  shipping_cost: 10,
  shipping_discount: 0,
  tax_amount: 11.8,
  total: 129.8,
  refund_amount: 0,
};

const lines: RefundableLine[] = [
  { id: 'shirt', unit_price: 50, quantity: 2, discount_amount: 10 },
  { id: 'cap', unit_price: 20, quantity: 1, discount_amount: 2 },
];

describe('suggestRefund', () => {
  it('refunds a unit at what was paid for it, plus its tax', () => {
    const s = suggestRefund(order, lines, [{ order_item_id: 'shirt', quantity: 1 }], 0);
    expect(s).toEqual({ items: 45, shipping: 0, tax: 4.5, total: 49.5, capped: false });
  });

  it('refunding everything, shipping included, is the order total', () => {
    const s = suggestRefund(
      order,
      lines,
      [
        { order_item_id: 'shirt', quantity: 2 },
        { order_item_id: 'cap', quantity: 1 },
      ],
      10,
    );
    expect(s.total).toBe(129.8);
    expect(s.capped).toBe(false);
  });

  it('never suggests more than is left, nor more units than are left', () => {
    const partly: RefundableOrder = { ...order, refund_amount: 100 };
    const s = suggestRefund(partly, [{ ...lines[0], refunded_quantity: 1 }], [{ order_item_id: 'shirt', quantity: 2 }], 0);
    expect(s.items).toBe(45);
    expect(s.total).toBe(29.8);
    expect(s.capped).toBe(true);
  });

  it('caps shipping at what the customer paid for it', () => {
    const freeShip: RefundableOrder = { ...order, shipping_discount: 10, discount_amount: 22 };
    expect(shippingPaid(freeShip)).toBe(0);
    expect(suggestRefund(freeShip, lines, [], 10).shipping).toBe(0);
  });

  it('works without tax or discounts', () => {
    const plain: RefundableOrder = { subtotal: 40, shipping_cost: 5, tax_amount: 0, total: 45 };
    expect(suggestRefund(plain, [{ id: 'x', unit_price: 20, quantity: 2 }], [{ order_item_id: 'x', quantity: 1 }], 5))
      .toEqual({ items: 20, shipping: 5, tax: 0, total: 25, capped: false });
    expect(refundRemaining(plain)).toBe(45);
  });
});
