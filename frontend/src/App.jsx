import { Suspense } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import ScrollToTop from './components/common/ScrollToTop';
import BackToTop from './components/common/BackToTop';
import ToastViewport from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import { PageSkeleton } from './components/common/Skeleton';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProductProvider } from './contexts/ProductContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { CartProvider } from './contexts/CartContext';
import { InquiryProvider } from './contexts/InquiryContext';
import { MessageProvider } from './contexts/MessageContext';
import { OrderProvider } from './contexts/OrderContext';
import PreferenceSync from './components/account/PreferenceSync';

/**
 * Routed pages render inside their own error boundary, below every provider, so a failing page shows
 * a recovery screen while the providers and ToastViewport stay mounted. Navigating clears the error.
 */
function RoutedContent() {
  const location = useLocation();
  return (
    <ErrorBoundary variant="page" resetKey={location.pathname}>
      <Suspense fallback={<PageSkeleton />}>
        <AppRoutes />
      </Suspense>
    </ErrorBoundary>
  );
}

// Provider order matters: later providers read from earlier ones
// (for example the cart needs the catalogue, and orders send notifications).
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <ProductProvider>
              <WishlistProvider>
                <CartProvider>
                  <InquiryProvider>
                    <MessageProvider>
                      <OrderProvider>
                        <ScrollToTop />
                        <PreferenceSync />
                        <RoutedContent />
                        <ToastViewport />
                        <BackToTop />
                      </OrderProvider>
                    </MessageProvider>
                  </InquiryProvider>
                </CartProvider>
              </WishlistProvider>
            </ProductProvider>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
