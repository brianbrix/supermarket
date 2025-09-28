import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import MobileCartBar from './components/MobileCartBar.jsx';
import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import About from './pages/About.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminPayments from './pages/admin/AdminPayments.jsx';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import CustomerLogin from './pages/CustomerLogin.jsx';
import Register from './pages/Register.jsx';
import Orders from './pages/Orders.jsx';
import AdminPaymentOptions from './pages/admin/AdminPaymentOptions.jsx';
import AdminSystemSettings from './pages/admin/AdminSystemSettings.jsx';
import AccountLayout from './pages/account/AccountLayout.jsx';
import Profile from './pages/account/Profile.jsx';
import AccountSettings from './pages/account/AccountSettings.jsx';
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
  return (
    <SettingsProvider>
      <ThemeProvider>
        <SettingsHydrator />
        <ToastProvider>
          <CartProvider>
            <BrowserRouter>
              <AuthProvider>
                <AuthConfigurator />
                <div className="layout">
                  <Navbar />
                  <main>
                    <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/products" element={<Home />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/login" element={<CustomerLogin />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/admin" element={<Protected><AdminLayout /></Protected>}>
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="payments" element={<AdminPayments />} />
                      <Route path="analytics" element={<AdminAnalytics />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="payment-options" element={<AdminPaymentOptions />} />
                      <Route path="system-settings" element={<AdminSystemSettings />} />
                    </Route>
                      <Route path="/account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
                        <Route index element={<Profile />} />
                        <Route path="profile" element={<Profile />} />
                        <Route path="settings" element={<AccountSettings />} />
                      </Route>
                      <Route path="/profile" element={<Navigate to="/account/profile" replace />} />
                      <Route path="/settings" element={<Navigate to="/account/settings" replace />} />
                    </Routes>
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
