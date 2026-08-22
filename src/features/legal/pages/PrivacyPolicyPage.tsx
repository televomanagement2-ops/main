import { LegalDocument } from '../components/LegalDocument';
import { useI18n } from '../../../lib/i18n';
import { usePreferencesStore } from '../../../store/preferencesStore';
import { privacyContent } from '../constants/privacyData';

export function PrivacyPolicyPage() {
  const { t } = useI18n();
  const language = usePreferencesStore((s) => s.language);
  const { lastUpdated, sections } = privacyContent[language];

  return (
    <LegalDocument
      eyebrow={t('privacy.eyebrow')}
      title={t('privacy.title')}
      subtitle={t('privacy.subtitle')}
      lastUpdated={lastUpdated}
      sections={sections}
    />
  );
}
