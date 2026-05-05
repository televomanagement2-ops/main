import { useState } from 'react';
import type { FormEvent } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { useI18n } from '../../../lib/i18n';

type FAQSection = {
  title: string;
  items: Array<{ q: string; a: string }>;
};

export function HelpPage() {
  const [sent, setSent] = useState(false);
  const { t } = useI18n();

  const faq: FAQSection[] = [
    {
      title: t('help.faq.ordersPayments.title'),
      items: [
        { q: t('help.faq.ordersPayments.q1'), a: t('help.faq.ordersPayments.a1') },
        { q: t('help.faq.ordersPayments.q2'), a: t('help.faq.ordersPayments.a2') },
        { q: t('help.faq.ordersPayments.q3'), a: t('help.faq.ordersPayments.a3') },
      ],
    },
    {
      title: t('help.faq.shipping.title'),
      items: [
        { q: t('help.faq.shipping.q1'), a: t('help.faq.shipping.a1') },
        { q: t('help.faq.shipping.q2'), a: t('help.faq.shipping.a2') },
        { q: t('help.faq.shipping.q3'), a: t('help.faq.shipping.a3') },
        { q: t('help.faq.shipping.q4'), a: t('help.faq.shipping.a4') },
      ],
    },
    {
      title: t('help.faq.returns.title'),
      items: [
        { q: t('help.faq.returns.q1'), a: t('help.faq.returns.a1') },
        { q: t('help.faq.returns.q2'), a: t('help.faq.returns.a2') },
        { q: t('help.faq.returns.q3'), a: t('help.faq.returns.a3') },
      ],
    },
    {
      title: t('help.faq.account.title'),
      items: [
        { q: t('help.faq.account.q1'), a: t('help.faq.account.a1') },
        { q: t('help.faq.account.q2'), a: t('help.faq.account.a2') },
      ],
    },
  ];

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
  };

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <BackButton label={t('common.back')} />

      <section className="help-hero">
        <span className="section-eyebrow">{t('help.eyebrow')}</span>
        <h1 className="heading-1" style={{ marginBottom: 'var(--sp-2)' }}>{t('help.title')}</h1>
        <p className="body-sm" style={{ maxWidth: 700 }}>
          {t('help.subtitle')}
        </p>
      </section>

      <section className="help-grid">
        {faq.map((section) => (
          <article key={section.title} className="help-card">
            <h2 className="help-card__title">{section.title}</h2>
            <div className="help-faq-list">
              {section.items.map((item) => (
                <details key={item.q} className="help-faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="help-contact" aria-label={t('help.contactAria')}>
        <div>
          <h2 className="heading-2" style={{ marginBottom: 'var(--sp-2)' }}>{t('help.contactTitle')}</h2>
          <p className="body-sm">{t('help.contactEmail')}: <a href="mailto:support@shopbase.com">support@shopbase.com</a></p>
          <p className="body-sm">{t('help.contactPhone')}: <a href="tel:+390000000000">+39 000 000 0000</a></p>
          <p className="body-sm">{t('help.contactHours')}</p>
        </div>

        <form className="help-form" onSubmit={onSubmit}>
          <label className="label" htmlFor="help-email">{t('help.formEmail')}</label>
          <input id="help-email" className="input" type="email" required placeholder={t('auth.emailPlaceholder')} />

          <label className="label" htmlFor="help-message">{t('help.formMessage')}</label>
          <textarea
            id="help-message"
            className="help-form__textarea"
            required
            placeholder={t('help.formMessagePlaceholder')}
          />

          <button type="submit" className="btn btn-primary btn-sm">{t('help.formSubmit')}</button>
          {sent && <p className="settings-note">{t('help.formSuccess')}</p>}
        </form>
      </section>
    </div>
  );
}
