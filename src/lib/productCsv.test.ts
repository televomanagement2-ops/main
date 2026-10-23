import { describe, expect, it } from 'vitest';
import type { Category, Product } from '../types';
import { COMMA_DIALECT, SEMICOLON_DIALECT, parseCsv, toCsv } from './csv';
import { PRODUCT_CSV_COLUMNS, planImport, productsToCsvRows } from './productCsv';

const category: Category = {
  id: 'cat-1',
  name: 'Clothing',
  slug: 'clothing',
  description: null,
  image_url: null,
  parent_id: null,
  sort_order: 0,
  is_active: true,
  created_at: '',
  updated_at: '',
};

const base = (over: Partial<Product>): Product => ({
  id: 'p',
  category_id: 'cat-1',
  name: 'Product',
  slug: 'product',
  description: null,
  price: 20,
  compare_at_price: null,
  cost_price: null,
  sku: null,
  stock_quantity: 4,
  low_stock_threshold: 5,
  weight_grams: null,
  is_active: true,
  is_featured: false,
  has_sizes: false,
  size_label: 'size',
  has_colors: false,
  color_label: 'color',
  price_min: null,
  price_max: null,
  size_guide_id: null,
  metadata: null,
  created_at: '',
  updated_at: '',
  product_images: [],
  ...over,
});

const mug = base({ id: 'mug', slug: 'mug', name: 'Mug, "large"', sku: 'MUG', stock_quantity: -2 });
const tee = base({
  id: 'tee',
  slug: 'tee',
  name: 'Tee',
  price: 30,
  compare_at_price: 40,
  has_sizes: true,
  has_colors: true,
  stock_quantity: 5,
  product_colors: [
    { id: 'red', product_id: 'tee', name: 'Red', swatch: '#B3261E', sort_order: 0, is_active: true, created_at: '', updated_at: '' },
  ],
  product_variants: [
    { id: 'v1', product_id: 'tee', color_id: 'red', size: 'S', price: null, sku: 'TEE-R-S', stock_qty: 2, sort_order: 0, is_active: true, created_at: '', updated_at: '' },
    { id: 'v2', product_id: 'tee', color_id: 'red', size: 'M', price: 32, sku: null, stock_qty: 3, sort_order: 1, is_active: false, created_at: '', updated_at: '' },
  ],
  product_images: [
    { id: 'i2', product_id: 'tee', url: 'https://cdn/2.jpg', alt_text: null, sort_order: 1, is_primary: false, created_at: '' },
    { id: 'i1', product_id: 'tee', url: 'https://cdn/1.jpg', alt_text: null, sort_order: 0, is_primary: true, created_at: '' },
  ],
});

const costs = { products: { tee: 12 }, variants: { v2: 14.5 } };

describe('product CSV', () => {
  it('exports one row per variant, product fields on each row', () => {
    const rows = productsToCsvRows([mug, tee], { dialect: COMMA_DIALECT, categories: [category], costs });
    expect(rows[0]).toEqual([...PRODUCT_CSV_COLUMNS]);
    expect(rows).toHaveLength(4);
    const col = (row: number, name: string) => rows[row][PRODUCT_CSV_COLUMNS.indexOf(name as never)];
    expect(col(1, 'handle')).toBe('mug');
    expect(col(1, 'stock')).toBe(-2);
    expect(col(2, 'color')).toBe('Red');
    expect(col(3, 'variant_price')).toBe('32.00');
    expect(col(3, 'variant_cost')).toBe('14.50');
    expect(col(2, 'cost_price')).toBe('12.00');
    expect(col(2, 'images')).toBe('https://cdn/1.jpg | https://cdn/2.jpg');
  });

  it('round-trips through a spreadsheet file into an import plan', () => {
    for (const dialect of [COMMA_DIALECT, SEMICOLON_DIALECT]) {
      const csv = toCsv(productsToCsvRows([mug, tee], { dialect, categories: [category], costs }), dialect);
      const plan = planImport(parseCsv(csv).rows);
      expect(plan.issues).toEqual([]);
      expect(plan.products).toHaveLength(2);

      // A backordered figure means "leave the stock alone".
      expect(plan.products[0]).toMatchObject({ slug: 'mug', name: 'Mug, "large"', sku: 'MUG', has_sizes: false });
      expect(plan.products[0]).not.toHaveProperty('stock_quantity');

      expect(plan.products[1]).toMatchObject({
        slug: 'tee',
        price: 30,
        compare_at_price: 40,
        cost_price: 12,
        has_sizes: true,
        has_colors: true,
        colors: [{ name: 'Red', swatch: '#B3261E' }],
        images: ['https://cdn/1.jpg', 'https://cdn/2.jpg'],
      });
      expect(plan.products[1].variants).toEqual([
        { color: 'Red', size: 'S', sku: 'TEE-R-S', price: null, cost: null, stock_qty: 2, is_active: true },
        { color: 'Red', size: 'M', sku: null, price: 32, cost: 14.5, stock_qty: 3, is_active: false },
      ]);
    }
  });

  it('leaves fields alone when their column is missing', () => {
    // No size or colour column: the variants are not touched either.
    const plan = planImport([
      ['Handle', 'Stock'],
      ['mug', '7'],
    ]);
    expect(plan.products).toEqual([{ slug: 'mug', stock_quantity: 7 }]);
  });

  it('sends only the variant dimension the file has', () => {
    const plan = planImport([
      ['handle', 'size', 'stock'],
      ['tee', 'S', '2'],
      ['tee', 'M', '3'],
      ['mug', '', '9'],
    ]);
    expect(plan.issues).toEqual([]);
    expect(plan.products[0]).toEqual({
      slug: 'tee',
      has_sizes: true,
      variants: [
        { size: 'S', stock_qty: 2 },
        { size: 'M', stock_qty: 3 },
      ],
    });
    // A size column with no size for this product: it is sold without sizes.
    expect(plan.products[1]).toEqual({ slug: 'mug', has_sizes: false, stock_quantity: 9 });
  });

  it('reports what stops an import, by line', () => {
    const plan = planImport([
      ['handle', 'price', 'size', 'color', 'active', 'size_label'],
      ['Bad Handle', '1', '', '', '', ''],
      ['tee', 'abc', 'S', 'Red', 'perhaps', 'cup'],
      ['tee', '1', 'M', '', '', ''],
      ['tee', '1', 'S', 'red', '', ''],
    ]);
    expect(plan.issues).toEqual(
      expect.arrayContaining([
        { line: 2, message: 'handle', value: 'Bad Handle' },
        { line: 3, message: 'number', value: 'abc' },
        { line: 3, message: 'boolean', value: 'perhaps' },
        { line: 3, message: 'sizeLabel', value: 'cup' },
        { line: 4, message: 'missingColor' },
        { line: 5, message: 'duplicateVariant', value: 'red / S' },
      ]),
    );
  });

  it('needs a handle column', () => {
    expect(planImport([['name'], ['x']]).issues).toEqual([{ line: 1, message: 'noHandleColumn' }]);
  });
});
