import { useState, useRef, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../lib/i18n';
import { storeConfig } from '../../config/storeConfig';

interface Props {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: Props) {
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const { isAuthenticated, profile, user } = useAuth();
  const navigate = useNavigate();
  const { t, tCount } = useI18n();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = profile?.full_name ?? profile?.email ?? user?.email ?? '';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigate(`/products?search=${encodeURIComponent(q)}`);
    setSearch('');
    inputRef.current?.blur();
  };

  return (
    <header className="topbar">
      {/* Hamburger — always visible, toggles sidebar */}
      <button
        className="topbar__hamburger"
        onClick={onMenuClick}
        aria-label={t('nav.toggleNavigation')}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Logo */}
      <Link to="/" className="topbar__logo">
        {storeConfig.storeName}
      </Link>

      {/* Search */}
      <form className="topbar__search" onSubmit={handleSearch} role="search">
        <span className="topbar__search-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('nav.searchPlaceholder')}
          className="topbar__search-input"
          aria-label={t('nav.searchProducts')}
        />
      </form>

      {/* Actions */}
      <div className="topbar__actions">
        <Link
          to="/cart"
          className="cart-trigger"
          aria-label={`${t('nav.cart')}, ${tCount('orders.items', cartCount)}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <span className="sr-only">{t('nav.cart')}</span>
          {cartCount > 0 && (
            <span className="cart-count" aria-hidden="true">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>

        {isAuthenticated ? (
          <div className="user-chip" title={displayName}>
            <div className="user-avatar">{initial}</div>
            <span className="user-chip__name">{displayName}</span>
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">{t('nav.signIn')}</Link>
        )}
      </div>
    </header>
  );
}
