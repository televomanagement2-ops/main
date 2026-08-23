// ─────────────────────────────────────────────────────────────────────────────
// Stock arithmetic — one place, because three different rules used to be spread
// across the storefront and they disagreed with each other and with the server.
//
//  1. Stock can be NEGATIVE. Migration 013 dropped the `>= 0` constraint on
//     purpose: a paid order is always honored, so an oversold product carries
//     its backorder depth as a negative number. Anything that compares stock to
//     0 with `===` therefore reads an oversold product as "in stock" and, worse,
//     `Math.min(qty, -5)` puts a NEGATIVE quantity in the cart.
//  2. For a sized item the binding limit is the VARIANT's stock, not the
//     product's. The product total is shared across all sizes.
//  3. products.stock_quantity is still an upper bound for a sized item: the
//     checkout function deducts from both counters, so the smaller of the two
//     is what can actually ship.
// ─────────────────────────────────────────────────────────────────────────────

import type { Product } from '../types';

/** Never negative — a backordered product can have 0 units available, not -5. */
export const sellableStock = (quantity: number | null | undefined): number =>
  Math.max(0, Math.trunc(Number(quantity) || 0));

/**
 * How many units of this product (optionally, of this size) a shopper may add.
 * Returns 0 for anything unavailable, so callers can treat `=== 0` as sold out.
 */
export function availableStock(product: Product, selectedSize?: string | null): number {
  const productStock = sellableStock(product.stock_quantity);
  if (!selectedSize) return productStock;

  const variants = product.product_variants;
  // No variant data loaded (some queries don't select it) — fall back to the
  // product total rather than blocking the line outright. The checkout function
  // re-validates variant stock server-side either way.
  if (!variants || variants.length === 0) return productStock;

  const variant = variants.find((v) => v.size === selectedSize);
  if (!variant || variant.is_active === false) return 0;
  return Math.min(productStock, sellableStock(variant.stock_qty));
}

/** True when nothing can be added at all (sold out or oversold). */
export const isSoldOut = (product: Product): boolean =>
  sellableStock(product.stock_quantity) === 0;
