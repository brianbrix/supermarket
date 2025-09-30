import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_STORE_THEME, normalizeStoreTheme } from '../config/storeThemes.js';

const ThemeContext = createContext();

// Priority: higher number wins. 'layout' is the theme source set by admin homepage layouts —
// it should be stronger than system defaults but lower than explicit user/nav choices.
const SOURCE_PRIORITY = { nav: 3, user: 3, admin: 2, layout: 2, system: 1 };

function normalizeTheme(value) {
  return value === 'dark' ? 'dark' : 'light';
}

function normalizeSource(source) {
  return Object.prototype.hasOwnProperty.call(SOURCE_PRIORITY, source) ? source : null;
}

function initialThemeState(prefersDark) {
  const fallback = prefersDark ? 'dark' : 'light';
  const fallbackSource = 'system';
  try {
    const storedTheme = localStorage.getItem('theme');
    const storedSource = localStorage.getItem('theme_source');
    if (storedTheme) {
      return {
        value: normalizeTheme(storedTheme),
        source: normalizeSource(storedSource) || 'nav',
      };
    }
  } catch { /* ignore storage errors */ }
  return { value: fallback, source: fallbackSource };
}

export function ThemeProvider({ children }) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [themeState, setThemeState] = useState(() => initialThemeState(prefersDark));
  const [storeTheme, setStoreThemeState] = useState(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('storeTheme') : null;
      return normalizeStoreTheme(stored || DEFAULT_STORE_THEME);
    } catch {
      return DEFAULT_STORE_THEME;
    }
  });
  const [storeThemeSource, setStoreThemeSource] = useState(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('storeTheme_source') : null;
      return stored || 'layout';
    } catch {
      return 'layout';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', themeState.value);
      localStorage.setItem('theme_source', themeState.source);
    } catch { /* ignore storage errors */ }
    document.documentElement.setAttribute('data-theme', themeState.value);
    document.documentElement.setAttribute('data-bs-theme', themeState.value);
    document.body?.setAttribute('data-bs-theme', themeState.value);
  }, [themeState.value, themeState.source]);

  useEffect(() => {
    try {
      window.localStorage.setItem('storeTheme', storeTheme);
      window.localStorage.setItem('storeTheme_source', storeThemeSource);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-store-theme', storeTheme);
  }, [storeTheme, storeThemeSource]);

  function applyTheme(value, source = 'nav') {
    const normalizedValue = normalizeTheme(value);
    const normalizedSource = normalizeSource(source) || 'nav';
    const nextPriority = SOURCE_PRIORITY[normalizedSource] ?? 0;
    setThemeState(prev => {
      const current = prev || { value: normalizedValue, source: 'system' };
      const prevPriority = SOURCE_PRIORITY[current.source] ?? 0;
      if (nextPriority < prevPriority) {
        return current;
      }
      if (current.value === normalizedValue && current.source === normalizedSource) {
        return current;
      }
      return { value: normalizedValue, source: normalizedSource };
    });
  }

  function toggleTheme() {
    const next = themeState.value === 'light' ? 'dark' : 'light';
    applyTheme(next, 'nav');
  }

  function setTheme(value, source = 'nav') {
    applyTheme(value, source);
  }

  const applyStoreTheme = (value, source = 'layout') => {
    const normalizedValue = normalizeStoreTheme(value);
    const normalizedSource = source || 'layout';
    setStoreThemeState(prev => (prev === normalizedValue ? prev : normalizedValue));
    setStoreThemeSource(prev => (prev === normalizedSource ? prev : normalizedSource));
  };

  const contextValue = useMemo(() => ({
    theme: themeState.value,
    themeSource: themeState.source,
    toggleTheme,
    setTheme,
    storeTheme,
    storeThemeSource,
    setStoreTheme: applyStoreTheme
  }), [themeState.value, themeState.source, storeTheme, storeThemeSource]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
