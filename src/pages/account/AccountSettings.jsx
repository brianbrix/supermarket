import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const MAX_ADDRESSES = 5;

const DEFAULT_FORM = {
  themePreference: 'light',
  newsletter: true,
  orderUpdates: true,
  marketing: false,
  addresses: [],
};

function generateAddressId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AccountSettings() {
  const { theme, setTheme } = useTheme();
  const { push } = useToast();
  const { preferences, preferencesLoading, updatePreferences } = useAuth();
  const [form, setForm] = useState(() => ({ ...DEFAULT_FORM, themePreference: theme }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!preferences) return;
    setForm(prev => ({
      ...prev,
      themePreference: preferences.themePreference ?? prev.themePreference,
      newsletter: preferences.newsletter ?? prev.newsletter,
      orderUpdates: preferences.orderUpdates ?? prev.orderUpdates,
      marketing: preferences.marketing ?? prev.marketing,
      addresses: Array.isArray(preferences.addresses)
        ? preferences.addresses.map(address => ({ ...address }))
        : [],
    }));
  }, [preferences]);

  useEffect(() => {
    setForm(prev => (prev.themePreference === theme ? prev : { ...prev, themePreference: theme }));
  }, [theme]);

  const isBusy = useMemo(() => saving || preferencesLoading, [saving, preferencesLoading]);

  function handleChange(e) {
    const { name, type, checked, value } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'themePreference') {
      setTheme(value, 'user');
    }
  }

  function handleAddressFieldChange(index, field, value) {
    setForm(prev => {
      const addresses = [...prev.addresses];
      addresses[index] = { ...addresses[index], [field]: value };
      return { ...prev, addresses };
    });
  }

  function handleAddAddress() {
    setForm(prev => {
      if (prev.addresses.length >= MAX_ADDRESSES) return prev;
      return {
        ...prev,
        addresses: [
          ...prev.addresses,
          {
            id: generateAddressId(),
            label: `Address ${prev.addresses.length + 1}`,
            details: '',
          },
        ],
      };
    });
  }

  function handleRemoveAddress(id) {
    setForm(prev => ({
      ...prev,
      addresses: prev.addresses.filter(address => address.id !== id),
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const sanitizedAddresses = form.addresses
        .map(address => ({
          id: address.id || generateAddressId(),
          label: (address.label || '').trim() || 'Saved address',
          details: (address.details || '').trim(),
        }))
        .filter(address => address.details.length > 0)
        .slice(0, MAX_ADDRESSES);

      const saved = await updatePreferences({
        themePreference: form.themePreference,
        newsletter: form.newsletter,
        orderUpdates: form.orderUpdates,
        marketing: form.marketing,
        addresses: sanitizedAddresses,
      });
      setForm({
        ...saved,
        addresses: Array.isArray(saved.addresses) ? saved.addresses.map(address => ({ ...address })) : [],
      });
  setTheme(saved.themePreference, 'user');
      push('Account preferences saved', 'info');
    } catch (err) {
      push(err?.message || 'Unable to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (preferences) {
      setForm({
        ...preferences,
        addresses: Array.isArray(preferences.addresses) ? preferences.addresses.map(address => ({ ...address })) : [],
      });
      return;
    }
    setForm({ ...DEFAULT_FORM, themePreference: theme });
  }

  const canAddAddress = form.addresses.length < MAX_ADDRESSES;

  return (
    <form className="card border-0 shadow-sm" onSubmit={handleSave}>
      <div className="card-body d-flex flex-column gap-4">
        <div>
          <h2 className="h5 mb-2">Appearance</h2>
          <p className="text-muted small mb-3">Choose how the supermarket looks when you use it.</p>
          <div className="d-flex flex-column flex-md-row gap-3">
            <label className={`border rounded-3 p-3 flex-fill cursor-pointer position-relative${form.themePreference === 'light' ? ' border-success' : ' border-transparent'}`}>
              <input disabled={isBusy} type="radio" name="themePreference" value="light" className="form-check-input position-absolute top-0 end-0 m-3" checked={form.themePreference === 'light'} onChange={handleChange} />
              <div className="fw-semibold mb-1">Light</div>
              <p className="text-muted small mb-0">Bright and clear with crisp surfaces.</p>
            </label>
            <label className={`border rounded-3 p-3 flex-fill cursor-pointer position-relative${form.themePreference === 'dark' ? ' border-success' : ' border-transparent'}`}>
              <input disabled={isBusy} type="radio" name="themePreference" value="dark" className="form-check-input position-absolute top-0 end-0 m-3" checked={form.themePreference === 'dark'} onChange={handleChange} />
              <div className="fw-semibold mb-1">Dark</div>
              <p className="text-muted small mb-0">Dim environment that’s easier on the eyes at night.</p>
            </label>
          </div>
        </div>

        <div>
          <h2 className="h5 mb-2">Notifications</h2>
          <p className="text-muted small mb-3">Stay up to date with order and promotion alerts.</p>
          <div className="list-group">
            <label className="list-group-item d-flex justify-content-between align-items-center">
              <span>
                <div className="fw-semibold">Order status updates</div>
                <div className="small text-muted">Be notified when your order status changes.</div>
              </span>
              <div className="form-check form-switch mb-0">
                <input disabled={isBusy} className="form-check-input" type="checkbox" name="orderUpdates" checked={form.orderUpdates} onChange={handleChange} />
              </div>
            </label>
            <label className="list-group-item d-flex justify-content-between align-items-center">
              <span>
                <div className="fw-semibold">News & promotions</div>
                <div className="small text-muted">Get early access to deals and recipes.</div>
              </span>
              <div className="form-check form-switch mb-0">
                <input disabled={isBusy} className="form-check-input" type="checkbox" name="marketing" checked={form.marketing} onChange={handleChange} />
              </div>
            </label>
            <label className="list-group-item d-flex justify-content-between align-items-center">
              <span>
                <div className="fw-semibold">Weekly newsletter</div>
                <div className="small text-muted">Fresh recipes and offers delivered weekly.</div>
              </span>
              <div className="form-check form-switch mb-0">
                <input disabled={isBusy} className="form-check-input" type="checkbox" name="newsletter" checked={form.newsletter} onChange={handleChange} />
              </div>
            </label>
          </div>
        </div>

        <div>
          <h2 className="h5 mb-2">Delivery addresses</h2>
          <p className="text-muted small mb-3">Save up to five delivery addresses to reuse during checkout.</p>
          <div className="d-flex flex-column gap-3">
            {form.addresses.length === 0 && (
              <p className="text-muted small mb-0">You haven’t saved any delivery addresses yet. Add your home or office for faster ordering.</p>
            )}
            {form.addresses.map((address, index) => (
              <div key={address.id} className="border rounded p-3 position-relative">
                <div className="d-flex flex-column flex-md-row gap-3">
                  <div className="flex-fill">
                    <label className="form-label small text-muted" htmlFor={`address-label-${address.id}`}>Label</label>
                    <input
                      id={`address-label-${address.id}`}
                      type="text"
                      className="form-control form-control-sm"
                      disabled={isBusy}
                      value={address.label}
                      onChange={(e) => handleAddressFieldChange(index, 'label', e.target.value)}
                    />
                  </div>
                  <div className="flex-fill">
                    <label className="form-label small text-muted" htmlFor={`address-details-${address.id}`}>Address details</label>
                    <textarea
                      id={`address-details-${address.id}`}
                      className="form-control form-control-sm"
                      rows={3}
                      disabled={isBusy}
                      value={address.details}
                      onChange={(e) => handleAddressFieldChange(index, 'details', e.target.value)}
                    ></textarea>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm position-absolute top-0 end-0 mt-2 me-2"
                  onClick={() => handleRemoveAddress(address.id)}
                  disabled={isBusy}
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleAddAddress} disabled={!canAddAddress || isBusy}>
                Add address
              </button>
              <span className="small text-muted align-self-center">{form.addresses.length}/{MAX_ADDRESSES} saved</span>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={isBusy}
            onClick={handleReset}
          >
            Reset
          </button>
          <button type="submit" className="btn btn-success" disabled={isBusy}>
            {saving && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
            Save changes
          </button>
        </div>
      </div>
    </form>
  );
}
