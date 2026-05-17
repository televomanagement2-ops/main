import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';
import { usePreferencesStore } from '../../../store/preferencesStore';
import { privacyContent } from '../constants/privacyData';

export function PrivacyPolicyPage() {
  const { t } = useI18n();
  const language = usePreferencesStore((s) => s.language);
  const { lastUpdated, sections } = privacyContent[language];

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <BackButton label={t('common.back')} />

      <section className="privacy-hero">
        <span className="section-eyebrow">{t('privacy.eyebrow')}</span>
        <h1 className="heading-1" style={{ marginBottom: 'var(--sp-2)' }}>{t('privacy.title')}</h1>
        <p className="body-sm" style={{ maxWidth: 760 }}>{t('privacy.subtitle')}</p>
        <p className="body-sm" style={{ marginTop: 'var(--sp-3)', opacity: 0.6 }}>
          {t('terms.lastUpdated')}: {lastUpdated}
        </p>
      </section>

      <div className="privacy-content">
        {sections.map((section) => (
          <article key={section.title} className="privacy-card">
            <h2>{section.title}</h2>
            {section.content.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}
