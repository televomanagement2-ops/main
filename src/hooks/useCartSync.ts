import { useEffect, useState } from 'react';
import { fetchProductsByIds } from '../lib/api';
import { useCartStore } from '../store/cartStore';

/**
 * On mount, re-fetch the cart's products and reconcile the persisted cart
 * with the live catalog (price changes, deactivated products, stock clamps).
 * Returns whether something changed, so the page can show a notice.
 */
export function useCartSync() {
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const ids = [...new Set(useCartStore.getState().items.map((i) => i.product.id))];
    if (ids.length === 0) return;

    let cancelled = false;
    fetchProductsByIds(ids)
      .then((products) => {
        if (cancelled) return;
        if (useCartStore.getState().syncWithCatalog(products)) {
          setChanged(true);
        }
      })
      .catch((err) => {
        // Sync is best-effort: the server re-validates prices and stock at
        // checkout anyway, so a failed refresh must not block the page.
        console.error('Cart catalog sync failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { changed, dismiss: () => setChanged(false) };
}
