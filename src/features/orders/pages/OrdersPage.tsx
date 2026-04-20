import { Link } from 'react-router-dom';
import { useOrders } from '../../../hooks/useOrders';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import type { Order, OrderStatus } from '../../../types';

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

// Orders visible in "My Orders" — only confirmed/fulfilled ones.
// pending/processing/requires_action = payment not confirmed yet (webhook pending).
// failed/cancelled = terminal failures, not shown.
const VISIBLE_STATUSES: OrderStatus[] = ['paid', 'shipped', 'delivered'];
const IN_TRANSIT_STATUSES: OrderStatus[] = ['shipped'];

export function OrdersPage() {
  const { data: allOrders = [], isLoading, error } = useOrders();

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-20)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>
          Failed to load orders. Please try again.
        </p>
      </div>
    );
  }

  const orders = allOrders.filter((o) => VISIBLE_STATUSES.includes(o.status));
  const activeOrders = orders.filter((o) => IN_TRANSIT_STATUSES.includes(o.status));
  const pastOrders   = orders.filter((o) => !IN_TRANSIT_STATUSES.includes(o.status));

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <div style={{ marginBottom: 'var(--sp-10)' }}>
        <span className="section-eyebrow">Account</span>
        <h1 className="heading-1" style={{ marginBottom: 0 }}>My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <div className="cart-empty-state">
          <svg className="cart-empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p className="cart-empty-state__title">No confirmed orders yet</p>
          <p className="cart-empty-state__sub">Completed orders will appear here after payment is confirmed.</p>
          <Link to="/products" className="btn btn-primary" style={{ marginTop: 'var(--sp-2)' }}>
            Start shopping
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-12)' }}>
          {activeOrders.length > 0 && (
            <section>
              <div style={{ marginBottom: 'var(--sp-5)' }}>
                <span className="section-eyebrow">In transit</span>
                <h2 className="heading-2" style={{ marginBottom: 0 }}>Shipped orders</h2>
              </div>
              <div className="orders-list">
                {activeOrders.map((order) => (
                  <OrderCard key={order.id} order={order} highlight />
                ))}
              </div>
            </section>
          )}

          {pastOrders.length > 0 && (
            <section>
              <div style={{ marginBottom: 'var(--sp-5)' }}>
                <span className="section-eyebrow">History</span>
                <h2 className="heading-2" style={{ marginBottom: 0 }}>Order history</h2>
              </div>
              <div className="orders-list">
                {pastOrders.map((order) => (
                  <OrderCard key={order.id} order={order} highlight={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, highlight }: { order: Order; highlight: boolean }) {
  const badge = STATUS_BADGE[order.status] ?? { variant: 'default' as const, label: order.status };

  return (
    <Link
      to={`/orders/${order.id}`}
      className="order-card order-card--link"
      style={highlight ? {
        borderColor: 'var(--accent-border)',
        boxShadow: '0 0 0 1px var(--accent-border)',
      } : {}}
    >
      <div className="order-card__head">
        <div>
          <p className="order-card__id">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="order-card__date">
            {new Date(order.created_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
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
                <span style={{ fontWeight: 600 }}>${item.total_price.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {order.shipping_method_name && (
            <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 'var(--sp-2)' }}>
              Shipping: {order.shipping_method_name}
              {order.shipping_cost > 0 && ` — $${order.shipping_cost.toFixed(2)}`}
            </p>
          )}
        </div>
      )}

      <div className="order-card__foot">
        <span style={{ fontSize: 12.5, color: 'var(--color-text-3)' }}>
          {order.order_items?.length ?? 0} item{order.order_items?.length !== 1 ? 's' : ''}
        </span>
        <span className="order-card__total">${order.total.toFixed(2)}</span>
      </div>
    </Link>
  );
}
