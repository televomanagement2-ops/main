import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Wordmark } from '../ui/Wordmark';
import { IconBag, IconChart, IconChevronDown, IconMenu, IconSearch, IconUser } from '../ui/icons';
import { useCartStore } from '../../store/cartStore';
import { useUiStore } from '../../store/uiStore';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { useI18n } from '../../lib/i18n';

/**
 * The storefront header. Brand left, navigation centre, three actions right —
 * no outlines, no pills, generous air. It compacts slightly on scroll and
 * gains a hairline; it never gains weight.
 */
export function SiteHeader() {
  const { t } = useI18n();
  const location = useLocation();
  const { isAuthenticated, isAdmin } = useAuth();
  const count = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const open = useUiStore((s) => s.open);
  const { data: categories = [] } = useCategories();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the collections panel on navigation — adjusted during render rather
  // than in an effect, so the panel never paints open on the new page.
  const locationKey = `${location.pathname}${location.search}`;
  const [seenLocation, setSeenLocation] = useState(locationKey);
  if (locationKey !== seenLocation) {
    setSeenLocation(locationKey);
    if (menuOpen) setMenuOpen(false);
  }

  // Close on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const roots = categories.filter((c) => !c.parent_id).slice(0, 8);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`} ref={navRef}>
      <div className="page site-header__inner">
        <button
          type="button"
          className="site-header__burger"
          onClick={() => open('menu')}
          aria-label={t('nav.openMenu')}
        >
          <IconMenu size={20} />
        </button>

        <div className="site-header__brand-wrap">
          <Wordmark />
        </div>

        <nav className="site-nav hide-sm" aria-label={t('nav.mainNavigation')}>
          {/* `end` so Home is only active on "/" — every other page would
              otherwise match it and light two items at once. */}
          <NavLink
            to="/"
            end
            className={({ isActive }) => `site-nav__link${isActive ? ' is-active' : ''}`}
          >
            {t('sidebar.home')}
          </NavLink>
          <NavLink
            to="/products"
            className={({ isActive }) => `site-nav__link${isActive ? ' is-active' : ''}`}
          >
            {t('nav.shop')}
          </NavLink>
          {roots.length > 0 && (
            <button
              type="button"
              className={`site-nav__link${menuOpen ? ' is-active' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              {t('nav.collections')}
            </button>
          )}
          <NavLink
            to="/help"
            className={({ isActive }) => `site-nav__link${isActive ? ' is-active' : ''}`}
          >
            {t('nav.about')}
          </NavLink>
        </nav>

        <div className="site-actions">
          {/* The only storefront door into the admin workspace — rendered for
              admins alone, so the role change in Supabase is visible here. */}
          {isAdmin && (
            <Link to="/admin" className="site-action site-action--admin" aria-label={t('sidebar.admin')}>
              <IconChart size={17} />
              <span className="site-action__label hide-sm">{t('sidebar.admin')}</span>
            </Link>
          )}

          <button
            type="button"
            className="site-action"
            onClick={() => open('search')}
            aria-label={t('nav.searchProducts')}
          >
            <IconSearch size={17} />
            <span className="site-action__label hide-sm">{t('nav.search')}</span>
          </button>

          <Link
            to={isAuthenticated ? '/profile' : '/login'}
            className="site-action"
            aria-label={t('nav.account')}
          >
            <IconUser size={17} />
            <span className="site-action__label hide-sm">{t('nav.account')}</span>
          </Link>

          <button
            type="button"
            className="site-action"
            onClick={() => open('cart')}
            aria-label={`${t('nav.cart')} (${count})`}
          >
            <IconBag size={17} />
            <span className="site-action__label hide-sm">{t('nav.cart')}</span>
            <span className="site-action__count">({count})</span>
          </button>
        </div>
      </div>

      {menuOpen && roots.length > 0 && (
        <div className="nav-panel" role="region" aria-label={t('nav.collections')}>
          <div className="page nav-panel__inner">
            <div className="nav-panel__intro">
              <p className="t-label">{t('nav.collections')}</p>
              <p className="t-sm t-faint" style={{ marginTop: 'var(--s-3)', maxWidth: '26ch' }}>
                {t('nav.collectionsNote')}
              </p>
            </div>
            <div className="nav-panel__list">
              {roots.map((category) => (
                <Link
                  key={category.id}
                  to={`/products?category=${category.slug}`}
                  className="nav-panel__link"
                >
                  <span>{category.name}</span>
                  <IconChevronDown size={14} className="nav-panel__link-arrow" />
                </Link>
              ))}
            </div>
            <div className="nav-panel__foot">
              <Link to="/products" className="link-arrow">
                {t('nav.viewEverything')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
