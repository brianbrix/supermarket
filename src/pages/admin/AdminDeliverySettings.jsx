import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCollapsibleSection from '../../components/admin/AdminCollapsibleSection.jsx';
import MapPickerModal from '../../components/MapPickerModal.jsx';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import {
  DEFAULT_DELIVERY_CONTENT,
  DEFAULT_DELIVERY_PRICING,
  DEFAULT_SUPPORT_CONTACT,
  normalizeDeliveryContent,
  createEmptyCoverageZone,
  createEmptyWindow,
  createEmptyHighlight,
  createEmptyProcessStep,
  createEmptyPackagingNote,
  createEmptyFaq,
} from '../../data/deliveryContent.js';

const PRICING_DEFAULTS = Object.freeze({
  deliveryBaseFee: DEFAULT_DELIVERY_PRICING.baseFee,
  deliveryPerKmFee: DEFAULT_DELIVERY_PRICING.perKmFee,
  deliveryMinFee: DEFAULT_DELIVERY_PRICING.minFee,
  deliveryFreeAbove: DEFAULT_DELIVERY_PRICING.freeAbove,
  deliveryRoundingStep: DEFAULT_DELIVERY_PRICING.roundingStep,
  deliveryDefaultRadius: DEFAULT_DELIVERY_PRICING.defaultRadiusKm,
  deliveryMaxFeeRatio: DEFAULT_DELIVERY_PRICING.maxFeeRatio,
  deliveryMaxFeeAbsolute: DEFAULT_DELIVERY_PRICING.maxFeeAbsolute,
  deliveryLowOrderThreshold: DEFAULT_DELIVERY_PRICING.lowOrderThreshold,
  deliveryLowOrderFactor: DEFAULT_DELIVERY_PRICING.lowOrderFactor,
  deliveryCapToCart: DEFAULT_DELIVERY_PRICING.capToCartTotal,
});

const KEY_MAP = {
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

function createDefaultForm() {
  return {
    supportEmail: DEFAULT_SUPPORT_CONTACT.email,
    supportPhone: DEFAULT_SUPPORT_CONTACT.phone,
    supportWhatsapp: DEFAULT_SUPPORT_CONTACT.whatsapp,
    ...PRICING_DEFAULTS,
    deliveryContent: normalizeDeliveryContent(DEFAULT_DELIVERY_CONTENT),
  };
}

export default function AdminDeliverySettings() {
  const { push } = useToast();
  const { settings } = useSettings();
  const [form, setForm] = useState(() => createDefaultForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [error, setError] = useState(null);
  const currencySymbol = settings?.currency?.symbol || settings?.currency?.code || 'KES';

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.admin.systemSettings.list()
      .then((settings) => {
        if (!active) return;
        const mapped = applySettingsToForm(settings);
        setForm(mapped);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Failed to load delivery settings');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const deliveryContent = useMemo(() => form.deliveryContent ?? normalizeDeliveryContent(DEFAULT_DELIVERY_CONTENT), [form.deliveryContent]);

  const handleFieldChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    const fieldType = FIELD_TYPES[name] ?? 'string';
    setForm((prev) => {
      if (fieldType === 'boolean') {
        return { ...prev, [name]: type === 'checkbox' ? checked : value === 'true' };
      }
      if (fieldType === 'number') {
        if (value === '') {
          return { ...prev, [name]: '' };
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          return prev;
        }
        return { ...prev, [name]: numeric };
      }
      return { ...prev, [name]: value };
    });
  }, []);

  const handleContentFieldChange = useCallback((field, nextValue) => {
    setForm((prev) => ({
      ...prev,
      deliveryContent: {
        ...normalizeDeliveryContent(prev.deliveryContent),
        [field]: field === 'baseFee' || field === 'freeDeliveryThreshold'
          ? (nextValue === '' ? '' : Number(nextValue))
          : nextValue,
      },
    }));
  }, []);

  const updateContentItem = useCallback((collection, index, updater) => {
    setForm((prev) => {
      const normalized = normalizeDeliveryContent(prev.deliveryContent);
      const items = normalized[collection] ?? [];
      if (!Array.isArray(items) || index < 0 || index >= items.length) {
        return prev;
      }
      const nextItems = items.map((item, idx) => {
        if (idx !== index) return item;
        const nextValue = typeof updater === 'function' ? updater(item) : { ...item, ...updater };
        return { ...item, ...nextValue };
      });
      return {
        ...prev,
        deliveryContent: {
          ...normalized,
          [collection]: nextItems,
        },
      };
    });
  }, []);

  const [zonePickerOpen, setZonePickerOpen] = useState(false);
  const [zonePickerIndex, setZonePickerIndex] = useState(null);

  const openZonePicker = useCallback((index) => {
    setZonePickerIndex(index);
    setZonePickerOpen(true);
  }, []);

  const closeZonePicker = useCallback(() => {
    setZonePickerOpen(false);
    setZonePickerIndex(null);
  }, []);

  const handleZonePickerSelect = useCallback((selection) => {
    if (zonePickerIndex == null) {
      return;
    }
    const lat = Number.isFinite(selection?.lat) ? Number(selection.lat) : '';
    const lng = Number.isFinite(selection?.lng) ? Number(selection.lng) : '';
    updateContentItem('coverageZones', zonePickerIndex, {
      lat,
      lng,
      locationLabel: selection?.label ?? '',
      locationContext: selection?.context ?? '',
      placeId: selection?.placeId ?? '',
    });
    closeZonePicker();
  }, [zonePickerIndex, updateContentItem, closeZonePicker]);

  const activeZoneForPicker = zonePickerIndex != null
    ? (deliveryContent.coverageZones?.[zonePickerIndex] ?? null)
    : null;

  const zonePickerInitialValue = useMemo(() => {
    if (!activeZoneForPicker) return null;
    const parseNumeric = (value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const lat = parseNumeric(activeZoneForPicker.lat);
    const lng = parseNumeric(activeZoneForPicker.lng);
    return {
      label: activeZoneForPicker.locationLabel ?? '',
      context: activeZoneForPicker.locationContext ?? '',
      lat,
      lng,
      placeId: activeZoneForPicker.placeId ?? null,
    };
  }, [activeZoneForPicker]);

  const addContentItem = useCallback((collection) => {
    setForm((prev) => {
      const normalized = normalizeDeliveryContent(prev.deliveryContent);
      const factories = {
        coverageZones: createEmptyCoverageZone,
        windows: createEmptyWindow,
        highlights: createEmptyHighlight,
        processSteps: createEmptyProcessStep,
        packaging: createEmptyPackagingNote,
        faqs: createEmptyFaq,
      };
      const factory = factories[collection];
      if (!factory) return prev;
      const nextItems = [...(normalized[collection] ?? []), factory()];
      return {
        ...prev,
        deliveryContent: {
          ...normalized,
          [collection]: nextItems,
        },
      };
    });
  }, []);

  const removeContentItem = useCallback((collection, index) => {
    setForm((prev) => {
      const normalized = normalizeDeliveryContent(prev.deliveryContent);
      const items = normalized[collection] ?? [];
      if (!Array.isArray(items) || items.length === 0) return prev;
      const nextItems = items.filter((_, idx) => idx !== index);
      return {
        ...prev,
        deliveryContent: {
          ...normalized,
          [collection]: nextItems,
        },
      };
    });
  }, []);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const payload = formToPayload(form);
    api.admin.systemSettings.save(payload)
      .then(() => {
        setSaving(false);
        push('Delivery settings updated', 'success');
      })
      .catch((err) => {
        setSaving(false);
        setError(err?.message || 'Could not save delivery settings');
      });
  }, [form, push, saving]);

  const handleRefreshCache = useCallback(() => {
    if (refreshingCache) return;
    setRefreshingCache(true);
    setError(null);
    const refresher = api?.admin?.systemSettings?.refreshCache;
    const promise = typeof refresher === 'function'
      ? refresher()
      : Promise.reject(new Error('Cache refresh API unavailable'));

    promise
      .then(() => {
        push('Application cache refreshed successfully.', 'success');
      })
      .catch((err) => {
        const message = err?.message || 'Failed to refresh cache';
        setError(message);
        push(message, 'danger');
      })
      .finally(() => {
        setRefreshingCache(false);
      });
  }, [push, refreshingCache]);

  const handleReset = useCallback(() => {
    setForm(createDefaultForm());
  }, []);

  return (
    <section className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">Delivery settings</h1>
          <p className="text-muted mb-0">Manage dispatch pricing, windows, coverage, and support contact details.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
          onClick={handleRefreshCache}
          disabled={refreshingCache || loading || saving}
        >
          {refreshingCache ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span>Refreshing…</span>
            </>
          ) : (
            <>
              <i className="bi bi-arrow-repeat"></i>
              <span>Refresh cache</span>
            </>
          )}
        </button>
      </div>
      <div className="card border-0 shadow-sm">
        <form onSubmit={handleSubmit} className="card-body d-flex flex-column gap-4">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <fieldset disabled={loading || saving} className="d-flex flex-column gap-4">
            <AdminCollapsibleSection
              title="Support contacts"
              description="Used on the customer delivery page and checkout confirmations."
              rememberState
              persistKey="admin:delivery-settings:support"
            >
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="supportEmail">Support email</label>
                  <input
                    id="supportEmail"
                    name="supportEmail"
                    type="email"
                    className="form-control"
                    value={form.supportEmail}
                    onChange={handleFieldChange}
                    placeholder="dispatch@example.com"
                  />
                  <p className="form-text small">Displayed alongside delivery CTA buttons.</p>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="supportPhone">Support phone</label>
                  <input
                    id="supportPhone"
                    name="supportPhone"
                    type="tel"
                    className="form-control"
                    value={form.supportPhone}
                    onChange={handleFieldChange}
                    placeholder="2547XXXXXXXX"
                  />
                  <p className="form-text small">Shown as the “Call dispatch” action. Include country code.</p>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="supportWhatsapp">WhatsApp number</label>
                  <input
                    id="supportWhatsapp"
                    name="supportWhatsapp"
                    type="tel"
                    className="form-control"
                    value={form.supportWhatsapp}
                    onChange={handleFieldChange}
                    placeholder="2547XXXXXXXX"
                  />
                  <p className="form-text small">Used for the WhatsApp quick link. Stored without the leading + sign.</p>
                </div>
              </div>
            </AdminCollapsibleSection>

            <AdminCollapsibleSection
              title="Delivery pricing"
              description="Blend distance, basket value, caps, and subsidies for a fair delivery fee."
              rememberState
              persistKey="admin:delivery-settings:pricing"
            >
              <div className="row g-3">
                {renderNumberInput('deliveryBaseFee', 'Base fee', form, handleFieldChange, currencySymbol, {
                  step: 5,
                  allowZero: true,
                  help: 'Starting charge before distance and subsidies.',
                })}
                {renderNumberInput('deliveryPerKmFee', 'Per km fee', form, handleFieldChange, currencySymbol, {
                  append: '/km',
                  step: 1,
                  allowZero: true,
                  help: 'Multiplier applied to the straight-line distance.',
                })}
                {renderNumberInput('deliveryMinFee', 'Minimum fee', form, handleFieldChange, currencySymbol, {
                  step: 5,
                  allowZero: true,
                  help: 'We never charge less than this unless a cap is lower.',
                })}
                {renderNumberInput('deliveryFreeAbove', 'Free above', form, handleFieldChange, currencySymbol, {
                  step: 50,
                  allowZero: true,
                  help: 'Basket total that unlocks free delivery. Leave 0 to disable.',
                })}
                {renderNumberInput('deliveryRoundingStep', 'Rounding step', form, handleFieldChange, currencySymbol, {
                  noCurrency: true,
                  step: 1,
                  min: 1,
                  help: 'Fees are rounded up to this increment.',
                })}
                {renderNumberInput('deliveryDefaultRadius', 'Default service radius (km)', form, handleFieldChange, currencySymbol, {
                  noCurrency: true,
                  step: 1,
                  allowZero: true,
                  help: 'Used when a shop does not define its own radius.',
                })}
                {renderNumberInput('deliveryMaxFeeRatio', 'Max fee as % of cart', form, handleFieldChange, currencySymbol, {
                  append: '× cart total',
                  noCurrency: true,
                  step: 0.05,
                  allowZero: true,
                  min: 0,
                  max: 1,
                  help: 'Keeps delivery below a percentage of the basket (e.g. 0.6 = 60%).',
                })}
                {renderNumberInput('deliveryMaxFeeAbsolute', 'Hard fee ceiling', form, handleFieldChange, currencySymbol, {
                  step: 10,
                  allowZero: true,
                  help: 'Absolute cap regardless of distance. Leave 0 to disable.',
                })}
                {renderNumberInput('deliveryLowOrderThreshold', 'Basket subsidy threshold', form, handleFieldChange, currencySymbol, {
                  step: 50,
                  allowZero: true,
                  help: 'Orders below this total receive a proportional discount.',
                })}
                {renderNumberInput('deliveryLowOrderFactor', 'Subsidy floor', form, handleFieldChange, currencySymbol, {
                  append: '× base',
                  noCurrency: true,
                  step: 0.05,
                  min: 0.1,
                  max: 1,
                  help: 'Lowest multiplier applied to the distance cost when the basket is empty.',
                })}
                <div className="col-12 col-lg-4">
                  <div className="form-check mt-4 pt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="deliveryCapToCart"
                      name="deliveryCapToCart"
                      checked={!!form.deliveryCapToCart}
                      onChange={handleFieldChange}
                    />
                    <label className="form-check-label" htmlFor="deliveryCapToCart">Never charge more than the order total</label>
                    <p className="form-text small mb-0">Clamps delivery to the basket value after other caps.</p>
                  </div>
                </div>
              </div>
            </AdminCollapsibleSection>

            <AdminCollapsibleSection
              title="Delivery story"
              description="Control the narrative shown on the customer delivery experience."
              rememberState
              persistKey="admin:delivery-settings:content"
            >
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="contentBaseFee">Marketing base fee</label>
                  <div className="input-group">
                    <span className="input-group-text">KES</span>
                    <input
                      id="contentBaseFee"
                      type="number"
                      className="form-control"
                      min={0}
                      step={1}
                      value={deliveryContent.baseFee ?? ''}
                      onChange={(event) => handleContentFieldChange('baseFee', event.target.value)}
                    />
                  </div>
                  <p className="form-text small">Shown across hero cards and FAQ copy. Does not override fee calculation.</p>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="contentFreeThreshold">Marketing free delivery threshold</label>
                  <div className="input-group">
                    <span className="input-group-text">KES</span>
                    <input
                      id="contentFreeThreshold"
                      type="number"
                      className="form-control"
                      min={0}
                      step={50}
                      value={deliveryContent.freeDeliveryThreshold ?? ''}
                      onChange={(event) => handleContentFieldChange('freeDeliveryThreshold', event.target.value)}
                    />
                  </div>
                  <p className="form-text small">Displayed on the delivery page badge and FAQ answers.</p>
                </div>
              </div>

              {renderCoverageZones(deliveryContent.coverageZones, updateContentItem, addContentItem, removeContentItem, openZonePicker)}
              {renderWindows(deliveryContent.windows, updateContentItem, addContentItem, removeContentItem)}
              {renderHighlights(deliveryContent.highlights, updateContentItem, addContentItem, removeContentItem)}
              {renderProcessSteps(deliveryContent.processSteps, updateContentItem, addContentItem, removeContentItem)}
              {renderPackaging(deliveryContent.packaging, updateContentItem, addContentItem, removeContentItem)}
              {renderFaqs(deliveryContent.faqs, updateContentItem, addContentItem, removeContentItem)}
            </AdminCollapsibleSection>
          </fieldset>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={handleReset} disabled={loading || saving}>Reset</button>
            <button type="submit" className="btn btn-success" disabled={loading || saving}>
              {saving ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
              Save delivery settings
            </button>
          </div>
        </form>
      </div>
      <MapPickerModal
        open={zonePickerOpen}
        initialValue={zonePickerInitialValue}
        onClose={closeZonePicker}
        onSelect={handleZonePickerSelect}
        title="Pin coverage zone center"
        confirmLabel="Use this location"
      />
    </section>
  );
}

function applySettingsToForm(settings) {
  const next = createDefaultForm();
  if (!Array.isArray(settings)) {
    return next;
  }
  const keyLookup = new Map(Object.entries(KEY_MAP).map(([field, key]) => [key, field]));

  settings.forEach((setting) => {
    if (!setting || typeof setting !== 'object') return;
    const field = keyLookup.get(setting.key);
    if (field) {
      const type = FIELD_TYPES[field] ?? 'string';
      if (type === 'number') {
        const numeric = Number(setting.value);
        next[field] = Number.isFinite(numeric) ? numeric : PRICING_DEFAULTS[field];
      } else if (type === 'boolean') {
        if (typeof setting.value === 'boolean') {
          next[field] = setting.value;
        } else if (typeof setting.value === 'number') {
          next[field] = setting.value !== 0;
        } else if (typeof setting.value === 'string') {
          const normalized = setting.value.toLowerCase();
          next[field] = ['true', '1', 'yes', 'on'].includes(normalized);
        }
      } else {
        next[field] = typeof setting.value === 'string' ? setting.value : next[field];
      }
      return;
    }

    if (setting.key === 'support.email') {
  next.supportEmail = typeof setting.value === 'string' ? setting.value : DEFAULT_SUPPORT_CONTACT.email;
    } else if (setting.key === 'support.phone') {
  next.supportPhone = typeof setting.value === 'string' ? setting.value : DEFAULT_SUPPORT_CONTACT.phone;
    } else if (setting.key === 'support.whatsapp') {
  next.supportWhatsapp = typeof setting.value === 'string' ? setting.value : DEFAULT_SUPPORT_CONTACT.whatsapp;
    } else if (setting.key === 'delivery.content') {
      next.deliveryContent = normalizeDeliveryContent(setting.value);
    }
  });

  next.supportEmail = next.supportEmail?.trim() || DEFAULT_SUPPORT_CONTACT.email;
  next.supportPhone = typeof next.supportPhone === 'string' ? next.supportPhone.trim() : DEFAULT_SUPPORT_CONTACT.phone;
  next.supportWhatsapp = next.supportWhatsapp?.trim() || DEFAULT_SUPPORT_CONTACT.whatsapp;

  return next;
}

function formToPayload(form) {
  const payload = Object.entries(KEY_MAP).map(([field, key]) => {
    const fieldType = FIELD_TYPES[field] ?? 'string';
    let value = form[field];
    if (fieldType === 'number') {
      if (value === '' || value == null) {
        value = PRICING_DEFAULTS[field] ?? 0;
      }
      const numeric = Number(value);
      value = Number.isFinite(numeric) ? numeric : PRICING_DEFAULTS[field] ?? 0;
    } else if (fieldType === 'boolean') {
      value = Boolean(value);
    } else {
      value = value ?? '';
    }
    return {
      key,
      type: fieldType,
      value,
    };
  });

  payload.push(
  { key: 'support.email', type: 'string', value: form.supportEmail ?? DEFAULT_SUPPORT_CONTACT.email },
  { key: 'support.phone', type: 'string', value: form.supportPhone ?? DEFAULT_SUPPORT_CONTACT.phone },
  { key: 'support.whatsapp', type: 'string', value: form.supportWhatsapp ?? DEFAULT_SUPPORT_CONTACT.whatsapp },
    {
      key: 'delivery.content',
      type: 'json',
      value: serializeDeliveryContent(form.deliveryContent),
    },
  );

  return payload;
}

function serializeDeliveryContent(raw) {
  const normalized = normalizeDeliveryContent(raw);
  const asNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };
  const toNullableNumber = (value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };
  return {
    baseFee: asNumber(normalized.baseFee, DEFAULT_DELIVERY_CONTENT.baseFee),
    freeDeliveryThreshold: asNumber(normalized.freeDeliveryThreshold, DEFAULT_DELIVERY_CONTENT.freeDeliveryThreshold),
    coverageZones: normalized.coverageZones.map((zone) => ({
      key: zone.key,
      name: zone.name,
      eta: zone.eta,
      notes: zone.notes,
      locationLabel: zone.locationLabel || '',
      locationContext: zone.locationContext || '',
      lat: toNullableNumber(zone.lat),
      lng: toNullableNumber(zone.lng),
      radiusKm: toNullableNumber(zone.radiusKm),
      placeId: zone.placeId || '',
    })),
    windows: normalized.windows.map((window) => ({
      key: window.key,
      label: window.label,
      timeLabel: window.timeLabel,
      startTime: window.startTime ?? null,
      endTime: window.endTime ?? null,
      cutoffTime: window.cutoffTime ?? null,
      details: window.details,
    })),
    highlights: normalized.highlights.map((item) => ({
      icon: item.icon,
      title: item.title,
      description: item.description,
    })),
    processSteps: normalized.processSteps.map((item) => ({
      step: item.step,
      headline: item.headline,
      copy: item.copy,
    })),
    packaging: normalized.packaging.map((item) => ({
      title: item.title,
      body: item.body,
    })),
    faqs: normalized.faqs.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
  };
}

function renderNumberInput(field, label, form, onChange, currencySymbol, options = {}) {
  const {
    append = null,
    noCurrency = false,
    step = 1,
    allowZero = false,
    min,
    max,
    help,
  } = options;
  const id = field;
  const value = form[field] ?? '';
  const minAttr = typeof min === 'number' ? min : (allowZero ? 0 : 1);
  return (
    <div className="col-12 col-sm-6 col-lg-4" key={field}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="input-group">
        {!noCurrency && (
          <span className="input-group-text">{currencySymbol || 'KES'}</span>
        )}
        <input
          id={id}
          name={field}
          type="number"
          className="form-control"
          min={minAttr}
          max={typeof max === 'number' ? max : undefined}
          step={step}
          value={value === '' ? '' : value}
          onChange={onChange}
        />
        {append && <span className="input-group-text">{append}</span>}
      </div>
      {help && <p className="form-text small mb-0">{help}</p>}
    </div>
  );
}

function renderCoverageZones(items, updateItem, addItem, removeItem, openMapPicker) {
  return (
    <div className="mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h6 mb-0">Coverage zones</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addItem('coverageZones')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Add zone
        </button>
      </div>
      <div className="row g-3">
        {items.map((zone, index) => {
          const key = zone.key || zone.name || `zone-${index}`;
          const latValue = zone.lat === '' || zone.lat === null || zone.lat === undefined ? null : Number(zone.lat);
          const lngValue = zone.lng === '' || zone.lng === null || zone.lng === undefined ? null : Number(zone.lng);
          const hasCoordinates = Number.isFinite(latValue) && Number.isFinite(lngValue);
          return (
            <div className="col-12 col-lg-6" key={key}>
              <div className="border rounded-3 p-3 h-100 bg-body-secondary bg-opacity-25 position-relative">
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`zone-${index}-name`}>Zone name</label>
                    <input
                      id={`zone-${index}-name`}
                      type="text"
                      className="form-control form-control-sm"
                      value={zone.name}
                      onChange={(event) => updateItem('coverageZones', index, { name: event.target.value })}
                      placeholder="e.g. Kilimani & Yaya"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small" htmlFor={`zone-${index}-eta`}>Typical ETA</label>
                    <input
                      id={`zone-${index}-eta`}
                      type="text"
                      className="form-control form-control-sm"
                      value={zone.eta}
                      onChange={(event) => updateItem('coverageZones', index, { eta: event.target.value })}
                      placeholder="1-2 hours"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small" htmlFor={`zone-${index}-key`}>Slug / key</label>
                    <input
                      id={`zone-${index}-key`}
                      type="text"
                      className="form-control form-control-sm"
                      value={zone.key}
                      onChange={(event) => updateItem('coverageZones', index, { key: event.target.value })}
                      placeholder="kilimani-yaya"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`zone-${index}-location-label`}>Location label</label>
                    <div className="input-group input-group-sm">
                      <input
                        id={`zone-${index}-location-label`}
                        type="text"
                        className="form-control"
                        value={zone.locationLabel ?? ''}
                        onChange={(event) => updateItem('coverageZones', index, { locationLabel: event.target.value })}
                        placeholder="e.g. Kilimani ring-road midpoint"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-success"
                        onClick={() => openMapPicker?.(index)}
                        aria-label="Pick zone center on map"
                      >
                        <i className="bi bi-map"></i>
                        <span className="d-none d-sm-inline ms-1">Map</span>
                      </button>
                      {hasCoordinates && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => updateItem('coverageZones', index, {
                            lat: '',
                            lng: '',
                            locationLabel: '',
                            locationContext: '',
                            placeId: '',
                          })}
                          aria-label="Clear coordinates"
                        >
                          <i className="bi bi-x-lg"></i>
                          <span className="d-none d-sm-inline ms-1">Clear</span>
                        </button>
                      )}
                    </div>
                    <p className="form-text small mb-2">
                      {hasCoordinates
                        ? `Lat ${latValue.toFixed(5)}, Lng ${lngValue.toFixed(5)}${zone.locationContext ? ` · ${zone.locationContext}` : ''}`
                        : 'Pin or search for a representative point within this zone.'}
                    </p>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small" htmlFor={`zone-${index}-lat`}>Latitude</label>
                    <input
                      id={`zone-${index}-lat`}
                      type="number"
                      step="0.000001"
                      className="form-control form-control-sm"
                      value={zone.lat ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateItem('coverageZones', index, { lat: value === '' ? '' : Number(value) });
                      }}
                      placeholder="-1.29210"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small" htmlFor={`zone-${index}-lng`}>Longitude</label>
                    <input
                      id={`zone-${index}-lng`}
                      type="number"
                      step="0.000001"
                      className="form-control form-control-sm"
                      value={zone.lng ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateItem('coverageZones', index, { lng: value === '' ? '' : Number(value) });
                      }}
                      placeholder="36.82190"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small" htmlFor={`zone-${index}-radius`}>Typical coverage radius (km)</label>
                    <input
                      id={`zone-${index}-radius`}
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-control form-control-sm"
                      value={zone.radiusKm ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateItem('coverageZones', index, { radiusKm: value === '' ? '' : Number(value) });
                      }}
                      placeholder="3"
                    />
                    <p className="form-text small mb-0">Used to estimate the farthest drop-off in this zone.</p>
                  </div>
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`zone-${index}-notes`}>Notes</label>
                    <textarea
                      id={`zone-${index}-notes`}
                      className="form-control form-control-sm"
                      rows={2}
                      value={zone.notes}
                      onChange={(event) => updateItem('coverageZones', index, { notes: event.target.value })}
                    ></textarea>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger position-absolute top-0 end-0 mt-2 me-2"
                  onClick={() => removeItem('coverageZones', index)}
                  aria-label={`Remove ${zone.name || 'zone'}`}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderWindows(items, updateItem, addItem, removeItem) {
  return (
    <div className="mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h6 mb-0">Delivery windows</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addItem('windows')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Add window
        </button>
      </div>
      <div className="row g-3">
        {items.map((window, index) => {
          const key = window.key || window.label || `window-${index}`;
          return (
            <div className="col-12 col-lg-6" key={key}>
              <div className="border rounded-3 p-3 h-100 bg-body-secondary bg-opacity-25 position-relative">
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`window-${index}-label`}>Label</label>
                    <input
                      id={`window-${index}-label`}
                      type="text"
                      className="form-control form-control-sm"
                      value={window.label}
                      onChange={(event) => updateItem('windows', index, { label: event.target.value })}
                      placeholder="Early bird"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small" htmlFor={`window-${index}-key`}>Slug / key</label>
                    <input
                      id={`window-${index}-key`}
                      type="text"
                      className="form-control form-control-sm"
                      value={window.key}
                      onChange={(event) => updateItem('windows', index, { key: event.target.value })}
                      placeholder="early-bird"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small" htmlFor={`window-${index}-timeLabel`}>Display time</label>
                    <input
                      id={`window-${index}-timeLabel`}
                      type="text"
                      className="form-control form-control-sm"
                      value={window.timeLabel}
                      onChange={(event) => updateItem('windows', index, { timeLabel: event.target.value })}
                      placeholder="07:00 – 10:00"
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small" htmlFor={`window-${index}-start`}>Start</label>
                    <input
                      id={`window-${index}-start`}
                      type="time"
                      className="form-control form-control-sm"
                      value={window.startTime ?? ''}
                      onChange={(event) => updateItem('windows', index, { startTime: event.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small" htmlFor={`window-${index}-end`}>End</label>
                    <input
                      id={`window-${index}-end`}
                      type="time"
                      className="form-control form-control-sm"
                      value={window.endTime ?? ''}
                      onChange={(event) => updateItem('windows', index, { endTime: event.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small" htmlFor={`window-${index}-cutoff`}>Cutoff</label>
                    <input
                      id={`window-${index}-cutoff`}
                      type="time"
                      className="form-control form-control-sm"
                      value={window.cutoffTime ?? ''}
                      onChange={(event) => updateItem('windows', index, { cutoffTime: event.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`window-${index}-details`}>Details</label>
                    <textarea
                      id={`window-${index}-details`}
                      className="form-control form-control-sm"
                      rows={2}
                      value={window.details}
                      onChange={(event) => updateItem('windows', index, { details: event.target.value })}
                    ></textarea>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger position-absolute top-0 end-0 mt-2 me-2"
                  onClick={() => removeItem('windows', index)}
                  aria-label={`Remove ${window.label || 'window'}`}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderHighlights(items, updateItem, addItem, removeItem) {
  return (
    <div className="mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h6 mb-0">Service highlights</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addItem('highlights')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Add highlight
        </button>
      </div>
      <div className="row g-3">
        {items.map((highlight, index) => {
          const key = `${highlight.icon || 'icon'}-${index}`;
          return (
            <div className="col-12 col-lg-6" key={key}>
              <div className="border rounded-3 p-3 h-100 bg-body-secondary bg-opacity-25 position-relative">
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label small" htmlFor={`highlight-${index}-icon`}>Icon</label>
                    <input
                      id={`highlight-${index}-icon`}
                      type="text"
                      className="form-control form-control-sm"
                      value={highlight.icon}
                      onChange={(event) => updateItem('highlights', index, { icon: event.target.value })}
                      placeholder="truck"
                    />
                    <p className="form-text small mb-0">Bootstrap icon name without the <code>bi-</code> prefix.</p>
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label small" htmlFor={`highlight-${index}-title`}>Title</label>
                    <input
                      id={`highlight-${index}-title`}
                      type="text"
                      className="form-control form-control-sm"
                      value={highlight.title}
                      onChange={(event) => updateItem('highlights', index, { title: event.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`highlight-${index}-description`}>Description</label>
                    <textarea
                      id={`highlight-${index}-description`}
                      className="form-control form-control-sm"
                      rows={2}
                      value={highlight.description}
                      onChange={(event) => updateItem('highlights', index, { description: event.target.value })}
                    ></textarea>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger position-absolute top-0 end-0 mt-2 me-2"
                  onClick={() => removeItem('highlights', index)}
                  aria-label={`Remove ${highlight.title || 'highlight'}`}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderProcessSteps(items, updateItem, addItem, removeItem) {
  return (
    <div className="mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h6 mb-0">How it works</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addItem('processSteps')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Add step
        </button>
      </div>
      <div className="row g-3">
        {items.map((step, index) => {
          const key = `${step.step || 'step'}-${index}`;
          return (
            <div className="col-12 col-lg-4" key={key}>
              <div className="border rounded-3 p-3 h-100 bg-body-secondary bg-opacity-25 position-relative">
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label small" htmlFor={`process-${index}-step`}>Step</label>
                    <input
                      id={`process-${index}-step`}
                      type="text"
                      className="form-control form-control-sm"
                      value={step.step}
                      onChange={(event) => updateItem('processSteps', index, { step: event.target.value })}
                      placeholder="01"
                    />
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label small" htmlFor={`process-${index}-headline`}>Headline</label>
                    <input
                      id={`process-${index}-headline`}
                      type="text"
                      className="form-control form-control-sm"
                      value={step.headline}
                      onChange={(event) => updateItem('processSteps', index, { headline: event.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`process-${index}-copy`}>Copy</label>
                    <textarea
                      id={`process-${index}-copy`}
                      className="form-control form-control-sm"
                      rows={2}
                      value={step.copy}
                      onChange={(event) => updateItem('processSteps', index, { copy: event.target.value })}
                    ></textarea>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger position-absolute top-0 end-0 mt-2 me-2"
                  onClick={() => removeItem('processSteps', index)}
                  aria-label={`Remove ${step.headline || 'step'}`}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderPackaging(items, updateItem, addItem, removeItem) {
  return (
    <div className="mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h6 mb-0">Packaging promise</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addItem('packaging')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Add note
        </button>
      </div>
      <div className="row g-3">
        {items.map((note, index) => {
          const key = `${note.title || 'note'}-${index}`;
          return (
            <div className="col-12 col-lg-4" key={key}>
              <div className="border rounded-3 p-3 h-100 bg-body-secondary bg-opacity-25 position-relative">
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`packaging-${index}-title`}>Title</label>
                    <input
                      id={`packaging-${index}-title`}
                      type="text"
                      className="form-control form-control-sm"
                      value={note.title}
                      onChange={(event) => updateItem('packaging', index, { title: event.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`packaging-${index}-body`}>Body copy</label>
                    <textarea
                      id={`packaging-${index}-body`}
                      className="form-control form-control-sm"
                      rows={2}
                      value={note.body}
                      onChange={(event) => updateItem('packaging', index, { body: event.target.value })}
                    ></textarea>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger position-absolute top-0 end-0 mt-2 me-2"
                  onClick={() => removeItem('packaging', index)}
                  aria-label={`Remove ${note.title || 'packaging note'}`}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderFaqs(items, updateItem, addItem, removeItem) {
  return (
    <div className="mb-0">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h6 mb-0">Delivery FAQs</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addItem('faqs')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Add FAQ
        </button>
      </div>
      <div className="row g-3">
        {items.map((faq, index) => {
          const key = `${faq.question || 'faq'}-${index}`;
          return (
            <div className="col-12" key={key}>
              <div className="border rounded-3 p-3 bg-body-secondary bg-opacity-25 position-relative">
                <div className="row g-2">
                  <div className="col-12 col-lg-4">
                    <label className="form-label small" htmlFor={`faq-${index}-question`}>Question</label>
                    <input
                      id={`faq-${index}-question`}
                      type="text"
                      className="form-control form-control-sm"
                      value={faq.question}
                      onChange={(event) => updateItem('faqs', index, { question: event.target.value })}
                    />
                  </div>
                  <div className="col-12 col-lg-8">
                    <label className="form-label small" htmlFor={`faq-${index}-answer`}>Answer</label>
                    <textarea
                      id={`faq-${index}-answer`}
                      className="form-control form-control-sm"
                      rows={2}
                      value={faq.answer}
                      onChange={(event) => updateItem('faqs', index, { answer: event.target.value })}
                    ></textarea>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger position-absolute top-0 end-0 mt-2 me-2"
                  onClick={() => removeItem('faqs', index)}
                  aria-label={`Remove FAQ ${index + 1}`}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
