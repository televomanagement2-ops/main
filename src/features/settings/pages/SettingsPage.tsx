import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';

const VERSION_FALLBACK = '1.0.0';

function getStoredBoolean(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw == null) return defaultValue;
  return raw === 'true';
}

 export function SettingsPage() {
  const { t } = useI18n();
  const [locationAllowed, setLocationAllowed] = useState<boolean>(() => getStoredBoolean('settings.locationAllowed', false));
  const [analyticsAllowed, setAnalyticsAllowed] = useState<boolean>(() => getStoredBoolean('settings.analyticsAllowed', true));
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

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <BackButton to="/profile" label={t('settings.backToProfile')} />

      <section className="settings-hero">
        <span className="section-eyebrow">{t('settings.preferences')}</span>
        <h1 className="heading-1" style={{ marginBottom: 'var(--sp-2)' }}>{t('settings.title')}</h1>
        <p className="body-sm" style={{ maxWidth: 620 }}>
          {t('settings.subtitle')}
        </p>
      </section>

      <div className="settings-grid">
        <article className="settings-card">
          <h2 className="settings-card__title">{t('settings.permissions')}</h2>
          <div className="settings-toggle-row">
            <div>
              <p className="settings-toggle-row__label">{t('settings.locationAccess')}</p>
              <p className="settings-toggle-row__sub">{t('settings.locationSub')}</p>
            </div>
            <button
              type="button"
              className={`settings-toggle ${locationAllowed ? 'is-on' : ''}`}
              onClick={handleLocationToggle}
              aria-pressed={locationAllowed}
            >
              <span>{locationAllowed ? t('settings.on') : t('settings.off')}</span>
            </button>
          </div>
          <p className="settings-note">{t(locationStatusKey)}</p>

          <div className="settings-toggle-row" style={{ marginTop: 'var(--sp-4)' }}>
            <div>
              <p className="settings-toggle-row__label">{t('settings.analytics')}</p>
              <p className="settings-toggle-row__sub">{t('settings.analyticsSub')}</p>
            </div>
            <button
              type="button"
              className={`settings-toggle ${analyticsAllowed ? 'is-on' : ''}`}
              onClick={handleAnalyticsToggle}
              aria-pressed={analyticsAllowed}
            >
              <span>{analyticsAllowed ? t('settings.on') : t('settings.off')}</span>
            </button>
          </div>
        </article>

        <article className="settings-card">
          <h2 className="settings-card__title">{t('settings.information')}</h2>
          <div className="settings-info-list">
            <div className="settings-info-row">
              <span>{t('settings.appVersion')}</span>
              <strong>{appVersion}</strong>
            </div>
            <div className="settings-info-row">
              <span>{t('settings.environment')}</span>
              <strong>{environment}</strong>
            </div>
            <div className="settings-info-row">
              <span>{t('settings.buildChannel')}</span>
              <strong>{t('settings.buildChannelValue')}</strong>
            </div>
          </div>
        </article>

        <article className="settings-card">
          <h2 className="settings-card__title">{t('settings.privacy')}</h2>
          <p className="settings-note" style={{ marginBottom: 'var(--sp-4)' }}>
            {t('settings.privacySub')}
          </p>
          <Link to="/privacy" className="btn btn-secondary btn-sm">{t('settings.openPrivacy')}</Link>
        </article>

        <article className="settings-card">
          <h2 className="settings-card__title">{t('settings.help')}</h2>
          <p className="settings-note" style={{ marginBottom: 'var(--sp-4)' }}>
            {t('settings.helpSub')}
          </p>
          <Link to="/help" className="btn btn-secondary btn-sm">{t('settings.openHelp')}</Link>
        </article>
      </div>
    </div>
  );
}
