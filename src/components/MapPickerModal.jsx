import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L, { ensureLeafletDefaults, DEFAULT_CENTER } from '../utils/leaflet.js';
import { useGeocodingSearch } from '../hooks/useGeocodingSearch.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { resolveGeoContext, resolveGeoCoordinates, resolveGeoLabel, resolvePlaceId } from '../utils/geocoding.js';
import { api } from '../services/api.js';

const DEFAULT_ZOOM = 13;

function normalizeInitial(value) {
  if (!value) return null;
  const coords = resolveGeoCoordinates(value);
  const label = value.label ?? value.locationLabel ?? value.details ?? '';
  const context = value.context ?? '';
  const placeId = value.placeId ?? resolvePlaceId(value) ?? null;
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return {
      label,
      context,
      lat: null,
      lng: null,
      placeId,
      source: 'initial',
      raw: value
    };
  }
  return {
    label: label || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
    context,
    lat: coords.lat,
    lng: coords.lng,
    placeId,
    source: 'initial',
    raw: value
  };
}

export default function MapPickerModal({
  open,
  initialValue = null,
  title = 'Choose location',
  confirmLabel = 'Use this location',
  onClose,
  onSelect
}) {
  const mapRootRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const lastPanSourceRef = useRef(null);
  const [showResults, setShowResults] = useState(false);
  const [selection, setSelection] = useState(() => normalizeInitial(initialValue));
  const [reverseLookupStatus, setReverseLookupStatus] = useState('idle');
  const [reverseLookupError, setReverseLookupError] = useState(null);

  const { status: geolocateStatus, error: geolocateError, locate } = useGeolocation();

  const {
    results,
    loading: searchLoading,
    error: searchError,
    query,
    setQuery: setSearchQuery
  } = useGeocodingSearch('', { debounceMs: 300, limit: 8 });

  const selectedCoordinates = useMemo(() => {
    if (!selection || !Number.isFinite(selection.lat) || !Number.isFinite(selection.lng)) return null;
    return [selection.lat, selection.lng];
  }, [selection]);

  const canConfirm = Number.isFinite(selection?.lat) && Number.isFinite(selection?.lng);

  useEffect(() => {
    if (!open) return;
    ensureLeafletDefaults();
    const root = mapRootRef.current;
    if (!root) return;
    const initialCoords = selectedCoordinates ?? [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
    const map = L.map(root, {
      center: initialCoords,
      zoom: DEFAULT_ZOOM,
      zoomControl: true
    });
    mapInstanceRef.current = map;

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });
    tileLayer.addTo(map);

    const handleMapClick = (event) => {
      const { lat, lng } = event.latlng;
      const label = `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      const next = {
        label,
        context: 'Pinned on map',
        lat,
        lng,
        placeId: null,
        source: 'map-click',
        raw: { lat, lng }
      };
      setSelection(next);
    };

    map.on('click', handleMapClick);

    setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.off('click', handleMapClick);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      lastPanSourceRef.current = null;
    };
  }, [open, selectedCoordinates]);

  useEffect(() => {
    if (!open) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!selectedCoordinates) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }
    const [lat, lng] = selectedCoordinates;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    const source = selection?.source;
    const zoom = map.getZoom();
    const targetZoom = zoom < 15 ? 15 : zoom;
    if (source && lastPanSourceRef.current !== source) {
      map.flyTo([lat, lng], targetZoom, { duration: 0.6 });
      lastPanSourceRef.current = source;
    } else if (!map.getBounds().contains([lat, lng])) {
      map.panTo([lat, lng]);
    }
  }, [selection, selectedCoordinates, open]);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeInitial(initialValue);
    setSelection(normalized);
    const label = normalized?.label ?? '';
    setSearchQuery(label);
    setShowResults(false);
    setReverseLookupError(null);
    setReverseLookupStatus('idle');
  }, [initialValue, open, setSearchQuery]);

  const handleSelectResult = useCallback((result) => {
    if (!result) return;
    const coords = resolveGeoCoordinates(result);
    const label = resolveGeoLabel(result);
    const context = resolveGeoContext(result);
    const placeId = resolvePlaceId(result);
    const next = {
      label: label || context || `${coords.lat?.toFixed?.(5) || ''}, ${coords.lng?.toFixed?.(5) || ''}`.trim(),
      context,
      lat: coords.lat,
      lng: coords.lng,
      placeId,
      source: 'search',
      raw: result
    };
    setSelection(next);
    setSearchQuery(label || '');
    setShowResults(false);
  }, [setSearchQuery]);

  const handleUseCurrentLocation = useCallback(async () => {
    try {
      setReverseLookupStatus('pending');
      setReverseLookupError(null);
      const coords = await locate();
      let result = null;
      try {
        const response = await api.delivery.geoSearch(`${coords.lat},${coords.lng}`, { limit: 1 });
        result = response?.results?.[0] ?? null;
      } catch (err) {
        // swallow reverse lookup errors – we still proceed with coords
        setReverseLookupError(err);
      }
      let label = 'Your current location';
      let context = '';
      let placeId = null;
      if (result) {
        label = resolveGeoLabel(result) || label;
        context = resolveGeoContext(result) || context;
        placeId = resolvePlaceId(result);
      }
      const next = {
        label,
        context,
        lat: coords.lat,
        lng: coords.lng,
        placeId,
        source: 'geolocation',
        raw: result || { lat: coords.lat, lng: coords.lng }
      };
      setSelection(next);
      setSearchQuery(label);
      setShowResults(false);
    } catch (err) {
      setReverseLookupError(err);
    } finally {
      setReverseLookupStatus('idle');
    }
  }, [locate, setSearchQuery]);

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onSelect?.({
      label: selection.label,
      context: selection.context,
      lat: selection.lat,
      lng: selection.lng,
      placeId: selection.placeId,
      source: selection.source,
      raw: selection.raw
    });
    onClose?.();
  }, [canConfirm, onClose, onSelect, selection]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!open) return null;

  const suggestionsVisible = showResults && query.trim().length >= 3 && results.length > 0;
  const geolocateBusy = geolocateStatus === 'requesting' || reverseLookupStatus === 'pending';

  return createPortal(
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,.45)' }} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={handleClose}></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-12 col-lg-4">
                <label className="form-label small text-muted" htmlFor="map-picker-search">Search</label>
                <div className="position-relative">
                  <input
                    id="map-picker-search"
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    className="form-control"
                    placeholder="Find estate, street or landmark"
                    autoComplete="off"
                  />
                  {suggestionsVisible && (
                    <ul className="list-group position-absolute w-100 shadow-sm mt-1" style={{ zIndex: 20, maxHeight: '240px', overflowY: 'auto' }}>
                      {results.map(result => {
                        const label = resolveGeoLabel(result) || 'Unnamed location';
                        const context = resolveGeoContext(result);
                        const key = resolvePlaceId(result) ?? `${label}-${context}` ?? JSON.stringify(result);
                        return (
                          <li
                            key={key}
                            className="list-group-item list-group-item-action"
                            role="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleSelectResult(result);
                            }}
                          >
                            <div className="fw-semibold">{label}</div>
                            {context && <div className="small text-muted">{context}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="form-text small mt-1">
                  {searchLoading && 'Searching…'}
                  {searchError && !searchLoading && 'Location search failed. Try again.'}
                  {!searchLoading && !searchError && query.trim().length < 3 && 'Type at least 3 characters to search.'}
                </div>
                <div className="d-grid gap-2 mt-3">
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm d-flex align-items-center justify-content-center gap-2"
                    onClick={handleUseCurrentLocation}
                    disabled={geolocateBusy}
                  >
                    {geolocateBusy ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    ) : (
                      <i className="bi bi-geo-alt"></i>
                    )}
                    <span>Use my current location</span>
                  </button>
                  {geolocateError && (
                    <div className="text-danger small" role="alert">{geolocateError.message || 'We could not access your location.'}</div>
                  )}
                  {reverseLookupError && !geolocateError && (
                    <div className="text-warning small">We placed a pin but could not fetch an address. You can move it manually.</div>
                  )}
                </div>
                {selection && (
                  <div className="mt-3 small bg-body-secondary-subtle border rounded p-3">
                    <div className="fw-semibold">Selected location</div>
                    <div>{selection.label || 'Unnamed location'}</div>
                    {selection.context && <div className="text-muted">{selection.context}</div>}
                    {Number.isFinite(selection.lat) && Number.isFinite(selection.lng) && (
                      <div className="text-muted">Lat: {selection.lat.toFixed(6)} · Lng: {selection.lng.toFixed(6)}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="col-12 col-lg-8">
                <div ref={mapRootRef} style={{ minHeight: '420px', width: '100%' }} className="rounded overflow-hidden border"></div>
              </div>
            </div>
          </div>
          <div className="modal-footer py-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClose}>Cancel</button>
            <button type="button" className="btn btn-success btn-sm" onClick={handleConfirm} disabled={!canConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
