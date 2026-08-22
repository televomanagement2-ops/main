import { Link } from 'react-router-dom';
import { Media } from '../../../components/ui/Media';
import { IconMinus, IconPlus } from '../../../components/ui/icons';
import { useCartStore } from '../../../store/cartStore';
import { useI18n } from '../../../lib/i18n';
import type { CartItemLocal } from '../../../types';

export function CartItemRow({ item }: { item: CartItemLocal }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const { t, formatCurrency } = useI18n();

  const image =
    item.product.product_images?.find((i) => i.is_primary)?.url ??
    item.product.product_images?.[0]?.url ??
    null;
  const lineTotal = item.product.price * item.quantity;

  return (
    <div className="line-item">
      <Link
        to={`/products/${item.product.slug}`}
        className="line-item__media"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Media src={image} alt="" ratio="portrait" />
      </Link>

      <div className="line-item__body">
        <Link to={`/products/${item.product.slug}`} className="line-item__name">
          {item.product.name}
        </Link>
        {item.product.categories && <p className="line-item__meta">{item.product.categories.name}</p>}
        {item.selectedSize && (
          <p className="line-item__meta">
            {t('cart.size')}: {item.selectedSize}
          </p>
        )}

        <div className="line-item__controls">
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
              disabled={item.quantity >= item.product.stock_quantity}
              aria-label={t('cart.increase')}
            >
              <IconPlus size={13} />
            </button>
          </div>

          <button
            type="button"
            className="line-item__remove"
            onClick={() => removeItem(item.product.id, item.selectedSize)}
            aria-label={t('cart.remove', { name: item.product.name })}
          >
            {t('cart.removeShort')}
          </button>
        </div>
      </div>

      <div className="line-item__price">
        {formatCurrency(lineTotal)}
        {item.quantity > 1 && (
          <p className="line-item__unit">
            {formatCurrency(item.product.price)} {t('cart.each')}
          </p>
        )}
      </div>
    </div>
  );
}
