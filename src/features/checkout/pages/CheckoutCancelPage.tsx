import { Link } from 'react-router-dom';

export function CheckoutCancelPage() {
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
        <h1 className="result-state__title">Payment cancelled</h1>
        <p className="result-state__sub">
          Your order was not placed. Your cart is still saved — pick up where you left off.
        </p>
        <div className="result-state__actions">
          <Link to="/cart" className="btn btn-primary btn-lg">Return to cart</Link>
          <Link to="/products" className="btn btn-ghost btn-lg">Keep browsing</Link>
        </div>
      </div>
    </div>
  );
}
