// ─────────────────────────────────────────────────────────────────────────────
// Sizes — the vocabulary and the editor model behind sized products.
//
// A sized product (products.has_sizes, migration 021) keeps one stock counter
// per size in product_variants, and the database derives products.stock_quantity
// from them. This module holds:
//   • the words the storefront can show above the size selector,
//   • the presets the admin editor offers,
//   • the editor model — drafts → validation → the payload the
//     admin_set_product_inventory RPC takes — as pure functions, so the rules
//     are unit-tested instead of living inside a component.
// ─────────────────────────────────────────────────────────────────────────────

import type { Product, ProductVariant, SizeLabel } from '../types';

/** Mirrors products_size_label_check (migration 021). */
export const SIZE_LABELS: readonly SizeLabel[] = [
  'size',
  'measure',
  'length',
  'shoe_size',
  'ring_size',
  'waist',
];

/** Mirror product_variants_size_format_check (migration 021). */
export const MAX_SIZE_NAME_LENGTH = 40;
export const MAX_SIZE_SKU_LENGTH = 64;

/** Same ceiling the inputs accept; far beyond any real shelf. */
export const MAX_STOCK_INPUT = 1_000_000;

export function isSizeLabel(value: unknown): value is SizeLabel {
  return typeof value === 'string' && (SIZE_LABELS as readonly string[]).includes(value);
}

/** i18n key of the word shown above a product's size selector. */
export function sizeLabelKey(label: string | null | undefined): string {
  return `sizes.label.${isSizeLabel(label) ? label : 'size'}`;
}

export interface SizePreset {
  /** i18n key suffix: admin.catalog.sizes.preset.<id> */
  id: string;
  /** Applied when the preset starts an empty list. */
  label: SizeLabel;
  sizes: readonly string[];
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  { id: 'apparel', label: 'size', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { id: 'apparelExtended', label: 'size', sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { id: 'apparelNumeric', label: 'size', sizes: ['38', '40', '42', '44', '46', '48', '50', '52', '54'] },
  { id: 'shoesEu', label: 'shoe_size', sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] },
  { id: 'rings', label: 'ring_size', sizes: ['5', '6', '7', '8', '9'] },
  { id: 'waist', label: 'waist', sizes: ['26', '28', '30', '32', '34', '36', '38'] },
  { id: 'objects', label: 'measure', sizes: ['S', 'M', 'L'] },
];

/** Display order: sort_order, then name. Inactive sizes are kept. */
export function sortedVariants(variants: readonly ProductVariant[] | null | undefined): ProductVariant[] {
  return [...(variants ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.size.localeCompare(b.size),
  );
}

/** The sizes a shopper can choose from. Empty for an unsized product. */
export function sellableSizes(product: Product): ProductVariant[] {
  if (!product.has_sizes) return [];
  return sortedVariants(product.product_variants).filter((v) => v.is_active);
}

export interface SizeStockSummary {
  /** Active sizes, in display order. */
  active: ProductVariant[];
  /** Active sizes at 0 or below (backordered). */
  soldOut: number;
  /** Active sizes with stock, at or under the low-stock threshold. */
  low: number;
}

export function summarizeSizes(product: Product): SizeStockSummary {
  const active = sellableSizes(product);
  let soldOut = 0;
  let low = 0;
  for (const variant of active) {
    if (variant.stock_qty <= 0) soldOut += 1;
    else if (variant.stock_qty <= product.low_stock_threshold) low += 1;
  }
  return { active, soldOut, low };
}

// ─── Editor model ───────────────────────────────────────────────────────────

export interface SizeDraft {
  /** Stable React key. */
  key: string;
  /** product_variants.id; null for a size that is not saved yet. */
  id: string | null;
  size: string;
  sku: string;
  /** Raw input value. */
  stock: string;
  /**
   * Stock when the editor loaded the size (null for a new one). Sent back as
   * the expected value, so a save cannot overwrite an order that came in while
   * the editor was open.
   */
  originalStock: number | null;
  isActive: boolean;
}

export type SizeDraftError = 'empty' | 'tooLong' | 'duplicate' | 'stock' | 'skuTooLong' | 'skuDuplicate';

export interface DraftIssues {
  /** The first problem of each draft, by draft key. */
  byKey: Record<string, SizeDraftError>;
  /** The first problem in list order, for the form-level message. */
  first: SizeDraftError | null;
}

/** What admin_set_product_inventory takes for one size (a `type`, so it is JSON-assignable). */
export type VariantPayload = {
  id?: string;
  size: string;
  sku: string | null;
  is_active: boolean;
  /** Omitted: the stock is left exactly as it is. */
  stock_qty?: number;
  /** The stock the editor was showing; the save is refused if it has moved. */
  expected_stock_qty?: number;
};

let draftSequence = 0;

/** Collapses inner whitespace and trims: "  50  cm " → "50 cm". */
export const normalizeSize = (size: string) => size.trim().replace(/\s+/g, ' ');

const sizeIdentity = (size: string) => normalizeSize(size).toLowerCase();

export function newDraft(size: string, stock = 0): SizeDraft {
  draftSequence += 1;
  return {
    key: `new-${draftSequence}`,
    id: null,
    size: normalizeSize(size),
    sku: '',
    stock: String(stock),
    originalStock: null,
    isActive: true,
  };
}

export function draftsFromVariants(variants: readonly ProductVariant[] | null | undefined): SizeDraft[] {
  return sortedVariants(variants).map((variant) => ({
    key: variant.id,
    id: variant.id,
    size: variant.size,
    sku: variant.sku ?? '',
    stock: String(variant.stock_qty),
    originalStock: variant.stock_qty,
    isActive: variant.is_active,
  }));
}

/** Appends the sizes not already listed (compared case-insensitively). */
export function appendSizes(drafts: SizeDraft[], sizes: readonly string[]): SizeDraft[] {
  const present = new Set(drafts.map((d) => sizeIdentity(d.size)));
  const added: SizeDraft[] = [];
  for (const raw of sizes) {
    const size = normalizeSize(raw);
    if (!size || present.has(size.toLowerCase())) continue;
    present.add(size.toLowerCase());
    added.push(newDraft(size));
  }
  return added.length > 0 ? [...drafts, ...added] : drafts;
}

/** A whole number from 0 to MAX_STOCK_INPUT, or null. */
export function parseStock(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_STOCK_INPUT ? value : null;
}

/**
 * The stock a draft will save, and whether it differs from what was loaded.
 * An untouched figure is always valid — including a negative one, which is
 * the backorder depth the order trigger wrote; only an edited figure has to
 * be a whole number of 0 or more. Null when the edit is not a valid number.
 */
export function draftStock(draft: SizeDraft): { value: number; changed: boolean } | null {
  const trimmed = draft.stock.trim();
  if (draft.originalStock !== null && trimmed === String(draft.originalStock)) {
    return { value: draft.originalStock, changed: false };
  }
  const parsed = parseStock(trimmed);
  if (parsed === null) return null;
  return { value: parsed, changed: parsed !== draft.originalStock };
}

export function validateDrafts(drafts: readonly SizeDraft[]): DraftIssues {
  const sizeCounts = new Map<string, number>();
  const skuCounts = new Map<string, number>();
  for (const draft of drafts) {
    const size = sizeIdentity(draft.size);
    if (size) sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1);
    const sku = draft.sku.trim().toUpperCase();
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  }

  const byKey: Record<string, SizeDraftError> = {};
  let first: SizeDraftError | null = null;

  for (const draft of drafts) {
    const size = normalizeSize(draft.size);
    const sku = draft.sku.trim();
    let issue: SizeDraftError | null = null;

    if (!size) issue = 'empty';
    else if (size.length > MAX_SIZE_NAME_LENGTH) issue = 'tooLong';
    else if ((sizeCounts.get(size.toLowerCase()) ?? 0) > 1) issue = 'duplicate';
    else if (draftStock(draft) === null) issue = 'stock';
    else if (sku.length > MAX_SIZE_SKU_LENGTH) issue = 'skuTooLong';
    else if (sku && (skuCounts.get(sku.toUpperCase()) ?? 0) > 1) issue = 'skuDuplicate';

    if (issue) {
      byKey[draft.key] = issue;
      first ??= issue;
    }
  }

  return { byKey, first };
}

/**
 * The product total the database will derive from these drafts: active sizes
 * only, a negative (backordered) size counting as 0.
 */
export function draftsTotal(drafts: readonly SizeDraft[]): number {
  return drafts.reduce((sum, draft) => {
    if (!draft.isActive) return sum;
    return sum + Math.max(0, draftStock(draft)?.value ?? 0);
  }, 0);
}

/** Drafts → the ordered list admin_set_product_inventory takes. Validate first. */
export function buildVariantPayload(drafts: readonly SizeDraft[]): VariantPayload[] {
  return drafts.map((draft) => {
    const stock = draftStock(draft);
    const row: VariantPayload = {
      size: normalizeSize(draft.size),
      sku: draft.sku.trim() || null,
      is_active: draft.isActive,
    };
    if (draft.id) row.id = draft.id;

    if (draft.id === null || draft.originalStock === null) {
      row.stock_qty = stock?.value ?? 0;
    } else if (stock?.changed) {
      row.stock_qty = stock.value;
      row.expected_stock_qty = draft.originalStock;
    }
    return row;
  });
}

/**
 * Whether saving `drafts` would change anything compared with `saved` (the
 * list as the database holds it): a size added, removed, renamed, reordered,
 * switched on or off, re-SKU'd, or restocked. Unchanged lists are not sent,
 * so editing a product's name never rewrites its sizes.
 */
export function sizeListChanged(drafts: readonly SizeDraft[], saved: readonly SizeDraft[]): boolean {
  return JSON.stringify(buildVariantPayload(drafts)) !== JSON.stringify(buildVariantPayload(saved));
}

/**
 * After a stock conflict, adopt the database's current figures as the new
 * baseline. A size the admin did not touch shows the fresh figure; one they
 * edited keeps the typed value, so saving again applies it knowingly.
 */
export function rebaseDrafts(drafts: readonly SizeDraft[], fresh: readonly ProductVariant[]): SizeDraft[] {
  const current = new Map(fresh.map((v) => [v.id, v]));
  return drafts.map((draft) => {
    const variant = draft.id ? current.get(draft.id) : undefined;
    if (!variant) return draft;
    const edited = draftStock(draft)?.changed ?? true;
    return {
      ...draft,
      originalStock: variant.stock_qty,
      stock: edited ? draft.stock : String(variant.stock_qty),
    };
  });
}

/** "AUR-RW-104" + "M" → "AUR-RW-104-M". Null without a product SKU. */
export function suggestSku(productSku: string, size: string): string | null {
  const base = productSku.trim();
  const part = normalizeSize(size)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base || !part) return null;
  return `${base}-${part}`.slice(0, MAX_SIZE_SKU_LENGTH);
}

/** Gives every size without a SKU the suggested one. */
export function fillEmptySkus(drafts: SizeDraft[], productSku: string): SizeDraft[] {
  return drafts.map((draft) =>
    draft.sku.trim() ? draft : { ...draft, sku: suggestSku(productSku, draft.size) ?? '' },
  );
}

export function setAllStock(drafts: SizeDraft[], stock: number): SizeDraft[] {
  return drafts.map((draft) => ({ ...draft, stock: String(stock) }));
}

/** Moves the draft at `index` by `delta` places; out-of-range moves are no-ops. */
export function moveDraft(drafts: SizeDraft[], index: number, delta: number): SizeDraft[] {
  const target = index + delta;
  if (index < 0 || index >= drafts.length || target < 0 || target >= drafts.length) return drafts;
  const next = [...drafts];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
