// ─────────────────────────────────────────────────────────────────────────────
// Sizes — the vocabulary behind products sold by size or measurement.
//
// The words the storefront can show above the size selector, the presets the
// admin editor offers, and the small parsers both share. The variant model
// itself (sizes, colours and their combinations) lives in ./variants.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { SizeLabel } from '../types';

/** Mirrors products_size_label_check (migration 021). */
export const SIZE_LABELS: readonly SizeLabel[] = [
  'size',
  'measure',
  'length',
  'shoe_size',
  'ring_size',
  'waist',
];

/** Mirror product_variants_size_format_check (migrations 021/022). */
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

/** Collapses inner whitespace and trims: "  50  cm " → "50 cm". */
export const normalizeSize = (size: string) => size.trim().replace(/\s+/g, ' ');

/** A whole number from 0 to MAX_STOCK_INPUT, or null. */
export function parseStock(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_STOCK_INPUT ? value : null;
}
