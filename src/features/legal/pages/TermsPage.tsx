import { LegalDocument } from '../components/LegalDocument';
import { useI18n } from '../../../lib/i18n';
import { usePreferencesStore } from '../../../store/preferencesStore';
import { termsContent } from '../constants/termsData';

export function TermsPage() {
  const { t } = useI18n();
  const language = usePreferencesStore((s) => s.language);
  const { lastUpdated, sections } = termsContent[language];

  return (
    <LegalDocument
      eyebrow={t('terms.eyebrow')}
      title={t('terms.title')}
      subtitle={t('terms.subtitle')}
      lastUpdated={lastUpdated}
      sections={sections}
    />
  );
}
