import { Link } from 'react-router-dom';
import { useCartStore } from '../../../store/cartStore';
import { useI18n } from '../../../lib/i18n';
import type { CartItemLocal } from '../../../types';

interface Props {
  item: CartItemLocal;
}

export function CartItemRow({ item }: Props) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem     = useCartStore((s) => s.removeItem);
  const { t, formatCurrency } = useI18n();

  const primaryImage = item.product.product_images?.find((i) => i.is_primary);
  const lineTotal = item.product.price * item.quantity;

  return (
    <div className="cart-item">
      <img
        src={primaryImage?.url ?? 'https://placehold.co/144x144/f7f7f8/c8c8ce?text=?'}
        alt={item.product.name}
        className="cart-item__img"
      />

      <div className="cart-item__info">
        <Link to={`/products/${item.product.slug}`} className="cart-item__name">
          {item.product.name}
        </Link>
        {item.selectedSize && (
          <p className="cart-item__variant">{t('cart.size')}: <strong>{item.selectedSize}</strong></p>
        )}
        <p className="cart-item__price">{formatCurrency(item.product.price)} {t('cart.each')}</p>
      </div>

      <div className="qty-control cart-item__qty" aria-label={t('cart.quantity')}>
        <button
          className="qty-btn"
          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize)}
          aria-label={t('cart.decrease')}
          style={{ width: 32, height: 32, fontSize: 16 }}
        >
          −
        </button>
        <span className="qty-value" style={{ minWidth: 32, height: 32, fontSize: 13 }}>
          {item.quantity}
        </span>
        <button
          className="qty-btn"
          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize)}
          disabled={item.quantity >= item.product.stock_quantity}
          aria-label={t('cart.increase')}
          style={{ width: 32, height: 32, fontSize: 16 }}
        >
          +
        </button>
      </div>

      <p className="cart-item__total">{formatCurrency(lineTotal)}</p>

      <button
        onClick={() => removeItem(item.product.id, item.selectedSize)}
        className="cart-item__remove"
        aria-label={t('cart.remove', { name: item.product.name })}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
