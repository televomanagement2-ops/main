import { useMemo, useState } from 'react';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Drawer } from '../../../components/ui/Drawer';
import { Media } from '../../../components/ui/Media';
import { OrderStatus as OrderStatusIndicator } from '../../../components/ui/StatusIndicator';
import {
  useAdminOrders,
  useMarkOrderDelivered,
  useUpdateAdminOrderStatus,
  useUpdateAdminOrderTracking,
} from '../../../hooks/useAdminOrders';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconChevronRight,
} from '../../../components/ui/icons';
import type { Order, OrderStatus } from '../../../types';

type StatusFilter = 'all' | OrderStatus;

// Transitions offered by the plain status dropdown, which writes to PostgREST
// directly. 'paid' deliberately has NO options: shipping an order has to go
// through the update-tracking Edge Function, because that is what records the
// tracking ID and emails the customer. Offering paid → shipped here shipped the
// order silently — no tracking, no notification — and then the tracking field
// (which only accepted a paid order) could never be filled in again.
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['requires_action', 'paid', 'failed', 'cancelled'],
  requires_action: ['paid', 'failed', 'cancelled'],
  paid: [],
  shipped: ['delivered'],
  delivered: [],
  failed: [],
  cancelled: [],
  refunded: [],
};

const TIMELINE_STEPS: OrderStatus[] = ['paid', 'shipped', 'delivered'];
const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'failed', 'refunded'];

function formatAddress(order: Order): string {
  const addr = order.shipping_address;
  if (!addr) return '—';
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ');
}

export function AdminOrdersPage() {
  const { t, tCount, formatCurrency, formatDate, formatDateTime } = useI18n();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const { data, isLoading, error } = useAdminOrders({
    page,
    status: statusFilter === 'all' ? undefined : statusFilter,
    needsReviewOnly: needsReviewOnly || undefined,
  });

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
        ...(order.order_items?.map((item) => item.product_name) ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [orders, search]);

  const openOrder = filteredOrders.find((order) => order.id === openOrderId) ?? null;

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('admin.orders.filterAll') },
    ...(
      [
        'paid',
        'processing',
        'requires_action',
        'shipped',
        'delivered',
        'cancelled',
        'failed',
        'refunded',
        'pending',
      ] as OrderStatus[]
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
          {tCount('admin.orders.count', filteredOrders.length)}
        </span>
      </div>

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
                return (
                  <tr
                    key={order.id}
                    onClick={() => setOpenOrderId(order.id)}
                    className={openOrderId === order.id ? 'is-selected' : undefined}
                  >
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
                          <p className="t-xs t-faint t-mono">{order.id.slice(0, 8).toUpperCase()}</p>
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
                        {order.needs_review && (
                          <span className="status status--critical">{t('admin.orders.needsReview')}</span>
                        )}
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
        {openOrder && (
          <OrderDetailPanel
            order={openOrder}
            formatAddress={formatAddress}
            formatCurrency={formatCurrency}
            formatDateTime={formatDateTime}
          />
        )}
      </Drawer>
    </>
  );
}

/* ── Order detail ────────────────────────────────────────────────────── */

function OrderDetailPanel({
  order,
  formatAddress,
  formatCurrency,
  formatDateTime,
}: {
  order: Order;
  formatAddress: (order: Order) => string;
  formatCurrency: (value: number) => string;
  formatDateTime: (value: Date) => string;
}) {
  const { t, tCount } = useI18n();
  const updateStatus = useUpdateAdminOrderStatus();
  const updateTracking = useUpdateAdminOrderTracking();
  const markDelivered = useMarkOrderDelivered();

  const [trackingDraft, setTrackingDraft] = useState(order.tracking_id ?? '');

  const nextStatuses = [order.status, ...STATUS_TRANSITIONS[order.status]].filter(
    (value, index, arr) => arr.indexOf(value) === index
  );
  // 'shipped' is included so a wrong tracking number can still be corrected —
  // the Edge Function re-sends the notification with the new one, and the DB
  // treats shipped → shipped as a no-op.
  const canTrack = order.status === 'paid' || order.status === 'shipped';
  const canSaveTracking = canTrack && trackingDraft.trim().length > 0;
  const stopped = TERMINAL_STATUSES.includes(order.status);
  const progress = TIMELINE_STEPS.indexOf(order.status);

  const deliverErrorMessage = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : '';
    if (raw.includes('delivered_at') || raw.includes('schema cache')) {
      return t('admin.orders.errors.deliveredAtMissing');
    }
    if (raw.includes('JWT') || raw.includes('session') || raw.includes('Session')) {
      return t('admin.orders.errors.sessionExpired');
    }
    return raw || t('admin.orders.markDeliveredError');
  };

  return (
    <div className="order-detail">
      <div className="order-detail__head">
        <div className="row row--between gap-4" style={{ alignItems: 'flex-start' }}>
          <div>
            <p className="t-label">{t('admin.orders.orderTotal')}</p>
            <p className="order-detail__total" style={{ marginTop: 'var(--s-2)' }}>
              {formatCurrency(order.total)}
            </p>
            <p className="t-xs t-faint" style={{ marginTop: 'var(--s-2)' }}>
              {formatDateTime(new Date(order.created_at))} · {tCount('orders.items', order.order_items?.length ?? 0)}
            </p>
          </div>
          <div className="stack gap-2" style={{ alignItems: 'flex-end' }}>
            <OrderStatusIndicator status={order.status} />
            {order.needs_review && (
              <span className="status status--critical">{t('admin.orders.needsReview')}</span>
            )}
          </div>
        </div>

        {order.needs_review && order.review_reason && (
          <div className="notice notice--critical" style={{ marginTop: 'var(--s-4)' }}>
            <IconAlert size={15} />
            <div className="notice__body">
              {t('admin.orders.reviewReasonLabel')}: {order.review_reason}
            </div>
          </div>
        )}

        <div className={`timeline${stopped ? ' timeline--stopped' : ''}`} style={{ marginBottom: 0 }}>
          {(stopped
            ? [
                { key: 'placed', label: t('orderDetail.timeline.ordered'), state: 'done' as const },
                { key: order.status, label: t(`status.${order.status}`), state: 'current' as const },
              ]
            : TIMELINE_STEPS.map((step, index) => ({
                key: step,
                label: t(`status.${step}`),
                state:
                  progress < 0
                    ? ('todo' as const)
                    : index < progress
                    ? ('done' as const)
                    : index === progress
                    ? ('current' as const)
                    : ('todo' as const),
              }))
          ).map((step) => (
            <div
              key={step.key}
              className={`timeline__step${step.state === 'done' ? ' is-done' : ''}${
                step.state === 'current' ? ' is-current' : ''
              }`}
            >
              <div className="timeline__marker" aria-hidden="true">
                <span className="timeline__dot" />
                <span className="timeline__line" />
              </div>
              <span className="timeline__label">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      <section className="order-detail__block">
        <p className="t-label" style={{ marginBottom: 'var(--s-3)' }}>{t('orderDetail.itemsOrdered')}</p>
        {order.order_items?.map((item) => (
          <div key={item.id} className="order-detail__item">
            <Media src={item.product_image} alt="" ratio="square" className="thumb" style={{ width: 48, height: 48 }} />
            <div style={{ minWidth: 0 }}>
              <p className="t-sm" style={{ color: 'var(--ink)' }}>{item.product_name}</p>
              <p className="t-xs t-faint">
                {item.selected_size ? `${item.selected_size} · ` : ''}
                {formatCurrency(item.unit_price)} × {item.quantity}
              </p>
            </div>
            <p className="t-sm t-num" style={{ color: 'var(--ink)' }}>{formatCurrency(item.total_price)}</p>
          </div>
        ))}

        <div className="summary" style={{ marginTop: 'var(--s-4)' }}>
          <div className="summary__row">
            <span>{t('orderDetail.subtotal')}</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="summary__row">
            <span>{order.shipping_method_name ?? t('orderDetail.shipping')}</span>
            <span>{order.shipping_cost > 0 ? formatCurrency(order.shipping_cost) : t('common.free')}</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="summary__row">
              <span>{t('orderDetail.tax')}</span>
              <span>{formatCurrency(order.tax_amount)}</span>
            </div>
          )}
          <div className="summary__row summary__row--total">
            <span>{t('orderDetail.total')}</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </section>

      {/* Customer + shipping */}
      <section className="order-detail__block">
        <div className="order-detail__grid">
          <div>
            <p className="t-label" style={{ marginBottom: 'var(--s-2)' }}>{t('admin.orders.customer')}</p>
            <p className="t-sm" style={{ color: 'var(--ink)' }}>
              {order.profiles?.full_name
                || order.shipping_address?.full_name
                || t('admin.orders.customerFallback')}
            </p>
            <p className="t-xs t-faint">{order.profiles?.email ?? t('admin.orders.emailUnavailable')}</p>
            {order.shipping_address?.phone && (
              <p className="t-xs t-faint">{order.shipping_address.phone}</p>
            )}
          </div>
          <div>
            <p className="t-label" style={{ marginBottom: 'var(--s-2)' }}>{t('admin.orders.shipping')}</p>
            <p className="t-sm t-muted" style={{ lineHeight: 1.7 }}>{formatAddress(order)}</p>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="order-detail__block">
        <p className="t-label" style={{ marginBottom: 'var(--s-4)' }}>{t('orderDetail.actions')}</p>

        <div className="stack gap-5">
          <div className="field">
            <label className="field__label" htmlFor="drawer-status">{t('admin.orders.statusLabel')}</label>
            <select
              id="drawer-status"
              className="select"
              value={order.status}
              disabled={nextStatuses.length === 1 || updateStatus.isPending}
              onChange={(event) =>
                updateStatus.mutate(
                  { orderId: order.id, status: event.target.value as OrderStatus },
                  {
                    onSuccess: () => toast(t('admin.orders.statusUpdated')),
                    onError: (err) =>
                      toast(err instanceof Error ? err.message : t('common.error'), 'critical'),
                  }
                )
              }
            >
              {nextStatuses.map((status) => (
                <option key={status} value={status}>{t(`status.${status}`)}</option>
              ))}
            </select>
            {nextStatuses.length === 1 && (
              <p className="field__hint">
                {/* A paid order is not stuck — it just advances via tracking,
                    not via this dropdown. Saying "no further transitions"
                    would tell the admin the opposite of the truth. */}
                {order.status === 'paid'
                  ? t('admin.orders.shipViaTracking')
                  : t('admin.orders.noTransitions')}
              </p>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="drawer-tracking">{t('admin.orders.trackingId')}</label>
            <div className="row gap-3">
              <input
                id="drawer-tracking"
                className="input"
                placeholder={t('admin.orders.trackingPlaceholder')}
                value={trackingDraft}
                onChange={(event) => setTrackingDraft(event.target.value)}
              />
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!canSaveTracking || updateTracking.isPending}
                onClick={() =>
                  updateTracking.mutate(
                    { orderId: order.id, trackingId: trackingDraft.trim() },
                    {
                      onSuccess: () => toast(t('admin.orders.trackingSaved')),
                      onError: (err) =>
                        toast(err instanceof Error ? err.message : t('admin.orders.trackingSaveError'), 'critical'),
                    }
                  )
                }
              >
                {updateTracking.isPending ? t('admin.orders.savingTracking') : t('admin.orders.saveTracking')}
              </button>
            </div>
            {!canTrack && <p className="field__hint">{t('admin.orders.trackingHint')}</p>}
          </div>

          {order.status === 'shipped' && (
            <button
              type="button"
              className="btn btn--primary"
              style={{ alignSelf: 'flex-start' }}
              disabled={markDelivered.isPending}
              onClick={() =>
                markDelivered.mutate(
                  { orderId: order.id },
                  {
                    onSuccess: () => toast(t('admin.orders.deliveredConfirmed')),
                    onError: (err) => toast(deliverErrorMessage(err), 'critical'),
                  }
                )
              }
            >
              {markDelivered.isPending ? t('admin.orders.markingDelivered') : t('admin.orders.markDelivered')}
            </button>
          )}
        </div>
      </section>

      {/* Activity */}
      <section className="order-detail__block">
        <p className="t-label" style={{ marginBottom: 'var(--s-4)' }}>{t('admin.orders.activity')}</p>
        <div className="activity">
          <ActivityRow
            label={t('admin.orders.activityPlaced')}
            time={formatDateTime(new Date(order.created_at))}
          />
          {order.tracking_updated_at && (
            <ActivityRow
              label={t('admin.orders.activityTracking', { id: order.tracking_id ?? '—' })}
              time={formatDateTime(new Date(order.tracking_updated_at))}
            />
          )}
          {order.delivered_at && (
            <ActivityRow
              label={t('admin.orders.activityDelivered')}
              time={formatDateTime(new Date(order.delivered_at))}
            />
          )}
          {order.refunded_at && (
            <ActivityRow
              label={t('admin.orders.activityRefunded', {
                amount: order.refund_amount ? formatCurrency(order.refund_amount) : formatCurrency(order.total),
              })}
              time={formatDateTime(new Date(order.refunded_at))}
            />
          )}
          <ActivityRow
            label={t('admin.orders.activityUpdated')}
            time={formatDateTime(new Date(order.updated_at))}
          />
        </div>
      </section>
    </div>
  );
}

function ActivityRow({ label, time }: { label: string; time: string }) {
  return (
    <div className="activity__row">
      <span className="activity__dot" aria-hidden="true" />
      <div>
        <p className="activity__label">{label}</p>
        <p className="activity__time">{time}</p>
      </div>
    </div>
  );
}
