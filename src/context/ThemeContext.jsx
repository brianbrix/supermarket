import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

const SOURCE_PRIORITY = { nav: 3, user: 3, admin: 2, system: 1 };

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

  useEffect(() => {
    try {
      localStorage.setItem('theme', themeState.value);
      localStorage.setItem('theme_source', themeState.source);
    } catch { /* ignore storage errors */ }
    document.documentElement.setAttribute('data-theme', themeState.value);
    document.documentElement.setAttribute('data-bs-theme', themeState.value);
    document.body?.setAttribute('data-bs-theme', themeState.value);
  }, [themeState.value, themeState.source]);

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

  return (
    <ThemeContext.Provider value={{ theme: themeState.value, themeSource: themeState.source, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
