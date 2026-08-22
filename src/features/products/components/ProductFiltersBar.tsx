import { useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { IconClose, IconFilter, IconSearch } from '../../../components/ui/icons';
import { useCategories } from '../../../hooks/useCategories';
import { useI18n } from '../../../lib/i18n';
import type { ProductFilters } from '../../../types';

interface Props {
  filters: ProductFilters;
  onChange: (partial: Partial<ProductFilters>) => void;
  totalCount: number;
  isLoading: boolean;
}

/**
 * Filtering stays editorial: a search rule, a category select and a refine
 * drawer for price. Active filters are shown as removable chips, so the state
 * of the view is always legible without a wall of outlined controls.
 */
export function ProductFiltersBar({ filters, onChange, totalCount, isLoading }: Props) {
  const { data: categories = [] } = useCategories();
  const { t, tCount, formatCurrency } = useI18n();
  const [refineOpen, setRefineOpen] = useState(false);
  const [minDraft, setMinDraft] = useState(filters.minPrice?.toString() ?? '');
  const [maxDraft, setMaxDraft] = useState(filters.maxPrice?.toString() ?? '');

  const activeCategory = categories.find((c) => c.slug === filters.categorySlug);
  const hasPrice = filters.minPrice != null || filters.maxPrice != null;

  const applyPrice = () => {
    onChange({
      minPrice: minDraft ? Number(minDraft) : undefined,
      maxPrice: maxDraft ? Number(maxDraft) : undefined,
      page: 1,
    });
    setRefineOpen(false);
  };

  const clearPrice = () => {
    setMinDraft('');
    setMaxDraft('');
    onChange({ minPrice: undefined, maxPrice: undefined, page: 1 });
  };

  return (
    <>
      <div className="filter-bar">
        <div className="filter-bar__search row gap-2">
          <IconSearch size={15} className="t-faint" />
          <input
            type="search"
            className="input input--underline"
            placeholder={t('products.searchPlaceholder')}
            value={filters.search ?? ''}
            onChange={(e) => onChange({ search: e.target.value || undefined, page: 1 })}
            aria-label={t('products.searchPlaceholder')}
          />
        </div>

        <label className="row gap-2">
          <span className="t-label">{t('products.category')}</span>
          <select
            className="select select--sm"
            style={{ width: 'auto', minWidth: 150 }}
            value={filters.categorySlug ?? ''}
            onChange={(e) => onChange({ categorySlug: e.target.value || undefined, page: 1 })}
          >
            <option value="">{t('products.allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
        </label>

        <button type="button" className="filter-trigger" onClick={() => setRefineOpen(true)}>
          <IconFilter size={15} />
          {t('products.refine')}
          {hasPrice && <span className="filter-trigger__dot" aria-hidden="true" />}
        </button>

        <span className="admin-toolbar__count">
          {isLoading ? t('products.loading') : tCount('products.results', totalCount)}
        </span>
      </div>

      {(activeCategory || hasPrice || filters.search) && (
        <div className="filter-chips" style={{ marginTop: 'calc(var(--s-6) * -1)', marginBottom: 'var(--s-8)' }}>
          {filters.search && (
            <button type="button" className="filter-chip" onClick={() => onChange({ search: undefined, page: 1 })}>
              “{filters.search}”
              <IconClose size={12} />
            </button>
          )}
          {activeCategory && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => onChange({ categorySlug: undefined, page: 1 })}
            >
              {activeCategory.name}
              <IconClose size={12} />
            </button>
          )}
          {hasPrice && (
            <button type="button" className="filter-chip" onClick={clearPrice}>
              {filters.minPrice != null ? formatCurrency(filters.minPrice) : t('products.minPrice')}
              {' – '}
              {filters.maxPrice != null ? formatCurrency(filters.maxPrice) : t('products.maxPrice')}
              <IconClose size={12} />
            </button>
          )}
        </div>
      )}

      <Drawer
        open={refineOpen}
        onClose={() => setRefineOpen(false)}
        eyebrow={t('products.catalogEyebrow')}
        title={t('products.refine')}
        closeLabel={t('common.close')}
        footer={
          <div className="row gap-3">
            <button type="button" className="btn btn--secondary" onClick={clearPrice}>
              {t('products.clearFilters')}
            </button>
            <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={applyPrice}>
              {t('products.applyFilters')}
            </button>
          </div>
        }
      >
        <div className="stack gap-6">
          <div className="field">
            <span className="field__label">{t('products.priceRange')}</span>
            <div className="row gap-3">
              <input
                type="number"
                min={0}
                className="input"
                placeholder={t('products.minPrice')}
                value={minDraft}
                onChange={(e) => setMinDraft(e.target.value)}
                aria-label={t('products.minPrice')}
              />
              <span className="t-faint">–</span>
              <input
                type="number"
                min={0}
                className="input"
                placeholder={t('products.maxPrice')}
                value={maxDraft}
                onChange={(e) => setMaxDraft(e.target.value)}
                aria-label={t('products.maxPrice')}
              />
            </div>
          </div>

          <div className="field">
            <span className="field__label">{t('products.category')}</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip${!filters.categorySlug ? ' is-active' : ''}`}
                onClick={() => onChange({ categorySlug: undefined, page: 1 })}
              >
                {t('products.allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`filter-chip${filters.categorySlug === cat.slug ? ' is-active' : ''}`}
                  onClick={() => onChange({ categorySlug: cat.slug, page: 1 })}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
