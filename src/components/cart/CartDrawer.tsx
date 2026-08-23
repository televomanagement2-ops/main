import { Link } from 'react-router-dom';
import { Drawer } from '../ui/Drawer';
import { Media } from '../ui/Media';
import { IconMinus, IconPlus } from '../ui/icons';
import { useCartStore } from '../../store/cartStore';
import { useUiStore } from '../../store/uiStore';
import { useI18n } from '../../lib/i18n';
import { availableStock } from '../../lib/stock';

/**
 * The bag as a sheet: an extension of the storefront, not a separate screen.
 * Quantities and removal happen in place; the full cart page stays available
 * for anyone who wants the wider view.
 */
export function CartDrawer() {
  const { t, tCount, formatCurrency } = useI18n();
  const surface = useUiStore((s) => s.surface);
  const close = useUiStore((s) => s.close);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <Drawer
      open={surface === 'cart'}
      onClose={close}
      eyebrow={t('cart.title')}
      title={tCount('orders.items', count)}
      closeLabel={t('common.close')}
      footer={
        items.length > 0 ? (
          <div className="stack gap-4">
            <div className="summary__row summary__row--total" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
              <span>{t('cart.subtotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <p className="t-xs t-faint">{t('cart.taxesNote')}</p>
            <Link to="/checkout" className="btn btn--primary btn--block" onClick={close}>
              {t('cart.proceedCheckout')}
            </Link>
            <Link to="/cart" className="btn btn--quiet" onClick={close} style={{ alignSelf: 'center' }}>
              {t('cart.viewCart')}
            </Link>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t('cart.emptyTitle')}</p>
          <p className="empty__body">{t('cart.emptySubtitle')}</p>
          <Link to="/products" className="btn btn--primary" onClick={close}>
            {t('cart.browseProducts')}
          </Link>
        </div>
      ) : (
        <div>
          {items.map((item) => {
            const image =
              item.product.product_images?.find((i) => i.is_primary)?.url ??
              item.product.product_images?.[0]?.url ??
              null;
            // Cap by the selected size's stock, not the product total.
            const max = availableStock(item.product, item.selectedSize);
            return (
              <div key={`${item.product.id}-${item.selectedSize ?? ''}`} className="drawer-line">
                <Link
                  to={`/products/${item.product.slug}`}
                  className="drawer-line__media"
                  onClick={close}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <Media src={image} alt="" ratio="portrait" />
                </Link>

                <div style={{ minWidth: 0 }}>
                  <Link to={`/products/${item.product.slug}`} className="line-item__name" onClick={close}>
                    {item.product.name}
                  </Link>
                  {item.selectedSize && (
                    <p className="line-item__meta">
                      {t('cart.size')}: {item.selectedSize}
                    </p>
                  )}
                  <div className="row gap-4" style={{ marginTop: 'var(--s-3)' }}>
                    <div className="stepper stepper--sm" aria-label={t('cart.quantity')}>
                      <button
                        type="button"
                        className="stepper__btn"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize)}
                        aria-label={t('cart.decrease')}
                      >
                        <IconMinus size={13} />
                      </button>
                      <span className="stepper__value">{item.quantity}</span>
                      <button
                        type="button"
                        className="stepper__btn"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize)}
                        disabled={item.quantity >= max}
                        aria-label={t('cart.increase')}
                      >
                        <IconPlus size={13} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="line-item__remove"
                      onClick={() => removeItem(item.product.id, item.selectedSize)}
                    >
                      {t('cart.removeShort')}
                    </button>
                  </div>
                </div>

                <p className="line-item__price">{formatCurrency(item.product.price * item.quantity)}</p>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
