import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import { useCartStore } from '../../../store/cartStore';
import { Spinner } from '../../../components/ui/Spinner';
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
      <div className="container">
        <div className="result-state result-state--error">
          <h1 className="result-state__title">Invalid link</h1>
          <p className="result-state__sub">No payment session found in the URL.</p>
          <div className="result-state__actions">
            <Link to="/products" className="btn btn-primary btn-lg">Browse products</Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container">
        <div className="result-state">
          <Spinner />
          <p className="result-state__sub" style={{ marginTop: 'var(--sp-4)' }}>
            Confirming your payment…
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container">
        <div className="result-state result-state--warning">
          <h1 className="result-state__title">Payment received</h1>
          <p className="result-state__sub">
            Your payment was processed but we couldn't load your order details yet.
            Check <Link to="/orders">My Orders</Link> in a moment.
          </p>
          <div className="result-state__actions">
            <Link to="/orders" className="btn btn-primary btn-lg">View my orders</Link>
            <Link to="/products" className="btn btn-ghost btn-lg">Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = order.status === 'paid' || order.status === 'shipped' || order.status === 'delivered';
  const requiresAction = order.status === 'requires_action';

  return (
    <div className="container">
      <div className={`result-state result-state--${isPaid ? 'success' : requiresAction ? 'warning' : 'success'}`}>
        <div className="result-state__icon">
          {isPaid ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </div>

        <h1 className="result-state__title">
          {isPaid ? 'Order confirmed!' : requiresAction ? 'Action required' : 'Order received'}
        </h1>

        <p className="result-state__sub">
          {isPaid
            ? "Thank you for your purchase. You'll receive a confirmation email shortly."
            : requiresAction
            ? 'Your payment requires additional verification. Please check your email.'
            : 'Your order is being processed.'}
        </p>

        {/* Order summary */}
        <div style={{
          background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-5) var(--sp-6)',
          margin: 'var(--sp-6) 0',
          textAlign: 'left',
          maxWidth: 400,
          width: '100%',
        }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 'var(--sp-3)' }}>
            Order #{order.id.slice(0, 8).toUpperCase()}
          </p>
          {order.order_items?.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: 'var(--sp-1) 0' }}>
              <span>{item.product_name} × {item.quantity}</span>
              <span>${item.total_price.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--sp-3)', paddingTop: 'var(--sp-3)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="result-state__actions">
          <Link to="/orders" className="btn btn-primary btn-lg">View my orders</Link>
          <Link to="/products" className="btn btn-ghost btn-lg">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
