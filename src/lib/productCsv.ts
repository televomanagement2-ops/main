// ─────────────────────────────────────────────────────────────────────────────
// Catalogue CSV — the file the admin exports, edits in a spreadsheet and
// imports back (admin_import_products, migration 022).
//
// One row per variant (one row for a product without variants); the product's
// own fields repeat on every row so the file can be sorted and filtered freely,
// and the import reads them from a product's first row. A column that is not in
// the file leaves that field alone; an empty cell clears an optional field.
// ─────────────────────────────────────────────────────────────────────────────

import type { Category, Product } from '../types';
import { csvNumber, parseCsvBoolean, parseCsvNumber, type CsvCell, type CsvDialect } from './csv';
import { isColorLabel, sortColors, sortVariants } from './variants';
import { isSizeLabel } from './sizes';

export const PRODUCT_CSV_COLUMNS = [
  'handle',
  'name',
  'description',
  'category',
  'price',
  'compare_at_price',
  'cost_price',
  'product_sku',
  'active',
  'featured',
  'weight_grams',
  'low_stock_threshold',
  'size_label',
  'color_label',
  'color',
  'color_swatch',
  'size',
  'variant_sku',
  'variant_price',
  'variant_cost',
  'stock',
  'variant_active',
  'images',
] as const;

type Column = (typeof PRODUCT_CSV_COLUMNS)[number];

/** Other headings a spreadsheet may use for the same column. */
const ALIASES: Record<string, Column> = {
  slug: 'handle',
  title: 'name',
  sku: 'product_sku',
  compare_at: 'compare_at_price',
  cost: 'cost_price',
  stock_quantity: 'stock',
  quantity: 'stock',
  image: 'images',
};

const IMAGE_SEPARATOR = ' | ';

export const MAX_IMPORT_PRODUCTS = 1000;

/** The catalogue as rows, header first. */
export function productsToCsvRows(
  products: readonly Product[],
  options: {
    dialect: CsvDialect;
    categories: readonly Category[];
    costs: { products: Record<string, number>; variants: Record<string, number> };
  },
): CsvCell[][] {
  const { dialect, costs } = options;
  const categorySlug = new Map(options.categories.map((c) => [c.id, c.slug]));
  const money = (n: number | null | undefined) => csvNumber(n, 2, dialect);
  const rows: CsvCell[][] = [[...PRODUCT_CSV_COLUMNS]];

  for (const product of products) {
    const images = [...(product.product_images ?? [])]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
      .map((img) => img.url)
      .join(IMAGE_SEPARATOR);
    const base: Record<Column, CsvCell> = {
      handle: product.slug,
      name: product.name,
      description: product.description ?? '',
      category: categorySlug.get(product.category_id) ?? '',
      price: money(product.price),
      compare_at_price: money(product.compare_at_price),
      cost_price: money(costs.products[product.id] ?? null),
      product_sku: product.sku ?? '',
      active: product.is_active,
      featured: product.is_featured,
      weight_grams: product.weight_grams ?? '',
      low_stock_threshold: product.low_stock_threshold,
      size_label: product.has_sizes ? product.size_label : '',
      color_label: product.has_colors ? product.color_label : '',
      color: '',
      color_swatch: '',
      size: '',
      variant_sku: '',
      variant_price: '',
      variant_cost: '',
      stock: product.stock_quantity,
      variant_active: '',
      images,
    };

    const shaped = sortVariants(product.product_variants).filter(
      (v) => Boolean(v.size) === product.has_sizes && Boolean(v.color_id) === product.has_colors,
    );
    if (!(product.has_sizes || product.has_colors) || shaped.length === 0) {
      rows.push(PRODUCT_CSV_COLUMNS.map((c) => base[c]));
      continue;
    }

    const colors = new Map(sortColors(product.product_colors).map((c) => [c.id, c]));
    for (const variant of shaped) {
      const color = variant.color_id ? colors.get(variant.color_id) : undefined;
      const row: Record<Column, CsvCell> = {
        ...base,
        color: color?.name ?? '',
        color_swatch: color?.swatch ?? '',
        size: variant.size ?? '',
        variant_sku: variant.sku ?? '',
        variant_price: money(variant.price),
        variant_cost: money(costs.variants[variant.id] ?? null),
        stock: variant.stock_qty,
        variant_active: variant.is_active,
      };
      rows.push(PRODUCT_CSV_COLUMNS.map((c) => row[c]));
    }
  }
  return rows;
}

export interface ImportIssue {
  /** 1-based line of the file (the header is line 1). */
  line: number;
  message: ImportMessage;
  value?: string;
}

export type ImportMessage =
  | 'noHandleColumn'
  | 'unknownColumns'
  | 'handle'
  | 'number'
  | 'boolean'
  | 'sizeLabel'
  | 'colorLabel'
  | 'missingColor'
  | 'missingSize'
  | 'duplicateVariant'
  | 'tooMany';

export interface ImportPlan {
  /** What admin_import_products takes. */
  products: Record<string, unknown>[];
  issues: ImportIssue[];
  /** Columns of the file that are not recognised (ignored). */
  ignoredColumns: string[];
  variantCount: number;
}

const HANDLE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Parsed CSV rows (header first) → the import, or the problems that stop it. */
export function planImport(rows: readonly string[][]): ImportPlan {
  const issues: ImportIssue[] = [];
  if (rows.length === 0) return { products: [], issues: [{ line: 1, message: 'noHandleColumn' }], ignoredColumns: [], variantCount: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const index = new Map<Column, number>();
  const ignoredColumns: string[] = [];
  header.forEach((name, i) => {
    const column = (PRODUCT_CSV_COLUMNS as readonly string[]).includes(name) ? (name as Column) : ALIASES[name];
    if (column && !index.has(column)) index.set(column, i);
    else if (name) ignoredColumns.push(rows[0][i]);
  });
  if (!index.has('handle')) {
    return { products: [], issues: [{ line: 1, message: 'noHandleColumn' }], ignoredColumns, variantCount: 0 };
  }

  const has = (c: Column) => index.has(c);
  const cell = (row: readonly string[], c: Column) => (index.has(c) ? (row[index.get(c) as number] ?? '').trim() : '');

  const groups = new Map<string, { line: number; row: readonly string[] }[]>();
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const handle = cell(row, 'handle').toLowerCase();
    if (!HANDLE_PATTERN.test(handle) || handle.length > 80) {
      issues.push({ line, message: 'handle', value: cell(row, 'handle') });
      return;
    }
    const group = groups.get(handle) ?? [];
    group.push({ line, row });
    groups.set(handle, group);
  });
  if (groups.size > MAX_IMPORT_PRODUCTS) {
    issues.push({ line: 1, message: 'tooMany', value: String(groups.size) });
  }

  const number = (line: number, raw: string, allowNegative = false): number | null | undefined => {
    const value = parseCsvNumber(raw);
    if (value === null) return null;
    if (Number.isNaN(value) || (!allowNegative && value < 0)) {
      issues.push({ line, message: 'number', value: raw });
      return undefined;
    }
    return value;
  };
  const integer = (line: number, raw: string): number | null | undefined => {
    const value = number(line, raw);
    if (value != null && !Number.isInteger(value)) {
      issues.push({ line, message: 'number', value: raw });
      return undefined;
    }
    return value;
  };
  // A negative figure is a backorder the export wrote out; it cannot be set by
  // hand, so it means "leave the stock as it is".
  const stock = (line: number, raw: string): number | undefined => {
    const value = parseCsvNumber(raw);
    if (value === null) return undefined;
    if (Number.isNaN(value) || !Number.isInteger(value)) {
      issues.push({ line, message: 'number', value: raw });
      return undefined;
    }
    return value < 0 ? undefined : value;
  };
  const bool = (line: number, raw: string): boolean | null | undefined => {
    const value = parseCsvBoolean(raw);
    if (value === undefined) issues.push({ line, message: 'boolean', value: raw });
    return value;
  };

  const products: Record<string, unknown>[] = [];
  let variantCount = 0;

  for (const [handle, group] of groups) {
    const { line, row } = group[0];
    const product: Record<string, unknown> = { slug: handle };

    if (has('name') && cell(row, 'name')) product.name = cell(row, 'name');
    if (has('description')) product.description = cell(row, 'description') || null;
    if (has('category') && cell(row, 'category')) product.category = cell(row, 'category');
    if (has('price') && cell(row, 'price')) product.price = number(line, cell(row, 'price'));
    if (has('compare_at_price')) product.compare_at_price = number(line, cell(row, 'compare_at_price'));
    if (has('cost_price')) product.cost_price = number(line, cell(row, 'cost_price'));
    if (has('product_sku')) product.sku = cell(row, 'product_sku') || null;
    if (has('active') && cell(row, 'active')) product.is_active = bool(line, cell(row, 'active'));
    if (has('featured') && cell(row, 'featured')) product.is_featured = bool(line, cell(row, 'featured'));
    if (has('weight_grams')) product.weight_grams = integer(line, cell(row, 'weight_grams'));
    if (has('low_stock_threshold') && cell(row, 'low_stock_threshold')) {
      product.low_stock_threshold = integer(line, cell(row, 'low_stock_threshold'));
    }
    if (has('images')) {
      product.images = cell(row, 'images')
        .split(/\s*\|\s*/)
        .map((u) => u.trim())
        .filter(Boolean);
    }

    // Without a size or colour column the product's variants stay as they are:
    // only a product without variants takes the stock figure (migration 026).
    const sized = group.some((g) => cell(g.row, 'size') !== '');
    const colored = group.some((g) => cell(g.row, 'color') !== '');
    if (has('size')) product.has_sizes = sized;
    if (has('color')) product.has_colors = colored;

    const sizeLabel = cell(row, 'size_label');
    if (sizeLabel) {
      if (isSizeLabel(sizeLabel)) product.size_label = sizeLabel;
      else issues.push({ line, message: 'sizeLabel', value: sizeLabel });
    }
    const colorLabel = cell(row, 'color_label');
    if (colorLabel) {
      if (isColorLabel(colorLabel)) product.color_label = colorLabel;
      else issues.push({ line, message: 'colorLabel', value: colorLabel });
    }

    if (!sized && !colored) {
      const value = has('stock') ? stock(line, cell(row, 'stock')) : undefined;
      if (value !== undefined) product.stock_quantity = value;
      products.push(product);
      continue;
    }

    const colors: { name: string; swatch?: string }[] = [];
    const variants: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const g of group) {
      const color = cell(g.row, 'color');
      const size = cell(g.row, 'size');
      if (colored && !color) issues.push({ line: g.line, message: 'missingColor' });
      if (sized && !size) issues.push({ line: g.line, message: 'missingSize' });
      const identity = `${color.toLowerCase()}|${size.toLowerCase()}`;
      if (seen.has(identity)) {
        issues.push({ line: g.line, message: 'duplicateVariant', value: [color, size].filter(Boolean).join(' / ') });
        continue;
      }
      seen.add(identity);

      if (colored && color && !colors.some((c) => c.name.toLowerCase() === color.toLowerCase())) {
        const swatch = cell(g.row, 'color_swatch');
        colors.push(swatch ? { name: color, swatch } : { name: color });
      }

      const variant: Record<string, unknown> = {};
      if (colored) variant.color = color;
      if (sized) variant.size = size;
      if (has('variant_sku')) variant.sku = cell(g.row, 'variant_sku') || null;
      if (has('variant_price')) variant.price = number(g.line, cell(g.row, 'variant_price'));
      if (has('variant_cost')) variant.cost = number(g.line, cell(g.row, 'variant_cost'));
      const variantStock = has('stock') ? stock(g.line, cell(g.row, 'stock')) : undefined;
      if (variantStock !== undefined) variant.stock_qty = variantStock;
      if (has('variant_active') && cell(g.row, 'variant_active')) {
        variant.is_active = bool(g.line, cell(g.row, 'variant_active'));
      }
      variants.push(variant);
    }

    if (colored) product.colors = colors;
    product.variants = variants;
    variantCount += variants.length;
    products.push(product);
  }

  return { products, issues, ignoredColumns, variantCount };
}
