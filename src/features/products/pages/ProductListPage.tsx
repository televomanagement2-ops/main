import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../../../hooks/useProducts';
import { ProductGrid } from '../components/ProductGrid';
import { ProductFiltersBar } from '../components/ProductFiltersBar';
import { useI18n } from '../../../lib/i18n';
import type { ProductFilters } from '../../../types';

const PAGE_SIZE = 12;

export function ProductListPage() {
  const { t } = useI18n();
  // search/category live in the URL (single source of truth) so navbar
  // searches and category links keep working after the first render.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || undefined;
  const categorySlug = searchParams.get('category') || undefined;

  const [page, setPage] = useState(1);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);

  // New search/category (e.g. from the navbar) → back to page 1. State is
  // adjusted during render (not in an effect) so no stale page ever renders.
  const paramsKey = `${search ?? ''}|${categorySlug ?? ''}`;
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  let effectivePage = page;
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setPage(1);
    effectivePage = 1;
  }

  const filters: ProductFilters = {
    search,
    categorySlug,
    minPrice,
    maxPrice,
    page: effectivePage,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, error } = useProducts(filters);

  const products   = data?.data ?? [];
  const total      = data?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const update = (partial: Partial<ProductFilters>) => {
    if ('search' in partial || 'categorySlug' in partial) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if ('search' in partial) {
          if (partial.search) next.set('search', partial.search);
          else next.delete('search');
        }
        if ('categorySlug' in partial) {
          if (partial.categorySlug) next.set('category', partial.categorySlug);
          else next.delete('category');
        }
        return next;
      }, { replace: true });
    }
    if ('minPrice' in partial) setMinPrice(partial.minPrice);
    if ('maxPrice' in partial) setMaxPrice(partial.maxPrice);
    if (partial.page !== undefined) {
      setPage(partial.page);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
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
            onClick={() => update({ page: effectivePage - 1 })}
            disabled={effectivePage <= 1}
            className="btn btn-secondary btn-sm"
          >
            ← {t('products.prevPage')}
          </button>
          <span className="pagination-info">{effectivePage} / {totalPages}</span>
          <button
            onClick={() => update({ page: effectivePage + 1 })}
            disabled={effectivePage >= totalPages}
            className="btn btn-secondary btn-sm"
          >
            {t('products.nextPage')} →
          </button>
        </nav>
      )}
    </div>
  );
}
