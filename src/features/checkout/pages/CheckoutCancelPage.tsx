import { Link } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n';

export function CheckoutCancelPage() {
  const { t } = useI18n();

  return (
    <div className="container">
      <div className="result-state result-state--cancel">
        <div className="result-state__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="result-state__title">{t('checkoutCancel.title')}</h1>
        <p className="result-state__sub">
          {t('checkoutCancel.subtitle')}
        </p>
        <div className="result-state__actions">
          <Link to="/cart" className="btn btn-primary btn-lg">{t('checkoutCancel.returnCart')}</Link>
          <Link to="/products" className="btn btn-ghost btn-lg">{t('checkoutCancel.keepBrowsing')}</Link>
        </div>
      </div>
    </div>
  );
}
