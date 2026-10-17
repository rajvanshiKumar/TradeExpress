import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import DashboardLayout from '../components/layout/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import Home from '../pages/Home';
import Products from '../pages/Products';
import ProductDetails from '../pages/ProductDetails';
import Categories from '../pages/Categories';
import CategoryDetails from '../pages/CategoryDetails';
import Suppliers from '../pages/Suppliers';
import SupplierDetails from '../pages/SupplierDetails';
import RequestQuote from '../pages/RequestQuote';
import Cart from '../pages/Cart';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import AdminLogin from '../pages/AdminLogin';
import Info from '../pages/Info';
import NotFound from '../pages/NotFound';
import BuyerWishlist from '../pages/buyer/BuyerWishlist';

const Messages = lazy(() => import('../pages/Messages'));
const Checkout = lazy(() => import('../pages/Checkout'));
const OrderConfirmation = lazy(() => import('../pages/OrderConfirmation'));
const OrderTracking = lazy(() => import('../pages/OrderTracking'));
const BuyerDashboard = lazy(() => import('../pages/buyer/BuyerDashboard'));
const BuyerOrders = lazy(() => import('../pages/buyer/BuyerOrders'));
const BuyerQuotes = lazy(() => import('../pages/buyer/BuyerQuotes'));
const BuyerProfile = lazy(() => import('../pages/buyer/BuyerProfile'));
const BuyerAddresses = lazy(() => import('../pages/buyer/BuyerAddresses'));
const SupplierDashboard = lazy(() => import('../pages/supplier/SupplierDashboard'));
const SupplierProducts = lazy(() => import('../pages/supplier/SupplierProducts'));
const SupplierProductForm = lazy(() => import('../pages/supplier/SupplierProductForm'));
const SupplierOrders = lazy(() => import('../pages/supplier/SupplierOrders'));
const SupplierInquiries = lazy(() => import('../pages/supplier/SupplierInquiries'));
const SupplierAnalytics = lazy(() => import('../pages/supplier/SupplierAnalytics'));
const SupplierSettings = lazy(() => import('../pages/supplier/SupplierSettings'));
const SupplierVerification = lazy(() => import('../pages/supplier/SupplierVerification'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('../pages/admin/AdminProducts'));
const AdminCompanies = lazy(() => import('../pages/admin/AdminCompanies'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));
const AdminCategories = lazy(() => import('../pages/admin/AdminCategories'));
const AdminReports = lazy(() => import('../pages/admin/AdminReports'));
const AdminVerification = lazy(() => import('../pages/admin/AdminVerification'));

// Dashboards, messaging and checkout load on demand to keep the first page light.
export default function AppRoutes() {
  return (
    <Routes>
      {/* Public marketplace */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetails />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/categories/:slug" element={<CategoryDetails />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/:slug" element={<SupplierDetails />} />
        <Route path="/rfq" element={<RequestQuote />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<BuyerWishlist standalone />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/info/:slug" element={<Info />} />
        <Route path="/track" element={<OrderTracking />} />
        <Route path="/track/:orderNumber" element={<OrderTracking />} />

        {/* Signed-in pages that keep the marketplace layout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/messages" element={<Messages />} />
          <Route element={<RoleRoute roles={['buyer']} />}>
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Dashboards */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute roles={['buyer']} />}>
          <Route element={<DashboardLayout role="buyer" />}>
            <Route path="/buyer" element={<BuyerDashboard />} />
            <Route path="/buyer/orders" element={<BuyerOrders />} />
            <Route path="/buyer/quotes" element={<BuyerQuotes />} />
            <Route path="/buyer/wishlist" element={<BuyerWishlist />} />
            <Route path="/buyer/addresses" element={<BuyerAddresses />} />
            <Route path="/buyer/profile" element={<BuyerProfile />} />
          </Route>
        </Route>
        <Route element={<RoleRoute roles={['supplier']} />}>
          <Route element={<DashboardLayout role="supplier" />}>
            <Route path="/supplier" element={<SupplierDashboard />} />
            <Route path="/supplier/products" element={<SupplierProducts />} />
            <Route path="/supplier/products/new" element={<SupplierProductForm />} />
            <Route path="/supplier/products/:id/edit" element={<SupplierProductForm />} />
            <Route path="/supplier/orders" element={<SupplierOrders />} />
            <Route path="/supplier/inquiries" element={<SupplierInquiries />} />
            <Route path="/supplier/analytics" element={<SupplierAnalytics />} />
            <Route path="/supplier/settings" element={<SupplierSettings />} />
            <Route path="/supplier/verification" element={<SupplierVerification />} />
          </Route>
        </Route>
        <Route element={<RoleRoute roles={['admin']} />}>
          <Route element={<DashboardLayout role="admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/companies" element={<AdminCompanies />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/verification" element={<AdminVerification />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
