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
};

const KEY_MAP = {
  storeName: 'store.name',
  currencyCode: 'currency.code',
  currencySymbol: 'currency.symbol',
  currencyLocale: 'currency.locale',
  defaultTheme: 'theme.default',
  enableDarkMode: 'theme.enableDarkMode',
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
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
  const map = {};
  for (const setting of settings) {
    const key = Object.keys(KEY_MAP).find(k => KEY_MAP[k] === setting.key);
    if (key) {
      map[key] = setting.value ?? DEFAULT_FORM[key];
    }
  }
  return map;
}

function formToPayload(form) {
  return Object.entries(KEY_MAP).map(([field, key]) => ({
    key,
    type: typeof form[field] === 'boolean' ? 'boolean' : 'string',
    value: form[field],
  }));
}
