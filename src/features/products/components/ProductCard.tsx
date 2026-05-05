import { Link } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n';
import type { Product } from '../../../types';

interface Props {
  product: Product;
  showActionButton?: boolean;
}

export function ProductCard({ product, showActionButton = true }: Props) {
  const { t, formatCurrency } = useI18n();
  const primaryImage = product.product_images?.find((img) => img.is_primary);

  const isOutOfStock = product.stock_quantity === 0;
  const isLowStock = !isOutOfStock && product.stock_quantity <= product.low_stock_threshold;
  const isClothing = product.categories?.slug === 'clothing';
  const hasVariants = (product.product_variants?.length ?? 0) > 0;

  return (
    <article className="product-card">
      <Link
        to={`/products/${product.slug}`}
        className="product-card__img-wrap"
        tabIndex={-1}
        aria-hidden="true"
      >
        <img
          src={primaryImage?.url ?? 'https://placehold.co/480x480/f5f5f7/aeaeb2?text=No+image'}
          alt={primaryImage?.alt_text ?? product.name}
          className="product-card__img"
          loading="lazy"
        />
        {isClothing && hasVariants && (
          <span className="product-card__variant-hint">{t('products.card.selectSize')}</span>
        )}
      </Link>

      <div className="product-card__body">
        {product.categories && (
          <span className="product-card__category">{product.categories.name}</span>
        )}
        <Link to={`/products/${product.slug}`} className="product-card__name">
          {product.name}
        </Link>
        <div className="product-card__pricing">
          <span className="product-card__price">{formatCurrency(product.price)}</span>
        </div>
      </div>

      {showActionButton && (
        <div className="product-card__footer">
          {isLowStock ? (
            <span className="product-card__stock-warn">
              {t('products.card.onlyLeft', { count: product.stock_quantity })}
            </span>
          ) : (
            <span />
          )}
          <Link
            to={`/products/${product.slug}`}
            className={`btn btn-primary btn-sm${isOutOfStock ? ' btn-disabled' : ''}`}
            aria-label={t('products.card.viewProduct', { name: product.name })}
            style={isOutOfStock ? { pointerEvents: 'none', opacity: 0.42 } : {}}
          >
            {isOutOfStock
              ? t('products.card.soldOut')
              : (isClothing && hasVariants ? t('products.card.chooseSize') : t('products.card.add'))}
          </Link>
        </div>
      )}
    </article>
  );
}
