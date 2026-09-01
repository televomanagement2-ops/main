import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrder, useCancelOrder } from '../../../hooks/useOrders';
import { Spinner } from '../../../components/ui/Spinner';
import { BackButton } from '../../../components/ui/BackButton';
import { OrderStatus as OrderStatusIndicator } from '../../../components/ui/StatusIndicator';
import { IconAlert } from '../../../components/ui/icons';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import type { Order, OrderStatus } from '../../../types';

// Error code mapping
const ERROR_MESSAGES: Record<string, string> = {
  'ORDER_ALREADY_REFUNDED': 'This order has already been refunded',
  'ORDER_NOT_CANCELABLE': 'This order cannot be cancelled at this stage',
  'AUTH_INVALID_SESSION': 'Your session has expired. Please sign in again',
  'ORDER_NOT_FOUND': 'Order not found',
};

function getErrorMessage(error: Error): string {
  const message = error.message || '';
  for (const [code, userMsg] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(code)) return userMsg;
  }
  return message || 'Failed to cancel order. Please try again.';
}

// Only 'paid' orders can be cancelled (not yet prepared for shipment)
const CANCELLABLE_STATUSES: OrderStatus[] = ['paid'];
const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'failed', 'refunded'];

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading, error } = useOrder(orderId ?? '');
  const cancelMutation = useCancelOrder(orderId ?? '');
  const [showConfirm, setShowConfirm] = useState(false);
  const { t, formatDate, formatCurrency } = useI18n();

  if (isLoading) {
    return (
      <div className="page-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page">
        <div className="empty empty--center" style={{ paddingBlock: 'clamp(80px, 12vw, 160px)' }}>
          <p className="empty__title">{t('orderDetail.orderNotFound')}</p>
          <Link to="/orders" className="btn btn--secondary">{t('orderDetail.backToOrders')}</Link>
        </div>
      </div>
    );
  }

  const canCancel = CANCELLABLE_STATUSES.includes(order.status) && !order.refund_id;
  const subtotal = order.order_items?.reduce((s, i) => s + i.total_price, 0) ?? 0;
  const shippingCost = order.shipping_cost ?? 0;
  const taxAmount = order.tax_amount ?? 0;
  const addr = order.shipping_address ?? null;
  const title = order.order_items?.[0]?.product_name ?? t('orderDetail.order');

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      setShowConfirm(false);
      toast(t('orderDetail.cancelSuccess'));
    } catch {
      // Surfaced inline below.
    }
  };

  return (
    <div className="page">
      <div style={{ paddingTop: 'var(--s-6)' }}>
        <BackButton to="/orders" label={t('orderDetail.backToOrders')} />
      </div>

      <header className="account-head">
        <div className="account-head__title">
          <p className="t-label">
            {t('orderDetail.order')} · <span className="t-mono">{order.id.slice(0, 8).toUpperCase()}</span>
          </p>
          <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{title}</h1>
          <p className="t-sm t-faint" style={{ marginTop: 'var(--s-3)' }}>
            {t('orderDetail.placedOn', {
              date: formatDate(new Date(order.created_at), { year: 'numeric', month: 'long', day: 'numeric' }),
            })}
          </p>
        </div>
        <div className="account-head__actions" style={{ alignItems: 'flex-end', flexDirection: 'column', gap: 'var(--s-2)' }}>
          <OrderStatusIndicator status={order.status} />
          <p className="t-h3 t-num">{formatCurrency(order.total)}</p>
        </div>
      </header>

      <OrderTimeline order={order} />

      <p className="t-sm t-muted t-measure" style={{ marginBottom: 'var(--s-16)' }}>
        {t(`statusDescription.${order.status}`)}
        {order.status === 'shipped' && ` ${t('orderDetail.expectedDelivery')}`}
        {order.delivered_at &&
          ` ${t('orderDetail.deliveredAt', {
            date: formatDate(new Date(order.delivered_at), { year: 'numeric', month: 'long', day: 'numeric' }),
          })}`}
      </p>

      <div className="detail-grid" style={{ paddingBottom: 'var(--s-20)' }}>
        <section className="detail-block detail-block--wide">
          <p className="t-label">{t('orderDetail.itemsOrdered')}</p>
          <div className="info-rows">
            {order.order_items?.map((item) => (
              <div key={item.id} className="info-row">
                <span>
                  {item.product_name}
                  {item.selected_size && <span className="t-faint"> · {item.selected_size}</span>}
                  <span className="t-faint"> × {item.quantity}</span>
                </span>
                <strong>{formatCurrency(item.total_price)}</strong>
              </div>
            ))}
          </div>

          <div className="summary" style={{ marginTop: 'var(--s-4)' }}>
            <div className="summary__row">
              <span>{t('orderDetail.subtotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="summary__row">
              <span>
                {t('orderDetail.shipping')}
                {order.shipping_method_name ? ` · ${order.shipping_method_name}` : ''}
              </span>
              <span>{shippingCost > 0 ? formatCurrency(shippingCost) : t('common.free')}</span>
            </div>
            {taxAmount > 0 && (
              <div className="summary__row">
                <span>{t('orderDetail.tax')}</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="summary__row summary__row--total">
              <span>{t('orderDetail.total')}</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </section>

        <section className="detail-block">
          {addr && (
            <>
              <p className="t-label">{t('orderDetail.shippingAddress')}</p>
              <p className="detail-block__body">
                {addr.full_name}<br />
                {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                {/* state is empty for countries that do not use one — filter
                    rather than render a stray comma. */}
                {[addr.city, addr.state].filter(Boolean).join(', ')} {addr.postal_code}<br />
                {addr.country}
              </p>
            </>
          )}

          {order.tracking_id && (
            <div style={{ marginTop: 'var(--s-6)' }}>
              <p className="t-label">{t('orderDetail.tracking')}</p>
              <p className="t-sm t-mono" style={{ marginTop: 'var(--s-2)' }}>{order.tracking_id}</p>
            </div>
          )}

          <div style={{ marginTop: 'var(--s-6)' }}>
            <p className="t-label">{t('orderDetail.actions')}</p>
            {canCancel ? (
              !showConfirm ? (
                <div className="stack gap-3" style={{ marginTop: 'var(--s-3)', alignItems: 'flex-start' }}>
                  <p className="t-sm t-faint">{t('orderDetail.cancelPrompt')}</p>
                  <button type="button" className="btn btn--critical btn--sm" onClick={() => setShowConfirm(true)}>
                    {t('orderDetail.cancelOrder')}
                  </button>
                </div>
              ) : (
                <div className="stack gap-3" style={{ marginTop: 'var(--s-3)' }}>
                  <p className="t-sm">{t('orderDetail.cancelConfirm')}</p>
                  <div className="row gap-3">
                    <button
                      type="button"
                      className="btn btn--critical btn--sm"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? t('orders.cancelling') : t('orderDetail.cancelYes')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      onClick={() => setShowConfirm(false)}
                      disabled={cancelMutation.isPending}
                    >
                      {t('orderDetail.keepOrder')}
                    </button>
                  </div>
                  {cancelMutation.isError && (
                    <div className="notice notice--critical">
                      <IconAlert size={15} />
                      <div className="notice__body">
                        {getErrorMessage(
                          cancelMutation.error instanceof Error
                            ? cancelMutation.error
                            : new Error('Unknown error')
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="t-sm t-faint" style={{ marginTop: 'var(--s-3)' }}>
                {order.status === 'shipped' && t('orderDetail.cancelNotAllowedShipped')}
                {order.status === 'delivered' && t('orderDetail.cancelNotAllowedDelivered')}
                {order.status === 'cancelled' && t('orderDetail.cancelNotAllowedCancelled')}
                {order.status === 'failed' && t('orderDetail.cancelNotAllowedFailed')}
                {order.status === 'refunded' && t('orderDetail.cancelNotAllowedRefunded')}
                {(order.status === 'pending' || order.status === 'processing' || order.status === 'requires_action') &&
                  t('orderDetail.cancelNotAllowed')}
              </p>
            )}
          </div>

          <Link to="/help" className="link-arrow" style={{ marginTop: 'var(--s-6)' }}>
            {t('orderDetail.needHelp')}
          </Link>
        </section>
      </div>
    </div>
  );
}

/**
 * Progress as a line of named steps. Terminal outcomes (cancelled, failed,
 * refunded) stop the line rather than pretending the order is still moving.
 */
function OrderTimeline({ order }: { order: Order }) {
  const { t } = useI18n();
  const stopped = TERMINAL_STATUSES.includes(order.status);

  const steps = stopped
    ? [
        { key: 'ordered', label: t('orderDetail.timeline.ordered'), state: 'done' as const },
        { key: order.status, label: t(`status.${order.status}`), state: 'current' as const },
      ]
    : (() => {
        const progress =
          order.status === 'delivered' ? 3 : order.status === 'shipped' ? 2 : order.status === 'paid' ? 1 : 0;
        return [
          { key: 'ordered', label: t('orderDetail.timeline.ordered') },
          { key: 'paid', label: t('orderDetail.timeline.paid') },
          { key: 'shipped', label: t('orderDetail.timeline.shipped') },
          { key: 'delivered', label: t('orderDetail.timeline.delivered') },
        ].map((step, index) => ({
          ...step,
          state: index < progress ? ('done' as const) : index === progress ? ('current' as const) : ('todo' as const),
        }));
      })();

  return (
    <div className={`timeline${stopped ? ' timeline--stopped' : ''}`} role="list" aria-label={t('orderDetail.statusTitle')}>
      {steps.map((step) => (
        <div
          key={step.key}
          role="listitem"
          className={`timeline__step${step.state === 'done' ? ' is-done' : ''}${step.state === 'current' ? ' is-current' : ''}`}
        >
          <div className="timeline__marker" aria-hidden="true">
            <span className="timeline__dot" />
            <span className="timeline__line" />
          </div>
          <span className="timeline__label">{step.label}</span>
        </div>
      ))}
    </div>
  );
}
