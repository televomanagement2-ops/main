import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCartStore } from '../../store/cartStore';
import { useI18n } from '../../lib/i18n';

interface Props {
  onMenuClick: () => void;
}

export function BottomNavBar({ onMenuClick }: Props) {
  const cartCount = useCartStore((s) => s.items.reduce((n, item) => n + item.quantity, 0));
  const { isAuthenticated } = useAuth();
  const { t, tCount } = useI18n();
  const cartAria = `${t('nav.cart')}, ${tCount('orders.items', cartCount)}`;

  return (
    <nav className="bottom-nav" aria-label={t('nav.mobileNavigation')}>
      <Link to="/" className="bottom-nav__item" aria-label={t('sidebar.home')}>
        <IconHome />
      </Link>
      <Link to={isAuthenticated ? '/profile' : '/login'} className="bottom-nav__item" aria-label={t('nav.account')}>
        <IconUser />
      </Link>
      <Link to="/cart" className="bottom-nav__item" aria-label={cartAria}>
        <span className="bottom-nav__cart-wrap">
          <IconCart />
          {cartCount > 0 && <span className="bottom-nav__badge">{cartCount > 99 ? '99+' : cartCount}</span>}
        </span>
      </Link>
      <button className="bottom-nav__item" onClick={onMenuClick} aria-label={t('nav.menu')}>
        <IconMenu />
      </button>
    </nav>
  );
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v11h14V10" />
      <path d="M9 21v-7h6v7" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}