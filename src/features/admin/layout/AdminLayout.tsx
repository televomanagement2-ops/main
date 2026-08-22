import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useI18n } from '../../../lib/i18n';
import { useAdminAnalytics } from '../../../hooks/useAdminAnalytics';
import { Wordmark } from '../../../components/ui/Wordmark';
import { Toaster } from '../../../components/ui/Toaster';
import { supabase } from '../../../lib/supabaseClient';
import { useThemeStore } from '../../../store/themeStore';
import {
  IconChart,
  IconExternal,
  IconGrid,
  IconHome,
  IconLogout,
  IconMenu,
  IconMoon,
  IconReceipt,
  IconSun,
  IconUser,
  IconWallet,
} from '../../../components/ui/icons';

/**
 * The admin shell. The rail is deliberately recessed — it sits on the page
 * colour while the workspace sits on the raised surface, so attention lands on
 * the work rather than the navigation.
 */
export function AdminLayout() {
  const { profile, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: analytics } = useAdminAnalytics();
  const { theme, setTheme } = useThemeStore();
  const [railOpen, setRailOpen] = useState(false);

  // Navigating closes the mobile rail. Adjusted during render so the overlay
  // never paints over the page the user just opened.
  const [seenPath, setSeenPath] = useState(location.pathname);
  if (location.pathname !== seenPath) {
    setSeenPath(location.pathname);
    if (railOpen) setRailOpen(false);
  }

  const name = profile?.full_name ?? profile?.email ?? user?.email ?? t('admin.fallbackName');
  const initial = name.charAt(0).toUpperCase();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const pendingReview = analytics?.needsReview ?? 0;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="admin">
      {railOpen && (
        <div
          className="overlay overlay--rail"
          onClick={() => setRailOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`admin__rail${railOpen ? ' is-open' : ''}`} aria-label={t('admin.navigationLabel')}>
        <div className="admin__rail-head">
          <Wordmark to="/admin" />
          <NavLink to="/" className="rail-item" style={{ width: 'auto' }} aria-label={t('admin.viewStore')}>
            <IconExternal size={15} />
          </NavLink>
        </div>

        <div className="admin__rail-scroll">
          <nav className="rail-group" aria-label={t('admin.sections.operate')}>
            <p className="t-label rail-group__label">{t('admin.sections.operate')}</p>
            <RailLink to="/admin" end icon={<IconChart size={16} />} label={t('admin.tabs.overview')} />
            <RailLink
              to="/admin/orders"
              icon={<IconReceipt size={16} />}
              label={t('admin.tabs.orders')}
              count={pendingReview > 0 ? pendingReview : undefined}
            />
            <RailLink to="/admin/catalog" icon={<IconGrid size={16} />} label={t('admin.tabs.catalog')} />
            <RailLink to="/admin/finance" icon={<IconWallet size={16} />} label={t('admin.tabs.finance')} />
          </nav>

          <nav className="rail-group" aria-label={t('sidebar.store')}>
            <p className="t-label rail-group__label">{t('sidebar.store')}</p>
            <RailLink to="/" end icon={<IconHome size={16} />} label={t('sidebar.home')} />
            <RailLink to="/products" icon={<IconGrid size={16} />} label={t('sidebar.products')} />
            <RailLink to="/orders" icon={<IconReceipt size={16} />} label={t('sidebar.myOrders')} />
            <RailLink to="/profile" icon={<IconUser size={16} />} label={t('sidebar.profile')} />
          </nav>
        </div>

        <div className="admin__rail-foot">
          <div className="rail-user">
            <span className="rail-user__avatar" aria-hidden="true">{initial}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="rail-user__name">{name}</span>
              {profile?.role === 'admin' && <span className="rail-user__role">{t('sidebar.admin')}</span>}
            </span>
          </div>
          <button
            type="button"
            className="rail-item"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            <span className="rail-item__icon">{isDark ? <IconSun size={16} /> : <IconMoon size={16} />}</span>
            <span className="rail-item__label">{isDark ? t('profile.lightMode') : t('profile.darkMode')}</span>
          </button>
          <button type="button" className="rail-item" onClick={handleSignOut}>
            <span className="rail-item__icon"><IconLogout size={16} /></span>
            <span className="rail-item__label">{t('nav.signOut')}</span>
          </button>
        </div>
      </aside>

      <div className="admin__main">
        <div className="admin__topbar">
          <button
            type="button"
            className="rail-item"
            style={{ width: 'auto' }}
            onClick={() => setRailOpen(true)}
            aria-label={t('nav.openMenu')}
          >
            <IconMenu size={18} />
          </button>
          <Wordmark to="/admin" />
        </div>

        <div className="admin__content">
          <Outlet />
        </div>
      </div>

      <Toaster />
    </div>
  );
}

function RailLink({
  to,
  icon,
  label,
  count,
  end,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  end?: boolean;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `rail-item${isActive ? ' is-active' : ''}`}>
      <span className="rail-item__icon">{icon}</span>
      <span className="rail-item__label">{label}</span>
      {count != null && <span className="rail-item__count">{count}</span>}
    </NavLink>
  );
}
