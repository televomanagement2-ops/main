import { Link } from 'react-router-dom';
import { useOrders } from '../../../hooks/useOrders';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { OrderStatus as OrderStatusIndicator } from '../../../components/ui/StatusIndicator';
import { IconChevronRight } from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import type { Order, OrderStatus } from '../../../types';

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'processing', 'requires_action', 'paid', 'shipped'];
const HISTORY_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'failed', 'refunded'];

export function OrdersPage() {
  const { data: orders = [], isLoading, error } = useOrders();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="page">
        <header className="account-head">
          <div className="account-head__title">
            <p className="t-label">{t('orders.account')}</p>
            <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{t('orders.title')}</h1>
          </div>
        </header>
        <RowsSkeleton rows={5} height={72} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ paddingTop: 'var(--s-16)' }}>
        <ErrorMessage />
      </div>
    );
  }

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const history = orders.filter((o) => HISTORY_STATUSES.includes(o.status));

  return (
    <div className="page">
      <header className="account-head">
        <div className="account-head__title">
          <p className="t-label">{t('orders.account')}</p>
          <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{t('orders.title')}</h1>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t('orders.emptyTitle')}</p>
          <p className="empty__body">{t('orders.emptySubtitle')}</p>
          <Link to="/products" className="btn btn--primary">{t('orders.startShopping')}</Link>
        </div>
      ) : (
        <div className="stack gap-10" style={{ paddingBottom: 'var(--s-20)' }}>
          {active.length > 0 && <OrderSection label={t('orders.inProgress')} orders={active} />}
          {history.length > 0 && <OrderSection label={t('orders.history')} orders={history} />}
        </div>
      )}
    </div>
  );
}

function OrderSection({ label, orders }: { label: string; orders: Order[] }) {
  return (
    <section>
      <p className="t-label" style={{ marginBottom: 'var(--s-4)' }}>{label}</p>
      <div>
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </div>
    </section>
  );
}

function OrderRow({ order }: { order: Order }) {
  const { t, tCount, formatDate, formatCurrency } = useI18n();
  const title = order.order_items?.[0]?.product_name ?? t('orderDetail.order');
  const extra = Math.max((order.order_items?.length ?? 0) - 1, 0);

  return (
    <Link to={`/orders/${order.id}`} className="order-row">
      <div style={{ minWidth: 0 }}>
        <p className="order-row__title">
          {title}
          {extra > 0 && <span className="t-faint"> +{extra}</span>}
        </p>
        <p className="order-row__meta">
          {formatDate(new Date(order.created_at))} · {tCount('orders.items', order.order_items?.length ?? 0)}
        </p>
      </div>

      <div className="order-row__status">
        <OrderStatusIndicator status={order.status} />
      </div>

      <p className="order-row__total">{formatCurrency(order.total)}</p>

      <IconChevronRight size={15} className="order-row__chev" />
    </Link>
  );
}
