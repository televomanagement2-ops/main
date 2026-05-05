import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';

export function PrivacyPage() {
  const { t } = useI18n();

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <BackButton label={t('common.back')} />

      <section className="privacy-hero">
        <span className="section-eyebrow">{t('privacy.eyebrow')}</span>
        <h1 className="heading-1" style={{ marginBottom: 'var(--sp-2)' }}>{t('privacy.title')}</h1>
        <p className="body-sm" style={{ maxWidth: 760 }}>
          {t('privacy.subtitle')}
        </p>
      </section>

      <div className="privacy-content">
        <article className="privacy-card">
          <h2>{t('privacy.controller.title')}</h2>
          <p>{t('privacy.controller.line1')}</p>
          <p>{t('privacy.controller.line2')}</p>
          <p>{t('privacy.controller.line3')}</p>
          <p>{t('privacy.controller.line4')}</p>
        </article>

        <article className="privacy-card">
          <h2>{t('privacy.dataTypes.title')}</h2>
          <ul>
            <li>{t('privacy.dataTypes.item1')}</li>
            <li>{t('privacy.dataTypes.item2')}</li>
          </ul>
        </article>

        <article className="privacy-card">
          <h2>{t('privacy.purposes.title')}</h2>
          <ul>
            <li>{t('privacy.purposes.item1')}</li>
            <li>{t('privacy.purposes.item2')}</li>
            <li>{t('privacy.purposes.item3')}</li>
            <li>{t('privacy.purposes.item4')}</li>
          </ul>
        </article>

        <article className="privacy-card">
          <h2>{t('privacy.legalBasis.title')}</h2>
          <ul>
            <li>{t('privacy.legalBasis.item1')}</li>
            <li>{t('privacy.legalBasis.item2')}</li>
            <li>{t('privacy.legalBasis.item3')}</li>
          </ul>
        </article>

        <article className="privacy-card">
          <h2>{t('privacy.thirdParties.title')}</h2>
          <ul>
            <li>{t('privacy.thirdParties.item1')}</li>
            <li>{t('privacy.thirdParties.item2')}</li>
            <li>{t('privacy.thirdParties.item3')}</li>
          </ul>
        </article>

        <article className="privacy-card">
          <h2>{t('privacy.internationalTransfer.title')}</h2>
          <p>
            {t('privacy.internationalTransfer.body')}
          </p>
        </article>

        <article className="privacy-card">
          <h2>{t('privacy.retention.title')}</h2>
          <ul>
            <li>{t('privacy.retention.item1')}</li>
            <li>{t('privacy.retention.item2')}</li>
            <li>{t('privacy.retention.item3')}</li>
          </ul>
        </article>

        <article className="privacy-card">
          <h2>{t('privacy.userRights.title')}</h2>
          <p>
            {t('privacy.userRights.body')}
          </p>
        </article>

        <article className="privacy-card">
          <h2>{t('privacy.cookies.title')}</h2>
          <p>
            {t('privacy.cookies.body')}
          </p>
        </article>

        <article className="privacy-card" id="terms">
          <h2>{t('privacy.terms.title')}</h2>
          <p>
            {t('privacy.terms.body')}
          </p>
        </article>
      </div>
    </div>
  );
}
