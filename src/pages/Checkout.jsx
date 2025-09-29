import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { nameRules, phoneRules, addressRules, optionalPhoneRules, optionalEmailRules } from '../utils/validation.js';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useCurrencyFormatter } from '../context/SettingsContext.jsx';
import QRCode from 'qrcode';
import ProgressSteps from '../components/ProgressSteps.jsx';
import { generateOrderRef, sendEmailMock } from '../services/orderService.js';
import { useMobileMoneyPayment } from '../hooks/useMobileMoneyPayment.js';
import PaymentOptionModal from '../components/PaymentOptionModal.jsx';
import { paymentBranding, api } from '../services/api.js';
import { BRAND_COPY_FOOTER, BRAND_RECEIPT_TITLE } from '../config/brand.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appendGuestOrder, ensureGuestSessionId } from '../utils/guestOrders.js';
import CouponBox from '../components/CouponBox.jsx';
import { useGeocodingSearch } from '../hooks/useGeocodingSearch.js';
import { resolveGeoContext, resolveGeoCoordinates, resolveGeoLabel, resolvePlaceId } from '../utils/geocoding.js';
import MapPickerModal from '../components/MapPickerModal.jsx';

let pdfMakePromise;

async function getPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]).then(([pdfMakeModule, pdfFontsModule]) => {
      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      const fonts = pdfFontsModule.default || pdfFontsModule;
      const resolvedVfs = fonts?.pdfMake?.vfs || fonts?.vfs || pdfMake.vfs;
      pdfMake.vfs = resolvedVfs;
      return pdfMake;
    });
  }
  return pdfMakePromise;
}

function buildCartSignature(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return [...list]
    .map(item => `${item.id}:${item.qty}`)
    .sort()
    .join('|');
}

function coerceNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function prorateTotals(grossBefore, discount, vatRate) {
  const safeGross = Number.isFinite(Number(grossBefore)) ? Number(grossBefore) : 0;
  const safeDiscount = Number.isFinite(Number(discount)) ? Number(discount) : 0;
  const grossClamped = Math.max(0, Math.round(safeGross * 100) / 100);
  const discountClamped = Math.min(Math.max(Math.round(safeDiscount * 100) / 100, 0), grossClamped);
  const ratio = grossClamped > 0 ? discountClamped / grossClamped : 0;
  const vatBefore = Math.round((grossClamped - grossClamped / (1 + vatRate)) * 100) / 100;
  const netBefore = Math.round((grossClamped - vatBefore) * 100) / 100;
  const netAfter = Math.round(Math.max(netBefore - netBefore * ratio, 0) * 100) / 100;
  const vatAfter = Math.round(Math.max(vatBefore - vatBefore * ratio, 0) * 100) / 100;
  const grossAfter = Math.round(Math.max(grossClamped - discountClamped, 0) * 100) / 100;
  return {
    grossBefore: grossClamped,
    grossAfter,
    discount: discountClamped,
    ratio,
    netBefore,
    netAfter,
    vatBefore,
    vatAfter
  };
}

export default function Checkout() {
  const { user: authUser, isAuthenticated, preferences } = useAuth();
  const guestSessionId = ensureGuestSessionId();
  const { items, subtotal, total, discount: cartDiscount, coupon, clearCart, backupCart, restoreCart, clearCartBackup, hasCartBackup } = useCart();
  const VAT_RATE = 0.16; // 16% VAT (prices assumed VAT-inclusive)
  const { push } = useToast();
  const navigate = useNavigate();
  const formatCurrency = useCurrencyFormatter();
  const formatKES = formatCurrency;

  const persisted = (() => {
    let raw = {};
    try { raw = JSON.parse(sessionStorage.getItem('checkout') || '{}'); } catch { raw = {}; }
    const snapshot = raw?.orderSnapshot;
    const snapshotStatus = typeof snapshot?.paymentStatus === 'string' ? snapshot.paymentStatus.toUpperCase() : null;
    const pendingStatuses = new Set(['PENDING','INITIATED','PROCESSING']);
    const hasPendingPayment = snapshotStatus ? pendingStatuses.has(snapshotStatus) : false;
    const hasSnapshotItems = Array.isArray(snapshot?.items) && snapshot.items.length > 0;
    const stepNumber = Number(raw?.step) || 1;
    const submittedFlag = Boolean(raw?.submitted);
    const isStale = submittedFlag
      || (stepNumber >= 2 && !hasPendingPayment)
      || (stepNumber >= 2 && !hasSnapshotItems);
    if (isStale) {
      try { sessionStorage.removeItem('checkout'); } catch {}
      return {};
    }
    return {
      ...raw,
      selectedAddressId: raw?.selectedAddressId ?? null,
    };
  })();
  const persistedDelivery = persisted.deliveryState ?? {};
  // react-hook-form integration for step 1 (customer details)
  const defaultValues = {
    name: persisted.form?.name || '',
    phone: persisted.form?.phone || '',
    delivery: persisted.form?.delivery || 'pickup',
    address: persisted.form?.address || '',
    deliveryContactPhone: persisted.form?.deliveryContactPhone || persistedDelivery.contactPhone || '',
    deliveryContactEmail: persisted.form?.deliveryContactEmail || persistedDelivery.contactEmail || '',
    deliveryInstructions: persisted.form?.deliveryInstructions || persistedDelivery.instructions || ''
  };
  const { register, handleSubmit, watch, trigger, setValue, formState: { errors, touchedFields } } = useForm({
    mode: 'onBlur',
    defaultValues
  });
  const form = watch();
  const addressField = register('address', addressRules(form.delivery === 'delivery'));
  const [submitted, setSubmitted] = useState(persisted.submitted || false);
  const [orderSnapshot, setOrderSnapshot] = useState(() => persisted.orderSnapshot || null);
  const orderRef = useState(() => persisted.orderRef || generateOrderRef())[0];
  const displayOrderRef = orderSnapshot?.orderNumber ?? orderSnapshot?.orderRef ?? orderRef;
  const fileSafeOrderRef = (displayOrderRef || orderRef || 'order').toString().replace(/[^A-Za-z0-9_-]+/g, '-');
  const [step, setStep] = useState(persisted.step || 1); // 1: details, 2: payment, 3: confirm
  // removed manual errors / touched state (handled by react-hook-form)
  const [payMethod, setPayMethod] = useState(persisted.payMethod || 'mobile-money');
  const [paymentRef, setPaymentRef] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const mm = useMobileMoneyPayment();
  const [selectedAddressId, setSelectedAddressId] = useState(persisted.selectedAddressId || null);
  const savedAddresses = Array.isArray(preferences?.addresses) ? preferences.addresses : [];
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPhone, setModalPhone] = useState(defaultValues.phone || '');
  const [modalAccountRef, setModalAccountRef] = useState('');
  const lastShopFetchRef = useRef(null);
  const lastQuoteFetchRef = useRef({ signature: null, reason: null, timestamp: 0 });

  const [deliveryState, setDeliveryState] = useState(() => ({
    mode: persistedDelivery.mode ?? defaultValues.delivery ?? 'pickup',
    locationLabel: persistedDelivery.locationLabel ?? defaultValues.address ?? '',
    searchQuery: persistedDelivery.searchQuery ?? persistedDelivery.locationLabel ?? defaultValues.address ?? '',
    lat: coerceNumber(persistedDelivery.lat),
    lng: coerceNumber(persistedDelivery.lng),
    placeId: persistedDelivery.placeId ?? null,
    selectedResult: persistedDelivery.selectedResult ?? null,
    shopId: persistedDelivery.shopId ?? persistedDelivery.shop?.id ?? null,
    shop: persistedDelivery.shop ?? null,
    quote: persistedDelivery.quote ?? null,
    distanceKm: coerceNumber(persistedDelivery.distanceKm ?? persistedDelivery.quote?.distanceKm ?? persistedDelivery.quote?.distance_km),
    estimatedMinutes: coerceNumber(persistedDelivery.estimatedMinutes ?? persistedDelivery.quote?.estimatedMinutes ?? persistedDelivery.quote?.etaMinutes ?? persistedDelivery.quote?.eta_minutes ?? persistedDelivery.quote?.durationMinutes),
    availabilityReason: persistedDelivery.availabilityReason ?? null,
    availabilityMessage: persistedDelivery.availabilityMessage ?? null,
    context: persistedDelivery.context ?? '',
    contactPhone: persistedDelivery.contactPhone ?? '',
    contactEmail: persistedDelivery.contactEmail ?? '',
    instructions: persistedDelivery.instructions ?? ''
  }));
  const updateDeliveryState = useCallback((patch = {}) => {
    if (typeof patch === 'function') {
      setDeliveryState(prev => ({ ...prev, ...(patch(prev) || {}) }));
      return;
    }
    setDeliveryState(prev => ({ ...prev, ...(patch || {}) }));
  }, []);
  const [deliveryShops, setDeliveryShops] = useState(() => Array.isArray(persistedDelivery.shops) ? persistedDelivery.shops : []);
  const [deliveryShopsLoading, setDeliveryShopsLoading] = useState(false);
  const [deliveryShopsError, setDeliveryShopsError] = useState(null);
  const [deliveryQuoteError, setDeliveryQuoteError] = useState(null);
  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    results: locationResults,
    loading: locationLoading,
    error: locationError
  } = useGeocodingSearch(deliveryState.searchQuery ?? deliveryState.locationLabel ?? defaultValues.address ?? '', { debounceMs: 400, limit: 6 });
  const selectedShopId = deliveryState.shop?.id ?? deliveryState.shopId ?? null;
  const selectedDeliveryShop = useMemo(() => {
    if (!selectedShopId) return deliveryState.shop ?? null;
    const match = deliveryShops.find(shop => String(shop.id) === String(selectedShopId));
    return match ?? deliveryState.shop ?? null;
  }, [deliveryShops, deliveryState.shop, selectedShopId]);
  const hasDeliveryCoordinates = Number.isFinite(coerceNumber(deliveryState.lat)) && Number.isFinite(coerceNumber(deliveryState.lng));
  const mapInitialSelection = useMemo(() => {
    const lat = coerceNumber(deliveryState.lat);
    const lng = coerceNumber(deliveryState.lng);
    return {
      label: deliveryState.locationLabel || form.address || '',
      context: deliveryState.context || '',
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      placeId: deliveryState.placeId ?? null
    };
  }, [deliveryState.context, deliveryState.lat, deliveryState.lng, deliveryState.locationLabel, deliveryState.placeId, form.address]);
  const deliveryFee = useMemo(() => {
    const toNumber = (value) => {
      if (value == null) return null;
      if (typeof value === 'object') {
        if (value.amount != null) return toNumber(value.amount);
        if (value.value != null) return toNumber(value.value);
        if (value.total != null) return toNumber(value.total);
        if (value.price != null) return toNumber(value.price);
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const candidates = [
      deliveryState.quote?.fee,
      deliveryState.quote?.amount,
      deliveryState.quote?.price,
      deliveryState.quote?.total,
      deliveryState.quote?.value,
      deliveryState.quote?.deliveryFee,
      deliveryState.quote?.delivery_fee,
      deliveryState.quote?.data?.fee,
      deliveryState.quote?.data?.amount,
      deliveryState.quote?.data?.price,
      deliveryState.quote?.data?.total,
      deliveryState.quote?.data?.value,
      deliveryState.fee,
      deliveryState.deliveryFee,
      deliveryState.delivery_fee,
      deliveryState.feeAmount,
      deliveryState.fee_amount
    ];

    for (const candidate of candidates) {
      const numeric = toNumber(candidate);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    return null;
  }, [deliveryState]);
  const snapshotDeliveryFee = useMemo(() => {
    const feeCandidates = [
      orderSnapshot?.delivery?.fee,
      orderSnapshot?.delivery?.quote?.fee,
      orderSnapshot?.delivery?.quote?.amount,
      orderSnapshot?.delivery?.quote?.price,
      orderSnapshot?.delivery?.quote?.total,
      orderSnapshot?.delivery?.feeAmount,
      orderSnapshot?.delivery?.fee_amount
    ];
    for (const candidate of feeCandidates) {
      const numeric = coerceNumber(candidate?.amount ?? candidate?.value ?? candidate);
      if (Number.isFinite(numeric)) return numeric;
    }
    return deliveryFee;
  }, [deliveryFee, orderSnapshot?.delivery]);
  const liveCartSummary = useMemo(() => {
    const rawSubtotal = coerceNumber(subtotal);
    const subtotalValue = Number.isFinite(rawSubtotal) ? rawSubtotal : 0;
    const rawDiscount = coerceNumber(cartDiscount);
    const discountValue = Number.isFinite(rawDiscount)
      ? Math.min(Math.max(rawDiscount, 0), Math.max(subtotalValue, 0))
      : 0;
    const rawTotal = coerceNumber(total);
    const totalValue = Number.isFinite(rawTotal) ? rawTotal : Math.max(subtotalValue - discountValue, 0);
    const normalizedSubtotal = Math.round(subtotalValue * 100) / 100;
    const normalizedDiscount = Math.round(discountValue * 100) / 100;
    const normalizedTotal = Math.round(totalValue * 100) / 100;
    const computed = prorateTotals(normalizedSubtotal, normalizedDiscount, VAT_RATE);
    return {
      grossBefore: normalizedSubtotal,
      discount: normalizedDiscount,
      total: normalizedTotal,
      net: Math.round(computed.netAfter * 100) / 100,
      vat: Math.round(computed.vatAfter * 100) / 100,
      breakdown: computed
    };
  }, [VAT_RATE, cartDiscount, subtotal, total]);

  const snapshotSummary = useMemo(() => {
    if (!orderSnapshot) return null;
    const snapshotTotal = coerceNumber(orderSnapshot.total);
    const snapshotDiscount = coerceNumber(orderSnapshot.discount);
    const snapshotGrossBefore = coerceNumber(orderSnapshot.totalBeforeDiscount);
    const snapshotNet = coerceNumber(orderSnapshot.subtotal);
    const snapshotVat = coerceNumber(orderSnapshot.vat);

    const resolvedGrossBefore = Number.isFinite(snapshotGrossBefore)
      ? Math.round(snapshotGrossBefore * 100) / 100
      : (() => {
          if (Number.isFinite(snapshotTotal) && Number.isFinite(snapshotDiscount)) {
            return Math.round((snapshotTotal + snapshotDiscount) * 100) / 100;
          }
          return liveCartSummary.grossBefore;
        })();

    const resolvedTotal = Number.isFinite(snapshotTotal)
      ? Math.round(snapshotTotal * 100) / 100
      : Math.max(Math.round((resolvedGrossBefore - (Number.isFinite(snapshotDiscount) ? snapshotDiscount : liveCartSummary.discount)) * 100) / 100, 0);

    const resolvedDiscount = Number.isFinite(snapshotDiscount)
      ? Math.round(snapshotDiscount * 100) / 100
      : Math.max(Math.round((resolvedGrossBefore - resolvedTotal) * 100) / 100, 0);

    const computed = prorateTotals(resolvedGrossBefore, resolvedDiscount, VAT_RATE);
    const resolvedNet = Number.isFinite(snapshotNet) ? Math.round(snapshotNet * 100) / 100 : Math.round(computed.netAfter * 100) / 100;
    const resolvedVat = Number.isFinite(snapshotVat) ? Math.round(snapshotVat * 100) / 100 : Math.round(computed.vatAfter * 100) / 100;

    return {
      grossBefore: resolvedGrossBefore,
      discount: resolvedDiscount,
      total: resolvedTotal,
      net: resolvedNet,
      vat: resolvedVat,
      breakdown: {
        ...computed,
        netAfter: resolvedNet,
        vatAfter: resolvedVat
      }
    };
  }, [VAT_RATE, liveCartSummary, orderSnapshot]);

  const effectiveTotals = snapshotSummary ?? liveCartSummary;
  const displaySubtotal = Number.isFinite(effectiveTotals.grossBefore) ? effectiveTotals.grossBefore : 0;
  const displayDiscount = Number.isFinite(effectiveTotals.discount) ? effectiveTotals.discount : 0;
  const displayTotal = Number.isFinite(effectiveTotals.total) ? effectiveTotals.total : Math.max(displaySubtotal - displayDiscount, 0);
  const formattedSnapshotTotal = useMemo(() => {
    const baseTotal = snapshotSummary ? snapshotSummary.total : liveCartSummary.total;
    const deliveryPortion = Number.isFinite(snapshotDeliveryFee) ? snapshotDeliveryFee : 0;
    const computed = (Number.isFinite(baseTotal) ? baseTotal : 0) + deliveryPortion;
    return Math.round(Math.max(computed, 0) * 100) / 100;
  }, [liveCartSummary, snapshotSummary, snapshotDeliveryFee]);
  const breakdown = snapshotSummary ? snapshotSummary.breakdown : liveCartSummary.breakdown;
  const liveCartTotal = liveCartSummary.total;
  const liveCartNetTotal = liveCartSummary.net;
  const liveCartVatTotal = liveCartSummary.vat;
  const liveDiscount = liveCartSummary.discount;
  const grossBeforeDiscount = liveCartSummary.grossBefore;
  const totalWithDelivery = useMemo(() => {
    const fee = Number.isFinite(snapshotDeliveryFee) ? snapshotDeliveryFee : 0;
    return displayTotal + fee;
  }, [displayTotal, snapshotDeliveryFee]);
  const shouldShowDeliveryFee = useMemo(() => {
    if (form.delivery === 'delivery') return true;
    const deliveryMode = orderSnapshot?.delivery?.mode ?? orderSnapshot?.delivery?.type ?? null;
    if (!deliveryMode) return false;
    return String(deliveryMode).toUpperCase() === 'DELIVERY';
  }, [form.delivery, orderSnapshot?.delivery]);
  const resolvedDeliveryLocation = useMemo(() => {
    const label = orderSnapshot?.delivery?.locationLabel
      ?? orderSnapshot?.delivery?.address
      ?? deliveryState.locationLabel
      ?? form.address
      ?? '';
    const context = orderSnapshot?.delivery?.context
      ?? deliveryState.context
      ?? '';
    if (!context) return label;
    if (!label) return context;
    return label.includes(context) ? label : `${label}, ${context}`;
  }, [deliveryState.context, deliveryState.locationLabel, form.address, orderSnapshot?.delivery]);
  const shouldRedirectToCart = !submitted && !orderSnapshot && items.length === 0;

  useEffect(() => {
    if (form.delivery !== 'delivery') {
      lastShopFetchRef.current = null;
      if (deliveryShops.length) setDeliveryShops([]);
      setDeliveryShopsLoading(false);
      setDeliveryShopsError(null);
      updateDeliveryState(prev => {
        if (!prev.shop && !prev.shopId && prev.distanceKm == null && prev.quote == null && prev.fee == null && prev.estimatedMinutes == null) {
          return prev;
        }
        return {
          ...prev,
          shop: null,
          shopId: null,
          distanceKm: null,
          quote: null,
          fee: null,
          estimatedMinutes: null,
          availabilityReason: null,
          availabilityMessage: null
        };
      });
      return;
    }
    const lat = coerceNumber(deliveryState.lat);
    const lng = coerceNumber(deliveryState.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      lastShopFetchRef.current = null;
      if (deliveryShops.length) setDeliveryShops([]);
      setDeliveryShopsLoading(false);
      setDeliveryShopsError(null);
      updateDeliveryState(prev => {
        if (!prev.shop && !prev.shopId && prev.distanceKm == null && prev.quote == null && prev.fee == null && prev.estimatedMinutes == null) {
          return prev;
        }
        return {
          ...prev,
          shop: null,
          shopId: null,
          distanceKm: null,
          quote: null,
          fee: null,
          estimatedMinutes: null,
          availabilityReason: null,
          availabilityMessage: null
        };
      });
      return;
    }
    const signature = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
    if (lastShopFetchRef.current === signature && deliveryShops.length > 0) {
      return;
    }
    lastShopFetchRef.current = signature;

    let cancelled = false;
    setDeliveryShopsLoading(true);
    setDeliveryShopsError(null);

    (async () => {
      try {
        const response = await api.delivery.shops({ lat, lng });
        if (cancelled) return;
        const payload = Array.isArray(response?.content)
          ? response.content
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];
        const normalized = payload.map((shop) => {
          const distance = coerceNumber(shop.distanceKm ?? shop.distance_km ?? shop.distance ?? shop.metrics?.distanceKm);
          return Number.isFinite(distance) ? { ...shop, distanceKm: distance } : shop;
        });
        setDeliveryShops(normalized);
        updateDeliveryState(prev => {
          const prevSelectionId = prev.shopId ?? prev.shop?.id ?? null;
          let nextShop = prevSelectionId ? normalized.find(shop => String(shop.id) === String(prevSelectionId)) : null;
          if (!nextShop && normalized.length > 0) {
            nextShop = normalized[0];
          }
          const nextDistance = coerceNumber(nextShop?.distanceKm ?? nextShop?.distance_km ?? nextShop?.metrics?.distanceKm);
          return {
            ...prev,
            shop: nextShop ?? null,
            shopId: nextShop?.id ?? null,
            distanceKm: Number.isFinite(nextDistance) ? nextDistance : (prevSelectionId ? prev.distanceKm : null),
            quote: null,
            fee: null,
            estimatedMinutes: null,
            availabilityReason: null,
            availabilityMessage: null
          };
        });
      } catch (error) {
        if (cancelled) return;
        console.warn('Could not load delivery shops', error);
        setDeliveryShopsError(error instanceof Error ? error : new Error('Unable to load delivery shops.'));
        setDeliveryShops([]);
        updateDeliveryState(prev => {
          if (!prev.shop && !prev.shopId && prev.distanceKm == null && prev.quote == null && prev.fee == null && prev.estimatedMinutes == null) {
            return prev;
          }
          return {
            ...prev,
            shop: null,
            shopId: null,
            distanceKm: null,
            quote: null,
            fee: null,
            estimatedMinutes: null,
            availabilityReason: null,
            availabilityMessage: null
          };
        });
      } finally {
        if (!cancelled) setDeliveryShopsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (lastQuoteFetchRef.current?.signature === signature && lastQuoteFetchRef.current?.reason === 'pending') {
        lastQuoteFetchRef.current = { signature: null, reason: null, timestamp: 0 };
      }
    };
  }, [form.delivery, deliveryState.lat, deliveryState.lng, deliveryShops.length, updateDeliveryState]);

  const PAYMENT_LABELS = {
    'mobile-money': 'Mobile Money',
    cash: 'Cash on Delivery',
    card: 'Card'
  };

  const formatPaymentMethod = (value, fallback = null) => {
    let resolved = value;
    if (!resolved && fallback) resolved = fallback;
    if (!resolved) return 'Payment';
    const normalized = resolved.toString();
    const upper = normalized.toUpperCase();
    switch (upper) {
      case 'MPESA':
        return 'M-Pesa';
      case 'AIRTEL':
      case 'AIRTEL_MONEY':
        return 'Airtel Money';
      case 'MOBILE_MONEY':
        return 'Mobile Money';
      case 'CASH_ON_DELIVERY':
      case 'COD':
        return 'Cash on Delivery';
      case 'CARD':
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        return 'Card';
      default:
        if (PAYMENT_LABELS[normalized]) return PAYMENT_LABELS[normalized];
        return normalized
          .replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const resolvedPaymentProvider = orderSnapshot?.paymentProgress?.provider
    ?? mm.payment?.provider
    ?? selectedOption?.provider
    ?? null;

  const resolvedPaymentChannel = orderSnapshot?.paymentProgress?.channel
    ?? mm.payment?.channel
    ?? selectedOption?.channel
    ?? (resolvedPaymentProvider === 'MPESA'
      ? 'MPESA_STK_PUSH'
      : resolvedPaymentProvider === 'AIRTEL'
        ? 'AIRTEL_STK_PUSH'
        : null);

  const resolvedPaymentMethodCode = (() => {
    if (orderSnapshot?.paymentMethod) return orderSnapshot.paymentMethod;
    if (orderSnapshot?.paymentProgress?.method) return orderSnapshot.paymentProgress.method;
    if (mm.payment?.method) return mm.payment.method;
    switch (payMethod) {
      case 'cash':
        return 'CASH_ON_DELIVERY';
      case 'card':
        return 'CARD';
      case 'mobile-money':
        return resolvedPaymentProvider ?? 'MOBILE_MONEY';
      default:
        return payMethod || null;
    }
  })();

  const resolvedPaymentLabel = formatPaymentMethod(
    resolvedPaymentProvider ?? resolvedPaymentMethodCode ?? payMethod,
    resolvedPaymentMethodCode
  );

  const modalPaymentState = useMemo(() => {
    const hookStatus = mm.status;
    if (hookStatus === 'failed') {
      return mm.payment?.failureReason === 'TIMEOUT_EXPIRED' ? 'timeout' : 'failed';
    }
    if (hookStatus && ['initiating', 'pending', 'reconciling', 'succeeded', 'error'].includes(hookStatus)) {
      return hookStatus;
    }
    if (hookStatus === 'idle') {
      const snapshotStatus = orderSnapshot?.paymentProgress?.status ?? orderSnapshot?.paymentStatus ?? null;
      if (snapshotStatus) {
        const normalized = snapshotStatus.toString().toUpperCase();
        if (['INITIATED', 'PENDING', 'PROCESSING'].includes(normalized)) return 'pending';
        if (normalized === 'SUCCESS') return 'succeeded';
        if (normalized === 'FAILED') return 'failed';
      }
    }
    return 'idle';
  }, [mm.status, mm.payment?.failureReason, orderSnapshot?.paymentProgress?.status, orderSnapshot?.paymentStatus]);

  const effectivePaymentStatus = useMemo(() => {
    const statuses = [
      orderSnapshot?.paymentProgress?.status,
      orderSnapshot?.paymentStatus,
      mm.payment?.status
    ];
    for (const status of statuses) {
      if (!status) continue;
      const normalized = status.toString().toUpperCase();
      if (normalized) return normalized;
    }
    if (mm.status === 'succeeded') return 'SUCCESS';
    if (mm.status === 'failed') return 'FAILED';
    if (['initiating', 'pending', 'reconciling'].includes(mm.status)) return 'INITIATED';
    return null;
  }, [mm.status, mm.payment?.status, orderSnapshot?.paymentProgress?.status, orderSnapshot?.paymentStatus]);

  useEffect(() => {
    if (form.delivery !== 'delivery') {
      lastQuoteFetchRef.current = { signature: null, reason: null, timestamp: 0 };
      setDeliveryQuoteLoading(false);
      setDeliveryQuoteError(null);
      updateDeliveryState(prev => {
        if (prev.quote == null && prev.fee == null) {
          return prev;
        }
        return {
          ...prev,
          quote: null,
          fee: null,
          availabilityReason: null,
          availabilityMessage: null
        };
      });
      return;
    }
    const lat = coerceNumber(deliveryState.lat);
    const lng = coerceNumber(deliveryState.lng);
    const shopIdResolved = selectedDeliveryShop?.id
      ?? selectedDeliveryShop?.shopId
      ?? selectedDeliveryShop?.shop_id
      ?? selectedShopId
      ?? null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !shopIdResolved) {
      lastQuoteFetchRef.current = { signature: null, reason: null, timestamp: 0 };
      setDeliveryQuoteLoading(false);
      setDeliveryQuoteError(null);
      updateDeliveryState(prev => {
        if (prev.quote == null && prev.fee == null) {
          return prev;
        }
        return {
          ...prev,
          quote: null,
          fee: null,
          availabilityReason: null,
          availabilityMessage: null
        };
      });
      return;
    }
    const cartTotal = Number.isFinite(liveCartTotal) ? Math.max(liveCartTotal, 0) : 0;
    const signature = `${lat.toFixed(5)}:${lng.toFixed(5)}:${shopIdResolved}:${Math.round(cartTotal * 100)}`;
    const lastQuoteMeta = lastQuoteFetchRef.current;
    if (lastQuoteMeta?.signature === signature) {
      if (lastQuoteMeta.reason === 'pending') {
        return;
      }
      if (lastQuoteMeta.reason === 'success' && deliveryState.quote) {
        return;
      }
      const elapsed = Date.now() - (lastQuoteMeta.timestamp ?? 0);
      const cooldown = lastQuoteMeta.reason === 'unavailable'
        ? 60_000
        : (lastQuoteMeta.reason === 'error' ? 15_000 : 0);
      if (cooldown > 0 && elapsed < cooldown) {
        return;
      }
    }
    lastQuoteFetchRef.current = { signature, reason: 'pending', timestamp: Date.now() };

    let cancelled = false;
    setDeliveryQuoteLoading(true);
    setDeliveryQuoteError(null);

    (async () => {
      try {
        const quoteResponse = await api.delivery.quote({ lat, lng, cartTotal, shopId: shopIdResolved });
        if (cancelled) return;
        const distanceVal = coerceNumber(
          quoteResponse?.distanceKm
            ?? quoteResponse?.shop?.distanceKm
            ?? quoteResponse?.shop?.distance_km
            ?? selectedDeliveryShop?.distanceKm
            ?? selectedDeliveryShop?.distance_km
        );
        const etaVal = coerceNumber(
          quoteResponse?.breakdown?.etaMinutes
            ?? quoteResponse?.estimatedMinutes
            ?? quoteResponse?.etaMinutes
            ?? quoteResponse?.shop?.deliveryWindowMinutes
            ?? quoteResponse?.shop?.etaMinutes
        );
        const feeVal = coerceNumber(quoteResponse?.cost ?? quoteResponse?.fee ?? quoteResponse?.price ?? quoteResponse?.amount);
        const isAvailable = quoteResponse?.available !== false;
        const unavailableMessage = (() => {
          const rawMessage = typeof quoteResponse?.message === 'string' ? quoteResponse.message.trim() : '';
          if (rawMessage) return rawMessage;
          if (quoteResponse?.reason === 'outside_radius') return 'Delivery address is outside the service radius for the selected shop.';
          if (quoteResponse?.reason === 'no_shop') return 'No delivery shop is available for your location yet.';
          return 'Delivery is not available for the selected location.';
        })();
        if (!isAvailable) {
          setDeliveryQuoteError(new Error(unavailableMessage));
          updateDeliveryState(prev => ({
            ...prev,
            quote: quoteResponse,
            distanceKm: Number.isFinite(distanceVal) ? distanceVal : prev.distanceKm,
            estimatedMinutes: Number.isFinite(etaVal) ? etaVal : prev.estimatedMinutes,
            fee: null,
            availabilityReason: quoteResponse?.reason ?? 'unavailable',
            availabilityMessage: unavailableMessage
          }));
          lastQuoteFetchRef.current = { signature, reason: 'unavailable', timestamp: Date.now() };
          return;
        }
        setDeliveryQuoteError(null);
        updateDeliveryState(prev => ({
          ...prev,
          quote: quoteResponse,
          distanceKm: Number.isFinite(distanceVal) ? distanceVal : prev.distanceKm,
          estimatedMinutes: Number.isFinite(etaVal) ? etaVal : prev.estimatedMinutes,
          fee: Number.isFinite(feeVal) ? feeVal : prev.fee ?? feeVal ?? prev.fee,
          availabilityReason: null,
          availabilityMessage: null
        }));
        lastQuoteFetchRef.current = { signature, reason: 'success', timestamp: Date.now() };
      } catch (error) {
        if (cancelled) return;
        console.warn('Could not calculate delivery quote', error);
        const fallbackError = error instanceof Error ? error : new Error('Could not calculate delivery cost.');
        setDeliveryQuoteError(fallbackError);
        updateDeliveryState(prev => ({
          ...prev,
          quote: null,
          fee: null,
          availabilityReason: 'error',
          availabilityMessage: fallbackError.message
        }));
        lastQuoteFetchRef.current = { signature, reason: 'error', timestamp: Date.now() };
      } finally {
        if (!cancelled) setDeliveryQuoteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.delivery, deliveryState.lat, deliveryState.lng, selectedShopId, selectedDeliveryShop, liveCartTotal, deliveryState.quote, updateDeliveryState]);

  const handleLocationSelect = useCallback((result, overrides = {}) => {
    if (!result && !overrides) return;
    const effectiveLabel = typeof overrides.label === 'string' && overrides.label.trim().length > 0
      ? overrides.label
      : resolveGeoLabel(result);
    const resolvedContext = (() => {
      if (typeof overrides.context === 'string') return overrides.context;
      if (Array.isArray(overrides.contextParts)) return overrides.contextParts.filter(Boolean).join(', ');
      return resolveGeoContext(result);
    })();
    const combined = resolvedContext && effectiveLabel
      ? `${effectiveLabel}${effectiveLabel.includes(resolvedContext) ? '' : `, ${resolvedContext}`}`
      : effectiveLabel || resolvedContext;
    const coordsOverride = overrides.coordinates || overrides.coords;
    const coordinates = coordsOverride && Number.isFinite(coordsOverride.lat) && Number.isFinite(coordsOverride.lng)
      ? { lat: coordsOverride.lat, lng: coordsOverride.lng }
      : resolveGeoCoordinates(result);
    const label = (combined || form.address || '').trim();
    setLocationQuery(label);
    setValue('address', label, { shouldDirty: true, shouldTouch: true });
    trigger('address');
    updateDeliveryState(prev => ({
      locationLabel: label,
      searchQuery: label,
      lat: coordinates.lat,
      lng: coordinates.lng,
      placeId: overrides.placeId ?? resolvePlaceId(result) ?? prev.placeId ?? null,
      context: resolvedContext || '',
      selectedResult: overrides.raw ?? result,
      shopId: null,
      shop: null,
      quote: null,
      distanceKm: null,
      estimatedMinutes: null,
      fee: null,
      availabilityReason: null,
      availabilityMessage: null
    }));
    if (selectedAddressId) {
      setSelectedAddressId(null);
    }
  }, [form.address, selectedAddressId, setLocationQuery, setSelectedAddressId, setValue, trigger, updateDeliveryState]);

  const handleMapConfirm = useCallback((selection) => {
    if (!selection) return;
    const lat = coerceNumber(selection.lat ?? selection.latitude ?? selection?.coords?.lat);
    const lng = coerceNumber(selection.lng ?? selection.longitude ?? selection?.coords?.lng);
    const overrides = {
      label: selection.label,
      context: selection.context,
      coordinates: { lat, lng },
      placeId: selection.placeId ?? selection?.raw?.place_id ?? null,
      raw: selection.raw ?? {
        label: selection.label,
        context: selection.context,
        lat,
        lng,
        place_id: selection.placeId ?? null
      }
    };
    const syntheticResult = {
      label: selection.label,
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      place_id: overrides.placeId,
      id: overrides.placeId,
      context: selection.context,
      position: { lat, lng }
    };
    handleLocationSelect(syntheticResult, overrides);
  }, [handleLocationSelect]);

  const buildDeliveryPayload = useCallback(() => {
    if (form.delivery !== 'delivery') {
      return {
        mode: 'PICKUP',
        type: 'PICKUP',
        method: 'PICKUP'
      };
    }
    const lat = coerceNumber(deliveryState.lat);
    const lng = coerceNumber(deliveryState.lng);
    const shopIdResolved = selectedDeliveryShop?.id ?? selectedShopId ?? null;
    return {
      mode: 'DELIVERY',
      type: 'DELIVERY',
      method: 'DELIVERY',
      address: form.address || deliveryState.locationLabel || '',
      locationLabel: deliveryState.locationLabel || form.address || '',
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
      context: deliveryState.context || '',
      placeId: deliveryState.placeId ?? deliveryState.selectedResult?.id ?? null,
      shopId: shopIdResolved,
      shopName: selectedDeliveryShop?.name ?? selectedDeliveryShop?.label ?? null,
      shop: selectedDeliveryShop ?? null,
      quote: deliveryState.quote ?? null,
      estimatedDistanceKm: deliveryState.distanceKm ?? null,
      estimatedMinutes: deliveryState.estimatedMinutes ?? null,
      fee: Number.isFinite(deliveryFee) ? deliveryFee : null,
      contactPhone: (form.deliveryContactPhone || '').trim() || null,
      contactEmail: (form.deliveryContactEmail || '').trim() || null,
      instructions: (form.deliveryInstructions || '').trim() || null
    };
  }, [deliveryFee, deliveryState.context, deliveryState.distanceKm, deliveryState.estimatedMinutes, deliveryState.lat, deliveryState.lng, deliveryState.locationLabel, deliveryState.placeId, deliveryState.quote, deliveryState.selectedResult, form.address, form.delivery, form.deliveryContactEmail, form.deliveryContactPhone, form.deliveryInstructions, selectedDeliveryShop, selectedShopId]);

  const handleShopSelect = useCallback((shop) => {
    if (!shop) {
      updateDeliveryState({ shopId: null, shop: null, quote: null, distanceKm: null, estimatedMinutes: null, fee: null, availabilityReason: null, availabilityMessage: null });
      return;
    }
    const nextDistance = coerceNumber(shop.distanceKm ?? shop.distance_km ?? shop.distance ?? shop.metrics?.distanceKm);
    const nextEta = coerceNumber(shop.estimatedMinutes ?? shop.etaMinutes ?? shop.eta_minutes ?? shop.deliveryWindowMinutes ?? shop.metrics?.etaMinutes);
    updateDeliveryState({
      shopId: shop.id ?? null,
      shop,
      quote: null,
      distanceKm: Number.isFinite(nextDistance) ? nextDistance : null,
      estimatedMinutes: Number.isFinite(nextEta) ? nextEta : null,
      fee: null,
      availabilityReason: null,
      availabilityMessage: null
    });
  }, [updateDeliveryState]);

  const handlePayMethodChange = (value) => {
    setPayMethod(value);
    persist({ payMethod: value });
    if (value !== 'mobile-money') {
      setSelectedOption(null);
      setModalOpen(false);
    }
  };

  const parseMoney = (value) => {
    if (value == null) return null;
    if (typeof value === 'object') {
      if (value.amount != null) return parseMoney(value.amount);
      if (value.value != null) return parseMoney(value.value);
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const roundCurrency = (value) => {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  };

  function summarizeInstructions(md) {
    if (!md) return '';
    try {
      const first = (md.split('\n').find(l => l.trim().length>0) || '').trim();
      if (!first) return '';
      // strip very basic markdown: **bold**, *italics*, `code`
      return first
        .replace(/\*\*(.+?)\*\*/g,'$1')
        .replace(/\*(.+?)\*/g,'$1')
        .replace(/`(.+?)`/g,'$1');
    } catch { return ''; }
  }

  function persist(partial) {
    const nextSnapshot = partial?.orderSnapshot ?? orderSnapshot;
    const resolvedOrderRef = partial?.orderRef
      ?? nextSnapshot?.orderNumber
      ?? nextSnapshot?.orderRef
      ?? orderRef;
    const nextDeliveryState = partial?.deliveryState ?? deliveryState;
    const { shops: _ignoredShops, ...deliveryForStorage } = nextDeliveryState ?? {};
    const sanitizedDelivery = nextDeliveryState
      ? {
          ...deliveryForStorage,
          shopId: deliveryForStorage?.shopId ?? deliveryForStorage?.shop?.id ?? null,
          shop: selectedDeliveryShop ?? deliveryForStorage?.shop ?? null,
          quote: deliveryForStorage?.quote ?? null
        }
      : null;
    const data = {
      form,
      step,
      submitted,
      payMethod,
      orderRef: resolvedOrderRef,
      orderSnapshot: nextSnapshot,
      selectedAddressId,
      deliveryState: sanitizedDelivery,
      ...partial
    };
    try { sessionStorage.setItem('checkout', JSON.stringify(data)); } catch {}
  }

  // persist whenever core state changes
  useEffect(() => { persist({}); }, [form, step, submitted, payMethod, selectedAddressId, deliveryState]);

  useEffect(() => {
    if (!selectedAddressId) return;
    const match = savedAddresses.find(address => address.id === selectedAddressId);
    if (!match) {
      setSelectedAddressId(null);
      return;
    }
    if (form.delivery === 'delivery') {
      if (form.address !== match.details) {
        setValue('address', match.details, { shouldDirty: false, shouldTouch: false });
      }
      const latCandidate = coerceNumber(match.lat ?? match.latitude ?? match.coordinates?.lat ?? match.location?.lat);
      const lngCandidate = coerceNumber(match.lng ?? match.longitude ?? match.coordinates?.lng ?? match.location?.lng);
      setValue('deliveryContactPhone', match.contactPhone ?? '', { shouldDirty: false, shouldTouch: false });
      setValue('deliveryContactEmail', match.contactEmail ?? '', { shouldDirty: false, shouldTouch: false });
      setValue('deliveryInstructions', match.instructions ?? '', { shouldDirty: false, shouldTouch: false });
      updateDeliveryState({
        locationLabel: match.details || '',
        searchQuery: match.details || '',
        lat: latCandidate,
        lng: lngCandidate,
        placeId: match.placeId ?? match.id ?? null,
        shopId: match.deliveryShopId ?? match.shopId ?? deliveryState.shopId ?? null,
        quote: null,
        distanceKm: null,
        estimatedMinutes: null,
        fee: null,
        availabilityReason: null,
        availabilityMessage: null,
        context: match.context ?? '',
        contactPhone: match.contactPhone ?? '',
        contactEmail: match.contactEmail ?? '',
        instructions: match.instructions ?? ''
      });
      if (match.details) {
        setLocationQuery(match.details);
      }
    }
  }, [selectedAddressId, savedAddresses, form.delivery, form.address, setValue, updateDeliveryState, deliveryState.shopId, setLocationQuery]);

  useEffect(() => {
    if (!selectedAddressId) return;
    const match = savedAddresses.find(address => address.id === selectedAddressId);
    if (!match) return;
    if (form.address === match.details) return;
    const normalizedInput = (form.address || '').trim();
    const normalizedSaved = (match.details || '').trim();
    if (normalizedInput === normalizedSaved) return;
    setSelectedAddressId(null);
  }, [form.address, selectedAddressId, savedAddresses]);

  useEffect(() => {
    if (form.delivery !== 'delivery') return;
    updateDeliveryState(prev => {
      const nextPhone = form.deliveryContactPhone ?? '';
      const nextEmail = form.deliveryContactEmail ?? '';
      const nextInstructions = form.deliveryInstructions ?? '';
      const patch = {};
      if ((prev.contactPhone ?? '') !== nextPhone) patch.contactPhone = nextPhone;
      if ((prev.contactEmail ?? '') !== nextEmail) patch.contactEmail = nextEmail;
      if ((prev.instructions ?? '') !== nextInstructions) patch.instructions = nextInstructions;
      return Object.keys(patch).length > 0 ? patch : {};
    });
  }, [form.delivery, form.deliveryContactEmail, form.deliveryContactPhone, form.deliveryInstructions, updateDeliveryState]);

  useEffect(() => {
    if (form.delivery !== 'delivery') return;
    if (selectedAddressId) return;
    const match = savedAddresses.find(address => (address.details || '').trim() === (form.address || '').trim());
    if (match) {
      setSelectedAddressId(match.id);
    }
  }, [form.delivery, form.address, savedAddresses, selectedAddressId]);

  // address requirement depends on delivery method; trigger validation when delivery changes
  useEffect(() => {
    if (form.delivery !== 'delivery') {
      setValue('address', '', { shouldDirty: false, shouldTouch: false });
      setValue('deliveryContactPhone', '', { shouldDirty: false, shouldTouch: false });
      setValue('deliveryContactEmail', '', { shouldDirty: false, shouldTouch: false });
      setValue('deliveryInstructions', '', { shouldDirty: false, shouldTouch: false });
      if (selectedAddressId) {
        setSelectedAddressId(null);
      }
      updateDeliveryState({
        locationLabel: '',
        searchQuery: '',
        lat: null,
        lng: null,
        placeId: null,
        selectedResult: null,
        shopId: null,
        shop: null,
        quote: null,
        distanceKm: null,
        estimatedMinutes: null,
        fee: null,
        availabilityReason: null,
        availabilityMessage: null,
        context: '',
        contactPhone: '',
        contactEmail: '',
        instructions: ''
      });
    }
    trigger('address');
  }, [form.delivery, setValue, trigger, selectedAddressId, updateDeliveryState]);

  // react-hook-form handles validation; trigger() used before advancing

  // focus management - focus heading when step changes
  const headingRef = useState(null)[0];
  useEffect(() => {
    const h = document.getElementById('checkout-heading');
    if (h) h.focus();
  }, [step]);

  useEffect(() => {
    if (form.delivery === 'delivery') {
      if (deliveryState.mode !== 'delivery') {
        updateDeliveryState({ mode: 'delivery' });
      }
    } else if (deliveryState.mode !== 'pickup') {
      updateDeliveryState({ mode: 'pickup' });
    }
  }, [form.delivery, deliveryState.mode, updateDeliveryState]);

  const onSubmitDetails = () => {
    if (form.delivery === 'delivery') {
      if (!hasDeliveryCoordinates) {
        push('Please choose your delivery location from the suggestions so we can calculate delivery.', 'warning');
        return;
      }
      if (!selectedShopId && !selectedDeliveryShop) {
        push('Select the shop that should prepare your delivery.', 'warning');
        return;
      }
    }
    setStep(2);
    push('Details accepted');
  };

  async function initiateMobileMoneyReal() {
    if (['initiating','pending','reconciling'].includes(mm.status)) {
      push('Payment already in progress. Please wait for confirmation before starting another.', 'warning');
      setModalOpen(true);
      return;
    }
    if (orderSnapshot?.backendOrderId && ['INITIATED','PENDING'].includes(orderSnapshot?.paymentStatus ?? '')) {
      push('An order payment is already in progress. Please wait for confirmation or restart checkout to create a new order.', 'warning');
      setModalOpen(true);
      return;
    }
    try {
      const provider = payMethod === 'mpesa' ? 'MPESA' : 'AIRTEL';
      const channel = payMethod === 'mpesa' ? 'MPESA_STK_PUSH' : 'AIRTEL_STK_PUSH';
      const payload = {
        orderId: orderSnapshot?.backendOrderId || orderSnapshot?.tempOrderId,
        provider,
        channel,
        method: 'MOBILE_MONEY',
        amount: formattedSnapshotTotal,
        phoneNumber: form.phone
      };
      // Ensure order exists in backend before payment (create if not already saved)
      let backendOrderId = orderSnapshot?.backendOrderId;
      const snapshotUserId = orderSnapshot?.userId ?? null;
      const currentUserId = authUser?.id ?? null;
      if (backendOrderId && snapshotUserId !== currentUserId) {
        backendOrderId = null;
        setOrderSnapshot(null);
        persist({ orderSnapshot: null });
      }
      if (!backendOrderId) {
        const created = await ensureBackendOrder();
        if (!created) return; // error already surfaced
        backendOrderId = created.id;
        payload.orderId = backendOrderId;
      } else {
        payload.orderId = backendOrderId;
      }
      const initiated = await mm.initiate(payload);
      setPaymentRef(initiated.externalRequestId || initiated.id);
    } catch (e) {
      push(e.message || 'Payment initiation failed', 'error');
    }
  }

  async function ensureBackendOrder() {
    try {
      const deliveryPayload = buildDeliveryPayload();
      const payload = {
        customerName: form.name,
        customerPhone: form.phone,
        items: items.map(i => ({ productId: i.id, quantity: i.qty })),
        couponCode: coupon?.code || undefined,
        delivery: deliveryPayload
      };
      if (deliveryPayload?.mode === 'DELIVERY') {
        const contactPhone = (form.deliveryContactPhone || '').trim();
        const contactEmail = (form.deliveryContactEmail || '').trim();
        const instructions = (form.deliveryInstructions || '').trim();
        const lat = coerceNumber(deliveryPayload.latitude ?? deliveryPayload.coordinates?.lat);
        const lng = coerceNumber(deliveryPayload.longitude ?? deliveryPayload.coordinates?.lng);
        const contextString = (deliveryPayload.context || '').trim();
        payload.deliveryType = 'DELIVERY';
        payload.deliveryShopId = deliveryPayload.shopId ?? null;
        payload.deliveryAddressLine1 = deliveryPayload.address || deliveryPayload.locationLabel || '';
        if (contextString) {
          payload.deliveryAddressLine2 = contextString;
          const contextParts = contextString.split(',').map(part => part.trim()).filter(Boolean);
          if (!payload.deliveryCity && contextParts[0]) payload.deliveryCity = contextParts[0];
          if (!payload.deliveryRegion && contextParts[1]) payload.deliveryRegion = contextParts[1];
        }
        if (Number.isFinite(lat)) payload.deliveryLat = lat;
        if (Number.isFinite(lng)) payload.deliveryLng = lng;
        payload.deliveryContactPhone = contactPhone || undefined;
        payload.deliveryContactEmail = contactEmail || undefined;
        payload.deliveryNotes = instructions || undefined;
      } else {
        payload.deliveryType = 'PICKUP';
      }
      const created = await api.orders.create(payload);
      const backendOrderNumber = created?.orderNumber ?? created?.order_number ?? null;
      // Create a snapshot of the current cart for display and receipts before clearing
      const cartSig = buildCartSignature(items);
      const backendSubtotal = parseMoney(created?.totalNet ?? created?.subtotal ?? created?.netTotal);
      const backendVat = parseMoney(created?.vatAmount ?? created?.vat ?? created?.taxAmount);
      const backendTotal = parseMoney(created?.totalGross ?? created?.total ?? created?.totalAmount);
      const backendDiscount = parseMoney(created?.discountAmount ?? created?.discount_amount);
      const backendTotalBefore = parseMoney(
        created?.totalBeforeDiscount ?? created?.total_before_discount ?? (
          backendDiscount != null && backendTotal != null ? backendTotal + backendDiscount : null
        )
      );

    const fallbackVat = roundCurrency(liveCartVatTotal) ?? 0;
    const fallbackNet = roundCurrency(liveCartNetTotal) ?? liveCartNetTotal ?? liveCartTotal;

      const snapshotItems = Array.isArray(created?.items) && created.items.length > 0
        ? created.items.map((item, idx) => {
            const fallbackSource = items[idx];
            const product = item.product || {};
            const qtyRaw = item.quantity ?? item.qty ?? fallbackSource?.qty ?? 0;
            const qty = Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 0;
            const lineGross = parseMoney(item.totalGross ?? item.lineTotal ?? item.totalAmount ?? item.total);
            const unitGross = parseMoney(item.unitPriceGross ?? item.price ?? item.unitPrice);
            const fallbackUnit = parseMoney(fallbackSource?.price);
            const resolvedUnit = unitGross != null ? unitGross : (qty > 0 && lineGross != null ? lineGross / qty : fallbackUnit);
            const productId = product.id ?? item.productId ?? fallbackSource?.id ?? item.id ?? idx;
            const label = (product.name ?? item.productName ?? item.name ?? fallbackSource?.name ?? `Item ${productId}`).toString();
            const roundedUnit = roundCurrency(resolvedUnit) ?? fallbackUnit ?? 0;
            return { id: productId, name: label, price: roundedUnit, qty };
          })
        : items.map(i => {
            const qty = Number.isFinite(Number(i.qty)) ? Number(i.qty) : 0;
            const price = parseMoney(i.price) ?? 0;
            return { id: i.id, name: i.name, price: roundCurrency(price) ?? price, qty };
          });

      const resolvedSubtotal = roundCurrency(backendSubtotal ?? fallbackNet) ?? fallbackNet;
      const resolvedVat = roundCurrency(backendVat ?? fallbackVat) ?? fallbackVat;
      const resolvedTotal = roundCurrency(backendTotal ?? liveCartTotal) ?? liveCartTotal;
      const resolvedDiscount = roundCurrency(backendDiscount ?? liveDiscount) ?? liveDiscount;
      const resolvedTotalBefore = roundCurrency(backendTotalBefore ?? grossBeforeDiscount) ?? grossBeforeDiscount;
      const snapshotUserId = created?.user?.id ?? created?.user_id ?? (authUser?.id ?? null);
      const snapshot = {
        items: snapshotItems,
        subtotal: resolvedSubtotal,
        vat: resolvedVat,
        total: resolvedTotal,
        discount: resolvedDiscount,
        totalBeforeDiscount: resolvedTotalBefore,
        ts: Date.now(),
        backendOrderId: created.id,
        orderNumber: backendOrderNumber ?? orderRef,
        orderRef: backendOrderNumber ?? orderRef,
        cartSignature: cartSig,
        userId: snapshotUserId,
        paymentStatus: created?.latestPayment?.status ?? created?.paymentStatus ?? null,
        paymentMethod: created?.latestPayment?.method ?? created?.paymentMethod ?? null,
        couponCode: created?.couponCode ?? created?.coupon_code ?? coupon?.code ?? null,
        delivery: created?.delivery ?? deliveryPayload ?? null
      };
      setOrderSnapshot(snapshot);
      persist({ orderSnapshot: snapshot });

      // Soft-clear cart after successful order creation with a backup for safety
      if (!hasCartBackup) {
        try { backupCart(); } catch {}
      }
      clearCart();
      return created;
    } catch (e) {
      // Extract probable root cause keywords to show friendlier text
      const msg = (e.message || '').toLowerCase();
      let friendly = 'Could not create order.';
      if (msg.includes('insufficient stock')) friendly = 'Some items are out of stock. Please adjust quantities.';
      else if (msg.includes('product not found')) friendly = 'One of the products was removed. Refresh and try again.';
      else if (msg.includes('at least one item')) friendly = 'Your cart is empty.';
      push(friendly, 'error');
      return null;
    }
  }

  // React to successful payment completion
  useEffect(() => {
    if (mm.payment) {
      setOrderSnapshot(os => {
        if (!os) return os;
        const next = { ...os, paymentStatus: mm.payment.status ?? null, paymentMethod: mm.payment.method ?? os.paymentMethod ?? null };
        persist({ orderSnapshot: next });
        return next;
      });
    }
  }, [mm.payment]);

  useEffect(() => {
    if (mm.status === 'succeeded' && !submitted) {
      // Prefer existing snapshot captured at order creation; fallback to live cart
      let snapshot = orderSnapshot;
      const paymentAmount = parseMoney(mm.payment?.amount);
      if (!snapshot) {
        const normalizedTotal = roundCurrency(paymentAmount ?? liveCartTotal) ?? liveCartTotal;
        const vatPortion = roundCurrency(breakdown.vatAfter) ?? breakdown.vatAfter;
        const net = roundCurrency(breakdown.netAfter) ?? breakdown.netAfter ?? normalizedTotal;
        const totalBeforeDiscount = roundCurrency(breakdown.grossBefore) ?? breakdown.grossBefore;
        const discountAmount = roundCurrency(breakdown.discount) ?? breakdown.discount;
        snapshot = {
          items: items.map(i => {
            const qty = Number.isFinite(Number(i.qty)) ? Number(i.qty) : 0;
            const price = parseMoney(i.price) ?? 0;
            return { id: i.id, name: i.name, price: roundCurrency(price) ?? price, qty };
          }),
          subtotal: net,
          vat: vatPortion,
          total: normalizedTotal,
          totalBeforeDiscount,
          discount: discountAmount,
          ts: Date.now(),
          cartSignature: buildCartSignature(items),
          userId: authUser?.id ?? null,
          paymentStatus: mm.payment?.status ?? 'SUCCESS',
          paymentMethod: mm.payment?.method ?? null,
          couponCode: coupon?.code ?? null,
          orderNumber: displayOrderRef,
          orderRef: displayOrderRef
        };
        setOrderSnapshot(snapshot);
      } else {
        const normalizedTotal = roundCurrency(paymentAmount ?? snapshot.total ?? liveCartTotal) ?? snapshot.total ?? liveCartTotal;
        const normalizedSubtotal = snapshot.subtotal != null ? roundCurrency(snapshot.subtotal) ?? snapshot.subtotal : snapshot.subtotal;
        const normalizedVat = snapshot.vat != null ? roundCurrency(snapshot.vat) ?? snapshot.vat : snapshot.vat;
        const normalizedDiscount = snapshot.discount != null ? roundCurrency(snapshot.discount) ?? snapshot.discount : roundCurrency(breakdown.discount) ?? snapshot.discount;
        const normalizedTotalBefore = snapshot.totalBeforeDiscount != null
          ? roundCurrency(snapshot.totalBeforeDiscount) ?? snapshot.totalBeforeDiscount
          : roundCurrency(breakdown.grossBefore) ?? breakdown.grossBefore;
        snapshot = {
          ...snapshot,
          total: normalizedTotal,
          subtotal: normalizedSubtotal ?? snapshot.subtotal,
          vat: normalizedVat ?? snapshot.vat,
          discount: normalizedDiscount ?? snapshot.discount ?? 0,
          totalBeforeDiscount: normalizedTotalBefore ?? snapshot.totalBeforeDiscount ?? normalizedTotal,
          paymentStatus: mm.payment?.status ?? snapshot.paymentStatus ?? 'SUCCESS',
          paymentMethod: mm.payment?.method ?? snapshot.paymentMethod ?? null
        };
        setOrderSnapshot(snapshot);
      }
      setStep(3);
      setSubmitted(true);
      persist({ submitted: true, step: 3, paymentRef, orderSnapshot: snapshot });
      // Clear any cart backup since the order/payment is complete
      try { clearCart(); } catch {}
      try { clearCartBackup(); } catch {}
  push('Payment successful');
  setModalOpen(false);
  // store order history
      try {
        const itemsForStorage = (Array.isArray(snapshot.items) ? snapshot.items : items).map((i, idx) => {
          const qty = Number.isFinite(Number(i.qty)) ? Number(i.qty) : 0;
          const price = parseMoney(i.price) ?? 0;
          const unitGross = roundCurrency(price) ?? price;
          const unitNet = roundCurrency(unitGross / (1 + VAT_RATE)) ?? unitGross;
          const unitVat = roundCurrency(unitGross - unitNet) ?? 0;
          return {
            id: i.id ?? idx,
            productId: i.id ?? idx,
            productName: i.name ?? `Item ${idx + 1}`,
            quantity: qty,
            unitPriceGross: unitGross,
            unitPriceNet: unitNet,
            vatAmount: unitVat
          };
        });
        const isoCreatedAt = new Date(snapshot.ts || Date.now()).toISOString();
        const fallbackMethodCode = (() => {
          if (snapshot.paymentMethod) return snapshot.paymentMethod;
          if (mm.payment?.method) return mm.payment.method;
          switch (payMethod) {
            case 'cash':
              return 'CASH_ON_DELIVERY';
            case 'card':
              return 'CARD';
            default:
              return 'MOBILE_MONEY';
          }
        })();
        const fallbackProvider = snapshot.paymentProgress?.provider
          ?? mm.payment?.provider
          ?? resolvedPaymentProvider
          ?? (fallbackMethodCode === 'MOBILE_MONEY' ? 'MPESA' : null);
        const fallbackChannel = snapshot.paymentProgress?.channel
          ?? mm.payment?.channel
          ?? resolvedPaymentChannel
          ?? (fallbackProvider === 'MPESA'
            ? 'MPESA_STK_PUSH'
            : fallbackProvider === 'AIRTEL'
              ? 'AIRTEL_STK_PUSH'
              : null);
        const snapshotOrderRef = snapshot.orderNumber ?? snapshot.orderRef ?? displayOrderRef;
        const deliveryInfo = snapshot.delivery ?? buildDeliveryPayload();
        const guestOrder = {
          id: snapshot.backendOrderId ?? orderSnapshot?.backendOrderId ?? `guest-${orderRef}`,
          sessionId: guestSessionId,
          orderRef: snapshotOrderRef,
          orderNumber: snapshot.orderNumber ?? null,
          createdAt: isoCreatedAt,
          customerName: form.name,
          customerPhone: form.phone,
          items: itemsForStorage,
          totalGross: snapshot.total,
          totalNet: snapshot.subtotal ?? roundCurrency(snapshot.total / (1 + VAT_RATE)) ?? snapshot.total,
          vatAmount: snapshot.vat ?? roundCurrency(snapshot.total - (snapshot.subtotal ?? (snapshot.total / (1 + VAT_RATE)))) ?? 0,
          totalBeforeDiscount: snapshot.totalBeforeDiscount ?? (snapshot.total + (snapshot.discount ?? 0)),
          discountAmount: snapshot.discount ?? 0,
          couponCode: snapshot.couponCode ?? coupon?.code ?? null,
          paymentStatus: snapshot.paymentStatus ?? 'SUCCESS',
          paymentMethod: fallbackMethodCode,
          paymentProgress: snapshot.paymentStatus ? {
            status: snapshot.paymentStatus,
            method: fallbackMethodCode,
            provider: fallbackProvider,
            channel: fallbackChannel,
            amount: snapshot.total,
            updatedAt: isoCreatedAt,
          } : null,
          snapshot,
          guestPaymentRef: paymentRef || null,
          guestPaymentMethod: payMethod,
          delivery: deliveryInfo
        };
        appendGuestOrder(guestOrder, guestSessionId);
        try { localStorage.removeItem('orders'); } catch {}
      } catch {}
    }
    if (mm.status === 'failed' || modalPaymentState === 'timeout') {
      const timedOut = mm.payment?.failureReason === 'TIMEOUT_EXPIRED' || modalPaymentState === 'timeout';
      if (orderSnapshot?.backendOrderId) {
        (async () => {
          try {
            await api.payments.markFailed(orderSnapshot.backendOrderId, {
              reason: timedOut ? 'TIMEOUT_EXPIRED' : 'PAYMENT_FAILED',
              context: {
                hookStatus: mm.status,
                failureReason: mm.payment?.failureReason ?? null
              }
            });
          } catch (err) {
            console.warn('Failed to notify backend about order failure', err);
          }
        })();
      }
      push(timedOut ? 'Payment attempt expired after 3 minutes. If your mobile money was charged, please contact support.' : 'Payment failed', timedOut ? 'warning' : 'error');
      // Automatically restore cart on failure if we have a backup
      try {
        if (hasCartBackup) {
          restoreCart();
          clearCartBackup();
          push('Cart restored');
        }
      } catch {}
      setOrderSnapshot(null);
      persist({ orderSnapshot: null });
      setModalOpen(true);
    }
  }, [mm.status, modalPaymentState]);

  function exportSummary() {
    const snap = orderSnapshot || { items, total };
    const lines = [
      `Order: ${displayOrderRef}`,
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Delivery: ${form.delivery}`,
      ...(form.delivery === 'delivery'
        ? [
            `Address: ${resolvedDeliveryLocation}`,
            `Contact phone: ${form.deliveryContactPhone || form.phone}`,
            ...(form.deliveryContactEmail ? [`Contact email: ${form.deliveryContactEmail}`] : []),
            ...(form.deliveryInstructions ? [`Instructions: ${form.deliveryInstructions}`] : [])
          ]
        : []),
      `Payment: ${paymentRef || 'N/A'}`,
      'Items:',
      ...((Array.isArray(snap.items) ? snap.items : items).map(i => `  - ${i.name} x${i.qty} = ${formatCurrency(i.price * i.qty)}`)),
      `Total: ${formatCurrency(snap.total)}`
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `order-${fileSafeOrderRef}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    push('Summary downloaded');
  }

  async function exportPdf() {
    // Build snapshot with inclusive VAT extraction if needed
    let snap = (orderSnapshot && Array.isArray(orderSnapshot.items)) ? orderSnapshot : { items, total };
    if (snap && (snap.subtotal == null || snap.vat == null)) {
      const vatPortion = +(snap.total - (snap.total / (1 + VAT_RATE))).toFixed(2);
      const net = +(snap.total - vatPortion).toFixed(2);
      snap = { ...snap, subtotal: net, vat: vatPortion };
    }
    try {
      const pdfMake = await getPdfMake();

      // Generate QR code (data URL) with minimal payload
      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(JSON.stringify({ orderRef: displayOrderRef, total: snap.total }));
      } catch {}

      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 50, 40, 60],
        content: [
          { text: BRAND_RECEIPT_TITLE, style: 'brand' },
          { text: 'Receipt (Customer Copy)', style: 'subheader', margin: [0, 0, 0, 12] },
          {
            columns: [
              [
                { text: `Order: ${displayOrderRef}`, style: 'meta' },
                paymentRef ? { text: `Payment: ${paymentRef}`, style: 'meta' } : null,
                { text: `Date: ${new Date(snap.ts || Date.now()).toLocaleString()}`, style: 'meta' },
                { text: `Method: ${resolvedPaymentLabel}`, style: 'meta' }
              ].filter(Boolean),
              [
                { text: 'Customer', style: 'metaBold', alignment: 'right' },
                { text: form.name, style: 'meta', alignment: 'right' },
                { text: form.phone, style: 'meta', alignment: 'right' },
                form.delivery === 'delivery' ? { text: resolvedDeliveryLocation, style: 'meta', alignment: 'right' } : null
              ].filter(Boolean)
            ]
          },
          { text: 'Items', style: 'sectionTitle', margin: [0, 18, 0, 6] },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Item', style: 'tableHead' },
                  { text: 'Qty', style: 'tableHead', alignment: 'center' },
                  { text: 'Price', style: 'tableHead', alignment: 'right' },
                  { text: 'Subtotal', style: 'tableHead', alignment: 'right' }
                ],
                ...snap.items.map(i => [
                  { text: i.name, style: 'tableCell' },
                  { text: String(i.qty), style: 'tableCell', alignment: 'center' },
                  { text: formatCurrency(i.price), style: 'tableCell', alignment: 'right' },
                  { text: formatCurrency(i.price * i.qty), style: 'tableCell', alignment: 'right' }
                ])
              ]
            },
            layout: 'lightHorizontalLines'
          },
          {
            columns: [
              { width: '*', text: '' },
              {
                width: 'auto',
                table: {
                  body: [
                    [ { text: 'Net (Excl VAT):', style: 'meta' }, { text: formatCurrency(snap.subtotal), style: 'meta', alignment: 'right' } ],
                    [ { text: 'VAT 16%:', style: 'meta' }, { text: formatCurrency(snap.vat), style: 'meta', alignment: 'right' } ],
                    [ { text: 'TOTAL (Incl):', style: 'totalLabel' }, { text: formatCurrency(snap.total), style: 'totalValue', alignment: 'right' } ]
                  ]
                },
                layout: 'noBorders',
                margin: [0, 12, 0, 0]
              }
            ]
          },
          (/^data:image\/png;base64,/.test(qrDataUrl) && qrDataUrl.length > 100) ? { image: qrDataUrl, width: 110, alignment: 'center', margin: [0, 28, 0, 10] } : { text: '', margin: [0, 20, 0, 0] },
          { text: `Asante kwa kununua!\n${BRAND_COPY_FOOTER}` , alignment: 'center', style: 'footer' }
        ],
        styles: {
          brand: { fontSize: 22, bold: true, alignment: 'center', color: '#1a7f37', margin: [0,0,0,4] },
          header: { fontSize: 20, bold: true, alignment: 'center' },
          subheader: { fontSize: 11, italics: true, alignment: 'center', color: '#555' },
          sectionTitle: { fontSize: 12, bold: true },
          tableHead: { bold: true, fillColor: '#F3F4F6' },
          tableCell: { fontSize: 10 },
          meta: { fontSize: 9, color: '#333' },
          metaBold: { fontSize: 9, bold: true, color: '#111' },
          totalLabel: { bold: true, fontSize: 10, margin: [0, 4, 12, 0] },
          totalValue: { bold: true, fontSize: 10, margin: [0, 4, 0, 0] },
          footer: { fontSize: 9, color: '#444' }
        },
        defaultStyle: { fontSize: 9 }
      };

      pdfMake.createPdf(docDefinition).download(`receipt-${fileSafeOrderRef}.pdf`);
      push('Receipt PDF downloaded');
    } catch (err) {
      console.error('PDF export failed', err);
      push('PDF generation failed', 'error');
    }
  }

  async function mockEmail() {
    let snap = (orderSnapshot && Array.isArray(orderSnapshot.items)) ? orderSnapshot : { items, total };
    if (snap && (snap.subtotal == null || snap.vat == null)) {
      const vatPortion = +(snap.total - (snap.total / (1 + VAT_RATE))).toFixed(2);
      const net = +(snap.total - vatPortion).toFixed(2);
      snap = { ...snap, subtotal: net, vat: vatPortion };
    }
    const pretty = [
  `${BRAND_RECEIPT_TITLE} Receipt`,
    `Order: ${displayOrderRef}`,
      paymentRef ? `Payment Ref: ${paymentRef}` : '',
      `Date: ${new Date(snap.ts || Date.now()).toLocaleString()}`,
      `Customer: ${form.name}`,
      `Phone: ${form.phone}`,
  form.delivery==='delivery' ? `Address: ${resolvedDeliveryLocation}` : 'Pickup at store',
      '',
      'Items:'
    ].filter(Boolean);
    (Array.isArray(snap.items) ? snap.items : items).forEach(i => pretty.push(` - ${i.name} x${i.qty} @ ${formatCurrency(i.price)} = ${formatCurrency(i.price*i.qty)}`));
  pretty.push('', `Net (Excl VAT): ${formatCurrency(snap.subtotal)}`, `VAT (16%): ${formatCurrency(snap.vat)}`, `TOTAL (Incl): ${formatCurrency(snap.total)}`, '', 'Asante!');
  const res = await sendEmailMock({ orderRef: displayOrderRef, total: snap.total, phone: form.phone, body: pretty.join('\n') });
    if (res.sent) push('Email sent (mock)');
  }

  // If a prior order was confirmed but user added new items, restart flow
  useEffect(() => {
    if (submitted && items.length && step === 3) {
      setSubmitted(false);
      setStep(1);
      persist({ submitted: false, step: 1 });
    }
  }, [items.length]);

  useEffect(() => {
    if (submitted) return;
    if (!orderSnapshot?.backendOrderId) return;
    if (!items.length) return;
    const liveSig = buildCartSignature(items);
    const snapshotSig = orderSnapshot.cartSignature ?? buildCartSignature(orderSnapshot.items);
    if (liveSig !== snapshotSig) {
      setOrderSnapshot(null);
      persist({ orderSnapshot: null });
    }
  }, [items, submitted, orderSnapshot?.backendOrderId, orderSnapshot?.cartSignature]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const hasActiveItems = (items && items.length > 0) || (orderSnapshot?.items?.length > 0);
        if (!hasActiveItems) {
          if (mounted) {
            setOptionsLoading(false);
            setPaymentOptions([]);
          }
          return;
        }
        setOptionsLoading(true);
        const opts = await api.payments.options();
        if (mounted) setPaymentOptions(opts);
      } catch (err) {
        console.error('Could not load payment options', err);
        if (mounted) setPaymentOptions([]);
      } finally {
        if (mounted) setOptionsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [items, orderSnapshot?.items?.length]);

  function openOption(opt) {
    setSelectedOption(opt);
    setModalPhone(form.phone || '');
    setModalAccountRef('');
    setModalOpen(true);
  }
  async function initiateFromOption() {
    if (!selectedOption) return;
    if (['initiating','pending','reconciling'].includes(mm.status)) {
      push('Payment already in progress. Please wait for confirmation before starting another.', 'warning');
      return;
    }
    if (orderSnapshot?.backendOrderId && ['INITIATED','PENDING'].includes(orderSnapshot?.paymentStatus ?? '')) {
      push('An order payment is already in progress. Please wait for confirmation or restart checkout to create a new order.', 'warning');
      return;
    }
    try {
      // Ensure backend order exists
      let backendOrderId = orderSnapshot?.backendOrderId;
      const snapshotUserId = orderSnapshot?.userId ?? null;
      const currentUserId = authUser?.id ?? null;
      if (backendOrderId && snapshotUserId !== currentUserId) {
        backendOrderId = null;
        setOrderSnapshot(null);
        persist({ orderSnapshot: null });
      }
      if (!backendOrderId) {
        const created = await ensureBackendOrder();
        if (!created) return;
        backendOrderId = created.id;
      }
      if (selectedOption.supportsStk) {
        const payload = {
          orderId: backendOrderId,
          provider: selectedOption.provider,
          channel: selectedOption.channel,
          method: 'MOBILE_MONEY',
          amount: formattedSnapshotTotal,
          phoneNumber: modalPhone,
          accountReference: modalAccountRef || undefined,
          supportsStk: true
        };
        await mm.initiate(payload);
      } else {
        // manual initiation
        await api.payments.initiateManual({
          orderId: backendOrderId,
          paymentOptionId: selectedOption.id,
          amount: formattedSnapshotTotal,
          phoneNumber: modalPhone || undefined,
          accountReference: modalAccountRef || undefined
        });
        // start polling using hook's internal poller by seeding orderId
        mm.initiate({ orderId: backendOrderId, provider: selectedOption.provider, channel: selectedOption.channel, method: 'MOBILE_MONEY', amount: formattedSnapshotTotal, phoneNumber: modalPhone });
      }
    } catch (e) {
      push(e.message || 'Could not start payment', 'error');
    }
  }

  const continueWithCash = async () => {
    if (cashSubmitting) return;
    if (!items.length) {
      push('Your cart is empty. Add items before placing an order.', 'warning');
      return;
    }

    const now = Date.now();
    const deliveryPayload = buildDeliveryPayload();
    const cartSignatureBefore = buildCartSignature(items);
    const cartItems = items.map((item, idx) => {
      const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0;
      const priceValue = parseMoney(item.price) ?? 0;
      const unitGross = roundCurrency(priceValue) ?? priceValue;
      return {
        id: item.id ?? idx,
        name: item.name ?? `Item ${idx + 1}`,
        price: unitGross,
        qty
      };
    });
  const gross = roundCurrency(liveCartTotal) ?? liveCartTotal;
  const totalBefore = roundCurrency(breakdown.grossBefore) ?? breakdown.grossBefore;
  const discountAmount = roundCurrency(breakdown.discount) ?? breakdown.discount;
  const vatPortion = roundCurrency(liveCartVatTotal) ?? liveCartVatTotal ?? 0;
  const net = roundCurrency(liveCartNetTotal) ?? liveCartNetTotal ?? gross;

    setCashSubmitting(true);
    let createdOrder = null;
    try {
      createdOrder = await ensureBackendOrder();
      if (!createdOrder) {
        setCashSubmitting(false);
        return;
      }
      const backendOrderId = createdOrder.id ?? orderSnapshot?.backendOrderId;
      if (!backendOrderId) {
        push('Unable to prepare your cash payment. Please try again.', 'error');
        setCashSubmitting(false);
        return;
      }

      const paymentResp = await api.payments.create({ orderId: backendOrderId, method: 'CASH_ON_DELIVERY' });
      const paymentData = paymentResp?.data ?? paymentResp;
      const paymentStatus = (paymentData?.status ?? 'PENDING').toUpperCase();
      const paymentMethodCode = paymentData?.method ?? 'CASH_ON_DELIVERY';
      const paymentProgress = paymentData ? {
        id: paymentData.id,
        status: paymentStatus,
        method: paymentMethodCode,
        provider: paymentData.provider ?? null,
        channel: paymentData.channel ?? null,
        amount: paymentData.amount ?? gross,
        createdAt: paymentData.createdAt ?? new Date(now).toISOString(),
        updatedAt: paymentData.updatedAt ?? paymentData.createdAt ?? null,
        externalRequestId: paymentData.externalRequestId ?? null,
        externalTransactionId: paymentData.externalTransactionId ?? null
      } : null;

      const backendSubtotal = parseMoney(createdOrder?.totalNet ?? createdOrder?.subtotal ?? createdOrder?.netTotal);
      const backendVat = parseMoney(createdOrder?.vatAmount ?? createdOrder?.vat ?? createdOrder?.taxAmount);
      const backendTotal = parseMoney(createdOrder?.totalGross ?? createdOrder?.total ?? createdOrder?.totalAmount);

      const snapshotItems = Array.isArray(createdOrder?.items) && createdOrder.items.length > 0
        ? createdOrder.items.map((item, idx) => {
            const fallbackSource = cartItems[idx];
            const product = item.product || {};
            const qtyRaw = item.quantity ?? item.qty ?? fallbackSource?.qty ?? 0;
            const qty = Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 0;
            const lineGross = parseMoney(item.totalGross ?? item.lineTotal ?? item.totalAmount ?? item.total);
            const unitGross = parseMoney(item.unitPriceGross ?? item.price ?? item.unitPrice);
            const fallbackUnit = parseMoney(fallbackSource?.price);
            const resolvedUnit = unitGross != null ? unitGross : (qty > 0 && lineGross != null ? lineGross / qty : fallbackUnit);
            const productId = product.id ?? item.productId ?? fallbackSource?.id ?? item.id ?? idx;
            const label = (product.name ?? item.productName ?? item.name ?? fallbackSource?.name ?? `Item ${productId}`).toString();
            const roundedUnit = roundCurrency(resolvedUnit) ?? fallbackUnit ?? 0;
            return { id: productId, name: label, price: roundedUnit, qty };
          })
        : cartItems;

  const resolvedSubtotal = roundCurrency(backendSubtotal ?? net) ?? net;
  const resolvedVat = roundCurrency(backendVat ?? vatPortion) ?? vatPortion;
  const resolvedTotal = roundCurrency(backendTotal ?? gross) ?? gross;
  const resolvedDiscount = roundCurrency(parseMoney(createdOrder?.discountAmount ?? createdOrder?.discount_amount) ?? discountAmount) ?? discountAmount;
  const resolvedTotalBefore = roundCurrency(parseMoney(createdOrder?.totalBeforeDiscount ?? createdOrder?.total_before_discount) ?? totalBefore) ?? totalBefore;
      const snapshotUserId = createdOrder?.user?.id ?? createdOrder?.user_id ?? (authUser?.id ?? null);

      const snapshot = {
        items: snapshotItems,
        subtotal: resolvedSubtotal,
        vat: resolvedVat,
        total: resolvedTotal,
        totalBeforeDiscount: resolvedTotalBefore,
        discount: resolvedDiscount,
        ts: now,
        backendOrderId,
        cartSignature: cartSignatureBefore,
        userId: snapshotUserId,
        paymentStatus,
        paymentMethod: paymentMethodCode,
        paymentProgress,
        couponCode: createdOrder?.couponCode ?? createdOrder?.coupon_code ?? coupon?.code ?? null,
        delivery: createdOrder?.delivery ?? deliveryPayload ?? null,
      };

      setOrderSnapshot(snapshot);
      setPaymentRef('');
      setSubmitted(true);
      setStep(3);
      persist({ orderSnapshot: snapshot, submitted: true, step: 3, payMethod: 'cash' });

      try { clearCartBackup(); } catch {}

      try {
        const itemsForStorage = snapshotItems.map((item, idx) => {
          const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0;
          const unitGross = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
          const unitNet = roundCurrency(unitGross / (1 + VAT_RATE)) ?? unitGross;
          const unitVat = roundCurrency(unitGross - unitNet) ?? 0;
          return {
            id: item.id ?? idx,
            productId: item.id ?? idx,
            productName: item.name,
            quantity: qty,
            unitPriceGross: unitGross,
            unitPriceNet: unitNet,
            vatAmount: unitVat
          };
        });
        const isoCreatedAt = new Date(now).toISOString();
        appendGuestOrder({
          id: backendOrderId,
          sessionId: guestSessionId,
          orderRef,
          createdAt: isoCreatedAt,
          customerName: form.name,
          customerPhone: form.phone,
          items: itemsForStorage,
          totalGross: resolvedTotal,
          totalNet: resolvedSubtotal,
          vatAmount: resolvedVat,
          totalBeforeDiscount: resolvedTotalBefore,
          discountAmount: resolvedDiscount,
          couponCode: snapshot.couponCode ?? coupon?.code ?? null,
          paymentStatus,
          paymentMethod: paymentMethodCode,
          paymentProgress,
          snapshot,
          guestPaymentRef: null,
          guestPaymentMethod: 'cash',
          delivery: snapshot.delivery ?? deliveryPayload ?? null
        }, guestSessionId);
      } catch {}

  push('Order placed. Please pay when your items arrive.', 'success');
    } catch (e) {
      if (createdOrder && hasCartBackup) {
        try {
          restoreCart();
        } catch {}
      }
      push(e.message || 'Could not record cash payment. Please contact support or try again.', 'error');
    } finally {
      setCashSubmitting(false);
    }
  };

  if (shouldRedirectToCart) {
    return (
      <section className="py-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-8 col-lg-6">
              <div className="card shadow-sm border-0 p-4 text-center">
                <h2 className="h5 mb-3">Your cart is empty</h2>
                <p className="text-muted mb-4">Add items to your cart before proceeding to checkout.</p>
                <div className="d-flex justify-content-center gap-2 flex-wrap">
                  <Link to="/products" className="btn btn-success btn-sm">Browse products</Link>
                  <Link to="/cart" className="btn btn-outline-secondary btn-sm">Go to cart</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (submitted && step === 3) {
    const snap = orderSnapshot || { items: [], total };
    const receiptOrderRef = orderSnapshot?.orderNumber ?? orderSnapshot?.orderRef ?? displayOrderRef ?? orderRef;
    const deliveryInfo = orderSnapshot?.delivery ?? buildDeliveryPayload();
    const deliveryMode = (deliveryInfo?.mode ?? deliveryInfo?.type ?? form.delivery ?? '').toString().toUpperCase();
    const isDeliveryOrder = deliveryMode === 'DELIVERY';
    const baseAddress = (deliveryInfo?.locationLabel ?? deliveryInfo?.address ?? resolvedDeliveryLocation ?? '').trim();
    const extraContext = (deliveryInfo?.context ?? '').trim();
    const showContext = Boolean(extraContext) && (!baseAddress || !baseAddress.toLowerCase().includes(extraContext.toLowerCase()));
    const combinedAddress = baseAddress || (showContext ? extraContext : '');
    const contactPhone = (deliveryInfo?.contactPhone ?? form.deliveryContactPhone ?? form.phone ?? '').trim();
    const contactEmail = (deliveryInfo?.contactEmail ?? form.deliveryContactEmail ?? '').trim();
    const instructionsText = (deliveryInfo?.instructions ?? form.deliveryInstructions ?? '').trim();
    const shopLabel = deliveryInfo?.shop?.name ?? deliveryInfo?.shopName ?? deliveryInfo?.shop?.label ?? '';
    const distanceKm = coerceNumber(deliveryInfo?.estimatedDistanceKm ?? deliveryInfo?.distanceKm ?? deliveryInfo?.distance_km);
    const etaMinutes = coerceNumber(deliveryInfo?.estimatedMinutes ?? deliveryInfo?.etaMinutes ?? deliveryInfo?.eta_minutes);
    const deliveryFeeDisplay = Number.isFinite(snapshotDeliveryFee) ? snapshotDeliveryFee : coerceNumber(
      deliveryInfo?.fee ??
      deliveryInfo?.deliveryFee ??
      deliveryInfo?.delivery_fee ??
      deliveryInfo?.quote?.fee ??
      deliveryInfo?.quote?.amount
    );
    return (
      <section className="container py-4">
        <h1 className="h3 mb-3">Order Confirmed</h1>
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <div className="d-flex flex-column flex-md-row justify-content-between mb-3 gap-2">
              <div>
                <h2 className="h6 mb-1">Receipt</h2>
                <p className="small text-muted mb-0">Ref: <strong>{receiptOrderRef}</strong></p>
                {paymentRef && (
                  <p className="small text-muted mb-0">Payment: <strong>{paymentRef}</strong> ({resolvedPaymentLabel})</p>
                )}
                <p className="small text-muted mb-0">Date: {new Date(snap.ts || Date.now()).toLocaleString()}</p>
              </div>
              <div className="text-md-end">
                <p className="mb-0 fw-semibold">Customer</p>
                <p className="small mb-0">{form.name}</p>
                <p className="small mb-0">{form.phone}</p>
                {form.delivery === 'delivery' && <p className="small mb-0">Address: {form.address}</p>}
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-3">
                <thead>
                  <tr className="table-light">
                    <th>Item</th>
                    <th className="text-center" style={{ width: '70px' }}>Qty</th>
                    <th className="text-end" style={{ width: '110px' }}>Price</th>
                    <th className="text-end" style={{ width: '120px' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(snap.items || []).map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td className="text-center">{i.qty}</td>
                      <td className="text-end">{formatKES(i.price)}</td>
                      <td className="text-end">{formatKES(i.price * i.qty)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3} className="text-end">Net (Excl VAT)</th>
                    <th className="text-end">{formatKES(snap.subtotal ?? snap.total)}</th>
                  </tr>
                  <tr>
                    <th colSpan={3} className="text-end">VAT 16%</th>
                    <th className="text-end">{formatKES(snap.vat ?? 0)}</th>
                  </tr>
                  <tr>
                    <th colSpan={3} className="text-end">Total</th>
                    <th className="text-end">{formatKES(snap.total)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
            {isDeliveryOrder && (
              <div className="mt-4 pt-3 border-top">
                <h3 className="h6 mb-3">Delivery details</h3>
                <div className="row g-3 small">
                  <div className="col-12 col-md-6">
                    <p className="mb-1 text-muted text-uppercase fw-semibold">Address</p>
                    <p className="mb-0">{combinedAddress || 'Not provided'}</p>
                    {showContext && <p className="mb-0 text-muted">{extraContext}</p>}
                  </div>
                  <div className="col-12 col-md-6">
                    <p className="mb-1 text-muted text-uppercase fw-semibold">Contact phone</p>
                    <p className="mb-0">{contactPhone || 'Not provided'}</p>
                    {contactEmail && <p className="mb-0 text-muted">Email: {contactEmail}</p>}
                  </div>
                  {shopLabel && (
                    <div className="col-12 col-md-6">
                      <p className="mb-1 text-muted text-uppercase fw-semibold">Prepared by</p>
                      <p className="mb-0">{shopLabel}</p>
                    </div>
                  )}
                  {(Number.isFinite(distanceKm) || Number.isFinite(etaMinutes)) && (
                    <div className="col-12 col-md-6">
                      <p className="mb-1 text-muted text-uppercase fw-semibold">Estimate</p>
                      {Number.isFinite(distanceKm) && <p className="mb-0">~{distanceKm.toFixed(1)} km</p>}
                      {Number.isFinite(etaMinutes) && <p className="mb-0">~{Math.round(etaMinutes)} minutes</p>}
                    </div>
                  )}
                  {Number.isFinite(deliveryFeeDisplay) && (
                    <div className="col-12 col-md-6">
                      <p className="mb-1 text-muted text-uppercase fw-semibold">Delivery fee</p>
                      <p className="mb-0">{formatKES(deliveryFeeDisplay)}</p>
                    </div>
                  )}
                  {instructionsText && (
                    <div className="col-12">
                      <p className="mb-1 text-muted text-uppercase fw-semibold">Instructions</p>
                      <p className="mb-0">{instructionsText}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="small text-muted">
              We will contact you on {contactPhone || form.phone || 'your phone'}
              {isDeliveryOrder
                ? ` and deliver to ${combinedAddress || 'your chosen address'}`
                : ' when your order is ready for pickup'}.
            </p>
            <div className="d-flex flex-wrap gap-2 mt-2">
              <button onClick={exportSummary} className="btn btn-outline-secondary btn-sm"><i className="bi bi-filetype-txt me-1"></i>Text</button>
              <button onClick={exportPdf} className="btn btn-outline-secondary btn-sm"><i className="bi bi-filetype-pdf me-1"></i>PDF</button>
              <button onClick={mockEmail} className="btn btn-outline-secondary btn-sm"><i className="bi bi-envelope me-1"></i>Email</button>
              <button onClick={() => window.print()} className="btn btn-outline-secondary btn-sm"><i className="bi bi-printer me-1"></i>Print</button>
              <button
                onClick={() => {
                  try { sessionStorage.removeItem('checkout'); } catch {}
                  navigate('/');
                }}
                className="btn btn-success btn-sm ms-auto"
              >
                <i className="bi bi-house-door me-1"></i>Home
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="container py-3 px-3 px-sm-4">
      <h1 id="checkout-heading" tabIndex="-1" className="h3 mb-3">Checkout</h1>
      {!isAuthenticated && (
        <div className="alert alert-info d-flex flex-column flex-md-row align-items-md-center gap-2" role="status">
          <div><strong>Have an account?</strong> Log in to reuse saved delivery addresses and keep track of every order.</div>
          <div className="d-flex gap-2 ms-md-auto">
            <Link to="/login" className="btn btn-sm btn-success">Log in</Link>
            <Link to="/register" className="btn btn-sm btn-outline-success">Sign up</Link>
          </div>
        </div>
      )}
      <ProgressSteps current={step} />
      <div className="row g-4">
        <div className="col-12 col-lg-7">
          {step === 1 && (
            <form onSubmit={handleSubmit(onSubmitDetails)} noValidate>
              <div className="mb-3">
                <label className="form-label">Full Name</label>
                <input placeholder="Jane Doe" aria-invalid={!!errors.name} {...register('name', nameRules)} className={`form-control ${errors.name ? 'is-invalid' : touchedFields.name ? 'is-valid' : ''}`} />
                {errors.name && <div className="invalid-feedback d-block small">{errors.name.message}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label">Phone</label>
                <input placeholder="07xx xxx xxx" aria-invalid={!!errors.phone} {...register('phone', phoneRules)} className={`form-control ${errors.phone ? 'is-invalid' : touchedFields.phone ? 'is-valid' : ''}`} />
                {errors.phone && <div className="invalid-feedback d-block small">{errors.phone.message}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label">Delivery Method</label>
                <select className="form-select" {...register('delivery')}>
                  <option value="pickup">Store Pickup</option>
                  <option value="delivery">Home Delivery</option>
                </select>
              </div>
              {isAuthenticated && form.delivery === 'delivery' && savedAddresses.length > 0 && (
                <div className="mb-3">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body d-flex flex-column gap-2">
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <p className="small text-muted mb-0">Use a saved address</p>
                        <Link to="/account/settings" className="btn btn-link btn-sm p-0 align-self-start">Manage addresses</Link>
                      </div>
                      {savedAddresses.map(address => {
                        const selected = selectedAddressId === address.id;
                        return (
                          <label
                            key={address.id}
                            className={`border rounded p-3 w-100 ${selected ? 'border-success bg-body-tertiary' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="d-flex align-items-start gap-3">
                              <input
                                type="radio"
                                className="form-check-input mt-1"
                                name="saved-address"
                                checked={selected}
                                onChange={() => {
                                  setSelectedAddressId(address.id);
                                  if (form.delivery !== 'delivery') {
                                    setValue('delivery', 'delivery', { shouldDirty: true, shouldTouch: true });
                                  }
                                  setValue('address', address.details, { shouldDirty: false, shouldTouch: true });
                                  trigger('address');
                                }}
                              />
                              <div className="flex-grow-1">
                                <div className="fw-semibold">{address.label || 'Saved address'}</div>
                                <p className="small mb-0 text-muted">{address.details}</p>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {form.delivery === 'delivery' && (
                <>
                  <div className="mb-3 position-relative">
                    <label className="form-label">Delivery location</label>
                    <div className="position-relative">
                      <div className="input-group">
                        <input
                          type="text"
                          placeholder="Search for your estate, street or landmark"
                          aria-invalid={!!errors.address}
                          {...addressField}
                          onChange={(event) => {
                            addressField.onChange(event);
                            const nextValue = event.target.value;
                            setLocationQuery(nextValue);
                            if (selectedAddressId) {
                              setSelectedAddressId(null);
                            }
                            updateDeliveryState(prev => {
                              const trimmedPrev = (prev.locationLabel || '').trim();
                              const trimmedNext = (nextValue || '').trim();
                              if (trimmedPrev === trimmedNext) {
                                return { locationLabel: nextValue };
                              }
                              return {
                                locationLabel: nextValue,
                                searchQuery: nextValue,
                                lat: null,
                                lng: null,
                                selectedResult: null,
                                shopId: null,
                                shop: null,
                                quote: null,
                                distanceKm: null,
                                estimatedMinutes: null,
                                context: '',
                                fee: null,
                                availabilityReason: null,
                                availabilityMessage: null
                              };
                            });
                          }}
                          onBlur={(event) => {
                            addressField.onBlur(event);
                          }}
                          autoComplete="off"
                          className={`form-control ${errors.address ? 'is-invalid' : touchedFields.address ? 'is-valid' : ''}`}
                        />
                        <button
                          type="button"
                          className="btn btn-outline-success"
                          onClick={() => setMapPickerOpen(true)}
                          aria-label="Pick location on map"
                        >
                          <i className="bi bi-map"></i>
                          <span className="d-none d-sm-inline ms-1">Map</span>
                        </button>
                      </div>
                      {locationResults.length > 0 && (locationQuery || '').trim().length >= 3 && !hasDeliveryCoordinates && (
                        <ul className="list-group shadow-sm position-absolute w-100 mt-1" style={{ zIndex: 40 }}>
                          {locationResults.map((result) => {
                            const label = resolveGeoLabel(result);
                            const context = resolveGeoContext(result);
                            const key = resolvePlaceId(result) ?? `${label}-${context}` ?? JSON.stringify(result);
                            return (
                              <li
                                key={key}
                                className="list-group-item list-group-item-action d-flex flex-column"
                                role="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  handleLocationSelect(result);
                                }}
                              >
                                <span className="fw-semibold">{label || 'Unnamed location'}</span>
                                {context && <span className="small text-muted">{context}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {locationLoading && <div className="form-text small">Searching nearby locations…</div>}
                    {locationError && <div className="invalid-feedback d-block small">Could not search locations. Please check your connection.</div>}
                    {errors.address && <div className="invalid-feedback d-block small">{errors.address.message}</div>}
                    {!errors.address && deliveryState.locationLabel && (
                      <div className="form-text small">We'll deliver to <strong>{deliveryState.locationLabel}</strong>.</div>
                    )}
                  </div>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label mb-0">Delivery contact</label>
                        <span className="small text-muted">Shared with the rider if needed</span>
                      </div>
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label small text-muted" htmlFor="checkout-contact-phone">Alternate phone (optional)</label>
                          <input
                            id="checkout-contact-phone"
                            type="tel"
                            placeholder="07xx xxx xxx"
                            className={`form-control ${errors.deliveryContactPhone ? 'is-invalid' : touchedFields.deliveryContactPhone ? 'is-valid' : ''}`}
                            {...register('deliveryContactPhone', optionalPhoneRules)}
                          />
                          {errors.deliveryContactPhone && <div className="invalid-feedback d-block small">{errors.deliveryContactPhone.message}</div>}
                          {!errors.deliveryContactPhone && <div className="form-text small">Leave blank to use your main phone ({form.phone || 'N/A'}).</div>}
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small text-muted" htmlFor="checkout-contact-email">Contact email (optional)</label>
                          <input
                            id="checkout-contact-email"
                            type="email"
                            placeholder="name@example.com"
                            className={`form-control ${errors.deliveryContactEmail ? 'is-invalid' : touchedFields.deliveryContactEmail ? 'is-valid' : ''}`}
                            {...register('deliveryContactEmail', optionalEmailRules)}
                          />
                          {errors.deliveryContactEmail && <div className="invalid-feedback d-block small">{errors.deliveryContactEmail.message}</div>}
                        </div>
                        <div className="col-12">
                          <label className="form-label small text-muted" htmlFor="checkout-delivery-notes">Delivery instructions (optional)</label>
                          <textarea
                            id="checkout-delivery-notes"
                            rows={3}
                            placeholder="Gate code, drop-off notes, reach-out preference…"
                            className={`form-control ${errors.deliveryInstructions ? 'is-invalid' : touchedFields.deliveryInstructions ? 'is-valid' : ''}`}
                            {...register('deliveryInstructions', { maxLength: { value: 1000, message: 'Keep delivery notes under 1000 characters.' } })}
                          ></textarea>
                          {errors.deliveryInstructions && <div className="invalid-feedback d-block small">{errors.deliveryInstructions.message}</div>}
                        </div>
                      </div>
                    </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label mb-0">Choose a shop</label>
                      {deliveryState.distanceKm && Number.isFinite(deliveryState.distanceKm) && (
                        <span className="badge bg-light text-secondary fw-normal">Approx. {Number(deliveryState.distanceKm).toFixed(1)} km away</span>
                      )}
                    </div>
                    {deliveryShopsLoading && <p className="small text-muted mb-2">Finding shops near you…</p>}
                    {deliveryShopsError && (
                      <div className="alert alert-warning small" role="alert">{deliveryShopsError.message || 'Unable to load delivery shops.'}</div>
                    )}
                    {!deliveryShopsLoading && !deliveryShopsError && deliveryShops.length === 0 && (
                      <div className="alert alert-info small" role="status">No delivery shops are available for that location yet. Try a different estate or choose pickup.</div>
                    )}
                    <div className="d-flex flex-column gap-2">
                      {deliveryShops.map((shop) => {
                        const shopId = shop.id ?? shop.shopId;
                        const selected = String(selectedShopId) === String(shopId);
                        const distance = coerceNumber(shop.distanceKm ?? shop.distance_km ?? shop.distance ?? shop.metrics?.distanceKm);
                        const timing = coerceNumber(shop.etaMinutes ?? shop.estimatedMinutes ?? shop.eta_minutes);
                        const label = shop.displayName ?? shop.name ?? shop.label ?? `Shop ${shopId}`;
                        const subtitle = shop.addressLine ?? shop.address ?? shop.locationLabel ?? shop.city ?? null;
                        return (
                          <button
                            key={shopId ?? label}
                            type="button"
                            className={`btn btn-light border text-start w-100 d-flex justify-content-between align-items-start gap-2 ${selected ? 'border-success shadow-sm' : ''}`}
                            onClick={() => handleShopSelect(shop)}
                          >
                            <span>
                              <span className="fw-semibold d-block">{label}</span>
                              {subtitle && <span className="small text-muted d-block">{subtitle}</span>}
                              {distance && (
                                <span className="badge rounded-pill bg-light text-secondary fw-normal mt-1">{distance.toFixed(1)} km</span>
                              )}
                            </span>
                            <span className="form-check">
                              <input className="form-check-input" type="radio" checked={selected} onChange={() => handleShopSelect(shop)} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label mb-1">Delivery estimate</label>
                    {deliveryQuoteLoading && <p className="small text-muted mb-0">Calculating delivery cost…</p>}
                    {deliveryQuoteError && <div className="alert alert-warning small" role="alert">{deliveryQuoteError.message || 'Could not calculate delivery cost.'}</div>}
                    {!deliveryQuoteLoading && !deliveryQuoteError && (
                      <div className="small text-muted">
                        <div>Delivery fee: <strong>{formatCurrency(Number.isFinite(deliveryFee) ? deliveryFee : 0)}</strong></div>
                        {deliveryState.estimatedMinutes && Number.isFinite(deliveryState.estimatedMinutes) && (
                          <div>ETA: about {Math.round(deliveryState.estimatedMinutes)} minutes after confirmation.</div>
                        )}
                        {!deliveryState.quote && <div>Select a location to get your delivery quote.</div>}
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="d-flex gap-2 flex-wrap">
                <button type="submit" className="btn btn-success flex-grow-1 flex-sm-grow-0">Continue</button>
                <button type="button" className="btn btn-outline-secondary flex-grow-1 flex-sm-grow-0" onClick={() => navigate('/cart')}>Back</button>
              </div>
            </form>
          )}
          {step === 2 && (
            <div>
              <h2 className="h5 mb-2">Payment</h2>
              <p className="text-muted small mb-2">Choose how you’d like to pay for this order.</p>
              <fieldset className="border rounded p-3 mb-3">
                <legend className="float-none w-auto px-2 text-uppercase small text-muted mb-0">Payment Method</legend>
                <div className="form-check mb-2">
                  <input className="form-check-input" type="radio" name="paymentMethod" id="pay-mobile" value="mobile-money" checked={payMethod==='mobile-money'} onChange={()=>handlePayMethodChange('mobile-money')} />
                  <label className="form-check-label fw-semibold" htmlFor="pay-mobile">Mobile Money</label>
                  <div className="form-text">Instant M-Pesa or Airtel STK push to your phone.</div>
                </div>
                <div className="form-check mb-2">
                  <input className="form-check-input" type="radio" name="paymentMethod" id="pay-cash" value="cash" checked={payMethod==='cash'} onChange={()=>handlePayMethodChange('cash')} />
                  <label className="form-check-label fw-semibold" htmlFor="pay-cash">Cash on Delivery</label>
                  <div className="form-text">Pay when your order arrives or at pickup.</div>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="paymentMethod" id="pay-card" value="card" checked={payMethod==='card'} onChange={()=>handlePayMethodChange('card')} />
                  <label className="form-check-label fw-semibold" htmlFor="pay-card">Card</label>
                  <div className="form-text">Pay with Visa or Mastercard (coming soon).</div>
                </div>
              </fieldset>

              {payMethod === 'mobile-money' && (
                <>
                  {optionsLoading && <p className="small text-muted">Loading options…</p>}
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {paymentOptions.map(opt => {
                      const b = paymentBranding[opt.provider] || { color:'#222', bg:'#eee' };
                      const subtitle = opt.shortDescription || summarizeInstructions(opt.instructionsMarkdown) || opt.channel;
                      return (
                        <button key={opt.id} type="button" onClick={()=>openOption(opt)} className="btn btn-light border position-relative" style={{minWidth:180, textAlign:'left'}}>
                          <span className="d-flex align-items-center gap-2">
                            <span style={{width:26,height:26,background:b.color,color:'#fff',borderRadius:6,fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{opt.provider[0]}</span>
                            <span className="d-flex flex-column">
                              <strong className="small mb-0" style={{color:b.color}}>{opt.displayName}</strong>
                              <span className="text-muted small" style={{lineHeight:1.1}}>{subtitle}</span>
                            </span>
                          </span>
                          {opt.supportsStk && <span className="badge bg-success position-absolute top-0 end-0 m-1" style={{fontSize:'0.6rem'}}>STK</span>}
                        </button>
                      );
                    })}
                    {paymentOptions.length===0 && !optionsLoading && (
                      <div className="alert alert-warning w-100 py-2 small">No payment options configured.</div>
                    )}
                  </div>
                  {mm.status==='pending' && <p className="small text-muted mt-2">Awaiting confirmation on your phone…</p>}
                  {modalPaymentState==='timeout' && <p className="small text-danger mt-2">Timed out waiting for confirmation. Try again.</p>}
                  {mm.error && <p className="small text-danger mt-2">{mm.error}</p>}
                </>
              )}

              {payMethod === 'cash' && (
                <div className="alert alert-success small">
                  We’ll prepare your order and you can pay in cash when it’s delivered or collected.
                </div>
              )}

              {payMethod === 'card' && (
                <div className="alert alert-info small">
                  Card payments are almost ready. In the meantime, please choose another payment method.
                </div>
              )}

              {/* Reconciliation moved inside modal for manual (non-STK) flows */}
              <div className="d-flex gap-2 flex-wrap mt-3">
                {payMethod === 'cash' && (
                  <button
                    type="button"
                    className="btn btn-success flex-grow-1 flex-sm-grow-0 d-flex align-items-center justify-content-center gap-2"
                    onClick={continueWithCash}
                    disabled={cashSubmitting}
                  >
                    {cashSubmitting && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                    <span>Continue</span>
                  </button>
                )}
                {payMethod === 'card' && (
                  <button type="button" className="btn btn-success flex-grow-1 flex-sm-grow-0" disabled>Continue</button>
                )}
                <button type="button" className="btn btn-outline-secondary flex-grow-1 flex-sm-grow-0" onClick={()=>setStep(1)}>Back</button>
              </div>
            </div>
          )}
          {step === 3 && !submitted && <p>Finalizing…</p>}
        </div>
        <div className="col-12 col-lg-5">
          <div className="border rounded p-3 bg-body">
            <h2 className="h6">Summary</h2>
            {!submitted && step !== 3 && (
              <CouponBox customerPhone={form.phone} className="mb-3" compact />
            )}
            {(() => {
              const snap = (orderSnapshot && Array.isArray(orderSnapshot.items)) ? orderSnapshot : { items, total: liveCartTotal };
              return (
                <ul className="list-unstyled small mb-2">
                  {(Array.isArray(snap.items) ? snap.items : items).map(i => {
                    const qty = Number.isFinite(Number(i.qty)) ? Number(i.qty) : 0;
                    const price = Number.isFinite(Number(i.price)) ? Number(i.price) : Number(i.unitPriceGross ?? i.unitPrice ?? 0);
                    const label = i.name ?? i.productName ?? `Item ${i.id ?? ''}`;
                    return (
                      <li key={i.id ?? `${label}-${qty}`} className="d-flex justify-content-between border-bottom py-1">
                        <span>{label} × {qty}</span>
                        <span>{formatCurrency(price * qty)}</span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            <div className="mt-3 small">
              <div className="d-flex justify-content-between">
                <span>Subtotal</span>
                <span>{formatCurrency(displaySubtotal)}</span>
              </div>
              {displayDiscount > 0 && (
                <div className="d-flex justify-content-between text-success fw-semibold mt-1">
                  <span>Coupon savings</span>
                  <span>-{formatCurrency(displayDiscount)}</span>
                </div>
              )}
              {shouldShowDeliveryFee && (
                <div className="d-flex justify-content-between mt-1">
                  <span>Delivery fee</span>
                  <span>{formatCurrency(Number.isFinite(snapshotDeliveryFee) ? snapshotDeliveryFee : 0)}</span>
                </div>
              )}
              <div className="d-flex justify-content-between fw-semibold mt-2">
                <span>Total due</span>
                <span>{formatCurrency(totalWithDelivery)}</span>
              </div>
              <p className="text-muted small mb-0 mt-1">Taxes included where applicable.</p>
            </div>
          </div>
        </div>
      </div>
        <PaymentOptionModal
          option={selectedOption}
          open={modalOpen}
          onClose={()=>setModalOpen(false)}
          onInitiate={initiateFromOption}
          onReconcile={async (phone, amountVal)=>{
            if (!selectedOption) return;
            const backendOrderId = orderSnapshot?.backendOrderId;
            if (!backendOrderId) { push('Create order first by starting payment', 'error'); return; }
            try {
              await mm.reconcile({ orderId: backendOrderId, provider: selectedOption.provider, phoneNumber: phone || undefined, amount: amountVal ? Number(amountVal) : undefined });
            } catch {/* handled in hook */}
          }}
          reconciling={modalPaymentState==='reconciling'}
          paymentStatus={effectivePaymentStatus}
          loading={modalPaymentState==='initiating'}
          paymentHookStatus={modalPaymentState}
          phone={modalPhone}
          setPhone={setModalPhone}
          accountRef={modalAccountRef}
          setAccountRef={setModalAccountRef}
          amount={formattedSnapshotTotal}
        />
      </section>
      <MapPickerModal
        open={mapPickerOpen}
        initialValue={mapInitialSelection}
        onClose={() => setMapPickerOpen(false)}
        onSelect={handleMapConfirm}
        title="Pin delivery location"
        confirmLabel="Use this location"
      />
    </>
  );
}
