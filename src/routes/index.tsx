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
import { ProtectedRoute } from './ProtectedRoute';

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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
