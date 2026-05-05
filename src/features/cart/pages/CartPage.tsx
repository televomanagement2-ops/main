import { Link } from 'react-router-dom';
import { useCartStore } from '../../../store/cartStore';
import { CartItemRow } from '../components/CartItemRow';
import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';

const TAX_RATE = 0.1;

export function CartPage() {
  const items     = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal  = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const { t, tCount, formatCurrency } = useI18n();

  if (items.length === 0) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
        <div className="cart-empty-state">
          <svg className="cart-empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <p className="cart-empty-state__title">{t('cart.emptyTitle')}</p>
          <p className="cart-empty-state__sub">{t('cart.emptySubtitle')}</p>
          <Link to="/products" className="btn btn-primary btn-lg" style={{ marginTop: 'var(--sp-2)' }}>
            {t('cart.browseProducts')}
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
        <h1 className="heading-1" style={{ marginBottom: 0 }}>{t('cart.title')}</h1>
        <button
          onClick={clearCart}
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--color-text-3)' }}
        >
          {t('cart.clearAll')}
        </button>
      </div>

      <div className="cart-layout">
        <div className="cart-items-list">
          {items.map((item) => (
            <CartItemRow key={item.product.id} item={item} />
          ))}
        </div>

        <aside className="order-summary" aria-label={t('cart.orderSummary')}>
          <h2 className="order-summary__title">{t('cart.orderSummary')}</h2>

          <div className="summary-line">
            <span>{t('cart.subtotal')} ({tCount('orders.items', items.reduce((n, i) => n + i.quantity, 0))})</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="summary-line">
            <span>{t('cart.shipping')}</span>
            <span className="summary-line--free">{t('common.free')}</span>
          </div>
          <div className="summary-line">
            <span>{t('cart.tax')}</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="summary-line summary-line--total">
            <span>{t('cart.total')}</span>
            <span>{formatCurrency(total)}</span>
          </div>

          <Link
            to="/checkout"
            className="btn btn-primary btn-lg btn-full"
            style={{ marginTop: 'var(--sp-5)' }}
          >
            {t('cart.proceedCheckout')}
          </Link>
          <Link
            to="/products"
            className="btn btn-ghost btn-sm btn-full"
            style={{ marginTop: 'var(--sp-2)' }}
          >
            {t('cart.continueShopping')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
