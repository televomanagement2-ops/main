import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wordmark } from '../ui/Wordmark';
import { IconArrowUpRight, IconClose, IconMoon, IconSun } from '../ui/icons';
import { useUiStore } from '../../store/uiStore';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { useThemeStore } from '../../store/themeStore';
import { LANGUAGE_OPTIONS, usePreferencesStore, type AppLanguageCode } from '../../store/preferencesStore';
import { useI18n } from '../../lib/i18n';

/**
 * Mobile navigation is a full surface, not a compressed desktop bar: the
 * primary destinations are set large in the editorial serif, with preferences
 * and legal tucked underneath.
 */
export function MobileMenu() {
  const { t } = useI18n();
  const location = useLocation();
  const close = useUiStore((s) => s.close);
  const { isAuthenticated } = useAuth();
  const { data: categories = [] } = useCategories();
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const { theme, setTheme } = useThemeStore();

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => close(), [location.pathname, location.search, close]);
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [close]);

  const primary = [
    { to: '/products', label: t('nav.shop') },
    { to: '/orders', label: t('sidebar.myOrders'), auth: true },
    { to: '/help', label: t('nav.about') },
  ].filter((item) => !item.auth || isAuthenticated);

  return (
    <div className="mobile-menu" role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
      <div className="page mobile-menu__head">
        <Wordmark />
        <button type="button" className="drawer__close" onClick={close} aria-label={t('common.close')}>
          <IconClose size={18} />
        </button>
      </div>

      <div className="page mobile-menu__body">
        <nav className="mobile-menu__list" aria-label={t('nav.mainNavigation')}>
          {primary.map((item, i) => (
            <Link
              key={item.to}
              to={item.to}
              className="mobile-menu__link"
              style={{ animationDelay: `${40 + i * 40}ms` }}
            >
              <span>{item.label}</span>
              <IconArrowUpRight size={18} />
            </Link>
          ))}
        </nav>

        {categories.length > 0 && (
          <section className="mobile-menu__section">
            <p className="t-label" style={{ marginBottom: 'var(--s-2)' }}>{t('nav.collections')}</p>
            {categories.slice(0, 8).map((category) => (
              <Link key={category.id} to={`/products?category=${category.slug}`} className="mobile-menu__sub">
                <span>{category.name}</span>
                <IconArrowUpRight size={14} />
              </Link>
            ))}
          </section>
        )}

        <section className="mobile-menu__section">
          <p className="t-label" style={{ marginBottom: 'var(--s-2)' }}>{t('sidebar.account')}</p>
          {isAuthenticated ? (
            <Link to="/profile" className="mobile-menu__sub">
              <span>{t('sidebar.profile')}</span>
              <IconArrowUpRight size={14} />
            </Link>
          ) : (
            <Link to="/login" className="mobile-menu__sub">
              <span>{t('nav.signIn')}</span>
              <IconArrowUpRight size={14} />
            </Link>
          )}
          <Link to="/cart" className="mobile-menu__sub">
            <span>{t('nav.cart')}</span>
            <IconArrowUpRight size={14} />
          </Link>
        </section>

        <section className="mobile-menu__section">
          <p className="t-label" style={{ marginBottom: 'var(--s-3)' }}>{t('settings.preferences')}</p>
          <div className="row row--between" style={{ paddingBlock: 'var(--s-3)' }}>
            <span className="t-sm">{t('profile.appearance')}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? t('profile.lightMode') : t('profile.darkMode')}
            >
              {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
          </div>
          <div className="row row--wrap gap-2" style={{ paddingBlock: 'var(--s-2)' }}>
            {(Object.keys(LANGUAGE_OPTIONS) as AppLanguageCode[]).map((code) => (
              <button
                key={code}
                type="button"
                className={`filter-chip${language === code ? ' is-active' : ''}`}
                onClick={() => setLanguage(code)}
                aria-pressed={language === code}
              >
                {LANGUAGE_OPTIONS[code].label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
