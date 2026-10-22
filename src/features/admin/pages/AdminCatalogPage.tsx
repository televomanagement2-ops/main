import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Media } from '../../../components/ui/Media';
import { StatusDot } from '../../../components/ui/StatusIndicator';
import {
  useAdminProducts,
  useUpdateAdminProduct,
  useUpdateProductStock,
} from '../../../hooks/useAdminProducts';
import { ProductFormDrawer } from '../components/ProductFormDrawer';
import { SizeStockPanel } from '../components/SizeStockPanel';
import { StockConflictError } from '../../../lib/api';
import { parseStock, summarizeSizes } from '../../../lib/sizes';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import { IconExternal, IconPlus } from '../../../components/ui/icons';
import type { Product } from '../../../types';

type Tab = 'active' | 'archive';

export function AdminCatalogPage() {
  const { data: products = [], isLoading, error } = useAdminProducts();
  const updateProduct = useUpdateAdminProduct();
  const updateStock = useUpdateProductStock();
  const { t, tCount, formatCurrency } = useI18n();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('active');
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  // The sized product whose per-size restock panel is open.
  const [restockId, setRestockId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ mode: 'create' | 'edit'; product?: Product } | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [
        product.name,
        product.slug,
        product.sku,
        product.categories?.name,
        // A size SKU off a packing slip finds its product.
        ...(product.product_variants ?? []).map((v) => v.sku),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [products, search]);

  if (isLoading) {
    return (
      <>
        <header className="admin-page__head">
          <div>
            <p className="t-label">{t('admin.catalog.eyebrow')}</p>
            <h1 className="admin-page__title">{t('admin.catalog.title')}</h1>
          </div>
        </header>
        <RowsSkeleton rows={8} />
      </>
    );
  }

  if (error) {
    return (
      <div style={{ paddingTop: 'var(--s-10)' }}>
        <ErrorMessage message={t('admin.catalog.loadError')} />
      </div>
    );
  }

  // `<= 0`, not `=== 0`: stock can be NEGATIVE for an oversold product
  // (migration 013). With `=== 0` an oversold item matched NEITHER tab and
  // disappeared from the catalog altogether — exactly the item the operator
  // most needs to see, because it has orders to cover. For a sized product
  // stock_quantity is the database-derived sum of its sizes on sale.
  const activeProducts = filtered.filter((p) => p.is_active && p.stock_quantity > 0);
  const archivedProducts = filtered.filter((p) => !p.is_active || p.stock_quantity <= 0);
  const visible = tab === 'active' ? activeProducts : archivedProducts;

  const clearStockDraft = (productId: string) =>
    setStockDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });

  // Unsized products only — a sized product's figure is derived from its sizes.
  const saveStock = (product: Product) => {
    const draft = stockDrafts[product.id];
    if (draft == null) return;
    const value = parseStock(draft);
    if (value === null) {
      toast(t('admin.catalog.sizes.errors.stock'), 'critical');
      return;
    }
    updateStock.mutate(
      // Written only if the figure is still the one on screen: an order paid
      // in the meantime must not be overwritten by a stale restock.
      { productId: product.id, stock: value, expected: product.stock_quantity },
      {
        onSuccess: () => {
          clearStockDraft(product.id);
          toast(t('admin.catalog.stockUpdated', { name: product.name }));
        },
        onError: (err) =>
          toast(
            err instanceof StockConflictError
              ? t('admin.catalog.stockConflict', { name: product.name })
              : err instanceof Error
                ? err.message
                : t('common.error'),
            'critical'
          ),
      }
    );
  };

  const toggleActive = (product: Product) => {
    updateProduct.mutate(
      { productId: product.id, updates: { is_active: !product.is_active } },
      {
        onSuccess: () =>
          toast(product.is_active
            ? t('admin.catalog.hidden', { name: product.name })
            : t('admin.catalog.activated', { name: product.name })),
        onError: (err) => toast(err instanceof Error ? err.message : t('common.error'), 'critical'),
      }
    );
  };

  return (
    <>
      <header className="admin-page__head">
        <div>
          <p className="t-label">{t('admin.catalog.eyebrow')}</p>
          <h1 className="admin-page__title">{t('admin.catalog.title')}</h1>
          <p className="t-sm t-faint admin-page__desc">{t('admin.catalog.subtitle')}</p>
        </div>
        <div className="admin-page__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setDrawer({ mode: 'create' })}>
            <IconPlus size={15} />
            {t('admin.catalog.newProduct')}
          </button>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label={t('admin.catalog.title')}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          className={`tab${tab === 'active' ? ' is-active' : ''}`}
          onClick={() => setTab('active')}
        >
          {t('admin.catalog.tabActive')}
          <span className="tab__count">{activeProducts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'archive'}
          className={`tab${tab === 'archive' ? ' is-active' : ''}`}
          onClick={() => setTab('archive')}
        >
          {t('admin.catalog.tabArchive')}
          <span className="tab__count">{archivedProducts.length}</span>
        </button>
      </div>

      <div className="admin-toolbar" style={{ borderTop: 0 }}>
        <input
          type="search"
          className="input input--sm admin-toolbar__search"
          placeholder={t('admin.catalog.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t('admin.catalog.searchLabel')}
        />
        <span className="admin-toolbar__count">{tCount('admin.catalog.count', visible.length)}</span>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t('admin.catalog.emptyTitle')}</p>
          <p className="empty__body">{t('admin.catalog.empty')}</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setDrawer({ mode: 'create' })}>
            {t('admin.catalog.newProduct')}
          </button>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 'var(--s-6)' }}>
          <table className="table table--stack">
            <thead>
              <tr>
                <th>{t('admin.catalog.table.product')}</th>
                <th>{t('admin.catalog.table.category')}</th>
                <th className="table__num">{t('admin.catalog.table.price')}</th>
                <th>{t('admin.catalog.table.inventory')}</th>
                <th>{t('admin.catalog.table.status')}</th>
                <th className="table__actions">{t('admin.catalog.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const image =
                  product.product_images?.find((img) => img.is_primary)
                  ?? product.product_images?.[0]
                  ?? null;
                const sized = product.has_sizes;
                const sizes = summarizeSizes(product);
                const switchedOff = (product.product_variants ?? []).length - sizes.active.length;
                const restocking = sized && restockId === product.id;

                const draft = stockDrafts[product.id];
                const dirty = draft != null && draft.trim() !== String(product.stock_quantity);
                const out = product.stock_quantity <= 0;
                // A sized product is "low" as soon as one of its sizes is low
                // or gone — the total can look healthy while M is sold out.
                const low = !out && (sized
                  ? sizes.low > 0 || sizes.soldOut > 0
                  : product.stock_quantity <= product.low_stock_threshold);
                const fill = Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round(
                      (product.stock_quantity / Math.max(product.low_stock_threshold * 4, 1)) * 100
                    )
                  )
                );

                return (
                  <Fragment key={product.id}>
                    <tr>
                      <td data-col="meta">
                        <div className="row gap-3">
                          <Media
                            src={image?.url}
                            alt=""
                            ratio="square"
                            className="thumb"
                            style={{ width: 40, height: 40 }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <p className="table__primary">{product.name}</p>
                            <p className="t-xs t-faint t-mono">{product.sku ?? product.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td data-col="full">{product.categories?.name ?? t('admin.catalog.uncategorized')}</td>
                      <td data-col="end" className="table__num">{formatCurrency(product.price)}</td>
                      <td data-col="full">
                        {sized ? (
                          <div className="stack gap-2">
                            {sizes.active.length > 0 ? (
                              <div className="size-chips">
                                {sizes.active.map((variant) => (
                                  <span
                                    key={variant.id}
                                    className={`size-chip${
                                      variant.stock_qty <= 0
                                        ? ' size-chip--out'
                                        : variant.stock_qty <= product.low_stock_threshold
                                          ? ' size-chip--low'
                                          : ''
                                    }`}
                                  >
                                    <span className="size-chip__size">{variant.size}</span>
                                    <span className="size-chip__qty">{variant.stock_qty}</span>
                                  </span>
                                ))}
                                {switchedOff > 0 && (
                                  <span className="t-xs t-faint">
                                    {tCount('admin.catalog.sizes.hiddenCount', switchedOff)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="t-xs t-faint">{t('admin.catalog.sizes.noneOnSale')}</span>
                            )}
                            <button
                              type="button"
                              className="btn btn--quiet btn--sm"
                              style={{ alignSelf: 'flex-start' }}
                              onClick={() => setRestockId(restocking ? null : product.id)}
                              aria-expanded={restocking}
                            >
                              {restocking ? t('admin.catalog.sizes.closeStock') : t('admin.catalog.sizes.editStock')}
                            </button>
                          </div>
                        ) : (
                          <div className="stock-cell">
                            <input
                              className="input input--sm"
                              style={{ width: 68 }}
                              inputMode="numeric"
                              value={draft ?? String(product.stock_quantity)}
                              onChange={(event) =>
                                setStockDrafts((prev) => ({ ...prev, [product.id]: event.target.value }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && dirty) saveStock(product);
                              }}
                              aria-label={t('admin.catalog.stockQty')}
                            />
                            <span className="stock-bar" aria-hidden="true">
                              <span
                                className={`stock-bar__fill${out ? ' stock-bar__fill--out' : low ? ' stock-bar__fill--low' : ''}`}
                                style={{ width: `${out ? 100 : Math.max(fill, 6)}%` }}
                              />
                            </span>
                            {dirty && (
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                onClick={() => saveStock(product)}
                                disabled={updateStock.isPending}
                              >
                                {t('admin.catalog.updateStock')}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td data-col="full">
                        {!product.is_active ? (
                          <StatusDot tone="neutral" label={t('admin.catalog.statusHidden')} />
                        ) : out ? (
                          <StatusDot tone="critical" label={t('admin.catalog.outOfStock')} />
                        ) : sized && sizes.soldOut > 0 ? (
                          <StatusDot tone="caution" label={tCount('admin.catalog.sizes.soldOut', sizes.soldOut)} />
                        ) : low ? (
                          <StatusDot tone="caution" label={t('admin.catalog.lowStock')} />
                        ) : (
                          <StatusDot tone="positive" label={t('admin.catalog.statusActive')} />
                        )}
                      </td>
                      <td data-col="end" className="table__actions">
                        <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => setDrawer({ mode: 'edit', product })}
                          >
                            {t('admin.catalog.edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm"
                            onClick={() => toggleActive(product)}
                            disabled={updateProduct.isPending}
                          >
                            {product.is_active ? t('admin.catalog.hide') : t('admin.catalog.activate')}
                          </button>
                          <Link
                            to={`/products/${product.slug}`}
                            className="btn btn--quiet btn--sm"
                            aria-label={t('admin.catalog.view')}
                          >
                            <IconExternal size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {restocking && (
                      <tr className="table__subrow">
                        <td colSpan={6} data-col="full">
                          <SizeStockPanel product={product} onClose={() => setRestockId(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="t-xs t-faint" style={{ marginTop: 'var(--s-6)', maxWidth: '68ch' }}>
        {t('admin.catalog.note')}
      </p>

      {drawer && (
        <ProductFormDrawer
          key={drawer.product?.id ?? 'create'}
          mode={drawer.mode}
          product={drawer.product}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}
