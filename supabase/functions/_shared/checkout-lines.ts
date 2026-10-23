// ─────────────────────────────────────────────────────────────────────────────
// Checkout line resolution: (what the client asked for + catalogue rows) → the
// lines the order is written with, or the reason it cannot be.
//
// Pure — no Deno, Stripe or Supabase imports — so create-checkout-session and
// the Vitest suite run the same code. The client is never the trust boundary:
// it only names products, variants and quantities. Prices, names, images, SKUs
// and the variant row each line takes its stock from all come from the
// database rows the caller passes in.
// ─────────────────────────────────────────────────────────────────────────────

// Abuse limits: a legitimate shopper never needs more than this.
export const MAX_LINE_ITEMS = 50;
export const MAX_QUANTITY_PER_ITEM = 100;

/** Mirrors product_variants_size_format_check (migrations 021/022). */
export const MAX_SIZE_LENGTH = 40;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LineError {
  ok: false;
  status: number;
  code: string;
  phase: string;
  message: string;
}

export interface MergedItem {
  product_id: string;
  /** The variant row (size and/or colour) the shopper picked. */
  variant_id: string | null;
  /** Carts saved before variant ids existed name the size instead. */
  selected_size: string | null;
  quantity: number;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number | string;
  is_active: boolean;
  stock_quantity: number | null;
  /**
   * Migrations 021/022. TRUE: a variant with a size (has_sizes) and/or a
   * colour (has_colors) is required and must be on sale. Both undefined only
   * on a database that has not run 021 — a size is then validated when given.
   */
  has_sizes?: boolean | null;
  has_colors?: boolean | null;
  sku?: string | null;
  category_id?: string | null;
  compare_at_price?: number | string | null;
  cost_price?: number | string | null;
  product_images?: { url: string; is_primary: boolean; color_id?: string | null; sort_order?: number | null }[] | null;
}

/** An ACTIVE product_variants row — inactive variants must not be passed in. */
export interface CatalogVariant {
  id: string;
  product_id: string;
  size: string | null;
  stock_qty: number;
  color_id?: string | null;
  /** NULL: the product price. */
  price?: number | string | null;
  sku?: string | null;
  /** From product_variant_costs; NULL: fall back to the product's cost. */
  cost_price?: number | string | null;
}

export interface CatalogColor {
  id: string;
  name: string;
}

export interface ResolvedLine {
  product_id: string;
  variant_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  image: string | null;
  selected_size: string | null;
  selected_color: string | null;
  sku: string | null;
  /** What one unit cost the store, when known (snapshotted, admin-only). */
  unit_cost: number | null;
  category_id: string | null;
  /** Sold below its compare-at price — some discount codes exclude these. */
  on_sale: boolean;
}

const fail = (status: number, code: string, phase: string, message: string): LineError => ({
  ok: false,
  status,
  code,
  phase,
  message,
});

export const lineKey = (productId: string, size: string | null) => `${productId}::${size ?? ''}`;

const toAmount = (value: number | string | null | undefined): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/**
 * Validate the raw request lines and collapse duplicates.
 *
 * The stock checks in resolveLines are only meaningful against the TOTAL asked
 * for one variant: checking each line on its own let 50 separate lines of the
 * same item, each at the stock limit, pass individually and oversell by 50×
 * (the DB deliberately allows negative stock, so nothing downstream stops it).
 * resolveLines merges again once the lines are resolved, which also catches a
 * variant named once by id and once by its size.
 */
export function mergeItems(items: unknown): { ok: true; items: MergedItem[] } | LineError {
  if (!Array.isArray(items) || items.length === 0) {
    return fail(400, 'VALIDATION_NO_ITEMS', 'request.validate_items', 'No items provided');
  }
  if (items.length > MAX_LINE_ITEMS) {
    return fail(400, 'VALIDATION_TOO_MANY_ITEMS', 'request.validate_items', `Too many line items (max ${MAX_LINE_ITEMS}).`);
  }

  const merged = new Map<string, MergedItem>();
  for (const raw of items) {
    const item = (raw ?? {}) as {
      product_id?: unknown;
      variant_id?: unknown;
      quantity?: unknown;
      selected_size?: unknown;
    };

    if (typeof item.product_id !== 'string' || !item.product_id) {
      return fail(400, 'VALIDATION_MISSING_PRODUCT_ID', 'request.validate_items', 'One or more items are missing product_id.');
    }
    // Checked here so a malformed id is a clean 400, not a Postgres cast error
    // surfacing as a 500 from the product lookup.
    if (!UUID_PATTERN.test(item.product_id)) {
      return fail(400, 'VALIDATION_INVALID_PRODUCT_ID', 'request.validate_items', 'One or more items have an invalid product_id.');
    }

    let variantId: string | null = null;
    if (item.variant_id != null) {
      if (typeof item.variant_id !== 'string' || !UUID_PATTERN.test(item.variant_id)) {
        return fail(400, 'VALIDATION_INVALID_VARIANT', 'request.validate_items', 'One or more items have an invalid variant.');
      }
      variantId = item.variant_id;
    }

    const quantity = Math.trunc(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return fail(400, 'INVALID_QUANTITY', 'request.validate_items', 'Invalid quantity.');
    }

    let size: string | null = null;
    if (item.selected_size != null) {
      if (typeof item.selected_size !== 'string') {
        return fail(400, 'VALIDATION_INVALID_SIZE', 'request.validate_items', 'Invalid size.');
      }
      size = item.selected_size.trim() || null;
      if (size && size.length > MAX_SIZE_LENGTH) {
        return fail(400, 'VALIDATION_INVALID_SIZE', 'request.validate_items', 'Invalid size.');
      }
    }
    // A variant id says everything a size would.
    if (variantId) size = null;

    const key = variantId ? `variant:${variantId}` : lineKey(item.product_id, size);
    const existing = merged.get(key);
    if (existing) existing.quantity += quantity;
    else merged.set(key, { product_id: item.product_id, variant_id: variantId, selected_size: size, quantity });
  }

  return { ok: true, items: [...merged.values()] };
}

const isVaried = (product: CatalogProduct) => product.has_sizes === true || product.has_colors === true;

/** Products whose active variants must be loaded before calling resolveLines. */
export function productIdsNeedingVariants(items: MergedItem[], products: CatalogProduct[]): string[] {
  const ids = new Set<string>();
  for (const product of products) if (isVaried(product)) ids.add(product.id);
  for (const item of items) if (item.selected_size || item.variant_id) ids.add(item.product_id);
  return [...ids];
}

/** @deprecated Kept for callers written before colours; same as productIdsNeedingVariants. */
export const productIdsNeedingSizes = productIdsNeedingVariants;

/** A colour's own photo when the variant has one, else the product's. */
function lineImage(product: CatalogProduct, colorId: string | null): string | null {
  const images = product.product_images ?? [];
  if (colorId) {
    const own = images
      .filter((img) => img.color_id === colorId)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (own.length > 0) return own[0].url;
  }
  return images.find((img) => img.is_primary)?.url ?? images[0]?.url ?? null;
}

/**
 * Turn merged request lines into order lines priced from the catalogue.
 *
 * `activeVariants` must hold the ACTIVE variants of every product returned by
 * productIdsNeedingVariants — a variant that is switched off is not for sale.
 */
export function resolveLines(
  items: MergedItem[],
  products: CatalogProduct[],
  activeVariants: CatalogVariant[],
  colors: CatalogColor[] = [],
): { ok: true; lines: ResolvedLine[] } | LineError {
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(activeVariants.map((v) => [v.id, v]));
  // Legacy carts name a size: only a size without a colour can be meant.
  const variantBySize = new Map(
    activeVariants.filter((v) => !v.color_id && v.size).map((v) => [lineKey(v.product_id, v.size), v]),
  );
  const colorName = new Map(colors.map((c) => [c.id, c.name]));

  const byKey = new Map<string, { line: ResolvedLine; variant: CatalogVariant | null }>();

  for (const item of items) {
    const product = productById.get(item.product_id);
    if (!product) {
      return fail(400, 'PRODUCT_NOT_FOUND', 'request.resolve_prices', `Product ${item.product_id} does not exist.`);
    }
    if (product.is_active === false) {
      return fail(409, 'PRODUCT_INACTIVE', 'request.resolve_prices', `Product "${product.name}" is no longer available.`);
    }

    let variant: CatalogVariant | null = null;
    if (item.variant_id) {
      variant = variantById.get(item.variant_id) ?? null;
      if (!variant || variant.product_id !== product.id) {
        return fail(409, 'VARIANT_NOT_FOUND', 'request.resolve_variants', `The option chosen for "${product.name}" is no longer available.`);
      }
    } else if (item.selected_size) {
      if (product.has_sizes === false && product.has_colors !== true) {
        return fail(400, 'SIZE_NOT_APPLICABLE', 'request.resolve_variants', `"${product.name}" is not sold by size.`);
      }
      variant = variantBySize.get(lineKey(product.id, item.selected_size)) ?? null;
      if (!variant) {
        return fail(
          409,
          'VARIANT_NOT_FOUND',
          'request.resolve_variants',
          `Size "${item.selected_size}" is not available for "${product.name}".`,
        );
      }
    }

    // The selectors live in the browser; a hand-written request can leave
    // them out. A product with variants sold without one would take stock
    // from no row at all, so it is refused here rather than accepted and
    // flagged.
    if (isVaried(product) && !variant) {
      return product.has_colors
        ? fail(400, 'VARIANT_REQUIRED', 'request.resolve_variants', `Choose an option for "${product.name}".`)
        : fail(400, 'SIZE_REQUIRED', 'request.resolve_variants', `Choose a size for "${product.name}".`);
    }
    if (variant && !isVaried(product) && product.has_sizes === false) {
      return fail(400, 'SIZE_NOT_APPLICABLE', 'request.resolve_variants', `"${product.name}" has no options to choose.`);
    }
    // A variant left over from before the product changed shape (sizes or
    // colours switched on or off since the cart was filled).
    if (
      variant
      && isVaried(product)
      && (Boolean(variant.size) !== Boolean(product.has_sizes) || Boolean(variant.color_id) !== Boolean(product.has_colors))
    ) {
      return fail(409, 'VARIANT_NOT_FOUND', 'request.resolve_variants', `The option chosen for "${product.name}" is no longer available.`);
    }

    const key = variant ? `variant:${variant.id}` : `product:${product.id}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.line.quantity += item.quantity;
      continue;
    }

    const unitPrice = toAmount(variant?.price) ?? toAmount(product.price) ?? 0;
    const compareAt = toAmount(product.compare_at_price);
    byKey.set(key, {
      variant,
      line: {
        product_id: product.id,
        variant_id: variant?.id ?? null,
        name: product.name,
        unit_price: unitPrice,
        quantity: item.quantity,
        image: lineImage(product, variant?.color_id ?? null),
        selected_size: variant ? variant.size : item.selected_size,
        selected_color: variant?.color_id ? colorName.get(variant.color_id) ?? null : null,
        sku: variant?.sku || product.sku || null,
        unit_cost: toAmount(variant?.cost_price) ?? toAmount(product.cost_price),
        category_id: product.category_id ?? null,
        on_sale: compareAt != null && compareAt > unitPrice,
      },
    });
  }

  const resolved = [...byKey.values()];

  // products.stock_quantity covers every variant of a product (for a product
  // with variants it IS their sum), so it is checked against the combined
  // quantity across variants, not per line.
  const quantityByProduct = new Map<string, number>();
  for (const { line } of resolved) {
    quantityByProduct.set(line.product_id, (quantityByProduct.get(line.product_id) ?? 0) + line.quantity);
  }

  for (const { line, variant } of resolved) {
    const product = productById.get(line.product_id) as CatalogProduct;
    if (line.quantity > MAX_QUANTITY_PER_ITEM) {
      return fail(
        400,
        'INVALID_QUANTITY',
        'request.resolve_prices',
        `Invalid quantity for product "${product.name}" (max ${MAX_QUANTITY_PER_ITEM}).`,
      );
    }

    const productTotal = quantityByProduct.get(line.product_id) ?? line.quantity;
    if (typeof product.stock_quantity === 'number' && productTotal > product.stock_quantity) {
      return fail(409, 'INSUFFICIENT_STOCK', 'request.resolve_prices', `Insufficient stock for "${product.name}".`);
    }

    if (variant && Number(variant.stock_qty) < line.quantity) {
      const label = [line.selected_color, line.selected_size].filter(Boolean).join(' / ');
      return fail(
        409,
        'INSUFFICIENT_STOCK',
        'request.resolve_variants',
        `Insufficient stock for "${product.name}"${label ? ` (${label})` : ''}.`,
      );
    }
  }

  return { ok: true, lines: resolved.map((r) => r.line) };
}
