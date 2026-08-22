import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { MobileMenu } from './MobileMenu';
import { SearchOverlay } from '../search/SearchOverlay';
import { CartDrawer } from '../cart/CartDrawer';
import { CookieConsentBanner } from '../consent/CookieConsentBanner';
import { Toaster } from '../ui/Toaster';
import { useAuthListener } from '../../hooks/useAuth';
import { useUiStore } from '../../store/uiStore';

/**
 * The storefront shell: header, page, footer. Overlay surfaces (search, bag,
 * mobile menu) are mutually exclusive and live here so any page can open them.
 */
export function StoreLayout() {
  useAuthListener();
  const surface = useUiStore((s) => s.surface);
  const toggle = useUiStore((s) => s.toggle);
  const close = useUiStore((s) => s.close);
  const location = useLocation();

  // ⌘K / Ctrl K opens search from anywhere in the storefront.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggle('search');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  // Every navigation starts at the top of the new page and closes any surface.
  useEffect(() => {
    close();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, close]);

  return (
    <div className="store-shell">
      <SiteHeader />

      <main className="store-main">
        <Outlet />
      </main>

      <SiteFooter />

      {surface === 'menu' && <MobileMenu />}
      {surface === 'search' && <SearchOverlay />}
      <CartDrawer />

      <CookieConsentBanner />
      <Toaster />
    </div>
  );
}
