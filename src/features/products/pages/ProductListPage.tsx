import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../../../hooks/useProducts';
import { ProductGrid } from '../components/ProductGrid';
import { ProductFiltersBar } from '../components/ProductFiltersBar';
import { useI18n } from '../../../lib/i18n';
import type { ProductFilters } from '../../../types';

export function ProductListPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<ProductFilters>({
    page: 1,
    pageSize: 12,
    search:       searchParams.get('search')   || undefined,
    categorySlug: searchParams.get('category') || undefined,
  });
  const { data, isLoading, error } = useProducts(filters);

  const products   = data?.data ?? [];
  const total      = data?.count ?? 0;
  const page       = filters.page ?? 1;
  const pageSize   = filters.pageSize ?? 12;
  const totalPages = Math.ceil(total / pageSize);

  const update = (partial: Partial<ProductFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    if (partial.page !== undefined) window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <div style={{ marginBottom: 'var(--sp-8)' }}>
        <span className="section-eyebrow">{t('products.catalogEyebrow')}</span>
        <h1 className="heading-1" style={{ marginBottom: 0 }}>{t('products.catalogTitle')}</h1>
      </div>

      <ProductFiltersBar
        filters={filters}
        onChange={update}
        totalCount={total}
        isLoading={isLoading}
      />

      <ProductGrid
        products={products}
        isLoading={isLoading}
        error={error as Error | null}
        skeletonCount={12}
        staggered
      />

      {totalPages > 1 && (
        <nav className="pagination" aria-label={t('products.paginationLabel')}>
          <button
            onClick={() => update({ page: page - 1 })}
            disabled={page <= 1}
            className="btn btn-secondary btn-sm"
          >
            ← {t('products.prevPage')}
          </button>
          <span className="pagination-info">{page} / {totalPages}</span>
          <button
            onClick={() => update({ page: page + 1 })}
            disabled={page >= totalPages}
            className="btn btn-secondary btn-sm"
          >
            {t('products.nextPage')} →
          </button>
        </nav>
      )}
    </div>
  );
}
