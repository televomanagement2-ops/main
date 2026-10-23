import type { CartItemLocal } from '../types';
import { lineVariant } from './stock';
import { primaryImageUrl } from './variants';

/** The chosen colour's photo when it has one. */
export function cartLineImage(item: CartItemLocal): string | null {
  const variant = lineVariant(item.product, item.variantId, item.selectedSize);
  return primaryImageUrl(item.product, variant?.color_id ?? null);
}

/** Back to the product page, with the colour chosen. */
export function cartLineLink(item: CartItemLocal): string {
  const variant = lineVariant(item.product, item.variantId, item.selectedSize);
  return variant?.color_id
    ? `/products/${item.product.slug}?color=${variant.color_id}`
    : `/products/${item.product.slug}`;
}
