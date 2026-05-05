import { useCategories } from '../../../hooks/useCategories';
import { useI18n } from '../../../lib/i18n';
import type { ProductFilters } from '../../../types';

interface Props {
  filters: ProductFilters;
  onChange: (partial: Partial<ProductFilters>) => void;
  totalCount: number;
  isLoading: boolean;
}

export function ProductFiltersBar({ filters, onChange, totalCount, isLoading }: Props) {
  const { data: categories = [] } = useCategories();
  const { t, tCount } = useI18n();

  return (
    <div className="filters-bar">
      <input
        type="search"
        placeholder={t('products.searchPlaceholder')}
        value={filters.search ?? ''}
        onChange={(e) => onChange({ search: e.target.value || undefined, page: 1 })}
        className="input filters-bar__search"
      />

      <select
        value={filters.categorySlug ?? ''}
        onChange={(e) => onChange({ categorySlug: e.target.value || undefined, page: 1 })}
        className="select"
        style={{ width: 'auto', minWidth: 148 }}
      >
        <option value="">{t('products.allCategories')}</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.slug}>{cat.name}</option>
        ))}
      </select>

      <div className="filters-bar__price">
        <input
          type="number"
          placeholder={t('products.minPrice')}
          value={filters.minPrice ?? ''}
          onChange={(e) => onChange({ minPrice: e.target.value ? +e.target.value : undefined, page: 1 })}
          className="input input-sm"
          style={{ width: 76 }}
          min={0}
        />
        <span className="filters-bar__sep">–</span>
        <input
          type="number"
          placeholder={t('products.maxPrice')}
          value={filters.maxPrice ?? ''}
          onChange={(e) => onChange({ maxPrice: e.target.value ? +e.target.value : undefined, page: 1 })}
          className="input input-sm"
          style={{ width: 76 }}
          min={0}
        />
      </div>

      <span className="results-count">
        {isLoading ? t('products.loading') : tCount('products.results', totalCount)}
      </span>
    </div>
  );
}
