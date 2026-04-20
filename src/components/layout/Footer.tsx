import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} ShopBase
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
          <Link to="/products" style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Products</Link>
          <Link to="/cart"     style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Cart</Link>
        </div>
      </div>
    </footer>
  );
}
