import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BackButton } from '../../../components/ui/BackButton';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useOrders } from '../../../hooks/useOrders';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { supabase } from '../../../lib/supabaseClient';
import type { Order, OrderStatus } from '../../../types';

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

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['processing', 'paid', 'shipped'];
const PURCHASED_ORDER_STATUSES: OrderStatus[] = ['paid', 'shipped', 'delivered'];

const STATUS_BADGE: Record<OrderStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  processing: { variant: 'accent', label: 'Processing' },
  requires_action: { variant: 'warning', label: 'Action required' },
  paid: { variant: 'success', label: 'Confirmed' },
  failed: { variant: 'danger', label: 'Failed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  shipped: { variant: 'accent', label: 'Shipped' },
  delivered: { variant: 'success', label: 'Delivered' },
};

export function ProfilePage() {
  const { user, profile } = useAuth();
  const { data: orders = [], isLoading, error } = useOrders();

  const displayName = useMemo(() => {
    const trimmedName = profile?.full_name?.trim();
    if (trimmedName) return trimmedName;

    const localPart = user?.email?.split('@')[0]?.trim();
    if (localPart) return localPart;

    return 'Customer';
  }, [profile?.full_name, user?.email]);

  const avatarInitial = displayName.charAt(0).toUpperCase();
  const activeOrders = orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status));
  const inProgressCount = activeOrders.length;

  const recentPurchasedItems = useMemo(() => {
    return orders
      .filter((order) => PURCHASED_ORDER_STATUSES.includes(order.status))
      .flatMap((order) => order.order_items ?? [])
      .slice(0, 6);
  }, [orders]);

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

  const buyAgainById = useMemo(
    () => new Map(buyAgainProducts.map((product) => [product.id, product])),
    [buyAgainProducts]
  );

  const buyAgainTiles = recentPurchasedItems
    .map((item, index) => {
      const product = buyAgainById.get(item.product_id);
      if (!product) return null;

      const image =
        product.product_images?.find((img) => img.is_primary) ??
        product.product_images?.slice().sort((a, b) => a.sort_order - b.sort_order)[0] ??
        null;

      return (
        <Link key={`${item.id}-${index}`} to={`/products/${product.slug}`} className="buy-again-card">
          <div className="buy-again-card__image-wrap">
            <img
              src={image?.url ?? 'https://placehold.co/480x480/f5f5f7/aeaeb2?text=No+image'}
              alt={image?.alt_text ?? product.name}
              className="buy-again-card__image"
              loading="lazy"
            />
          </div>
          <p className="buy-again-card__name">{product.name}</p>
        </Link>
      );
    })
    .filter(Boolean);

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-20)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>
          Failed to load profile data. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <div className="profile-scene">
        <BackButton />
        <div className="profile-page__head">
          <div>
            <span className="section-eyebrow">Account</span>
            <h1 className="heading-1" style={{ marginBottom: 0 }}>Profile</h1>
          </div>
          <button type="button" className="profile-settings-btn" aria-label="Open settings">
            <IconGear />
          </button>
        </div>

        <section className="profile-hero">
          <div className="profile-avatar" aria-hidden="true">{avatarInitial}</div>
          <div className="profile-hero__content">
            <p className="profile-greeting">Dear customer, {displayName}</p>
            <p className="profile-identity__name">{displayName}</p>
            <p className="profile-identity__email">{profile?.email ?? user?.email ?? 'No email available'}</p>
          </div>
        </section>

        <section className="profile-promo" aria-label="Member offer banner">
          <div className="profile-promo__glow profile-promo__glow--one" aria-hidden="true" />
          <div className="profile-promo__glow profile-promo__glow--two" aria-hidden="true" />

          <div className="profile-promo__body">
            <span className="profile-promo__eyebrow">Highlights</span>
            <h2 className="profile-promo__title">Fresh picks selected for your next order</h2>
            <p className="profile-promo__sub">
              Explore trending products and keep your shopping flow simple, quick, and organized.
            </p>

            <div className="profile-promo__chips" aria-hidden="true">
              <span className="profile-promo__chip">Quick reorder</span>
              <span className="profile-promo__chip">Priority support</span>
              {inProgressCount > 0 && (
                <span className="profile-promo__chip">{inProgressCount} in progress</span>
              )}
            </div>

            <div className="profile-promo__actions">
              <Link to="/products" className="btn btn-primary btn-sm">Shop now</Link>
              <Link to="/cart" className="btn btn-ghost btn-sm">Go to cart</Link>
            </div>
          </div>
        </section>
      </div>

      {activeOrders.length > 0 && (
        <section className="profile-section">
          <div className="profile-section__head">
            <span className="section-eyebrow">Orders</span>
            <h2 className="heading-2" style={{ marginBottom: 0 }}>Orders in progress</h2>
          </div>

          <div className="profile-orders-grid">
            {activeOrders.map((order) => (
              <ActiveOrderCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      {buyAgainTiles.length > 0 && (
        <section className="profile-section">
          <div className="profile-section__head">
            <span className="section-eyebrow">Recommendations</span>
            <h2 className="heading-2" style={{ marginBottom: 0 }}>Buy again</h2>
          </div>

          <div className="buy-again-grid">{buyAgainTiles}</div>
        </section>
      )}
    </div>
  );
}

function ActiveOrderCard({ order }: { order: Order }) {
  const badge = STATUS_BADGE[order.status] ?? { variant: 'default' as const, label: order.status };
  const firstItemName = order.order_items?.[0]?.product_name ?? 'Product';
  const extraItemsCount = Math.max((order.order_items?.length ?? 0) - 1, 0);
  const title = extraItemsCount > 0
    ? `${firstItemName} +${extraItemsCount} more`
    : firstItemName;

  return (
    <Link to={`/orders/${order.id}`} className="profile-order-card">
      <div className="profile-order-card__head">
        <p className="profile-order-card__id">{title}</p>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <p className="profile-order-card__date">
        {new Date(order.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>
      <p className="profile-order-card__items">
        {order.order_items?.length ?? 0} item{order.order_items?.length !== 1 ? 's' : ''}
      </p>
      <p className="profile-order-card__total">${order.total.toFixed(2)}</p>
    </Link>
  );
}

function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-.33-1 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .33 1 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.3.46.65.6 1 .14.35.22.72.23 1.1 0 .38-.08.75-.23 1.1-.14.35-.34.7-.6 1z" />
    </svg>
  );
}
