import { useEffect, useMemo, useState } from 'react';
import { useGeocodingSearch } from '../../hooks/useGeocodingSearch.js';
import MapPickerModal from '../MapPickerModal.jsx';
import { resolveGeoContext, resolveGeoCoordinates, resolveGeoLabel, resolvePlaceId } from '../../utils/geocoding.js';

const INITIAL_FORM = {
  name: '',
  slug: '',
  description: '',
  phone: '',
  email: '',
  isActive: true,
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  lat: '',
  lng: '',
  serviceRadiusKm: '',
  deliveryWindowMinutes: '',
  placeId: '',
};

export default function DeliveryShopFormModal({ open, shop, saving = false, error = null, onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    results: locationResults,
    loading: locationLoading,
    error: locationError,
  } = useGeocodingSearch('', { limit: 6 });
  const formattedAddress = useMemo(() => formatAddressLabel(form), [form]);
  const mapInitialSelection = useMemo(() => ({
    label: formattedAddress || form.addressLine1 || form.name || '',
    context: [form.city, form.region].filter(Boolean).join(', '),
    lat: coerceNumber(form.lat),
    lng: coerceNumber(form.lng),
    placeId: form.placeId ?? null
  }), [form.addressLine1, form.city, form.lat, form.lng, form.name, form.placeId, form.region, formattedAddress]);

  useEffect(() => {
    if (!open) return;
    if (shop) {
      setForm({
        name: shop.name ?? '',
        slug: shop.slug ?? '',
        description: shop.description ?? '',
        phone: shop.phone ?? '',
        email: shop.email ?? '',
        isActive: shop.isActive ?? true,
        addressLine1: shop.addressLine1 ?? '',
        addressLine2: shop.addressLine2 ?? '',
        city: shop.city ?? '',
        region: shop.region ?? '',
        postalCode: shop.postalCode ?? '',
        lat: shop.lat ?? '',
        lng: shop.lng ?? '',
        serviceRadiusKm: shop.serviceRadiusKm ?? '',
        deliveryWindowMinutes: shop.deliveryWindowMinutes ?? '',
        placeId: shop.placeId ?? '',
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [open, shop]);

  useEffect(() => {
    if (!open) return;
    if (formattedAddress) {
      setLocationQuery(formattedAddress);
    } else {
      setLocationQuery('');
    }
  }, [formattedAddress, open, setLocationQuery]);

  useEffect(() => {
    function esc(e) {
      if (e.key === 'Escape' && open && !saving) onClose?.();
    }
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose, open, saving]);

  if (!open) return null;

  function updateField(name, value) {
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handleCheckbox(e) {
    const { name, checked } = e.target;
    updateField(name, checked);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    updateField(name, value);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!onSubmit) return;
    const payload = buildPayload(form);
    onSubmit(payload);
  }

  function handleLocationInput(e) {
    setLocationQuery(e.target.value);
    setShowLocationResults(true);
  }

  function handleSelectLocation(result) {
    if (!result) return;
    const labelResolved = resolveGeoLabel(result) || result.label || locationQuery || formattedAddress || '';
    const contextResolved = resolveGeoContext(result) || '';
    const coords = resolveGeoCoordinates(result);
    const placeId = resolvePlaceId(result) ?? form.placeId ?? null;
    const components = result.address || result.raw || {};
    const streetParts = [components.house_number ?? result.houseNumber, components.road ?? result.street].filter(Boolean).join(' ').trim();
    const addressLine = streetParts || labelResolved || form.addressLine1;
    const city = result.city ?? components.city ?? components.town ?? components.village ?? null;
    const region = result.state ?? components.state ?? result.county ?? components.county ?? null;
    const postal = result.postcode ?? components.postcode ?? null;

    updateField('addressLine1', addressLine);
    if (city) updateField('city', city);
    if (region) updateField('region', region);
    if (postal) updateField('postalCode', postal);
    if (Number.isFinite(coords.lat)) updateField('lat', String(coords.lat));
    if (Number.isFinite(coords.lng)) updateField('lng', String(coords.lng));
  updateField('placeId', placeId || '');
    setLocationQuery(labelResolved || addressLine);
    setShowLocationResults(false);
  }

  function handleMapConfirm(selection) {
    if (!selection) return;
    const latValue = coerceNumber(selection.lat ?? selection.latitude ?? selection?.coords?.lat);
    const lngValue = coerceNumber(selection.lng ?? selection.longitude ?? selection?.coords?.lng);
    const resolvedLabel = (selection.label || selection.title || selection.name || formattedAddress || '').trim();
    const resolvedContext = (selection.context || selection.description || selection?.raw?.context || '').trim();
    const fallbackLabel = (!resolvedLabel && Number.isFinite(latValue) && Number.isFinite(lngValue))
      ? `Pinned location (${latValue.toFixed(6)}, ${lngValue.toFixed(6)})`
      : resolvedLabel;
    const contextParts = resolvedContext.split(',').map(part => part.trim()).filter(Boolean);

    updateField('addressLine1', fallbackLabel || form.addressLine1);
    if (contextParts[0]) updateField('city', contextParts[0]);
    if (contextParts.length > 1) updateField('region', contextParts.slice(1).join(', '));
    if (Number.isFinite(latValue)) updateField('lat', String(latValue));
    if (Number.isFinite(lngValue)) updateField('lng', String(lngValue));
  updateField('placeId', selection.placeId ?? '');
    setLocationQuery(fallbackLabel || formattedAddress || '');
    setShowLocationResults(false);
    setMapOpen(false);
  }

  return (
    <>
      <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,.45)' }} role="dialog" aria-modal="true" aria-labelledby="deliveryShopModalTitle">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title" id="deliveryShopModalTitle">{shop ? 'Edit Delivery Shop' : 'Create Delivery Shop'}</h5>
            <button type="button" className="btn-close" onClick={() => !saving && onClose?.()} aria-label="Close" disabled={saving}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body small">
              {error && <div className="alert alert-danger py-2 small">{error}</div>}
              <div className="row g-3">
                <div className="col-12 position-relative">
                  <label className="form-label small" htmlFor="shopSearch">Search location</label>
                  <div className="position-relative">
                    <div className="input-group input-group-sm">
                      <input
                        id="shopSearch"
                        type="search"
                        className="form-control"
                        placeholder="Search address, landmark or coordinates"
                        value={locationQuery}
                        onChange={handleLocationInput}
                        onFocus={() => setShowLocationResults(true)}
                        disabled={saving}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-success"
                        onClick={() => {
                          setShowLocationResults(false);
                          setMapOpen(true);
                        }}
                        disabled={saving}
                        aria-label="Pick location on map"
                      >
                        <i className="bi bi-map"></i>
                        <span className="d-none d-sm-inline ms-1">Map</span>
                      </button>
                    </div>
                    {(locationLoading || locationError || (showLocationResults && locationResults.length > 0)) && (
                      <div className="position-absolute bg-white border rounded shadow-sm mt-1 w-100 z-3" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {locationLoading && (
                        <div className="text-muted small px-3 py-2">Searching…</div>
                      )}
                      {locationError && !locationLoading && (
                        <div className="text-danger small px-3 py-2">{locationError.message || 'Location search failed. Try again.'}</div>
                      )}
                      {!locationLoading && !locationError && showLocationResults && locationResults.map(result => (
                        <button
                          key={result.id ?? `${result.latitude}-${result.longitude}-${result.label}`}
                          type="button"
                          className="list-group-item list-group-item-action border-0 small text-start"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectLocation(result);
                          }}
                          style={{ lineHeight: 1.3 }}
                        >
                          <div className="fw-semibold">{result.label}</div>
                          {(result.city || result.country) && (
                            <div className="text-muted">{[result.city, result.state, result.country].filter(Boolean).join(', ')}</div>
                          )}
                          {Number.isFinite(result.latitude) && Number.isFinite(result.longitude) && (
                            <div className="text-muted">Lat: {result.latitude.toFixed(5)} · Lng: {result.longitude.toFixed(5)}</div>
                          )}
                        </button>
                      ))}
                      {!locationLoading && !locationError && showLocationResults && locationResults.length === 0 && locationQuery?.trim().length >= 3 && (
                        <div className="text-muted small px-3 py-2">No matches found. Adjust your search.</div>
                      )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopName">Name *</label>
                  <input id="shopName" name="name" className="form-control form-control-sm" value={form.name} onChange={handleChange} required disabled={saving} placeholder="Downtown Hub" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopSlug">Slug</label>
                  <input id="shopSlug" name="slug" className="form-control form-control-sm" value={form.slug} onChange={handleChange} disabled={saving} placeholder="downtown-hub" />
                </div>
                <div className="col-12">
                  <label className="form-label small" htmlFor="shopDescription">Description</label>
                  <textarea id="shopDescription" name="description" className="form-control form-control-sm" rows={2} value={form.description} onChange={handleChange} disabled={saving} placeholder="Primary pickup and dispatch center"></textarea>
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopPhone">Phone</label>
                  <input id="shopPhone" name="phone" className="form-control form-control-sm" value={form.phone} onChange={handleChange} disabled={saving} placeholder="07xx xxx xxx" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopEmail">Email</label>
                  <input id="shopEmail" name="email" type="email" className="form-control form-control-sm" value={form.email} onChange={handleChange} disabled={saving} placeholder="store@example.com" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopAddress1">Address line 1</label>
                  <input id="shopAddress1" name="addressLine1" className="form-control form-control-sm" value={form.addressLine1} onChange={handleChange} disabled={saving} placeholder="123 Market St" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopAddress2">Address line 2</label>
                  <input id="shopAddress2" name="addressLine2" className="form-control form-control-sm" value={form.addressLine2} onChange={handleChange} disabled={saving} placeholder="Suite 4" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small" htmlFor="shopCity">City</label>
                  <input id="shopCity" name="city" className="form-control form-control-sm" value={form.city} onChange={handleChange} disabled={saving} placeholder="Nairobi" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small" htmlFor="shopRegion">Region</label>
                  <input id="shopRegion" name="region" className="form-control form-control-sm" value={form.region} onChange={handleChange} disabled={saving} placeholder="Nairobi County" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small" htmlFor="shopPostal">Postal code</label>
                  <input id="shopPostal" name="postalCode" className="form-control form-control-sm" value={form.postalCode} onChange={handleChange} disabled={saving} placeholder="00100" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopLat">Latitude</label>
                  <input id="shopLat" name="lat" className="form-control form-control-sm" value={form.lat ?? ''} onChange={handleChange} disabled={saving} placeholder="-1.2921" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopLng">Longitude</label>
                  <input id="shopLng" name="lng" className="form-control form-control-sm" value={form.lng ?? ''} onChange={handleChange} disabled={saving} placeholder="36.8219" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopRadius">Service radius (km)</label>
                  <input id="shopRadius" name="serviceRadiusKm" type="number" step="0.1" min="0" className="form-control form-control-sm" value={form.serviceRadiusKm} onChange={handleChange} disabled={saving} placeholder="10" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="shopWindow">Delivery window (minutes)</label>
                  <input id="shopWindow" name="deliveryWindowMinutes" type="number" min="0" className="form-control form-control-sm" value={form.deliveryWindowMinutes} onChange={handleChange} disabled={saving} placeholder="45" />
                </div>
                <div className="col-12 form-check ms-1">
                  <input id="shopIsActive" name="isActive" type="checkbox" className="form-check-input" checked={!!form.isActive} onChange={handleCheckbox} disabled={saving} />
                  <label htmlFor="shopIsActive" className="form-check-label small">Active</label>
                </div>
              </div>
            </div>
            <div className="modal-footer py-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => !saving && onClose?.()} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
                {shop ? 'Save changes' : 'Create shop'}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
      <MapPickerModal
        open={mapOpen}
        initialValue={mapInitialSelection}
        onClose={() => setMapOpen(false)}
        onSelect={handleMapConfirm}
        title="Pin shop location"
        confirmLabel="Use this location"
      />
    </>
  );
}

function buildPayload(form) {
  const trimmed = (value) => typeof value === 'string' ? value.trim() : value;
  const toNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  return {
    name: trimmed(form.name),
    slug: trimmed(form.slug) || null,
    description: trimmed(form.description) || null,
    phone: trimmed(form.phone) || null,
    email: trimmed(form.email) || null,
    isActive: !!form.isActive,
    addressLine1: trimmed(form.addressLine1) || null,
    addressLine2: trimmed(form.addressLine2) || null,
    city: trimmed(form.city) || null,
    region: trimmed(form.region) || null,
    postalCode: trimmed(form.postalCode) || null,
    lat: toNumber(form.lat),
    lng: toNumber(form.lng),
    serviceRadiusKm: toNumber(form.serviceRadiusKm),
    deliveryWindowMinutes: toNumber(form.deliveryWindowMinutes),
    placeId: trimmed(form.placeId) || null,
  };
}

function formatAddressLabel(form) {
  if (!form) return '';
  return [form.addressLine1, form.city, form.region, form.postalCode].filter(Boolean).join(', ');
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
