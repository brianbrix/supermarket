import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { useCurrencyFormatter } from '../context/SettingsContext.jsx';
import PaginationBar from '../components/PaginationBar.jsx';
import { ensureGuestSessionId, readGuestOrders } from '../utils/guestOrders.js';

const PAYMENT_TIMEOUT_MS = 3 * 60 * 1000;

export default function Orders(){
  const formatCurrency = useCurrencyFormatter();
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page:0, size:10, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const guestSessionIdRef = useRef(null);
  const [highlightRef, setHighlightRef] = useState(() => location.state?.highlightOrder ?? null);
  const mapBackend = useCallback((list = []) => list.map(o => {
    const snapshot = (o && typeof o === 'object') ? o.snapshot : null;
    const rawItems = Array.isArray(o.items) && o.items.length > 0
      ? o.items
      : (Array.isArray(snapshot?.items) ? snapshot.items : []);
    const mappedItems = rawItems.map((i, idx) => ({
      id: i.productId ?? i.id ?? idx,
      name: i.productName ?? i.name ?? (i.product?.name ?? `Item ${idx + 1}`),
      price: Number(i.unitPriceGross ?? i.unitPrice ?? i.price ?? 0),
      qty: Number(i.quantity ?? i.qty ?? 1)
    }));
    const baseProgress = o.paymentProgress ? { ...o.paymentProgress } : null;
    const now = Date.now();
    let paymentStatus = baseProgress?.status || o.paymentStatus || snapshot?.paymentStatus || null;
    const lastUpdateIso = baseProgress?.updatedAt || o.paymentUpdatedAt || o.updatedAt || o.createdAt || (snapshot?.ts ? new Date(snapshot.ts).toISOString() : null);
    const lastUpdateMs = lastUpdateIso ? new Date(lastUpdateIso).getTime() : null;
    const timedOut = ['INITIATED', 'PENDING'].includes(paymentStatus ?? '') && lastUpdateMs && (now - lastUpdateMs >= PAYMENT_TIMEOUT_MS);
    if (timedOut) {
      paymentStatus = 'FAILED';
    }
    const paymentProgress = baseProgress
      ? { ...baseProgress, status: paymentStatus, timedOut }
      : (timedOut ? {
          status: paymentStatus,
          timedOut,
          amount: Number(o.totalGross ?? o.total_gross ?? snapshot?.total ?? 0),
          updatedAt: lastUpdateIso
        } : null);
    const fallbackTotal = mappedItems.reduce((sum, i) => sum + (Number.isFinite(i.price) ? i.price : 0) * i.qty, 0);
    const subtotal = Number(snapshot?.subtotal ?? o.totalNet ?? o.total_net ?? fallbackTotal);
    const vatAmount = Number(snapshot?.vat ?? o.vatAmount ?? o.vat_amount ?? 0);
    const total = Number(snapshot?.total ?? o.totalGross ?? o.total_gross ?? fallbackTotal);
    const discountAmount = Number(snapshot?.discount ?? snapshot?.discountAmount ?? o.discountAmount ?? o.discount_amount ?? 0);
    const totalBeforeDiscount = Number(
      snapshot?.totalBeforeDiscount ?? snapshot?.total_before_discount ?? o.totalBeforeDiscount ?? o.total_before_discount ?? (total + discountAmount)
    );
    const couponCode = snapshot?.couponCode ?? o.couponCode ?? o.coupon_code ?? null;
    const createdAtMs = o.createdAt ? new Date(o.createdAt).getTime() : (snapshot?.ts ?? Date.now());
    const backendRef = o.orderNumber ?? o.order_number ?? o.reference ?? null;
    const guestRef = snapshot?.orderRef || snapshot?.id || (snapshot?.ts ? `guest-${snapshot.ts}` : `guest-${createdAtMs}`);
    const displayRef = backendRef ?? o.orderRef ?? (o.id != null ? `#${o.id}` : guestRef);

    const backendDeliveryAddress = o.deliveryAddress ?? {};
    const backendDeliveryContact = o.deliveryContact ?? {};
    const backendDeliveryRecord = o.deliveryRecord ?? null;
    const backendDeliveryShop = o.deliveryShop ?? backendDeliveryRecord?.shop ?? null;
    const snapshotDelivery = snapshot?.delivery ?? {};

    const resolvedDeliveryType = (o.deliveryType ?? snapshotDelivery.mode ?? snapshotDelivery.type ?? snapshotDelivery.method ?? null);
    const normalizedDeliveryType = resolvedDeliveryType ? resolvedDeliveryType.toString().toUpperCase() : (snapshotDelivery.mode || snapshotDelivery.type ? String(snapshotDelivery.mode || snapshotDelivery.type).toUpperCase() : 'PICKUP');
    const isDelivery = normalizedDeliveryType === 'DELIVERY';

    const deliveryAddressLine1 = backendDeliveryAddress.line1
      ?? backendDeliveryAddress.addressLine1
      ?? snapshotDelivery.address
      ?? snapshotDelivery.locationLabel
      ?? snapshotDelivery.addressLine1
      ?? '';
    const deliveryAddressLine2 = backendDeliveryAddress.line2
      ?? backendDeliveryAddress.addressLine2
      ?? snapshotDelivery.context
      ?? snapshotDelivery.addressLine2
      ?? '';
    const deliveryCity = backendDeliveryAddress.city ?? snapshotDelivery.city ?? '';
    const deliveryRegion = backendDeliveryAddress.region ?? snapshotDelivery.region ?? '';
    const deliveryPostal = backendDeliveryAddress.postalCode ?? snapshotDelivery.postalCode ?? '';
    const deliveryLat = backendDeliveryAddress.lat ?? snapshotDelivery.latitude ?? snapshotDelivery.lat ?? null;
    const deliveryLng = backendDeliveryAddress.lng ?? snapshotDelivery.longitude ?? snapshotDelivery.lng ?? null;
    const deliveryInstructions = backendDeliveryContact.notes ?? snapshotDelivery.instructions ?? snapshotDelivery.deliveryInstructions ?? null;
    const deliveryContactPhone = backendDeliveryContact.phone ?? snapshotDelivery.contactPhone ?? snapshotDelivery.deliveryContactPhone ?? o.customerPhone ?? '';
    const deliveryContactEmail = backendDeliveryContact.email ?? snapshotDelivery.contactEmail ?? snapshotDelivery.deliveryContactEmail ?? '';
    const deliveryDistanceKm = Number.isFinite(Number(o.deliveryDistanceKm)) ? Number(o.deliveryDistanceKm) : (Number.isFinite(Number(snapshotDelivery.distanceKm)) ? Number(snapshotDelivery.distanceKm) : null);
    const deliveryCost = Number.isFinite(Number(o.deliveryCost)) ? Number(o.deliveryCost) : (Number.isFinite(Number(snapshotDelivery.fee)) ? Number(snapshotDelivery.fee) : null);
    const deliveryStatus = o.deliveryStatus ?? backendDeliveryRecord?.status ?? snapshotDelivery.status ?? null;

    const delivery = {
      type: normalizedDeliveryType,
      status: deliveryStatus,
      requestedAt: o.deliveryRequestedAt ?? backendDeliveryRecord?.order?.deliveryRequestedAt ?? snapshotDelivery.requestedAt ?? null,
      dispatchedAt: o.deliveryDispatchedAt ?? backendDeliveryRecord?.order?.deliveryDispatchedAt ?? snapshotDelivery.dispatchedAt ?? null,
      completedAt: o.deliveryCompletedAt ?? backendDeliveryRecord?.order?.deliveryCompletedAt ?? snapshotDelivery.completedAt ?? null,
      address: {
        line1: deliveryAddressLine1,
        line2: deliveryAddressLine2,
        city: deliveryCity,
        region: deliveryRegion,
        postalCode: deliveryPostal,
        lat: deliveryLat,
        lng: deliveryLng
      },
      contact: {
        phone: deliveryContactPhone,
        email: deliveryContactEmail
      },
      instructions: deliveryInstructions,
      distanceKm: deliveryDistanceKm,
      cost: deliveryCost,
      shop: backendDeliveryShop ? {
        id: backendDeliveryShop.id,
        name: backendDeliveryShop.name ?? backendDeliveryShop.displayName ?? backendDeliveryShop.label ?? null,
        phone: backendDeliveryShop.phone ?? backendDeliveryShop.contactPhone ?? null,
        addressLine: backendDeliveryShop.addressLine1 ?? backendDeliveryShop.address ?? backendDeliveryShop.locationLabel ?? null,
        city: backendDeliveryShop.city ?? null
      } : null,
      record: backendDeliveryRecord ?? null
    };

    return {
      id: o.id ?? backendRef ?? guestRef,
      orderId: o.id ?? null,
      orderNumber: backendRef ?? displayRef,
      orderRef: displayRef ?? 'guest-order',
      createdAt: createdAtMs,
      paymentStatus,
      paymentMethod: paymentProgress?.method || o.paymentMethod || snapshot?.paymentMethod || o.guestPaymentMethod || null,
      paymentProgress,
      timedOutPayment: timedOut,
      snapshot: {
        items: mappedItems.length > 0 ? mappedItems : (Array.isArray(snapshot?.items) ? snapshot.items : []),
        subtotal,
        vat: vatAmount,
        total,
        discount: discountAmount,
        totalBeforeDiscount,
        couponCode
      },
      delivery,
      customer: {
        ...(o.customer ?? {}),
        name: o.customer?.name ?? o.customerName ?? o.customer_name ?? 'Customer',
        phone: o.customer?.phone ?? o.customerPhone ?? o.customer_phone ?? '',
        delivery: isDelivery ? 'delivery' : 'pickup',
        address: deliveryAddressLine1,
        addressLine2: deliveryAddressLine2,
        city: deliveryCity,
        region: deliveryRegion,
        postalCode: deliveryPostal,
        contactEmail: deliveryContactEmail,
        contactPhone: deliveryContactPhone
      }
    };
  }), []);

  const loadGuest = useCallback(() => {
    try {
      if (!guestSessionIdRef.current) {
        guestSessionIdRef.current = ensureGuestSessionId();
      }
      const sessionId = guestSessionIdRef.current;
      const allOrders = readGuestOrders(sessionId);
      const sessionOrders = Array.isArray(allOrders)
        ? allOrders.filter(o => !sessionId || !o?.sessionId || o.sessionId === sessionId)
        : [];
      const totalElements = sessionOrders.length;
      const totalPagesRaw = totalElements > 0 ? Math.ceil(totalElements / size) : 0;
      const maxPageIndex = totalPagesRaw > 0 ? totalPagesRaw - 1 : 0;
      const effectivePage = totalPagesRaw > 0 ? Math.min(page, maxPageIndex) : 0;
      const start = effectivePage * size;
      const paged = totalElements > 0 ? sessionOrders.slice(start, start + size) : [];
      if (effectivePage !== page) {
        setPage(effectivePage);
      }
      setOrders(mapBackend(paged));
      setMeta({
        page: effectivePage,
        size,
        totalElements,
        totalPages: totalPagesRaw || 1,
        first: effectivePage === 0,
        last: totalPagesRaw === 0 ? true : effectivePage === totalPagesRaw - 1
      });
    } catch {
      setOrders([]);
      setMeta({ page: 0, size, totalElements: 0, totalPages: 0, first: true, last: true });
    }
  }, [mapBackend, page, size, setPage]);

  const loadAuth = useCallback(async () => {
    try {
      const pageResp = await api.user.orders(page, size);
      const list = Array.isArray(pageResp) ? pageResp : (pageResp.content || []);
      setOrders(mapBackend(list));
      if (!Array.isArray(pageResp)) {
        setMeta({
          page: pageResp.page,
          size: pageResp.size,
          totalElements: pageResp.totalElements,
          totalPages: pageResp.totalPages,
          first: pageResp.first,
          last: pageResp.last
        });
      } else {
        setMeta(m => ({ ...m, page, size, totalElements: list.length, totalPages:1, first:true, last:true }));
      }
    } catch {
      loadGuest();
    }
  }, [page, size, mapBackend, loadGuest]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAuth();
    } else {
      loadGuest();
    }
  }, [isAuthenticated, page, size, loadAuth, loadGuest]);

  useEffect(() => {
    const storageHandler = (e) => {
      if (isAuthenticated) return;
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      if (!e) return;
      if (e.storageArea !== window.sessionStorage) return;
      if (!guestSessionIdRef.current) {
        guestSessionIdRef.current = ensureGuestSessionId();
      }
      const sessionId = guestSessionIdRef.current;
      const keyToWatch = sessionId ? `guest_orders:${sessionId}` : 'guest_orders:fallback';
      if (!e.key || e.key === keyToWatch) {
        loadGuest();
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }, [isAuthenticated, loadGuest]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const hasPending = orders.some(o => ['INITIATED','PENDING'].includes(o.paymentStatus));
    if (!hasPending) return;
    const interval = setInterval(() => { loadAuth(); }, 5000);
    return () => clearInterval(interval);
  }, [orders, isAuthenticated, loadAuth]);

  const [selected, setSelected] = useState(null);
  const closeBtnRef = useRef(null);
  function openOrder(o){ setSelected(o); setTimeout(()=>{ closeBtnRef.current?.focus(); }, 50); }
  function close(){ setSelected(null); }
  const totalItems = (o)=> o.snapshot.items.reduce((s,i)=>s+i.qty,0);

  useEffect(() => {
    if (location.state?.highlightOrder) {
      setHighlightRef(location.state.highlightOrder);
      const { highlightOrder, ...rest } = location.state;
      navigate(location.pathname + location.search, { replace: true, state: Object.keys(rest).length ? rest : null });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (selected?.orderRef && selected.orderRef === highlightRef) {
      setHighlightRef(null);
    }
  }, [selected?.orderRef, highlightRef]);

  function statusBadge(order) {
    const stRaw = order?.paymentStatus ?? order?.paymentProgress?.status ?? order?.snapshot?.paymentStatus ?? null;
    const st = typeof stRaw === 'string' ? stRaw.toUpperCase() : null;
    if(!st) return <span className="badge bg-secondary">—</span>;
    const pending = ['INITIATED','PENDING'].includes(st);
    const cls = {
      INITIATED: 'bg-warning text-dark',
      PENDING: 'bg-warning text-dark',
      SUCCESS: 'bg-success',
      FAILED: 'bg-danger',
      CANCELLED: 'bg-secondary'
    }[st] || 'bg-secondary';
    return (
      <span className={`badge ${cls} d-inline-flex align-items-center gap-1`}>
        {pending && <span className="spinner-border spinner-border-sm"></span>}
        {st}
      </span>
    );
  }

  function paymentSubtext(order) {
    if (order.timedOutPayment) return 'Payment attempt expired after 3 minutes';
    const progress = order.paymentProgress;
    const method = order.paymentMethod || progress?.method || order.guestPaymentMethod || null;
    const provider = progress?.provider;
    const channel = progress?.channel;
    const updatedAt = progress?.updatedAt;
    const parts = [];
    if (method) parts.push(method);
    if (provider) parts.push(provider);
    if (channel) parts.push(channel);
    if (updatedAt) parts.push(`updated ${new Date(updatedAt).toLocaleTimeString()}`);
    return parts.length ? parts.join(' • ') : null;
  }

  if (!orders.length) {
    return (
      <section className="container py-3">
        <h1 className="h5 mb-3">Order History</h1>
        {!isAuthenticated && (
          <div className="alert alert-info d-flex flex-column flex-md-row align-items-md-center gap-2" role="status">
            <div><strong>Create an account</strong> to sync your orders across devices and store delivery addresses for faster checkout.</div>
            <div className="d-flex gap-2 ms-md-auto">
              <Link to="/login" className="btn btn-sm btn-success">Log in</Link>
              <Link to="/register" className="btn btn-sm btn-outline-success">Sign up</Link>
            </div>
          </div>
        )}
        <p className="text-muted">No previous orders yet.{!isAuthenticated && ' (Guest orders are stored locally during this session)'}</p>
      </section>
    );
  }
  return (
    <section className="container py-3">
      <h1 className="h5 mb-3">Order History</h1>
      {!isAuthenticated && (
        <div className="alert alert-info d-flex flex-column flex-md-row align-items-md-center gap-2" role="status">
          <div>Sign in to track orders across devices and save delivery addresses for one-tap checkout.</div>
          <div className="d-flex gap-2 ms-md-auto">
            <Link to="/login" className="btn btn-sm btn-success">Log in</Link>
            <Link to="/register" className="btn btn-sm btn-outline-success">Create account</Link>
          </div>
        </div>
      )}
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr className="table-light">
              <th>Ref</th><th>Date</th><th>Items</th><th>Payment</th><th className="text-end">Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const rowClass = selected?.orderRef === o.orderRef
                ? 'table-active'
                : (highlightRef === o.orderRef ? 'table-success' : '');
              return (
                <tr key={o.orderRef} className={rowClass}>
                  <td>
                    <div className="fw-semibold">{o.orderRef}</div>
                    {o.orderId != null && <div className="text-muted small">Order ID #{o.orderId}</div>}
                  </td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                  <td>{totalItems(o)}</td>
                  <td>
                    <div className="d-flex flex-column">
                      {statusBadge(o)}
                      {paymentSubtext(o) && <span className="small text-muted mt-1">{paymentSubtext(o)}</span>}
                    </div>
                  </td>
                  <td className="text-end">{formatCurrency(o.snapshot.total)}</td>
                  <td>
                    <button className="btn btn-link p-0 small" onClick={()=>openOrder(o)} aria-label={`View details for order ${o.orderRef}`}>View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 small">
            <label className="mb-0">Page size
              <select className="form-select form-select-sm ms-2" style={{width:'auto', display:'inline-block'}} value={size} onChange={e=>{ setSize(Number(e.target.value)); setPage(0); }}>
                {[5,10,20,50].map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <PaginationBar {...meta} onPageChange={setPage} alwaysVisible />
        </div>
      </div>
      {selected && (
        <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="orderModalTitle" style={{background:'rgba(0,0,0,.4)'}}>
          <div className="modal-dialog modal-dialog-scrollable modal-sm">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h2 id="orderModalTitle" className="modal-title h6 mb-0">Order {selected.orderRef}</h2>
                <button ref={closeBtnRef} type="button" className="btn-close" aria-label="Close order details" onClick={close}></button>
              </div>
              <div className="modal-body">
                {selected.orderId != null && <p className="small mb-1"><strong>Order ID:</strong> #{selected.orderId}</p>}
                <p className="small mb-1"><strong>Date:</strong> {new Date(selected.createdAt).toLocaleString()}</p>
                <p className="small mb-1"><strong>Total:</strong> {formatCurrency(selected.snapshot.total)}</p>
                <p className="small mb-1"><strong>Payment Status:</strong> {statusBadge(selected)} {selected.paymentMethod && <span className="text-muted ms-2">{selected.paymentMethod}</span>}</p>
                {selected.paymentProgress && (
                  <div className="border rounded small p-2 mb-2 bg-body-tertiary">
                    <p className="mb-1 fw-semibold">Payment progress</p>
                    <ul className="list-unstyled mb-1">
                      {selected.paymentProgress.provider && <li className="mb-0">Provider: <strong>{selected.paymentProgress.provider}</strong></li>}
                      {selected.paymentProgress.channel && <li className="mb-0">Channel: {selected.paymentProgress.channel}</li>}
                      <li className="mb-0">Amount: {formatCurrency(selected.paymentProgress.amount ?? selected.snapshot.total)}</li>
                      {selected.paymentProgress.updatedAt && <li className="mb-0">Last update: {new Date(selected.paymentProgress.updatedAt).toLocaleString()}</li>}
                      {selected.paymentProgress.externalRequestId && <li className="mb-0 text-break">Request: {selected.paymentProgress.externalRequestId}</li>}
                      {selected.paymentProgress.externalTransactionId && <li className="mb-0 text-break">Txn: {selected.paymentProgress.externalTransactionId}</li>}
                    </ul>
                    {['INITIATED','PENDING'].includes(selected.paymentProgress.status) && <p className="mb-0 text-warning">Payment is still in progress. Please keep your phone nearby and don’t refresh this page.</p>}
                    {selected.paymentProgress.status === 'FAILED' && (
                      <p className="mb-0 text-danger">
                        {selected.timedOutPayment
                          ? 'Payment attempt expired after 3 minutes. Please contact support to confirm whether a charge was made before trying again.'
                          : 'Payment failed. Please contact support if you were charged before trying again from checkout.'}
                      </p>
                    )}
                  </div>
                )}
                {selected.delivery && (
                  <div className="border rounded small p-2 mb-2">
                    <p className="mb-1 fw-semibold">Delivery details</p>
                    {selected.delivery.type === 'DELIVERY' ? (
                      <ul className="list-unstyled mb-1">
                        {selected.delivery.shop?.name && <li className="mb-0">Shop: {selected.delivery.shop.name}</li>}
                        {selected.delivery.address?.line1 && (
                          <li className="mb-0">Address: {selected.delivery.address.line1}{selected.delivery.address.line2 ? `, ${selected.delivery.address.line2}` : ''}</li>
                        )}
                        {(selected.delivery.address?.city || selected.delivery.address?.region) && (
                          <li className="mb-0">Town: {[selected.delivery.address.city, selected.delivery.address.region].filter(Boolean).join(', ')}</li>
                        )}
                        {selected.delivery.contact?.phone && <li className="mb-0">Contact phone: {selected.delivery.contact.phone}</li>}
                        {selected.delivery.contact?.email && <li className="mb-0">Contact email: {selected.delivery.contact.email}</li>}
                        {Number.isFinite(selected.delivery.distanceKm) && <li className="mb-0">Distance: {selected.delivery.distanceKm.toFixed(1)} km</li>}
                        {Number.isFinite(selected.delivery.cost) && <li className="mb-0">Delivery fee: {formatCurrency(selected.delivery.cost)}</li>}
                        {(Number.isFinite(selected.delivery.address?.lat) || Number.isFinite(selected.delivery.address?.lng)) && (
                          <li className="mb-0">Coordinates: {Number.isFinite(selected.delivery.address?.lat) ? selected.delivery.address.lat.toFixed(5) : '—'}, {Number.isFinite(selected.delivery.address?.lng) ? selected.delivery.address.lng.toFixed(5) : '—'}</li>
                        )}
                        {selected.delivery.instructions && <li className="mb-0">Instructions: {selected.delivery.instructions}</li>}
                        {selected.delivery.status && <li className="mb-0">Delivery status: {selected.delivery.status}</li>}
                      </ul>
                    ) : (
                      <p className="mb-0">Pickup order. Collect from store when ready.</p>
                    )}
                  </div>
                )}
                <div className="table-responsive mb-2">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr><th>Item</th><th className="text-center">Qty</th><th className="text-end">Subtotal</th></tr>
                    </thead>
                    <tbody>
                      {selected.snapshot.items.map(i => (
                        <tr key={i.id}>
                          <td>{i.name}</td>
                          <td className="text-center">{i.qty}</td>
                          <td className="text-end">{formatCurrency(i.price * i.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><th colSpan={2} className="text-end">Subtotal</th><th className="text-end">{formatCurrency(selected.snapshot.subtotal ?? selected.snapshot.total)}</th></tr>
                      <tr><th colSpan={2} className="text-end">VAT 16%</th><th className="text-end">{formatCurrency(selected.snapshot.vat ?? 0)}</th></tr>
                      <tr><th colSpan={2} className="text-end">Total</th><th className="text-end">{formatCurrency(selected.snapshot.total)}</th></tr>
                    </tfoot>
                  </table>
                </div>
                {selected.customer && (
                  <div className="small">
                    <p className="mb-1"><strong>Customer:</strong> {selected.customer.name}</p>
                    <p className="mb-1"><strong>Phone:</strong> {selected.customer.phone}</p>
                    {selected.customer.delivery === 'delivery' && (
                      <>
                        {selected.customer.address && <p className="mb-1"><strong>Address:</strong> {selected.customer.address}</p>}
                        {selected.customer.addressLine2 && <p className="mb-1"><strong>Directions:</strong> {selected.customer.addressLine2}</p>}
                        {(selected.customer.city || selected.customer.region) && (
                          <p className="mb-1"><strong>Town:</strong> {[selected.customer.city, selected.customer.region].filter(Boolean).join(', ')}</p>
                        )}
                        {selected.customer.contactEmail && <p className="mb-1"><strong>Email:</strong> {selected.customer.contactEmail}</p>}
                        {selected.customer.contactPhone && selected.customer.contactPhone !== selected.customer.phone && (
                          <p className="mb-1"><strong>Alternate phone:</strong> {selected.customer.contactPhone}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {/* Raw payment details removed; embedded summary fields displayed */}
              </div>
              <div className="modal-footer py-2 d-flex justify-content-between">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={close}>Close</button>
                <button type="button" className="btn btn-success btn-sm" onClick={close}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
