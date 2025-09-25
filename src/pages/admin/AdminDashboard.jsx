import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import OrderDetailModal from '../../components/admin/OrderDetailModal.jsx';
import '../../styles/adminDashboard.scss';

// Simple palette mapping for order/stat semantics
const STAT_STYLES = [
  { key:'totalOrders', label:'Total Orders', gradient:'linear-gradient(135deg,#6366f1,#818cf8)', icon:'bi-bag-check', text:'#fff' },
  { key:'totalRevenue', label:'Revenue', gradient:'linear-gradient(135deg,#0ea5e9,#38bdf8)', icon:'bi-cash-stack', text:'#fff' },
  { key:'pendingOrders', label:'Pending', gradient:'linear-gradient(135deg,#f59e0b,#fbbf24)', icon:'bi-hourglass-split', text:'#fff' },
  { key:'processingOrders', label:'Processing', gradient:'linear-gradient(135deg,#6366f1,#9333ea)', icon:'bi-gear', text:'#fff' },
  { key:'shippedOrders', label:'Shipped', gradient:'linear-gradient(135deg,#10b981,#34d399)', icon:'bi-truck', text:'#fff' },
  { key:'cancelledOrders', label:'Cancelled', gradient:'linear-gradient(135deg,#ef4444,#f87171)', icon:'bi-x-octagon', text:'#fff' }
];

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
    <div className="container py-4 admin-dashboard">
      <div className="d-flex flex-column flex-sm-row align-items-sm-center mb-4 gap-2">
        <h1 className="h4 mb-0 fw-semibold" style={{letterSpacing:'0.5px'}}>Admin Dashboard</h1>
        {stats && <span className="badge bg-primary-subtle text-primary ms-sm-3">Updated now</span>}
      </div>
      {stats && (
        <div className="row g-3 mb-4">
          {STAT_STYLES.map(cfg => (
            <div key={cfg.key} className="col-6 col-md-4 col-lg-2">
              <div className="stat-card" style={{background:cfg.gradient}}>
                <div className="d-flex flex-column h-100">
                  <div className="d-flex align-items-center mb-1 gap-2 stat-label">
                    {cfg.icon && <i className={`bi ${cfg.icon} opacity-75`}></i>}
                    <span>{cfg.label}</span>
                  </div>
                  <div className="flex-grow-1 d-flex align-items-end stat-value">
                    {cfg.key === 'totalRevenue' ? `KES ${Number(stats.totalRevenue || 0).toFixed(2)}` : stats[cfg.key]}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="card shadow-sm border-0 overflow-hidden mb-4 recent-orders-card">
        <div className="card-header py-2 bg-light border-0">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-clock-history text-primary"></i>
            <h2 className="h6 m-0">Recent Orders</h2>
            <span className="ms-auto small text-muted">Last {recent.length} shown</span>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-sm mb-0 align-middle admin-recent-orders">
            <thead>
              <tr>
                <th className="fw-normal">ID</th>
                <th className="fw-normal">Customer</th>
                <th className="fw-normal">Status</th>
                <th className="fw-normal text-end">Total (KES)</th>
                <th className="fw-normal text-center">Items</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-4">No orders</td></tr>}
              {recent.map(o => (
                <tr key={o.id} style={{cursor:'pointer'}} onClick={(e)=>{
                  if (e.target.tagName === 'SELECT' || e.target.closest('select')) return;
                  setSelectedOrder(o);
                }}>
                  <td className="small text-muted">#{o.id}</td>
                  <td className="text-truncate" style={{maxWidth:160}}>{o.customerName || '—'}</td>
                  <td style={{minWidth:'170px'}} className="d-flex align-items-center gap-2">
                    <span className={`status-badge ${o.status}`}>{o.status}</span>
                    <select
                      className="form-select form-select-sm status-select flex-grow-1"
                      value={o.status}
                      onChange={async (e)=>{
                        const newStatus = e.target.value;
                        try {
                          const updated = await api.admin.orders.updateStatus(o.id, newStatus);
                          setRecent(prev => prev.map(r => r.id === o.id ? { ...r, status: updated.status } : r));
                        } catch (err) {}
                      }}
                    >
                      {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="text-end fw-semibold">{Number(o.totalGross || o.total || 0).toFixed(2)}</td>
                  <td className="text-center">{o.items?.length}</td>
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

function StatCard({ title, value, gradient, icon, textColor }) {
  return (
    <div className="stat-card position-relative h-100" style={{background:gradient,borderRadius:14,padding:'0.9rem 0.85rem',color:textColor,boxShadow:'0 4px 12px -2px rgba(0,0,0,0.2)'}}>
      <div className="d-flex flex-column h-100">
        <div className="d-flex align-items-center mb-1 gap-2">
          {icon && <i className={`bi ${icon} opacity-75`}></i>}
          <span className="small fw-medium text-uppercase" style={{letterSpacing:'0.5px',fontSize:'0.65rem'}}>{title}</span>
        </div>
        <div className="flex-grow-1 d-flex align-items-end">
          <span className="fw-semibold" style={{fontSize:'1.15rem',lineHeight:1}}>{value}</span>
        </div>
      </div>
    </div>
  );
}

// Optional scoped styles (could alternatively move to a CSS file)
// Keeping inline here for quick iteration; consider extracting if it grows.
// Provides subtle hover row highlight & status select styling.
