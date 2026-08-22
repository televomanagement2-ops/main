import { LegalDocument } from '../components/LegalDocument';
import { useI18n } from '../../../lib/i18n';
import { usePreferencesStore } from '../../../store/preferencesStore';
import { useCookieConsentStore } from '../../../store/cookieConsentStore';
import { cookieContent } from '../constants/cookieData';

export function CookiePolicyPage() {
  const { t } = useI18n();
  const language = usePreferencesStore((s) => s.language);
  const openPreferences = useCookieConsentStore((s) => s.openPreferences);
  const { lastUpdated, sections } = cookieContent[language];

  return (
    <LegalDocument
      eyebrow={t('cookies.eyebrow')}
      title={t('cookies.title')}
      subtitle={t('cookies.subtitle')}
      lastUpdated={lastUpdated}
      sections={sections}
      intro={
        <div className="row row--wrap gap-4" style={{ alignItems: 'center' }}>
          <button type="button" className="btn btn--secondary btn--sm" onClick={openPreferences}>
            {t('cookies.manageBtn')}
          </button>
          <p className="t-sm t-faint t-measure" style={{ margin: 0 }}>
            {t('cookies.manageSub')}
          </p>
        </div>
      }
    />
  );
}
