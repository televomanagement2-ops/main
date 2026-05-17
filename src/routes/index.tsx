import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { RootLayout } from '../components/layout/RootLayout';
import { HomePage } from '../features/products/pages/HomePage';
import { ProductListPage } from '../features/products/pages/ProductListPage';
import { ProductDetailPage } from '../features/products/pages/ProductDetailPage';
import { CartPage } from '../features/cart/pages/CartPage';
import { OrdersPage } from '../features/orders/pages/OrdersPage';
import { OrderDetailPage } from '../features/orders/pages/OrderDetailPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { AuthCallbackPage } from '../features/auth/pages/AuthCallbackPage';
import { CheckoutPage } from '../features/checkout/pages/CheckoutPage';
import { CheckoutSuccessPage } from '../features/checkout/pages/CheckoutSuccessPage';
import { CheckoutCancelPage } from '../features/checkout/pages/CheckoutCancelPage';
import { ProfilePage } from '../features/profile/pages/ProfilePage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { HelpPage } from '../features/help/pages/HelpPage';
import { PrivacyPage } from '../features/legal/pages/PrivacyPage';
import { PrivacyPolicyPage } from '../features/legal/pages/PrivacyPolicyPage';
import { TermsPage } from '../features/legal/pages/TermsPage';
import { CookiePolicyPage } from '../features/legal/pages/CookiePolicyPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import { AdminLayout } from '../features/admin/layout/AdminLayout';
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage';
import { AdminOrdersPage } from '../features/admin/pages/AdminOrdersPage';
import { AdminCatalogPage } from '../features/admin/pages/AdminCatalogPage';
import { AdminFinancePage } from '../features/admin/pages/AdminFinancePage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ProductListPage /> },
      { path: 'products/:slug', element: <ProductDetailPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
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
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'privacy-policy', element: <PrivacyPolicyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'cookies', element: <CookiePolicyPage /> },
      {
        path: 'admin',
        element: (
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        ),
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'orders', element: <AdminOrdersPage /> },
          { path: 'catalog', element: <AdminCatalogPage /> },
          { path: 'finance', element: <AdminFinancePage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
