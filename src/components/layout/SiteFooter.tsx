import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../ui/Wordmark';
import { IconCheck, IconChevronDown, IconMoon, IconSun } from '../ui/icons';
import { useCategories } from '../../hooks/useCategories';
import { useThemeStore } from '../../store/themeStore';
import { LANGUAGE_OPTIONS, usePreferencesStore, type AppLanguageCode } from '../../store/preferencesStore';
import { useI18n } from '../../lib/i18n';
import { storeConfig } from '../../config/storeConfig';

/**
 * The closing page of the publication: a brand line, the store's real
 * categories, support and legal — plus the two preferences that belong to the
 * reader rather than the store (language and appearance).
 */
export function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const { data: categories = [] } = useCategories();
  const telHref = `tel:${storeConfig.supportPhone.replace(/[^+\d]/g, '')}`;

  return (
    <footer className="site-footer">
      <div className="page">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Wordmark size="serif" />
            <p className="site-footer__statement">{t('footer.tagline')}</p>
            <a href={`mailto:${storeConfig.contactEmail}`} className="link-arrow" style={{ marginTop: 'var(--s-2)' }}>
              {storeConfig.contactEmail}
            </a>
          </div>

          <div className="site-footer__cols">
            <nav className="footer-col" aria-label={t('footer.shop')}>
              <p className="t-label footer-col__title">{t('footer.shop')}</p>
              <Link to="/products">{t('footer.allProducts')}</Link>
              {categories.slice(0, 4).map((category) => (
                <Link key={category.id} to={`/products?category=${category.slug}`}>
                  {category.name}
                </Link>
              ))}
            </nav>

            <nav className="footer-col" aria-label={t('footer.help')}>
              <p className="t-label footer-col__title">{t('footer.help')}</p>
              <Link to="/help">{t('footer.faq')}</Link>
              <Link to="/help">{t('footer.shippingReturns')}</Link>
              <Link to="/orders">{t('footer.ordersPayments')}</Link>
              <a href={telHref}>{storeConfig.supportPhone}</a>
            </nav>

            <nav className="footer-col" aria-label={t('footer.company')}>
              <p className="t-label footer-col__title">{t('footer.company')}</p>
              <Link to="/help">{t('footer.about')}</Link>
              <Link to="/profile">{t('sidebar.account')}</Link>
              <Link to="/settings">{t('footer.settings')}</Link>
            </nav>

            <nav className="footer-col" aria-label={t('footer.privacy')}>
              <p className="t-label footer-col__title">{t('footer.privacy')}</p>
              <Link to="/privacy-policy">{t('footer.privacyPolicy')}</Link>
              <Link to="/terms">{t('footer.terms')}</Link>
              <Link to="/cookies">{t('footer.cookie')}</Link>
            </nav>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p className="t-xs">
            © {year} {storeConfig.storeName} · {storeConfig.countryName}
          </p>
          <div className="site-footer__meta">
            <LanguagePicker />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}

function LanguagePicker() {
  const { t } = useI18n();
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="lang" ref={ref}>
      <button
        type="button"
        className="site-action"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('nav.selectLanguage')}
      >
        <span>{LANGUAGE_OPTIONS[language].label}</span>
        <IconChevronDown size={13} />
      </button>
      {open && (
        <div className="lang__menu" role="menu" style={{ bottom: 'calc(100% + 8px)', top: 'auto' }}>
          {(Object.keys(LANGUAGE_OPTIONS) as AppLanguageCode[]).map((code) => (
            <button
              key={code}
              type="button"
              role="menuitem"
              className={`lang__option${language === code ? ' is-active' : ''}`}
              onClick={() => {
                setLanguage(code);
                setOpen(false);
              }}
            >
              <span>{LANGUAGE_OPTIONS[code].label}</span>
              {language === code && <IconCheck size={13} className="lang__check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme } = useThemeStore();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <button
      type="button"
      className="site-action"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('profile.lightMode') : t('profile.darkMode')}
    >
      {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      <span className="hide-sm">{isDark ? t('profile.lightMode') : t('profile.darkMode')}</span>
    </button>
  );
}
