import { describe, expect, it } from 'vitest';
import {
  appendSizes,
  buildVariantPayload,
  draftStock,
  draftsFromVariants,
  draftsTotal,
  fillEmptySkus,
  moveDraft,
  newDraft,
  parseStock,
  rebaseDrafts,
  sellableSizes,
  setAllStock,
  sizeLabelKey,
  sizeListChanged,
  suggestSku,
  summarizeSizes,
  validateDrafts,
  type SizeDraft,
} from './sizes';
import type { Product, ProductVariant } from '../types';

function variant(size: string, stock_qty: number, over: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: `id-${size}`,
    product_id: 'p1',
    size,
    sku: null,
    stock_qty,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    category_id: 'c1',
    name: 'Shirt',
    slug: 'shirt',
    description: null,
    price: 10,
    compare_at_price: null,
    cost_price: null,
    sku: null,
    stock_quantity: 0,
    low_stock_threshold: 3,
    weight_grams: null,
    is_active: true,
    is_featured: false,
    has_sizes: true,
    size_label: 'size',
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const persisted = (size: string, stock: number, over: Partial<SizeDraft> = {}): SizeDraft => ({
  key: `id-${size}`,
  id: `id-${size}`,
  size,
  sku: '',
  stock: String(stock),
  originalStock: stock,
  isActive: true,
  ...over,
});

describe('labels', () => {
  it('maps known labels to their key and anything else to "size"', () => {
    expect(sizeLabelKey('ring_size')).toBe('sizes.label.ring_size');
    expect(sizeLabelKey(undefined)).toBe('sizes.label.size');
    expect(sizeLabelKey('colour')).toBe('sizes.label.size');
  });
});

describe('storefront helpers', () => {
  it('offers active sizes in sort order, none for an unsized product', () => {
    const p = product({
      product_variants: [
        variant('L', 2, { sort_order: 3 }),
        variant('S', 5, { sort_order: 1 }),
        variant('M', 1, { sort_order: 2, is_active: false }),
      ],
    });
    expect(sellableSizes(p).map((v) => v.size)).toEqual(['S', 'L']);
    expect(sellableSizes({ ...p, has_sizes: false })).toEqual([]);
  });

  it('counts sold-out and low sizes against the product threshold', () => {
    const p = product({
      low_stock_threshold: 3,
      product_variants: [variant('S', 0), variant('M', -2), variant('L', 3), variant('XL', 9)],
    });
    expect(summarizeSizes(p)).toMatchObject({ soldOut: 2, low: 1 });
  });
});

describe('editor drafts', () => {
  it('loads every size, inactive included, in display order', () => {
    const drafts = draftsFromVariants([
      variant('M', 4, { sort_order: 2, sku: 'SH-M' }),
      variant('S', -1, { sort_order: 1, is_active: false }),
    ]);
    expect(drafts.map((d) => [d.size, d.stock, d.originalStock, d.isActive, d.sku])).toEqual([
      ['S', '-1', -1, false, ''],
      ['M', '4', 4, true, 'SH-M'],
    ]);
  });

  it('appends only sizes that are not listed yet, ignoring case and spacing', () => {
    const start = [persisted('M', 1)];
    const next = appendSizes(start, ['s', 'm', ' L ', '', 'S']);
    expect(next.map((d) => d.size)).toEqual(['M', 's', 'L']);
    expect(appendSizes(next, ['M'])).toBe(next);
  });

  it('parses stock as a whole number of 0 or more', () => {
    expect(parseStock(' 12 ')).toBe(12);
    expect(parseStock('0')).toBe(0);
    expect(parseStock('-1')).toBeNull();
    expect(parseStock('1.5')).toBeNull();
    expect(parseStock('')).toBeNull();
    expect(parseStock('2000000')).toBeNull();
  });

  it('keeps an untouched negative (backordered) figure valid', () => {
    expect(draftStock(persisted('M', -3))).toEqual({ value: -3, changed: false });
    expect(draftStock(persisted('M', -3, { stock: '5' }))).toEqual({ value: 5, changed: true });
    expect(draftStock(persisted('M', -3, { stock: '-4' }))).toBeNull();
  });

  it('flags empty, duplicate and invalid rows', () => {
    const drafts: SizeDraft[] = [
      persisted('M', 1, { key: 'a' }),
      persisted('m', 1, { key: 'b', id: 'id-m' }),
      { ...newDraft('L'), key: 'c', stock: 'x' },
      { ...newDraft(''), key: 'd' },
      persisted('XL', 1, { key: 'e', sku: 'SKU-1' }),
      persisted('XXL', 1, { key: 'f', sku: 'sku-1' }),
    ];
    const issues = validateDrafts(drafts);
    expect(issues.byKey).toEqual({
      a: 'duplicate',
      b: 'duplicate',
      c: 'stock',
      d: 'empty',
      e: 'skuDuplicate',
      f: 'skuDuplicate',
    });
    expect(issues.first).toBe('duplicate');
    expect(validateDrafts([persisted('M', 1)]).first).toBeNull();
  });

  it('totals active sizes only, a backordered size counting as zero', () => {
    const drafts = [
      persisted('S', 4),
      persisted('M', -2),
      persisted('L', 6, { isActive: false }),
      { ...newDraft('XL'), stock: '3' },
    ];
    expect(draftsTotal(drafts)).toBe(7);
  });
});

describe('buildVariantPayload', () => {
  it('sends stock only when it changed, with the figure it is replacing', () => {
    const payload = buildVariantPayload([
      persisted('S', 4),
      persisted('M', 2, { stock: '10', sku: ' SH-M ' }),
      persisted('L', -1, { isActive: false }),
      { ...newDraft('  XL '), stock: '5' },
    ]);
    expect(payload).toEqual([
      { id: 'id-S', size: 'S', sku: null, is_active: true },
      { id: 'id-M', size: 'M', sku: 'SH-M', is_active: true, stock_qty: 10, expected_stock_qty: 2 },
      { id: 'id-L', size: 'L', sku: null, is_active: false },
      { size: 'XL', sku: null, is_active: true, stock_qty: 5 },
    ]);
  });
});

describe('sizeListChanged', () => {
  const saved = [persisted('S', 4), persisted('M', 2)];

  it('is false for an untouched list', () => {
    const loaded = draftsFromVariants([
      variant('M', 2, { sort_order: 2 }),
      variant('S', 4, { sort_order: 1 }),
    ]);
    expect(sizeListChanged(loaded, saved)).toBe(false);
  });

  it.each([
    ['restock', [persisted('S', 4, { stock: '9' }), persisted('M', 2)]],
    ['rename', [persisted('S', 4, { size: 'Small' }), persisted('M', 2)]],
    ['reorder', [persisted('M', 2), persisted('S', 4)]],
    ['switch off', [persisted('S', 4, { isActive: false }), persisted('M', 2)]],
    ['new SKU', [persisted('S', 4, { sku: 'X-S' }), persisted('M', 2)]],
    ['removal', [persisted('S', 4)]],
    ['addition', [...saved, newDraft('L')]],
  ])('is true after a %s', (_label, drafts) => {
    expect(sizeListChanged(drafts, saved)).toBe(true);
  });
});

describe('rebaseDrafts', () => {
  it('shows fresh figures for untouched sizes and keeps what the admin typed', () => {
    const drafts = [persisted('S', 4), persisted('M', 2, { stock: '10' }), newDraft('L')];
    const rebased = rebaseDrafts(drafts, [variant('S', 3), variant('M', 1)]);

    expect(rebased.map((d) => [d.size, d.stock, d.originalStock])).toEqual([
      ['S', '3', 3],
      ['M', '10', 1],
      ['L', '0', null],
    ]);
    // The typed M now replaces the fresh figure knowingly.
    expect(buildVariantPayload(rebased)[1]).toMatchObject({ stock_qty: 10, expected_stock_qty: 1 });
  });
});

describe('editor helpers', () => {
  it('suggests SKUs from the product SKU', () => {
    expect(suggestSku('AUR-RW-104', 'M')).toBe('AUR-RW-104-M');
    expect(suggestSku('AUR-RW-104', '50 cm')).toBe('AUR-RW-104-50-CM');
    expect(suggestSku('', 'M')).toBeNull();
    expect(suggestSku('AUR', '½')).toBeNull();
  });

  it('fills only empty SKUs', () => {
    const next = fillEmptySkus([persisted('S', 1, { sku: 'KEEP' }), persisted('M', 1)], 'SH');
    expect(next.map((d) => d.sku)).toEqual(['KEEP', 'SH-M']);
  });

  it('sets every size to the same stock', () => {
    expect(setAllStock([persisted('S', 1), persisted('M', 2)], 7).map((d) => d.stock)).toEqual(['7', '7']);
  });

  it('moves sizes within bounds only', () => {
    const drafts = [persisted('S', 1), persisted('M', 1), persisted('L', 1)];
    expect(moveDraft(drafts, 2, -1).map((d) => d.size)).toEqual(['S', 'L', 'M']);
    expect(moveDraft(drafts, 0, -1)).toBe(drafts);
    expect(moveDraft(drafts, 2, 1)).toBe(drafts);
  });
});
