import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import PaginationBar from '../../components/PaginationBar.jsx';
import OrderDetailModal from '../../components/admin/OrderDetailModal.jsx';

const STATUSES = ['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:20, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const size = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  function load() {
    setLoading(true);
    api.admin.orders.list(page, size)
      .then(resp => { 
        // Expecting PageResponse shape { content, page, size, ... }
        if (Array.isArray(resp)) {
          // backend might have returned a raw array (fallback)
            setOrders(resp);
            setPageMeta(pm => ({ ...pm, page, size, totalPages:1, totalElements: resp.length, first:true, last:true }));
        } else {
          setOrders(resp.content || []);
          setPageMeta(resp);
        }
        setLoading(false); 
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }
  useEffect(() => { load(); }, [page]);

  async function changeStatus(id, status) {
    try {
      const updated = await api.admin.orders.updateStatus(id, status);
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="container py-4">
      <h1 className="h4 mb-3">Admin: Orders</h1>
      {loading ? <p>Loading...</p> : error ? <div className="alert alert-danger">{error}</div> : (
        <div className="table-responsive small">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>ID</th><th>Date</th><th>Customer</th><th>Items</th><th>Total Gross</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(orders || []).map(o => (
                <tr key={o.id} style={{cursor:'pointer'}} onClick={e=>{
                  if (e.target.tagName === 'SELECT' || e.target.closest('select')) return;
                  setSelectedOrder(o);
                }}>
                  <td>{o.id}</td>
                  <td>{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
                  <td>{o.customerName || '—'}</td>
                  <td>{(o.items || []).reduce((s,i)=>s + (i.quantity || 0),0)}</td>
                  <td>{o.totalGross != null ? `KES ${Number(o.totalGross).toFixed(2)}` : '—'}</td>
                  <td>
                    <select className="form-select form-select-sm" value={o.status} onChange={e=>changeStatus(o.id, e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar {...pageMeta} onPageChange={setPage} />
        </div>
      )}
      <OrderDetailModal order={selectedOrder} onClose={()=>setSelectedOrder(null)} />
    </div>
  );
}
