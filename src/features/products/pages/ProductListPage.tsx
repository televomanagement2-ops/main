import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import { ProductGrid } from '../components/ProductGrid';
import { ProductFiltersBar } from '../components/ProductFiltersBar';
import { IconArrowLeft, IconArrowRight } from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import type { ProductFilters } from '../../../types';

const PAGE_SIZE = 12;

export function ProductListPage() {
  const { t, tCount } = useI18n();
  // search/category live in the URL (single source of truth) so navbar
  // searches and category links keep working after the first render.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || undefined;
  const categorySlug = searchParams.get('category') || undefined;

  const [page, setPage] = useState(1);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);

  // New search/category (e.g. from the header) → back to page 1. State is
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
  const { data: categories = [] } = useCategories();

  const products = data?.data ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  // Price lives in component state, not the URL, so navigating to "/products"
  // cleared only search and category and silently left the price range applied
  // (the route component never unmounts). Reset every dimension explicitly.
  const clearAllFilters = () => {
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setPage(1);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

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

  const title = activeCategory?.name ?? t('products.catalogTitle');
  const description = activeCategory?.description ?? t('products.catalogSubtitle');

  return (
    <div className="page">
      <header className="collection__head">
        <div className="collection__title">
          <p className="t-label">
            {activeCategory ? t('products.collectionEyebrow') : t('products.catalogEyebrow')}
          </p>
          <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{title}</h1>
        </div>
        {description && <p className="t-body collection__desc t-measure">{description}</p>}
        <p className="t-xs t-faint collection__count">
          {isLoading ? t('products.loading') : tCount('products.results', total)}
        </p>
      </header>

      <ProductFiltersBar
        filters={filters}
        onChange={update}
        onClearAll={clearAllFilters}
        totalCount={total}
        isLoading={isLoading}
      />

      <ProductGrid
        products={products}
        isLoading={isLoading}
        error={error as Error | null}
        skeletonCount={PAGE_SIZE}
        emptyAction={
          <button type="button" className="btn btn--secondary" onClick={clearAllFilters}>
            {t('products.clearFilters')}
          </button>
        }
      />

      {totalPages > 1 && (
        <nav className="pager" aria-label={t('products.paginationLabel')}>
          <button
            type="button"
            onClick={() => update({ page: effectivePage - 1 })}
            disabled={effectivePage <= 1}
            className="btn btn--secondary btn--sm"
          >
            <IconArrowLeft size={14} />
            {t('products.prevPage')}
          </button>
          <span className="pager__info">
            {effectivePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => update({ page: effectivePage + 1 })}
            disabled={effectivePage >= totalPages}
            className="btn btn--secondary btn--sm"
          >
            {t('products.nextPage')}
            <IconArrowRight size={14} />
          </button>
        </nav>
      )}
    </div>
  );
}
