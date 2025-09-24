import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastContext.jsx';
import { api } from '../services/api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('auth_token') || null; } catch { return null; }
  });
  const [user, setUser] = useState(() => {
    try {
      const rawUser = localStorage.getItem('auth_user');
  if (rawUser) return JSON.parse(rawUser);
  return null;
    } catch { return null; }
  });
  const navigate = useNavigate();
  const { push } = useToast();

  useEffect(() => {
    if (token) localStorage.setItem('auth_token', token); else localStorage.removeItem('auth_token');
  }, [token]);
  useEffect(() => {
    if (user) localStorage.setItem('auth_user', JSON.stringify(user)); else localStorage.removeItem('auth_user');
  }, [user]);

  const login = useCallback(async (username, password) => {
    try {
      const res = await api.auth.login({ username, password });
      setToken(res.token);
  const u = res.user;
      setUser(u);
      push('Logged in', 'info');
      if (u?.role && u.role !== 'CUSTOMER') navigate('/admin/dashboard'); else navigate('/');
      return true;
    } catch (e) {
      push(e.message || 'Login failed', 'error');
      return false;
    }
  }, [navigate, push]);

  const register = useCallback(async (form) => {
    try {
      const res = await api.auth.register(form);
      setToken(res.token);
  const u = res.user;
      setUser(u);
      push('Account created', 'info');
      navigate('/');
      return true;
    } catch (e) {
      push(e.message || 'Registration failed', 'error');
      return false;
    }
  }, [navigate, push]);

  const logout = useCallback(() => {
    setToken(null); setUser(null); navigate('/login');
  }, [navigate]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      push('Password changed', 'info');
      return true;
    } catch (e) {
      push(e.message || 'Change password failed', 'error');
      return false;
    }
  }, [push]);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.auth.me();
      setUser(me);
    } catch { /* ignore */ }
  }, [token]);

  const value = {
    token,
    user,
    login,
    register,
    logout,
    isAuthenticated: !!token,
    isAdmin: !!user && user.role && user.role !== 'CUSTOMER',
    isCustomer: !!user && user.role === 'CUSTOMER',
    changePassword,
    refreshProfile
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
