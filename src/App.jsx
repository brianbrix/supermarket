import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import MobileCartBar from './components/MobileCartBar.jsx';
import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import About from './pages/About.jsx';
import Orders from './pages/Orders.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './App.css';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <CartProvider>
          <BrowserRouter>
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
                </Routes>
              </main>
              <Footer />
              <MobileCartBar />
            </div>
          </BrowserRouter>
        </CartProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
