import { describe, expect, it } from 'vitest';
import {
  MAX_LINE_ITEMS,
  MAX_QUANTITY_PER_ITEM,
  mergeItems,
  productIdsNeedingSizes,
  resolveLines,
  type CatalogProduct,
  type CatalogVariant,
  type MergedItem,
} from './checkout-lines';

const SHIRT = '11111111-1111-4111-8111-111111111111';
const MUG = '22222222-2222-4222-8222-222222222222';

const shirt = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: SHIRT,
  name: 'Linen Shirt',
  price: '95.00',
  is_active: true,
  stock_quantity: 12,
  has_sizes: true,
  product_images: [
    { url: 'https://cdn/shirt-2.jpg', is_primary: false },
    { url: 'https://cdn/shirt-1.jpg', is_primary: true },
  ],
  ...over,
});

const mug = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: MUG,
  name: 'Mug',
  price: 18,
  is_active: true,
  stock_quantity: 5,
  has_sizes: false,
  product_images: [],
  ...over,
});

const size = (label: string, stock_qty: number): CatalogVariant => ({
  id: `variant-${label}`,
  product_id: SHIRT,
  size: label,
  stock_qty,
});

const merged = (items: unknown): MergedItem[] => {
  const result = mergeItems(items);
  if (!result.ok) throw new Error(`unexpected merge failure: ${result.code}`);
  return result.items;
};

describe('mergeItems', () => {
  it('collapses duplicate lines of the same product and size', () => {
    const items = merged([
      { product_id: SHIRT, quantity: 1, selected_size: 'M' },
      { product_id: SHIRT, quantity: 2, selected_size: 'M' },
      { product_id: SHIRT, quantity: 1, selected_size: 'L' },
      { product_id: MUG, quantity: 3 },
    ]);
    expect(items).toEqual([
      { product_id: SHIRT, selected_size: 'M', quantity: 3 },
      { product_id: SHIRT, selected_size: 'L', quantity: 1 },
      { product_id: MUG, selected_size: null, quantity: 3 },
    ]);
  });

  it('trims sizes and treats an empty size as no size', () => {
    expect(merged([{ product_id: MUG, quantity: 1, selected_size: '  ' }])[0].selected_size).toBeNull();
    expect(merged([{ product_id: SHIRT, quantity: 1, selected_size: ' M ' }])[0].selected_size).toBe('M');
  });

  it.each([
    [[], 'VALIDATION_NO_ITEMS'],
    ['not-an-array', 'VALIDATION_NO_ITEMS'],
    [Array.from({ length: MAX_LINE_ITEMS + 1 }, () => ({ product_id: MUG, quantity: 1 })), 'VALIDATION_TOO_MANY_ITEMS'],
    [[{ quantity: 1 }], 'VALIDATION_MISSING_PRODUCT_ID'],
    [[null], 'VALIDATION_MISSING_PRODUCT_ID'],
    [[{ product_id: 'abc', quantity: 1 }], 'VALIDATION_INVALID_PRODUCT_ID'],
    [[{ product_id: MUG, quantity: 0 }], 'INVALID_QUANTITY'],
    [[{ product_id: MUG, quantity: 'lots' }], 'INVALID_QUANTITY'],
    [[{ product_id: SHIRT, quantity: 1, selected_size: 42 }], 'VALIDATION_INVALID_SIZE'],
    [[{ product_id: SHIRT, quantity: 1, selected_size: 'x'.repeat(41) }], 'VALIDATION_INVALID_SIZE'],
  ])('rejects malformed input (%#)', (items, code) => {
    const result = mergeItems(items);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(code);
      expect(result.status).toBe(400);
    }
  });
});

describe('productIdsNeedingSizes', () => {
  it('includes sized products and any product a size was asked for', () => {
    const items = merged([
      { product_id: MUG, quantity: 1, selected_size: 'XL' },
      { product_id: SHIRT, quantity: 1 },
    ]);
    expect(productIdsNeedingSizes(items, [shirt(), mug()]).sort()).toEqual([SHIRT, MUG].sort());
  });

  it('is empty for an all-unsized cart', () => {
    expect(productIdsNeedingSizes(merged([{ product_id: MUG, quantity: 1 }]), [mug()])).toEqual([]);
  });
});

describe('resolveLines', () => {
  it('prices from the catalogue and links each sized line to its size row', () => {
    const result = resolveLines(
      merged([
        { product_id: SHIRT, quantity: 2, selected_size: 'M' },
        { product_id: MUG, quantity: 1 },
      ]),
      [shirt(), mug()],
      [size('M', 5), size('L', 7)],
    );
    expect(result).toEqual({
      ok: true,
      lines: [
        {
          product_id: SHIRT,
          variant_id: 'variant-M',
          name: 'Linen Shirt',
          unit_price: 95,
          quantity: 2,
          image: 'https://cdn/shirt-1.jpg',
          selected_size: 'M',
        },
        {
          product_id: MUG,
          variant_id: null,
          name: 'Mug',
          unit_price: 18,
          quantity: 1,
          image: null,
          selected_size: null,
        },
      ],
    });
  });

  it('refuses a sized product without a size', () => {
    const result = resolveLines(merged([{ product_id: SHIRT, quantity: 1 }]), [shirt()], [size('M', 5)]);
    expect(result).toMatchObject({ ok: false, status: 400, code: 'SIZE_REQUIRED' });
  });

  it('refuses a size on a product that is not sold by size', () => {
    const result = resolveLines(merged([{ product_id: MUG, quantity: 1, selected_size: 'XL' }]), [mug()], []);
    expect(result).toMatchObject({ ok: false, status: 400, code: 'SIZE_NOT_APPLICABLE' });
  });

  it('refuses a size that is not on sale', () => {
    const result = resolveLines(
      merged([{ product_id: SHIRT, quantity: 1, selected_size: 'XXL' }]),
      [shirt()],
      [size('M', 5)],
    );
    expect(result).toMatchObject({ ok: false, status: 409, code: 'VARIANT_NOT_FOUND' });
  });

  it('checks the size stock, not just the product total', () => {
    const result = resolveLines(
      merged([{ product_id: SHIRT, quantity: 3, selected_size: 'L' }]),
      [shirt({ stock_quantity: 12 })],
      [size('M', 10), size('L', 2)],
    );
    expect(result).toMatchObject({ ok: false, status: 409, code: 'INSUFFICIENT_STOCK', phase: 'request.resolve_variants' });
  });

  it('checks the product total against the combined quantity across sizes', () => {
    const result = resolveLines(
      merged([
        { product_id: SHIRT, quantity: 4, selected_size: 'M' },
        { product_id: SHIRT, quantity: 4, selected_size: 'L' },
      ]),
      [shirt({ stock_quantity: 7 })],
      [size('M', 10), size('L', 10)],
    );
    expect(result).toMatchObject({ ok: false, status: 409, code: 'INSUFFICIENT_STOCK', phase: 'request.resolve_prices' });
  });

  it('treats a negative (oversold) size as having no stock', () => {
    const result = resolveLines(
      merged([{ product_id: SHIRT, quantity: 1, selected_size: 'M' }]),
      [shirt()],
      [size('M', -2)],
    );
    expect(result).toMatchObject({ ok: false, code: 'INSUFFICIENT_STOCK' });
  });

  it('refuses unknown and inactive products', () => {
    expect(resolveLines(merged([{ product_id: MUG, quantity: 1 }]), [], [])).toMatchObject({
      ok: false,
      status: 400,
      code: 'PRODUCT_NOT_FOUND',
    });
    expect(resolveLines(merged([{ product_id: MUG, quantity: 1 }]), [mug({ is_active: false })], [])).toMatchObject({
      ok: false,
      status: 409,
      code: 'PRODUCT_INACTIVE',
    });
  });

  it('caps the quantity of a single line', () => {
    const result = resolveLines(
      merged([{ product_id: MUG, quantity: MAX_QUANTITY_PER_ITEM + 1 }]),
      [mug({ stock_quantity: 1000 })],
      [],
    );
    expect(result).toMatchObject({ ok: false, status: 400, code: 'INVALID_QUANTITY' });
  });

  it('keeps the pre-021 behaviour when has_sizes is unknown', () => {
    const legacy = shirt({ has_sizes: undefined });
    expect(resolveLines(merged([{ product_id: SHIRT, quantity: 1 }]), [legacy], [])).toMatchObject({ ok: true });
    expect(
      resolveLines(merged([{ product_id: SHIRT, quantity: 1, selected_size: 'M' }]), [legacy], [size('M', 1)]),
    ).toMatchObject({ ok: true, lines: [{ variant_id: 'variant-M' }] });
  });
});
