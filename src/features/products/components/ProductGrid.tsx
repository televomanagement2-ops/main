import { ProductCard } from './ProductCard';
import { SkeletonCard } from '../../../components/ui/SkeletonCard';
import type { Product } from '../../../types';

interface Props {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
  skeletonCount?: number;
  staggered?: boolean;
}

export function ProductGrid({ products, isLoading, error, skeletonCount = 8, staggered = false }: Props) {
  const gridClassName = `product-grid${staggered ? ' product-grid--staggered' : ''}`;

  if (isLoading) {
    return (
      <div className={gridClassName}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={gridClassName}>
        <div className="product-grid-empty">
          <svg className="product-grid-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Failed to load products.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={gridClassName}>
      {products.length === 0 ? (
        <div className="product-grid-empty">
          <svg className="product-grid-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
          </svg>
          <p>No products found.</p>
        </div>
      ) : (
        products.map((p) => <ProductCard key={p.id} product={p} />)
      )}
    </div>
  );
}
