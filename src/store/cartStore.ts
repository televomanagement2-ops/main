import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItemLocal, Product } from '../types';

interface CartState {
  items: CartItemLocal[];
  addItem: (product: Product, quantity?: number, selectedSize?: string | null) => void;
  removeItem: (productId: string, selectedSize?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string | null) => void;
  clearCart: () => void;
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
          const existing = state.items.find(
            (i) => i.product.id === product.id && (i.selectedSize ?? null) === (selectedSize ?? null)
          );
          if (existing) {
            const newQty = Math.min(
              existing.quantity + quantity,
              product.stock_quantity
            );
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
                quantity: Math.min(quantity, product.stock_quantity),
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
        if (quantity <= 0) {
          get().removeItem(productId, selectedSize);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            itemKey(i.product.id, i.selectedSize) === itemKey(productId, selectedSize)
              ? { ...i, quantity: Math.min(quantity, i.product.stock_quantity) }
              : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
