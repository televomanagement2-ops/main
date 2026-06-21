import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';
import { usePreferencesStore } from '../../../store/preferencesStore';
import { useCookieConsentStore } from '../../../store/cookieConsentStore';
import { fillPlaceholders } from '../../../config/storeConfig';
import { cookieContent } from '../constants/cookieData';

export function CookiePolicyPage() {
  const { t } = useI18n();
  const language = usePreferencesStore((s) => s.language);
  const openPreferences = useCookieConsentStore((s) => s.openPreferences);
  const { lastUpdated, sections } = cookieContent[language];

  const handleManagePreferences = () => {
    openPreferences();
  };

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <BackButton label={t('common.back')} />

      <section className="privacy-hero">
        <span className="section-eyebrow">{t('cookies.eyebrow')}</span>
        <h1 className="heading-1" style={{ marginBottom: 'var(--sp-2)' }}>{t('cookies.title')}</h1>
        <p className="body-sm" style={{ maxWidth: 760 }}>{t('cookies.subtitle')}</p>
        <p className="body-sm" style={{ marginTop: 'var(--sp-3)', opacity: 0.6 }}>
          {t('terms.lastUpdated')}: {lastUpdated}
        </p>
      </section>

      <div className="privacy-content">
        <div className="privacy-card">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleManagePreferences}
          >
            {t('cookies.manageBtn')}
          </button>
          <p className="body-sm" style={{ marginTop: 'var(--sp-3)', opacity: 0.7 }}>
            {t('cookies.manageSub')}
          </p>
        </div>

        {sections.map((section) => (
          <article key={section.title} className="privacy-card">
            <h2>{section.title}</h2>
            {section.content.map((line, i) => (
              <p key={i}>{fillPlaceholders(line)}</p>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}
