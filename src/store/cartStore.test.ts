import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore } from './cartStore';
import type { Product, ProductVariant } from '../types';

function makeVariant(size: string, stock_qty: number): ProductVariant {
  return {
    id: `v-${size}`,
    product_id: 'shirt',
    size,
    sku: null,
    stock_qty,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    category_id: 'c1',
    name: 'Test product',
    slug: 'test-product',
    description: null,
    price: 10,
    compare_at_price: null,
    cost_price: null,
    sku: null,
    stock_quantity: 5,
    low_stock_threshold: 2,
    weight_grams: null,
    is_active: true,
    is_featured: false,
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  useCartStore.getState().clearCart();
});

describe('cartStore', () => {
  it('adds items and accumulates quantity for the same product', () => {
    const product = makeProduct();
    useCartStore.getState().addItem(product, 1);
    useCartStore.getState().addItem(product, 2);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it('treats different sizes of the same product as separate lines', () => {
    const shirt = makeProduct({ id: 'shirt' });
    useCartStore.getState().addItem(shirt, 1, 'M');
    useCartStore.getState().addItem(shirt, 1, 'L');
    useCartStore.getState().addItem(shirt, 1, 'M');

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.selectedSize === 'M')?.quantity).toBe(2);
    expect(items.find((i) => i.selectedSize === 'L')?.quantity).toBe(1);
  });

  it('clamps quantity to available stock', () => {
    const product = makeProduct({ stock_quantity: 3 });
    useCartStore.getState().addItem(product, 10);
    expect(useCartStore.getState().items[0].quantity).toBe(3);

    useCartStore.getState().updateQuantity(product.id, 99);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });

  it('updates and removes only the matching size line', () => {
    const shirt = makeProduct({ id: 'shirt' });
    useCartStore.getState().addItem(shirt, 1, 'M');
    useCartStore.getState().addItem(shirt, 1, 'L');

    useCartStore.getState().updateQuantity('shirt', 4, 'L');
    expect(useCartStore.getState().items.find((i) => i.selectedSize === 'L')?.quantity).toBe(4);
    expect(useCartStore.getState().items.find((i) => i.selectedSize === 'M')?.quantity).toBe(1);

    useCartStore.getState().removeItem('shirt', 'M');
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].selectedSize).toBe('L');
  });

  it('removes the line when quantity drops to zero', () => {
    const product = makeProduct();
    useCartStore.getState().addItem(product, 2);
    useCartStore.getState().updateQuantity(product.id, 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('computes itemCount and subtotal across sizes', () => {
    const a = makeProduct({ id: 'a', price: 10 });
    const b = makeProduct({ id: 'b', price: 5.5 });
    useCartStore.getState().addItem(a, 2, 'M');
    useCartStore.getState().addItem(a, 1, 'L');
    useCartStore.getState().addItem(b, 3);

    expect(useCartStore.getState().itemCount()).toBe(6);
    expect(useCartStore.getState().subtotal()).toBeCloseTo(2 * 10 + 1 * 10 + 3 * 5.5);
  });

  describe('syncWithCatalog', () => {
    it('adopts fresh price and reports the change', () => {
      const product = makeProduct({ price: 10 });
      useCartStore.getState().addItem(product, 1);

      const changed = useCartStore.getState().syncWithCatalog([
        makeProduct({ price: 12.5 }),
      ]);

      expect(changed).toBe(true);
      expect(useCartStore.getState().items[0].product.price).toBe(12.5);
    });

    it('drops items whose product disappeared or was deactivated', () => {
      useCartStore.getState().addItem(makeProduct({ id: 'gone' }), 1);
      useCartStore.getState().addItem(makeProduct({ id: 'inactive' }), 1);
      useCartStore.getState().addItem(makeProduct({ id: 'ok' }), 1);

      const changed = useCartStore.getState().syncWithCatalog([
        makeProduct({ id: 'inactive', is_active: false }),
        makeProduct({ id: 'ok' }),
      ]);

      expect(changed).toBe(true);
      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].product.id).toBe('ok');
    });

    it('clamps quantities to fresh stock and drops sold-out lines', () => {
      useCartStore.getState().addItem(makeProduct({ id: 'low', stock_quantity: 10 }), 8);
      useCartStore.getState().addItem(makeProduct({ id: 'out', stock_quantity: 10 }), 2);

      useCartStore.getState().syncWithCatalog([
        makeProduct({ id: 'low', stock_quantity: 3 }),
        makeProduct({ id: 'out', stock_quantity: 0 }),
      ]);

      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].product.id).toBe('low');
      expect(items[0].quantity).toBe(3);
    });

    it('reports no change when nothing relevant changed', () => {
      const product = makeProduct();
      useCartStore.getState().addItem(product, 2);

      const changed = useCartStore.getState().syncWithCatalog([makeProduct()]);

      expect(changed).toBe(false);
      expect(useCartStore.getState().items[0].quantity).toBe(2);
    });

    it('clamps a sized line against the VARIANT stock, not the product total', () => {
      const shirt = makeProduct({
        id: 'shirt',
        stock_quantity: 300,
        product_variants: [makeVariant('M', 50), makeVariant('XL', 2)],
      });
      useCartStore.getState().addItem(shirt, 2, 'XL');

      // Product total is untouched but XL dropped to 1.
      const changed = useCartStore.getState().syncWithCatalog([
        makeProduct({
          id: 'shirt',
          stock_quantity: 300,
          product_variants: [makeVariant('M', 50), makeVariant('XL', 1)],
        }),
      ]);

      expect(changed).toBe(true);
      expect(useCartStore.getState().items[0].quantity).toBe(1);
    });

    it('drops a line whose size sold out even though the product has stock', () => {
      const shirt = makeProduct({
        id: 'shirt',
        stock_quantity: 300,
        product_variants: [makeVariant('XL', 5)],
      });
      useCartStore.getState().addItem(shirt, 2, 'XL');

      useCartStore.getState().syncWithCatalog([
        makeProduct({
          id: 'shirt',
          stock_quantity: 300,
          product_variants: [makeVariant('XL', 0)],
        }),
      ]);

      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('drops a line when the product is oversold (negative stock)', () => {
      useCartStore.getState().addItem(makeProduct({ id: 'over', stock_quantity: 10 }), 2);

      useCartStore.getState().syncWithCatalog([makeProduct({ id: 'over', stock_quantity: -5 })]);

      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('oversold and variant stock (negative stock is legal — migration 013)', () => {
    it('refuses to add an oversold product instead of storing a negative quantity', () => {
      useCartStore.getState().addItem(makeProduct({ stock_quantity: -5 }), 1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('refuses to add a sold-out product', () => {
      useCartStore.getState().addItem(makeProduct({ stock_quantity: 0 }), 1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('caps a sized add at the variant stock, not the product total', () => {
      const shirt = makeProduct({
        id: 'shirt',
        stock_quantity: 300,
        product_variants: [makeVariant('M', 50), makeVariant('XL', 2)],
      });
      useCartStore.getState().addItem(shirt, 50, 'XL');
      expect(useCartStore.getState().items[0].quantity).toBe(2);
    });

    it('refuses a size that is sold out even when the product has stock', () => {
      const shirt = makeProduct({
        id: 'shirt',
        stock_quantity: 300,
        product_variants: [makeVariant('XL', 0)],
      });
      useCartStore.getState().addItem(shirt, 1, 'XL');
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('falls back to product stock when variants were not loaded', () => {
      // fetchProductsByIds used to omit product_variants; a cart line must not
      // silently become unpurchasable because the data simply is not there.
      const shirt = makeProduct({ id: 'shirt', stock_quantity: 4 });
      useCartStore.getState().addItem(shirt, 10, 'XL');
      expect(useCartStore.getState().items[0].quantity).toBe(4);
    });

    it('removes the line when updateQuantity clamps to zero', () => {
      const shirt = makeProduct({
        id: 'shirt',
        stock_quantity: 300,
        product_variants: [makeVariant('XL', 3)],
      });
      useCartStore.getState().addItem(shirt, 2, 'XL');
      // The size sold out while the cart sat open.
      useCartStore.setState({
        items: useCartStore.getState().items.map((i) => ({
          ...i,
          product: { ...i.product, product_variants: [makeVariant('XL', 0)] },
        })),
      });

      useCartStore.getState().updateQuantity('shirt', 1, 'XL');
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });
});
