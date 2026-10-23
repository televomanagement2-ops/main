import { describe, expect, it } from 'vitest';
import type { Product, ProductColor, ProductImage, ProductVariant } from '../types';
import {
  addColors,
  addSizes,
  buildSaveConfig,
  cellKey,
  colorLabelKey,
  draftChanged,
  draftFromProduct,
  draftTotal,
  fillVariantSkus,
  findVariant,
  imagesForColor,
  parseAmount,
  priceRange,
  rebaseVariantDraft,
  removeColor,
  sellableColors,
  sellableVariants,
  setColorsEnabled,
  setForAll,
  setSizesEnabled,
  suggestVariantSku,
  summarizeVariants,
  updateCell,
  validateVariantDraft,
  variantLabel,
  variantPrice,
  variantsForColor,
} from './variants';

const color = (id: string, name: string, sort_order: number, swatch: string | null = null): ProductColor => ({
  id,
  product_id: 'p',
  name,
  swatch,
  sort_order,
  is_active: true,
  created_at: '',
  updated_at: '',
});

const variant = (over: Partial<ProductVariant> & Pick<ProductVariant, 'id'>): ProductVariant => ({
  product_id: 'p',
  size: null,
  color_id: null,
  price: null,
  sku: null,
  stock_qty: 0,
  sort_order: 0,
  is_active: true,
  created_at: '',
  updated_at: '',
  ...over,
});

const image = (id: string, color_id: string | null, is_primary = false, sort_order = 0): ProductImage => ({
  id,
  product_id: 'p',
  url: `https://cdn/${id}.jpg`,
  alt_text: null,
  sort_order,
  is_primary,
  color_id,
  created_at: '',
});

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p',
  category_id: 'c',
  name: 'Tee',
  slug: 'tee',
  description: null,
  price: 30,
  compare_at_price: null,
  cost_price: null,
  sku: 'TEE',
  stock_quantity: 0,
  low_stock_threshold: 2,
  weight_grams: null,
  is_active: true,
  is_featured: false,
  has_sizes: true,
  size_label: 'size',
  has_colors: true,
  color_label: 'color',
  price_min: null,
  price_max: null,
  size_guide_id: null,
  metadata: null,
  created_at: '',
  updated_at: '',
  product_colors: [color('blue', 'Blue', 1, '#2F5DA8'), color('red', 'Red', 0, '#B3261E')],
  product_variants: [
    variant({ id: 'r-s', color_id: 'red', size: 'S', stock_qty: 3, sort_order: 0 }),
    variant({ id: 'r-m', color_id: 'red', size: 'M', stock_qty: 0, sort_order: 1 }),
    variant({ id: 'b-s', color_id: 'blue', size: 'S', stock_qty: 5, sort_order: 2, price: 36 }),
    variant({ id: 'b-m', color_id: 'blue', size: 'M', stock_qty: 2, sort_order: 3, is_active: false }),
    // a leftover from before the product had colours
    variant({ id: 'old', size: 'L', stock_qty: 9, sort_order: 4 }),
  ],
  product_images: [image('main', null, true), image('blue-1', 'blue', false, 1), image('red-1', 'red', false, 2)],
  ...over,
});

describe('storefront helpers', () => {
  it('offers only variants on sale and shaped like the product', () => {
    expect(sellableVariants(product()).map((v) => v.id)).toEqual(['r-s', 'r-m', 'b-s']);
    expect(sellableVariants(product({ has_sizes: false, has_colors: false }))).toEqual([]);
  });

  it('lists colours with something on sale, in the shop order', () => {
    expect(sellableColors(product()).map((c) => c.id)).toEqual(['red', 'blue']);
  });

  it('finds the sizes of a colour and the variant of a full choice', () => {
    const p = product();
    expect(variantsForColor(p, 'blue').map((v) => v.size)).toEqual(['S']);
    expect(findVariant(p, 'red', 'M')?.id).toBe('r-m');
    expect(findVariant(p, 'red', null)).toBeNull();
    expect(findVariant(p, null, 'S')).toBeNull();
  });

  it('labels and prices a variant', () => {
    const p = product();
    const blueS = p.product_variants!.find((v) => v.id === 'b-s')!;
    expect(variantLabel(p, blueS)).toBe('Blue / S');
    expect(variantPrice(p, blueS)).toBe(36);
    expect(variantPrice(p, null)).toBe(30);
    expect(priceRange(p)).toEqual({ min: 30, max: 36 });
    expect(priceRange(product({ product_variants: [], price_min: 10, price_max: 20 }))).toEqual({ min: 10, max: 20 });
  });

  it("shows a colour's own photos first, then the general ones", () => {
    const p = product();
    expect(imagesForColor(p, 'blue').map((i) => i.id)).toEqual(['blue-1', 'main']);
    expect(imagesForColor(p, null).map((i) => i.id)).toEqual(['main']);
    expect(imagesForColor(product({ product_images: [image('x', 'red')] }), null).map((i) => i.id)).toEqual(['x']);
  });

  it('summarizes stock for the catalog', () => {
    expect(summarizeVariants(product())).toMatchObject({ soldOut: 1, low: 0 });
  });

  it('falls back to "color" for an unknown label', () => {
    expect(colorLabelKey('material')).toBe('colors.label.material');
    expect(colorLabelKey('x')).toBe('colors.label.color');
  });
});

describe('editor model', () => {
  it('loads a product into colours, sizes and cells, ignoring rows of another shape', () => {
    const draft = draftFromProduct(product());
    expect(draft.colors.map((c) => c.name)).toEqual(['Red', 'Blue']);
    expect(draft.sizes.map((s) => s.name)).toEqual(['S', 'M']);
    expect(draft.cells[cellKey('red', draft.sizes[0].key)]).toMatchObject({ id: 'r-s', stock: '3', originalStock: 3 });
    expect(Object.values(draft.cells).some((c) => c.id === 'old')).toBe(false);
  });

  it('sends nothing new when nothing changed, and only edited stock with its expected value', () => {
    const saved = draftFromProduct(product());
    expect(draftChanged(saved, saved)).toBe(false);

    const edited = updateCell(saved, 'red', saved.sizes[0].key, { stock: '7' });
    expect(draftChanged(edited, saved)).toBe(true);
    const config = buildSaveConfig(edited);
    const redS = config.variants.find((v) => v.id === 'r-s')!;
    expect(redS).toMatchObject({ stock_qty: 7, expected_stock_qty: 3, color_key: 'red', size: 'S' });
    expect(config.variants.find((v) => v.id === 'b-s')).not.toHaveProperty('stock_qty');
  });

  it('creates a new combination only when switched on', () => {
    const draft = addSizes(draftFromProduct(product()), ['L']);
    const lKey = draft.sizes[2].key;
    // Red / L was never offered: no cell, so not sent.
    expect(buildSaveConfig(draft).variants.some((v) => v.color_key === 'red' && v.size === 'L')).toBe(false);
    const on = updateCell(draft, 'red', lKey, { isActive: true, stock: '4' });
    expect(buildSaveConfig(on).variants.find((v) => v.color_key === 'red' && v.size === 'L')).toMatchObject({
      stock_qty: 4,
      is_active: true,
    });
  });

  it('gives the first colour the stock of a product that had sizes only', () => {
    const sizesOnly = draftFromProduct(
      product({
        has_colors: false,
        product_colors: [],
        product_variants: [variant({ id: 's', size: 'S', stock_qty: 4 })],
      }),
    );
    const withColors = addColors(setColorsEnabled(sizesOnly, true), [{ name: 'Black', swatch: '#111111' }]);
    const config = buildSaveConfig(withColors);
    expect(config.colors).toHaveLength(1);
    expect(config.variants).toEqual([
      expect.objectContaining({ id: 's', color_key: config.colors[0].key, size: 'S' }),
    ]);
  });

  it('keeps the first colour when colours are switched off, and drops the rest', () => {
    const off = setColorsEnabled(draftFromProduct(product()), false);
    const config = buildSaveConfig(off);
    expect(config.colors).toEqual([]);
    expect(config.variants.map((v) => v.id)).toEqual(['r-s', 'r-m']);
    expect(config.variants.every((v) => v.color_key === undefined)).toBe(true);
  });

  it('keeps the first size when sizes are switched off', () => {
    const off = setSizesEnabled(draftFromProduct(product()), false);
    expect(buildSaveConfig(off).variants.map((v) => [v.id, v.size])).toEqual([
      ['r-s', null],
      ['b-s', null],
    ]);
  });

  it('adds sizes once, case-insensitively, and the first size inherits colour-only stock', () => {
    const colorsOnly = draftFromProduct(
      product({ has_sizes: false, product_variants: [variant({ id: 'r', color_id: 'red', stock_qty: 2 })] }),
    );
    const sized = addSizes(setSizesEnabled(colorsOnly, true), ['m', 'M', ' L ']);
    expect(sized.sizes.map((s) => s.name)).toEqual(['m', 'L']);
    expect(buildSaveConfig(sized).variants).toEqual([expect.objectContaining({ id: 'r', size: 'm', color_key: 'red' })]);
  });

  it('removing a colour drops its cells', () => {
    const draft = removeColor(draftFromProduct(product()), 'blue');
    expect(buildSaveConfig(draft).variants.map((v) => v.id)).toEqual(['r-s', 'r-m']);
  });

  it('validates names, swatches, amounts and SKUs', () => {
    let draft = draftFromProduct(product());
    expect(validateVariantDraft(draft).first).toBeNull();

    draft = addColors(draft, [{ name: 'Green' }]);
    draft = { ...draft, colors: draft.colors.map((c) => (c.name === 'Green' ? { ...c, name: 'red' } : c)) };
    expect(validateVariantDraft(draft).first).toBe('colorDuplicate');

    draft = draftFromProduct(product());
    draft = { ...draft, colors: draft.colors.map((c, i) => (i === 0 ? { ...c, swatch: 'red' } : c)) };
    expect(validateVariantDraft(draft).first).toBe('swatch');

    draft = updateCell(draftFromProduct(product()), 'red', draftFromProduct(product()).sizes[0].key, { price: '12,345' });
    expect(validateVariantDraft(draft).first).toBe('price');

    const base = draftFromProduct(product());
    draft = updateCell(updateCell(base, 'red', base.sizes[0].key, { sku: 'X' }), 'blue', base.sizes[0].key, { sku: 'x' });
    expect(validateVariantDraft(draft).first).toBe('skuDuplicate');

    const empty = { ...draftFromProduct(product()), cells: {} };
    expect(validateVariantDraft(empty).first).toBe('noVariants');
  });

  it('parses amounts with a comma or a dot, to the cent', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('12.50')).toBe(12.5);
    expect(parseAmount('-1')).toBeNaN();
    expect(parseAmount('1.234')).toBeNaN();
  });

  it('totals the stock on sale, counting a backorder as zero', () => {
    const draft = updateCell(draftFromProduct(product()), 'red', draftFromProduct(product()).sizes[1].key, {
      stock: '-3',
      originalStock: -3,
    });
    expect(draftTotal(draft)).toBe(8);
  });

  it('sets a value on a whole colour without creating combinations it switches off', () => {
    const draft = draftFromProduct(product());
    const off = setForAll(draft, { isActive: false }, 'red');
    expect(buildSaveConfig(off).variants.filter((v) => v.color_key === 'red').every((v) => !v.is_active)).toBe(true);
    expect(buildSaveConfig(off).variants.some((v) => v.color_key === 'red' && v.size === 'L')).toBe(false);
  });

  it('suggests and fills SKUs', () => {
    expect(suggestVariantSku('TEE', 'Navy Blue', 'XL')).toBe('TEE-NAVY-BLUE-XL');
    expect(suggestVariantSku('', 'Red', 'M')).toBeNull();
    const filled = fillVariantSkus(draftFromProduct(product()), 'TEE');
    expect(buildSaveConfig(filled).variants.map((v) => v.sku)).toEqual(['TEE-RED-S', 'TEE-RED-M', 'TEE-BLUE-S', 'TEE-BLUE-M']);
  });

  it('rebases on fresh stock after a conflict, keeping edits', () => {
    const base = draftFromProduct(product());
    const edited = updateCell(base, 'red', base.sizes[0].key, { stock: '10' });
    const fresh = product().product_variants!.map((v) => (v.id === 'r-s' ? { ...v, stock_qty: 1 } : v.id === 'b-s' ? { ...v, stock_qty: 4 } : v));
    const rebased = rebaseVariantDraft(edited, fresh);
    expect(rebased.cells[cellKey('red', base.sizes[0].key)]).toMatchObject({ stock: '10', originalStock: 1 });
    expect(rebased.cells[cellKey('blue', base.sizes[0].key)]).toMatchObject({ stock: '4', originalStock: 4 });
  });
});
