import { Link } from 'react-router-dom';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand-block">
          <Link to="/" className="footer-brand">
            Shop<span>Base</span>
          </Link>
          <p className="footer-brand-copy">
            Curated essentials, clear pricing and a smoother shopping experience.
          </p>
          <div className="footer-contact-pill">
            <span>Support</span>
            <a href="mailto:support@shopbase.example">support@shopbase.example</a>
          </div>
        </div>

        <div className="footer-columns">
          <div className="footer-column">
            <p className="footer-column__title">Contattaci</p>
            <Link to="/" className="footer-link">Live chat</Link>
            <a href="mailto:support@shopbase.example" className="footer-link">Email support</a>
            <a href="tel:+390212345678" className="footer-link">+39 02 1234 5678</a>
          </div>

          <div className="footer-column">
            <p className="footer-column__title">Aiuto</p>
            <Link to="/products" className="footer-link">Shop products</Link>
            <Link to="/cart" className="footer-link">Cart & checkout</Link>
            <Link to="/orders" className="footer-link">Order tracking</Link>
          </div>

          <div className="footer-column">
            <p className="footer-column__title">Azienda</p>
            <Link to="/" className="footer-link">About ShopBase</Link>
            <Link to="/products" className="footer-link">Categories</Link>
            <Link to="/login" className="footer-link">Account</Link>
          </div>

          <div className="footer-column">
            <p className="footer-column__title">Privacy</p>
            <Link to="/" className="footer-link">Privacy policy</Link>
            <Link to="/" className="footer-link">Terms of service</Link>
            <Link to="/" className="footer-link">Cookie preferences</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">&copy; {year} ShopBase</p>
          <div className="footer-bottom__meta">
            <span>IT</span>
            <span>Italy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
