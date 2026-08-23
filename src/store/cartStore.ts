import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItemLocal, Product } from '../types';
import { availableStock } from '../lib/stock';

interface CartState {
  items: CartItemLocal[];
  addItem: (product: Product, quantity?: number, selectedSize?: string | null) => void;
  removeItem: (productId: string, selectedSize?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string | null) => void;
  clearCart: () => void;
  /**
   * Reconcile the persisted cart with fresh catalog rows: adopt current
   * price/stock/images, drop items whose product is gone or inactive, and
   * clamp quantities to current stock. Returns true when anything changed
   * in a way the shopper should be told about (price change or removal).
   */
  syncWithCatalog: (products: Product[]) => boolean;
  itemCount: () => number;
  subtotal: () => number;
}

function itemKey(productId: string, selectedSize?: string | null) {
  return selectedSize ? `${productId}::${selectedSize}` : productId;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, selectedSize = null) => {
        set((state) => {
          // The cap is the SELECTED SIZE's stock when there is one, and it is
          // clamped at 0 — an oversold product reports negative stock, which
          // used to put a negative quantity straight into the cart.
          const max = availableStock(product, selectedSize);
          if (max === 0) return state; // sold out: nothing to add

          const existing = state.items.find(
            (i) => i.product.id === product.id && (i.selectedSize ?? null) === (selectedSize ?? null)
          );
          if (existing) {
            const newQty = Math.min(existing.quantity + quantity, max);
            return {
              items: state.items.map((i) =>
                itemKey(i.product.id, i.selectedSize) === itemKey(product.id, selectedSize)
                  ? { ...i, quantity: newQty }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                product,
                quantity: Math.min(Math.max(1, quantity), max),
                selectedSize: selectedSize ?? null,
              },
            ],
          };
        });
      },

      removeItem: (productId, selectedSize = null) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.product.id === productId && (i.selectedSize ?? null) === (selectedSize ?? null))
          ),
        }));
      },

      updateQuantity: (productId, quantity, selectedSize = null) => {
        const key = itemKey(productId, selectedSize);
        const target = get().items.find((i) => itemKey(i.product.id, i.selectedSize) === key);
        // Clamping can land on 0 (the size sold out while the cart sat open);
        // a 0-quantity line would render as "× 0", so drop it instead.
        const clamped = target
          ? Math.min(quantity, availableStock(target.product, target.selectedSize))
          : quantity;
        if (clamped <= 0) {
          get().removeItem(productId, selectedSize);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            itemKey(i.product.id, i.selectedSize) === key ? { ...i, quantity: clamped } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      syncWithCatalog: (products) => {
        const freshById = new Map(products.map((p) => [p.id, p]));
        let changed = false;

        const nextItems: CartItemLocal[] = [];
        for (const item of get().items) {
          const fresh = freshById.get(item.product.id);

          // Product deleted or deactivated since it was added → drop the line.
          if (!fresh || fresh.is_active === false) {
            changed = true;
            continue;
          }

          if (fresh.price !== item.product.price) changed = true;

          // Against the SELECTED SIZE's stock — a product with 300 units but 2
          // left in XL must clamp an XL line to 2, not 300.
          const quantity = Math.min(item.quantity, availableStock(fresh, item.selectedSize));
          if (quantity === 0) {
            changed = true;
            continue;
          }
          if (quantity !== item.quantity) changed = true;

          nextItems.push({ ...item, product: fresh, quantity });
        }

        set({ items: nextItems });
        return changed;
      },

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    }),
    {
      name: 'aurum-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
