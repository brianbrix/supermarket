import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import {
  DEFAULT_PROMO_CONTENT,
  DEFAULT_PROMO_FREQUENCY,
  DEFAULT_PROMO_VARIANT,
  normalizeFilterStyle as normalizeCatalogFilterStyle,
  normalizePromoContent,
  normalizePromoFrequency as normalizeCatalogPromoFrequency,
  normalizePromoVariant as normalizeCatalogPromoVariant,
} from '../data/catalogPresentation.js';
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_ABOUT_LAYOUT,
  normalizeAboutContent,
  normalizeAboutSettings,
} from '../data/aboutPage.js';
import {
  DEFAULT_DELIVERY_CONTENT,
  DEFAULT_DELIVERY_PRICING,
  DEFAULT_SUPPORT_CONTACT,
  normalizeDeliveryContent,
  normalizeDeliveryPricing,
  normalizeSupportContact,
} from '../data/deliveryContent.js';

const SETTINGS_CACHE_KEY = 'supermarket:last-settings';

const DEFAULT_SETTINGS = {
  storeName: '',
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
  branding: {
    systemLogo: '',
    systemLogoAlt: '',
    brandImage: '',
    brandImageSource: 'upload',
    brandImageText: '',
    brandImageStyle: 'classic',
    brandImageBadge: '',
    brandImageShape: 'rounded',
    brandNameScale: 1,
    showBrandName: true,
  },
  catalog: {
    productLayout: 'grid-classic',
    filterStyle: 'card',
    filterBehavior: {
      requireCategoryForBrands: false,
    },
    promoBanners: {
      top: {
        variant: DEFAULT_PROMO_VARIANT,
        content: { ...DEFAULT_PROMO_CONTENT },
      },
      inline: {
        variant: DEFAULT_PROMO_VARIANT,
        content: { ...DEFAULT_PROMO_CONTENT },
        frequency: DEFAULT_PROMO_FREQUENCY,
      },
    },
  },
  about: {
    layout: DEFAULT_ABOUT_LAYOUT,
    content: normalizeAboutContent(DEFAULT_ABOUT_CONTENT),
  },
  support: {
    email: DEFAULT_SUPPORT_CONTACT.email,
    phone: DEFAULT_SUPPORT_CONTACT.phone,
    whatsapp: DEFAULT_SUPPORT_CONTACT.whatsapp,
  },
  delivery: {
    pricing: { ...DEFAULT_DELIVERY_PRICING },
    content: normalizeDeliveryContent(DEFAULT_DELIVERY_CONTENT),
  },
};

function readCachedSettings() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return normalizeSettings(parsed);
    }
  } catch (err) {
    console.warn('Failed to read cached settings', err);
  }
  return null;
}

function writeCachedSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to cache settings', err);
  }
}

const SettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  loading: true,
  error: null,
  refresh: () => Promise.resolve(),
  formatCurrency: (amount, override) => fallbackFormat(amount, override),
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => readCachedSettings() ?? DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.settings.get();
      const normalized = normalizeSettings(res);
      setSettings(normalized);
      writeCachedSettings(normalized);
    } catch (err) {
      setError(err?.message || 'Unable to load settings');
      setSettings(prev => {
        if (prev && prev !== DEFAULT_SETTINGS) {
          return prev;
        }
        return readCachedSettings() ?? DEFAULT_SETTINGS;
      });
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

  const branding = {
    systemLogo: normalizeString(raw['branding.system_logo'] || raw.branding?.systemLogo || raw.branding?.system_logo || DEFAULT_SETTINGS.branding.systemLogo),
    systemLogoAlt: normalizeString(raw['branding.system_logo_alt'] || raw.branding?.systemLogoAlt || raw.branding?.system_logo_alt || ''),
    brandImage: normalizeString(raw['branding.brand_image'] || raw.branding?.brandImage || raw.branding?.brand_image || DEFAULT_SETTINGS.branding.brandImage),
    brandImageSource: normalizeBrandImageSource(raw['branding.brand_image_source'] || raw.branding?.brandImageSource || raw.branding?.brand_image_source || DEFAULT_SETTINGS.branding.brandImageSource),
    brandImageText: normalizeString(raw['branding.brand_image_text'] || raw.branding?.brandImageText || raw.branding?.brand_image_text || DEFAULT_SETTINGS.branding.brandImageText),
    brandImageStyle: normalizeBrandImageStyle(raw['branding.brand_image_style'] || raw.branding?.brandImageStyle || raw.branding?.brand_image_style || DEFAULT_SETTINGS.branding.brandImageStyle),
    brandImageBadge: normalizeBrandImageBadge(raw['branding.brand_image_badge'] || raw.branding?.brandImageBadge || raw.branding?.brand_image_badge || DEFAULT_SETTINGS.branding.brandImageBadge),
    brandImageShape: normalizeBrandImageShape(raw['branding.brand_image_shape'] || raw.branding?.brandImageShape || raw.branding?.brand_image_shape || DEFAULT_SETTINGS.branding.brandImageShape),
    brandNameScale: normalizeBrandNameScale(raw['branding.brand_name_scale'] || raw.branding?.brandNameScale || raw.branding?.brand_name_scale || DEFAULT_SETTINGS.branding.brandNameScale),
    showBrandName: normalizeBoolean(raw['branding.show_brand_name'] ?? raw.branding?.showBrandName ?? raw.branding?.show_brand_name, DEFAULT_SETTINGS.branding.showBrandName),
  };

  const productLayout = normalizeProductLayout(raw['catalog.product_layout'] || raw.catalog?.productLayout || raw.catalog?.product_layout || DEFAULT_SETTINGS.catalog.productLayout);
  const filterStyle = normalizeCatalogFilterStyle(raw['catalog.filter_style'] || raw.catalog?.filterStyle || raw.catalog?.filter_style || DEFAULT_SETTINGS.catalog.filterStyle);

  const topContentRaw = raw['catalog.promo_top_content']
    ?? raw['catalog.promo_top_content_json']
    ?? raw.catalog?.promoBanners?.topContent
    ?? raw.catalog?.promoBanners?.top?.content
    ?? null;
  const inlineContentRaw = raw['catalog.promo_inline_content']
    ?? raw['catalog.promo_inline_content_json']
    ?? raw.catalog?.promoBanners?.inlineContent
    ?? raw.catalog?.promoBanners?.inline?.content
    ?? null;

  const topVariantRaw = raw['catalog.promo_top_variant']
    ?? (typeof raw.catalog?.promoBanners?.top === 'object' ? raw.catalog?.promoBanners?.top?.variant : raw.catalog?.promoBanners?.top)
    ?? DEFAULT_SETTINGS.catalog.promoBanners.top.variant;
  const inlineVariantRaw = raw['catalog.promo_inline_variant']
    ?? (typeof raw.catalog?.promoBanners?.inline === 'object' ? raw.catalog?.promoBanners?.inline?.variant : raw.catalog?.promoBanners?.inline)
    ?? DEFAULT_SETTINGS.catalog.promoBanners.inline.variant;

  const topContentSource = mergePromoContentSources([
    raw['catalog.promo_top_eyebrow'] ? { eyebrow: raw['catalog.promo_top_eyebrow'] } : null,
    raw['catalog.promo_top_headline'] ? { headline: raw['catalog.promo_top_headline'] } : null,
    raw['catalog.promo_top_body'] ? { body: raw['catalog.promo_top_body'] } : null,
    raw['catalog.promo_top_cta_label'] ? { ctaLabel: raw['catalog.promo_top_cta_label'] } : null,
    raw['catalog.promo_top_cta_link_type'] ? { ctaLinkType: raw['catalog.promo_top_cta_link_type'] } : null,
    raw['catalog.promo_top_cta_link_target'] ? { ctaLinkTarget: raw['catalog.promo_top_cta_link_target'] } : null,
    parsePromoContentValue(topContentRaw),
    raw.catalog?.promoBanners?.topContent,
    raw.catalog?.promoBanners?.top?.content,
    raw.catalog?.promoBanners?.top,
  ]);

  const inlineContentSource = mergePromoContentSources([
    raw['catalog.promo_inline_eyebrow'] ? { eyebrow: raw['catalog.promo_inline_eyebrow'] } : null,
    raw['catalog.promo_inline_headline'] ? { headline: raw['catalog.promo_inline_headline'] } : null,
    raw['catalog.promo_inline_body'] ? { body: raw['catalog.promo_inline_body'] } : null,
    raw['catalog.promo_inline_cta_label'] ? { ctaLabel: raw['catalog.promo_inline_cta_label'] } : null,
    raw['catalog.promo_inline_cta_link_type'] ? { ctaLinkType: raw['catalog.promo_inline_cta_link_type'] } : null,
    raw['catalog.promo_inline_cta_link_target'] ? { ctaLinkTarget: raw['catalog.promo_inline_cta_link_target'] } : null,
    parsePromoContentValue(inlineContentRaw),
    raw.catalog?.promoBanners?.inlineContent,
    raw.catalog?.promoBanners?.inline?.content,
    raw.catalog?.promoBanners?.inline,
  ]);

  const topContent = normalizePromoContent(topContentSource);
  const inlineContent = normalizePromoContent(inlineContentSource);

  const inlineFrequency = normalizeCatalogPromoFrequency(
    raw['catalog.promo_inline_frequency']
    ?? raw.catalog?.promoBanners?.inlineFrequency
    ?? raw.catalog?.promoBanners?.inline?.frequency
    ?? DEFAULT_SETTINGS.catalog.promoBanners.inline.frequency
  );

  const requireCategoryForBrands = normalizeBoolean(
    raw['catalog.brand_requires_category']
    ?? raw.catalog?.filterBehavior?.requireCategoryForBrands
    ?? raw.catalog?.brandRequiresCategory,
    DEFAULT_SETTINGS.catalog.filterBehavior.requireCategoryForBrands
  );

  const catalog = {
    productLayout,
    filterStyle,
    filterBehavior: {
      requireCategoryForBrands,
    },
    promoBanners: {
      top: {
        variant: normalizeCatalogPromoVariant(topVariantRaw ?? DEFAULT_PROMO_VARIANT),
        content: topContent,
      },
      inline: {
        variant: normalizeCatalogPromoVariant(inlineVariantRaw ?? DEFAULT_PROMO_VARIANT),
        content: inlineContent,
        frequency: inlineFrequency,
      },
    },
  };

  const aboutRaw = (
    raw['about.json']
    ?? raw['about_config']
    ?? raw.about
    ?? null
  );

  const aboutFromJson = parseJsonValue(aboutRaw);

  const aboutLayoutRaw = raw['about.layout'] ?? raw.about?.layout ?? aboutFromJson?.layout;
  const aboutContentRaw = raw['about.content'] ?? raw.about?.content ?? aboutFromJson?.content;

  const aboutContentParsed = parseJsonValue(aboutContentRaw) ?? aboutContentRaw;

  const about = normalizeAboutSettings({
    layout: aboutLayoutRaw,
    content: aboutContentParsed,
  });

  const support = normalizeSupportContact({
    email: raw['support.email']
      ?? raw.supportEmail
      ?? raw.support_email
      ?? raw.support?.email,
    phone: raw['support.phone']
      ?? raw.supportPhone
      ?? raw.support_phone
      ?? raw.support?.phone,
    whatsapp: raw['support.whatsapp']
      ?? raw.supportWhatsapp
      ?? raw.support_whatsapp
      ?? raw.support?.whatsapp,
  });

  const deliverySection = raw.delivery && typeof raw.delivery === 'object' ? raw.delivery : {};
  const legacyDelivery = {
    baseFee: raw.deliveryBaseFee ?? raw.delivery_base_fee,
    perKmFee: raw.deliveryPerKmFee ?? raw.delivery_per_km_fee,
    minFee: raw.deliveryMinFee ?? raw.delivery_min_fee,
    freeAbove: raw.deliveryFreeAbove ?? raw.delivery_free_above,
    roundingStep: raw.deliveryRoundingStep ?? raw.delivery_rounding_step,
    defaultRadiusKm: raw.deliveryDefaultRadius ?? raw.delivery_default_radius_km ?? raw.delivery_default_radius,
    maxFeeRatio: raw.deliveryMaxFeeRatio ?? raw.delivery_max_fee_ratio,
    maxFeeAbsolute: raw.deliveryMaxFeeAbsolute ?? raw.delivery_max_fee_absolute,
    lowOrderThreshold: raw.deliveryLowOrderThreshold ?? raw.delivery_low_order_threshold,
    lowOrderFactor: raw.deliveryLowOrderFactor ?? raw.delivery_low_order_factor,
    capToCartTotal: raw.deliveryCapToCart ?? raw.delivery_cap_to_cart_total,
  };

  const deliveryPricing = normalizeDeliveryPricing({
    ...deliverySection,
    ...(deliverySection.pricing || {}),
    ...legacyDelivery,
    baseFee: raw['delivery.base_fee'] ?? deliverySection.baseFee ?? deliverySection.base_fee ?? legacyDelivery.baseFee,
    perKmFee: raw['delivery.per_km_fee'] ?? deliverySection.perKmFee ?? deliverySection.per_km_fee ?? legacyDelivery.perKmFee,
    minFee: raw['delivery.min_fee'] ?? deliverySection.minFee ?? deliverySection.min_fee ?? legacyDelivery.minFee,
    freeAbove: raw['delivery.free_above'] ?? deliverySection.freeAbove ?? deliverySection.free_above ?? legacyDelivery.freeAbove,
    roundingStep: raw['delivery.rounding.step'] ?? deliverySection.roundingStep ?? deliverySection.rounding?.step ?? legacyDelivery.roundingStep,
    defaultRadiusKm: raw['delivery.default_radius_km'] ?? deliverySection.defaultRadiusKm ?? deliverySection.default_radius_km ?? legacyDelivery.defaultRadiusKm,
    maxFeeRatio: raw['delivery.max_fee_ratio'] ?? deliverySection.maxFeeRatio ?? deliverySection.max_fee_ratio ?? legacyDelivery.maxFeeRatio,
    maxFeeAbsolute: raw['delivery.max_fee_absolute'] ?? deliverySection.maxFeeAbsolute ?? deliverySection.max_fee_absolute ?? legacyDelivery.maxFeeAbsolute,
    lowOrderThreshold: raw['delivery.low_order_subsidy_threshold'] ?? deliverySection.lowOrderThreshold ?? deliverySection.low_order_subsidy_threshold ?? deliverySection.lowOrderSubsidyThreshold ?? legacyDelivery.lowOrderThreshold,
    lowOrderFactor: raw['delivery.low_order_subsidy_factor'] ?? deliverySection.lowOrderFactor ?? deliverySection.low_order_subsidy_factor ?? deliverySection.lowOrderSubsidyFactor ?? legacyDelivery.lowOrderFactor,
    capToCartTotal: raw['delivery.cap_to_cart_total'] ?? deliverySection.capToCartTotal ?? deliverySection.cap_to_cart_total ?? legacyDelivery.capToCartTotal,
  });

  const deliveryContentRaw = parseJsonValue(
    raw['delivery.content']
    ?? raw['delivery.content_json']
    ?? deliverySection.content
    ?? raw.deliveryContent
  ) ?? deliverySection.content;

  const delivery = {
    pricing: deliveryPricing,
    content: normalizeDeliveryContent(deliveryContentRaw ?? DEFAULT_DELIVERY_CONTENT),
  };

  return {
    storeName: raw['store.name'] || raw.storeName || DEFAULT_SETTINGS.storeName,
    currency,
    theme,
    branding,
    catalog,
    about,
    support,
    delivery,
  };
}

function normalizeBrandImageSource(value) {
  const normalized = normalizeString(value).toLowerCase();
  return ['text', 'generated', 'upload'].includes(normalized) ? normalized : DEFAULT_SETTINGS.branding.brandImageSource;
}

function normalizeBrandImageStyle(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return DEFAULT_SETTINGS.branding.brandImageStyle;
  const allowed = ['classic', 'sunset-drift', 'lush-garden', 'midnight-neon', 'minimal-bold', 'sunrise-glass'];
  return allowed.includes(normalized) ? normalized : DEFAULT_SETTINGS.branding.brandImageStyle;
}

function normalizeBrandImageBadge(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return '';
  const allowed = ['cart-burst', 'delivery-van', 'storefront-awning', 'price-tag', 'reward-badge', 'basket-fruits'];
  return allowed.includes(normalized) ? normalized : '';
}

function normalizeBrandImageShape(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return DEFAULT_SETTINGS.branding.brandImageShape;
  const allowed = ['square', 'rounded', 'circle', 'pill', 'squircle'];
  return allowed.includes(normalized) ? normalized : DEFAULT_SETTINGS.branding.brandImageShape;
}

function normalizeBrandNameScale(value) {
  if (value == null || value === '') {
    return DEFAULT_SETTINGS.branding.brandNameScale;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SETTINGS.branding.brandNameScale;
  }
  const clamped = Math.min(1.8, Math.max(0.6, parsed));
  return Number.isInteger(clamped) ? clamped : Math.round(clamped * 100) / 100;
}

function parsePromoContentValue(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value;
  }
  return null;
}

function parseJsonValue(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    console.warn('Failed to parse JSON value', err);
    return null;
  }
}

function mergePromoContentSources(sources) {
  const merged = {};
  sources?.forEach(source => {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([key, value]) => {
      if (value == null || value === '') return;
      merged[key] = value;
    });
  });
  return merged;
}

function normalizeProductLayout(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return DEFAULT_SETTINGS.catalog.productLayout;
  const allowed = [
    'grid-classic',
    'grid-comfort',
    'grid-cards',
    'list-media',
    'list-dense',
  ];
  return allowed.includes(normalized) ? normalized : DEFAULT_SETTINGS.catalog.productLayout;
}

function normalizeBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
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
