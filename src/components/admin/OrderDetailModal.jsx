import { useEffect } from 'react';

export default function OrderDetailModal({ order, onClose }) {
  useEffect(() => {
    function esc(e){ if(e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  if (!order) return null;

  const gross = Number(order.totalGross || order.total || 0);
  const net = Number(order.totalNet || (gross / 1.16));
  const vat = Number(order.vatAmount || (gross - net));
  return (
    <div className="modal fade show" style={{display:'block', background:'rgba(0,0,0,.45)'}} role="dialog" aria-modal="true" aria-labelledby="orderDetailTitle">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title" id="orderDetailTitle">Order #{order.id}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="row small mb-3">
              <div className="col-md-6">
                <p className="mb-1"><strong>Customer:</strong> {order.customerName || '—'}</p>
                <p className="mb-1"><strong>Phone:</strong> {order.customerPhone || '—'}</p>
              </div>
              <div className="col-md-6">
                <p className="mb-1"><strong>Date:</strong> {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</p>
                <p className="mb-1"><strong>Status:</strong> {order.status}</p>
              </div>
            </div>
            <h6 className="fw-semibold">Items</h6>
            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Product</th><th className="text-center" style={{width:'70px'}}>Qty</th><th className="text-end" style={{width:'110px'}}>Unit (Gross)</th><th className="text-end" style={{width:'120px'}}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map(it => {
                    const unit = Number(it.unitPriceGross || it.unitPrice || 0);
                    return (
                      <tr key={it.productId}>
                        <td>{it.productName}</td>
                        <td className="text-center">{it.quantity}</td>
                        <td className="text-end">KES {unit.toFixed(2)}</td>
                        <td className="text-end">KES {(unit * it.quantity).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {(!order.items || order.items.length===0) && <tr><td colSpan={4} className="text-center text-muted">No items</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <h6 className="fw-semibold">Totals</h6>
                <ul className="list-unstyled small mb-0">
                  <li className="d-flex justify-content-between"><span>Net (Excl VAT)</span><span>KES {net.toFixed(2)}</span></li>
                  <li className="d-flex justify-content-between"><span>VAT (16%)</span><span>KES {vat.toFixed(2)}</span></li>
                  <li className="d-flex justify-content-between fw-semibold border-top pt-1"><span>Total (Incl)</span><span>KES {gross.toFixed(2)}</span></li>
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
