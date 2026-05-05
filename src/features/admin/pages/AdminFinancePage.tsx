import { useMemo } from 'react';
import {
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Spinner } from '../../../components/ui/Spinner';
import { useAdminOrders } from '../../../hooks/useAdminOrders';
import { useI18n } from '../../../lib/i18n';
import type { Order } from '../../../types';

const REFUNDABLE_STATUSES: Order['status'][] = ['paid', 'shipped', 'delivered'];
const REVENUE_STATUSES: Order['status'][] = ['paid', 'shipped', 'delivered'];
const STATUS_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#6b7280', '#8b5cf6', '#14b8a6', '#f97316'];
export function AdminFinancePage() {
  const { data: orders = [], isLoading, error } = useAdminOrders();
  const { t, formatCurrency, formatDate } = useI18n();

  const statusLabels = useMemo<Record<Order['status'], string>>(() => ({
    pending: t('status.pending'),
    processing: t('status.processing'),
    requires_action: t('status.requires_action'),
    paid: t('status.paid'),
    failed: t('status.failed'),
    cancelled: t('status.cancelled'),
    shipped: t('status.shipped'),
    delivered: t('status.delivered'),
  }), [t]);

  const refundableOrders = useMemo(
    () => orders.filter((order) => REFUNDABLE_STATUSES.includes(order.status)).slice(0, 8),
    [orders]
  );

  const revenueTrend = useMemo(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const buckets = new Map<string, number>();
    orders.forEach((order) => {
      if (!REVENUE_STATUSES.includes(order.status)) return;
      const created = new Date(order.created_at);
      if (created < start) return;
      const key = new Date(created.getFullYear(), created.getMonth(), created.getDate())
        .toISOString();
      buckets.set(key, (buckets.get(key) ?? 0) + Number(order.total));
    });

    const days = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString();
      return {
        date: formatDate(date, { month: 'short', day: 'numeric' }),
        revenue: Math.round((buckets.get(key) ?? 0) * 100) / 100,
      };
    });

    return days;
  }, [orders, formatDate]);

  const revenueByStatus = useMemo(() => {
    const totals = new Map<Order['status'], number>();
    orders.forEach((order) => {
      const total = REVENUE_STATUSES.includes(order.status) ? Number(order.total) : 0;
      totals.set(order.status, (totals.get(order.status) ?? 0) + total);
    });

    return Object.entries(statusLabels)
      .map(([status, label]) => ({
        status: status as Order['status'],
        label,
        value: Math.round((totals.get(status as Order['status']) ?? 0) * 100) / 100,
      }))
      .filter((entry) => entry.value > 0);
  }, [orders, statusLabels]);

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="card card-padded" style={{ textAlign: 'center' }}>
        <p className="body" style={{ color: 'var(--color-danger)' }}>
          {t('admin.finance.loadError')}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-orders-toolbar">
        <div>
          <span className="section-eyebrow">{t('admin.finance.eyebrow')}</span>
          <h2 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>
            {t('admin.finance.title')}
          </h2>
        </div>
      </div>

      <div className="admin-grid-split">
        <section className="card card-padded admin-panel">
          <p className="label-caps">{t('admin.finance.refundCenter')}</p>
          <h3 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>
            {t('admin.finance.refundTitle')}
          </h3>
          <p className="body" style={{ marginTop: 'var(--sp-3)' }}>
            {t('admin.finance.refundNote')}
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--sp-4)' }} disabled>
            {t('admin.finance.refundCta')}
          </button>
        </section>

        <section className="card card-padded admin-panel admin-panel--accent">
          <p className="label-caps">{t('admin.finance.revenueSnapshot')}</p>
          <h3 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>
            {t('admin.finance.last30Days')}
          </h3>
          <div className="admin-chart" style={{ marginTop: 'var(--sp-4)' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueTrend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={5} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), t('admin.finance.revenueLabel')]}
                  labelFormatter={(label) => t('admin.finance.dateLabel', { date: label })}
                />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card card-padded admin-panel" style={{ marginTop: 'var(--sp-6)' }}>
        <div className="admin-panel__head">
          <div>
            <p className="label-caps">{t('admin.finance.revenueDistribution')}</p>
            <h3 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>
              {t('admin.finance.byOrderStatus')}
            </h3>
          </div>
          <span className="caption">{t('admin.finance.revenueStatuses')}</span>
        </div>
        <div className="admin-chart admin-chart--split">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={revenueByStatus}
                dataKey="value"
                nameKey="label"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {revenueByStatus.map((entry, index) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props: { payload?: { label?: string } }) => {
                  const total = revenueByStatus.reduce((sum, item) => sum + item.value, 0);
                  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
                  return [`${formatCurrency(value)} (${percent}%)`, props.payload?.label ?? name];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="admin-chart-legend">
            {revenueByStatus.map((entry, index) => (
              <div key={entry.status} className="admin-chart-legend__row">
                <span className="admin-chart-legend__dot" style={{ background: STATUS_COLORS[index % STATUS_COLORS.length] }} />
                <span>{entry.label}</span>
                <strong>{formatCurrency(entry.value)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card card-padded admin-panel" style={{ marginTop: 'var(--sp-6)' }}>
        <div className="admin-panel__head">
          <div>
            <p className="label-caps">{t('admin.finance.refundQueue')}</p>
            <h3 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>
              {t('admin.finance.recentPaidOrders')}
            </h3>
          </div>
          <span className="caption">{t('admin.finance.fullRefundsOnly')}</span>
        </div>
        <div className="admin-refund-list">
          {refundableOrders.map((order) => (
            <div key={order.id} className="admin-refund-item">
              <div>
                <p className="admin-refund-item__id">#{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="caption">
                  {formatDate(new Date(order.created_at), { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="admin-refund-item__amount">{formatCurrency(order.total)}</p>
                <p className="caption">{statusLabels[order.status]}</p>
              </div>
              <button className="btn btn-ghost btn-sm" disabled>
                {t('admin.finance.refund')}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
