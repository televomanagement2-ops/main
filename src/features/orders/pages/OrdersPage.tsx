import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useCancelOrder, useOrders } from '../../../hooks/useOrders';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';
import type { Order, OrderStatus } from '../../../types';

// Error code mapping
const ERROR_MESSAGES: Record<string, string> = {
  'ORDER_ALREADY_REFUNDED': 'This order has already been refunded',
  'ORDER_NOT_CANCELABLE': 'This order cannot be cancelled at this stage',
  'AUTH_INVALID_SESSION': 'Your session has expired. Please sign in again',
};

function getErrorMessage(error: Error): string {
  const message = error.message || '';
  for (const [code, userMsg] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(code)) {
      return userMsg;
    }
  }
  return message || 'Failed to cancel order. Please try again.';
}

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  pending: 'warning',
  processing: 'accent',
  requires_action: 'warning',
  paid: 'success',
  failed: 'danger',
  cancelled: 'danger',
  shipped: 'accent',
  delivered: 'success',
  refunded: 'warning',
};

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'processing', 'requires_action', 'paid', 'shipped'];
const HISTORY_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'failed', 'refunded'];

export function OrdersPage() {
  const { data: allOrders = [], isLoading, error } = useOrders();
  const { t, tCount, formatDate, formatCurrency } = useI18n();

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-20)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>
          {t('common.error')}
        </p>
      </div>
    );
  }

  const orders = allOrders;
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const pastOrders = orders.filter((o) => HISTORY_STATUSES.includes(o.status));

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <BackButton />
      <div style={{ marginBottom: 'var(--sp-10)' }}>
        <span className="section-eyebrow">{t('orders.account')}</span>
        <h1 className="heading-1" style={{ marginBottom: 0 }}>{t('orders.title')}</h1>
      </div>

      {orders.length === 0 ? (
        <div className="cart-empty-state">
          <svg className="cart-empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p className="cart-empty-state__title">{t('orders.emptyTitle')}</p>
          <p className="cart-empty-state__sub">{t('orders.emptySubtitle')}</p>
          <Link to="/products" className="btn btn-primary" style={{ marginTop: 'var(--sp-2)' }}>
            {t('orders.startShopping')}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-12)' }}>
          {activeOrders.length > 0 && (
            <section>
              <div style={{ marginBottom: 'var(--sp-5)' }}>
                <span className="section-eyebrow">{t('orders.inProgress')}</span>
                <h2 className="heading-2" style={{ marginBottom: 0 }}>{t('orders.activeOrders')}</h2>
              </div>
              <div className="orders-list">
                {activeOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    highlight
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    t={t}
                    tCount={tCount}
                    getErrorMessage={getErrorMessage}
                  />
                ))}
              </div>
            </section>
          )}

          {pastOrders.length > 0 && (
            <section>
              <div style={{ marginBottom: 'var(--sp-5)' }}>
                <span className="section-eyebrow">{t('orders.history')}</span>
                <h2 className="heading-2" style={{ marginBottom: 0 }}>{t('orders.orderHistory')}</h2>
              </div>
              <div className="orders-list">
                {pastOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    highlight={false}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    t={t}
                    tCount={tCount}
                    getErrorMessage={getErrorMessage}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  highlight,
  formatDate,
  formatCurrency,
  t,
  tCount,
  getErrorMessage,
}: {
  order: Order;
  highlight: boolean;
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (value: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  tCount: (key: string, count: number, params?: Record<string, string | number>) => string;
  getErrorMessage: (error: Error) => string;
}) {
  const cancelMutation = useCancelOrder(order.id);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(false), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const badge = {
    variant: STATUS_VARIANTS[order.status] ?? 'default',
    label: t(`status.${order.status}`),
  };
  const canCancel = order.status === 'paid';

  const handleCancel = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await cancelMutation.mutateAsync();
      setSuccessMessage(true);
      setShowConfirm(false);
    } catch {
      // Error is displayed in UI
    }
  };

  const productName = order.order_items?.[0]?.product_name || 'Order';

  return (
    <Link
      to={`/orders/${order.id}`}
      className="order-card order-card--link"
      style={highlight ? {
        borderColor: 'var(--accent-border)',
        boxShadow: '0 0 0 1px var(--accent-border)',
      } : {}}
    >
      {/* Success Message */}
      {successMessage && (
        <div
          className="alert alert-success"
          style={{
            marginBottom: 'var(--sp-3)',
            fontSize: 12,
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          {t('orderDetail.cancelSuccess')}
        </div>
      )}

      <div className="order-card__head">
        <div>
          <p className="order-card__id">{productName}</p>
          <p className="order-card__date">
            {formatDate(new Date(order.created_at))}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {order.order_items && order.order_items.length > 0 && (
        <div className="order-card__body">
          <div className="order-card__rows">
            {order.order_items.map((item) => (
              <div key={item.id} className="order-card__row">
                <span>
                  {item.product_name}
                  {item.selected_size && (
                    <span style={{ color: 'var(--color-text-3)', fontSize: 12, marginLeft: 6 }}>
                      ({item.selected_size})
                    </span>
                  )}
                </span>
                <span style={{ color: 'var(--color-text-3)' }}>×{item.quantity}</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </div>
          {order.shipping_method_name && (
            <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 'var(--sp-2)' }}>
              {t('orders.shippingLabel')}: {order.shipping_method_name}
              {order.shipping_cost > 0 && ` — ${formatCurrency(order.shipping_cost)}`}
            </p>
          )}
        </div>
      )}

      <div className="order-card__foot">
        <span style={{ fontSize: 12.5, color: 'var(--color-text-3)' }}>
          {tCount('orders.items', order.order_items?.length ?? 0)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          {canCancel && !showConfirm && (
            <button
              type="button"
              className="btn btn-danger btn-xs"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setShowConfirm(true);
              }}
            >
              {t('orders.cancel')}
            </button>
          )}

          {canCancel && showConfirm && (
            <div className="order-card__confirm-actions">
              <button
                type="button"
                className="btn btn-danger btn-xs"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? t('orders.cancelling') : t('orders.confirm')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowConfirm(false);
                }}
                disabled={cancelMutation.isPending}
              >
                {t('orders.keep')}
              </button>
            </div>
          )}

          <span className="order-card__total">{formatCurrency(order.total)}</span>
        </div>
      </div>

      {cancelMutation.isError && (
        <p style={{ fontSize: 12.5, color: 'var(--color-danger)', padding: '0 var(--sp-6) var(--sp-3)' }}>
          {getErrorMessage(cancelMutation.error instanceof Error ? cancelMutation.error : new Error('Unknown error'))}
        </p>
      )}
    </Link>
  );
}
