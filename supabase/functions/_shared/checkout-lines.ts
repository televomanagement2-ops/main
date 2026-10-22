// ─────────────────────────────────────────────────────────────────────────────
// Checkout line resolution: (what the client asked for + catalogue rows) → the
// lines the order is written with, or the reason it cannot be.
//
// Pure — no Deno, Stripe or Supabase imports — so create-checkout-session and
// the Vitest suite run the same code. The client is never the trust boundary:
// it only names products, sizes and quantities. Prices, names, images and the
// size row each line takes its stock from all come from the database rows the
// caller passes in.
// ─────────────────────────────────────────────────────────────────────────────

// Abuse limits: a legitimate shopper never needs more than this.
export const MAX_LINE_ITEMS = 50;
export const MAX_QUANTITY_PER_ITEM = 100;

/** Mirrors product_variants_size_format_check (migration 021). */
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
   * Migration 021. TRUE: a size is required and must be on sale. FALSE: the
   * product is not sold by size. Undefined/null only on a database that has
   * not run 021 yet — a size is then validated when given, as before.
   */
  has_sizes?: boolean | null;
  product_images?: { url: string; is_primary: boolean }[] | null;
}

/** An ACTIVE product_variants row — inactive sizes must not be passed in. */
export interface CatalogVariant {
  id: string;
  product_id: string;
  size: string;
  stock_qty: number;
}

export interface ResolvedLine {
  product_id: string;
  variant_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  image: string | null;
  selected_size: string | null;
}

const fail = (status: number, code: string, phase: string, message: string): LineError => ({
  ok: false,
  status,
  code,
  phase,
  message,
});

export const lineKey = (productId: string, size: string | null) => `${productId}::${size ?? ''}`;

/**
 * Validate the raw request lines and collapse duplicates by (product, size).
 *
 * The stock checks in resolveLines are only meaningful against the TOTAL asked
 * for one size: checking each line on its own let 50 separate lines of the same
 * item, each at the stock limit, pass individually and oversell by 50× (the DB
 * deliberately allows negative stock, so nothing downstream stops it).
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
    const item = (raw ?? {}) as { product_id?: unknown; quantity?: unknown; selected_size?: unknown };

    if (typeof item.product_id !== 'string' || !item.product_id) {
      return fail(400, 'VALIDATION_MISSING_PRODUCT_ID', 'request.validate_items', 'One or more items are missing product_id.');
    }
    // Checked here so a malformed id is a clean 400, not a Postgres cast error
    // surfacing as a 500 from the product lookup.
    if (!UUID_PATTERN.test(item.product_id)) {
      return fail(400, 'VALIDATION_INVALID_PRODUCT_ID', 'request.validate_items', 'One or more items have an invalid product_id.');
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

    const key = lineKey(item.product_id, size);
    const existing = merged.get(key);
    if (existing) existing.quantity += quantity;
    else merged.set(key, { product_id: item.product_id, selected_size: size, quantity });
  }

  return { ok: true, items: [...merged.values()] };
}

/** Products whose active sizes must be loaded before calling resolveLines. */
export function productIdsNeedingSizes(items: MergedItem[], products: CatalogProduct[]): string[] {
  const ids = new Set<string>();
  for (const product of products) if (product.has_sizes) ids.add(product.id);
  for (const item of items) if (item.selected_size) ids.add(item.product_id);
  return [...ids];
}

/**
 * Turn merged request lines into order lines priced from the catalogue.
 *
 * `activeVariants` must hold the ACTIVE sizes of every product returned by
 * productIdsNeedingSizes — a size that is switched off is not for sale.
 */
export function resolveLines(
  items: MergedItem[],
  products: CatalogProduct[],
  activeVariants: CatalogVariant[],
): { ok: true; lines: ResolvedLine[] } | LineError {
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantByKey = new Map(activeVariants.map((v) => [lineKey(v.product_id, v.size), v]));

  // products.stock_quantity covers every size of a product (for a sized product
  // it IS the sum of its sizes), so it is checked against the combined quantity
  // across sizes, not per line.
  const quantityByProduct = new Map<string, number>();
  for (const item of items) {
    quantityByProduct.set(item.product_id, (quantityByProduct.get(item.product_id) ?? 0) + item.quantity);
  }

  const lines: ResolvedLine[] = [];
  for (const item of items) {
    const product = productById.get(item.product_id);
    if (!product) {
      return fail(400, 'PRODUCT_NOT_FOUND', 'request.resolve_prices', `Product ${item.product_id} does not exist.`);
    }
    if (product.is_active === false) {
      return fail(409, 'PRODUCT_INACTIVE', 'request.resolve_prices', `Product "${product.name}" is no longer available.`);
    }
    if (item.quantity > MAX_QUANTITY_PER_ITEM) {
      return fail(
        400,
        'INVALID_QUANTITY',
        'request.resolve_prices',
        `Invalid quantity for product "${product.name}" (max ${MAX_QUANTITY_PER_ITEM}).`,
      );
    }

    const productTotal = quantityByProduct.get(item.product_id) ?? item.quantity;
    if (typeof product.stock_quantity === 'number' && productTotal > product.stock_quantity) {
      return fail(409, 'INSUFFICIENT_STOCK', 'request.resolve_prices', `Insufficient stock for "${product.name}".`);
    }

    // The size selector lives in the browser; a hand-written request can leave
    // it out. A sized product sold without a size would take stock from no
    // size row at all, so it is refused here rather than accepted and flagged.
    if (product.has_sizes === true && !item.selected_size) {
      return fail(400, 'SIZE_REQUIRED', 'request.resolve_variants', `Choose a size for "${product.name}".`);
    }
    if (product.has_sizes === false && item.selected_size) {
      return fail(400, 'SIZE_NOT_APPLICABLE', 'request.resolve_variants', `"${product.name}" is not sold by size.`);
    }

    let variantId: string | null = null;
    if (item.selected_size) {
      const variant = variantByKey.get(lineKey(item.product_id, item.selected_size));
      if (!variant) {
        return fail(
          409,
          'VARIANT_NOT_FOUND',
          'request.resolve_variants',
          `Size "${item.selected_size}" is not available for "${product.name}".`,
        );
      }
      if (Number(variant.stock_qty) < item.quantity) {
        return fail(
          409,
          'INSUFFICIENT_STOCK',
          'request.resolve_variants',
          `Insufficient stock for "${product.name}" size ${item.selected_size}.`,
        );
      }
      variantId = variant.id;
    }

    const images = product.product_images ?? [];
    lines.push({
      product_id: product.id,
      variant_id: variantId,
      name: product.name,
      unit_price: Math.round(Number(product.price) * 100) / 100,
      quantity: item.quantity,
      image: images.find((img) => img.is_primary)?.url ?? images[0]?.url ?? null,
      selected_size: item.selected_size,
    });
  }

  return { ok: true, lines };
}
