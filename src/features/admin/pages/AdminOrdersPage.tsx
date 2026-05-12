import { useMemo, useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { useAdminOrders, useUpdateAdminOrderStatus, useUpdateAdminOrderTracking } from '../../../hooks/useAdminOrders';
import { useI18n } from '../../../lib/i18n';
import type { Order, OrderStatus } from '../../../types';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

type StatusFilter = 'all' | OrderStatus;

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['requires_action', 'paid', 'failed', 'cancelled'],
  requires_action: ['paid', 'failed', 'cancelled'],
  paid: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  failed: [],
  cancelled: [],
  refunded: [],
};

export function AdminOrdersPage() {
  const { data: orders = [], isLoading, error } = useAdminOrders();
  const updateStatus = useUpdateAdminOrderStatus();
  const updateTracking = useUpdateAdminOrderTracking();
  const { t, tCount, formatCurrency, formatDateTime } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({});

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

  const statusBadge: Record<OrderStatus, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'warning', label: statusLabels.pending },
    processing: { variant: 'accent', label: statusLabels.processing },
    requires_action: { variant: 'warning', label: statusLabels.requires_action },
    paid: { variant: 'success', label: statusLabels.paid },
    failed: { variant: 'danger', label: statusLabels.failed },
    cancelled: { variant: 'danger', label: statusLabels.cancelled },
    shipped: { variant: 'accent', label: statusLabels.shipped },
    delivered: { variant: 'success', label: statusLabels.delivered },
    refunded: { variant: 'warning', label: statusLabels.refunded },
  };

  const filters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('admin.orders.filterAll') },
    { value: 'paid', label: statusLabels.paid },
    { value: 'processing', label: statusLabels.processing },
    { value: 'requires_action', label: statusLabels.requires_action },
    { value: 'shipped', label: statusLabels.shipped },
    { value: 'delivered', label: statusLabels.delivered },
    { value: 'cancelled', label: statusLabels.cancelled },
    { value: 'failed', label: statusLabels.failed },
    { value: 'refunded', label: statusLabels.refunded },
    { value: 'pending', label: statusLabels.pending },
  ];

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;

      const haystack = [
        order.id,
        order.profiles?.email,
        order.profiles?.full_name,
        order.shipping_address?.full_name,
        ...(order.order_items?.map((item) => item.product_name) ?? []),
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }, [orders, search, statusFilter]);

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="card card-padded" style={{ textAlign: 'center' }}>
        <p className="body" style={{ color: 'var(--color-danger)' }}>
          {t('admin.orders.loadError')}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="admin-orders-toolbar">
        <div>
          <span className="section-eyebrow">{t('admin.orders.eyebrow')}</span>
          <h2 className="heading-2" style={{ marginTop: 'var(--sp-2)' }}>{t('admin.orders.title')}</h2>
        </div>
        <div className="admin-orders-filters">
          <label className="admin-filter">
            <span>{t('admin.orders.statusLabel')}</span>
            <select
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              {filters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
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
      </div>

      {filteredOrders.length === 0 ? (
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <p className="body">{t('admin.orders.empty')}</p>
        </div>
      ) : (
        <div className="admin-orders-list">
          {filteredOrders.map((order) => {
            const badge = statusBadge[order.status];
            const trackingValue = trackingDrafts[order.id] ?? order.tracking_id ?? '';
            const primaryItem = order.order_items?.[0] ?? null;
            const extraItems = Math.max((order.order_items?.length ?? 0) - 1, 0);
            const orderTitle = primaryItem
              ? `${primaryItem.product_name}${extraItems > 0 ? ` ${t('admin.orders.moreItems', { count: extraItems })}` : ''}`
              : `${t('admin.orders.orderLabel')} ${order.id.slice(0, 8).toUpperCase()}`;
            const thumbnail = primaryItem?.product_image
              ?? 'https://placehold.co/96x96/f5f5f7/aeaeb2?text=No+image';
            const nextStatusOptions = [order.status, ...STATUS_TRANSITIONS[order.status]]
              .filter((value, index, arr) => arr.indexOf(value) === index);
            const canSendTracking = order.status === 'paid' && trackingValue.trim().length > 0;

            return (
              <article key={order.id} className="card admin-order-card">
                <div className="admin-order-card__head">
                  <div className="admin-order-card__summary">
                    <div className="admin-order-card__thumb">
                      <img src={thumbnail} alt={primaryItem?.product_name ?? t('admin.orders.orderItemAlt')} />
                    </div>
                    <div>
                      <p className="admin-order-card__title">{orderTitle}</p>
                      <p className="caption">
                        {t('admin.orders.orderMeta', {
                          id: order.id.slice(0, 8).toUpperCase(),
                          date: formatDateTime(new Date(order.created_at)),
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>

                <div className="admin-order-card__body">
                  <div className="admin-order-details">
                    <div>
                      <p className="label-caps">{t('admin.orders.customer')}</p>
                      <p className="admin-order-card__text">
                        {order.profiles?.full_name
                          || order.shipping_address?.full_name
                          || t('admin.orders.customerFallback')}
                      </p>
                      <p className="caption">
                        {order.profiles?.email ?? t('admin.orders.emailUnavailable')}
                      </p>
                    </div>
                    <div>
                      <p className="label-caps">{t('admin.orders.shipping')}</p>
                      <p className="admin-order-card__text">
                        {formatAddress(order)}
                      </p>
                      {order.shipping_address?.phone && (
                        <p className="caption">{order.shipping_address.phone}</p>
                      )}
                    </div>
                    <div>
                      <p className="label-caps">{t('admin.orders.orderTotal')}</p>
                      <p className="admin-order-card__total">{formatCurrency(order.total)}</p>
                      <p className="caption">
                        {tCount('orders.items', order.order_items?.length ?? 0)}
                      </p>
                    </div>
                  </div>

                  <div className="admin-order-actions">
                    <label className="admin-action">
                      <span>{t('admin.orders.statusLabel')}</span>
                      <select
                        className="select"
                        value={order.status}
                        onChange={(event) =>
                          updateStatus.mutate({
                            orderId: order.id,
                            status: event.target.value as OrderStatus,
                          })
                        }
                        disabled={nextStatusOptions.length === 1 || updateStatus.isPending}
                      >
                        {nextStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="admin-action">
                      <span>{t('admin.orders.trackingId')}</span>
                      <input
                        className="input"
                        placeholder={t('admin.orders.trackingPlaceholder')}
                        value={trackingValue}
                        onChange={(event) =>
                          setTrackingDrafts((prev) => ({
                            ...prev,
                            [order.id]: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        updateTracking.mutate({
                          orderId: order.id,
                          trackingId: trackingValue.trim(),
                        })
                      }
                      disabled={!canSendTracking || updateTracking.isPending}
                    >
                      {updateTracking.isPending
                        ? t('admin.orders.savingTracking')
                        : t('admin.orders.saveTracking')}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatAddress(order: Order) {
  const addr = order.shipping_address;
  if (!addr) return 'No address';
  const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code]
    .filter(Boolean)
    .join(', ');
  return parts || 'No address';
}
