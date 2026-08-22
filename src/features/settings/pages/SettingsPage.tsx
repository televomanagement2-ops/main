import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';
import { useThemeStore, type Theme } from '../../../store/themeStore';
import { LANGUAGE_OPTIONS, usePreferencesStore, type AppLanguageCode } from '../../../store/preferencesStore';
import { useCookieConsentStore } from '../../../store/cookieConsentStore';

const VERSION_FALLBACK = '1.0.0';

function getStoredBoolean(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw == null) return defaultValue;
  return raw === 'true';
}

export function SettingsPage() {
  const { t } = useI18n();
  const { theme, setTheme } = useThemeStore();
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const openCookiePreferences = useCookieConsentStore((s) => s.openPreferences);

  const [locationAllowed, setLocationAllowed] = useState<boolean>(() =>
    getStoredBoolean('settings.locationAllowed', false)
  );
  const [analyticsAllowed, setAnalyticsAllowed] = useState<boolean>(() =>
    getStoredBoolean('settings.analyticsAllowed', true)
  );
  const [locationStatusKey, setLocationStatusKey] = useState<string>('settings.locationDisabled');

  const appVersion = useMemo(() => {
    const envVersion = import.meta.env.VITE_APP_VERSION as string | undefined;
    return envVersion?.trim() || VERSION_FALLBACK;
  }, []);

  const environment = import.meta.env.DEV ? t('settings.envDevelopment') : t('settings.envProduction');

  const handleLocationToggle = () => {
    if (locationAllowed) {
      localStorage.setItem('settings.locationAllowed', 'false');
      setLocationAllowed(false);
      setLocationStatusKey('settings.locationDisabled');
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatusKey('settings.locationUnavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        localStorage.setItem('settings.locationAllowed', 'true');
        setLocationAllowed(true);
        setLocationStatusKey('settings.locationEnabled');
      },
      () => {
        localStorage.setItem('settings.locationAllowed', 'false');
        setLocationAllowed(false);
        setLocationStatusKey('settings.locationDenied');
      },
      { timeout: 8000 }
    );
  };

  const handleAnalyticsToggle = () => {
    const next = !analyticsAllowed;
    localStorage.setItem('settings.analyticsAllowed', String(next));
    setAnalyticsAllowed(next);
  };

  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
    { value: 'system', label: t('settings.themeSystem') },
  ];

  return (
    <div className="page" style={{ paddingBottom: 'var(--s-20)' }}>
      <div style={{ paddingTop: 'var(--s-6)' }}>
        <BackButton to="/profile" label={t('settings.backToProfile')} />
      </div>

      <header className="account-head">
        <div className="account-head__title">
          <p className="t-label">{t('settings.preferences')}</p>
          <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{t('settings.title')}</h1>
          <p className="t-body collection__desc t-measure">{t('settings.subtitle')}</p>
        </div>
      </header>

      <div className="detail-grid">
        <section className="detail-block detail-block--wide">
          <p className="t-label">{t('settings.appearance')}</p>
          <div className="filter-chips" style={{ marginTop: 'var(--s-2)' }}>
            {themes.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`filter-chip${theme === option.value ? ' is-active' : ''}`}
                onClick={() => setTheme(option.value)}
                aria-pressed={theme === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="t-label" style={{ marginTop: 'var(--s-8)' }}>{t('settings.language')}</p>
          <div className="filter-chips" style={{ marginTop: 'var(--s-2)' }}>
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

        <section className="detail-block detail-block--wide">
          <p className="t-label">{t('settings.permissions')}</p>

          <div className="info-rows" style={{ marginTop: 'var(--s-2)' }}>
            <div className="info-row" style={{ alignItems: 'flex-start' }}>
              <span>
                <strong style={{ display: 'block' }}>{t('settings.locationAccess')}</strong>
                <span className="t-xs t-faint">{t('settings.locationSub')}</span>
              </span>
              <button
                type="button"
                className={`switch${locationAllowed ? ' is-on' : ''}`}
                onClick={handleLocationToggle}
                role="switch"
                aria-checked={locationAllowed}
                aria-label={t('settings.locationAccess')}
              />
            </div>

            <div className="info-row" style={{ alignItems: 'flex-start' }}>
              <span>
                <strong style={{ display: 'block' }}>{t('settings.analytics')}</strong>
                <span className="t-xs t-faint">{t('settings.analyticsSub')}</span>
              </span>
              <button
                type="button"
                className={`switch${analyticsAllowed ? ' is-on' : ''}`}
                onClick={handleAnalyticsToggle}
                role="switch"
                aria-checked={analyticsAllowed}
                aria-label={t('settings.analytics')}
              />
            </div>
          </div>

          <p className="t-xs t-faint">{t(locationStatusKey)}</p>
        </section>

        <section className="detail-block">
          <p className="t-label">{t('settings.privacy')}</p>
          <p className="detail-block__body">{t('settings.privacySub')}</p>
          <div className="row row--wrap gap-2" style={{ marginTop: 'var(--s-2)' }}>
            <Link to="/privacy-policy" className="btn btn--secondary btn--sm">{t('settings.openPrivacy')}</Link>
            <button type="button" className="btn btn--secondary btn--sm" onClick={openCookiePreferences}>
              {t('cookies.manageBtn')}
            </button>
          </div>
        </section>

        <section className="detail-block">
          <p className="t-label">{t('settings.help')}</p>
          <p className="detail-block__body">{t('settings.helpSub')}</p>
          <Link to="/help" className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }}>
            {t('settings.openHelp')}
          </Link>
        </section>

        <section className="detail-block">
          <p className="t-label">{t('settings.information')}</p>
          <div className="info-rows">
            <div className="info-row">
              <span>{t('settings.appVersion')}</span>
              <strong className="t-mono">{appVersion}</strong>
            </div>
            <div className="info-row">
              <span>{t('settings.environment')}</span>
              <strong>{environment}</strong>
            </div>
            <div className="info-row">
              <span>{t('settings.buildChannel')}</span>
              <strong>{t('settings.buildChannelValue')}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
