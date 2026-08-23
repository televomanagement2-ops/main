import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCookieConsentStore } from '../../store/cookieConsentStore';
import { useI18n } from '../../lib/i18n';
import { IconClose, IconSettings } from '../ui/icons';

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
  const closePanel = useCookieConsentStore((s) => s.closePanel);

  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(storedAnalytics);

  // Re-seed the draft every time the panel OPENS. This component stays mounted
  // for the life of the session, so `analytics` was otherwise frozen at its
  // mount-time value: someone who accepted analytics and later reopened the
  // panel from Settings or the Cookie Policy page saw the box unchecked, and
  // "Save preferences" then silently revoked the consent they had given. (The
  // floating button reseeded it by hand; the other two entry points did not.)
  const [panelWasOpen, setPanelWasOpen] = useState(isPanelOpen);
  if (isPanelOpen !== panelWasOpen) {
    setPanelWasOpen(isPanelOpen);
    if (isPanelOpen) {
      setAnalytics(storedAnalytics);
      setCustomizing(false);
    }
  }

  const bannerVisible = status === 'pending' || isPanelOpen;
  // A first-time visitor must decide; someone revisiting a decision already
  // made can back out without changing it.
  const dismissible = isPanelOpen && status !== 'pending';

  // Once a decision exists the banner collapses to a small, quiet control so
  // the choice stays reachable without occupying the page.
  if (!bannerVisible) {
    return (
      <button
        type="button"
        className="consent-fab"
        aria-label={t('cookies.banner.manageFloating')}
        title={t('cookies.banner.manageFloating')}
        // Seeding the draft is handled by the open-transition sync above.
        onClick={openPreferences}
      >
        <IconSettings size={15} />
      </button>
    );
  }

  return (
    <div
      className="consent"
      role="dialog"
      aria-modal="false"
      aria-label={t('cookies.banner.title')}
    >
      <div className="row row--between gap-3" style={{ alignItems: 'flex-start' }}>
        <p className="consent__title">{t('cookies.banner.title')}</p>
        {dismissible && (
          <button
            type="button"
            className="drawer__close"
            onClick={closePanel}
            aria-label={t('common.close')}
          >
            <IconClose size={16} />
          </button>
        )}
      </div>
      <p className="consent__body">
        {t('cookies.banner.body')}{' '}
        <Link to="/cookies" className="link">{t('footer.cookie')}</Link>
      </p>

      {customizing && (
        <div className="consent__cats">
          <div className="consent__cat">
            <span>
              <span className="t-sm" style={{ color: 'var(--ink)', display: 'block' }}>
                {t('cookies.banner.necessaryTitle')}
              </span>
              <span className="t-xs t-faint">{t('cookies.banner.necessaryDesc')}</span>
            </span>
            <span className="status status--positive">{t('cookies.banner.alwaysOn')}</span>
          </div>

          <label className="consent__cat">
            <span>
              <span className="t-sm" style={{ color: 'var(--ink)', display: 'block' }}>
                {t('cookies.banner.analyticsTitle')}
              </span>
              <span className="t-xs t-faint">{t('cookies.banner.analyticsDesc')}</span>
            </span>
            <span className="checkbox">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                aria-label={t('cookies.banner.analyticsTitle')}
              />
            </span>
          </label>
        </div>
      )}

      <div className="consent__actions">
        {customizing ? (
          <>
            <button type="button" className="btn btn--secondary btn--sm" onClick={rejectAll}>
              {t('cookies.banner.rejectAll')}
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => savePreferences(analytics)}>
              {t('cookies.banner.save')}
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={acceptAll}>
              {t('cookies.banner.acceptAll')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--secondary btn--sm" onClick={rejectAll}>
              {t('cookies.banner.rejectAll')}
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setCustomizing(true)}>
              {t('cookies.banner.customize')}
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={acceptAll}>
              {t('cookies.banner.acceptAll')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
