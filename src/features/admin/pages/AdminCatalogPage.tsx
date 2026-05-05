import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../../../components/ui/Spinner';
import { useAdminProducts, useUpdateAdminProduct } from '../../../hooks/useAdminProducts';
import { useI18n } from '../../../lib/i18n';

export function AdminCatalogPage() {
  const { data: products = [], isLoading, error } = useAdminProducts();
  const updateProduct = useUpdateAdminProduct();
  const { t, formatCurrency } = useI18n();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.slug, product.categories?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [products, search]);

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="card card-padded" style={{ textAlign: 'center' }}>
        <p className="body" style={{ color: 'var(--color-danger)' }}>
          {t('admin.catalog.loadError')}
        </p>
      </div>
    );
  }

  const activeProducts = filteredProducts.filter(
    (product) => product.is_active && product.stock_quantity > 0
  );
  const archivedProducts = filteredProducts.filter(
    (product) => !product.is_active || product.stock_quantity === 0
  );
  const visibleProducts = tab === 'active' ? activeProducts : archivedProducts;

  return (
    <div className="admin-section">
      <div className="admin-orders-toolbar">
        <div>
          <span className="section-eyebrow">{t('admin.catalog.eyebrow')}</span>
          <h2 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>
            {t('admin.catalog.title')}
          </h2>
        </div>
        <div className="admin-orders-filters">
          <label className="admin-filter">
            <span>{t('admin.catalog.searchLabel')}</span>
            <input
              className="input"
              placeholder={t('admin.catalog.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button className="btn btn-primary btn-sm" disabled>
            {t('admin.catalog.newProduct')}
          </button>
        </div>
      </div>

      <div className="admin-tabs admin-tabs--inline">
        <button
          type="button"
          className={`admin-tab${tab === 'active' ? ' active' : ''}`}
          onClick={() => setTab('active')}
        >
          {t('admin.catalog.activeWithCount', { count: activeProducts.length })}
        </button>
        <button
          type="button"
          className={`admin-tab${tab === 'archive' ? ' active' : ''}`}
          onClick={() => setTab('archive')}
        >
          {t('admin.catalog.archiveWithCount', { count: archivedProducts.length })}
        </button>
      </div>

      {visibleProducts.length === 0 ? (
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <p className="body">{t('admin.catalog.empty')}</p>
        </div>
      ) : (
        <div className="admin-catalog-grid">
          {visibleProducts.map((product) => {
            const primaryImage =
              product.product_images?.find((img) => img.is_primary)
              ?? product.product_images?.[0]
              ?? null;

            return (
            <article key={product.id} className="card admin-product-card">
              <div className="admin-product-card__head">
                <div className="admin-product-card__summary">
                  <div className="admin-product-card__thumb">
                    <img
                      src={primaryImage?.url ?? 'https://placehold.co/96x96/f5f5f7/aeaeb2?text=No+image'}
                      alt={primaryImage?.alt_text ?? product.name}
                    />
                  </div>
                  <div>
                    <p className="admin-product-card__title">{product.name}</p>
                    <p className="caption">{product.categories?.name ?? t('admin.catalog.uncategorized')}</p>
                  </div>
                </div>
                <span className={`admin-pill admin-pill--status${product.is_active ? '' : ' is-muted'}`}>
                  {product.is_active ? t('admin.catalog.statusActive') : t('admin.catalog.statusHidden')}
                </span>
              </div>

              <p className="admin-product-card__price">{formatCurrency(product.price)}</p>

              <div className="admin-product-card__meta">
                <div>
                  <p className="label-caps">{t('admin.catalog.stockLabel')}</p>
                  <p className="admin-product-card__stock">
                    {product.stock_quantity === 0
                      ? t('admin.catalog.outOfStock')
                      : t('admin.catalog.inStock', { count: product.stock_quantity })}
                  </p>
                </div>
                <Link to={`/products/${product.slug}`} className="btn btn-ghost btn-sm">
                  {t('admin.catalog.view')}
                </Link>
              </div>

              <div className="admin-product-card__actions">
                <label className="admin-action">
                  <span>{t('admin.catalog.stockQty')}</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={stockDrafts[product.id] ?? String(product.stock_quantity)}
                    onChange={(event) =>
                      setStockDrafts((prev) => ({
                        ...prev,
                        [product.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="admin-product-card__buttons">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      updateProduct.mutate({
                        productId: product.id,
                        updates: { stock_quantity: Number(stockDrafts[product.id] ?? product.stock_quantity) },
                      })
                    }
                    disabled={updateProduct.isPending}
                  >
                    {t('admin.catalog.updateStock')}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      updateProduct.mutate({
                        productId: product.id,
                        updates: { is_active: !product.is_active },
                      })
                    }
                    disabled={updateProduct.isPending}
                  >
                    {product.is_active ? t('admin.catalog.hide') : t('admin.catalog.activate')}
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}

      <div className="admin-note">
        <p className="body">{t('admin.catalog.note')}</p>
      </div>
    </div>
  );
}
