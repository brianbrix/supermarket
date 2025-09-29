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
  return renderCurrency(amount, opts);
}


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

function renderCurrency(amount, options = {}) {
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
    const fallbackSymbol = desiredSymbol || options.symbol || currencyCode;
    const digits = Math.max(minDigits, 2);
    return normalizeCurrencySpacing(`${fallbackSymbol} ${target.toFixed(digits)}`.trim());
  }
}

function replaceCurrencyToken(formatted, currencyCode, desiredSymbol) {
  if (!desiredSymbol) return formatted;
  const tokenPattern = new RegExp(`(\p{Sc}|${escapeRegExp(currencyCode)}|[A-Za-z]{2,4})`, 'u');
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

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
