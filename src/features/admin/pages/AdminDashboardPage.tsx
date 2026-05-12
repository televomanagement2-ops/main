import { Link } from 'react-router-dom';
import { useAdminAnalytics } from '../../../hooks/useAdminAnalytics';
import { useI18n } from '../../../lib/i18n';
import type { OrderStatus } from '../../../types';

export function AdminDashboardPage() {
  const { data, isLoading, error } = useAdminAnalytics();
  const { t, formatCurrency } = useI18n();

  const statusLabels: Record<OrderStatus, string> = {
    pending: t('status.pending'),
    processing: t('status.processing'),
    requires_action: t('status.requires_action'),
    paid: t('status.paid'),
    failed: t('status.failed'),
    cancelled: t('status.cancelled'),
    shipped: t('status.shipped'),
    delivered: t('status.delivered'),
    refunded: t('status.refunded'),
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card card-padded" style={{ textAlign: 'center' }}>
        <p className="body" style={{ color: 'var(--color-danger)' }}>
          {t('admin.dashboard.loadError')}
        </p>
      </div>
    );
  }

  const pendingCount = data.statusCounts.pending + data.statusCounts.processing;
  const fulfilmentCount = data.statusCounts.paid + data.statusCounts.processing;
  const shippedCount = data.statusCounts.shipped;

  return (
    <div className="admin-section">
      <div className="admin-kpi-grid">
        <KpiCard
          label={t('admin.dashboard.grossRevenue')}
          value={formatCurrency(data.grossRevenue)}
          hint={t('admin.dashboard.grossRevenueHint')}
        />
        <KpiCard
          label={t('admin.dashboard.orders24h')}
          value={String(data.orders24h)}
          hint={t('admin.dashboard.orders24hHint')}
        />
        <KpiCard
          label={t('admin.dashboard.orders7d')}
          value={String(data.orders7d)}
          hint={t('admin.dashboard.orders7dHint')}
        />
        <KpiCard
          label={t('admin.dashboard.bestSeller')}
          value={data.bestSeller ? data.bestSeller.productName : t('admin.dashboard.bestSellerNone')}
          hint={data.bestSeller
            ? t('admin.dashboard.bestSellerUnits', { count: data.bestSeller.quantity })
            : t('admin.dashboard.bestSellerAwaiting')}
        />
      </div>

      <div className="admin-grid-split">
        <section className="card card-padded admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="label-caps">{t('admin.dashboard.operationalQueue')}</p>
              <h2 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>
                {t('admin.dashboard.todaysFocus')}
              </h2>
            </div>
            <Link to="/admin/orders" className="btn btn-secondary btn-sm">
              {t('admin.dashboard.reviewOrders')}
            </Link>
          </div>
          <div className="admin-ops-list">
            <div className="admin-ops-item">
              <span className="admin-ops-item__label">{t('admin.dashboard.openPayments')}</span>
              <span className="admin-ops-item__value">{pendingCount}</span>
            </div>
            <div className="admin-ops-item">
              <span className="admin-ops-item__label">{t('admin.dashboard.awaitingFulfilment')}</span>
              <span className="admin-ops-item__value">{fulfilmentCount}</span>
            </div>
            <div className="admin-ops-item">
              <span className="admin-ops-item__label">{t('admin.dashboard.shippedToday')}</span>
              <span className="admin-ops-item__value">{shippedCount}</span>
            </div>
          </div>
          <div className="divider" style={{ margin: 'var(--sp-5) 0' }} />
          <div className="admin-ops-statuses">
            {Object.entries(data.statusCounts).map(([status, count]) => (
              <div key={status} className="admin-pill">
                <span>{statusLabels[status as OrderStatus]}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-padded admin-panel admin-panel--accent">
          <p className="label-caps">{t('admin.dashboard.commandShortcuts')}</p>
          <h2 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>
            {t('admin.dashboard.quickActions')}
          </h2>
          <p className="body" style={{ marginTop: 'var(--sp-2)' }}>
            {t('admin.dashboard.quickActionsSub')}
          </p>
          <div className="admin-actions">
            <Link to="/admin/orders" className="btn btn-primary btn-sm">
              {t('admin.dashboard.orderControlCenter')}
            </Link>
            <Link to="/admin/catalog" className="btn btn-secondary btn-sm">
              {t('admin.dashboard.manageCatalog')}
            </Link>
            <Link to="/admin/finance" className="btn btn-secondary btn-sm">
              {t('admin.dashboard.refundsRevenue')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card card-padded admin-kpi">
      <p className="label-caps">{label}</p>
      <p className="admin-kpi__value">{value}</p>
      <p className="caption">{hint}</p>
    </div>
  );
}
