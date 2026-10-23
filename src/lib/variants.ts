// ─────────────────────────────────────────────────────────────────────────────
// Variants — sizes, colours, and the combinations between them.
//
// A product can be sold by size (has_sizes), by colour or material
// (has_colors), or both: each product_variants row is then one combination
// with its own stock, SKU and, optionally, its own price (migration 022).
//
// This module holds, as pure functions so the rules are unit-tested:
//   • what the storefront offers — colours with something on sale, the sizes
//     of a colour, a variant's price and photos;
//   • the admin editor model — colours, sizes and a cell per combination —
//     and the payload admin_save_product_variants takes.
// ─────────────────────────────────────────────────────────────────────────────

import type { ColorLabel, Product, ProductColor, ProductImage, ProductVariant, SizeLabel } from '../types';
import { MAX_SIZE_NAME_LENGTH, MAX_SIZE_SKU_LENGTH, normalizeSize, parseStock } from './sizes';

/** Mirrors products_color_label_check (migration 022). */
export const COLOR_LABELS: readonly ColorLabel[] = [
  'color',
  'material',
  'finish',
  'pattern',
  'style',
  'scent',
  'variant',
];

/** Mirrors product_colors_name_check (migration 022). */
export const MAX_COLOR_NAME_LENGTH = 40;

const SWATCH_PATTERN = /^#[0-9a-f]{6}$/i;

export function isColorLabel(value: unknown): value is ColorLabel {
  return typeof value === 'string' && (COLOR_LABELS as readonly string[]).includes(value);
}

/** i18n key of the word shown above a product's colour selector. */
export function colorLabelKey(label: string | null | undefined): string {
  return `colors.label.${isColorLabel(label) ? label : 'color'}`;
}

/** Common colours the editor offers; the name is translated, the swatch fixed. */
export const COLOR_PRESETS: readonly { id: string; hex: string }[] = [
  { id: 'black', hex: '#111111' },
  { id: 'white', hex: '#F4F4F0' },
  { id: 'grey', hex: '#8C8C8C' },
  { id: 'navy', hex: '#1F2A44' },
  { id: 'blue', hex: '#2F5DA8' },
  { id: 'red', hex: '#B3261E' },
  { id: 'green', hex: '#2E6B3F' },
  { id: 'beige', hex: '#D9C7A7' },
  { id: 'brown', hex: '#6B4A2F' },
  { id: 'pink', hex: '#E5A3B3' },
  { id: 'yellow', hex: '#E6C34A' },
  { id: 'gold', hex: '#C8A44D' },
  { id: 'silver', hex: '#BFC1C2' },
];

// ─── Storefront ─────────────────────────────────────────────────────────────

export const hasVariants = (product: Pick<Product, 'has_sizes' | 'has_colors'>): boolean =>
  product.has_sizes === true || product.has_colors === true;

/** Display order: sort_order, then size. Inactive variants are kept. */
export function sortVariants(variants: readonly ProductVariant[] | null | undefined): ProductVariant[] {
  return [...(variants ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || (a.size ?? '').localeCompare(b.size ?? ''),
  );
}

/** Ordered as the shop arranged them. */
export function sortColors(colors: readonly ProductColor[] | null | undefined): ProductColor[] {
  return [...(colors ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * The variants a shopper can buy: on sale, and shaped like the product — a
 * size exactly when it is sold by size, a colour exactly when by colour (a
 * row left over from before the product changed shape is history, not stock).
 */
export function sellableVariants(product: Product): ProductVariant[] {
  if (!hasVariants(product)) return [];
  return sortVariants(product.product_variants).filter(
    (v) =>
      v.is_active
      && Boolean(v.size) === Boolean(product.has_sizes)
      && Boolean(v.color_id) === Boolean(product.has_colors),
  );
}

/** Colours with at least one variant on sale, in the shop's order. */
export function sellableColors(product: Product): ProductColor[] {
  if (!product.has_colors) return [];
  const used = new Set(sellableVariants(product).map((v) => v.color_id));
  return sortColors(product.product_colors).filter((c) => used.has(c.id));
}

/** The variants offered in a colour — every variant when there are no colours. */
export function variantsForColor(product: Product, colorId: string | null): ProductVariant[] {
  return sellableVariants(product).filter((v) => !product.has_colors || v.color_id === colorId);
}

/** The variant for a colour and size choice; null until the choice is complete. */
export function findVariant(product: Product, colorId: string | null, size: string | null): ProductVariant | null {
  if (product.has_colors && !colorId) return null;
  if (product.has_sizes && !size) return null;
  return (
    sellableVariants(product).find(
      (v) => (!product.has_colors || v.color_id === colorId) && (!product.has_sizes || v.size === size),
    ) ?? null
  );
}

export function colorName(product: Product, colorId: string | null | undefined): string | null {
  if (!colorId) return null;
  return product.product_colors?.find((c) => c.id === colorId)?.name ?? null;
}

/** "Red / M", "Red", "M". */
export function variantLabel(product: Product, variant: ProductVariant | null | undefined): string {
  if (!variant) return '';
  return [colorName(product, variant.color_id), variant.size].filter(Boolean).join(' / ');
}

/** What one unit of this variant costs the shopper. */
export function variantPrice(product: Pick<Product, 'price'>, variant: Pick<ProductVariant, 'price'> | null | undefined): number {
  return variant?.price != null ? Number(variant.price) : Number(product.price);
}

/**
 * Cheapest and dearest price on offer. From the variants when they are loaded
 * (the product page), else from the derived price_min / price_max (listings).
 */
export function priceRange(product: Product): { min: number; max: number } {
  const variants = sellableVariants(product);
  if (variants.length > 0) {
    const prices = variants.map((v) => variantPrice(product, v));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }
  const min = product.price_min != null ? Number(product.price_min) : Number(product.price);
  const max = product.price_max != null ? Number(product.price_max) : Number(product.price);
  return { min, max };
}

/**
 * The photos to show for a colour: its own first, then the product's general
 * ones. Without a colour (or for a colour without photos of its own): the
 * general photos, or every photo when the product has none.
 */
export function imagesForColor(product: Product, colorId: string | null): ProductImage[] {
  const images = [...(product.product_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const general = images.filter((img) => !img.color_id);
  const own = colorId ? images.filter((img) => img.color_id === colorId) : [];
  if (own.length > 0) return [...own, ...general];
  return general.length > 0 ? general : images;
}

export function primaryImageUrl(product: Product, colorId: string | null = null): string | null {
  return imagesForColor(product, colorId)[0]?.url ?? null;
}

export interface VariantStockSummary {
  /** Variants on sale, in display order. */
  active: ProductVariant[];
  /** On sale at 0 or below (backordered). */
  soldOut: number;
  /** On sale with stock, at or under the low-stock threshold. */
  low: number;
}

export function summarizeVariants(product: Product): VariantStockSummary {
  const active = sellableVariants(product);
  let soldOut = 0;
  let low = 0;
  for (const variant of active) {
    if (variant.stock_qty <= 0) soldOut += 1;
    else if (variant.stock_qty <= product.low_stock_threshold) low += 1;
  }
  return { active, soldOut, low };
}

// ─── Admin editor model ─────────────────────────────────────────────────────

export interface ColorDraft {
  key: string;
  /** product_colors.id; null until saved. */
  id: string | null;
  name: string;
  /** '#RRGGBB' or ''. */
  swatch: string;
}

export interface SizeDraftRow {
  key: string;
  name: string;
}

/** One combination of a colour and a size (either may be absent). */
export interface CellDraft {
  /** product_variants.id; null for a combination not saved yet. */
  id: string | null;
  sku: string;
  /** '' = the product price. */
  price: string;
  /** '' = no cost recorded. */
  cost: string;
  /** Raw input value. */
  stock: string;
  /**
   * Stock when the editor loaded the variant (null for a new one). Sent back
   * as the expected value, so a save cannot overwrite an order that came in
   * while the editor was open.
   */
  originalStock: number | null;
  isActive: boolean;
}

export interface VariantDraft {
  hasSizes: boolean;
  hasColors: boolean;
  sizeLabel: SizeLabel;
  colorLabel: ColorLabel;
  colors: ColorDraft[];
  sizes: SizeDraftRow[];
  /** By cellKey(colorKey, sizeKey). A combination without a cell is not offered yet. */
  cells: Record<string, CellDraft>;
}

export const cellKey = (colorKey: string | null, sizeKey: string | null) => `${colorKey ?? '·'}|${sizeKey ?? '·'}`;

let keySequence = 0;
const newKey = (prefix: string) => {
  keySequence += 1;
  return `${prefix}-new-${keySequence}`;
};

const identity = (name: string) => normalizeSize(name).toLowerCase();

export function emptyCell(): CellDraft {
  return { id: null, sku: '', price: '', cost: '', stock: '0', originalStock: null, isActive: true };
}

/** The editor's starting point for a product (or a new, unsaved one). */
export function draftFromProduct(product?: Product | null): VariantDraft {
  const colors: ColorDraft[] = sortColors(product?.product_colors).map((c) => ({
    key: c.id,
    id: c.id,
    name: c.name,
    swatch: c.swatch ?? '',
  }));

  // Only rows shaped like the product as it is now. A row of another shape is
  // history kept for its orders; if the admin offers that combination again,
  // the database reuses it.
  const variants = sortVariants(product?.product_variants).filter(
    (v) => Boolean(v.size) === Boolean(product?.has_sizes) && Boolean(v.color_id) === Boolean(product?.has_colors),
  );
  const sizes: SizeDraftRow[] = [];
  const sizeKeyByName = new Map<string, string>();
  for (const variant of variants) {
    if (!variant.size) continue;
    const id = identity(variant.size);
    if (sizeKeyByName.has(id)) continue;
    const key = `size-${sizes.length}-${id}`;
    sizeKeyByName.set(id, key);
    sizes.push({ key, name: variant.size });
  }

  const cells: Record<string, CellDraft> = {};
  for (const variant of variants) {
    const colorKey = variant.color_id;
    const sizeKey = variant.size ? sizeKeyByName.get(identity(variant.size)) ?? null : null;
    if (colorKey && !colors.some((c) => c.key === colorKey)) continue;
    cells[cellKey(colorKey, sizeKey)] = {
      id: variant.id,
      sku: variant.sku ?? '',
      price: variant.price != null ? String(variant.price) : '',
      cost: variant.cost_price != null ? String(variant.cost_price) : '',
      stock: String(variant.stock_qty),
      originalStock: variant.stock_qty,
      isActive: variant.is_active,
    };
  }

  return {
    hasSizes: product?.has_sizes ?? false,
    hasColors: product?.has_colors ?? false,
    sizeLabel: product?.size_label ?? 'size',
    colorLabel: product?.color_label ?? 'color',
    colors,
    sizes,
    cells,
  };
}

/** The colour keys and size keys the matrix spans right now. */
export function axes(draft: VariantDraft): { colorKeys: (string | null)[]; sizeKeys: (string | null)[] } {
  return {
    colorKeys: draft.hasColors ? draft.colors.map((c) => c.key) : [null],
    sizeKeys: draft.hasSizes ? draft.sizes.map((s) => s.key) : [null],
  };
}

export function cellOf(draft: VariantDraft, colorKey: string | null, sizeKey: string | null): CellDraft | undefined {
  return draft.cells[cellKey(colorKey, sizeKey)];
}

/**
 * The stock a cell will save, and whether it differs from what was loaded.
 * An untouched figure is always valid — including a negative one, which is
 * the backorder depth the order trigger wrote; only an edited figure has to
 * be a whole number of 0 or more. Null when the edit is not a valid number.
 */
export function cellStock(cell: CellDraft): { value: number; changed: boolean } | null {
  const trimmed = cell.stock.trim();
  if (cell.originalStock !== null && trimmed === String(cell.originalStock)) {
    return { value: cell.originalStock, changed: false };
  }
  const parsed = parseStock(trimmed);
  if (parsed === null) return null;
  return { value: parsed, changed: parsed !== cell.originalStock };
}

/** '' → null; a valid amount → rounded to the cent; anything else → NaN. */
export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN;
  const value = Number(trimmed);
  return value <= 99_999_999 ? Math.round(value * 100) / 100 : Number.NaN;
}

/** Cells that will be sent: every saved combination, and new ones switched on. */
export function includedCells(draft: VariantDraft): { colorKey: string | null; sizeKey: string | null; cell: CellDraft }[] {
  const { colorKeys, sizeKeys } = axes(draft);
  const out: { colorKey: string | null; sizeKey: string | null; cell: CellDraft }[] = [];
  for (const colorKey of colorKeys) {
    for (const sizeKey of sizeKeys) {
      const cell = cellOf(draft, colorKey, sizeKey);
      // A combination never offered stays out rather than becoming a
      // switched-off row.
      if (!cell || (!cell.id && !cell.isActive)) continue;
      out.push({ colorKey, sizeKey, cell });
    }
  }
  return out;
}

/** What admin_save_product_variants takes for one variant (a `type`, so it is JSON-assignable). */
export type VariantSavePayload = {
  id?: string;
  color_key?: string;
  size: string | null;
  sku: string | null;
  price: number | null;
  cost: number | null;
  is_active: boolean;
  stock_qty?: number;
  expected_stock_qty?: number;
};

export type ColorSavePayload = {
  key: string;
  id?: string;
  name: string;
  swatch: string | null;
};

export type VariantsSaveConfig = {
  has_sizes: boolean;
  has_colors: boolean;
  size_label: SizeLabel;
  color_label: ColorLabel;
  colors: ColorSavePayload[];
  variants: VariantSavePayload[];
  note?: string | null;
};

/** Draft → the config admin_save_product_variants takes. Validate first. */
export function buildSaveConfig(draft: VariantDraft): VariantsSaveConfig {
  const sizeName = new Map(draft.sizes.map((s) => [s.key, normalizeSize(s.name)]));
  const variants = includedCells(draft).map(({ colorKey, sizeKey, cell }) => {
    const stock = cellStock(cell);
    const price = parseAmount(cell.price);
    const cost = parseAmount(cell.cost);
    const row: VariantSavePayload = {
      size: sizeKey ? sizeName.get(sizeKey) ?? null : null,
      sku: cell.sku.trim() || null,
      price: Number.isNaN(price) ? null : price,
      cost: Number.isNaN(cost) ? null : cost,
      is_active: cell.isActive,
    };
    if (colorKey) row.color_key = colorKey;
    if (cell.id) row.id = cell.id;
    if (!cell.id || cell.originalStock === null) {
      row.stock_qty = stock?.value ?? 0;
    } else if (stock?.changed) {
      row.stock_qty = stock.value;
      row.expected_stock_qty = cell.originalStock;
    }
    return row;
  });

  return {
    has_sizes: draft.hasSizes,
    has_colors: draft.hasColors,
    size_label: draft.sizeLabel,
    color_label: draft.colorLabel,
    colors: draft.hasColors
      ? draft.colors.map((c) => {
          const out: ColorSavePayload = { key: c.key, name: normalizeSize(c.name), swatch: c.swatch.trim() || null };
          if (c.id) out.id = c.id;
          return out;
        })
      : [],
    variants,
  };
}

/** Whether saving `draft` would change anything compared with `saved`. */
export function draftChanged(draft: VariantDraft, saved: VariantDraft): boolean {
  return JSON.stringify(buildSaveConfig(draft)) !== JSON.stringify(buildSaveConfig(saved));
}

export type VariantIssue =
  | 'noColors'
  | 'noSizes'
  | 'noVariants'
  | 'colorEmpty'
  | 'colorTooLong'
  | 'colorDuplicate'
  | 'swatch'
  | 'sizeEmpty'
  | 'sizeTooLong'
  | 'sizeDuplicate'
  | 'stock'
  | 'price'
  | 'cost'
  | 'skuTooLong'
  | 'skuDuplicate';

export interface VariantIssues {
  /** Problem of each colour, size or cell, by its key. */
  byKey: Record<string, VariantIssue>;
  /** The first problem, for the form-level message. */
  first: VariantIssue | null;
}

export function validateVariantDraft(draft: VariantDraft): VariantIssues {
  const byKey: Record<string, VariantIssue> = {};
  let first: VariantIssue | null = null;
  const flag = (key: string, issue: VariantIssue) => {
    byKey[key] ??= issue;
    first ??= issue;
  };

  if (draft.hasColors && draft.colors.length === 0) flag('colors', 'noColors');
  if (draft.hasSizes && draft.sizes.length === 0) flag('sizes', 'noSizes');

  if (draft.hasColors) {
    const counts = new Map<string, number>();
    for (const c of draft.colors) counts.set(identity(c.name), (counts.get(identity(c.name)) ?? 0) + 1);
    for (const c of draft.colors) {
      const name = normalizeSize(c.name);
      if (!name) flag(c.key, 'colorEmpty');
      else if (name.length > MAX_COLOR_NAME_LENGTH) flag(c.key, 'colorTooLong');
      else if ((counts.get(identity(name)) ?? 0) > 1) flag(c.key, 'colorDuplicate');
      else if (c.swatch.trim() && !SWATCH_PATTERN.test(c.swatch.trim())) flag(c.key, 'swatch');
    }
  }

  if (draft.hasSizes) {
    const counts = new Map<string, number>();
    for (const s of draft.sizes) counts.set(identity(s.name), (counts.get(identity(s.name)) ?? 0) + 1);
    for (const s of draft.sizes) {
      const name = normalizeSize(s.name);
      if (!name) flag(s.key, 'sizeEmpty');
      else if (name.length > MAX_SIZE_NAME_LENGTH) flag(s.key, 'sizeTooLong');
      else if ((counts.get(identity(name)) ?? 0) > 1) flag(s.key, 'sizeDuplicate');
    }
  }

  const included = includedCells(draft);
  if ((draft.hasColors || draft.hasSizes) && !included.some(({ cell }) => cell.isActive) && !first) {
    flag('variants', 'noVariants');
  }

  const skuCounts = new Map<string, number>();
  for (const { cell } of included) {
    const sku = cell.sku.trim().toUpperCase();
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  }
  for (const { colorKey, sizeKey, cell } of included) {
    const key = cellKey(colorKey, sizeKey);
    const sku = cell.sku.trim();
    if (cellStock(cell) === null) flag(key, 'stock');
    else if (Number.isNaN(parseAmount(cell.price))) flag(key, 'price');
    else if (Number.isNaN(parseAmount(cell.cost))) flag(key, 'cost');
    else if (sku.length > MAX_SIZE_SKU_LENGTH) flag(key, 'skuTooLong');
    else if (sku && (skuCounts.get(sku.toUpperCase()) ?? 0) > 1) flag(key, 'skuDuplicate');
  }

  return { byKey, first };
}

/** The product total the database will derive: cells on sale, negatives as 0. */
export function draftTotal(draft: VariantDraft): number {
  return includedCells(draft).reduce((sum, { cell }) => {
    if (!cell.isActive) return sum;
    return sum + Math.max(0, cellStock(cell)?.value ?? 0);
  }, 0);
}

export function updateCell(
  draft: VariantDraft,
  colorKey: string | null,
  sizeKey: string | null,
  patch: Partial<CellDraft>,
): VariantDraft {
  const key = cellKey(colorKey, sizeKey);
  return { ...draft, cells: { ...draft.cells, [key]: { ...(draft.cells[key] ?? emptyCell()), ...patch } } };
}

/** Re-files every cell of one axis value under another (keeping ids and stock). */
function rekey(
  cells: Record<string, CellDraft>,
  move: (colorKey: string | null, sizeKey: string | null) => [string | null, string | null] | null,
): Record<string, CellDraft> {
  const out: Record<string, CellDraft> = {};
  for (const [key, cell] of Object.entries(cells)) {
    const [c, s] = key.split('|').map((part) => (part === '·' ? null : part));
    const target = move(c, s);
    if (target) out[cellKey(target[0], target[1])] = cell;
  }
  return out;
}

/** Appends the colours not already listed (compared case-insensitively). */
export function addColors(draft: VariantDraft, entries: readonly { name: string; swatch?: string }[]): VariantDraft {
  const present = new Set(draft.colors.map((c) => identity(c.name)));
  const added: ColorDraft[] = [];
  for (const entry of entries) {
    const name = normalizeSize(entry.name);
    if (!name || present.has(name.toLowerCase())) continue;
    present.add(name.toLowerCase());
    added.push({ key: newKey('color'), id: null, name, swatch: entry.swatch ?? '' });
  }
  if (added.length === 0) return draft;

  // The first colour inherits whatever was there without one: the stock of a
  // product that was sold by size alone now belongs to that colour.
  const cells =
    draft.colors.length === 0
      ? rekey(draft.cells, (c, s) => [c ?? added[0].key, s])
      : draft.cells;
  return { ...draft, colors: [...draft.colors, ...added], cells };
}

/** Appends the sizes not already listed (compared case-insensitively). */
export function addSizes(draft: VariantDraft, names: readonly string[]): VariantDraft {
  const present = new Set(draft.sizes.map((s) => identity(s.name)));
  const added: SizeDraftRow[] = [];
  for (const raw of names) {
    const name = normalizeSize(raw);
    if (!name || present.has(name.toLowerCase())) continue;
    present.add(name.toLowerCase());
    added.push({ key: newKey('size'), name });
  }
  if (added.length === 0) return draft;

  const cells =
    draft.sizes.length === 0
      ? rekey(draft.cells, (c, s) => [c, s ?? added[0].key])
      : draft.cells;
  return { ...draft, sizes: [...draft.sizes, ...added], cells };
}

export function removeColor(draft: VariantDraft, key: string): VariantDraft {
  return {
    ...draft,
    colors: draft.colors.filter((c) => c.key !== key),
    cells: rekey(draft.cells, (c, s) => (c === key ? null : [c, s])),
  };
}

export function removeSize(draft: VariantDraft, key: string): VariantDraft {
  return {
    ...draft,
    sizes: draft.sizes.filter((s) => s.key !== key),
    cells: rekey(draft.cells, (c, s) => (s === key ? null : [c, s])),
  };
}

/**
 * Colours on or off. Off: the first colour's variants carry on without a
 * colour (their stock with them); the other colours' variants are dropped on
 * save (switched off instead, when they have orders).
 */
export function setColorsEnabled(draft: VariantDraft, on: boolean): VariantDraft {
  if (on === draft.hasColors) return draft;
  if (on) {
    const firstColor = draft.colors[0]?.key ?? null;
    return {
      ...draft,
      hasColors: true,
      cells: firstColor ? rekey(draft.cells, (c, s) => [c ?? firstColor, s]) : draft.cells,
    };
  }
  const firstColor = draft.colors[0]?.key ?? null;
  return {
    ...draft,
    hasColors: false,
    cells: rekey(draft.cells, (c, s) => (c === null || c === firstColor ? [null, s] : [c, s])),
  };
}

/** Sizes on or off: the same rule as colours, with the first size. */
export function setSizesEnabled(draft: VariantDraft, on: boolean): VariantDraft {
  if (on === draft.hasSizes) return draft;
  const firstSize = draft.sizes[0]?.key ?? null;
  if (on) {
    return {
      ...draft,
      hasSizes: true,
      cells: firstSize ? rekey(draft.cells, (c, s) => [c, s ?? firstSize]) : draft.cells,
    };
  }
  return {
    ...draft,
    hasSizes: false,
    cells: rekey(draft.cells, (c, s) => (s === null || s === firstSize ? [c, null] : [c, s])),
  };
}

export function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** "AUR-RW" + "Navy Blue" + "M" → "AUR-RW-NAVY-BLUE-M". Null without a product SKU. */
export function suggestVariantSku(productSku: string, ...parts: (string | null | undefined)[]): string | null {
  const base = productSku.trim();
  const suffix = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) =>
      normalizeSize(p)
        .toUpperCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('-');
  if (!base || !suffix) return null;
  return `${base}-${suffix}`.slice(0, MAX_SIZE_SKU_LENGTH);
}

/** Gives every included cell without a SKU the suggested one. */
export function fillVariantSkus(draft: VariantDraft, productSku: string): VariantDraft {
  const colorName = new Map(draft.colors.map((c) => [c.key, c.name]));
  const sizeName = new Map(draft.sizes.map((s) => [s.key, s.name]));
  let next = draft;
  for (const { colorKey, sizeKey, cell } of includedCells(draft)) {
    if (cell.sku.trim()) continue;
    const sku = suggestVariantSku(
      productSku,
      colorKey ? colorName.get(colorKey) : null,
      sizeKey ? sizeName.get(sizeKey) : null,
    );
    if (sku) next = updateCell(next, colorKey, sizeKey, { sku });
  }
  return next;
}

/** Sets a field on every combination (of one colour, when given), creating new ones switched on. */
export function setForAll(
  draft: VariantDraft,
  patch: Partial<Pick<CellDraft, 'stock' | 'price' | 'cost' | 'isActive'>>,
  onlyColor?: string | null,
): VariantDraft {
  const { colorKeys, sizeKeys } = axes(draft);
  let next = draft;
  for (const colorKey of colorKeys) {
    if (onlyColor !== undefined && colorKey !== onlyColor) continue;
    for (const sizeKey of sizeKeys) {
      const cell = cellOf(next, colorKey, sizeKey);
      // Switching a whole colour off must not create rows for combinations
      // that were never offered.
      if (!cell && patch.isActive === false) continue;
      next = updateCell(next, colorKey, sizeKey, patch);
    }
  }
  return next;
}

/**
 * After a stock conflict, adopt the database's current figures as the new
 * baseline. A cell the admin did not touch shows the fresh figure; one they
 * edited keeps the typed value, so saving again applies it knowingly.
 */
export function rebaseVariantDraft(draft: VariantDraft, fresh: readonly ProductVariant[]): VariantDraft {
  const current = new Map(fresh.map((v) => [v.id, v]));
  const cells: Record<string, CellDraft> = {};
  for (const [key, cell] of Object.entries(draft.cells)) {
    const variant = cell.id ? current.get(cell.id) : undefined;
    if (!variant) {
      cells[key] = cell;
      continue;
    }
    const edited = cellStock(cell)?.changed ?? true;
    cells[key] = {
      ...cell,
      originalStock: variant.stock_qty,
      stock: edited ? cell.stock : String(variant.stock_qty),
    };
  }
  return { ...draft, cells };
}

/** Label of a combination in the editor: "Red / M". */
export function cellLabel(draft: VariantDraft, colorKey: string | null, sizeKey: string | null): string {
  const color = colorKey ? draft.colors.find((c) => c.key === colorKey)?.name : null;
  const size = sizeKey ? draft.sizes.find((s) => s.key === sizeKey)?.name : null;
  return [color, size].filter(Boolean).join(' / ');
}
