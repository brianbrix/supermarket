import { useEffect } from 'react';
import { useCurrencyFormatter, useSettings } from '../../context/SettingsContext.jsx';

export default function OrderDetailModal({ order, onClose, loading = false }) {
  const formatCurrency = useCurrencyFormatter();
  const { settings } = useSettings();
  const currencyLabel = settings?.currency?.symbol || settings?.currency?.code || 'KES';
  const formatAmount = (value) => formatCurrency(Number(value ?? 0));

  useEffect(() => {
    function esc(e){ if(e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  if (!order) return null;

  const gross = Number(order.totalGross || order.total || 0);
  const net = Number(order.totalNet || (gross / 1.16));
  const vat = Number(order.vatAmount || (gross - net));
  const items = Array.isArray(order.items) ? order.items : [];
  const reference = order.orderNumber ?? order.order_number ?? (order.id != null ? `#${order.id}` : 'Order');
  const deliveryAddress = order.deliveryAddress ?? {};
  const deliveryContact = order.deliveryContact ?? {};
  const deliveryType = (order.deliveryType ?? '').toString().toUpperCase();
  const isDelivery = deliveryType === 'DELIVERY';
  const deliveryDistanceKm = Number.isFinite(Number(order.deliveryDistanceKm)) ? Number(order.deliveryDistanceKm) : null;
  const deliveryCost = Number.isFinite(Number(order.deliveryCost)) ? Number(order.deliveryCost) : null;
  const deliveryLat = Number.isFinite(Number(deliveryAddress.lat)) ? Number(deliveryAddress.lat) : null;
  const deliveryLng = Number.isFinite(Number(deliveryAddress.lng)) ? Number(deliveryAddress.lng) : null;
  return (
    <div className="modal fade show" style={{display:'block', background:'rgba(0,0,0,.45)'}} role="dialog" aria-modal="true" aria-labelledby="orderDetailTitle">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title" id="orderDetailTitle">Order {reference}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="row small mb-3">
              <div className="col-md-6">
                <p className="mb-1"><strong>Reference:</strong> {reference}</p>
                <p className="mb-1"><strong>Customer:</strong> {order.customerName || '—'}</p>
                <p className="mb-1"><strong>Phone:</strong> {order.customerPhone || '—'}</p>
              </div>
              <div className="col-md-6">
                <p className="mb-1"><strong>Date:</strong> {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</p>
                <p className="mb-1"><strong>Status:</strong> {order.status}</p>
              </div>
            </div>
            <div className="small border rounded p-3 mb-3 bg-body-tertiary">
              <h6 className="fw-semibold mb-2">Delivery</h6>
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
                  {deliveryCost !== null && <li className="mb-1">Fee: {formatAmount(deliveryCost)}</li>}
                  {order.deliveryStatus && <li className="mb-1">Status: {order.deliveryStatus}</li>}
                  {deliveryContact.phone && <li className="mb-1">Contact phone: {deliveryContact.phone}</li>}
                  {deliveryContact.email && <li className="mb-1">Contact email: {deliveryContact.email}</li>}
                  {deliveryContact.notes && <li className="mb-1">Instructions: {deliveryContact.notes}</li>}
                </ul>
              ) : (
                <p className="mb-0">Pickup order. Customer will collect in store.</p>
              )}
            </div>
            <h6 className="fw-semibold">Items</h6>
            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Product</th><th className="text-center" style={{width:'70px'}}>Qty</th><th className="text-end" style={{width:'110px'}}>Unit ({currencyLabel})</th><th className="text-end" style={{width:'120px'}}>Subtotal ({currencyLabel})</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted">
                        Fetching latest order details...
                      </td>
                    </tr>
                  )}
                  {!loading && items.map(it => {
                    const unit = Number(it.unitPriceGross || it.unitPrice || it.price || 0);
                    const name = it.productName || it.product?.name || (it.productId ? `Product #${it.productId}` : 'Product');
                    const key = it.id ?? `${it.productId}-${name}`;
                    return (
                      <tr key={key}>
                        <td>{name}</td>
                        <td className="text-center">{it.quantity}</td>
                        <td className="text-end">{formatAmount(unit)}</td>
                        <td className="text-end">{formatAmount(unit * it.quantity)}</td>
                      </tr>
                    );
                  })}
                  {!loading && items.length === 0 && <tr><td colSpan={4} className="text-center text-muted">No items</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <h6 className="fw-semibold">Totals</h6>
                <ul className="list-unstyled small mb-0">
                  <li className="d-flex justify-content-between"><span>Net (Excl VAT)</span><span>{formatAmount(net)}</span></li>
                  <li className="d-flex justify-content-between"><span>VAT (16%)</span><span>{formatAmount(vat)}</span></li>
                  <li className="d-flex justify-content-between fw-semibold border-top pt-1"><span>Total (Incl)</span><span>{formatAmount(gross)}</span></li>
                </ul>
              </div>
              <div className="col-md-6">
                <h6 className="fw-semibold">Raw JSON</h6>
                <pre className="small bg-body-tertiary p-2 rounded" style={{maxHeight:'180px', overflow:'auto'}}>{JSON.stringify(order, null, 2)}</pre>
              </div>
            </div>
          </div>
          <div className="modal-footer py-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
