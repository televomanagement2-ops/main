import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItemLocal, Product } from '../types';
import { availableStock, lineVariant, variantChoiceFits, variantFitsShape } from '../lib/stock';
import { cartSubtotal, unitPrice } from '../lib/pricing';
import { colorName } from '../lib/variants';

/**
 * The identity of a cart line: the product and the variant it is for. A line
 * saved before variant ids existed is identified by the size it recorded
 * until the next catalogue sync gives it its variant id.
 */
export function cartLineKey(item: Pick<CartItemLocal, 'product' | 'variantId' | 'selectedSize'>): string {
  if (item.variantId) return `${item.product.id}::${item.variantId}`;
  return item.selectedSize ? `${item.product.id}::size:${item.selectedSize}` : item.product.id;
}

interface CartState {
  items: CartItemLocal[];
  /** `variantId`: the size/colour combination, for a product that has them. */
  addItem: (product: Product, quantity?: number, variantId?: string | null) => void;
  removeItem: (lineKey: string) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  clearCart: () => void;
  /**
   * Reconcile the persisted cart with fresh catalog rows: adopt current
   * price/stock/images, drop items whose product or variant is gone, and
   * clamp quantities to current stock. Returns true when anything changed
   * in a way the shopper should be told about (price change or removal).
   */
  syncWithCatalog: (products: Product[]) => boolean;
  itemCount: () => number;
  subtotal: () => number;
}

/** The labels a line shows, from its variant. */
function labelsFor(product: Product, variantId: string | null) {
  const variant = variantId ? product.product_variants?.find((v) => v.id === variantId) : null;
  return {
    selectedSize: variant?.size ?? null,
    selectedColor: colorName(product, variant?.color_id),
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, variantId = null) => {
        set((state) => {
          // A product with options but no option chosen (or an option on a
          // product without any) would only be refused at checkout, after the
          // shopper filled everything in.
          if (!variantChoiceFits(product, variantId)) return state;

          // The cap is the chosen VARIANT's stock when there is one, and it is
          // clamped at 0 — an oversold product reports negative stock, which
          // used to put a negative quantity straight into the cart.
          const max = availableStock(product, variantId);
          if (max === 0) return state; // sold out: nothing to add

          const line: CartItemLocal = {
            product,
            quantity: Math.min(Math.max(1, quantity), max),
            variantId: variantId ?? null,
            ...labelsFor(product, variantId ?? null),
          };
          const key = cartLineKey(line);
          const existing = state.items.find((i) => cartLineKey(i) === key);
          if (existing) {
            const newQty = Math.min(existing.quantity + quantity, max);
            return {
              items: state.items.map((i) => (cartLineKey(i) === key ? { ...i, product, quantity: newQty } : i)),
            };
          }
          return { items: [...state.items, line] };
        });
      },

      removeItem: (lineKey) => {
        set((state) => ({ items: state.items.filter((i) => cartLineKey(i) !== lineKey) }));
      },

      updateQuantity: (lineKey, quantity) => {
        const target = get().items.find((i) => cartLineKey(i) === lineKey);
        // Clamping can land on 0 (the variant sold out while the cart sat
        // open); a 0-quantity line would render as "× 0", so drop it instead.
        const clamped = target
          ? Math.min(quantity, availableStock(target.product, target.variantId, target.selectedSize))
          : quantity;
        if (clamped <= 0) {
          get().removeItem(lineKey);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (cartLineKey(i) === lineKey ? { ...i, quantity: clamped } : i)),
        }));
      },

      clearCart: () => set({ items: [] }),

      syncWithCatalog: (products) => {
        const freshById = new Map(products.map((p) => [p.id, p]));
        let changed = false;

        const next = new Map<string, CartItemLocal>();
        for (const item of get().items) {
          const fresh = freshById.get(item.product.id);

          // Product deleted or deactivated since it was added → drop the line.
          if (!fresh || fresh.is_active === false) {
            changed = true;
            continue;
          }

          // A line saved before variant ids existed: find its variant by the
          // size it recorded (only a size without a colour can be meant).
          let variantId = item.variantId ?? null;
          if (!variantId && item.selectedSize) {
            const legacy = lineVariant(fresh, null, item.selectedSize);
            if (legacy) variantId = legacy.id;
          }

          // The product started or stopped having options since the line was
          // added: checkout would refuse it either way.
          if (!variantChoiceFits(fresh, variantId, variantId ? null : item.selectedSize)) {
            changed = true;
            continue;
          }
          const variant = variantId ? fresh.product_variants?.find((v) => v.id === variantId) : null;
          if (variantId && fresh.product_variants && (!variant || !variant.is_active || !variantFitsShape(fresh, variant))) {
            changed = true;
            continue;
          }

          if (unitPrice(fresh, variantId) !== unitPrice(item.product, item.variantId, item.selectedSize)) {
            changed = true;
          }

          // Against the chosen VARIANT's stock — a product with 300 units but
          // 2 left in XL must clamp an XL line to 2, not 300.
          const max = availableStock(fresh, variantId, variantId ? null : item.selectedSize);
          const line: CartItemLocal = {
            product: fresh,
            quantity: item.quantity,
            variantId,
            ...(variantId ? labelsFor(fresh, variantId) : { selectedSize: item.selectedSize ?? null, selectedColor: null }),
          };
          const key = cartLineKey(line);
          // Two lines that turn out to be the same variant become one.
          const merged = next.get(key);
          if (merged) {
            changed = true;
            line.quantity += merged.quantity;
          }
          const quantity = Math.min(line.quantity, max);
          if (quantity === 0) {
            changed = true;
            next.delete(key);
            continue;
          }
          if (quantity !== line.quantity) changed = true;
          next.set(key, { ...line, quantity });
        }

        set({ items: [...next.values()] });
        return changed;
      },

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () => cartSubtotal(get().items),
    }),
    {
      name: 'aurum-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
