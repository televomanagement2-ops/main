import { Link } from 'react-router-dom';
import { useCartStore } from '../../../store/cartStore';
import { useCartSync } from '../../../hooks/useCartSync';
import { CartItemRow } from '../components/CartItemRow';
import { IconArrowRight, IconInfo } from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import { computeOrderTotals } from '../../../lib/pricing';

export function CartPage() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const cartSync = useCartSync();
  const { t, tCount, formatCurrency } = useI18n();

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const { tax, total } = computeOrderTotals(subtotal, 0);

  if (items.length === 0) {
    return (
      <div className="page">
        <header className="account-head">
          <div className="account-head__title">
            <p className="t-label">{t('cart.label')}</p>
            <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{t('cart.title')}</h1>
          </div>
        </header>
        <div className="empty">
          <p className="empty__title">{t('cart.emptyTitle')}</p>
          <p className="empty__body">{t('cart.emptySubtitle')}</p>
          <Link to="/products" className="btn btn--primary">
            {t('cart.browseProducts')}
            <IconArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="account-head">
        <div className="account-head__title">
          <p className="t-label">{t('cart.label')}</p>
          <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{t('cart.title')}</h1>
        </div>
        <div className="account-head__actions">
          <button type="button" onClick={clearCart} className="btn btn--quiet">
            {t('cart.clearAll')}
          </button>
        </div>
      </header>

      {cartSync.changed && (
        <div className="notice notice--caution" style={{ marginBottom: 'var(--s-6)' }}>
          <IconInfo size={16} />
          <div className="notice__body">{t('cart.pricesUpdated')}</div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={cartSync.dismiss}>
            {t('cart.dismiss')}
          </button>
        </div>
      )}

      <div className="cart-layout">
        <div className="cart-layout__items">
          {items.map((item) => (
            <CartItemRow key={`${item.product.id}-${item.selectedSize ?? ''}`} item={item} />
          ))}
        </div>

        <aside className="cart-layout__summary" aria-label={t('cart.orderSummary')}>
          <p className="t-label" style={{ marginBottom: 'var(--s-5)' }}>{t('cart.orderSummary')}</p>

          <div className="summary">
            <div className="summary__row">
              <span>
                {t('cart.subtotal')} · {tCount('orders.items', count)}
              </span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="summary__row">
              <span>{t('cart.shipping')}</span>
              <span>{t('cart.calculatedAtCheckout')}</span>
            </div>
            {tax > 0 && (
              <div className="summary__row">
                <span>{t('cart.tax')}</span>
                <span>{formatCurrency(tax)}</span>
              </div>
            )}
            <div className="summary__row summary__row--total">
              <span>{t('cart.total')}</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <Link to="/checkout" className="btn btn--primary btn--block" style={{ marginTop: 'var(--s-6)' }}>
            {t('cart.proceedCheckout')}
          </Link>
          <Link
            to="/products"
            className="btn btn--quiet"
            style={{ marginTop: 'var(--s-4)', display: 'flex', justifyContent: 'center' }}
          >
            {t('cart.continueShopping')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
