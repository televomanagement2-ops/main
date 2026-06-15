import { Link, NavLink } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';

export function Header() {
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const { isAuthenticated, profile } = useAuth();

  const handleSignOut = () => supabase.auth.signOut();

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          Commerce<span>Jet</span>
        </Link>

        <nav className="nav">
          <NavLink to="/products" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Products
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/orders" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Orders
            </NavLink>
          )}
        </nav>

        <div className="header-spacer" />

        <div className="header-actions">
          <Link to="/cart" className="cart-trigger" aria-label={`Cart, ${itemCount} items`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            <span className="sr-only">Cart</span>
            {itemCount > 0 && (
              <span className="cart-count" aria-hidden="true">{itemCount}</span>
            )}
          </Link>

          {isAuthenticated ? (
            <>
              <span className="text-sm text-muted" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name ?? profile?.email}
              </span>
              <button onClick={handleSignOut} className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
