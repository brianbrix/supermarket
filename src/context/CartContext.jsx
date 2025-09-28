import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from './ToastContext.jsx';
import { api } from '../services/api.js';

const COUPON_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem('cart');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [hasBackup, setHasBackup] = useState(() => {
    try { return !!localStorage.getItem('cart_backup'); } catch { return false; }
  });
  const [couponState, setCouponState] = useState(() => {
    try {
      const raw = localStorage.getItem('cart_coupon');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.code) return null;
      return {
        code: parsed.code,
        details: parsed.details || null,
        discountAmount: Number.isFinite(Number(parsed.discountAmount)) ? Number(parsed.discountAmount) : 0,
        totalAfterDiscount: Number.isFinite(Number(parsed.totalAfterDiscount)) ? Number(parsed.totalAfterDiscount) : null,
        appliedCartTotal: Number.isFinite(Number(parsed.appliedCartTotal)) ? Number(parsed.appliedCartTotal) : null,
        cartSignature: parsed.cartSignature || null,
        updatedAt: parsed.updatedAt || Date.now()
      };
    } catch {
      return null;
    }
  });
  const [couponStatus, setCouponStatus] = useState('idle');
  const [couponError, setCouponError] = useState(null);
  const initialRefreshDone = useRef(false);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const { push } = useToast();

  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0), [items]);
  const cartSignature = useMemo(() => {
    if (!items.length) return '';
    return items
      .map(item => `${item.id ?? 'unknown'}:${item.qty}`)
      .sort()
      .join('|');
  }, [items]);

  const clampCurrency = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric * 100) / 100;
  }, []);

  const persistCoupon = useCallback((state) => {
    try {
      if (state && state.code) {
        localStorage.setItem('cart_coupon', JSON.stringify({
          code: state.code,
          details: state.details || null,
          discountAmount: clampCurrency(state.discountAmount ?? 0),
          totalAfterDiscount: clampCurrency(state.totalAfterDiscount ?? 0),
          appliedCartTotal: clampCurrency(state.appliedCartTotal ?? 0),
          cartSignature: state.cartSignature || null,
          updatedAt: state.updatedAt || Date.now()
        }));
      } else {
        localStorage.removeItem('cart_coupon');
      }
    } catch {}
  }, [clampCurrency]);

  const clearCoupon = useCallback(() => {
    setCouponState(null);
    setCouponStatus('idle');
    setCouponError(null);
    persistCoupon(null);
  }, [persistCoupon]);

  const fetchCouponPreview = useCallback(async (code, { customerPhone, cartTotal } = {}) => {
    const payload = {
      code,
      cartTotal: cartTotal != null ? cartTotal : clampCurrency(subtotal)
    };
    if (customerPhone) payload.customerPhone = customerPhone;
    return api.coupons.preview(payload);
  }, [subtotal, clampCurrency]);

  const applyCoupon = useCallback(async (rawCode, { customerPhone } = {}) => {
    const normalized = (rawCode || '').trim().toUpperCase();
    if (!normalized) {
      const err = new Error('Enter a coupon code');
      setCouponError(err.message);
      throw err;
    }
    setCouponStatus('loading');
    setCouponError(null);
    try {
      const response = await fetchCouponPreview(normalized, { customerPhone });
      const discountRaw = Number(response?.discountAmount ?? 0);
      const clampedDiscount = Math.min(Math.max(discountRaw, 0), subtotal);
      const totalAfter = response?.totalAfterDiscount != null
        ? Math.max(0, Number(response.totalAfterDiscount))
        : subtotal - clampedDiscount;
      const next = {
        code: normalized,
        details: response?.coupon || null,
        discountAmount: clampCurrency(clampedDiscount),
        totalAfterDiscount: clampCurrency(totalAfter),
        appliedCartTotal: clampCurrency(subtotal),
        cartSignature,
        updatedAt: Date.now()
      };
      setCouponState(next);
      persistCoupon(next);
      return next;
    } catch (err) {
      setCouponError(err?.message || 'Coupon is not valid for this cart');
      throw err;
    } finally {
      setCouponStatus('idle');
    }
  }, [fetchCouponPreview, subtotal, cartSignature, clampCurrency, persistCoupon]);

  const refreshCoupon = useCallback(async ({ customerPhone, silent = false } = {}) => {
    if (!couponState?.code) return null;
    if (!silent) {
      setCouponStatus('refreshing');
      setCouponError(null);
    }
    try {
      const response = await fetchCouponPreview(couponState.code, { customerPhone, cartTotal: subtotal });
      const discountRaw = Number(response?.discountAmount ?? 0);
      const clampedDiscount = Math.min(Math.max(discountRaw, 0), subtotal);
      const totalAfter = response?.totalAfterDiscount != null
        ? Math.max(0, Number(response.totalAfterDiscount))
        : subtotal - clampedDiscount;
      const next = {
        code: couponState.code,
        details: response?.coupon || couponState.details || null,
        discountAmount: clampCurrency(clampedDiscount),
        totalAfterDiscount: clampCurrency(totalAfter),
        appliedCartTotal: clampCurrency(subtotal),
        cartSignature,
        updatedAt: Date.now()
      };
      setCouponState(next);
      persistCoupon(next);
      if (!silent) setCouponStatus('idle');
      setCouponError(null);
      return next;
    } catch (err) {
      if (!silent) setCouponError(err?.message || 'Coupon is no longer valid');
      clearCoupon();
      return null;
    } finally {
      if (!silent) setCouponStatus('idle');
    }
  }, [couponState, fetchCouponPreview, subtotal, cartSignature, clampCurrency, persistCoupon, clearCoupon]);

  useEffect(() => {
    if (!couponState?.code) return;
    const shouldRefresh = (() => {
      if (subtotal <= 0) return true;
      const delta = Math.abs((couponState.appliedCartTotal ?? 0) - subtotal);
      if (delta >= 0.02) return true;
      if (couponState.cartSignature !== cartSignature) return true;
      if (!initialRefreshDone.current) return true;
      const age = Date.now() - (couponState.updatedAt ?? 0);
      return age >= COUPON_REFRESH_INTERVAL_MS;
    })();
    if (!shouldRefresh) return;
    initialRefreshDone.current = true;
    refreshCoupon({ silent: true }).catch(() => {});
  }, [subtotal, cartSignature, couponState, refreshCoupon]);

  useEffect(() => {
    if (couponState?.code && subtotal <= 0) {
      clearCoupon();
    }
  }, [couponState?.code, subtotal, clearCoupon]);

  function addItem(product, quantity = 1) {
    let result = { added: false };
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      const max = product.stock != null ? product.stock : Infinity;
      if (max === 0) {
        result = { added: false, reason: 'out-of-stock' };
        return prev;
      }
      if (existing) {
        const newQty = Math.min(existing.qty + quantity, max);
        if (newQty === existing.qty) {
          result = { added: false, reason: 'max-stock' };
          return prev;
        }
        result = { added: true };
        return prev.map(i => i.id === product.id ? { ...i, qty: newQty, stock: max } : i);
      }
      const initialQty = Math.min(quantity, max);
      result = { added: true };
      return [...prev, { ...product, qty: initialQty, stock: max }];
    });
    return result;
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function updateQty(id, qty) {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const max = item.stock != null ? item.stock : Infinity;
      if (qty <= 0) return prev.filter(i => i.id !== id);
      const clamped = Math.min(qty, max);
      if (clamped < qty) push(`Only ${max} available`);
      return prev.map(i => i.id === id ? { ...i, qty: clamped } : i);
    });
  }

  function clearCart() { setItems([]); }

  function backupCart() {
    try {
      localStorage.setItem('cart_backup', JSON.stringify(items));
      setHasBackup(true);
    } catch {}
  }
  function restoreCart() {
    try {
      const raw = localStorage.getItem('cart_backup');
      if (raw) {
        const data = JSON.parse(raw);
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {}
  }
  function clearCartBackup() {
    try { localStorage.removeItem('cart_backup'); setHasBackup(false); } catch {}
  }

  const discount = useMemo(() => {
    if (!couponState?.code) return 0;
    const raw = Number(couponState.discountAmount);
    if (!Number.isFinite(raw)) return 0;
    return clampCurrency(Math.min(Math.max(raw, 0), subtotal));
  }, [couponState, subtotal, clampCurrency]);

  const total = useMemo(() => clampCurrency(Math.max(subtotal - discount, 0)), [subtotal, discount, clampCurrency]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        backupCart,
        restoreCart,
        clearCartBackup,
        hasCartBackup: hasBackup,
        subtotal,
        totalBeforeDiscount: subtotal,
        discount,
        total,
        count,
        coupon: couponState,
        couponStatus,
        couponError,
        applyCoupon,
        refreshCoupon,
        removeCoupon: clearCoupon
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
