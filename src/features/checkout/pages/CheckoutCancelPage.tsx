import { Link } from 'react-router-dom';
import { IconReturn } from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';

export function CheckoutCancelPage() {
  const { t } = useI18n();

  return (
    <div className="page">
      <div className="result">
        <span className="result__mark"><IconReturn size={20} /></span>
        <p className="t-label">{t('checkoutCancel.label')}</p>
        <h1 className="t-h1">{t('checkoutCancel.title')}</h1>
        <p className="t-body t-measure">{t('checkoutCancel.subtitle')}</p>
        <div className="result__actions">
          <Link to="/cart" className="btn btn--primary">{t('checkoutCancel.returnCart')}</Link>
          <Link to="/products" className="btn btn--secondary">{t('checkoutCancel.keepBrowsing')}</Link>
        </div>
      </div>
    </div>
  );
}
