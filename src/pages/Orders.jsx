import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { formatKES } from '../utils/currency.js';

export default function Orders(){
  const [orders, setOrders] = useState([]);
  const { isAuthenticated } = useAuth();
  useEffect(()=>{
    let active = true;
    const mapBackend = (list)=> list.map(o => ({
      orderRef: o.id || o.orderRef || String(o.id),
      createdAt: o.createdAt || Date.now(),
      method: 'mpesa',
      paymentRef: o.paymentRef || '',
      snapshot: {
        items: (o.items || []).map(i => ({ id: i.productId || i.product?.id, name: i.productName || i.product?.name || 'Item', price: i.unitPriceGross || i.unitPrice || i.price || 0, qty: i.quantity || i.qty || 1 })),
        subtotal: o.totalNet || o.subtotal || o.total || 0,
        vat: o.vatAmount || o.vat || 0,
        total: o.totalGross || o.total || 0
      },
      customer: { name: o.customerName || 'Customer', phone: o.customerPhone || '', delivery: 'pickup', address: '' }
    }));

    const loadGuest = () => {
      try {
        const raw = localStorage.getItem('guestOrders');
        const parsed = raw ? JSON.parse(raw) : [];
        if(active) setOrders(parsed);
      } catch { if(active) setOrders([]); }
    };

    const loadAuth = async () => {
      try {
        const pageResp = await api.user.orders(); // expecting PageResponse or array
        if(!active) return;
        const list = Array.isArray(pageResp) ? pageResp : (pageResp.content || []);
        setOrders(mapBackend(list));
      } catch (e) {
        // fallback to any cached guest orders (rare case after login transition)
        loadGuest();
      }
    };

    if (isAuthenticated) loadAuth(); else loadGuest();

    const storageHandler = (e) => {
      if (e.key === 'guestOrders' && !isAuthenticated) loadGuest();
    };
    window.addEventListener('storage', storageHandler);
    return ()=>{ active=false; window.removeEventListener('storage', storageHandler); };
  }, [isAuthenticated]);

  const [selected, setSelected] = useState(null);
  const closeBtnRef = useRef(null);
  function openOrder(o){ setSelected(o); setTimeout(()=>{ closeBtnRef.current?.focus(); }, 50); }
  function close(){ setSelected(null); }
  const totalItems = (o)=> o.snapshot.items.reduce((s,i)=>s+i.qty,0);

  if (!orders.length) return <section className="container py-3"><h1 className="h5 mb-3">Order History</h1><p className="text-muted">No previous orders yet.{!isAuthenticated && ' (Guest orders are stored locally during this session)'}</p></section>;
  return (
    <section className="container py-3">
      <h1 className="h5 mb-3">Order History</h1>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr className="table-light">
              <th>Ref</th><th>Date</th><th>Items</th><th className="text-end">Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.orderRef} className={selected?.orderRef===o.orderRef? 'table-active':''}>
                <td>{o.orderRef}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
                <td>{totalItems(o)}</td>
                <td className="text-end">{formatKES(o.snapshot.total)}</td>
                <td>
                  <button className="btn btn-link p-0 small" onClick={()=>openOrder(o)} aria-label={`View details for order ${o.orderRef}`}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                <p className="small mb-2"><strong>Payment:</strong> {selected.paymentRef || 'N/A'} ({selected.method})</p>
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
