import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastContext.jsx';
import { api } from '../services/api.js';
import { useTheme } from './ThemeContext.jsx';

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
  const [preferences, setPreferences] = useState(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const navigate = useNavigate();
  const { push } = useToast();
  const { setTheme } = useTheme();
  const appliedThemePreferenceRef = useRef(null);

  useEffect(() => {
    if (token) localStorage.setItem('auth_token', token); else localStorage.removeItem('auth_token');
  }, [token]);
  useEffect(() => {
    if (user) localStorage.setItem('auth_user', JSON.stringify(user)); else localStorage.removeItem('auth_user');
  }, [user]);

  const isAdminRole = useCallback((role) => role === 'ADMIN', []);
  const login = useCallback(async (identifier, password) => {
    try {
      const res = await api.auth.login({ identifier, password });
      setToken(res.token);
  const u = res.user;
      setUser(u);
      push('Logged in', 'info');
      if (isAdminRole(u?.role)) navigate('/admin/dashboard'); else navigate('/');
      return true;
    } catch (e) {
      push(e.message || 'Login failed', 'error');
      return false;
    }
  }, [navigate, push, isAdminRole]);

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
    setToken(null); setUser(null); setPreferences(null); navigate('/login');
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

  const refreshPreferences = useCallback(async () => {
    if (!token) {
      setPreferences(null);
      return null;
    }
    setPreferencesLoading(true);
    try {
      const data = await api.user.preferences.get();
      setPreferences(data);
      return data;
    } catch (err) {
      return null;
    } finally {
      setPreferencesLoading(false);
    }
  }, [token]);

  const updatePreferences = useCallback(async (payload) => {
    if (!token) throw new Error('Not authenticated');
    const data = await api.user.preferences.update(payload);
    setPreferences(data);
    return data;
  }, [token]);

  useEffect(() => {
    if (!token) {
      setPreferences(null);
      return;
    }
    refreshPreferences();
  }, [token, refreshPreferences]);

  useEffect(() => {
    if (!preferences?.themePreference) return;
    if (appliedThemePreferenceRef.current === preferences.themePreference) return;
    appliedThemePreferenceRef.current = preferences.themePreference;
    setTheme(preferences.themePreference, 'user');
  }, [preferences?.themePreference, setTheme]);

  const value = {
    token,
    user,
    login,
    register,
    logout,
    isAuthenticated: !!token,
  isAdmin: !!user && isAdminRole(user.role),
    isCustomer: !!user && user.role === 'CUSTOMER',
    changePassword,
    refreshProfile,
    preferences,
    preferencesLoading,
    refreshPreferences,
    updatePreferences
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
