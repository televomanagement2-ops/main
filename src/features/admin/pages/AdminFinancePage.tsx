import { useMemo, useState, useEffect } from 'react';
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
import { useAdminOrders, useRefundOrder } from '../../../hooks/useAdminOrders';
import { useAdminAnalytics } from '../../../hooks/useAdminAnalytics';
import { useI18n } from '../../../lib/i18n';
import type { Order, OrderStatus } from '../../../types';

// Helper: get order display name (product or customer name)
function getOrderDisplayName(order: Order): string {
  const primaryItem = order.order_items?.[0];
  if (primaryItem) {
    const extraItems = Math.max((order.order_items?.length ?? 0) - 1, 0);
    return extraItems > 0
      ? `${primaryItem.product_name} +${extraItems}`
      : primaryItem.product_name;
  }
  return order.profiles?.full_name || `Order ${order.id.slice(0, 8).toUpperCase()}`;
}

const REFUNDABLE_STATUSES: OrderStatus[] = ['paid', 'shipped', 'delivered'];
const STATUS_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#6b7280', '#8b5cf6', '#14b8a6', '#f97316'];

export function AdminFinancePage() {
  const { t, formatCurrency, formatDate } = useI18n();
  const [refundStatusFilter, setRefundStatusFilter] = useState<OrderStatus>('paid');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Two-step confirmation: refunds move real money, so a single stray click
  // must never trigger one.
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useAdminAnalytics();
  const { data: ordersPage, isLoading: ordersLoading } = useAdminOrders({
    page,
    status: refundStatusFilter,
  });
  const refundMutation = useRefundOrder();

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  const statusLabels = useMemo<Record<Order['status'], string>>(() => ({
    pending: t('status.pending'),
    processing: t('status.processing'),
    requires_action: t('status.requires_action'),
    paid: t('status.paid'),
    failed: t('status.failed'),
    cancelled: t('status.cancelled'),
    shipped: t('status.shipped'),
    delivered: t('status.delivered'),
    refunded: t('status.refunded'),
  }), [t]);

  const totalPages = Math.max(1, Math.ceil((ordersPage?.count ?? 0) / (ordersPage?.pageSize ?? 50)));

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
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [ordersPage, search]);

  // Line chart: last 30 days from the analytics RPC (fill missing days with 0).
  const revenueTrend = useMemo(() => {
    const byDay = new Map<string, number>(
      (analytics?.revenueByDay ?? []).map((entry) => [entry.day, Number(entry.revenue)])
    );

    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return {
        date: formatDate(date, { month: 'short', day: 'numeric' }),
        revenue: Math.round((byDay.get(key) ?? 0) * 100) / 100,
      };
    });
  }, [analytics, formatDate]);

  const revenueByStatus = useMemo(() => {
    return Object.entries(analytics?.revenueByStatus ?? {})
      .map(([status, value]) => ({
        status: status as Order['status'],
        label: statusLabels[status as Order['status']] ?? status,
        value: Math.round(Number(value ?? 0) * 100) / 100,
      }))
      .filter((entry) => entry.value > 0);
  }, [analytics, statusLabels]);

  const handleConfirmRefund = (order: Order) => {
    refundMutation.mutate(
      { orderId: order.id },
      {
        onSuccess: () => {
          setNotification({
            type: 'success',
            message: t('admin.finance.refundSuccess', { name: getOrderDisplayName(order) }),
          });
          setConfirmOrder(null);
        },
        onError: (err) => {
          setNotification({
            type: 'error',
            message: err instanceof Error ? err.message : t('admin.finance.refundError'),
          });
          setConfirmOrder(null);
        },
      }
    );
  };

  if (analyticsLoading || ordersLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (analyticsError) {
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

      {/* Notification Toast */}
      {notification && (
        <div
          className={`alert alert-${notification.type}`}
          style={{
            marginBottom: 'var(--sp-5)',
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          {notification.message}
        </div>
      )}

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

        <div className="admin-orders-filters" style={{ marginBottom: 'var(--sp-4)' }}>
          <label className="admin-filter">
            <span>{t('admin.orders.statusLabel')}</span>
            <select
              className="select"
              value={refundStatusFilter}
              onChange={(event) => {
                setRefundStatusFilter(event.target.value as OrderStatus);
                setPage(1);
              }}
            >
              {REFUNDABLE_STATUSES.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </label>
          <label className="admin-filter">
            <span>{t('admin.orders.searchLabel')}</span>
            <input
              className="input"
              placeholder={t('admin.orders.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {refundableOrders.length === 0 ? (
          <p className="caption">{t('admin.orders.empty')}</p>
        ) : (
          <div className="admin-refund-list">
            {refundableOrders.map((order) => (
              <div key={order.id} className="admin-refund-item">
                <div>
                  <p className="admin-refund-item__id">{getOrderDisplayName(order)}</p>
                  <p className="caption">
                    {formatDate(new Date(order.created_at), { month: 'short', day: 'numeric' })}
                    {' · '}
                    {order.profiles?.full_name || order.shipping_address?.full_name || order.profiles?.email || '—'}
                  </p>
                </div>
                <div>
                  <p className="admin-refund-item__amount">{formatCurrency(order.total)}</p>
                  <p className="caption">{statusLabels[order.status]}</p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmOrder(order)}
                  disabled={refundMutation.isPending}
                >
                  {t('admin.finance.refund')}
                </button>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="pagination" aria-label={t('products.paginationLabel')}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm"
            >
              ← {t('products.prevPage')}
            </button>
            <span className="pagination-info">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-secondary btn-sm"
            >
              {t('products.nextPage')} →
            </button>
          </nav>
        )}

        {confirmOrder && (
          <div className="card card-padded" style={{ marginTop: 'var(--sp-4)', border: '1px solid var(--color-danger)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--sp-2)' }}>
              {t('admin.finance.confirmRefundTitle')}
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 'var(--sp-4)' }}>
              {t('admin.finance.confirmRefundBody', {
                amount: formatCurrency(confirmOrder.total),
                customer: confirmOrder.profiles?.full_name
                  || confirmOrder.shipping_address?.full_name
                  || confirmOrder.profiles?.email
                  || getOrderDisplayName(confirmOrder),
              })}
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleConfirmRefund(confirmOrder)}
                disabled={refundMutation.isPending}
              >
                {refundMutation.isPending
                  ? `${t('admin.finance.refund')}...`
                  : t('admin.finance.confirmRefundYes')}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmOrder(null)}
                disabled={refundMutation.isPending}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
