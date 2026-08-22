import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import { useCartStore } from '../../../store/cartStore';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconCheck } from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import type { Order } from '../../../types';

async function fetchOrderBySession(sessionId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as Order | null;
}

export function CheckoutSuccessPage() {
  const { t, formatCurrency } = useI18n();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const cartCleared = useRef(false);
  const clearCart = useCartStore((s) => s.clearCart);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order-by-session', sessionId],
    queryFn: () => fetchOrderBySession(sessionId!),
    enabled: Boolean(sessionId),
    // Retry a few times: the webhook may arrive shortly after the redirect
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: Infinity,
  });

  // Clear the local cart exactly once, only after we confirm the order exists
  useEffect(() => {
    if (order && !cartCleared.current) {
      cartCleared.current = true;
      clearCart();
    }
  }, [order, clearCart]);

  if (!sessionId) {
    return (
      <div className="page">
        <div className="result">
          <span className="result__mark result__mark--critical"><IconAlert size={20} /></span>
          <h1 className="t-h2">{t('checkoutSuccess.invalidLink')}</h1>
          <p className="t-body">{t('checkoutSuccess.invalidLinkSub')}</p>
          <div className="result__actions">
            <Link to="/products" className="btn btn--primary">{t('checkoutSuccess.browseProducts')}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page">
        <div className="result">
          <Spinner size="lg" label={t('checkoutSuccess.confirmingPayment')} />
          <p className="t-body" style={{ marginTop: 'var(--s-4)' }}>
            {t('checkoutSuccess.confirmingPayment')}
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page">
        <div className="result">
          <span className="result__mark"><IconCheck size={20} /></span>
          <h1 className="t-h2">{t('checkoutSuccess.paymentReceived')}</h1>
          <p className="t-body">{t('checkoutSuccess.paymentReceivedSub')}</p>
          <div className="result__actions">
            <Link to="/orders" className="btn btn--primary">{t('checkoutSuccess.viewOrders')}</Link>
            <Link to="/products" className="btn btn--secondary">{t('checkoutSuccess.continueShopping')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered';
  const requiresAction = order.status === 'requires_action';

  return (
    <div className="page">
      <div className="result">
        <span className={`result__mark${isPaid ? ' result__mark--positive' : ''}`}>
          {isPaid ? <IconCheck size={20} /> : <IconAlert size={20} />}
        </span>

        <p className="t-label">{t('checkoutSuccess.label')}</p>
        <h1 className="t-h1">
          {isPaid
            ? t('checkoutSuccess.orderConfirmed')
            : requiresAction
            ? t('checkoutSuccess.actionRequired')
            : t('checkoutSuccess.orderReceived')}
        </h1>
        <p className="t-body t-measure">
          {isPaid
            ? t('checkoutSuccess.paidSub')
            : requiresAction
            ? t('checkoutSuccess.requiresActionSub')
            : t('checkoutSuccess.processingSub')}
        </p>

        <div className="result__panel">
          <p className="t-label" style={{ marginBottom: 'var(--s-3)' }}>
            {t('checkoutSuccess.orderLabel')} · {order.id.slice(0, 8).toUpperCase()}
          </p>
          <div className="info-rows">
            {order.order_items?.map((item) => (
              <div key={item.id} className="info-row">
                <span>
                  {item.product_name} × {item.quantity}
                </span>
                <strong>{formatCurrency(item.total_price)}</strong>
              </div>
            ))}
          </div>
          <div className="summary__row summary__row--total">
            <span>{t('checkoutSuccess.total')}</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>

        <div className="result__actions">
          <Link to={`/orders/${order.id}`} className="btn btn--primary">{t('checkoutSuccess.viewOrders')}</Link>
          <Link to="/products" className="btn btn--secondary">{t('checkoutSuccess.continueShopping')}</Link>
        </div>
      </div>
    </div>
  );
}
