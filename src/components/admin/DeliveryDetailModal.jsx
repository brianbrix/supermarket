import { useEffect, useMemo, useState } from 'react';
import StatusBadge from '../StatusBadge.jsx';
import { DELIVERY_STATUSES } from '../../config/deliveryStatuses.js';

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoString(value) {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function DeliveryDetailModal({ delivery, loading = false, saving = false, onClose, onSubmit }) {
  const [status, setStatus] = useState('REQUESTED');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [eta, setEta] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    function esc(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  useEffect(() => {
    if (!delivery) return;
    setStatus(delivery.status ?? 'REQUESTED');
    setDriverName(delivery.driverName ?? '');
    setDriverPhone(delivery.driverPhone ?? '');
    setEta(toDateTimeLocal(delivery.eta ?? null));
    setInternalNotes(delivery.internalNotes ?? '');
  }, [delivery]);

  const history = useMemo(() => Array.isArray(delivery?.history) ? [...delivery.history].reverse() : [], [delivery]);

  if (!delivery) return null;

  const order = delivery.order ?? {};
  const shop = delivery.shop ?? {};
  const deliveryAddress = order.deliveryAddress ?? {};
  const deliveryContact = order.deliveryContact ?? {};
  const isDelivery = (order.deliveryType ?? '').toString().toUpperCase() === 'DELIVERY';
  const deliveryDistanceKm = Number.isFinite(Number(order.deliveryDistanceKm)) ? Number(order.deliveryDistanceKm) : null;
  const deliveryCost = Number.isFinite(Number(order.deliveryCost)) ? Number(order.deliveryCost) : null;
  const deliveryLat = Number.isFinite(Number(deliveryAddress.lat)) ? Number(deliveryAddress.lat) : null;
  const deliveryLng = Number.isFinite(Number(deliveryAddress.lng)) ? Number(deliveryAddress.lng) : null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!onSubmit) return;
    onSubmit({
      status,
      driverName: driverName?.trim() || null,
      driverPhone: driverPhone?.trim() || null,
      eta: eta ? toIsoString(eta) : null,
      internalNotes: internalNotes?.trim() || null
    });
  }

  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,.45)' }} role="dialog" aria-modal="true" aria-labelledby="deliveryDetailTitle">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title" id="deliveryDetailTitle">Delivery #{delivery.id}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={saving}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row small g-3 mb-3">
                <div className="col-md-6">
                  <h6 className="fw-semibold mb-2">Order</h6>
                  <p className="mb-1"><strong>Order Ref:</strong> {order.orderNumber ?? (order.id != null ? `#${order.id}` : '—')}</p>
                  <p className="mb-1"><strong>Customer:</strong> {order.customerName ?? '—'}</p>
                  <p className="mb-1"><strong>Phone:</strong> {order.customerPhone ?? '—'}</p>
                </div>
                <div className="col-md-6">
                  <h6 className="fw-semibold mb-2">Shop</h6>
                  <p className="mb-1"><strong>Name:</strong> {shop.name ?? '—'}</p>
                  <p className="mb-1"><strong>Contact:</strong> {shop.phone ?? '—'}</p>
                  <p className="mb-1"><strong>Location:</strong> {[shop.addressLine1, shop.city].filter(Boolean).join(', ') || '—'}</p>
                </div>
              </div>
                <div className="small border rounded p-3 mb-3 bg-body-tertiary">
                  <h6 className="fw-semibold mb-2">Delivery details</h6>
                  {isDelivery ? (
                    <ul className="list-unstyled mb-0">
                      {deliveryAddress.line1 && <li className="mb-1">Address: {deliveryAddress.line1}</li>}
                      {deliveryAddress.line2 && <li className="mb-1">Directions: {deliveryAddress.line2}</li>}
                      {(deliveryAddress.city || deliveryAddress.region) && (
                        <li className="mb-1">Town: {[deliveryAddress.city, deliveryAddress.region].filter(Boolean).join(', ')}</li>
                      )}
                      {deliveryAddress.postalCode && <li className="mb-1">Postal code: {deliveryAddress.postalCode}</li>}
                      {(deliveryLat !== null || deliveryLng !== null) && (
                        <li className="mb-1">Coordinates: {deliveryLat !== null ? deliveryLat.toFixed(5) : '—'}, {deliveryLng !== null ? deliveryLng.toFixed(5) : '—'}</li>
                      )}
                      {deliveryDistanceKm !== null && <li className="mb-1">Distance: {deliveryDistanceKm.toFixed(1)} km</li>}
                      {deliveryCost !== null && <li className="mb-1">Fee: {deliveryCost.toFixed(2)}</li>}
                      {deliveryContact.phone && <li className="mb-1">Contact phone: {deliveryContact.phone}</li>}
                      {deliveryContact.email && <li className="mb-1">Contact email: {deliveryContact.email}</li>}
                      {deliveryContact.notes && <li className="mb-1">Instructions: {deliveryContact.notes}</li>}
                      {order.deliveryStatus && <li className="mb-1">Status: {order.deliveryStatus}</li>}
                    </ul>
                  ) : (
                    <p className="mb-0">Pickup order. Customer will collect in store.</p>
                  )}
                </div>
              <div className="row g-3 small">
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <select className="form-select form-select-sm" value={status} onChange={e => setStatus(e.target.value)} disabled={saving}>
                    {DELIVERY_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Driver Name</label>
                  <input className="form-control form-control-sm" value={driverName} onChange={e => setDriverName(e.target.value)} disabled={saving} placeholder="Jane Rider" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Driver Phone</label>
                  <input className="form-control form-control-sm" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} disabled={saving} placeholder="07xx xxx xxx" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">ETA</label>
                  <input type="datetime-local" className="form-control form-control-sm" value={eta} onChange={e => setEta(e.target.value)} disabled={saving} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control form-control-sm" rows={3} value={internalNotes} onChange={e => setInternalNotes(e.target.value)} disabled={saving} placeholder="Add internal notes"></textarea>
                </div>
              </div>
              <div className="mt-4">
                <h6 className="fw-semibold mb-2">History</h6>
                {loading ? (
                  <p className="small text-muted">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="small text-muted">No history recorded yet.</p>
                ) : (
                  <ul className="list-group small">
                    {history.map((entry, idx) => (
                      <li key={idx} className="list-group-item d-flex justify-content-between align-items-start">
                        <div>
                          <StatusBadge status={entry.status ?? 'UNKNOWN'} />
                          {entry.notes && <div className="text-muted mt-1">{entry.notes}</div>}
                        </div>
                        <span className="text-muted">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="modal-footer py-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={saving}>Close</button>
              <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
                Save changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
