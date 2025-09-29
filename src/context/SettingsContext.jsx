import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const SettingsContext = createContext({
  settings: {
    storeName: 'KenSuper',
    currency: {
      code: 'KES',
      symbol: 'KES',
      locale: 'en-KE',
      minimumFractionDigits: 0,
    },
    theme: {
      default: 'light',
      enableDarkMode: true,
    },
  },
  loading: true,
  error: null,
  refresh: () => Promise.resolve(),
  formatCurrency: (amount, override) => fallbackFormat(amount, override),
});

const DEFAULT_SETTINGS = {
  storeName: 'KenSuper',
  currency: {
    code: 'KES',
    symbol: 'KES',
    locale: 'en-KE',
    minimumFractionDigits: 0,
  },
  theme: {
    default: 'light',
    enableDarkMode: true,
  },
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.settings.get();
      const normalized = normalizeSettings(res);
      setSettings(normalized);
    } catch (err) {
      setError(err?.message || 'Unable to load settings');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatAmount = useCallback((amount, override = {}) => {
    return formatWithSettings(settings.currency, amount, override);
  }, [settings.currency]);

  const value = useMemo(() => ({
    settings,
    loading,
    error,
    refresh: load,
    formatCurrency: formatAmount,
  }), [settings, loading, error, load, formatAmount]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

export function useCurrencyFormatter() {
  const { formatCurrency } = useSettings();
  return formatCurrency;
}

function normalizeSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const currency = {
    code: normalizeString(raw['currency.code'] || raw.currency?.code || DEFAULT_SETTINGS.currency.code).toUpperCase(),
    symbol: normalizeString(raw['currency.symbol'] || raw.currency?.symbol || raw['currency.code'] || DEFAULT_SETTINGS.currency.symbol),
    locale: normalizeString(raw['currency.locale'] || raw.currency?.locale || DEFAULT_SETTINGS.currency.locale),
    minimumFractionDigits: normalizeFractionDigits(raw['currency.minimumFractionDigits'] ?? raw.currency?.minimumFractionDigits ?? DEFAULT_SETTINGS.currency.minimumFractionDigits),
  };

  const theme = {
    default: (raw['theme.default'] || raw.theme?.default || DEFAULT_SETTINGS.theme.default)?.toLowerCase() === 'dark' ? 'dark' : 'light',
    enableDarkMode: Boolean(raw['theme.enableDarkMode'] ?? raw.theme?.enableDarkMode ?? DEFAULT_SETTINGS.theme.enableDarkMode),
  };

  return {
    storeName: raw['store.name'] || raw.storeName || DEFAULT_SETTINGS.storeName,
    currency,
    theme,
  };
}

function formatWithSettings(currency, amount, override = {}) {
  const options = {
    ...currency,
    ...override,
  };
  const locale = options.locale || 'en-KE';
  const currencyCode = (options.code || 'KES').toUpperCase();
  const minDigits = typeof options.minimumFractionDigits === 'number'
    ? Math.max(0, Math.min(4, options.minimumFractionDigits))
    : 0;
  const target = Number.isFinite(amount) ? Number(amount) : 0;
  const desiredSymbol = options.symbol?.trim();

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: minDigits,
    });

    if (!desiredSymbol) {
      return formatter.format(target);
    }

    if (typeof formatter.formatToParts === 'function') {
      const parts = formatter.formatToParts(target).map(part => (
        part.type === 'currency' ? desiredSymbol : part.value
      ));
      return normalizeCurrencySpacing(parts.join(''));
    }

    const fallbackFormatted = formatter.format(target);
    return normalizeCurrencySpacing(replaceCurrencyToken(fallbackFormatted, currencyCode, desiredSymbol));
  } catch {
    return normalizeCurrencySpacing(
      fallbackFormat(target, { code: currencyCode, symbol: desiredSymbol || options.symbol })
    );
  }
}

function fallbackFormat(amount, { symbol = 'KES', code = 'KES' } = {}) {
  const target = Number.isFinite(amount) ? Number(amount).toFixed(2) : '0.00';
  return `${symbol || code} ${target}`.trim();
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceCurrencyToken(formatted, currencyCode, desiredSymbol) {
  if (!desiredSymbol) return formatted;
  const tokenPattern = new RegExp(`(\\p{Sc}|${escapeRegExp(currencyCode)}|[A-Za-z]{2,4})`, 'u');
  if (tokenPattern.test(formatted)) {
    return formatted.replace(tokenPattern, desiredSymbol);
  }
  return `${desiredSymbol} ${formatted}`;
}

function normalizeCurrencySpacing(value) {
  if (!value) return value;
  return value
    .replace(/\u00A0/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeFractionDigits(value) {
  if (value == null) return DEFAULT_SETTINGS.currency.minimumFractionDigits;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.currency.minimumFractionDigits;
  return Math.max(0, Math.min(4, Math.round(parsed)));
}
