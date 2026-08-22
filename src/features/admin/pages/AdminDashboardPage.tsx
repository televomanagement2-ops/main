import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAnalytics } from '../../../hooks/useAdminAnalytics';
import { useAdminOrders } from '../../../hooks/useAdminOrders';
import { DashboardSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { OrderStatus as OrderStatusIndicator } from '../../../components/ui/StatusIndicator';
import { RevenueChart } from '../components/RevenueChart';
import { buildRevenueSeries, sumWindow, useChartTokens } from '../components/chartTheme';
import { IconArrowUpRight } from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import type { OrderStatus } from '../../../types';

const RANGES = [7, 30] as const;

export function AdminDashboardPage() {
  const { data, isLoading, error } = useAdminAnalytics();
  const { data: ordersPage } = useAdminOrders({ page: 1 });
  const { t, formatCurrency, formatDate } = useI18n();
  const tokens = useChartTokens();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const series = useMemo(
    () => buildRevenueSeries(data?.revenueByDay, 30, formatDate),
    [data?.revenueByDay, formatDate]
  );
  const visibleSeries = useMemo(() => series.slice(series.length - range), [series, range]);

  const current = sumWindow(series, range);
  const previous = sumWindow(series, range, range);
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const deltaTone = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';

  if (isLoading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div style={{ paddingTop: 'var(--s-10)' }}>
        <ErrorMessage message={t('admin.dashboard.loadError')} />
      </div>
    );
  }

  const statusEntries = (Object.entries(data.statusCounts) as [OrderStatus, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const statusTotal = statusEntries.reduce((sum, [, count]) => sum + count, 0);

  const awaitingPayment =
    data.statusCounts.pending + data.statusCounts.processing + data.statusCounts.requires_action;
  const recentOrders = (ordersPage?.data ?? []).slice(0, 6);

  return (
    <>
      <header className="admin-page__head">
        <div>
          <p className="t-label">{t('admin.eyebrow')}</p>
          <h1 className="admin-page__title">{t('admin.dashboard.title')}</h1>
          <p className="t-sm t-faint admin-page__desc">{t('admin.dashboard.subtitle')}</p>
        </div>
        <div className="admin-page__actions">
          <Link to="/admin/orders" className="btn btn--secondary btn--sm">
            {t('admin.dashboard.reviewOrders')}
          </Link>
          <Link to="/admin/catalog" className="btn btn--primary btn--sm">
            {t('admin.dashboard.manageCatalog')}
          </Link>
        </div>
      </header>

      {/* ── Revenue leads; everything else supports it ── */}
      <section className="dash-hero">
        <div className="dash-hero__primary">
          <div className="chart__head">
            <div>
              <p className="t-label">{t('admin.dashboard.grossRevenue')}</p>
              <div className="metric__row" style={{ marginTop: 'var(--s-3)' }}>
                <span className="metric__value">{formatCurrency(data.grossRevenue)}</span>
                <span className={`metric__delta metric__delta--${deltaTone}`}>
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)}%
                  <span className="t-faint"> {t('admin.dashboard.vsPrevious', { days: range })}</span>
                </span>
              </div>
              <p className="t-xs t-faint" style={{ marginTop: 'var(--s-2)' }}>
                {t('admin.dashboard.periodRevenue', {
                  amount: formatCurrency(current),
                  days: range,
                })}
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
            <p className="metric-row__value">{data.orders24h}</p>
          </div>
          <div className="metric-row">
            <div>
              <p className="metric-row__label">{t('admin.dashboard.orders7d')}</p>
              <p className="metric-row__meta">{t('admin.dashboard.orders7dHint')}</p>
            </div>
            <p className="metric-row__value">{data.orders7d}</p>
          </div>
          <div className="metric-row">
            <div>
              <p className="metric-row__label">{t('admin.dashboard.needsReview')}</p>
              <p className="metric-row__meta">{t('admin.dashboard.needsReviewHint')}</p>
            </div>
            <p
              className="metric-row__value"
              style={data.needsReview > 0 ? { color: 'var(--critical)' } : undefined}
            >
              {data.needsReview}
            </p>
          </div>
          <div className="metric-row">
            <div style={{ minWidth: 0 }}>
              <p className="metric-row__label">{t('admin.dashboard.bestSeller')}</p>
              <p className="metric-row__meta">
                {data.bestSeller
                  ? t('admin.dashboard.bestSellerUnits', { count: data.bestSeller.quantity })
                  : t('admin.dashboard.bestSellerAwaiting')}
              </p>
            </div>
            <p className="t-sm" style={{ color: 'var(--ink)', textAlign: 'right', maxWidth: '14ch' }}>
              {data.bestSeller ? data.bestSeller.productName : t('admin.dashboard.bestSellerNone')}
            </p>
          </div>
        </div>
      </section>

      {/* ── Operational counters ── */}
      <section className="admin-section" style={{ marginTop: 'clamp(32px, 4vw, 56px)' }}>
        <div className="kpi-strip">
          <div className="kpi">
            <p className="t-label">{t('admin.dashboard.openPayments')}</p>
            <p className="kpi__value">{awaitingPayment}</p>
            <p className="kpi__meta">{t('admin.dashboard.openPaymentsMeta')}</p>
          </div>
          <div className="kpi">
            <p className="t-label">{t('admin.dashboard.awaitingFulfilment')}</p>
            <p className="kpi__value">{data.statusCounts.paid}</p>
            <p className="kpi__meta">{t('admin.dashboard.awaitingFulfilmentMeta')}</p>
          </div>
          <div className="kpi">
            <p className="t-label">{t('admin.dashboard.inTransit')}</p>
            <p className="kpi__value">{data.statusCounts.shipped}</p>
            <p className="kpi__meta">{t('admin.dashboard.inTransitMeta')}</p>
          </div>
          <div className="kpi">
            <p className="t-label">{t('admin.dashboard.completed')}</p>
            <p className="kpi__value">{data.statusCounts.delivered}</p>
            <p className="kpi__meta">{t('admin.dashboard.completedMeta')}</p>
          </div>
        </div>
      </section>

      {/* ── Recent orders + distribution ── */}
      <section className="admin-section" style={{ marginTop: 'clamp(32px, 4vw, 56px)' }}>
        <div className="admin-split">
          <div>
            <div className="admin-section__head" style={{ marginBottom: 'var(--s-4)' }}>
              <h2 className="admin-section__title">{t('admin.dashboard.recentOrders')}</h2>
              <Link to="/admin/orders" className="link-arrow link-arrow--bare">
                {t('admin.dashboard.allOrders')}
                <IconArrowUpRight size={13} />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <p className="t-sm t-faint">{t('admin.orders.empty')}</p>
            ) : (
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th>{t('admin.orders.table.order')}</th>
                      <th>{t('admin.orders.table.customer')}</th>
                      <th>{t('admin.orders.table.status')}</th>
                      <th>{t('admin.orders.table.date')}</th>
                      <th className="table__num">{t('admin.orders.table.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td data-col="meta" className="table__primary">
                          {order.order_items?.[0]?.product_name ?? order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td data-col="full">
                          {order.profiles?.full_name
                            || order.shipping_address?.full_name
                            || t('admin.orders.customerFallback')}
                        </td>
                        <td data-col="full">
                          <OrderStatusIndicator status={order.status} />
                        </td>
                        <td data-col="full">{formatDate(new Date(order.created_at))}</td>
                        <td data-col="end" className="table__num">{formatCurrency(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-split__aside">
            <h2 className="admin-section__title" style={{ marginBottom: 'var(--s-4)' }}>
              {t('admin.dashboard.distribution')}
            </h2>

            {statusTotal === 0 ? (
              <p className="t-sm t-faint">{t('admin.orders.empty')}</p>
            ) : (
              <div className="distribution">
                <div
                  className="distribution__bar"
                  role="img"
                  aria-label={t('admin.dashboard.distribution')}
                >
                  {statusEntries.map(([status, count], index) => (
                    <span
                      key={status}
                      className="distribution__seg"
                      style={{
                        flexGrow: count,
                        background: tokens.series[index % tokens.series.length],
                      }}
                    />
                  ))}
                </div>

                <div className="chart-legend">
                  {statusEntries.map(([status, count], index) => (
                    <div key={status} className="chart-legend__row">
                      <span
                        className="chart-legend__swatch"
                        style={{ background: tokens.series[index % tokens.series.length] }}
                      />
                      <span>{t(`status.${status}`)}</span>
                      <span className="chart-legend__value">
                        {count} · {Math.round((count / statusTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
