import { describe, expect, it } from 'vitest';
import {
  MAX_LINE_ITEMS,
  MAX_QUANTITY_PER_ITEM,
  mergeItems,
  productIdsNeedingVariants,
  resolveLines,
  type CatalogProduct,
  type CatalogVariant,
  type MergedItem,
} from './checkout-lines';

const SHIRT = '11111111-1111-4111-8111-111111111111';
const MUG = '22222222-2222-4222-8222-222222222222';
const RUG = '33333333-3333-4333-8333-333333333333';
const V_RED_M = '44444444-4444-4444-8444-444444444444';
const V_RED_L = '55555555-5555-4555-8555-555555555555';
const V_BLUE_M = '66666666-6666-4666-8666-666666666666';

const shirt = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: SHIRT,
  name: 'Linen Shirt',
  price: '95.00',
  is_active: true,
  stock_quantity: 12,
  has_sizes: true,
  has_colors: false,
  sku: 'LS',
  category_id: 'cat-shirts',
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
  has_colors: false,
  product_images: [],
  ...over,
});

const rug = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: RUG,
  name: 'Wool Rug',
  price: 200,
  compare_at_price: 260,
  cost_price: 80,
  is_active: true,
  stock_quantity: 9,
  has_sizes: true,
  has_colors: true,
  category_id: 'cat-home',
  product_images: [
    { url: 'https://cdn/rug.jpg', is_primary: true, color_id: null },
    { url: 'https://cdn/rug-blue-2.jpg', is_primary: false, color_id: 'blue', sort_order: 2 },
    { url: 'https://cdn/rug-blue-1.jpg', is_primary: false, color_id: 'blue', sort_order: 1 },
  ],
  ...over,
});

const size = (label: string, stock_qty: number): CatalogVariant => ({
  id: `variant-${label}`,
  product_id: SHIRT,
  size: label,
  stock_qty,
});

const rugVariants: CatalogVariant[] = [
  { id: V_RED_M, product_id: RUG, color_id: 'red', size: '120x180', stock_qty: 3, price: null, sku: 'RUG-R-M' },
  { id: V_RED_L, product_id: RUG, color_id: 'red', size: '160x230', stock_qty: 2, price: '340', cost_price: '150' },
  { id: V_BLUE_M, product_id: RUG, color_id: 'blue', size: '120x180', stock_qty: 4 },
];
const rugColors = [
  { id: 'red', name: 'Red' },
  { id: 'blue', name: 'Blue' },
];

const merged = (items: unknown): MergedItem[] => {
  const result = mergeItems(items);
  if (!result.ok) throw new Error(`unexpected merge failure: ${result.code}`);
  return result.items;
};

describe('mergeItems', () => {
  it('collapses duplicate lines of the same product and size, or the same variant', () => {
    const items = merged([
      { product_id: SHIRT, quantity: 1, selected_size: 'M' },
      { product_id: SHIRT, quantity: 2, selected_size: 'M' },
      { product_id: SHIRT, quantity: 1, selected_size: 'L' },
      { product_id: MUG, quantity: 3 },
      { product_id: RUG, variant_id: V_RED_M, quantity: 1 },
      { product_id: RUG, variant_id: V_RED_M, quantity: 1, selected_size: 'ignored' },
    ]);
    expect(items).toEqual([
      { product_id: SHIRT, variant_id: null, selected_size: 'M', quantity: 3 },
      { product_id: SHIRT, variant_id: null, selected_size: 'L', quantity: 1 },
      { product_id: MUG, variant_id: null, selected_size: null, quantity: 3 },
      { product_id: RUG, variant_id: V_RED_M, selected_size: null, quantity: 2 },
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
    [[{ product_id: RUG, variant_id: 'nope', quantity: 1 }], 'VALIDATION_INVALID_VARIANT'],
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

describe('productIdsNeedingVariants', () => {
  it('includes products with variants and any product a size or variant was asked for', () => {
    const items = merged([
      { product_id: MUG, quantity: 1, selected_size: 'XL' },
      { product_id: SHIRT, quantity: 1 },
    ]);
    expect(productIdsNeedingVariants(items, [shirt(), mug(), rug()]).sort()).toEqual([SHIRT, MUG, RUG].sort());
  });

  it('is empty for a cart without variants', () => {
    expect(productIdsNeedingVariants(merged([{ product_id: MUG, quantity: 1 }]), [mug()])).toEqual([]);
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
          selected_color: null,
          sku: 'LS',
          unit_cost: null,
          category_id: 'cat-shirts',
          on_sale: false,
        },
        {
          product_id: MUG,
          variant_id: null,
          name: 'Mug',
          unit_price: 18,
          quantity: 1,
          image: null,
          selected_size: null,
          selected_color: null,
          sku: null,
          unit_cost: null,
          category_id: null,
          on_sale: false,
        },
      ],
    });
  });

  it('resolves colour × size variants by id, with their own price, cost, SKU and photo', () => {
    const result = resolveLines(
      merged([
        { product_id: RUG, variant_id: V_RED_L, quantity: 1 },
        { product_id: RUG, variant_id: V_BLUE_M, quantity: 2 },
      ]),
      [rug()],
      rugVariants,
      rugColors,
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.lines[0]).toMatchObject({
      variant_id: V_RED_L,
      unit_price: 340,
      unit_cost: 150,
      selected_color: 'Red',
      selected_size: '160x230',
      sku: null,
      image: 'https://cdn/rug.jpg',
      on_sale: false,
    });
    expect(result.lines[1]).toMatchObject({
      variant_id: V_BLUE_M,
      unit_price: 200,
      unit_cost: 80,
      selected_color: 'Blue',
      image: 'https://cdn/rug-blue-1.jpg',
      on_sale: true,
    });
  });

  it('merges a legacy size line and an id line for the same variant before checking stock', () => {
    const result = resolveLines(
      merged([
        { product_id: SHIRT, quantity: 3, selected_size: 'M' },
        { product_id: SHIRT, variant_id: '77777777-7777-4777-8777-777777777777', quantity: 3 },
      ]),
      [shirt()],
      [{ ...size('M', 5), id: '77777777-7777-4777-8777-777777777777' }],
    );
    expect(result).toMatchObject({ ok: false, code: 'INSUFFICIENT_STOCK', phase: 'request.resolve_variants' });
  });

  it('refuses a product with colours without a variant, and a variant of another product', () => {
    expect(resolveLines(merged([{ product_id: RUG, quantity: 1 }]), [rug()], rugVariants, rugColors)).toMatchObject({
      ok: false,
      status: 400,
      code: 'VARIANT_REQUIRED',
    });
    expect(
      resolveLines(merged([{ product_id: SHIRT, variant_id: V_RED_M, quantity: 1 }]), [shirt()], rugVariants),
    ).toMatchObject({ ok: false, status: 409, code: 'VARIANT_NOT_FOUND' });
  });

  it('refuses a variant left over from before the product changed shape', () => {
    // The rug stopped being sold by colour; the cart still holds a coloured variant.
    const result = resolveLines(
      merged([{ product_id: RUG, variant_id: V_RED_M, quantity: 1 }]),
      [rug({ has_colors: false })],
      rugVariants,
      rugColors,
    );
    expect(result).toMatchObject({ ok: false, code: 'VARIANT_NOT_FOUND' });
  });

  it('a legacy size never matches a coloured variant', () => {
    const result = resolveLines(
      merged([{ product_id: RUG, quantity: 1, selected_size: '120x180' }]),
      [rug()],
      rugVariants,
      rugColors,
    );
    expect(result).toMatchObject({ ok: false, code: 'VARIANT_NOT_FOUND' });
  });

  it('refuses a sized product without a size', () => {
    const result = resolveLines(merged([{ product_id: SHIRT, quantity: 1 }]), [shirt()], [size('M', 5)]);
    expect(result).toMatchObject({ ok: false, status: 400, code: 'SIZE_REQUIRED' });
  });

  it('refuses a size or a variant on a product without options', () => {
    expect(resolveLines(merged([{ product_id: MUG, quantity: 1, selected_size: 'XL' }]), [mug()], [])).toMatchObject({
      ok: false,
      status: 400,
      code: 'SIZE_NOT_APPLICABLE',
    });
    expect(
      resolveLines(
        merged([{ product_id: MUG, variant_id: V_RED_M, quantity: 1 }]),
        [mug()],
        [{ ...rugVariants[0], product_id: MUG }],
      ),
    ).toMatchObject({ ok: false, status: 400, code: 'SIZE_NOT_APPLICABLE' });
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
    const legacy = shirt({ has_sizes: undefined, has_colors: undefined });
    expect(resolveLines(merged([{ product_id: SHIRT, quantity: 1 }]), [legacy], [])).toMatchObject({ ok: true });
    expect(
      resolveLines(merged([{ product_id: SHIRT, quantity: 1, selected_size: 'M' }]), [legacy], [size('M', 1)]),
    ).toMatchObject({ ok: true, lines: [{ variant_id: 'variant-M' }] });
  });
});
