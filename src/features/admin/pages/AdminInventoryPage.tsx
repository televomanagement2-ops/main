import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Media } from '../../../components/ui/Media';
import { StatusDot } from '../../../components/ui/StatusIndicator';
import {
  useInventoryMovements,
  useLowStock,
  useRunStoreWorker,
  useStockRequests,
  useStoreSettings,
  useUpdateStoreSettings,
} from '../../../hooks/useInventory';
import { useAdminProducts } from '../../../hooks/useAdminProducts';
import { fetchAllInventoryMovements, AppError, type MovementFilters } from '../../../lib/api';
import { datedFilename, dialectForLocale, downloadCsv, toCsv } from '../../../lib/csv';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import { IconArrowLeft, IconArrowRight, IconDownload } from '../../../components/ui/icons';
import { MovementList } from '../components/MovementList';
import { VariantStockPanel } from '../components/VariantStockPanel';
import type { MovementReason } from '../../../types';

type Tab = 'low' | 'movements' | 'requests' | 'alerts';

const REASONS: MovementReason[] = ['sale', 'cancel', 'refund', 'return', 'exchange', 'manual', 'import', 'initial', 'other'];

const dayBound = (value: string, end: boolean) =>
  value ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`).toISOString() : undefined;

/**
 * Stock as a whole: what is running out (and who is waiting for it), every
 * movement and why, and the alerts the store sends about both.
 */
export function AdminInventoryPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('low');
  const lowStock = useLowStock();
  const requests = useStockRequests();

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'low', label: t('admin.inventory.tabs.low'), count: lowStock.data?.length },
    { id: 'movements', label: t('admin.inventory.tabs.movements') },
    { id: 'requests', label: t('admin.inventory.tabs.requests'), count: requests.data?.reduce((s, r) => s + r.waiting, 0) },
    { id: 'alerts', label: t('admin.inventory.tabs.alerts') },
  ];

  return (
    <>
      <header className="admin-page__head">
        <div>
          <p className="t-label">{t('admin.inventory.eyebrow')}</p>
          <h1 className="admin-page__title">{t('admin.inventory.title')}</h1>
          <p className="t-sm t-faint admin-page__desc">{t('admin.inventory.subtitle')}</p>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label={t('admin.inventory.title')}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.count != null && item.count > 0 && <span className="tab__count">{item.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'low' && <LowStockTab />}
      {tab === 'movements' && <MovementsTab />}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'alerts' && <AlertsTab />}
    </>
  );
}

function LowStockTab() {
  const { t } = useI18n();
  const { data: items = [], isLoading, error } = useLowStock();
  const { data: products = [] } = useAdminProducts();
  const [restockId, setRestockId] = useState<string | null>(null);

  if (isLoading) return <RowsSkeleton rows={6} />;
  if (error) return <ErrorMessage message={t('admin.inventory.loadError')} />;
  if (items.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{t('admin.inventory.low.emptyTitle')}</p>
        <p className="empty__body">{t('admin.inventory.low.empty')}</p>
      </div>
    );
  }

  const restockProduct = products.find((p) => p.id === restockId) ?? null;

  return (
    <div className="stack gap-5" style={{ marginTop: 'var(--s-6)' }}>
      {restockProduct && (
        <div className="order-panel">
          <p className="t-label">{t('admin.inventory.low.restockTitle', { name: restockProduct.name })}</p>
          <VariantStockPanel product={restockProduct} onClose={() => setRestockId(null)} />
        </div>
      )}
      <div className="table-wrap">
        <table className="table table--stack">
          <thead>
            <tr>
              <th>{t('admin.catalog.table.product')}</th>
              <th>{t('admin.inventory.movements.variant')}</th>
              <th className="table__num">{t('admin.inventory.low.stock')}</th>
              <th>{t('admin.catalog.table.status')}</th>
              <th className="table__num">{t('admin.inventory.low.waiting')}</th>
              <th className="table__actions">{t('admin.catalog.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const product = products.find((p) => p.id === item.product_id);
              const varied = Boolean(product && (product.has_sizes || product.has_colors));
              return (
                <tr key={`${item.product_id}-${item.variant_id ?? ''}`}>
                  <td data-col="meta">
                    <div className="row gap-3">
                      <Media src={item.image_url} alt="" ratio="square" className="thumb" style={{ width: 36, height: 36 }} />
                      <div style={{ minWidth: 0 }}>
                        <p className="table__primary">{item.product_name}</p>
                        {item.sku && <p className="t-xs t-faint t-mono">{item.sku}</p>}
                      </div>
                    </div>
                  </td>
                  <td data-col="full">{item.variant_label || '—'}</td>
                  <td data-col="end" className="table__num">
                    {item.stock}
                    <span className="t-xs t-faint"> / {item.threshold}</span>
                  </td>
                  <td data-col="full">
                    {item.stock <= 0 ? (
                      <StatusDot tone="critical" label={t('admin.catalog.outOfStock')} />
                    ) : (
                      <StatusDot tone="caution" label={t('admin.catalog.lowStock')} />
                    )}
                  </td>
                  <td data-col="end" className="table__num">{item.waiting > 0 ? item.waiting : '—'}</td>
                  <td data-col="end" className="table__actions">
                    {varied ? (
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setRestockId(item.product_id)}>
                        {t('admin.catalog.variants.restock')}
                      </button>
                    ) : (
                      <Link to="/admin/catalog" className="btn btn--quiet btn--sm">{t('admin.inventory.low.openCatalog')}</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovementsTab() {
  const { t, locale } = useI18n();
  const { data: products = [] } = useAdminProducts();
  const [productId, setProductId] = useState('');
  const [reason, setReason] = useState<MovementReason | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const filters: MovementFilters = {
    page,
    productId: productId || undefined,
    reason: reason || undefined,
    from: dayBound(from, false),
    to: dayBound(to, true),
  };
  const { data, isLoading, error } = useInventoryMovements(filters);
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.pageSize ?? 50)));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllInventoryMovements({ ...filters, page: undefined });
      const dialect = dialectForLocale(locale);
      downloadCsv(
        datedFilename('stock-movements'),
        toCsv(
          [
            ['date', 'product', 'variant', 'change', 'stock_after', 'reason', 'order', 'by', 'note'].map((c) =>
              t(`admin.inventory.csv.${c}`),
            ),
            ...rows.map((m) => [
              new Date(m.created_at).toLocaleString(locale),
              m.products?.name ?? '',
              m.variant_label ?? '',
              m.delta,
              m.stock_after,
              t(`admin.inventory.reason.${m.reason}`) + (m.detail ? ` (${t(`admin.inventory.detail.${m.detail}`)})` : ''),
              m.order_id ? m.order_id.slice(0, 8).toUpperCase() : '',
              m.profiles?.full_name || m.profiles?.email || '',
              m.note ?? '',
            ]),
          ],
          dialect,
        ),
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'critical');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="admin-toolbar" style={{ borderTop: 0 }}>
        <div className="admin-toolbar__group">
          <label className="t-label" htmlFor="mv-product">{t('admin.inventory.movements.product')}</label>
          <select
            id="mv-product"
            className="select select--sm"
            style={{ width: 'auto', maxWidth: 220 }}
            value={productId}
            onChange={(e) => { setProductId(e.target.value); setPage(1); }}
          >
            <option value="">{t('admin.inventory.movements.allProducts')}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="admin-toolbar__group">
          <label className="t-label" htmlFor="mv-reason">{t('admin.inventory.movements.reason')}</label>
          <select
            id="mv-reason"
            className="select select--sm"
            style={{ width: 'auto' }}
            value={reason}
            onChange={(e) => { setReason(e.target.value as MovementReason | ''); setPage(1); }}
          >
            <option value="">{t('admin.inventory.movements.allReasons')}</option>
            {REASONS.map((r) => <option key={r} value={r}>{t(`admin.inventory.reason.${r}`)}</option>)}
          </select>
        </div>
        <div className="admin-toolbar__group">
          <label className="t-label" htmlFor="mv-from">{t('admin.orders.from')}</label>
          <input id="mv-from" type="date" className="input input--sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <label className="t-label" htmlFor="mv-to">{t('admin.orders.to')}</label>
          <input id="mv-to" type="date" className="input input--sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => void exportCsv()} disabled={exporting}>
          <IconDownload size={14} />
          {t('admin.inventory.movements.export')}
        </button>
      </div>

      {isLoading ? (
        <RowsSkeleton rows={8} />
      ) : error ? (
        <ErrorMessage message={t('admin.inventory.loadError')} />
      ) : (data?.data.length ?? 0) === 0 ? (
        <div className="empty">
          <p className="empty__title">{t('admin.inventory.movements.emptyTitle')}</p>
          <p className="empty__body">{t('admin.inventory.movements.empty')}</p>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--s-6)' }}>
          <MovementList movements={data?.data ?? []} />
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pager" aria-label={t('products.paginationLabel')}>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn btn--secondary btn--sm">
            <IconArrowLeft size={14} />
            {t('products.prevPage')}
          </button>
          <span className="pager__info">{page} / {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn btn--secondary btn--sm">
            {t('products.nextPage')}
            <IconArrowRight size={14} />
          </button>
        </nav>
      )}
    </>
  );
}

function RequestsTab() {
  const { t, formatDate } = useI18n();
  const { data: rows = [], isLoading, error } = useStockRequests();
  const run = useRunStoreWorker();

  if (isLoading) return <RowsSkeleton rows={5} />;
  if (error) return <ErrorMessage message={t('admin.inventory.loadError')} />;

  const ready = rows.filter((r) => r.waiting > 0 && r.stock > 0).reduce((s, r) => s + r.waiting, 0);

  return (
    <div className="stack gap-5" style={{ marginTop: 'var(--s-6)' }}>
      <div className="row row--between gap-3 row--wrap">
        <p className="t-sm t-muted" style={{ maxWidth: '64ch' }}>{t('admin.inventory.requests.intro')}</p>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={run.isPending || ready === 0}
          onClick={() =>
            run.mutate('back_in_stock', {
              onSuccess: (result) => toast(t('admin.inventory.requests.sent', { count: result.backInStock?.sent ?? 0 })),
              onError: (err) => toast(err instanceof Error ? err.message : t('common.error'), 'critical'),
            })
          }
        >
          {t('admin.inventory.requests.sendNow', { count: ready })}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t('admin.inventory.requests.emptyTitle')}</p>
          <p className="empty__body">{t('admin.inventory.requests.empty')}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th>{t('admin.catalog.table.product')}</th>
                <th>{t('admin.inventory.movements.variant')}</th>
                <th className="table__num">{t('admin.inventory.requests.waiting')}</th>
                <th>{t('admin.inventory.requests.oldest')}</th>
                <th className="table__num">{t('admin.inventory.low.stock')}</th>
                <th className="table__num">{t('admin.inventory.requests.notified')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.product_id}-${row.variant_id ?? ''}`}>
                  <td data-col="meta" className="table__primary">{row.product_name}</td>
                  <td data-col="full">{row.variant_label || '—'}</td>
                  <td data-col="end" className="table__num">{row.waiting}</td>
                  <td data-col="full" className="t-sm">{row.oldest ? formatDate(new Date(row.oldest)) : '—'}</td>
                  <td data-col="end" className="table__num">{row.stock}</td>
                  <td data-col="end" className="table__num t-faint">{row.notified_30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AlertsTab() {
  const { t } = useI18n();
  const { data: settings, isLoading, error } = useStoreSettings();
  const update = useUpdateStoreSettings();
  const run = useRunStoreWorker();
  const [emails, setEmails] = useState<string | null>(null);

  if (isLoading) return <RowsSkeleton rows={3} />;
  if (error || !settings) return <ErrorMessage message={t('admin.inventory.loadError')} />;

  const emailText = emails ?? settings.alert_emails.join(', ');
  const save = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, {
      onSuccess: () => {
        setEmails(null);
        toast(t('admin.inventory.alerts.saved'));
      },
      onError: (err) =>
        toast(
          err instanceof AppError && err.code === 'invalid_email'
            ? t('admin.inventory.alerts.invalidEmail', { email: err.detail ?? '' })
            : err instanceof Error
              ? err.message
              : t('common.error'),
          'critical',
        ),
    });

  return (
    <div className="stack gap-6" style={{ marginTop: 'var(--s-6)', maxWidth: 640 }}>
      <div className="info-rows">
        <div className="info-row">
          <span>
            <strong style={{ display: 'block' }}>{t('admin.inventory.alerts.lowStock')}</strong>
            <span className="t-xs t-faint">{t('admin.inventory.alerts.lowStockHint')}</span>
          </span>
          <button
            type="button"
            className={`switch${settings.low_stock_alerts ? ' is-on' : ''}`}
            role="switch"
            aria-checked={settings.low_stock_alerts}
            aria-label={t('admin.inventory.alerts.lowStock')}
            onClick={() => save({ low_stock_alerts: !settings.low_stock_alerts })}
            disabled={update.isPending}
          />
        </div>
        <div className="info-row">
          <span>
            <strong style={{ display: 'block' }}>{t('admin.inventory.alerts.backInStock')}</strong>
            <span className="t-xs t-faint">{t('admin.inventory.alerts.backInStockHint')}</span>
          </span>
          <button
            type="button"
            className={`switch${settings.back_in_stock_enabled ? ' is-on' : ''}`}
            role="switch"
            aria-checked={settings.back_in_stock_enabled}
            aria-label={t('admin.inventory.alerts.backInStock')}
            onClick={() => save({ back_in_stock_enabled: !settings.back_in_stock_enabled })}
            disabled={update.isPending}
          />
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="alert-emails">{t('admin.inventory.alerts.recipients')}</label>
        <input
          id="alert-emails"
          className="input"
          value={emailText}
          onChange={(e) => setEmails(e.target.value)}
          placeholder={settings.admin_emails.join(', ')}
        />
        <p className="field__hint">{t('admin.inventory.alerts.recipientsHint')}</p>
        <div className="row gap-2" style={{ marginTop: 'var(--s-3)' }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={emails == null || update.isPending}
            onClick={() =>
              save({
                alert_emails: emailText
                  .split(/[,;\s]+/)
                  .map((e) => e.trim())
                  .filter(Boolean),
              })
            }
          >
            {t('admin.inventory.alerts.save')}
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            disabled={run.isPending}
            onClick={() =>
              run.mutate('low_stock', {
                onSuccess: (result) =>
                  toast(
                    result.lowStock?.skipped
                      ? t(`admin.inventory.alerts.skipped.${result.lowStock.skipped}`)
                      : t('admin.inventory.alerts.digestSent', { items: result.lowStock?.items ?? 0, sent: result.lowStock?.sent ?? 0 }),
                  ),
                onError: (err) => toast(err instanceof Error ? err.message : t('common.error'), 'critical'),
              })
            }
          >
            {t('admin.inventory.alerts.sendDigest')}
          </button>
        </div>
      </div>

      <p className="t-xs t-faint">{t('admin.inventory.alerts.schedule')}</p>
    </div>
  );
}
