import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const DEFAULT_FORM = {
  storeName: 'Supermarket',
  currencyCode: 'KES',
  currencySymbol: 'KES',
  currencyLocale: 'en-KE',
  defaultTheme: 'light',
  enableDarkMode: true,
  deliveryBaseFee: 150,
  deliveryPerKmFee: 35,
  deliveryMinFee: 120,
  deliveryFreeAbove: 5000,
  deliveryRoundingStep: 10,
  deliveryDefaultRadius: 15,
  deliveryMaxFeeRatio: 0.6,
  deliveryMaxFeeAbsolute: 800,
  deliveryLowOrderThreshold: 2000,
  deliveryLowOrderFactor: 0.65,
  deliveryCapToCart: true,
};

const KEY_MAP = {
  storeName: 'store.name',
  currencyCode: 'currency.code',
  currencySymbol: 'currency.symbol',
  currencyLocale: 'currency.locale',
  defaultTheme: 'theme.default',
  enableDarkMode: 'theme.enableDarkMode',
  deliveryBaseFee: 'delivery.base_fee',
  deliveryPerKmFee: 'delivery.per_km_fee',
  deliveryMinFee: 'delivery.min_fee',
  deliveryFreeAbove: 'delivery.free_above',
  deliveryRoundingStep: 'delivery.rounding.step',
  deliveryDefaultRadius: 'delivery.default_radius_km',
  deliveryMaxFeeRatio: 'delivery.max_fee_ratio',
  deliveryMaxFeeAbsolute: 'delivery.max_fee_absolute',
  deliveryLowOrderThreshold: 'delivery.low_order_subsidy_threshold',
  deliveryLowOrderFactor: 'delivery.low_order_subsidy_factor',
  deliveryCapToCart: 'delivery.cap_to_cart_total',
};

const FIELD_TYPES = {
  storeName: 'string',
  currencyCode: 'string',
  currencySymbol: 'string',
  currencyLocale: 'string',
  defaultTheme: 'string',
  enableDarkMode: 'boolean',
  deliveryBaseFee: 'number',
  deliveryPerKmFee: 'number',
  deliveryMinFee: 'number',
  deliveryFreeAbove: 'number',
  deliveryRoundingStep: 'number',
  deliveryDefaultRadius: 'number',
  deliveryMaxFeeRatio: 'number',
  deliveryMaxFeeAbsolute: 'number',
  deliveryLowOrderThreshold: 'number',
  deliveryLowOrderFactor: 'number',
  deliveryCapToCart: 'boolean',
};

export default function AdminSystemSettings() {
  const { push } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.admin.systemSettings.list()
      .then(settings => {
        if (!active) return;
        const mapped = applySettingsToForm(settings);
        setForm(prev => ({ ...prev, ...mapped }));
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || 'Failed to load system settings');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const previewCurrency = useMemo(() => {
    try {
      return new Intl.NumberFormat(form.currencyLocale || 'en-KE', { style: 'currency', currency: form.currencyCode || 'KES' }).format(1250.5);
    } catch (e) {
      return `${form.currencySymbol || form.currencyCode || 'KES'} 1,250.50`;
    }
  }, [form.currencyCode, form.currencyLocale, form.currencySymbol]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const fieldType = FIELD_TYPES[name] ?? (type === 'checkbox' ? 'boolean' : 'string');

    setForm(prev => {
      if (fieldType === 'boolean') {
        return { ...prev, [name]: type === 'checkbox' ? checked : value === 'true' };
      }
      if (fieldType === 'number') {
        if (value === '') {
          return { ...prev, [name]: '' };
        }
        const numeric = Number(value);
        return { ...prev, [name]: Number.isFinite(numeric) ? numeric : prev[name] };
      }
      return { ...prev, [name]: value };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = formToPayload(form);
    api.admin.systemSettings.save(payload)
      .then(() => {
        setSaving(false);
        push('System settings updated', 'info');
      })
      .catch(err => {
        setSaving(false);
        setError(err.message || 'Could not save settings');
      });
  }

  return (
    <section className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">System Settings</h1>
          <p className="text-muted mb-0">Update global preferences that affect the storefront experience.</p>
        </div>
      </div>
      <div className="card border-0 shadow-sm">
        <form onSubmit={handleSubmit} className="card-body d-flex flex-column gap-4">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <fieldset disabled={loading || saving} className="d-flex flex-column gap-4">
            <section>
              <h2 className="h5 mb-2">Store identity</h2>
              <p className="text-muted small mb-3">Shown in the navigation bar, emails and invoices.</p>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="storeName">Store name</label>
                  <input id="storeName" name="storeName" type="text" className="form-control" value={form.storeName} onChange={handleChange} required />
                </div>
              </div>
            </section>

            <section>
              <h2 className="h5 mb-2">Currency</h2>
              <p className="text-muted small mb-3">Controls how amounts are displayed across the app.</p>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="currencyCode">Currency code</label>
                  <input id="currencyCode" name="currencyCode" type="text" className="form-control" value={form.currencyCode} onChange={handleChange} required maxLength={8} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="currencySymbol">Currency symbol</label>
                  <input id="currencySymbol" name="currencySymbol" type="text" className="form-control" value={form.currencySymbol} onChange={handleChange} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="currencyLocale">Locale</label>
                  <input id="currencyLocale" name="currencyLocale" type="text" className="form-control" value={form.currencyLocale} onChange={handleChange} placeholder="e.g. en-KE" />
                </div>
              </div>
              <p className="small text-muted mt-2 mb-0">Preview: <strong>{previewCurrency}</strong></p>
            </section>

            <section>
              <h2 className="h5 mb-2">Theme</h2>
              <p className="text-muted small mb-3">Set the default appearance for new visitors.</p>
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="defaultTheme">Default theme</label>
                  <select id="defaultTheme" name="defaultTheme" className="form-select" value={form.defaultTheme} onChange={handleChange}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <div className="form-check form-switch mt-4">
                    <input className="form-check-input" type="checkbox" id="enableDarkMode" name="enableDarkMode" checked={form.enableDarkMode} onChange={handleChange} />
                    <label className="form-check-label" htmlFor="enableDarkMode">Allow users to toggle dark mode</label>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="h5 mb-2">Delivery pricing</h2>
              <p className="text-muted small mb-3">Tune how we blend distance, basket value, and caps to keep delivery fees fair and predictable.</p>
              <div className="row g-3">
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryBaseFee">Base fee</label>
                  <div className="input-group">
                    <span className="input-group-text">{form.currencySymbol || form.currencyCode}</span>
                    <input id="deliveryBaseFee" name="deliveryBaseFee" type="number" min={0} step={5} className="form-control" value={form.deliveryBaseFee ?? ''} onChange={handleChange} required />
                  </div>
                  <p className="form-text small">Starting charge before distance and subsidies.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryPerKmFee">Per km fee</label>
                  <div className="input-group">
                    <span className="input-group-text">{form.currencySymbol || form.currencyCode}</span>
                    <input id="deliveryPerKmFee" name="deliveryPerKmFee" type="number" min={0} step={1} className="form-control" value={form.deliveryPerKmFee ?? ''} onChange={handleChange} required />
                    <span className="input-group-text">/km</span>
                  </div>
                  <p className="form-text small">Multiplier applied to the straight-line distance.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryMinFee">Minimum fee</label>
                  <div className="input-group">
                    <span className="input-group-text">{form.currencySymbol || form.currencyCode}</span>
                    <input id="deliveryMinFee" name="deliveryMinFee" type="number" min={0} step={5} className="form-control" value={form.deliveryMinFee ?? ''} onChange={handleChange} required />
                  </div>
                  <p className="form-text small">We never charge less than this unless a cap is lower.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryFreeAbove">Free above</label>
                  <div className="input-group">
                    <span className="input-group-text">{form.currencySymbol || form.currencyCode}</span>
                    <input id="deliveryFreeAbove" name="deliveryFreeAbove" type="number" min={0} step={50} className="form-control" value={form.deliveryFreeAbove ?? ''} onChange={handleChange} />
                  </div>
                  <p className="form-text small">Basket total that unlocks free delivery. Leave 0 to disable.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryRoundingStep">Rounding step</label>
                  <input id="deliveryRoundingStep" name="deliveryRoundingStep" type="number" min={1} step={1} className="form-control" value={form.deliveryRoundingStep ?? ''} onChange={handleChange} required />
                  <p className="form-text small">Fees are rounded up to this increment.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryDefaultRadius">Default service radius (km)</label>
                  <input id="deliveryDefaultRadius" name="deliveryDefaultRadius" type="number" min={0} step={1} className="form-control" value={form.deliveryDefaultRadius ?? ''} onChange={handleChange} required />
                  <p className="form-text small">Used when a shop does not define its own radius.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryMaxFeeRatio">Max fee as % of cart</label>
                  <div className="input-group">
                    <input id="deliveryMaxFeeRatio" name="deliveryMaxFeeRatio" type="number" min={0} max={1} step={0.05} className="form-control" value={form.deliveryMaxFeeRatio ?? ''} onChange={handleChange} />
                    <span className="input-group-text">× cart total</span>
                  </div>
                  <p className="form-text small">Keeps delivery below a percentage of the basket (e.g. 0.6 = 60%).</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryMaxFeeAbsolute">Hard fee ceiling</label>
                  <div className="input-group">
                    <span className="input-group-text">{form.currencySymbol || form.currencyCode}</span>
                    <input id="deliveryMaxFeeAbsolute" name="deliveryMaxFeeAbsolute" type="number" min={0} step={10} className="form-control" value={form.deliveryMaxFeeAbsolute ?? ''} onChange={handleChange} />
                  </div>
                  <p className="form-text small">Absolute cap regardless of distance. Leave 0 to disable.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryLowOrderThreshold">Basket subsidy threshold</label>
                  <div className="input-group">
                    <span className="input-group-text">{form.currencySymbol || form.currencyCode}</span>
                    <input id="deliveryLowOrderThreshold" name="deliveryLowOrderThreshold" type="number" min={0} step={50} className="form-control" value={form.deliveryLowOrderThreshold ?? ''} onChange={handleChange} />
                  </div>
                  <p className="form-text small">Orders below this total receive a proportional discount.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="deliveryLowOrderFactor">Subsidy floor</label>
                  <div className="input-group">
                    <input id="deliveryLowOrderFactor" name="deliveryLowOrderFactor" type="number" min={0.1} max={1} step={0.05} className="form-control" value={form.deliveryLowOrderFactor ?? ''} onChange={handleChange} />
                    <span className="input-group-text">× base</span>
                  </div>
                  <p className="form-text small">Lowest multiplier applied to the distance cost when the basket is empty.</p>
                </div>
                <div className="col-12 col-lg-4">
                  <div className="form-check mt-4 pt-2">
                    <input className="form-check-input" type="checkbox" id="deliveryCapToCart" name="deliveryCapToCart" checked={!!form.deliveryCapToCart} onChange={handleChange} />
                    <label className="form-check-label" htmlFor="deliveryCapToCart">Never charge more than the order total</label>
                    <p className="form-text small mb-0">When enabled we clamp delivery fees to the basket value after other caps.</p>
                  </div>
                </div>
              </div>
            </section>
          </fieldset>
          <div className="d-flex justify-content-end gap-2">
            <button type="reset" className="btn btn-outline-secondary" onClick={() => setForm(DEFAULT_FORM)} disabled={loading || saving}>Reset</button>
            <button type="submit" className="btn btn-success" disabled={loading || saving}>
              {saving ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
              Save settings
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function applySettingsToForm(settings) {
  if (!Array.isArray(settings)) return {};
  const fieldByKey = Object.entries(KEY_MAP).reduce((acc, [field, key]) => {
    acc[key] = field;
    return acc;
  }, {});

  const map = {};
  for (const setting of settings) {
    const field = fieldByKey[setting.key];
    if (!field) continue;
    const fieldType = FIELD_TYPES[field] ?? 'string';
    const fallback = DEFAULT_FORM[field];
    const rawValue = Object.prototype.hasOwnProperty.call(setting, 'value') ? setting.value : fallback;

    let value = fallback;
    if (fieldType === 'number') {
      const numeric = Number(rawValue);
      value = Number.isFinite(numeric) ? numeric : Number(fallback ?? 0);
    } else if (fieldType === 'boolean') {
      if (typeof rawValue === 'boolean') {
        value = rawValue;
      } else if (typeof rawValue === 'number') {
        value = rawValue !== 0;
      } else if (typeof rawValue === 'string') {
        const normalized = rawValue.toLowerCase();
        value = ['true', '1', 'yes', 'on'].includes(normalized);
      } else {
        value = Boolean(rawValue);
      }
    } else {
      value = rawValue ?? fallback ?? '';
    }

    map[field] = value;
  }
  return map;
}

function formToPayload(form) {
  return Object.entries(KEY_MAP).map(([field, key]) => {
    const fieldType = FIELD_TYPES[field] ?? 'string';
    const fallback = DEFAULT_FORM[field];
    let value = form[field];

    if (fieldType === 'number') {
      if (value === '' || value === null || value === undefined) {
        value = Number(fallback ?? 0);
      } else {
        const numeric = Number(value);
        value = Number.isFinite(numeric) ? numeric : Number(fallback ?? 0);
      }
    } else if (fieldType === 'boolean') {
      value = Boolean(value);
    } else {
      value = value ?? '';
    }

    return {
      key,
      type: fieldType === 'number' ? 'number' : fieldType === 'boolean' ? 'boolean' : 'string',
      value,
    };
  });
}
