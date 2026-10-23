import { Link } from 'react-router-dom';
import { Media } from '../../../components/ui/Media';
import { IconMinus, IconPlus } from '../../../components/ui/icons';
import { cartLineKey, useCartStore } from '../../../store/cartStore';
import { useI18n } from '../../../lib/i18n';
import { availableStock } from '../../../lib/stock';
import { lineTotal, unitPrice } from '../../../lib/pricing';
import { CartLineOptions } from './CartLineOptions';
import { cartLineImage, cartLineLink } from '../../../lib/cartLines';
import type { CartItemLocal } from '../../../types';

export function CartItemRow({ item }: { item: CartItemLocal }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const { t, formatCurrency } = useI18n();

  const key = cartLineKey(item);
  // Cap by the chosen variant's stock, not the product total across all of them.
  const max = availableStock(item.product, item.variantId, item.selectedSize);
  const image = cartLineImage(item);
  const href = cartLineLink(item);

  return (
    <div className="line-item">
      <Link to={href} className="line-item__media" tabIndex={-1} aria-hidden="true">
        <Media src={image} alt="" ratio="portrait" />
      </Link>

      <div className="line-item__body">
        <Link to={href} className="line-item__name">
          {item.product.name}
        </Link>
        {item.product.categories && <p className="line-item__meta">{item.product.categories.name}</p>}
        <CartLineOptions item={item} />

        <div className="line-item__controls">
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

          <button
            type="button"
            className="line-item__remove"
            onClick={() => removeItem(key)}
            aria-label={t('cart.remove', { name: item.product.name })}
          >
            {t('cart.removeShort')}
          </button>
        </div>
      </div>

      <div className="line-item__price">
        {formatCurrency(lineTotal(item))}
        {item.quantity > 1 && (
          <p className="line-item__unit">
            {formatCurrency(unitPrice(item.product, item.variantId, item.selectedSize))} {t('cart.each')}
          </p>
        )}
      </div>
    </div>
  );
}
