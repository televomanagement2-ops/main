import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Drawer } from '../../../components/ui/Drawer';
import { OrderStatus as OrderStatusIndicator } from '../../../components/ui/StatusIndicator';
import { useAdminOrders, useRefundOrder } from '../../../hooks/useAdminOrders';
import { useAdminAnalytics } from '../../../hooks/useAdminAnalytics';
import { RevenueChart } from '../components/RevenueChart';
import { buildRevenueSeries, sumWindow, useChartTokens } from '../components/chartTheme';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import { IconAlert, IconArrowLeft, IconArrowRight } from '../../../components/ui/icons';
import type { Order, OrderStatus } from '../../../types';

const REFUNDABLE_STATUSES: OrderStatus[] = ['paid', 'shipped', 'delivered'];
const RANGES = [7, 30] as const;

function orderLabel(order: Order, fallback: string): string {
  const primary = order.order_items?.[0];
  if (primary) {
    const extra = Math.max((order.order_items?.length ?? 0) - 1, 0);
    return extra > 0 ? `${primary.product_name} +${extra}` : primary.product_name;
  }
  return order.profiles?.full_name || fallback;
}

export function AdminFinancePage() {
  const { t, tCount, formatCurrency, formatDate } = useI18n();
  const tokens = useChartTokens();

  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [refundStatusFilter, setRefundStatusFilter] = useState<OrderStatus>('paid');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Two-step confirmation: refunds move real money, so a single stray click
  // must never trigger one.
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useAdminAnalytics();
  const { data: ordersPage, isLoading: ordersLoading } = useAdminOrders({
    page,
    status: refundStatusFilter,
  });
  const refundMutation = useRefundOrder();

  const series = useMemo(
    () => buildRevenueSeries(analytics?.revenueByDay, 30, formatDate),
    [analytics?.revenueByDay, formatDate]
  );
  const visibleSeries = useMemo(() => series.slice(series.length - range), [series, range]);
  const periodTotal = sumWindow(series, range);
  const previousTotal = sumWindow(series, range, range);
  const delta = previousTotal > 0 ? ((periodTotal - previousTotal) / previousTotal) * 100 : periodTotal > 0 ? 100 : 0;
  const deltaTone = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';

  const revenueByStatus = useMemo(() => {
    return Object.entries(analytics?.revenueByStatus ?? {})
      .map(([status, value]) => ({
        status: status as OrderStatus,
        label: t(`status.${status}`),
        value: Math.round(Number(value ?? 0) * 100) / 100,
      }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [analytics, t]);

  const refundableOrders = useMemo(() => {
    const orders = (ordersPage?.data ?? []).filter((order) => !order.refund_id);
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      const haystack = [
        order.id,
        order.profiles?.email,
        order.profiles?.full_name,
        order.shipping_address?.full_name,
        ...(order.order_items?.map((item) => item.product_name) ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [ordersPage, search]);

  const totalPages = Math.max(1, Math.ceil((ordersPage?.count ?? 0) / (ordersPage?.pageSize ?? 50)));

  const handleConfirmRefund = (order: Order) => {
    refundMutation.mutate(
      { orderId: order.id },
      {
        onSuccess: () => {
          toast(t('admin.finance.refundSuccess', { name: orderLabel(order, t('admin.orders.customerFallback')) }));
          setConfirmOrder(null);
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : t('admin.finance.refundError'), 'critical');
          setConfirmOrder(null);
        },
      }
    );
  };

  if (analyticsLoading || ordersLoading) return <DashboardSkeleton />;

  if (analyticsError) {
    return (
      <div style={{ paddingTop: 'var(--s-10)' }}>
        <ErrorMessage message={t('admin.finance.loadError')} />
      </div>
    );
  }

  return (
    <>
      <header className="admin-page__head">
        <div>
          <p className="t-label">{t('admin.finance.eyebrow')}</p>
          <h1 className="admin-page__title">{t('admin.finance.title')}</h1>
          <p className="t-sm t-faint admin-page__desc">{t('admin.finance.subtitle')}</p>
        </div>
      </header>

      {/* ── Revenue ── */}
      <section className="dash-hero">
        <div className="dash-hero__primary">
          <div className="chart__head">
            <div>
              <p className="t-label">{t('admin.finance.revenueSnapshot')}</p>
              <div className="metric__row" style={{ marginTop: 'var(--s-3)' }}>
                <span className="metric__value">{formatCurrency(periodTotal)}</span>
                <span className={`metric__delta metric__delta--${deltaTone}`}>
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)}%
                  <span className="t-faint"> {t('admin.dashboard.vsPrevious', { days: range })}</span>
                </span>
              </div>
              <p className="t-xs t-faint" style={{ marginTop: 'var(--s-2)' }}>
                {t('admin.finance.lifetime', { amount: formatCurrency(analytics?.grossRevenue ?? 0) })}
              </p>
            </div>
            <div className="chart__ranges" role="group" aria-label={t('admin.dashboard.range')}>
              {RANGES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chart__range${range === value ? ' is-active' : ''}`}
                  onClick={() => setRange(value)}
                  aria-pressed={range === value}
                >
                  {t('admin.dashboard.lastDays', { days: value })}
                </button>
              ))}
            </div>
          </div>

          <RevenueChart data={visibleSeries} height={260} />
        </div>

        <div className="dash-hero__secondary">
          <div className="metric-row">
            <div>
              <p className="metric-row__label">{t('admin.dashboard.orders24h')}</p>
              <p className="metric-row__meta">{t('admin.dashboard.orders24hHint')}</p>
            </div>
            <p className="metric-row__value">{analytics?.orders24h ?? 0}</p>
          </div>
          <div className="metric-row">
            <div>
              <p className="metric-row__label">{t('admin.dashboard.orders7d')}</p>
              <p className="metric-row__meta">{t('admin.dashboard.orders7dHint')}</p>
            </div>
            <p className="metric-row__value">{analytics?.orders7d ?? 0}</p>
          </div>
          <div className="metric-row">
            <div>
              <p className="metric-row__label">{t('admin.finance.refundedOrders')}</p>
              <p className="metric-row__meta">{t('admin.finance.refundedOrdersMeta')}</p>
            </div>
            <p className="metric-row__value">{analytics?.statusCounts.refunded ?? 0}</p>
          </div>
        </div>
      </section>

      {/* ── Revenue by status ── */}
      <section className="admin-section" style={{ marginTop: 'clamp(32px, 4vw, 56px)' }}>
        <div className="admin-section__head">
          <div>
            <h2 className="admin-section__title">{t('admin.finance.byOrderStatus')}</h2>
            <p className="t-xs t-faint">{t('admin.finance.revenueStatuses')}</p>
          </div>
        </div>

        {revenueByStatus.length === 0 ? (
          <p className="t-sm t-faint">{t('admin.orders.empty')}</p>
        ) : (
          <div className="admin-split">
            <div className="chart">
              <ResponsiveContainer width="100%" height={Math.max(160, revenueByStatus.length * 44)}>
                <BarChart
                  data={revenueByStatus}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                  barSize={14}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={110}
                    tick={{ fontSize: 12, fill: tokens.axis }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: tokens.fill }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="chart-tooltip">
                          <p className="chart-tooltip__label">{label}</p>
                          <p className="chart-tooltip__value">{formatCurrency(Number(payload[0].value))}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                    {revenueByStatus.map((entry, index) => (
                      <Cell key={entry.status} fill={tokens.series[index % tokens.series.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="admin-split__aside">
              <div className="chart-legend">
                {revenueByStatus.map((entry, index) => (
                  <div key={entry.status} className="chart-legend__row">
                    <span
                      className="chart-legend__swatch"
                      style={{ background: tokens.series[index % tokens.series.length] }}
                    />
                    <span>{entry.label}</span>
                    <span className="chart-legend__value">{formatCurrency(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Refund queue ── */}
      <section className="admin-section" style={{ marginTop: 'clamp(32px, 4vw, 56px)' }}>
        <div className="admin-section__head">
          <div>
            <h2 className="admin-section__title">{t('admin.finance.refundQueue')}</h2>
            <p className="t-xs t-faint">{t('admin.finance.fullRefundsOnly')}</p>
          </div>
        </div>

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
            <label className="t-label" htmlFor="refund-status">{t('admin.orders.statusLabel')}</label>
            <select
              id="refund-status"
              className="select select--sm"
              style={{ width: 'auto', minWidth: 140 }}
              value={refundStatusFilter}
              onChange={(event) => {
                setRefundStatusFilter(event.target.value as OrderStatus);
                setPage(1);
              }}
            >
              {REFUNDABLE_STATUSES.map((status) => (
                <option key={status} value={status}>{t(`status.${status}`)}</option>
              ))}
            </select>
          </div>
          <span className="admin-toolbar__count">
            {tCount('admin.orders.count', refundableOrders.length)}
          </span>
        </div>

        {refundableOrders.length === 0 ? (
          <div className="empty">
            <p className="empty__title">{t('admin.finance.emptyTitle')}</p>
            <p className="empty__body">{t('admin.orders.empty')}</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 'var(--s-6)' }}>
            <table className="table table--stack">
              <thead>
                <tr>
                  <th>{t('admin.orders.table.order')}</th>
                  <th>{t('admin.orders.table.customer')}</th>
                  <th>{t('admin.orders.table.status')}</th>
                  <th>{t('admin.orders.table.date')}</th>
                  <th className="table__num">{t('admin.orders.table.total')}</th>
                  <th className="table__actions">{t('admin.catalog.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {refundableOrders.map((order) => (
                  <tr key={order.id}>
                    <td data-col="meta">
                      <p className="table__primary">{orderLabel(order, t('admin.orders.customerFallback'))}</p>
                      <p className="t-xs t-faint t-mono">{order.id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td data-col="full">
                      {order.profiles?.full_name
                        || order.shipping_address?.full_name
                        || order.profiles?.email
                        || t('admin.orders.customerFallback')}
                    </td>
                    <td data-col="full"><OrderStatusIndicator status={order.status} /></td>
                    <td data-col="full">{formatDate(new Date(order.created_at))}</td>
                    <td data-col="end" className="table__num">{formatCurrency(order.total)}</td>
                    <td data-col="end" className="table__actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setConfirmOrder(order)}
                        disabled={refundMutation.isPending}
                      >
                        {t('admin.finance.refund')}
                      </button>
                    </td>
                  </tr>
                ))}
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
      </section>

      <Drawer
        open={Boolean(confirmOrder)}
        onClose={() => setConfirmOrder(null)}
        eyebrow={t('admin.finance.refundQueue')}
        title={t('admin.finance.confirmRefundTitle')}
        closeLabel={t('common.close')}
        footer={
          confirmOrder ? (
            <div className="row gap-3" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setConfirmOrder(null)}
                disabled={refundMutation.isPending}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--critical"
                onClick={() => handleConfirmRefund(confirmOrder)}
                disabled={refundMutation.isPending}
              >
                {refundMutation.isPending ? `${t('admin.finance.refund')}…` : t('admin.finance.confirmRefundYes')}
              </button>
            </div>
          ) : undefined
        }
      >
        {confirmOrder && (
          <div className="stack gap-5">
            <div className="notice notice--critical">
              <IconAlert size={15} />
              <div className="notice__body">{t('admin.finance.refundWarning')}</div>
            </div>

            <p className="t-sm t-muted">
              {t('admin.finance.confirmRefundBody', {
                amount: formatCurrency(confirmOrder.total),
                customer:
                  confirmOrder.profiles?.full_name
                  || confirmOrder.shipping_address?.full_name
                  || confirmOrder.profiles?.email
                  || orderLabel(confirmOrder, t('admin.orders.customerFallback')),
              })}
            </p>

            <div className="info-rows">
              <div className="info-row">
                <span>{t('admin.orders.table.order')}</span>
                <strong className="t-mono">{confirmOrder.id.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div className="info-row">
                <span>{t('admin.orders.table.status')}</span>
                <OrderStatusIndicator status={confirmOrder.status} />
              </div>
              <div className="info-row">
                <span>{t('admin.orders.orderTotal')}</span>
                <strong>{formatCurrency(confirmOrder.total)}</strong>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
