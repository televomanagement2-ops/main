import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrder, useCancelOrder } from '../../../hooks/useOrders';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';
import type { OrderStatus } from '../../../types';

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

// Only 'paid' orders can be cancelled (not yet prepared for shipment)
const CANCELLABLE_STATUSES: OrderStatus[] = ['paid'];

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading, error } = useOrder(orderId ?? '');
  const cancelMutation = useCancelOrder(orderId ?? '');
  const [showConfirm, setShowConfirm] = useState(false);
  const { t, formatDate, formatCurrency } = useI18n();

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error || !order) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-20)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{t('orderDetail.orderNotFound')}</p>
        <Link to="/orders" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--sp-4)' }}>
          ← {t('orderDetail.backToOrders')}
        </Link>
      </div>
    );
  }

  const badge = {
    variant: STATUS_VARIANTS[order.status] ?? 'default',
    label: t(`status.${order.status}`),
  };
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);

  const subtotal = order.order_items?.reduce((s, i) => s + i.total_price, 0) ?? 0;
  const shippingCost = (order as unknown as Record<string, unknown>).shipping_cost as number ?? 0;
  const taxAmount = (order as unknown as Record<string, unknown>).tax_amount as number ?? 0;

  const addr = (order as unknown as Record<string, unknown>).shipping_address as Record<string, string> | null;

  const handleCancel = async () => {
    await cancelMutation.mutateAsync();
    setShowConfirm(false);
  };

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)', maxWidth: 720 }}>
      <BackButton to="/orders" label={t('orderDetail.backToOrders')} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-8)' }}>
        <div>
          <span className="section-eyebrow">{t('orderDetail.order')}</span>
          <h1 className="heading-1" style={{ marginBottom: 'var(--sp-1)' }}>
            #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
            {t('orderDetail.placedOn', {
              date: formatDate(new Date(order.created_at), { year: 'numeric', month: 'long', day: 'numeric' }),
            })}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Status card */}
      <div className="order-detail-card" style={{ marginBottom: 'var(--sp-5)' }}>
        <p className="order-detail-section-label">{t('orderDetail.statusTitle')}</p>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
          {t(`statusDescription.${order.status}`)}
        </p>
        {order.status === 'shipped' && (
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 'var(--sp-2)' }}>
            {t('orderDetail.expectedDelivery')}
          </p>
        )}
      </div>

      {/* Items */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="order-detail-card" style={{ marginBottom: 'var(--sp-5)' }}>
          <p className="order-detail-section-label">{t('orderDetail.itemsOrdered')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {order.order_items.map((item, i) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 'var(--sp-4)',
                  alignItems: 'center',
                  padding: 'var(--sp-4) 0',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{item.product_name}</p>
                  {item.selected_size && (
                    <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                      {t('orderDetail.size')}: {item.selected_size}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>×{item.quantity}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </div>

          {/* Cost breakdown */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-4)', marginTop: 'var(--sp-2)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <CostRow label={t('orderDetail.subtotal')} value={subtotal} formatCurrency={formatCurrency} />
            {shippingCost > 0
              ? <CostRow
                  label={`${t('orderDetail.shipping')}${order.shipping_method_name ? ` (${order.shipping_method_name})` : ''}`}
                  value={shippingCost}
                  formatCurrency={formatCurrency}
                />
              : <CostRow label={t('orderDetail.shipping')} value={0} display={t('common.free')} formatCurrency={formatCurrency} />
            }
            {taxAmount > 0 && (
              <CostRow label={t('orderDetail.tax')} value={taxAmount} formatCurrency={formatCurrency} />
            )}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-2)', marginTop: 'var(--sp-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t('orderDetail.total')}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Shipping address */}
      {addr && (
        <div className="order-detail-card" style={{ marginBottom: 'var(--sp-5)' }}>
          <p className="order-detail-section-label">{t('orderDetail.shippingAddress')}</p>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.8 }}>
            {addr.full_name}<br />
            {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
            {addr.city}, {addr.state} {addr.postal_code}<br />
            {addr.country}
          </p>
        </div>
      )}

      {/* Shipping method */}
      {order.shipping_method_name && (
        <div className="order-detail-card" style={{ marginBottom: 'var(--sp-5)' }}>
          <p className="order-detail-section-label">{t('orderDetail.shippingMethod')}</p>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>
            {order.shipping_method_name}
            {shippingCost === 0 && ` — ${t('common.free')}`}
          </p>
        </div>
      )}

      {/* Cancel section */}
      <div className="order-detail-card">
        <p className="order-detail-section-label">{t('orderDetail.actions')}</p>
        {canCancel ? (
          <>
            {!showConfirm ? (
              <div>
                <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 'var(--sp-4)' }}>
                  {t('orderDetail.cancelPrompt')}
                </p>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowConfirm(true)}
                >
                  {t('orderDetail.cancelOrder')}
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 14, color: 'var(--color-text)', marginBottom: 'var(--sp-4)' }}>
                  {t('orderDetail.cancelConfirm')}
                </p>
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? t('orders.cancelling') : t('orderDetail.cancelYes')}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowConfirm(false)}
                    disabled={cancelMutation.isPending}
                  >
                    {t('orderDetail.keepOrder')}
                  </button>
                </div>
                {cancelMutation.isError && (
                  <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 'var(--sp-3)' }}>
                    {t('orderDetail.cancelError')}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
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
    </div>
  );
}

function CostRow({
  label,
  value,
  display,
  formatCurrency,
}: {
  label: string;
  value: number;
  display?: string;
  formatCurrency: (value: number) => string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
        {display ?? formatCurrency(value)}
      </span>
    </div>
  );
}
