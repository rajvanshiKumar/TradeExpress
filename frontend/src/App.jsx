import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import ScrollToTop from './components/common/ScrollToTop';
import ToastViewport from './components/common/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProductProvider } from './contexts/ProductContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { CartProvider } from './contexts/CartContext';
import { InquiryProvider } from './contexts/InquiryContext';
import { MessageProvider } from './contexts/MessageContext';
import { OrderProvider } from './contexts/OrderContext';

// Provider order matters: later providers read from earlier ones
// (for example the cart needs the catalogue, and orders send notifications).
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ProductProvider>
            <WishlistProvider>
              <CartProvider>
                <InquiryProvider>
                  <MessageProvider>
                    <OrderProvider>
                      <ScrollToTop />
                      <AppRoutes />
                      <ToastViewport />
                    </OrderProvider>
                  </MessageProvider>
                </InquiryProvider>
              </CartProvider>
            </WishlistProvider>
          </ProductProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
