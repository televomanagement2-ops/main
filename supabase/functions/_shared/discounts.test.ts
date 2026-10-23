import { describe, expect, it } from 'vitest';
import { computeDiscount, normalizeDiscountCode, DISCOUNT_CODE_PATTERN, type DiscountLine, type DiscountRule } from './discounts';

const rule = (over: Partial<DiscountRule> = {}): DiscountRule => ({
  code: 'SAVE10',
  kind: 'percent',
  value: 10,
  min_subtotal: 0,
  applies_to: 'all',
  category_ids: [],
  product_ids: [],
  exclude_sale_items: false,
  ...over,
});

const lines: DiscountLine[] = [
  { key: 'a', product_id: 'p1', category_id: 'shirts', unit_price: 33.33, quantity: 1, on_sale: false },
  { key: 'b', product_id: 'p2', category_id: 'shoes', unit_price: 33.33, quantity: 1, on_sale: true },
  { key: 'c', product_id: 'p3', category_id: 'shirts', unit_price: 33.34, quantity: 1, on_sale: false },
];

describe('computeDiscount', () => {
  it('takes a percentage off everything and splits it to the cent', () => {
    const result = computeDiscount(rule(), lines, 5);
    expect(result).toMatchObject({ ok: true, items: 10, shipping: 0, total: 10, eligibleSubtotal: 100 });
    if (!result.ok) throw new Error();
    const allocated = Object.values(result.allocations).reduce((s, v) => s + Math.round(v * 100), 0);
    expect(allocated).toBe(1000);
  });

  it('caps a fixed amount at what the eligible items cost', () => {
    const result = computeDiscount(rule({ kind: 'fixed', value: 500 }), lines, 0);
    expect(result).toMatchObject({ ok: true, items: 100, total: 100 });
  });

  it('free shipping takes the shipping cost and nothing else', () => {
    expect(computeDiscount(rule({ kind: 'free_shipping', value: 0 }), lines, 9.99)).toMatchObject({
      ok: true,
      items: 0,
      shipping: 9.99,
      total: 9.99,
      allocations: {},
    });
    expect(computeDiscount(rule({ kind: 'free_shipping', value: 0 }), lines, 0)).toMatchObject({
      ok: false,
      reason: 'no_effect',
    });
  });

  it('honours the minimum subtotal on the whole cart', () => {
    expect(computeDiscount(rule({ min_subtotal: '100.01' }), lines, 0)).toMatchObject({
      ok: false,
      reason: 'min_subtotal',
      minSubtotal: 100.01,
    });
    expect(computeDiscount(rule({ min_subtotal: 100 }), lines, 0)).toMatchObject({ ok: true });
  });

  it('limits to categories, including child categories through ancestors', () => {
    const scoped = rule({ applies_to: 'categories', category_ids: ['apparel'] });
    expect(computeDiscount(scoped, lines, 0)).toMatchObject({ ok: false, reason: 'no_eligible_items' });
    const withParents = computeDiscount(scoped, lines, 0, (id) => (id === 'shirts' ? ['shirts', 'apparel'] : [id]));
    expect(withParents).toMatchObject({ ok: true, eligibleSubtotal: 66.67, items: 6.67 });
    if (!withParents.ok) throw new Error();
    expect(Object.keys(withParents.allocations).sort()).toEqual(['a', 'c']);
  });

  it('limits to products and can skip items already on sale', () => {
    expect(computeDiscount(rule({ applies_to: 'products', product_ids: ['p2'] }), lines, 0)).toMatchObject({
      ok: true,
      items: 3.33,
    });
    expect(
      computeDiscount(rule({ applies_to: 'products', product_ids: ['p2'], exclude_sale_items: true }), lines, 0),
    ).toMatchObject({ ok: false, reason: 'no_eligible_items' });
  });

  it('allocations never exceed a line and always add up', () => {
    const many: DiscountLine[] = Array.from({ length: 7 }, (_, i) => ({
      key: `l${i}`,
      product_id: `p${i}`,
      category_id: null,
      unit_price: 1.07 + i,
      quantity: 1 + (i % 3),
      on_sale: false,
    }));
    const result = computeDiscount(rule({ value: 33 }), many, 0);
    if (!result.ok) throw new Error();
    const sum = Object.values(result.allocations).reduce((s, v) => s + Math.round(v * 100), 0);
    expect(sum).toBe(Math.round(result.items * 100));
    for (const line of many) {
      expect(result.allocations[line.key]).toBeLessThanOrEqual(line.unit_price * line.quantity);
    }
  });
});

describe('codes', () => {
  it('normalizes and validates', () => {
    expect(normalizeDiscountCode('  summer-10 ')).toBe('SUMMER-10');
    expect(DISCOUNT_CODE_PATTERN.test('SUMMER-10')).toBe(true);
    expect(DISCOUNT_CODE_PATTERN.test('AB')).toBe(false);
    expect(DISCOUNT_CODE_PATTERN.test('-ABC')).toBe(false);
  });
});
