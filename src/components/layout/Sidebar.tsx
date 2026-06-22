import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCartStore } from '../../store/cartStore';
import { supabase } from '../../lib/supabaseClient';
import { useI18n } from '../../lib/i18n';
import { storeConfig } from '../../config/storeConfig';

interface Props {
  mini: boolean;
  onToggleMini: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function NavItem({
  to,
  icon,
  label,
  badge,
  mini,
  end,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  mini: boolean;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
      title={mini ? label : undefined}
    >
      <span className="sidebar-item__icon">{icon}</span>
      <span className="sidebar-item__label">{label}</span>
      {badge != null && badge > 0 && (
        <span className="sidebar-item__badge">{badge > 99 ? '99+' : badge}</span>
      )}
    </NavLink>
  );
}

export function Sidebar({ mini, onToggleMini, mobileOpen, onCloseMobile }: Props) {
  const { isAuthenticated, isAdmin, profile, user } = useAuth();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  // Close mobile drawer on navigation
  useEffect(() => {
    if (mobileOpen) onCloseMobile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const initial = profile?.full_name?.[0]?.toUpperCase()
    ?? profile?.email?.[0]?.toUpperCase()
    ?? user?.email?.[0]?.toUpperCase()
    ?? '?';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const sidebarClass = [
    'sidebar',
    mini ? 'sidebar--mini' : '',
    mobileOpen ? 'sidebar--mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={sidebarClass} aria-label={t('nav.mainNavigation')}>
      {/* Brand — only shown when sidebar is expanded */}
      {!mini && (
        <div className="sidebar-brand">
          <Link to="/" className="sidebar-brand__logo">
            {storeConfig.storeName}
          </Link>
          <button
            className="sidebar-brand__toggle"
            onClick={onToggleMini}
            aria-label={t('nav.toggleNavigation')}
            title={t('nav.toggleNavigation')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        </div>
      )}

      {/* Scroll area */}
      <div className="sidebar-scroll">
        {/* Main nav */}
        <div className="sidebar-section">
          <p className="sidebar-section__label">{t('sidebar.store')}</p>
          <NavItem to="/" end icon={<IconHome />} label={t('sidebar.home')} mini={mini} />
          <NavItem to="/products" icon={<IconGrid />} label={t('sidebar.products')} mini={mini} />
          <NavItem to="/cart" icon={<IconCart />} label={t('sidebar.cart')} badge={cartCount} mini={mini} />
        </div>

        {/* Account nav */}
        {isAuthenticated && (
          <div className="sidebar-section">
            <p className="sidebar-section__label">{t('sidebar.account')}</p>
            <NavItem to="/profile" icon={<IconProfile />} label={t('sidebar.profile')} mini={mini} />
            <NavItem to="/orders" icon={<IconOrders />} label={t('sidebar.myOrders')} mini={mini} />
          </div>
        )}

        {isAdmin && (
          <div className="sidebar-section">
            <p className="sidebar-section__label">{t('sidebar.admin')}</p>
            <NavItem to="/admin" icon={<IconDashboard />} label={t('sidebar.dashboard')} mini={mini} />
          </div>
        )}

        {/* Guest prompt — single sign-in entry point */}
        {!isAuthenticated && (
          <div className="sidebar-section">
            {mini ? (
              <NavItem to="/login" icon={<IconSignIn />} label={t('nav.signIn')} mini={mini} />
            ) : (
              <div style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.5, marginBottom: 'var(--sp-3)' }}>
                  {t('sidebar.signInPrompt')}
                </p>
                <Link to="/login" className="btn btn-primary btn-sm btn-full">
                  {t('nav.signIn')}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — authenticated users only; guests use the inline prompt above */}
      {isAuthenticated && (
        <div className="sidebar-footer">
          {!mini && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-2) var(--sp-3)',
              marginBottom: 'var(--sp-1)',
              overflow: 'hidden',
            }}>
              <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                {initial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.full_name ?? profile?.email ?? user?.email}
                </p>
                {profile?.role === 'admin' && (
                  <p style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Admin</p>
                )}
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="sidebar-item"
            style={{ width: '100%', border: 'none', textAlign: 'left', color: 'var(--color-text-2)' }}
            title={mini ? t('nav.signOut') : undefined}
          >
            <span className="sidebar-item__icon"><IconSignOut /></span>
            <span className="sidebar-item__label">{t('nav.signOut')}</span>
          </button>
        </div>
      )}
    </aside>
  );
}

/* ── Inline SVG icons ──────────────────────────────────── */
function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconCart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
}
function IconOrders() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconProfile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21a8 8 0 0116 0"/>
    </svg>
  );
}
function IconSignIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13a8 8 0 0118 0" />
      <path d="M12 3v9" />
      <circle cx="12" cy="14" r="2" />
      <path d="M4 21h16" />
    </svg>
  );
}
