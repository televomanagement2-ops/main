import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Media } from '../../../components/ui/Media';
import { StatusDot } from '../../../components/ui/StatusIndicator';
import {
  useAdminCategories,
  useAdminProducts,
  useCatalogCosts,
  useDuplicateProduct,
  useSetProductStock,
  useUpdateAdminProduct,
} from '../../../hooks/useAdminProducts';
import { ProductFormDrawer } from '../components/ProductFormDrawer';
import { VariantStockPanel } from '../components/VariantStockPanel';
import { ImportProductsDrawer } from '../components/ImportProductsDrawer';
import { StockConflictError } from '../../../lib/api';
import { parseStock } from '../../../lib/sizes';
import { hasVariants, priceRange, sellableColors, summarizeVariants } from '../../../lib/variants';
import { datedFilename, dialectForLocale, downloadCsv, toCsv } from '../../../lib/csv';
import { productsToCsvRows } from '../../../lib/productCsv';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import { IconCopy, IconDownload, IconExternal, IconPlus, IconUpload } from '../../../components/ui/icons';
import type { Product, ProductVariant } from '../../../types';

type Tab = 'active' | 'archive';

export function AdminCatalogPage() {
  const { data: products = [], isLoading, error } = useAdminProducts();
  const { data: categories = [] } = useAdminCategories();
  const costs = useCatalogCosts();
  const updateProduct = useUpdateAdminProduct();
  const updateStock = useSetProductStock();
  const duplicate = useDuplicateProduct();
  const { t, tCount, formatCurrency, locale } = useI18n();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('active');
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  // The product with variants whose quick restock panel is open.
  const [restockId, setRestockId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ mode: 'create' | 'edit'; product?: Product } | null>(null);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [
        product.name,
        product.slug,
        product.sku,
        product.categories?.name,
        // A variant SKU off a packing slip finds its product, and so does a colour.
        ...(product.product_variants ?? []).map((v) => v.sku),
        ...(product.product_colors ?? []).map((c) => c.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [products, search]);

  const exportCatalog = () => {
    if (!costs.data) return;
    const dialect = dialectForLocale(locale);
    downloadCsv(
      datedFilename('catalog'),
      toCsv(productsToCsvRows(products, { dialect, categories, costs: costs.data }), dialect),
    );
  };

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
  // most needs to see, because it has orders to cover. For a product with
  // variants stock_quantity is the database-derived sum of those on sale.
  const activeProducts = filtered.filter((p) => p.is_active && p.stock_quantity > 0);
  const archivedProducts = filtered.filter((p) => !p.is_active || p.stock_quantity <= 0);
  const visible = tab === 'active' ? activeProducts : archivedProducts;

  const clearStockDraft = (productId: string) =>
    setStockDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });

  // Products without variants only — the others' figure is derived.
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

  const duplicateProduct = (product: Product) => {
    duplicate.mutate(
      { productId: product.id, name: t('admin.catalog.copyName', { name: product.name }) },
      {
        onSuccess: () => {
          toast(t('admin.catalog.duplicated', { name: product.name }));
          // The copy is hidden: show where it went.
          setTab('archive');
        },
        onError: (err) => toast(err instanceof Error ? err.message : t('common.error'), 'critical'),
      }
    );
  };

  const chip = (product: Product, variant: ProductVariant, label: string) => (
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
      <span className="size-chip__size">{label}</span>
      <span className="size-chip__qty">{variant.stock_qty}</span>
    </span>
  );

  return (
    <>
      <header className="admin-page__head">
        <div>
          <p className="t-label">{t('admin.catalog.eyebrow')}</p>
          <h1 className="admin-page__title">{t('admin.catalog.title')}</h1>
          <p className="t-sm t-faint admin-page__desc">{t('admin.catalog.subtitle')}</p>
        </div>
        <div className="admin-page__actions">
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setImporting(true)}>
            <IconUpload size={14} />
            {t('admin.catalog.import.open')}
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={exportCatalog}
            disabled={!costs.data || products.length === 0}
          >
            <IconDownload size={14} />
            {t('admin.catalog.export')}
          </button>
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
                const varied = hasVariants(product);
                const summary = summarizeVariants(product);
                const switchedOff = (product.product_variants ?? []).filter((v) => !v.is_active).length;
                const restocking = varied && restockId === product.id;
                const range = priceRange(product);
                const colors = sellableColors(product);

                const draft = stockDrafts[product.id];
                const dirty = draft != null && draft.trim() !== String(product.stock_quantity);
                const out = product.stock_quantity <= 0;
                // A product with variants is "low" as soon as one of them is
                // low or gone — the total can look healthy while M is sold out.
                const low = !out && (varied
                  ? summary.low > 0 || summary.soldOut > 0
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
                      <td data-col="end" className="table__num">
                        {range.min === range.max ? formatCurrency(range.min) : `${formatCurrency(range.min)} – ${formatCurrency(range.max)}`}
                        {product.compare_at_price != null && product.compare_at_price > product.price && (
                          <span className="t-xs t-faint price-was" style={{ display: 'block' }}>
                            {formatCurrency(product.compare_at_price)}
                          </span>
                        )}
                      </td>
                      <td data-col="full">
                        {varied ? (
                          <div className="stack gap-2">
                            {summary.active.length === 0 ? (
                              <span className="t-xs t-faint">{t('admin.catalog.variants.noneOnSale')}</span>
                            ) : product.has_colors && product.has_sizes ? (
                              <div className="stack gap-1">
                                {colors.map((color) => (
                                  <div key={color.id} className="size-chips">
                                    <span className="size-chips__color">
                                      {color.swatch && <span className="swatch swatch--sm" style={{ background: color.swatch }} aria-hidden="true" />}
                                      {color.name}
                                    </span>
                                    {summary.active
                                      .filter((v) => v.color_id === color.id)
                                      .map((v) => chip(product, v, v.size ?? ''))}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="size-chips">
                                {summary.active.map((v) =>
                                  chip(product, v, v.size ?? colors.find((c) => c.id === v.color_id)?.name ?? '—'),
                                )}
                              </div>
                            )}
                            {switchedOff > 0 && (
                              <span className="t-xs t-faint">{tCount('admin.catalog.sizes.hiddenCount', switchedOff)}</span>
                            )}
                            <button
                              type="button"
                              className="btn btn--quiet btn--sm"
                              style={{ alignSelf: 'flex-start' }}
                              onClick={() => setRestockId(restocking ? null : product.id)}
                              aria-expanded={restocking}
                            >
                              {restocking ? t('admin.catalog.sizes.closeStock') : t('admin.catalog.variants.restock')}
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
                        ) : varied && summary.soldOut > 0 ? (
                          <StatusDot tone="caution" label={tCount('admin.catalog.variants.soldOut', summary.soldOut)} />
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
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm"
                            onClick={() => duplicateProduct(product)}
                            disabled={duplicate.isPending}
                            aria-label={t('admin.catalog.duplicate')}
                            title={t('admin.catalog.duplicate')}
                          >
                            <IconCopy size={14} />
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
                          <VariantStockPanel product={product} onClose={() => setRestockId(null)} />
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
      {importing && <ImportProductsDrawer products={products} onClose={() => setImporting(false)} />}
    </>
  );
}
