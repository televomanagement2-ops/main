import { supabase } from './supabaseClient';
import type { CartItemLocal } from '../types';

/**
 * Merges a guest localStorage cart into the authenticated user's DB cart.
 *
 * Strategy:
 *  - Fetch (or create) the user's DB cart
 *  - For each guest item, add its quantity to any existing DB quantity,
 *    capped at current stock
 *  - Clear the localStorage cart on success
 *
 * Call this once, right after a successful sign-in, before redirecting.
 */
export async function mergeGuestCartIntoDbCart(
  userId: string,
  guestItems: CartItemLocal[],
  clearLocalCart: () => void
): Promise<void> {
  if (guestItems.length === 0) return;

  // 1. Fetch or create the DB cart
  const { data: existingCart, error: cartFetchErr } = await supabase
    .from('carts')
    .select('id, cart_items(id, product_id, quantity)')
    .eq('user_id', userId)
    .maybeSingle();

  if (cartFetchErr) throw cartFetchErr;

  let cartId: string;

  if (existingCart) {
    cartId = existingCart.id as string;
  } else {
    const { data: newCart, error: createErr } = await supabase
      .from('carts')
      .insert({ user_id: userId })
      .select('id')
      .single();

    if (createErr) throw createErr;
    cartId = (newCart as { id: string }).id;
  }

  // Build a map of existing DB cart items: productId → { id, quantity }
  type DbItem = { id: string; product_id: string; quantity: number };
  const existingItems: DbItem[] =
    (existingCart?.cart_items as DbItem[] | undefined) ?? [];

  const dbItemMap = new Map<string, DbItem>(
    existingItems.map((i) => [i.product_id, i])
  );

  // 2. Fetch current stock for all guest products in one query
  const guestProductIds = guestItems.map((i) => i.product.id);
  const { data: stockRows, error: stockErr } = await supabase
    .from('products')
    .select('id, stock_quantity')
    .in('id', guestProductIds)
    .eq('is_active', true);

  if (stockErr) throw stockErr;

  const stockMap = new Map<string, number>(
    ((stockRows ?? []) as { id: string; stock_quantity: number }[]).map(
      (r) => [r.id, r.stock_quantity]
    )
  );

  // 3. Build upsert payload respecting stock limits
  const upserts: { cart_id: string; product_id: string; quantity: number }[] = [];

  for (const guestItem of guestItems) {
    const pid = guestItem.product.id;
    const stock = stockMap.get(pid);

    // Skip products that are inactive or out of stock
    if (stock === undefined || stock === 0) continue;

    const existingQty = dbItemMap.get(pid)?.quantity ?? 0;
    const mergedQty = Math.min(existingQty + guestItem.quantity, stock);

    if (mergedQty > 0) {
      upserts.push({ cart_id: cartId, product_id: pid, quantity: mergedQty });
    }
  }

  if (upserts.length === 0) {
    clearLocalCart();
    return;
  }

  // 4. Single upsert — conflict on (cart_id, product_id) updates quantity
  const { error: upsertErr } = await supabase
    .from('cart_items')
    .upsert(upserts, { onConflict: 'cart_id,product_id' });

  if (upsertErr) throw upsertErr;

  // 5. Only clear local cart after DB write succeeds
  clearLocalCart();
}
