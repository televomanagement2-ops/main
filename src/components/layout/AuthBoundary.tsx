import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthListener } from '../../hooks/useAuth';
import { Toaster } from '../ui/Toaster';

/**
 * Starts the Supabase auth listener for route trees that live outside the
 * storefront shell (admin, sign-in). Route guards read the auth store, so the
 * listener has to be mounted above them or they would wait forever.
 */
export function AuthBoundary({ children }: { children: ReactNode }) {
  useAuthListener();
  return <>{children}</>;
}

/** Bare shell for full-bleed pages: sign-in, password reset, OAuth callback. */
export function BareLayout() {
  useAuthListener();
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
