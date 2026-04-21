import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrder, useCancelOrder } from '../../../hooks/useOrders';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { BackButton } from '../../../components/ui/BackButton';
import type { OrderStatus } from '../../../types';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const STATUS_BADGE: Record<OrderStatus, { variant: BadgeVariant; label: string }> = {
  pending:          { variant: 'warning', label: 'Pending' },
  processing:       { variant: 'accent',  label: 'Processing' },
  requires_action:  { variant: 'warning', label: 'Action required' },
  paid:             { variant: 'success', label: 'Confirmed' },
  failed:           { variant: 'danger',  label: 'Failed' },
  cancelled:        { variant: 'danger',  label: 'Cancelled' },
  shipped:          { variant: 'accent',  label: 'Shipped' },
  delivered:        { variant: 'success', label: 'Delivered' },
};

const STATUS_DESCRIPTION: Record<OrderStatus, string> = {
  pending:         'Your order has been received and is awaiting payment confirmation.',
  processing:      'Payment is being processed. This usually takes a few minutes.',
  requires_action: 'Your payment requires additional authentication. Please check your email.',
  paid:            'Payment confirmed. Your order is being prepared for shipment.',
  failed:          'The payment for this order failed.',
  cancelled:       'This order has been cancelled.',
  shipped:         'Your order is on its way.',
  delivered:       'Your order has been delivered. Enjoy!',
};

// Only 'paid' orders can be cancelled (not yet prepared for shipment)
const CANCELLABLE_STATUSES: OrderStatus[] = ['paid'];

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading, error } = useOrder(orderId ?? '');
  const cancelMutation = useCancelOrder(orderId ?? '');
  const [showConfirm, setShowConfirm] = useState(false);

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error || !order) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-20)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>Order not found.</p>
        <Link to="/orders" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--sp-4)' }}>
          ← Back to orders
        </Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[order.status] ?? { variant: 'default' as const, label: order.status };
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
      <BackButton to="/orders" label="Back to orders" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-8)' }}>
        <div>
          <span className="section-eyebrow">Order</span>
          <h1 className="heading-1" style={{ marginBottom: 'var(--sp-1)' }}>
            #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
            Placed on {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Status card */}
      <div className="order-detail-card" style={{ marginBottom: 'var(--sp-5)' }}>
        <p className="order-detail-section-label">Order status</p>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
          {STATUS_DESCRIPTION[order.status]}
        </p>
        {order.status === 'shipped' && (
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 'var(--sp-2)' }}>
            Expected delivery: 3–5 business days from shipment.
          </p>
        )}
      </div>

      {/* Items */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="order-detail-card" style={{ marginBottom: 'var(--sp-5)' }}>
          <p className="order-detail-section-label">Items ordered</p>
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
                    <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>Size: {item.selected_size}</p>
                  )}
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>×{item.quantity}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>${item.total_price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Cost breakdown */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-4)', marginTop: 'var(--sp-2)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <CostRow label="Subtotal" value={subtotal} />
            {shippingCost > 0
              ? <CostRow label={`Shipping${order.shipping_method_name ? ` (${order.shipping_method_name})` : ''}`} value={shippingCost} />
              : <CostRow label="Shipping" value={0} display="Free" />
            }
            {taxAmount > 0 && <CostRow label="Tax (10%)" value={taxAmount} />}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-2)', marginTop: 'var(--sp-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Shipping address */}
      {addr && (
        <div className="order-detail-card" style={{ marginBottom: 'var(--sp-5)' }}>
          <p className="order-detail-section-label">Shipping address</p>
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
          <p className="order-detail-section-label">Shipping method</p>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>
            {order.shipping_method_name}
            {shippingCost === 0 && ' — Free'}
          </p>
        </div>
      )}

      {/* Cancel section */}
      <div className="order-detail-card">
        <p className="order-detail-section-label">Actions</p>
        {canCancel ? (
          <>
            {!showConfirm ? (
              <div>
                <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 'var(--sp-4)' }}>
                  You can cancel this order since it hasn't shipped yet.
                </p>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowConfirm(true)}
                >
                  Cancel order
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 14, color: 'var(--color-text)', marginBottom: 'var(--sp-4)' }}>
                  Are you sure you want to cancel this order? This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel order'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowConfirm(false)}
                    disabled={cancelMutation.isPending}
                  >
                    Keep order
                  </button>
                </div>
                {cancelMutation.isError && (
                  <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 'var(--sp-3)' }}>
                    Failed to cancel order. Please try again.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
            {order.status === 'shipped' && 'This order has already shipped and cannot be cancelled.'}
            {order.status === 'delivered' && 'This order has been delivered and cannot be cancelled.'}
            {order.status === 'cancelled' && 'This order has already been cancelled.'}
            {order.status === 'failed' && 'This order failed and was not charged.'}
            {(order.status === 'pending' || order.status === 'processing' || order.status === 'requires_action') &&
              'Order cancellation is not available at this stage.'}
          </p>
        )}
      </div>
    </div>
  );
}

function CostRow({ label, value, display }: { label: string; value: number; display?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
        {display ?? `$${value.toFixed(2)}`}
      </span>
    </div>
  );
}
