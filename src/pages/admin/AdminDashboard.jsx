import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import OrderDetailModal from '../../components/admin/OrderDetailModal.jsx';

const ORDER_STATUSES = ['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'];

export default function AdminDashboard(){
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.admin.stats(), api.admin.recentOrders(5)])
      .then(([s,r])=>{ if(!active) return; setStats(s); setRecent(r); setLoading(false); })
      .catch(e=>{ if(!active) return; setError(e.message); setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="container py-4"><p>Loading dashboard...</p></div>;
  if (error) return <div className="container py-4"><div className="alert alert-danger">{error}</div></div>;

  return (
    <div className="container py-4">
      <h1 className="h4 mb-4">Admin Dashboard</h1>
      {stats && (
        <div className="row g-3 mb-4">
          <StatCard title="Total Orders" value={stats.totalOrders} />
          <StatCard title="Revenue" value={`KES ${Number(stats.totalRevenue || 0).toFixed(2)}`} />
          <StatCard title="Pending" value={stats.pendingOrders} />
          <StatCard title="Processing" value={stats.processingOrders} />
          <StatCard title="Shipped" value={stats.shippedOrders} />
          <StatCard title="Cancelled" value={stats.cancelledOrders} />
        </div>
      )}
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center py-2">
          <h2 className="h6 m-0">Recent Orders</h2>
        </div>
        <div className="table-responsive">
          <table className="table table-sm mb-0 align-middle">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={5} className="text-muted text-center">No orders</td></tr>}
              {recent.map(o => (
                <tr key={o.id} style={{cursor:'pointer'}} onClick={(e)=>{
                  // Avoid row click if interacting with select element
                  if (e.target.tagName === 'SELECT' || e.target.closest('select')) return;
                  setSelectedOrder(o);
                }}>
                  <td>{o.id}</td>
                  <td>{o.customerName || '—'}</td>
                  <td style={{minWidth:'140px'}}>
                    <select
                      className="form-select form-select-sm"
                      value={o.status}
                      onChange={async (e)=>{
                        const newStatus = e.target.value;
                        try {
                          const updated = await api.admin.orders.updateStatus(o.id, newStatus);
                          // reflect in recent list
                          setRecent(prev => prev.map(r => r.id === o.id ? { ...r, status: updated.status } : r));
                        } catch (err) { /* optionally add toast */ }
                      }}
                    >
                      {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>KES {Number(o.totalGross || o.total || 0).toFixed(2)}</td>
                  <td>{o.items?.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <OrderDetailModal order={selectedOrder} onClose={()=>setSelectedOrder(null)} />
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="col-6 col-md-4 col-lg-2">
      <div className="card shadow-sm h-100">
        <div className="card-body d-flex flex-column justify-content-center text-center py-3">
          <div className="small text-muted mb-1">{title}</div>
          <div className="fw-semibold" style={{fontSize:'1.1rem'}}>{value}</div>
        </div>
      </div>
    </div>
  );
}
