import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { formatKES } from '../utils/currency.js';
import PaginationBar from '../components/PaginationBar.jsx';

const PAYMENT_TIMEOUT_MS = 3 * 60 * 1000;

export default function Orders(){
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page:0, size:10, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const { isAuthenticated } = useAuth();
  const mapBackend = useCallback((list = []) => list.map(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    const mappedItems = items.map(i => ({
      id: i.productId ?? i.id,
      name: i.productName ?? i.name ?? (i.product?.name ?? 'Item'),
      price: Number(i.unitPriceGross ?? i.unitPrice ?? i.price ?? 0),
      qty: Number(i.quantity ?? i.qty ?? 1)
    }));
    const baseProgress = o.paymentProgress ? { ...o.paymentProgress } : null;
    const now = Date.now();
    let paymentStatus = baseProgress?.status || o.paymentStatus || null;
    const lastUpdateIso = baseProgress?.updatedAt || o.paymentUpdatedAt || o.updatedAt || o.createdAt;
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
          amount: Number(o.totalGross ?? o.total_gross ?? 0),
          updatedAt: lastUpdateIso
        } : null);
    return {
      id: o.id,
      orderRef: o.id ?? String(o.id),
      createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
      paymentStatus,
      paymentMethod: paymentProgress?.method || o.paymentMethod || null,
      paymentProgress,
      timedOutPayment: timedOut,
      snapshot: {
        items: mappedItems,
        subtotal: Number(o.totalNet ?? o.total_net ?? 0),
        vat: Number(o.vatAmount ?? o.vat_amount ?? 0),
        total: Number(o.totalGross ?? o.total_gross ?? mappedItems.reduce((sum, i) => sum + i.price * i.qty, 0))
      },
      customer: {
        name: o.customerName || o.customer_name || 'Customer',
        phone: o.customerPhone || o.customer_phone || '',
        delivery: 'pickup',
        address: ''
      }
    };
  }), []);

  const loadGuest = useCallback(() => {
    try {
      const raw = localStorage.getItem('orders') ?? localStorage.getItem('guestOrders');
      const parsed = raw ? JSON.parse(raw) : [];
      setOrders(mapBackend(parsed));
      setMeta(m => ({ ...m, page:0, size: parsed.length || size, totalElements: parsed.length, totalPages: 1, first:true, last:true }));
    } catch {
      setOrders([]);
    }
  }, [mapBackend, size]);

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
      if (!isAuthenticated && (e.key === 'orders' || e.key === 'guestOrders')) loadGuest();
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

  function statusBadge(order) {
    if(!isAuthenticated) return <span className="badge bg-secondary">—</span>;
    const st = order.paymentStatus;
    if(!st) return <span className="badge bg-secondary">None</span>;
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
    if (!isAuthenticated) return null;
    if (order.timedOutPayment) return 'Payment attempt expired after 3 minutes';
    if (!order.paymentProgress) return order.paymentMethod ? order.paymentMethod : null;
    const { provider, channel, updatedAt } = order.paymentProgress;
    const parts = [];
    if (provider) parts.push(provider);
    if (channel) parts.push(channel);
    if (updatedAt) parts.push(`updated ${new Date(updatedAt).toLocaleTimeString()}`);
    return parts.join(' • ');
  }

  if (!orders.length) return <section className="container py-3"><h1 className="h5 mb-3">Order History</h1><p className="text-muted">No previous orders yet.{!isAuthenticated && ' (Guest orders are stored locally during this session)'}</p></section>;
  return (
    <section className="container py-3">
      <h1 className="h5 mb-3">Order History</h1>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr className="table-light">
              <th>Ref</th><th>Date</th><th>Items</th><th>Payment</th><th className="text-end">Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.orderRef} className={selected?.orderRef===o.orderRef? 'table-active':''}>
                <td>{o.orderRef}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
                <td>{totalItems(o)}</td>
                <td>
                  <div className="d-flex flex-column">
                    {statusBadge(o)}
                    {paymentSubtext(o) && <span className="small text-muted mt-1">{paymentSubtext(o)}</span>}
                  </div>
                </td>
                <td className="text-end">{formatKES(o.snapshot.total)}</td>
                <td>
                  <button className="btn btn-link p-0 small" onClick={()=>openOrder(o)} aria-label={`View details for order ${o.orderRef}`}>View</button>
                </td>
              </tr>
            ))}
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
                <p className="small mb-1"><strong>Date:</strong> {new Date(selected.createdAt).toLocaleString()}</p>
                <p className="small mb-1"><strong>Total:</strong> {formatKES(selected.snapshot.total)}</p>
                <p className="small mb-1"><strong>Payment Status:</strong> {statusBadge(selected)} {selected.paymentMethod && <span className="text-muted ms-2">{selected.paymentMethod}</span>}</p>
                {selected.paymentProgress && (
                  <div className="border rounded small p-2 mb-2 bg-light">
                    <p className="mb-1 fw-semibold">Payment progress</p>
                    <ul className="list-unstyled mb-1">
                      {selected.paymentProgress.provider && <li className="mb-0">Provider: <strong>{selected.paymentProgress.provider}</strong></li>}
                      {selected.paymentProgress.channel && <li className="mb-0">Channel: {selected.paymentProgress.channel}</li>}
                      <li className="mb-0">Amount: {formatKES(selected.paymentProgress.amount ?? selected.snapshot.total)}</li>
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
                          <td className="text-end">{formatKES(i.price * i.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><th colSpan={2} className="text-end">Subtotal</th><th className="text-end">{formatKES(selected.snapshot.subtotal ?? selected.snapshot.total)}</th></tr>
                      <tr><th colSpan={2} className="text-end">VAT 16%</th><th className="text-end">{formatKES(selected.snapshot.vat ?? 0)}</th></tr>
                      <tr><th colSpan={2} className="text-end">Total</th><th className="text-end">{formatKES(selected.snapshot.total)}</th></tr>
                    </tfoot>
                  </table>
                </div>
                {selected.customer && (
                  <div className="small">
                    <p className="mb-1"><strong>Customer:</strong> {selected.customer.name}</p>
                    <p className="mb-1"><strong>Phone:</strong> {selected.customer.phone}</p>
                    {selected.customer.delivery==='delivery' && <p className="mb-1"><strong>Address:</strong> {selected.customer.address}</p>}
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
