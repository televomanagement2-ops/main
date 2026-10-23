import { useMemo, useState } from 'react';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Drawer } from '../../../components/ui/Drawer';
import { Media } from '../../../components/ui/Media';
import { OrderStatus as OrderStatusIndicator } from '../../../components/ui/StatusIndicator';
import { useAdminOrders } from '../../../hooks/useAdminOrders';
import { fetchAllAdminOrders, type AdminOrdersFilters } from '../../../lib/api';
import { datedFilename, dialectForLocale, downloadCsv, toCsv } from '../../../lib/csv';
import { LINE_COLUMNS, ORDER_COLUMNS, orderLinesToCsvRows, ordersToCsvRows } from '../../../lib/orderCsv';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronRight,
  IconDownload,
  IconPrinter,
} from '../../../components/ui/icons';
import { OrderDetailPanel } from '../components/OrderDetailPanel';
import { openPrint } from '../../../lib/printDocuments';
import type { OrderStatus } from '../../../types';

type StatusFilter = 'all' | OrderStatus;

/** 'YYYY-MM-DD' (a date input) → the start or end of that day, as ISO. */
const dayBound = (value: string, end: boolean) =>
  value ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`).toISOString() : undefined;

export function AdminOrdersPage() {
  const { t, tCount, formatCurrency, formatDate, locale } = useI18n();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const filters: AdminOrdersFilters = {
    status: statusFilter === 'all' ? undefined : statusFilter,
    needsReviewOnly: needsReviewOnly || undefined,
    from: dayBound(from, false),
    to: dayBound(to, true),
  };
  const { data, isLoading, error } = useAdminOrders({ ...filters, page });

  const orders = useMemo(() => data?.data ?? [], [data]);
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.pageSize ?? 50)));

  // Search stays client-side within the fetched page.
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      const haystack = [
        order.id,
        order.profiles?.email,
        order.profiles?.full_name,
        order.shipping_address?.full_name,
        order.discount_code,
        order.tracking_id,
        order.invoice_number,
        ...(order.order_items?.flatMap((item) => [item.product_name, item.sku]) ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [orders, search]);

  const openOrder = orders.find((order) => order.id === openOrderId) ?? null;
  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selected.has(o.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredOrders.forEach((o) => next.delete(o.id));
      else filteredOrders.forEach((o) => next.add(o.id));
      return next;
    });

  const exportCsv = async (shape: 'orders' | 'lines') => {
    setExporting(true);
    try {
      const rows = selected.size > 0
        ? await fetchAllAdminOrders({ ids: [...selected] })
        : await fetchAllAdminOrders(filters);
      const dialect = dialectForLocale(locale);
      const columns = shape === 'orders' ? ORDER_COLUMNS : LINE_COLUMNS;
      const options = {
        dialect,
        headings: Object.fromEntries(columns.map((c) => [c, t(`admin.orders.csv.${c}`)])),
        statusLabel: (status: OrderStatus) => t(`status.${status}`),
        formatDate: (iso: string) => new Date(iso).toLocaleString(locale),
      };
      const table = shape === 'orders' ? ordersToCsvRows(rows, options) : orderLinesToCsvRows(rows, options);
      downloadCsv(datedFilename(shape === 'orders' ? 'orders' : 'order-lines'), toCsv(table, dialect));
      toast(tCount('admin.orders.exported', rows.length));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'critical');
    } finally {
      setExporting(false);
    }
  };

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('admin.orders.filterAll') },
    ...(
      ['paid', 'processing', 'requires_action', 'shipped', 'delivered', 'cancelled', 'failed', 'refunded', 'pending'] as OrderStatus[]
    ).map((status) => ({ value: status, label: t(`status.${status}`) })),
  ];

  if (isLoading) {
    return (
      <>
        <header className="admin-page__head">
          <div>
            <p className="t-label">{t('admin.orders.eyebrow')}</p>
            <h1 className="admin-page__title">{t('admin.orders.title')}</h1>
          </div>
        </header>
        <RowsSkeleton rows={8} />
      </>
    );
  }

  if (error) {
    return (
      <div style={{ paddingTop: 'var(--s-10)' }}>
        <ErrorMessage message={t('admin.orders.loadError')} />
      </div>
    );
  }

  return (
    <>
      <header className="admin-page__head">
        <div>
          <p className="t-label">{t('admin.orders.eyebrow')}</p>
          <h1 className="admin-page__title">{t('admin.orders.title')}</h1>
          <p className="t-sm t-faint admin-page__desc">{t('admin.orders.subtitle')}</p>
        </div>
        <div className="admin-page__actions">
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => void exportCsv('orders')} disabled={exporting}>
            <IconDownload size={14} />
            {t('admin.orders.exportOrders')}
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => void exportCsv('lines')} disabled={exporting}>
            <IconDownload size={14} />
            {t('admin.orders.exportLines')}
          </button>
        </div>
      </header>

      <div className="admin-toolbar">
        <input
          type="search"
          className="input input--sm admin-toolbar__search"
          placeholder={t('admin.orders.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t('admin.orders.searchLabel')}
        />

        <div className="admin-toolbar__group">
          <label className="t-label" htmlFor="order-status">{t('admin.orders.statusLabel')}</label>
          <select
            id="order-status"
            className="select select--sm"
            style={{ width: 'auto', minWidth: 150 }}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="admin-toolbar__group">
          <label className="t-label" htmlFor="order-from">{t('admin.orders.from')}</label>
          <input
            id="order-from"
            type="date"
            className="input input--sm"
            value={from}
            onChange={(event) => { setFrom(event.target.value); setPage(1); }}
          />
          <label className="t-label" htmlFor="order-to">{t('admin.orders.to')}</label>
          <input
            id="order-to"
            type="date"
            className="input input--sm"
            value={to}
            onChange={(event) => { setTo(event.target.value); setPage(1); }}
          />
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={needsReviewOnly}
            onChange={(event) => {
              setNeedsReviewOnly(event.target.checked);
              setPage(1);
            }}
          />
          {t('admin.orders.filterNeedsReview')}
        </label>

        <span className="admin-toolbar__count">
          {tCount('admin.orders.count', data?.count ?? filteredOrders.length)}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label={t('admin.orders.bulk.label')}>
          <span className="t-sm">{tCount('admin.orders.bulk.selected', selected.size)}</span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => openPrint([...selected], 'packing')}>
            <IconPrinter size={14} />
            {t('admin.orders.print.packing')}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => openPrint([...selected], 'invoice')}>
            <IconPrinter size={14} />
            {t('admin.orders.print.invoice')}
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setSelected(new Set())}>
            {t('admin.orders.bulk.clear')}
          </button>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t('admin.orders.emptyTitle')}</p>
          <p className="empty__body">{t('admin.orders.empty')}</p>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 'var(--s-6)' }}>
          <table className="table table--clickable table--stack">
            <thead>
              <tr>
                <th className="table__select">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label={t('admin.orders.bulk.all')}
                  />
                </th>
                <th>{t('admin.orders.table.order')}</th>
                <th>{t('admin.orders.table.customer')}</th>
                <th>{t('admin.orders.table.status')}</th>
                <th>{t('admin.orders.table.date')}</th>
                <th className="table__num">{t('admin.orders.table.total')}</th>
                <th aria-label={t('admin.orders.table.open')} />
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const primaryItem = order.order_items?.[0] ?? null;
                const extra = Math.max((order.order_items?.length ?? 0) - 1, 0);
                const refunded = Number(order.refund_amount ?? 0);
                return (
                  <tr
                    key={order.id}
                    onClick={() => setOpenOrderId(order.id)}
                    className={openOrderId === order.id ? 'is-selected' : undefined}
                  >
                    <td data-col="end" className="table__select" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggle(order.id)}
                        aria-label={t('admin.orders.bulk.one', { id: order.id.slice(0, 8).toUpperCase() })}
                      />
                    </td>
                    <td data-col="meta">
                      <div className="row gap-3">
                        <Media
                          src={primaryItem?.product_image}
                          alt=""
                          ratio="square"
                          className="thumb"
                          style={{ width: 40, height: 40 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <p className="table__primary">
                            {primaryItem?.product_name ?? order.id.slice(0, 8).toUpperCase()}
                            {extra > 0 && <span className="t-faint"> +{extra}</span>}
                          </p>
                          <p className="t-xs t-faint t-mono">
                            {order.id.slice(0, 8).toUpperCase()}
                            {order.invoice_number && ` · ${order.invoice_number}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-col="full">
                      {order.profiles?.full_name
                        || order.shipping_address?.full_name
                        || t('admin.orders.customerFallback')}
                      <span className="t-xs t-faint" style={{ display: 'block' }}>
                        {order.profiles?.email ?? t('admin.orders.emailUnavailable')}
                      </span>
                    </td>
                    <td data-col="full">
                      <div className="row gap-3 row--wrap">
                        <OrderStatusIndicator status={order.status} />
                        {refunded > 0 && order.status !== 'refunded' && (
                          <span className="status status--neutral">{t('admin.orders.partiallyRefunded')}</span>
                        )}
                        {order.needs_review && (
                          <span className="status status--critical">{t('admin.orders.needsReview')}</span>
                        )}
                        {order.discount_code && <span className="code-chip">{order.discount_code}</span>}
                      </div>
                    </td>
                    <td data-col="full">{formatDate(new Date(order.created_at))}</td>
                    <td data-col="end" className="table__num">{formatCurrency(order.total)}</td>
                    <td data-col="end" className="table__actions">
                      <IconChevronRight size={15} className="t-faint" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pager" aria-label={t('products.paginationLabel')}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn btn--secondary btn--sm"
          >
            <IconArrowLeft size={14} />
            {t('products.prevPage')}
          </button>
          <span className="pager__info">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn btn--secondary btn--sm"
          >
            {t('products.nextPage')}
            <IconArrowRight size={14} />
          </button>
        </nav>
      )}

      <Drawer
        open={Boolean(openOrder)}
        onClose={() => setOpenOrderId(null)}
        wide
        flush
        eyebrow={t('admin.orders.drawerEyebrow')}
        title={openOrder ? `#${openOrder.id.slice(0, 8).toUpperCase()}` : ''}
        closeLabel={t('common.close')}
      >
        {openOrder && <OrderDetailPanel key={openOrder.id} order={openOrder} />}
      </Drawer>
    </>
  );
}
