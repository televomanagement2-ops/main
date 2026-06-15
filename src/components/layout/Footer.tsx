import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';

export function Footer() {
  const year = new Date().getFullYear();
  const { t } = useI18n();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand-block">
          <Link to="/" className="footer-brand">
            Commerce<span>Jet</span>
          </Link>
          <p className="footer-brand-copy">
            {t('footer.tagline')}
          </p>
          <div className="footer-contact-pill">
            <span>{t('footer.support')}</span>
            <a href="mailto:support@commercejet.com">support@commercejet.com</a>
          </div>
        </div>

        <div className="footer-columns">
          <div className="footer-column">
            <p className="footer-column__title">{t('footer.contact')}</p>
            <Link to="/help" className="footer-link">{t('footer.liveChat')}</Link>
            <a href="mailto:support@commercejet.com" className="footer-link">{t('footer.emailSupport')}</a>
            <a href="tel:+390000000000" className="footer-link">+39 000 000 0000</a>
          </div>

          <div className="footer-column">
            <p className="footer-column__title">{t('footer.help')}</p>
            <Link to="/help" className="footer-link">{t('footer.faq')}</Link>
            <Link to="/help" className="footer-link">{t('footer.ordersPayments')}</Link>
            <Link to="/help" className="footer-link">{t('footer.shippingReturns')}</Link>
          </div>

          <div className="footer-column">
            <p className="footer-column__title">{t('footer.company')}</p>
            <Link to="/help" className="footer-link">{t('footer.about')}</Link>
            <Link to="/products" className="footer-link">{t('footer.categories')}</Link>
            <Link to="/settings" className="footer-link">{t('footer.settings')}</Link>
          </div>

          <div className="footer-column">
            <p className="footer-column__title">{t('footer.privacy')}</p>
            <Link to="/privacy-policy" className="footer-link">{t('footer.privacyPolicy')}</Link>
            <Link to="/terms" className="footer-link">{t('footer.terms')}</Link>
            <Link to="/cookies" className="footer-link">{t('footer.cookie')}</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">&copy; {year} CommerceJet</p>
          <div className="footer-bottom__meta">
            <span>{t('footer.countryCode')}</span>
            <span>{t('footer.countryName')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
