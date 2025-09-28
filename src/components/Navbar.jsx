import { Link, NavLink } from 'react-router-dom';
import { BRAND_NAME } from '../config/brand.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';

export default function Navbar() {
  const { count } = useCart();
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { settings } = useSettings();
  const brandName = settings?.storeName || BRAND_NAME;
  const canToggleTheme = settings?.theme?.enableDarkMode !== false;
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  // Close user menu on outside click
  useEffect(() => {
    function handleDocClick(e) {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  function handleNavClick() {
    setOpen(false);
  }
  return (
  <nav className="navbar navbar-expand-md bg-body border-bottom sticky-top py-2" data-bs-theme={theme} role="navigation" aria-label="Main navigation"> 
      <div className="container-fluid">
  <Link className="navbar-brand fw-bold text-success fs-3" to="/">{brandName}</Link>
        <button className="navbar-toggler" type="button" aria-controls="mainNavLinks" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
          <span className="navbar-toggler-icon"></span>
        </button>
        <div id="mainNavLinks" className={`collapse navbar-collapse justify-content-center${open ? ' show' : ''}`}> 
          <ul className="navbar-nav gap-1 gap-md-2 mb-3 mb-md-0 fs-5 fw-medium text-center align-items-md-center">
            <li className="nav-item">
              <NavLink end className={({isActive})=>`nav-link px-3 d-flex align-items-center gap-1${isActive?' active fw-semibold':''}`} to="/" onClick={handleNavClick}>
                <i className="bi bi-house-fill"></i><span>Home</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={({isActive})=>`nav-link px-3 d-flex align-items-center gap-1 position-relative${isActive?' active fw-semibold':''}`} to="/cart" onClick={handleNavClick}>
                <i className="bi bi-basket-fill"></i><span>Cart</span>
                {count > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success small">{count}</span>}
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={({isActive})=>`nav-link px-3 d-flex align-items-center gap-1${isActive?' active fw-semibold':''}`} to="/orders" onClick={handleNavClick}>
                <i className="bi bi-receipt-cutoff"></i><span>My Orders</span>
              </NavLink>
            </li>
               <li className="nav-item">
              <NavLink className={({isActive})=>`nav-link px-3 d-flex align-items-center gap-1${isActive?' active fw-semibold':''}`} to="/about" onClick={handleNavClick}>
                <i className="bi bi-info-circle-fill"></i><span>About</span>
              </NavLink>
            </li>
            {!isAuthenticated && (
              <li className="nav-item">
                <NavLink className={({isActive})=>`nav-link px-3 d-flex align-items-center gap-1${isActive?' active fw-semibold':''}`} to="/login" onClick={handleNavClick}>
                  <i className="bi bi-person"></i><span>Login</span>
                </NavLink>
              </li>
            )}
            {isAuthenticated && isAdmin && (
              <li className="nav-item">
                <NavLink className={({isActive})=>`nav-link px-3 d-flex align-items-center gap-1${isActive?' active fw-semibold':''}`} to="/admin/dashboard" onClick={handleNavClick}>
                  <i className="bi bi-speedometer2"></i><span>Admin</span>
                </NavLink>
              </li>
            )}
            {isAuthenticated && (
              <li className="nav-item dropdown" ref={userMenuRef}>
                <button
                  type="button"
                  className="nav-link dropdown-toggle px-3 d-flex align-items-center gap-1 btn btn-link"
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen(o => !o)}
                >
                  <i className="bi bi-person-circle"></i>
                  <span>{user?.firstName || user?.username || 'User'}</span>
                </button>
                <ul className={`dropdown-menu dropdown-menu-end${userMenuOpen ? ' show' : ''}`}> 
                  <li className="dropdown-header small text-muted">Signed in as <strong>{user?.username}</strong></li>
                  {user?.role && user.role !== 'CUSTOMER' && (
                    <li><span className="dropdown-item-text small"><i className="bi bi-shield-lock me-1"></i>{user.role.replace('_',' ')}</span></li>
                  )}
                  <li><hr className="dropdown-divider" /></li>
                  {/* Placeholder profile & settings (could link to future pages) */}
                  <li><button className="dropdown-item" type="button" onClick={()=>{ setUserMenuOpen(false); navigate('/account/profile'); }}>Profile</button></li>
                  <li><button className="dropdown-item" type="button" onClick={()=>{ setUserMenuOpen(false); navigate('/account/settings'); }}>Settings</button></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><button className="dropdown-item" type="button" onClick={() => { setUserMenuOpen(false); logout(); }}>Logout</button></li>
                </ul>
              </li>
            )}
            <li className="nav-item d-md-flex align-items-center ms-md-3">
        <button type="button" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 w-100 w-md-auto" onClick={canToggleTheme ? toggleTheme : undefined} aria-label="Toggle dark mode" disabled={!canToggleTheme} aria-disabled={!canToggleTheme}>
                <i className={`bi ${theme==='light' ? 'bi-moon-stars-fill' : 'bi-brightness-high-fill'}`}></i>
                <span className="d-md-none">{theme==='light' ? 'Dark' : 'Light'}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
