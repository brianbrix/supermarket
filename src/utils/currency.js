import { useCurrencyFormatter as useCurrencyFormatterFromContext } from '../context/SettingsContext.jsx';

let staticCurrency = {
  code: 'KES',
  symbol: 'KES',
  locale: 'en-KE',
  minimumFractionDigits: 0,
};

export function setStaticCurrency(options = {}) {
  staticCurrency = {
    ...staticCurrency,
    ...normalizeOptions(options),
  };
}

export function formatCurrency(amount, overrideOptions = {}) {
  const opts = { ...staticCurrency, ...normalizeOptions(overrideOptions) };
  const locale = opts.locale || 'en-KE';
  const currencyCode = (opts.code || 'KES').toUpperCase();
  const minDigits = typeof opts.minimumFractionDigits === 'number' ? Math.max(0, Math.min(4, opts.minimumFractionDigits)) : 0;
  const target = Number.isFinite(amount) ? Number(amount) : 0;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: minDigits,
    }).format(target);
  } catch {
    return `${opts.symbol || currencyCode} ${target.toFixed(2)}`.trim();
  }
}

export const formatKES = (amount) => formatCurrency(amount);

export function useCurrencyFormatter() {
  return useCurrencyFormatterFromContext();
}

function normalizeOptions(options) {
  const normalized = { ...options };
  if (normalized.code != null) normalized.code = String(normalized.code).toUpperCase();
  if (normalized.symbol != null) normalized.symbol = String(normalized.symbol).trim();
  if (normalized.locale != null) normalized.locale = String(normalized.locale).trim();
  if (normalized.minimumFractionDigits != null) {
    const parsed = Number(normalized.minimumFractionDigits);
    normalized.minimumFractionDigits = Number.isFinite(parsed) ? Math.max(0, Math.min(4, Math.round(parsed))) : 0;
  }
  return normalized;
}
