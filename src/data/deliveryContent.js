export const DEFAULT_DELIVERY_PRICING = {
  baseFee: 150,
  perKmFee: 35,
  minFee: 120,
  freeAbove: 5000,
  roundingStep: 10,
  defaultRadiusKm: 15,
  maxFeeRatio: 0.6,
  maxFeeAbsolute: 800,
  lowOrderThreshold: 2000,
  lowOrderFactor: 0.65,
  capToCartTotal: true,
};

export const DEFAULT_SUPPORT_CONTACT = {
  email: 'hello@supermarket.co.ke',
  phone: '',
  whatsapp: '254700000000',
};

const DEFAULT_COVERAGE_ZONES = [
  {
    key: 'kilimani-yaya',
    name: 'Kilimani & Yaya',
    eta: '1-2 hours',
    notes: 'Morning and evening slots available daily.',
    locationLabel: '',
    locationContext: '',
    lat: null,
    lng: null,
    radiusKm: null,
    placeId: '',
  },
  {
    key: 'lavington-kileleshwa',
    name: 'Lavington & Kileleshwa',
    eta: '2-3 hours',
    notes: 'Same-day deliveries with insulated transport.',
    locationLabel: '',
    locationContext: '',
    lat: null,
    lng: null,
    radiusKm: null,
    placeId: '',
  },
  {
    key: 'karen',
    name: 'Karen',
    eta: 'Same day',
    notes: 'Order by 2pm for same-day drop-off; chilled items stay cold.',
    locationLabel: '',
    locationContext: '',
    lat: null,
    lng: null,
    radiusKm: null,
    placeId: '',
  },
  {
    key: 'westlands-parklands',
    name: 'Westlands & Parklands',
    eta: '2-4 hours',
    notes: 'Evening window popular—book early to secure a slot.',
    locationLabel: '',
    locationContext: '',
    lat: null,
    lng: null,
    radiusKm: null,
    placeId: '',
  },
];

const DEFAULT_WINDOWS = [
  {
    key: 'early-bird',
    label: 'Early bird',
    timeLabel: '07:00 – 10:00',
    startTime: '07:00',
    endTime: '10:00',
    cutoffTime: '05:00',
    details: 'Perfect for restaurants and families prepping breakfast.',
  },
  {
    key: 'midday-refresh',
    label: 'Midday refresh',
    timeLabel: '11:00 – 14:00',
    startTime: '11:00',
    endTime: '14:00',
    cutoffTime: '09:00',
    details: 'Restock pantry staples before school pick-ups.',
  },
  {
    key: 'evening-drop',
    label: 'Evening drop',
    timeLabel: '17:00 – 21:00',
    startTime: '17:00',
    endTime: '21:00',
    cutoffTime: '15:00',
    details: 'Arrives right before dinner with chilled liners intact.',
  },
  {
    key: 'next-day-express',
    label: 'Next-day express',
    timeLabel: 'Order by midnight',
    startTime: null,
    endTime: null,
    cutoffTime: '23:59',
    details: 'Priority packing and dispatch first thing the next morning.',
  },
];

const DEFAULT_HIGHLIGHTS = [
  {
    icon: 'truck',
    title: 'Same-day coverage',
    description: 'We run multiple city loops every day so fresh groceries reach you the same day you order.',
  },
  {
    icon: 'snow',
    title: 'Cold chain on board',
    description: 'Chilled proteins and dairy ride in insulated liners with temperature monitors for a safe hand-off.',
  },
  {
    icon: 'clock-history',
    title: 'Live slot tracking',
    description: 'Pick a slot that fits your schedule and follow the courier ETA via WhatsApp updates.',
  },
  {
    icon: 'shield-check',
    title: 'Verified riders',
    description: 'Our riders are background-checked, uniformed, and trained in food handling best practices.',
  },
];

const DEFAULT_PROCESS_STEPS = [
  {
    step: '01',
    headline: 'Build your basket',
    copy: 'Shop from seasonal produce, pantry staples, and specialty goods curated by our sourcing team.',
  },
  {
    step: '02',
    headline: 'Pick your window',
    copy: 'Choose a delivery slot that works for you. We confirm availability instantly and hold cold items in reserve.',
  },
  {
    step: '03',
    headline: 'Track to doorstep',
    copy: 'Receive status pings when your rider leaves the hub, arrives at security, and completes hand-off.',
  },
];

const DEFAULT_PACKAGING = [
  {
    title: 'Sustainable liners',
    body: 'Produce travels in reusable crates. Proteins and dairy sit in insulated liners returned on your next order.',
  },
  {
    title: 'Temperature checks',
    body: 'Every cooler is scanned before departure. We reject anything outside the safe temperature range.',
  },
  {
    title: 'Fragile handling',
    body: 'Eggs, glass jars, and bakery treats get separate compartments with "This side up" indicators.',
  },
];

const DEFAULT_FAQS = [
  {
    question: 'What is the standard delivery fee?',
    answer: 'City deliveries start at 150 KES. Orders above 2500 KES ship free on the next available slot.',
  },
  {
    question: 'Can I change my slot after checkout?',
    answer: 'Yes—tap the tracking link or message us up to two hours before your window to reschedule at no extra cost.',
  },
  {
    question: 'Do you support bulk/office deliveries?',
    answer: 'Absolutely. Use a midday or next-day window and mark the order as business so we can coordinate offloading.',
  },
  {
    question: 'What happens if an item is missing?',
    answer: 'Flag it with your rider or via WhatsApp within 24 hours. We refund instantly or fast-track a replacement on the next loop.',
  },
];

export const DEFAULT_DELIVERY_CONTENT = {
  baseFee: 150,
  freeDeliveryThreshold: 2500,
  coverageZones: DEFAULT_COVERAGE_ZONES,
  windows: DEFAULT_WINDOWS,
  highlights: DEFAULT_HIGHLIGHTS,
  processSteps: DEFAULT_PROCESS_STEPS,
  packaging: DEFAULT_PACKAGING,
  faqs: DEFAULT_FAQS,
};

export function normalizeDeliveryPricing(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    baseFee: toNumber(source.baseFee ?? source.base_fee, DEFAULT_DELIVERY_PRICING.baseFee),
    perKmFee: toNumber(source.perKmFee ?? source.per_km_fee, DEFAULT_DELIVERY_PRICING.perKmFee),
    minFee: toNumber(source.minFee ?? source.min_fee, DEFAULT_DELIVERY_PRICING.minFee),
    freeAbove: toNumber(source.freeAbove ?? source.free_above, DEFAULT_DELIVERY_PRICING.freeAbove),
    roundingStep: toNumber(source.roundingStep ?? source.rounding_step, DEFAULT_DELIVERY_PRICING.roundingStep),
    defaultRadiusKm: toNumber(source.defaultRadiusKm ?? source.default_radius_km, DEFAULT_DELIVERY_PRICING.defaultRadiusKm),
    maxFeeRatio: toNumber(source.maxFeeRatio ?? source.max_fee_ratio, DEFAULT_DELIVERY_PRICING.maxFeeRatio),
    maxFeeAbsolute: toNumber(source.maxFeeAbsolute ?? source.max_fee_absolute, DEFAULT_DELIVERY_PRICING.maxFeeAbsolute),
    lowOrderThreshold: toNumber(source.lowOrderThreshold ?? source.low_order_threshold, DEFAULT_DELIVERY_PRICING.lowOrderThreshold),
    lowOrderFactor: toNumber(source.lowOrderFactor ?? source.low_order_factor, DEFAULT_DELIVERY_PRICING.lowOrderFactor),
    capToCartTotal: toBoolean(source.capToCartTotal ?? source.cap_to_cart_total, DEFAULT_DELIVERY_PRICING.capToCartTotal),
  };
}

export function normalizeSupportContact(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    email: safeString(source.email ?? source.supportEmail ?? source['support.email']) || DEFAULT_SUPPORT_CONTACT.email,
    phone: safeString(source.phone ?? source.supportPhone ?? source['support.phone']),
    whatsapp: safeString(source.whatsapp ?? source.supportWhatsapp ?? source['support.whatsapp']) || DEFAULT_SUPPORT_CONTACT.whatsapp,
  };
}

const slugify = (value, fallback) => {
  if (!value) {
    return fallback || '';
  }
  const normalized = String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-');
  const trimmed = normalized.replace(/^-+|-+$/g, '');
  return trimmed || (fallback || 'item');
};

export function normalizeDeliveryContent(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const baseFee = Number.isFinite(Number(source.baseFee)) ? Number(source.baseFee) : DEFAULT_DELIVERY_CONTENT.baseFee;
  const freeDeliveryThreshold = Number.isFinite(Number(source.freeDeliveryThreshold))
    ? Number(source.freeDeliveryThreshold)
    : DEFAULT_DELIVERY_CONTENT.freeDeliveryThreshold;

  const coverageZones = Array.isArray(source.coverageZones) && source.coverageZones.length
    ? source.coverageZones.map((zone, index) => normalizeCoverageZone(zone, index))
    : DEFAULT_DELIVERY_CONTENT.coverageZones.map((zone, index) => normalizeCoverageZone(zone, index));

  const windows = Array.isArray(source.windows) && source.windows.length
    ? source.windows.map((window, index) => normalizeWindow(window, index))
    : DEFAULT_DELIVERY_CONTENT.windows.map((window, index) => normalizeWindow(window, index));

  const highlights = Array.isArray(source.highlights) && source.highlights.length
    ? source.highlights.map((item, index) => normalizeHighlight(item, index))
    : DEFAULT_DELIVERY_CONTENT.highlights.map((item, index) => normalizeHighlight(item, index));

  const processSteps = Array.isArray(source.processSteps) && source.processSteps.length
    ? source.processSteps.map((item, index) => normalizeProcessStep(item, index))
    : DEFAULT_DELIVERY_CONTENT.processSteps.map((item, index) => normalizeProcessStep(item, index));

  const packaging = Array.isArray(source.packaging) && source.packaging.length
    ? source.packaging.map((item, index) => normalizePackaging(item, index))
    : DEFAULT_DELIVERY_CONTENT.packaging.map((item, index) => normalizePackaging(item, index));

  const faqs = Array.isArray(source.faqs) && source.faqs.length
    ? source.faqs.map((item, index) => normalizeFaq(item, index))
    : DEFAULT_DELIVERY_CONTENT.faqs.map((item, index) => normalizeFaq(item, index));

  return {
    baseFee,
    freeDeliveryThreshold,
    coverageZones,
    windows,
    highlights,
    processSteps,
    packaging,
    faqs,
  };
}

function normalizeCoverageZone(zone, index) {
  const normalized = zone && typeof zone === 'object' ? zone : {};
  const name = safeString(normalized.name);
  const key = safeString(normalized.key) || slugify(name, `zone-${index + 1}`);
  const lat = optionalNumber(normalized.lat ?? normalized.latitude);
  const lng = optionalNumber(normalized.lng ?? normalized.longitude ?? normalized.lon);
  const radiusKm = optionalNumber(normalized.radiusKm ?? normalized.radius_km ?? normalized.radius);
  return {
    key,
    name: name || `Zone ${index + 1}`,
    eta: safeString(normalized.eta) || 'Same day',
    notes: safeString(normalized.notes),
    locationLabel: safeString(normalized.locationLabel ?? normalized.label),
    locationContext: safeString(normalized.locationContext ?? normalized.context ?? normalized.description),
    lat,
    lng,
    radiusKm,
    placeId: safeString(normalized.placeId),
  };
}

function normalizeWindow(window, index) {
  const normalized = window && typeof window === 'object' ? window : {};
  const label = safeString(normalized.label) || `Slot ${index + 1}`;
  const key = safeString(normalized.key) || slugify(label, `window-${index + 1}`);
  const timeLabel = safeString(normalized.timeLabel) || safeString(normalized.time) || '';
  return {
    key,
    label,
    timeLabel,
    startTime: nullableString(normalized.startTime),
    endTime: nullableString(normalized.endTime),
    cutoffTime: nullableString(normalized.cutoffTime),
    details: safeString(normalized.details),
  };
}

function normalizeHighlight(item, index) {
  const normalized = item && typeof item === 'object' ? item : {};
  return {
    icon: safeString(normalized.icon) || 'sparkle',
    title: safeString(normalized.title) || `Highlight ${index + 1}`,
    description: safeString(normalized.description),
  };
}

function normalizeProcessStep(item, index) {
  const normalized = item && typeof item === 'object' ? item : {};
  const step = safeString(normalized.step) || String(index + 1).padStart(2, '0');
  return {
    step,
    headline: safeString(normalized.headline) || `Step ${index + 1}`,
    copy: safeString(normalized.copy),
  };
}

function normalizePackaging(item, index) {
  const normalized = item && typeof item === 'object' ? item : {};
  return {
    title: safeString(normalized.title) || `Packaging note ${index + 1}`,
    body: safeString(normalized.body),
  };
}

function normalizeFaq(item, index) {
  const normalized = item && typeof item === 'object' ? item : {};
  return {
    question: safeString(normalized.question) || `FAQ ${index + 1}`,
    answer: safeString(normalized.answer),
  };
}

function safeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function nullableString(value) {
  const str = safeString(value);
  return str === '' ? null : str;
}

const uniqueId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function optionalNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = safeString(value).toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export const createEmptyCoverageZone = () => ({
  key: `zone-${uniqueId()}`,
  name: '',
  eta: '',
  notes: '',
  locationLabel: '',
  locationContext: '',
  lat: '',
  lng: '',
  radiusKm: '',
  placeId: '',
});

export const createEmptyWindow = () => ({
  key: `window-${uniqueId()}`,
  label: '',
  timeLabel: '',
  startTime: '',
  endTime: '',
  cutoffTime: '',
  details: '',
});

export const createEmptyHighlight = () => ({
  icon: 'sparkle',
  title: '',
  description: '',
});

export const createEmptyProcessStep = () => ({
  step: '',
  headline: '',
  copy: '',
});

export const createEmptyPackagingNote = () => ({
  title: '',
  body: '',
});

export const createEmptyFaq = () => ({
  question: '',
  answer: '',
});
