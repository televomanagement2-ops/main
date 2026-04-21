import { Link } from 'react-router-dom';
import { useCartStore } from '../../../store/cartStore';
import { CartItemRow } from '../components/CartItemRow';
import { BackButton } from '../../../components/ui/BackButton';

const TAX_RATE = 0.1;

export function CartPage() {
  const items     = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal  = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
        <div className="cart-empty-state">
          <svg className="cart-empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <p className="cart-empty-state__title">Your cart is empty</p>
          <p className="cart-empty-state__sub">Add some products and they'll appear here.</p>
          <Link to="/products" className="btn btn-primary btn-lg" style={{ marginTop: 'var(--sp-2)' }}>
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const shipping = 0;
  const tax      = subtotal * TAX_RATE;
  const total    = subtotal + shipping + tax;

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <BackButton />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-8)' }}>
        <h1 className="heading-1" style={{ marginBottom: 0 }}>Your Cart</h1>
        <button
          onClick={clearCart}
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--color-text-3)' }}
        >
          Clear all
        </button>
      </div>

      <div className="cart-layout">
        <div className="cart-items-list">
          {items.map((item) => (
            <CartItemRow key={item.product.id} item={item} />
          ))}
        </div>

        <aside className="order-summary" aria-label="Order summary">
          <h2 className="order-summary__title">Order summary</h2>

          <div className="summary-line">
            <span>Subtotal ({items.reduce((n, i) => n + i.quantity, 0)} items)</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-line">
            <span>Shipping</span>
            <span className="summary-line--free">Free</span>
          </div>
          <div className="summary-line">
            <span>Tax (10%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="summary-line summary-line--total">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <Link
            to="/checkout"
            className="btn btn-primary btn-lg btn-full"
            style={{ marginTop: 'var(--sp-5)' }}
          >
            Proceed to checkout
          </Link>
          <Link
            to="/products"
            className="btn btn-ghost btn-sm btn-full"
            style={{ marginTop: 'var(--sp-2)' }}
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
