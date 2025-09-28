import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useCurrencyFormatter } from '../context/SettingsContext.jsx';

export default function CouponBox({ customerPhone, className = '', compact = false }) {
  const {
    coupon,
    discount,
    subtotal,
    total,
    couponStatus,
    couponError,
    applyCoupon,
    removeCoupon
  } = useCart();
  const { push } = useToast();
  const formatCurrency = useCurrencyFormatter();
  const [code, setCode] = useState(coupon?.code || '');
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    setCode(coupon?.code || '');
    setLocalError(null);
  }, [coupon?.code]);

  useEffect(() => {
    if (couponError) {
      setLocalError(couponError);
    }
  }, [couponError]);

  const isProcessing = couponStatus === 'loading' || couponStatus === 'refreshing';
  const applied = Boolean(coupon?.code);
  const appliedLabel = coupon?.details?.name || coupon?.code || '';
  const discountDisplay = useMemo(() => {
    if (!discount) return null;
    return formatCurrency(discount);
  }, [discount, formatCurrency]);
  const totalDisplay = useMemo(() => formatCurrency(total), [total, formatCurrency]);
  const subtotalDisplay = useMemo(() => formatCurrency(subtotal), [subtotal, formatCurrency]);

  async function handleApply(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setLocalError('Enter a coupon code');
      return;
    }
    setLocalError(null);
    try {
      await applyCoupon(trimmed, { customerPhone });
      push('Coupon applied', 'success');
    } catch (err) {
      setLocalError(err?.message || 'Coupon not valid for this cart');
    }
  }

  function handleRemove() {
    removeCoupon();
    setCode('');
    setLocalError(null);
    push('Coupon removed', 'info');
  }

  return (
    <div className={`coupon-box border rounded ${compact ? 'p-2' : 'p-3'} bg-body ${className}`.trim()}>
      <form onSubmit={handleApply} className="d-flex flex-column gap-2">
        <label className="form-label fw-semibold mb-0">Coupon code</label>
        <div className="input-group">
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            className="form-control"
            placeholder="SAVE10"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={isProcessing}
            aria-label="Coupon code"
          />
          <button type="submit" className="btn btn-success" disabled={isProcessing}>
            {isProcessing ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              'Apply'
            )}
          </button>
          {applied && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleRemove}
              disabled={isProcessing}
            >
              Remove
            </button>
          )}
        </div>
        {localError && <div className="text-danger small" role="alert">{localError}</div>}
      </form>

      <div className="mt-2 small text-muted">
        <div className="d-flex justify-content-between">
          <span>Subtotal</span>
          <span>{subtotalDisplay}</span>
        </div>
        {discount > 0 && (
          <div className="d-flex justify-content-between text-success fw-semibold">
            <span>Coupon savings</span>
            <span>-{discountDisplay}</span>
          </div>
        )}
        <div className="d-flex justify-content-between fw-semibold mt-1">
          <span>Total due</span>
          <span>{totalDisplay}</span>
        </div>
      </div>

      {applied && (
        <div className="alert alert-success small mt-3 mb-0" role="status">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div className="fw-semibold">{appliedLabel}</div>
              {coupon?.details?.description && (
                <div className="text-muted">{coupon.details.description}</div>
              )}
            </div>
            {discountDisplay && <span className="fw-semibold">-{discountDisplay}</span>}
          </div>
        </div>
      )}

      {couponStatus === 'refreshing' && (
        <p className="text-muted small mt-2 mb-0">Rechecking coupon against your cart…</p>
      )}
    </div>
  );
}
