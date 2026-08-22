import { ProductCard } from './ProductCard';
import { SkeletonCard } from '../../../components/ui/SkeletonCard';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { useI18n } from '../../../lib/i18n';
import type { Product } from '../../../types';

interface Props {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
  skeletonCount?: number;
  emptyAction?: React.ReactNode;
}

export function ProductGrid({ products, isLoading, error, skeletonCount = 12, emptyAction }: Props) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="product-grid">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) return <ErrorMessage message={t('products.loadError')} />;

  if (products.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t('products.emptyTitle')}</p>
        <p className="empty__body">{t('products.empty')}</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
