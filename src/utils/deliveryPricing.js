import { DEFAULT_DELIVERY_PRICING } from '../data/deliveryContent.js';

const roundTo = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

const asPositiveNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }
  return numeric;
};

const normalizePricing = (pricing = {}) => {
  const source = { ...DEFAULT_DELIVERY_PRICING, ...(pricing || {}) };
  const normalized = {
    baseFee: asPositiveNumber(source.baseFee, DEFAULT_DELIVERY_PRICING.baseFee),
    perKmFee: asPositiveNumber(source.perKmFee, DEFAULT_DELIVERY_PRICING.perKmFee),
    minFee: asPositiveNumber(source.minFee, DEFAULT_DELIVERY_PRICING.minFee),
    freeAbove: asPositiveNumber(source.freeAbove, DEFAULT_DELIVERY_PRICING.freeAbove),
    roundingStep: Math.max(1, asPositiveNumber(source.roundingStep, DEFAULT_DELIVERY_PRICING.roundingStep)),
    defaultRadiusKm: asPositiveNumber(source.defaultRadiusKm, DEFAULT_DELIVERY_PRICING.defaultRadiusKm),
    maxFeeRatio: asPositiveNumber(source.maxFeeRatio, DEFAULT_DELIVERY_PRICING.maxFeeRatio),
    maxFeeAbsolute: asPositiveNumber(source.maxFeeAbsolute, DEFAULT_DELIVERY_PRICING.maxFeeAbsolute),
    lowOrderThreshold: asPositiveNumber(source.lowOrderThreshold, DEFAULT_DELIVERY_PRICING.lowOrderThreshold),
    lowOrderFactor: asPositiveNumber(source.lowOrderFactor, DEFAULT_DELIVERY_PRICING.lowOrderFactor),
    capToCartTotal: Boolean(source.capToCartTotal ?? DEFAULT_DELIVERY_PRICING.capToCartTotal),
  };

  // Clamp the low order factor between 0.1 and 1.0 like backend
  if (normalized.lowOrderFactor <= 0) {
    normalized.lowOrderFactor = DEFAULT_DELIVERY_PRICING.lowOrderFactor;
  }
  normalized.lowOrderFactor = Math.min(1, Math.max(0.1, normalized.lowOrderFactor));

  return normalized;
};

const roundUpToStep = (value, step) => {
  if (value <= 0 || step <= 0) {
    return 0;
  }
  return Math.ceil(value / step) * step;
};

const chooseCartTotal = (pricing, explicitCartTotal) => {
  if (Number.isFinite(explicitCartTotal) && explicitCartTotal >= 0) {
    return explicitCartTotal;
  }
  const { lowOrderThreshold, freeAbove, minFee } = pricing;
  if (lowOrderThreshold > 0) {
    return lowOrderThreshold;
  }
  if (freeAbove > 0) {
    return Math.max(0, freeAbove - Math.max(20, minFee));
  }
  return Math.max(0, minFee * 10);
};

export function calculateDeliveryFee({
  distanceKm = 0,
  pricing,
  cartTotal,
  ignoreFreeAbove = false,
} = {}) {
  const config = normalizePricing(pricing);
  const km = Math.max(0, Number(distanceKm) || 0);
  const subtotal = Math.max(0, Number(cartTotal ?? 0) || 0);

  const baseFee = config.baseFee;
  const perKm = config.perKmFee;
  const freeAbove = config.freeAbove;
  const minFee = config.minFee;
  const roundStep = config.roundingStep;
  const maxRatio = config.maxFeeRatio;
  const maxAbsolute = config.maxFeeAbsolute;
  const lowOrderThreshold = config.lowOrderThreshold;
  const lowOrderFactor = config.lowOrderFactor;
  const capToCartTotal = config.capToCartTotal;

  const distanceComponentRaw = baseFee + (km * perKm);
  let weightedCost = distanceComponentRaw;
  let subsidyApplied = 1;

  if (!ignoreFreeAbove && freeAbove > 0 && subtotal >= freeAbove) {
    return {
      cost: 0,
      distanceKm: roundTo(km),
      breakdown: {
        baseFee,
        perKm,
        distanceComponent: roundTo(distanceComponentRaw),
        cartSubsidyFactor: 0,
        weightedCost: 0,
        finalBeforeRounding: 0,
        freeAbove,
        minFee,
        roundingStep: roundStep,
        effectiveUpperBound: 0,
        effectiveMinFee: 0,
      },
    };
  }

  const costBeforeSubsidy = distanceComponentRaw;

  if (lowOrderThreshold > 0 && subtotal < lowOrderThreshold) {
    const progress = lowOrderThreshold === 0 ? 1 : Math.max(0, Math.min(1, subtotal / lowOrderThreshold));
    subsidyApplied = lowOrderFactor + (progress * (1 - lowOrderFactor));
    weightedCost = distanceComponentRaw * subsidyApplied;
  }

  const maxByRatio = maxRatio > 0 && subtotal > 0 ? subtotal * maxRatio : null;
  const maxByAbsolute = maxAbsolute > 0 ? maxAbsolute : null;

  let effectiveUpperBound = Number.POSITIVE_INFINITY;
  if (maxByRatio !== null) {
    effectiveUpperBound = Math.min(effectiveUpperBound, maxByRatio);
  }
  if (maxByAbsolute !== null) {
    effectiveUpperBound = Math.min(effectiveUpperBound, maxByAbsolute);
  }
  if (capToCartTotal && subtotal > 0) {
    effectiveUpperBound = Math.min(effectiveUpperBound, subtotal);
  }

  const cappedCost = Math.min(weightedCost, effectiveUpperBound);

  let effectiveMinFee = minFee;
  if (maxByRatio !== null) {
    effectiveMinFee = Math.min(effectiveMinFee, maxByRatio);
  }
  if (maxByAbsolute !== null) {
    effectiveMinFee = Math.min(effectiveMinFee, maxByAbsolute);
  }
  if (capToCartTotal && subtotal > 0) {
    effectiveMinFee = Math.min(effectiveMinFee, subtotal);
  }

  const beforeRounding = Math.max(effectiveMinFee, cappedCost);
  let rounded = roundUpToStep(beforeRounding, roundStep);
  if (rounded > cappedCost) {
    rounded = cappedCost;
  }
  if (rounded < effectiveMinFee) {
    rounded = effectiveMinFee;
  }

  const finalCost = roundTo(rounded);

  return {
    cost: finalCost,
    distanceKm: roundTo(km),
    breakdown: {
      baseFee,
      perKm,
      distanceComponent: roundTo(costBeforeSubsidy),
      cartSubsidyFactor: roundTo(subsidyApplied, 3),
      weightedCost: roundTo(weightedCost),
      finalBeforeRounding: roundTo(beforeRounding),
      freeAbove,
      minFee,
      roundingStep: roundStep,
      effectiveUpperBound: Number.isFinite(effectiveUpperBound) ? roundTo(effectiveUpperBound) : null,
      effectiveMinFee: roundTo(effectiveMinFee),
    },
  };
}

const estimateDistanceRange = (zone = {}, pricing) => {
  const config = normalizePricing(pricing);
  const radius = Number(zone.radiusKm);
  const fallbackRadius = config.defaultRadiusKm || DEFAULT_DELIVERY_PRICING.defaultRadiusKm;
  const maxDistance = Number.isFinite(radius) && radius > 0 ? radius : fallbackRadius;
  const minDistance = Math.max(0.5, Math.min(maxDistance, maxDistance * 0.45));

  return {
    minKm: roundTo(minDistance, 2),
    maxKm: roundTo(Math.max(minDistance, maxDistance), 2),
  };
};

export function estimateZoneFeeRange({ zone, pricing, cartTotal, ignoreFreeAbove } = {}) {
  const config = normalizePricing(pricing);
  const distances = estimateDistanceRange(zone, config);
  const subtotal = chooseCartTotal(config, cartTotal);

  const minQuote = calculateDeliveryFee({
    distanceKm: distances.minKm,
    pricing: config,
    cartTotal: subtotal,
    ignoreFreeAbove,
  });

  const maxQuote = calculateDeliveryFee({
    distanceKm: distances.maxKm,
    pricing: config,
    cartTotal: subtotal,
    ignoreFreeAbove,
  });

  const minFee = minQuote.cost;
  const maxFee = maxQuote.cost;
  const isFree = minFee === 0 && maxFee === 0;

  return {
    minFee,
    maxFee,
    isFree,
    distanceRange: distances,
    cartTotalUsed: subtotal,
    breakdown: {
      min: minQuote.breakdown,
      max: maxQuote.breakdown,
    },
  };
}

export function formatFeeRange(range, formatter) {
  if (!range || typeof range.minFee !== 'number' || typeof range.maxFee !== 'number') {
    return null;
  }

  if (range.isFree) {
    return 'Free delivery';
  }

  const format = typeof formatter === 'function' ? formatter : (value) => value;
  if (Math.abs(range.maxFee - range.minFee) < 1) {
    return format(range.minFee);
  }
  return `${format(range.minFee)} – ${format(range.maxFee)}`;
}
