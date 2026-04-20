import { useCategories } from '../../../hooks/useCategories';
import type { ProductFilters } from '../../../types';

interface Props {
  filters: ProductFilters;
  onChange: (partial: Partial<ProductFilters>) => void;
  totalCount: number;
  isLoading: boolean;
}

export function ProductFiltersBar({ filters, onChange, totalCount, isLoading }: Props) {
  const { data: categories = [] } = useCategories();

  return (
    <div className="filters-bar">
      <input
        type="search"
        placeholder="Search products…"
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
        <option value="">All categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.slug}>{cat.name}</option>
        ))}
      </select>

      <div className="filters-bar__price">
        <input
          type="number"
          placeholder="Min $"
          value={filters.minPrice ?? ''}
          onChange={(e) => onChange({ minPrice: e.target.value ? +e.target.value : undefined, page: 1 })}
          className="input input-sm"
          style={{ width: 76 }}
          min={0}
        />
        <span className="filters-bar__sep">–</span>
        <input
          type="number"
          placeholder="Max $"
          value={filters.maxPrice ?? ''}
          onChange={(e) => onChange({ maxPrice: e.target.value ? +e.target.value : undefined, page: 1 })}
          className="input input-sm"
          style={{ width: 76 }}
          min={0}
        />
      </div>

      <span className="results-count">
        {isLoading ? 'Loading…' : `${totalCount} product${totalCount !== 1 ? 's' : ''}`}
      </span>
    </div>
  );
}
