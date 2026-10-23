// ─────────────────────────────────────────────────────────────────────────────
// Stock arithmetic — one place, because three different rules used to be spread
// across the storefront and they disagreed with each other and with the server.
//
//  1. Stock can be NEGATIVE. Migration 013 dropped the `>= 0` constraint on
//     purpose: a paid order is always honored, so an oversold product carries
//     its backorder depth as a negative number. Anything that compares stock to
//     0 with `===` therefore reads an oversold product as "in stock" and, worse,
//     `Math.min(qty, -5)` puts a NEGATIVE quantity in the cart.
//  2. For a product with variants (sizes and/or colours) the binding limit is
//     the VARIANT's stock, not the product's. The product total is shared
//     across all variants.
//  3. products.stock_quantity is still an upper bound. Since migrations 021/022
//     the database derives it from the variants on sale, so it can only be
//     smaller than a variant's figure when that variant is switched off — and
//     then it is not for sale anyway.
// ─────────────────────────────────────────────────────────────────────────────

import type { Product, ProductVariant } from '../types';

/** Never negative — a backordered product can have 0 units available, not -5. */
export const sellableStock = (quantity: number | null | undefined): number =>
  Math.max(0, Math.trunc(Number(quantity) || 0));

/**
 * The variant a cart line names: by id, or — for a line saved before variant
 * ids existed — by the size it recorded (a size without a colour). Undefined
 * when the product's variants are not loaded (listing queries skip them).
 */
export function lineVariant(
  product: Product,
  variantId?: string | null,
  legacySize?: string | null,
): ProductVariant | null | undefined {
  if (!variantId && !legacySize) return null;
  const variants = product.product_variants;
  if (!variants) return undefined;
  const found = variantId
    ? variants.find((v) => v.id === variantId)
    : variants.find((v) => !v.color_id && v.size === legacySize);
  return found ?? null;
}

/**
 * How many units of this product (optionally, of this variant) a shopper may
 * add. Returns 0 for anything unavailable, so callers can treat `=== 0` as
 * sold out.
 */
export function availableStock(
  product: Product,
  variantId?: string | null,
  legacySize?: string | null,
): number {
  const productStock = sellableStock(product.stock_quantity);
  const variant = lineVariant(product, variantId, legacySize);
  // No variant named, or variant data not loaded — fall back to the product
  // total rather than blocking the line outright. The checkout function
  // re-validates the variant's stock server-side either way.
  if (variant === null && !variantId && !legacySize) return productStock;
  if (variant === undefined) return productStock;
  // A LOADED list without this variant (or with it switched off): not for sale.
  if (!variant || variant.is_active === false) return 0;
  return Math.min(productStock, sellableStock(variant.stock_qty));
}

/**
 * Whether a cart line's variant choice fits the product as it is now: a
 * product with sizes or colours needs a variant, one without must not carry
 * one (checkout refuses both). `has_sizes` is undefined only on product rows
 * cached before migration 021 — those are left alone until fresh data arrives.
 */
export function variantChoiceFits(product: Product, variantId?: string | null, legacySize?: string | null): boolean {
  if (product.has_sizes == null) return true;
  const varied = product.has_sizes === true || product.has_colors === true;
  const chosen = Boolean(variantId || legacySize);
  return varied ? chosen : !chosen;
}

/** A loaded variant that no longer matches the product's shape (sizes/colours switched on or off). */
export function variantFitsShape(product: Product, variant: ProductVariant): boolean {
  return (
    Boolean(variant.size) === Boolean(product.has_sizes)
    && Boolean(variant.color_id) === Boolean(product.has_colors)
  );
}

/** True when nothing can be added at all (sold out or oversold). */
export const isSoldOut = (product: Product): boolean =>
  sellableStock(product.stock_quantity) === 0;
