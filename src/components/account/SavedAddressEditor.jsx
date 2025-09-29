import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGeocodingSearch } from '../../hooks/useGeocodingSearch.js';
import { resolveGeoContext, resolveGeoCoordinates, resolveGeoLabel, resolvePlaceId } from '../../utils/geocoding.js';
import MapPickerModal from '../MapPickerModal.jsx';

const KENYAN_PHONE_REGEX = /^(?:\+?254|0)(?:7|1)\d{8}$/;

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function SavedAddressEditor({ value, onChange, onRemove, disabled }) {
  const {
    id,
    label = '',
    details = '',
    context = '',
    lat = null,
    lng = null,
    placeId = null,
    contactName = '',
    contactPhone = '',
    contactEmail = '',
    instructions = ''
  } = value || {};

  const [query, setQuery] = useState(details || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const {
    results,
    loading,
    error,
    setQuery: setSearchQuery
  } = useGeocodingSearch(query, { debounceMs: 350, limit: 6 });

  useEffect(() => {
    setQuery(details || '');
  }, [details, id]);

  const contactPhoneInvalid = Boolean(contactPhone) && !KENYAN_PHONE_REGEX.test(contactPhone);
  const contactEmailInvalid = Boolean(contactEmail) && !/^.+@.+\..+$/.test(contactEmail);

  const coordinatesSummary = useMemo(() => {
    if (lat == null || lng == null) return null;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, [lat, lng]);

  const mapInitialSelection = useMemo(() => ({
    label: details || label || query || '',
    context: context || '',
    lat: coerceNumber(lat),
    lng: coerceNumber(lng),
    placeId: placeId ?? null
  }), [context, details, label, lat, lng, placeId, query]);

  function update(partial) {
    if (!onChange) return;
    onChange({
      ...value,
      ...partial,
    });
  }

  function handleManualAddressChange(next) {
    setQuery(next);
    setSearchQuery(next);
    update({
      details: next,
      context: '',
      lat: null,
      lng: null,
      placeId: null,
    });
    setShowSuggestions(true);
  }

  function handleSelectResult(result) {
    const labelResolved = resolveGeoLabel(result) || query || details;
    const contextResolved = resolveGeoContext(result);
    const coords = resolveGeoCoordinates(result);
    const resolvedPlaceId = resolvePlaceId(result);
    setQuery(labelResolved);
    setShowSuggestions(false);
    update({
      details: labelResolved,
      context: contextResolved,
      lat: coords.lat,
      lng: coords.lng,
      placeId: resolvedPlaceId,
    });
  }

  const handleMapConfirm = useCallback((selection) => {
    if (!selection) return;
    const latValue = coerceNumber(selection.lat ?? selection.latitude ?? selection?.coords?.lat);
    const lngValue = coerceNumber(selection.lng ?? selection.longitude ?? selection?.coords?.lng);
    const resolvedLabel = (selection.label || selection.title || selection.name || selection.displayName || '').trim();
    const resolvedContext = (selection.context || selection.description || selection?.raw?.context || '').trim();
    const fallbackLabel = Number.isFinite(latValue) && Number.isFinite(lngValue)
      ? `Pinned location (${latValue.toFixed(5)}, ${lngValue.toFixed(5)})`
      : '';
    const finalLabel = resolvedLabel || fallbackLabel || query || details || label || '';
    const place = selection.placeId ?? selection.place_id ?? selection?.raw?.place_id ?? placeId ?? null;

    setQuery(finalLabel);
    setSearchQuery(finalLabel);
    setShowSuggestions(false);
    update({
      details: finalLabel,
      context: resolvedContext || context,
      lat: latValue,
      lng: lngValue,
      placeId: place,
    });
  }, [context, details, label, placeId, query, setSearchQuery, update]);

  return (
    <>
      <div className="border rounded p-3 position-relative bg-body">
      <button
        type="button"
        className="btn btn-outline-danger btn-sm position-absolute top-0 end-0 mt-2 me-2"
        onClick={() => onRemove?.(id)}
        disabled={disabled}
      >
        Remove
      </button>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label small text-muted" htmlFor={`${id}-label`}>Label</label>
          <input
            id={`${id}-label`}
            type="text"
            className="form-control form-control-sm"
            disabled={disabled}
            value={label}
            onChange={(event) => update({ label: event.target.value })}
            placeholder="Home, office, etc."
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small text-muted" htmlFor={`${id}-contact-name`}>Contact person (optional)</label>
          <input
            id={`${id}-contact-name`}
            type="text"
            className="form-control form-control-sm"
            disabled={disabled}
            value={contactName || ''}
            onChange={(event) => update({ contactName: event.target.value })}
            placeholder="Who receives delivery"
          />
        </div>
        <div className="col-12">
          <label className="form-label small text-muted" htmlFor={`${id}-location`}>Location</label>
          <div className="position-relative">
            <div className="input-group input-group-sm">
              <input
                id={`${id}-location`}
                type="text"
                className="form-control"
                disabled={disabled}
                value={query}
                onChange={(event) => handleManualAddressChange(event.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search estate, street or landmark"
                autoComplete="off"
              />
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={() => {
                  setShowSuggestions(false);
                  setMapOpen(true);
                }}
                disabled={disabled}
                aria-label="Pick location on map"
              >
                <i className="bi bi-map"></i>
                <span className="d-none d-sm-inline ms-1">Map</span>
              </button>
            </div>
            {showSuggestions && query.trim().length >= 3 && results.length > 0 && (
              <ul className="list-group position-absolute w-100 shadow-sm mt-1" style={{ zIndex: 30 }}>
                {results.map(result => {
                  const labelResolved = resolveGeoLabel(result);
                  const contextResolved = resolveGeoContext(result);
                  const key = resolvePlaceId(result) ?? `${labelResolved}-${contextResolved}` ?? JSON.stringify(result);
                  return (
                    <li
                      key={key}
                      className="list-group-item list-group-item-action d-flex flex-column"
                      role="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSelectResult(result);
                      }}
                    >
                      <span className="fw-semibold">{labelResolved || 'Unnamed location'}</span>
                      {contextResolved && <span className="small text-muted">{contextResolved}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {loading && <div className="form-text small">Searching locations…</div>}
          {error && <div className="text-danger small">Could not search locations. Try again.</div>}
          {context && <div className="form-text small">{context}</div>}
          {coordinatesSummary && <div className="form-text small">Coordinates: {coordinatesSummary}</div>}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small text-muted" htmlFor={`${id}-contact-phone`}>Contact phone (optional)</label>
          <input
            id={`${id}-contact-phone`}
            type="tel"
            className={`form-control form-control-sm ${contactPhoneInvalid ? 'is-invalid' : ''}`}
            disabled={disabled}
            value={contactPhone || ''}
            onChange={(event) => update({ contactPhone: event.target.value })}
            placeholder="07xx xxx xxx"
          />
          {contactPhoneInvalid && <div className="invalid-feedback d-block small">Enter a valid Kenyan phone e.g. 0712 345 678.</div>}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small text-muted" htmlFor={`${id}-contact-email`}>Contact email (optional)</label>
          <input
            id={`${id}-contact-email`}
            type="email"
            className={`form-control form-control-sm ${contactEmailInvalid ? 'is-invalid' : ''}`}
            disabled={disabled}
            value={contactEmail || ''}
            onChange={(event) => update({ contactEmail: event.target.value })}
            placeholder="name@example.com"
          />
          {contactEmailInvalid && <div className="invalid-feedback d-block small">Enter a valid email address.</div>}
        </div>
        <div className="col-12">
          <label className="form-label small text-muted" htmlFor={`${id}-instructions`}>Delivery instructions (optional)</label>
          <textarea
            id={`${id}-instructions`}
            className="form-control form-control-sm"
            rows={2}
            disabled={disabled}
            value={instructions || ''}
            onChange={(event) => update({ instructions: event.target.value })}
            placeholder="Gate code, drop-off notes, etc."
          ></textarea>
        </div>
      </div>
      </div>
      <MapPickerModal
        open={mapOpen}
        initialValue={mapInitialSelection}
        onClose={() => setMapOpen(false)}
        onSelect={handleMapConfirm}
        title="Pin address location"
        confirmLabel="Use this location"
      />
    </>
  );
}
