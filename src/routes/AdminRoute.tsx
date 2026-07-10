import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: ReactNode;
}

export function AdminRoute({ children }: Props) {
  const { isAuthenticated, isLoading, isAdmin, profileStatus } = useAuth();
  const location = useLocation();

  // Wait for the profile too: on a hard refresh the session arrives before
  // the profile, and redirecting during that window bounced admins to "/".
  const profilePending = isAuthenticated && (profileStatus === 'idle' || profileStatus === 'loading');

  if (isLoading || profilePending) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
