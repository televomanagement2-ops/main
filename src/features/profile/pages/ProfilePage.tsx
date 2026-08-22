import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useOrders } from '../../../hooks/useOrders';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Media } from '../../../components/ui/Media';
import { Badge } from '../../../components/ui/Badge';
import { OrderStatus as OrderStatusIndicator } from '../../../components/ui/StatusIndicator';
import { IconChart, IconChevronRight, IconLogout, IconSettings } from '../../../components/ui/icons';
import { supabase } from '../../../lib/supabaseClient';
import { useI18n } from '../../../lib/i18n';
import type { OrderStatus } from '../../../types';

interface BuyAgainProduct {
  id: string;
  slug: string;
  name: string;
  product_images?: Array<{
    url: string;
    alt_text: string | null;
    is_primary: boolean;
    sort_order: number;
  }>;
}

const PURCHASED_ORDER_STATUSES: OrderStatus[] = ['paid', 'shipped', 'delivered'];
const OPEN_ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'requires_action', 'paid', 'shipped'];

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const { data: orders = [], isLoading, error } = useOrders();
  const { t, tCount, formatDate, formatCurrency } = useI18n();

  const displayName = useMemo(() => {
    const trimmed = profile?.full_name?.trim();
    if (trimmed) return trimmed;
    const localPart = user?.email?.split('@')[0]?.trim();
    if (localPart) return localPart;
    return t('profile.customerFallback');
  }, [profile?.full_name, user?.email, t]);

  const recentPurchasedItems = useMemo(
    () =>
      orders
        .filter((order) => PURCHASED_ORDER_STATUSES.includes(order.status))
        .flatMap((order) => order.order_items ?? [])
        .slice(0, 6),
    [orders]
  );

  const productIds = useMemo(
    () => [...new Set(recentPurchasedItems.map((item) => item.product_id))],
    [recentPurchasedItems]
  );

  const { data: buyAgainProducts = [] } = useQuery({
    queryKey: ['profile-buy-again-products', productIds],
    enabled: productIds.length > 0,
    queryFn: async (): Promise<BuyAgainProduct[]> => {
      const { data, error: queryError } = await supabase
        .from('products')
        .select('id, slug, name, product_images(url, alt_text, is_primary, sort_order)')
        .in('id', productIds)
        .eq('is_active', true);

      if (queryError) throw queryError;
      return (data as BuyAgainProduct[]) ?? [];
    },
  });

  const buyAgain = useMemo(() => {
    const byId = new Map(buyAgainProducts.map((p) => [p.id, p]));
    const seen = new Set<string>();
    return recentPurchasedItems
      .map((item) => byId.get(item.product_id))
      .filter((p): p is BuyAgainProduct => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .slice(0, 5);
  }, [recentPurchasedItems, buyAgainProducts]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // The head and the admin entry depend only on the session, so they render
  // even while the orders query is loading or has failed — the way into the
  // dashboard must never hang on an unrelated request.
  const accountHead = (
    <header className="account-head">
      <div className="account-head__title">
        <p className="t-label">{t('profile.account')}</p>
        <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{displayName}</h1>
        <p className="t-sm t-faint" style={{ marginTop: 'var(--s-3)' }}>
          {profile?.email ?? user?.email ?? t('profile.noEmail')}
        </p>
        {/* The role the app currently sees. Shown for customers too: after a
            change in Supabase this line is how you check it actually landed. */}
        {profile && (
          <p style={{ marginTop: 'var(--s-3)' }}>
            <Badge accent={isAdmin}>
              {isAdmin ? t('sidebar.admin') : t('profile.roleCustomer')}
            </Badge>
          </p>
        )}
      </div>
      <div className="account-head__actions">
        <Link to="/settings" className="icon-btn" aria-label={t('profile.openSettings')}>
          <IconSettings size={16} />
        </Link>
        <button type="button" className="icon-btn" onClick={handleSignOut} aria-label={t('nav.signOut')}>
          <IconLogout size={16} />
        </button>
      </div>
    </header>
  );

  const adminEntry = isAdmin ? (
    <section className="panel admin-entry">
      <div className="admin-entry__text">
        <p className="t-label">{t('sidebar.admin')}</p>
        <h2 className="t-h3" style={{ marginTop: 'var(--s-2)' }}>{t('profile.adminTitle')}</h2>
        <p className="t-sm t-faint" style={{ marginTop: 'var(--s-2)', maxWidth: '46ch' }}>
          {t('profile.adminBody')}
        </p>
      </div>
      <Link to="/admin" className="btn btn--primary">
        <IconChart size={15} />
        {t('sidebar.dashboard')}
      </Link>
    </section>
  ) : null;

  if (isLoading) {
    return (
      <div className="page" style={{ paddingBottom: 'var(--s-20)' }}>
        {accountHead}
        {adminEntry}
        <RowsSkeleton rows={4} height={72} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ paddingBottom: 'var(--s-20)' }}>
        {accountHead}
        {adminEntry}
        <ErrorMessage />
      </div>
    );
  }

  const openOrders = orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status));
  const lifetime = orders
    .filter((o) => PURCHASED_ORDER_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="page" style={{ paddingBottom: 'var(--s-20)' }}>
      {accountHead}
      {adminEntry}

      {/* Account snapshot — numbers first, no decorative panels. */}
      <div className="kpi-strip" style={{ marginBottom: 'clamp(40px, 5vw, 72px)' }}>
        <div className="kpi">
          <p className="t-label">{t('profile.stats.open')}</p>
          <p className="kpi__value">{openOrders.length}</p>
          <p className="kpi__meta">{t('profile.stats.openMeta')}</p>
        </div>
        <div className="kpi">
          <p className="t-label">{t('profile.stats.total')}</p>
          <p className="kpi__value">{orders.length}</p>
          <p className="kpi__meta">{t('profile.stats.totalMeta')}</p>
        </div>
        <div className="kpi">
          <p className="t-label">{t('profile.stats.spend')}</p>
          <p className="kpi__value">{formatCurrency(lifetime)}</p>
          <p className="kpi__meta">{t('profile.stats.spendMeta')}</p>
        </div>
        <div className="kpi">
          <p className="t-label">{t('profile.stats.since')}</p>
          <p className="kpi__value">
            {profile?.created_at ? formatDate(new Date(profile.created_at), { year: 'numeric', month: 'short' }) : '—'}
          </p>
          <p className="kpi__meta">{t('profile.stats.sinceMeta')}</p>
        </div>
      </div>

      {orders.length > 0 && (
        <section style={{ marginBottom: 'clamp(48px, 6vw, 88px)' }}>
          <div className="section-head" style={{ marginBottom: 'var(--s-5)' }}>
            <div>
              <p className="t-label">{t('orders.inProgress')}</p>
              <h2 className="t-h2 section-head__title">{t('profile.recentOrders')}</h2>
            </div>
            <Link to="/orders" className="link-arrow">{t('profile.allOrders')}</Link>
          </div>

          <div>
            {orders.slice(0, 4).map((order) => (
              <Link key={order.id} to={`/orders/${order.id}`} className="order-row">
                <div style={{ minWidth: 0 }}>
                  <p className="order-row__title">
                    {order.order_items?.[0]?.product_name ?? t('orderDetail.order')}
                  </p>
                  <p className="order-row__meta">
                    {formatDate(new Date(order.created_at))} ·{' '}
                    {tCount('orders.items', order.order_items?.length ?? 0)}
                  </p>
                </div>
                <div className="order-row__status">
                  <OrderStatusIndicator status={order.status} />
                </div>
                <p className="order-row__total">{formatCurrency(order.total)}</p>
                <IconChevronRight size={15} className="order-row__chev" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {buyAgain.length > 0 && (
        <section>
          <div className="section-head" style={{ marginBottom: 'var(--s-5)' }}>
            <div>
              <p className="t-label">{t('profile.recommendations')}</p>
              <h2 className="t-h2 section-head__title">{t('profile.buyAgain')}</h2>
            </div>
          </div>

          <div className="tile-row">
            {buyAgain.map((product) => {
              const image =
                product.product_images?.find((img) => img.is_primary) ??
                product.product_images?.slice().sort((a, b) => a.sort_order - b.sort_order)[0] ??
                null;
              return (
                <Link key={product.id} to={`/products/${product.slug}`} className="pcard">
                  <div className="pcard__media">
                    <Media src={image?.url} alt={image?.alt_text ?? product.name} ratio="square" zoom />
                  </div>
                  <div className="pcard__body">
                    <span className="pcard__name">{product.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {orders.length === 0 && (
        <div className="empty">
          <p className="empty__title">{t('orders.emptyTitle')}</p>
          <p className="empty__body">{t('orders.emptySubtitle')}</p>
          <Link to="/products" className="btn btn--primary">{t('orders.startShopping')}</Link>
        </div>
      )}
    </div>
  );
}
