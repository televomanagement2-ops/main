import { Link } from 'react-router-dom';
import { Media } from '../../../components/ui/Media';
import { IconArrowUpRight } from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import type { Product } from '../../../types';

interface Props {
  product: Product;
  /** `lead` sets the type a step larger for the dominant item in a composition. */
  variant?: 'default' | 'lead';
  ratio?: 'square' | 'portrait' | 'tall';
  /** Editorial index (01, 02 …) shown on curated compositions only. */
  index?: number;
}

/**
 * A product card is not a card: image, name, category, price. No container,
 * no border, no shadow — the photograph is the object and the type sits
 * quietly beneath it.
 */
export function ProductCard({ product, variant = 'default', ratio = 'square', index }: Props) {
  const { t, formatCurrency } = useI18n();

  const image =
    product.product_images?.find((img) => img.is_primary)?.url ??
    product.product_images?.[0]?.url ??
    null;
  const alt =
    product.product_images?.find((img) => img.is_primary)?.alt_text ?? product.name;

  const isOut = product.stock_quantity === 0;
  const isLow = !isOut && product.stock_quantity <= product.low_stock_threshold;

  return (
    <article className={`pcard${variant === 'lead' ? ' pcard--lead' : ''}`}>
      <Link to={`/products/${product.slug}`} className="pcard__media">
        {index != null && (
          <span className="pcard__index" aria-hidden="true">
            {String(index).padStart(2, '0')}
          </span>
        )}
        {isOut && <span className="pcard__flag">{t('products.card.soldOut')}</span>}
        <Media src={image} alt={alt} ratio={ratio} zoom />
      </Link>

      <div className="pcard__body">
        <div style={{ minWidth: 0 }}>
          <Link to={`/products/${product.slug}`} className="pcard__name">
            {product.name}
          </Link>
          {product.categories && <p className="pcard__cat">{product.categories.name}</p>}
          {isLow && (
            <p className="pcard__note">{t('products.card.onlyLeft', { count: product.stock_quantity })}</p>
          )}
        </div>

        <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
          <span className="pcard__price">{formatCurrency(product.price)}</span>
          <Link
            to={`/products/${product.slug}`}
            className="pcard__open"
            aria-label={t('products.card.viewProduct', { name: product.name })}
          >
            <IconArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </article>
  );
}
