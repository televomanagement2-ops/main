import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCookieConsentStore } from '../../store/cookieConsentStore';
import { useI18n } from '../../lib/i18n';

/**
 * Self-hosted cookie consent banner.
 * Granular by design: necessary cookies are always on; analytics are opt-in.
 * "Reject all" is presented with the same prominence as "Accept all"
 * (Garante / EDPB guidance), and the choice can be revisited at any time
 * via the floating button or the Cookie Policy page.
 */
export function CookieConsentBanner() {
  const { t } = useI18n();
  const status = useCookieConsentStore((s) => s.status);
  const isPanelOpen = useCookieConsentStore((s) => s.isPanelOpen);
  const storedAnalytics = useCookieConsentStore((s) => s.categories.analytics);
  const acceptAll = useCookieConsentStore((s) => s.acceptAll);
  const rejectAll = useCookieConsentStore((s) => s.rejectAll);
  const savePreferences = useCookieConsentStore((s) => s.savePreferences);
  const openPreferences = useCookieConsentStore((s) => s.openPreferences);

  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(storedAnalytics);

  const bannerVisible = status === 'pending' || isPanelOpen;

  // When a decision has been made and the panel is closed, show only a small
  // floating button so the user can re-open preferences whenever they want.
  if (!bannerVisible) {
    return (
      <button
        type="button"
        className="cookie-fab"
        aria-label={t('cookies.banner.manageFloating')}
        title={t('cookies.banner.manageFloating')}
        onClick={() => {
          setAnalytics(storedAnalytics);
          setCustomizing(false);
          openPreferences();
        }}
      >
        🍪
      </button>
    );
  }

  return (
    <div
      className="cookie-consent"
      role="dialog"
      aria-modal="false"
      aria-label={t('cookies.banner.title')}
    >
      <div className="cookie-consent__card">
        <h2 className="cookie-consent__title">{t('cookies.banner.title')}</h2>
        <p className="cookie-consent__body">
          {t('cookies.banner.body')}{' '}
          <Link to="/cookies" className="cookie-consent__link">
            {t('footer.cookie')}
          </Link>
        </p>

        {customizing && (
          <div className="cookie-consent__categories">
            <label className="cookie-cat cookie-cat--locked">
              <span className="cookie-cat__text">
                <span className="cookie-cat__title">{t('cookies.banner.necessaryTitle')}</span>
                <span className="cookie-cat__desc">{t('cookies.banner.necessaryDesc')}</span>
              </span>
              <span className="cookie-cat__always">{t('cookies.banner.alwaysOn')}</span>
            </label>
            <label className="cookie-cat">
              <span className="cookie-cat__text">
                <span className="cookie-cat__title">{t('cookies.banner.analyticsTitle')}</span>
                <span className="cookie-cat__desc">{t('cookies.banner.analyticsDesc')}</span>
              </span>
              <input
                type="checkbox"
                className="cookie-cat__toggle"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                aria-label={t('cookies.banner.analyticsTitle')}
              />
            </label>
          </div>
        )}

        <div className="cookie-consent__actions">
          {customizing ? (
            <>
              <button type="button" className="cookie-btn" onClick={() => savePreferences(analytics)}>
                {t('cookies.banner.save')}
              </button>
              <button type="button" className="cookie-btn" onClick={rejectAll}>
                {t('cookies.banner.rejectAll')}
              </button>
              <button type="button" className="cookie-btn cookie-btn--primary" onClick={acceptAll}>
                {t('cookies.banner.acceptAll')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="cookie-btn" onClick={rejectAll}>
                {t('cookies.banner.rejectAll')}
              </button>
              <button type="button" className="cookie-btn" onClick={() => setCustomizing(true)}>
                {t('cookies.banner.customize')}
              </button>
              <button type="button" className="cookie-btn cookie-btn--primary" onClick={acceptAll}>
                {t('cookies.banner.acceptAll')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
