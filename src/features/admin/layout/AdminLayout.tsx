import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useI18n } from '../../../lib/i18n';

export function AdminLayout() {
  const { profile, user } = useAuth();
  const { t } = useI18n();
  const name = profile?.full_name ?? profile?.email ?? user?.email ?? t('admin.fallbackName');

  return (
    <div className="container-wide admin-shell">
      <section className="admin-hero">
        <div className="admin-hero__content">
          <span className="section-eyebrow">{t('admin.eyebrow')}</span>
          <h1 className="heading-1" style={{ marginBottom: 'var(--sp-2)' }}>
            {t('admin.heroTitle')}
          </h1>
          <p className="body" style={{ marginBottom: 'var(--sp-4)' }}>
            {t('admin.heroSubtitle', { name })}
          </p>
          <div className="admin-hero__meta">
            <div className="admin-meta-card">
              <p className="label-caps">{t('admin.metaDailyFocus')}</p>
              <p className="admin-meta-card__value">{t('admin.metaDailyFocusValue')}</p>
            </div>
            <div className="admin-meta-card">
              <p className="label-caps">{t('admin.metaStoreMode')}</p>
              <p className="admin-meta-card__value">{t('admin.metaStoreModeValue')}</p>
            </div>
          </div>
        </div>
        <div className="admin-hero__badge">
          <span>{t('admin.badge')}</span>
        </div>
      </section>

      <nav className="admin-tabs" aria-label={t('admin.navigationLabel')}>
        <NavLink to="/admin" end className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          {t('admin.tabs.overview')}
        </NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          {t('admin.tabs.orders')}
        </NavLink>
        <NavLink to="/admin/catalog" className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          {t('admin.tabs.catalog')}
        </NavLink>
        <NavLink to="/admin/finance" className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          {t('admin.tabs.finance')}
        </NavLink>
      </nav>

      <div className="admin-body">
        <Outlet />
      </div>
    </div>
  );
}
