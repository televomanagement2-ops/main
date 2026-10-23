import { Link } from 'react-router-dom';
import { Drawer } from '../ui/Drawer';
import { Media } from '../ui/Media';
import { IconMinus, IconPlus } from '../ui/icons';
import { cartLineKey, useCartStore } from '../../store/cartStore';
import { useUiStore } from '../../store/uiStore';
import { useI18n } from '../../lib/i18n';
import { availableStock } from '../../lib/stock';
import { cartSubtotal, lineTotal } from '../../lib/pricing';
import { CartLineOptions } from '../../features/cart/components/CartLineOptions';
import { cartLineImage, cartLineLink } from '../../lib/cartLines';

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

  const subtotal = cartSubtotal(items);
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
            const key = cartLineKey(item);
            const href = cartLineLink(item);
            // Cap by the chosen variant's stock, not the product total.
            const max = availableStock(item.product, item.variantId, item.selectedSize);
            return (
              <div key={key} className="drawer-line">
                <Link to={href} className="drawer-line__media" onClick={close} tabIndex={-1} aria-hidden="true">
                  <Media src={cartLineImage(item)} alt="" ratio="portrait" />
                </Link>

                <div style={{ minWidth: 0 }}>
                  <Link to={href} className="line-item__name" onClick={close}>
                    {item.product.name}
                  </Link>
                  <CartLineOptions item={item} />
                  <div className="row gap-4" style={{ marginTop: 'var(--s-3)' }}>
                    <div className="stepper stepper--sm" aria-label={t('cart.quantity')}>
                      <button
                        type="button"
                        className="stepper__btn"
                        onClick={() => updateQuantity(key, item.quantity - 1)}
                        aria-label={t('cart.decrease')}
                      >
                        <IconMinus size={13} />
                      </button>
                      <span className="stepper__value">{item.quantity}</span>
                      <button
                        type="button"
                        className="stepper__btn"
                        onClick={() => updateQuantity(key, item.quantity + 1)}
                        disabled={item.quantity >= max}
                        aria-label={t('cart.increase')}
                      >
                        <IconPlus size={13} />
                      </button>
                    </div>
                    <button type="button" className="line-item__remove" onClick={() => removeItem(key)}>
                      {t('cart.removeShort')}
                    </button>
                  </div>
                </div>

                <p className="line-item__price">{formatCurrency(lineTotal(item))}</p>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
