export const DEFAULT_FILTER_STYLE = 'card';
export const FILTER_STYLE_OPTIONS = [
  {
    id: 'card',
    title: 'Card Panels',
    description: 'Filters sit inside a raised card with subtle dividers. Great when you have many inputs.',
    highlights: ['Includes headings and helper text', 'Matches default product layout styling', 'Responsive two-column grid on desktop'],
  },
  {
    id: 'minimal',
    title: 'Minimal Pills',
    description: 'Compact filters with lightweight underlines and pill chips for actions.',
    highlights: ['Best for fast browsing on mobile', 'Pills surface active filters clearly', 'Pairs nicely with dense product layouts'],
  },
  {
    id: 'floating',
    title: 'Floating Toolbar',
    description: 'Sticky toolbar with floating glassmorphism styling and quick actions.',
    highlights: ['Sticks to top after scrolling', 'Great for seasonal campaigns', 'Leaves more whitespace around product grid'],
  },
  {
    id: 'sidebar',
    title: 'Sidebar Panel',
    description: 'Persistent filters in a dedicated column. Ideal for large catalogs with many refinements.',
    highlights: ['Always visible on desktop', 'Pairs with dense or list layouts', 'Collapses into drawer on mobile'],
  },
];

export const FILTER_STYLE_IDS = new Set(FILTER_STYLE_OPTIONS.map(option => option.id));

export function normalizeFilterStyle(value) {
  if (value == null) return DEFAULT_FILTER_STYLE;
  const normalized = String(value).trim().toLowerCase();
  return FILTER_STYLE_IDS.has(normalized) ? normalized : DEFAULT_FILTER_STYLE;
}

export const DEFAULT_PROMO_VARIANT = 'none';
export const DEFAULT_PROMO_FREQUENCY = 8;
export const MIN_PROMO_FREQUENCY = 2;
export const MAX_PROMO_FREQUENCY = 12;

export const PROMO_LINK_TYPES = [
  { id: 'none', label: 'No link' },
  { id: 'url', label: 'Custom URL' },
  { id: 'category', label: 'Category' },
  { id: 'tag', label: 'Tag' },
];

export const PROMO_LINK_TYPE_IDS = new Set(PROMO_LINK_TYPES.map(option => option.id));

export const DEFAULT_PROMO_CONTENT = {
  eyebrow: 'Featured',
  headline: '',
  body: '',
  ctaLabel: '',
  ctaLinkType: 'none',
  ctaLinkTarget: '',
};

export const PROMO_VARIANTS = [
  {
    id: 'none',
    title: 'No banner',
    headline: '',
    body: 'Keep the catalog focused on products only.',
    accent: 'secondary',
    icon: 'ban',
    ctaLabel: '',
  },
  {
    id: 'free-delivery',
    title: 'Free delivery highlight',
    headline: 'Free delivery this week',
    body: 'Waive delivery fees on orders above KES 3,000 and drive larger basket sizes.',
    accent: 'success',
    icon: 'truck',
    ctaLabel: 'Shop eligible items',
  },
  {
    id: 'cashback',
    title: 'Cashback campaign',
    headline: 'Earn 10% supermarket cashback',
    body: 'Reward loyal shoppers when they checkout with wallet payments.',
    accent: 'warning',
    icon: 'piggy-bank',
    ctaLabel: 'Join rewards',
  },
  {
    id: 'seasonal-highlight',
    title: 'Seasonal spotlight',
    headline: 'Harvest greens & market deals',
    body: 'Promote seasonal produce, festive bundles, or themed collections.',
    accent: 'info',
    icon: 'stars',
    ctaLabel: 'Browse seasonal picks',
  },
];

export const PROMO_VARIANT_IDS = new Set(PROMO_VARIANTS.map(option => option.id));

export function normalizePromoVariant(value) {
  if (value == null) return DEFAULT_PROMO_VARIANT;
  const normalized = String(value).trim().toLowerCase();
  return PROMO_VARIANT_IDS.has(normalized) ? normalized : DEFAULT_PROMO_VARIANT;
}

export function normalizePromoLinkType(value) {
  if (value == null) return DEFAULT_PROMO_CONTENT.ctaLinkType;
  const normalized = String(value).trim().toLowerCase();
  return PROMO_LINK_TYPE_IDS.has(normalized) ? normalized : DEFAULT_PROMO_CONTENT.ctaLinkType;
}

export function normalizePromoContent(value) {
  const base = { ...DEFAULT_PROMO_CONTENT };
  if (!value || typeof value !== 'object') {
    return base;
  }
  if (value.eyebrow != null) {
    base.eyebrow = String(value.eyebrow).trim();
  }
  if (value.headline != null) {
    base.headline = String(value.headline).trim();
  }
  if (value.body != null) {
    base.body = String(value.body).trim();
  }
  if (value.ctaLabel != null) {
    base.ctaLabel = String(value.ctaLabel).trim();
  }
  base.ctaLinkType = normalizePromoLinkType(value.ctaLinkType);
  if (value.ctaLinkTarget != null) {
    base.ctaLinkTarget = String(value.ctaLinkTarget).trim();
  }
  if (base.ctaLinkType === 'none') {
    base.ctaLinkTarget = '';
  }
  return base;
}

export function normalizePromoFrequency(value) {
  if (value == null || value === '') return DEFAULT_PROMO_FREQUENCY;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PROMO_FREQUENCY;
  const clamped = Math.max(MIN_PROMO_FREQUENCY, Math.min(MAX_PROMO_FREQUENCY, Math.round(parsed)));
  return clamped;
}
