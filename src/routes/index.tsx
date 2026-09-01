import { Suspense, lazy, type ComponentType, type ReactElement } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { StoreLayout } from '../components/layout/StoreLayout';
import { HomePage } from '../features/products/pages/HomePage';
import { ProductListPage } from '../features/products/pages/ProductListPage';
import { ProductDetailPage } from '../features/products/pages/ProductDetailPage';
import { CartPage } from '../features/cart/pages/CartPage';
import { OrdersPage } from '../features/orders/pages/OrdersPage';
import { OrderDetailPage } from '../features/orders/pages/OrderDetailPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { AuthCallbackPage } from '../features/auth/pages/AuthCallbackPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { CheckoutPage } from '../features/checkout/pages/CheckoutPage';
import { CheckoutSuccessPage } from '../features/checkout/pages/CheckoutSuccessPage';
import { CheckoutCancelPage } from '../features/checkout/pages/CheckoutCancelPage';
import { ProfilePage } from '../features/profile/pages/ProfilePage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { HelpPage } from '../features/help/pages/HelpPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import { AuthBoundary, BareLayout } from '../components/layout/AuthBoundary';

// ── Split out of the entry chunk ─────────────────────────────────────────────
// The admin console pulls in recharts, and the legal pages carry the full text
// of three policies in three languages. Neither is on any storefront path, but
// a static import put both in the bundle every visitor downloads before the
// first product renders. These load on navigation instead.
//
// The pages use named exports, hence the .then() unwrap: React.lazy resolves
// the module's `default`.
const named = <P,>(
  loader: () => Promise<Record<string, unknown>>,
  key: string,
) => lazy(async () => ({ default: (await loader())[key] as ComponentType<P> }));

const AdminLayout = named(() => import('../features/admin/layout/AdminLayout'), 'AdminLayout');
const AdminDashboardPage = named(() => import('../features/admin/pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminOrdersPage = named(() => import('../features/admin/pages/AdminOrdersPage'), 'AdminOrdersPage');
const AdminCatalogPage = named(() => import('../features/admin/pages/AdminCatalogPage'), 'AdminCatalogPage');
const AdminFinancePage = named(() => import('../features/admin/pages/AdminFinancePage'), 'AdminFinancePage');
const PrivacyPage = named(() => import('../features/legal/pages/PrivacyPage'), 'PrivacyPage');
const PrivacyPolicyPage = named(() => import('../features/legal/pages/PrivacyPolicyPage'), 'PrivacyPolicyPage');
const TermsPage = named(() => import('../features/legal/pages/TermsPage'), 'TermsPage');
const CookiePolicyPage = named(() => import('../features/legal/pages/CookiePolicyPage'), 'CookiePolicyPage');

/** Wrap a lazy route element in the same spinner the route guards already use. */
function deferred(element: ReactElement): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="page-loading">
          <div className="spinner" />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

const router = createBrowserRouter([
  // ── Storefront: editorial shell (header + footer + overlay surfaces) ──
  {
    path: '/',
    element: <StoreLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ProductListPage /> },
      { path: 'products/:slug', element: <ProductDetailPage /> },
      {
        path: 'cart',
        element: (
          <ProtectedRoute>
            <CartPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'checkout',
        element: (
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'checkout/success',
        element: (
          <ProtectedRoute>
            <CheckoutSuccessPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'checkout/cancel',
        element: (
          <ProtectedRoute>
            <CheckoutCancelPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:orderId',
        element: (
          <ProtectedRoute>
            <OrderDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      { path: 'help', element: <HelpPage /> },
      { path: 'privacy', element: deferred(<PrivacyPage />) },
      { path: 'privacy-policy', element: deferred(<PrivacyPolicyPage />) },
      { path: 'terms', element: deferred(<TermsPage />) },
      { path: 'cookies', element: deferred(<CookiePolicyPage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },

  // ── Auth: full-bleed, no store chrome ──
  {
    path: '/',
    element: <BareLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'auth/reset', element: <ResetPasswordPage /> },
    ],
  },

  // ── Admin: operational shell (rail + workspace) ──
  {
    path: '/admin',
    element: (
      <AuthBoundary>
        <AdminRoute>{deferred(<AdminLayout />)}</AdminRoute>
      </AuthBoundary>
    ),
    children: [
      { index: true, element: deferred(<AdminDashboardPage />) },
      { path: 'orders', element: deferred(<AdminOrdersPage />) },
      { path: 'catalog', element: deferred(<AdminCatalogPage />) },
      { path: 'finance', element: deferred(<AdminFinancePage />) },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
