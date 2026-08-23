import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { IconClose, IconFilter, IconSearch } from '../../../components/ui/icons';
import { useCategories } from '../../../hooks/useCategories';
import { useI18n } from '../../../lib/i18n';
import type { ProductFilters } from '../../../types';

/** Matches the command palette's search cadence (SearchOverlay). */
const SEARCH_DEBOUNCE_MS = 250;

interface Props {
  filters: ProductFilters;
  onChange: (partial: Partial<ProductFilters>) => void;
  /** Resets every dimension, including the ones that don't live in the URL. */
  onClearAll: () => void;
  totalCount: number;
  isLoading: boolean;
}

/**
 * Filtering stays editorial: a search rule, a category select and a refine
 * drawer for price. Active filters are shown as removable chips, so the state
 * of the view is always legible without a wall of outlined controls.
 */
export function ProductFiltersBar({ filters, onChange, onClearAll, totalCount, isLoading }: Props) {
  const { data: categories = [] } = useCategories();
  const { t, tCount, formatCurrency } = useI18n();
  const [refineOpen, setRefineOpen] = useState(false);
  const [minDraft, setMinDraft] = useState(filters.minPrice?.toString() ?? '');
  const [maxDraft, setMaxDraft] = useState(filters.maxPrice?.toString() ?? '');

  // The search box is uncontrolled-with-a-draft so typing stays responsive:
  // it used to write the URL and refire the catalogue query on EVERY keystroke.
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '');

  // Keep the drafts in step when the filters are reset from OUTSIDE (the empty
  // state's "clear filters", a category link, the back button). Adjusted during
  // render — the pattern already used in ProductListPage and SearchOverlay —
  // rather than in an effect, which would queue a cascading render.
  const externalKey = `${filters.search ?? ''}|${filters.minPrice ?? ''}|${filters.maxPrice ?? ''}`;
  const [prevExternalKey, setPrevExternalKey] = useState(externalKey);
  if (externalKey !== prevExternalKey) {
    setPrevExternalKey(externalKey);
    // Skip when the change is the one our own debounce just pushed, otherwise
    // committing a search would rewrite the box mid-typing.
    if ((filters.search ?? '') !== searchDraft.trim()) setSearchDraft(filters.search ?? '');
    setMinDraft(filters.minPrice?.toString() ?? '');
    setMaxDraft(filters.maxPrice?.toString() ?? '');
  }

  useEffect(() => {
    const next = searchDraft.trim();
    if (next === (filters.search ?? '')) return;
    const id = window.setTimeout(
      () => onChange({ search: next || undefined, page: 1 }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(id);
    // `onChange` is a fresh closure each render; re-running on it would reset
    // the timer every render and the search would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, filters.search]);

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

  // The refine drawer holds price AND category, so its reset clears everything
  // rather than just the price range its label used to imply.
  const clearAllFromDrawer = () => {
    onClearAll();
    setRefineOpen(false);
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
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
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
            <button type="button" className="btn btn--secondary" onClick={clearAllFromDrawer}>
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
