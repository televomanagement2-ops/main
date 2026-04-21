import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DesktopNavBar } from './DesktopNavBar';
import { BottomNavBar } from './BottomNavBar';
import { useAuthListener } from '../../hooks/useAuth';

export function RootLayout() {
  useAuthListener();

  // On desktop start mini; on mobile mini state is irrelevant (drawer mode)
  const [mini, setMini] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMini = useCallback(() => setMini((v) => !v), []);
  // On mobile the hamburger opens the drawer; on desktop it toggles mini mode
  const handleHamburger = useCallback(() => {
    if (window.innerWidth <= 768) {
      setMobileOpen((v) => !v);
    } else {
      setMini((v) => !v);
    }
  }, []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="app-shell">
      {/* Overlay for mobile drawer */}
      {mobileOpen && (
        <div
          className="sidebar-overlay sidebar-overlay--visible"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        mini={mobileOpen ? false : mini}
        onToggleMini={toggleMini}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
      />

      {/* Main area */}
      <div className={`main-area${mini ? ' main-area--mini' : ''}`}>
        <DesktopNavBar onMenuClick={handleHamburger} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      <BottomNavBar onMenuClick={handleHamburger} />
    </div>
  );
}
