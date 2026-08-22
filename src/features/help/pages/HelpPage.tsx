import { useState } from 'react';
import type { FormEvent } from 'react';
import { useI18n } from '../../../lib/i18n';
import { storeConfig } from '../../../config/storeConfig';


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
    const form = event.currentTarget;
    const email = (form.elements.namedItem('help-email') as HTMLInputElement).value;
    const message = (form.elements.namedItem('help-message') as HTMLTextAreaElement).value;
    const subject = `Support request from ${storeConfig.storeName} (${email})`;
    const mailtoUrl = `mailto:${storeConfig.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = mailtoUrl;
    setSent(true);
  };

  return (
    <div className="page" style={{ paddingBottom: 'var(--s-20)' }}>
      <header className="account-head">
        <div className="account-head__title">
          <p className="t-label">{t('help.eyebrow')}</p>
          <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{t('help.title')}</h1>
          <p className="t-body collection__desc t-measure">{t('help.subtitle')}</p>
        </div>
      </header>

      <div className="detail-grid" style={{ rowGap: 'clamp(40px, 5vw, 72px)' }}>
        {faq.map((section) => (
          <section key={section.title} className="detail-block detail-block--wide">
            <h2 className="t-h3">{section.title}</h2>
            <div>
              {section.items.map((item) => (
                <details key={item.q} className="faq-item">
                  <summary>{item.q}</summary>
                  <p className="faq-item__body">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section
        className="detail-grid"
        aria-label={t('help.contactAria')}
        style={{ marginTop: 'clamp(56px, 7vw, 112px)', paddingTop: 'var(--s-10)', borderTop: '1px solid var(--line)' }}
      >
        <div className="detail-block detail-block--wide">
          <p className="t-label">{t('help.contactLabel')}</p>
          <h2 className="t-h2">{t('help.contactTitle')}</h2>
          <div className="info-rows" style={{ marginTop: 'var(--s-4)' }}>
            <div className="info-row">
              <span>{t('help.contactEmail')}</span>
              <a href={`mailto:${storeConfig.contactEmail}`} className="link">{storeConfig.contactEmail}</a>
            </div>
            <div className="info-row">
              <span>{t('help.contactPhone')}</span>
              <a href={`tel:${storeConfig.supportPhone.replace(/[^+\d]/g, '')}`} className="link">
                {storeConfig.supportPhone}
              </a>
            </div>
            <div className="info-row">
              <span>{t('help.contactHoursLabel')}</span>
              <strong>{t('help.contactHours')}</strong>
            </div>
          </div>
        </div>

        <form className="detail-block detail-block--wide stack gap-4" onSubmit={onSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="help-email">{t('help.formEmail')}</label>
            <input id="help-email" className="input" type="email" required placeholder={t('auth.emailPlaceholder')} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="help-message">{t('help.formMessage')}</label>
            <textarea
              id="help-message"
              className="textarea"
              required
              placeholder={t('help.formMessagePlaceholder')}
            />
          </div>
          <button type="submit" className="btn btn--primary" style={{ alignSelf: 'flex-start' }}>
            {t('help.formSubmit')}
          </button>
          {sent && <p className="status status--positive">{t('help.formSuccess')}</p>}
        </form>
      </section>
    </div>
  );
}
