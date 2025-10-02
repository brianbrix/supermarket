import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef, lazy, Suspense } from 'react';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import MobileCartBar from './components/MobileCartBar.jsx';
const Home = lazy(() => import('./pages/Home.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Delivery = lazy(() => import('./pages/Delivery.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout.jsx'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts.jsx'));
const AdminProductLayouts = lazy(() => import('./pages/admin/AdminProductLayouts.jsx'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics.jsx'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories.jsx'));
const AdminProductTags = lazy(() => import('./pages/admin/AdminProductTags.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications.jsx'));
const AdminDeliveries = lazy(() => import('./pages/admin/AdminDeliveries.jsx'));
const AdminDeliveryShops = lazy(() => import('./pages/admin/AdminDeliveryShops.jsx'));
const AdminPaymentOptions = lazy(() => import('./pages/admin/AdminPaymentOptions.jsx'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons.jsx'));
const AdminSystemSettings = lazy(() => import('./pages/admin/AdminSystemSettings.jsx'));
const AdminDeliverySettings = lazy(() => import('./pages/admin/AdminDeliverySettings.jsx'));
const AdminHomepage = lazy(() => import('./pages/admin/AdminHomepage.jsx'));
const AdminAboutPage = lazy(() => import('./pages/admin/AdminAboutPage.jsx'));
const AdminBrands = lazy(() => import('./pages/admin/AdminBrands.jsx'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx'));
const CustomerLogin = lazy(() => import('./pages/CustomerLogin.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout.jsx'));
const Profile = lazy(() => import('./pages/account/Profile.jsx'));
const AccountSettings = lazy(() => import('./pages/account/AccountSettings.jsx'));
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { configureAuthTokenGetter } from './services/api.js';
import './App.css';
import { SettingsProvider, useSettings } from './context/SettingsContext.jsx';
import { setStaticCurrency } from './utils/currency.js';

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return children;
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const baseUrl = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const routerBaseName = baseUrl === '/' ? '' : baseUrl;

  return (
    <SettingsProvider>
      <ThemeProvider>
        <SettingsHydrator />
        <ToastProvider>
          <CartProvider>
            <BrowserRouter basename={routerBaseName}>
              <AuthProvider>
                <AuthConfigurator />
                <div className="layout">
                  <Navbar />
                  <main>
                    <Suspense fallback={<RouteFallback />}>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/product/:id" element={<ProductDetail />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/delivery" element={<Delivery />} />
                        <Route path="/orders" element={<Orders />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/login" element={<CustomerLogin />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/admin" element={<Protected><AdminLayout /></Protected>}>
                          <Route index element={<Navigate to="dashboard" replace />} />
                          <Route path="dashboard" element={<AdminDashboard />} />
                          <Route path="notifications" element={<AdminNotifications />} />
                          <Route path="homepage" element={<AdminHomepage />} />
                          <Route path="about" element={<AdminAboutPage />} />
                          <Route path="products" element={<AdminProducts />} />
                          <Route path="product-layouts" element={<AdminProductLayouts />} />
                          <Route path="brands" element={<AdminBrands />} />
                          <Route path="orders" element={<AdminOrders />} />
                          <Route path="deliveries" element={<AdminDeliveries />} />
                          <Route path="delivery-shops" element={<AdminDeliveryShops />} />
                          <Route path="users" element={<AdminUsers />} />
                          <Route path="payments" element={<AdminPayments />} />
                          <Route path="analytics" element={<AdminAnalytics />} />
                          <Route path="categories" element={<AdminCategories />} />
                          <Route path="product-tags" element={<AdminProductTags />} />
                          <Route path="coupons" element={<AdminCoupons />} />
                          <Route path="payment-options" element={<AdminPaymentOptions />} />
                          <Route path="system-settings" element={<AdminSystemSettings />} />
                          <Route path="delivery-settings" element={<AdminDeliverySettings />} />
                        </Route>
                        <Route path="/account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
                          <Route index element={<Profile />} />
                          <Route path="profile" element={<Profile />} />
                          <Route path="settings" element={<AccountSettings />} />
                        </Route>
                        <Route path="/profile" element={<Navigate to="/account/profile" replace />} />
                        <Route path="/settings" element={<Navigate to="/account/settings" replace />} />
                      </Routes>
                    </Suspense>
                  </main>
                  <Footer />
                  <MobileCartBar />
                </div>
              </AuthProvider>
            </BrowserRouter>
          </CartProvider>
        </ToastProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

function RouteFallback() {
  return (
    <div className="page-loading d-flex align-items-center justify-content-center py-5" aria-live="polite">
      <div className="spinner-border text-success me-3" role="status" aria-hidden="true"></div>
      <span className="fw-medium">Loading…</span>
    </div>
  );
}

function AuthConfigurator() {
  const { token } = useAuth();
  configureAuthTokenGetter(() => token);
  return null;
}

function SettingsHydrator() {
  const { settings, loading } = useSettings();
  const { setTheme, themeSource } = useTheme();
  const lastAppliedThemeRef = useRef(null);

  useEffect(() => {
    if (loading) return;
    if (settings?.currency) {
      setStaticCurrency({
        code: settings.currency.code,
        symbol: settings.currency.symbol,
        locale: settings.currency.locale,
        minimumFractionDigits: settings.currency.minimumFractionDigits,
      });
    }
  }, [loading, settings]);

  useEffect(() => {
    if (loading) return;
    const desired = settings?.theme?.default;
    if (!desired) return;
    if (themeSource === 'nav' || themeSource === 'user') return;
    if (lastAppliedThemeRef.current === desired) return;
    lastAppliedThemeRef.current = desired;
    setTheme(desired, 'admin');
  }, [loading, settings?.theme?.default, setTheme, themeSource]);

  return null;
}
