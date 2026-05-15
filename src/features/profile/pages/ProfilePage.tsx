import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackButton } from '../../../components/ui/BackButton';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useOrders } from '../../../hooks/useOrders';
import { Spinner } from '../../../components/ui/Spinner';
import { supabase } from '../../../lib/supabaseClient';
import type { OrderStatus } from '../../../types';
import { LANGUAGE_OPTIONS, usePreferencesStore, type AppLanguageCode } from '../../../store/preferencesStore';
import { useThemeStore } from '../../../store/themeStore';
import { useI18n } from '../../../lib/i18n';

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

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: orders = [], isLoading, error } = useOrders();
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();

  const displayName = useMemo(() => {
    const trimmedName = profile?.full_name?.trim();
    if (trimmedName) return trimmedName;

    const localPart = user?.email?.split('@')[0]?.trim();
    if (localPart) return localPart;

    return t('profile.customerFallback');
  }, [profile?.full_name, user?.email, t]);

  const avatarInitial = displayName.charAt(0).toUpperCase();

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

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!languageRef.current?.contains(target)) {
        setLanguageOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

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

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <div className="profile-scene">
        <BackButton />
        <div className="profile-page__head">
          <div>
            <span className="section-eyebrow">{t('profile.account')}</span>
            <h1 className="heading-1" style={{ marginBottom: 0 }}>{t('profile.title')}</h1>
          </div>
          <div className="profile-head-actions">
            <div className="profile-mobile-language" ref={languageRef}>
              <button
                type="button"
                className="profile-settings-btn profile-mobile-language__trigger"
                aria-label={t('profile.selectLanguage')}
                aria-expanded={languageOpen}
                onClick={() => setLanguageOpen((prev) => !prev)}
              >
                <span aria-hidden="true">{LANGUAGE_OPTIONS[language].flag}</span>
              </button>

              {languageOpen && (
                <div className="profile-mobile-language__menu" role="menu">
                  {(Object.keys(LANGUAGE_OPTIONS) as AppLanguageCode[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="menuitem"
                      className={`profile-mobile-language__option ${language === code ? 'is-active' : ''}`}
                      onClick={() => {
                        setLanguage(code);
                        setLanguageOpen(false);
                      }}
                    >
                      <span aria-hidden="true">{LANGUAGE_OPTIONS[code].flag}</span>
                      <span>{LANGUAGE_OPTIONS[code].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ThemeToggleButton />
            <button type="button" className="profile-settings-btn" aria-label={t('profile.openSettings')} onClick={() => navigate('/settings')}>
              <IconSettingsBetter />
            </button>
          </div>
        </div>

        <section className="profile-hero">
          <div className="profile-avatar" aria-hidden="true">{avatarInitial}</div>
          <div className="profile-hero__content">
            <p className="profile-greeting">{t('profile.greeting', { name: displayName })}</p>
            <p className="profile-identity__name">{displayName}</p>
            <p className="profile-identity__email">{profile?.email ?? user?.email ?? t('profile.noEmail')}</p>
          </div>
        </section>

        <section className="profile-promo" aria-label="Member offer banner">
          <div className="profile-promo__glow profile-promo__glow--one" aria-hidden="true" />
          <div className="profile-promo__glow profile-promo__glow--two" aria-hidden="true" />

          <div className="profile-promo__body">
            <span className="profile-promo__eyebrow">{t('profile.highlights')}</span>
            <h2 className="profile-promo__title">{t('profile.promoTitle')}</h2>
            <p className="profile-promo__sub">{t('profile.promoSub')}</p>

            <div className="profile-promo__chips" aria-hidden="true">
              <span className="profile-promo__chip">{t('profile.quickReorder')}</span>
              <span className="profile-promo__chip">{t('profile.prioritySupport')}</span>
            </div>

            <div className="profile-promo__actions">
              <Link to="/products" className="btn btn-primary btn-sm">{t('profile.shopNow')}</Link>
              <Link to="/cart" className="btn btn-ghost btn-sm">{t('profile.goToCart')}</Link>
            </div>
          </div>
        </section>

        <section className="profile-mobile-legals" aria-label={t('profile.account')}>
          <Link to="/help" className="btn btn-secondary btn-sm">
            {t('nav.help')}
          </Link>
          <Link to="/privacy" className="btn btn-secondary btn-sm">
            {t('nav.privacy')}
          </Link>
        </section>
      </div>

      {buyAgainTiles.length > 0 && (
        <section className="profile-section">
          <div className="profile-section__head">
            <span className="section-eyebrow">{t('profile.recommendations')}</span>
            <h2 className="heading-2" style={{ marginBottom: 0 }}>{t('profile.buyAgain')}</h2>
          </div>

          <div className="buy-again-grid">{buyAgainTiles}</div>
        </section>
      )}
    </div>
  );
}

function ThemeToggleButton() {
  const { theme, setTheme } = useThemeStore();
  const { t } = useI18n();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  return (
    <button
      type="button"
      className="profile-settings-btn"
      aria-label={isDark ? t('profile.lightMode') : t('profile.darkMode')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <IconSun /> : <IconMoon />}
    </button>
  );
}

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconSettingsBetter() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 14.9a1.4 1.4 0 0 0 .3 1.6l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.4 1.4 0 0 0-1.6-.3 1.4 1.4 0 0 0-.8 1.3V20a1.9 1.9 0 1 1-3.8 0v-.1a1.4 1.4 0 0 0-.8-1.3 1.4 1.4 0 0 0-1.6.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.4 1.4 0 0 0 .3-1.6 1.4 1.4 0 0 0-1.3-.8H4a1.9 1.9 0 1 1 0-3.8h.1a1.4 1.4 0 0 0 1.3-.8 1.4 1.4 0 0 0-.3-1.6l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.4 1.4 0 0 0 1.6.3h.1a1.4 1.4 0 0 0 .7-1.2V4a1.9 1.9 0 1 1 3.8 0v.1a1.4 1.4 0 0 0 .8 1.3 1.4 1.4 0 0 0 1.6-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.4 1.4 0 0 0-.3 1.6v.1a1.4 1.4 0 0 0 1.2.7h.1a1.9 1.9 0 1 1 0 3.8h-.1a1.4 1.4 0 0 0-1.3.8z" />
    </svg>
  );
}
