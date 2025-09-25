import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import CustomerLogin from './pages/CustomerLogin.jsx';
import Register from './pages/Register.jsx';
import Orders from './pages/Orders.jsx';
import AdminPaymentOptions from './pages/admin/AdminPaymentOptions.jsx';
// Placeholder profile/settings pages
function ProfilePage() { return <div className="container py-4"><h1 className="h4 mb-3">Profile</h1><p className="text-muted">User profile details will appear here.</p></div>; }
function SettingsPage() { return <div className="container py-4"><h1 className="h4 mb-3">Settings</h1><p className="text-muted">Account settings will appear here.</p></div>; }
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { configureAuthTokenGetter } from './services/api.js';
import './App.css';

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
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
                      <Route path="payments" element={<AdminPayments />} />
                      <Route path="analytics" element={<AdminAnalytics />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="payment-options" element={<AdminPaymentOptions />} />
                    </Route>
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
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
  );
}

function AuthConfigurator() {
  const { token } = useAuth();
  configureAuthTokenGetter(() => token);
  return null;
}
