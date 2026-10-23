import { beforeEach, describe, expect, it } from 'vitest';
import { cartLineKey, useCartStore } from './cartStore';
import type { CartItemLocal, Product, ProductVariant } from '../types';

function makeVariant(size: string | null, stock_qty: number, over: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: `v-${over.color_id ?? ''}${size ?? ''}`,
    product_id: 'shirt',
    size,
    color_id: null,
    price: null,
    sku: null,
    stock_qty,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
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
    has_sizes: false,
    size_label: 'size',
    has_colors: false,
    color_label: 'color',
    price_min: null,
    price_max: null,
    size_guide_id: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const shirtWith = (variants: ProductVariant[], over: Partial<Product> = {}) =>
  makeProduct({ id: 'shirt', has_sizes: true, stock_quantity: 300, product_variants: variants, ...over });

const items = () => useCartStore.getState().items;
const key = (productId: string, variantId?: string) =>
  cartLineKey({ product: { id: productId } as Product, variantId: variantId ?? null, selectedSize: null });

beforeEach(() => {
  useCartStore.getState().clearCart();
});

describe('cartStore', () => {
  it('adds items and accumulates quantity for the same product', () => {
    const product = makeProduct();
    useCartStore.getState().addItem(product, 1);
    useCartStore.getState().addItem(product, 2);

    expect(items()).toHaveLength(1);
    expect(items()[0].quantity).toBe(3);
  });

  it('treats different variants of the same product as separate lines, with their labels', () => {
    const shirt = shirtWith([makeVariant('M', 9), makeVariant('L', 9)]);
    useCartStore.getState().addItem(shirt, 1, 'v-M');
    useCartStore.getState().addItem(shirt, 1, 'v-L');
    useCartStore.getState().addItem(shirt, 1, 'v-M');

    expect(items()).toHaveLength(2);
    expect(items().find((i) => i.selectedSize === 'M')?.quantity).toBe(2);
    expect(items().find((i) => i.selectedSize === 'L')?.quantity).toBe(1);
  });

  it('labels a colour × size line and prices it at the variant price', () => {
    const tee = shirtWith(
      [makeVariant('M', 5, { color_id: 'red', price: 14 }), makeVariant('M', 5, { color_id: 'blue' })],
      {
        has_colors: true,
        product_colors: [
          { id: 'red', product_id: 'shirt', name: 'Red', swatch: null, sort_order: 0, is_active: true, created_at: '', updated_at: '' },
          { id: 'blue', product_id: 'shirt', name: 'Blue', swatch: null, sort_order: 1, is_active: true, created_at: '', updated_at: '' },
        ],
      },
    );
    useCartStore.getState().addItem(tee, 2, 'v-redM');
    useCartStore.getState().addItem(tee, 1, 'v-blueM');

    expect(items().find((i) => i.variantId === 'v-redM')).toMatchObject({ selectedColor: 'Red', selectedSize: 'M' });
    expect(useCartStore.getState().subtotal()).toBe(2 * 14 + 10);
  });

  it('clamps quantity to available stock', () => {
    const product = makeProduct({ stock_quantity: 3 });
    useCartStore.getState().addItem(product, 10);
    expect(items()[0].quantity).toBe(3);

    useCartStore.getState().updateQuantity(key(product.id), 99);
    expect(items()[0].quantity).toBe(3);
  });

  it('updates and removes only the matching variant line', () => {
    const shirt = shirtWith([makeVariant('M', 9), makeVariant('L', 9)]);
    useCartStore.getState().addItem(shirt, 1, 'v-M');
    useCartStore.getState().addItem(shirt, 1, 'v-L');

    useCartStore.getState().updateQuantity(key('shirt', 'v-L'), 4);
    expect(items().find((i) => i.selectedSize === 'L')?.quantity).toBe(4);
    expect(items().find((i) => i.selectedSize === 'M')?.quantity).toBe(1);

    useCartStore.getState().removeItem(key('shirt', 'v-M'));
    expect(items()).toHaveLength(1);
    expect(items()[0].selectedSize).toBe('L');
  });

  it('removes the line when quantity drops to zero', () => {
    const product = makeProduct();
    useCartStore.getState().addItem(product, 2);
    useCartStore.getState().updateQuantity(key(product.id), 0);
    expect(items()).toHaveLength(0);
  });

  it('computes itemCount and subtotal across variants', () => {
    const a = shirtWith([makeVariant('M', 9), makeVariant('L', 9, { price: 12 })], { id: 'a', price: 10 });
    const b = makeProduct({ id: 'b', price: 5.5 });
    useCartStore.getState().addItem(a, 2, 'v-M');
    useCartStore.getState().addItem(a, 1, 'v-L');
    useCartStore.getState().addItem(b, 3);

    expect(useCartStore.getState().itemCount()).toBe(6);
    expect(useCartStore.getState().subtotal()).toBeCloseTo(2 * 10 + 12 + 3 * 5.5);
  });

  describe('syncWithCatalog', () => {
    it('adopts fresh price and reports the change', () => {
      useCartStore.getState().addItem(makeProduct({ price: 10 }), 1);

      const changed = useCartStore.getState().syncWithCatalog([makeProduct({ price: 12.5 })]);

      expect(changed).toBe(true);
      expect(items()[0].product.price).toBe(12.5);
    });

    it('reports a change of a variant price', () => {
      useCartStore.getState().addItem(shirtWith([makeVariant('M', 9, { price: 20 })]), 1, 'v-M');
      const changed = useCartStore.getState().syncWithCatalog([shirtWith([makeVariant('M', 9, { price: 22 })])]);
      expect(changed).toBe(true);
      expect(useCartStore.getState().subtotal()).toBe(22);
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
      expect(items().map((i) => i.product.id)).toEqual(['ok']);
    });

    it('clamps quantities to fresh stock and drops sold-out lines', () => {
      useCartStore.getState().addItem(makeProduct({ id: 'low', stock_quantity: 10 }), 8);
      useCartStore.getState().addItem(makeProduct({ id: 'out', stock_quantity: 10 }), 2);

      useCartStore.getState().syncWithCatalog([
        makeProduct({ id: 'low', stock_quantity: 3 }),
        makeProduct({ id: 'out', stock_quantity: 0 }),
      ]);

      expect(items()).toHaveLength(1);
      expect(items()[0].product.id).toBe('low');
      expect(items()[0].quantity).toBe(3);
    });

    it('reports no change when nothing relevant changed', () => {
      useCartStore.getState().addItem(makeProduct(), 2);
      const changed = useCartStore.getState().syncWithCatalog([makeProduct()]);
      expect(changed).toBe(false);
      expect(items()[0].quantity).toBe(2);
    });

    it('clamps a variant line against the VARIANT stock, not the product total', () => {
      useCartStore.getState().addItem(shirtWith([makeVariant('M', 50), makeVariant('XL', 2)]), 2, 'v-XL');

      // Product total is untouched but XL dropped to 1.
      const changed = useCartStore.getState().syncWithCatalog([shirtWith([makeVariant('M', 50), makeVariant('XL', 1)])]);

      expect(changed).toBe(true);
      expect(items()[0].quantity).toBe(1);
    });

    it('drops a line whose variant sold out even though the product has stock', () => {
      useCartStore.getState().addItem(shirtWith([makeVariant('XL', 5)]), 2, 'v-XL');
      useCartStore.getState().syncWithCatalog([shirtWith([makeVariant('XL', 0)])]);
      expect(items()).toHaveLength(0);
    });

    it('drops a line when the product is oversold (negative stock)', () => {
      useCartStore.getState().addItem(makeProduct({ id: 'over', stock_quantity: 10 }), 2);
      useCartStore.getState().syncWithCatalog([makeProduct({ id: 'over', stock_quantity: -5 })]);
      expect(items()).toHaveLength(0);
    });

    it('gives a line saved before variant ids its variant, and merges it with an id line', () => {
      const shirt = shirtWith([makeVariant('M', 9)]);
      const legacy: CartItemLocal = { product: shirt, quantity: 2, selectedSize: 'M' };
      useCartStore.setState({ items: [legacy, { product: shirt, quantity: 1, variantId: 'v-M', selectedSize: 'M' }] });

      const changed = useCartStore.getState().syncWithCatalog([shirt]);

      expect(changed).toBe(true);
      expect(items()).toEqual([expect.objectContaining({ variantId: 'v-M', quantity: 3, selectedSize: 'M' })]);
    });

    it('drops a variant line once the product changed shape', () => {
      useCartStore.getState().addItem(shirtWith([makeVariant('M', 9)]), 1, 'v-M');
      // The shirt is now sold by colour too: the colourless M is history.
      useCartStore.getState().syncWithCatalog([shirtWith([makeVariant('M', 9)], { has_colors: true })]);
      expect(items()).toHaveLength(0);
    });
  });

  describe('oversold and variant stock (negative stock is legal — migration 013)', () => {
    it('refuses to add an oversold product instead of storing a negative quantity', () => {
      useCartStore.getState().addItem(makeProduct({ stock_quantity: -5 }), 1);
      expect(items()).toHaveLength(0);
    });

    it('refuses to add a sold-out product', () => {
      useCartStore.getState().addItem(makeProduct({ stock_quantity: 0 }), 1);
      expect(items()).toHaveLength(0);
    });

    it('caps a variant add at the variant stock, not the product total', () => {
      useCartStore.getState().addItem(shirtWith([makeVariant('M', 50), makeVariant('XL', 2)]), 50, 'v-XL');
      expect(items()[0].quantity).toBe(2);
    });

    it('refuses a variant that is sold out even when the product has stock', () => {
      useCartStore.getState().addItem(shirtWith([makeVariant('XL', 0)]), 1, 'v-XL');
      expect(items()).toHaveLength(0);
    });

    it('falls back to product stock when variants were not loaded', () => {
      // Listing queries omit product_variants; a cart line must not silently
      // become unpurchasable because the data simply is not there.
      const shirt = makeProduct({ id: 'shirt', has_sizes: true, stock_quantity: 4 });
      useCartStore.getState().addItem(shirt, 10, 'v-XL');
      expect(items()[0].quantity).toBe(4);
    });

    it('removes the line when updateQuantity clamps to zero', () => {
      useCartStore.getState().addItem(shirtWith([makeVariant('XL', 3)]), 2, 'v-XL');
      // The variant sold out while the cart sat open.
      useCartStore.setState({
        items: items().map((i) => ({ ...i, product: { ...i.product, product_variants: [makeVariant('XL', 0)] } })),
      });

      useCartStore.getState().updateQuantity(key('shirt', 'v-XL'), 1);
      expect(items()).toHaveLength(0);
    });
  });

  describe('option choice (has_sizes / has_colors — migrations 021/022)', () => {
    it('refuses a product with options without one, and an option on a product without', () => {
      useCartStore.getState().addItem(makeProduct({ id: 'shirt', has_sizes: true }), 1);
      useCartStore.getState().addItem(makeProduct({ id: 'lamp', has_colors: true }), 1);
      useCartStore.getState().addItem(makeProduct({ id: 'mug' }), 1, 'v-M');
      expect(items()).toHaveLength(0);
    });

    it('drops lines whose product started or stopped having options', () => {
      useCartStore.getState().addItem(makeProduct({ id: 'became-sized' }), 1);
      useCartStore.getState().addItem(
        makeProduct({ id: 'lost-sizes', has_sizes: true, product_variants: [makeVariant('M', 5)] }),
        1,
        'v-M',
      );
      useCartStore.getState().addItem(makeProduct({ id: 'unchanged' }), 1);

      const changed = useCartStore.getState().syncWithCatalog([
        makeProduct({ id: 'became-sized', has_sizes: true, product_variants: [makeVariant('M', 5)] }),
        makeProduct({ id: 'lost-sizes', has_sizes: false, product_variants: [] }),
        makeProduct({ id: 'unchanged' }),
      ]);

      expect(changed).toBe(true);
      expect(items().map((i) => i.product.id)).toEqual(['unchanged']);
    });

    it('drops a line when the loaded list no longer offers that variant', () => {
      useCartStore.getState().addItem(shirtWith([makeVariant('XL', 5)]), 1, 'v-XL');
      // Every variant switched off: the embed loads, and loads empty.
      useCartStore.getState().syncWithCatalog([shirtWith([], { stock_quantity: 0 })]);
      expect(items()).toHaveLength(0);
    });

    it('leaves lines alone while has_sizes is unknown (rows cached before 021)', () => {
      const legacy = { ...makeProduct({ id: 'legacy' }), has_sizes: undefined } as unknown as Product;
      useCartStore.setState({ items: [{ product: legacy, quantity: 1, selectedSize: 'M' }] });

      const changed = useCartStore.getState().syncWithCatalog([legacy]);

      expect(changed).toBe(false);
      expect(items()).toHaveLength(1);
    });
  });
});
