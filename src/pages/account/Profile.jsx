import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useCurrencyFormatter } from '../../context/SettingsContext.jsx';
import { normalizeOrder } from '../../utils/order.js';

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const { push } = useToast();
  const formatCurrency = useCurrencyFormatter();
  const [orders, setOrders] = useState([]);
  const [ordersMeta, setOrdersMeta] = useState({ totalElements: 0, page: 0 });
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  useEffect(() => {
    refreshProfile?.();
  }, [refreshProfile]);

  useEffect(() => {
    let active = true;
    setLoadingOrders(true);
    api.user.orders(0, 5)
      .then(page => {
        if (!active) return;
        const content = Array.isArray(page?.content) ? page.content : [];
        setOrders(content.map(normalizeOrder));
        setOrdersMeta({ totalElements: page.totalElements ?? 0, page: page.page ?? 0 });
        setOrdersError(null);
        setLoadingOrders(false);
      })
      .catch(err => {
        if (!active) return;
        setOrdersError(err.message || 'Could not load recent orders');
        setLoadingOrders(false);
      });
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => {
    const totalSpent = orders.reduce((sum, order) => sum + (order.totalGross ?? 0), 0);
    const pending = orders.filter(order => order.status === 'PENDING').length;
    const completed = orders.filter(order => order.status === 'COMPLETED' || order.status === 'FULFILLED').length;
    const cancelled = orders.filter(order => order.status === 'CANCELLED').length;
    return {
      totalSpent,
      pending,
      completed,
      cancelled
    };
  }, [orders]);

  function handleResendVerification() {
    push('Account verification email sent (simulated). Check your inbox.', 'info');
  }

  return (
    <div className="d-flex flex-column gap-4">
      <section className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <h2 className="h5 mb-2">Personal details</h2>
              <p className="text-muted mb-0">Update your basic information and contact preferences.</p>
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={refreshProfile}>Refresh</button>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleResendVerification}>
                <i className="bi bi-envelope-check me-1"></i>Verify email
              </button>
            </div>
          </div>
          <hr />
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label small text-muted">Full name</label>
              <p className="form-control-plaintext fw-semibold mb-0">{[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || '—'}</p>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small text-muted">Email</label>
              <p className="form-control-plaintext mb-0">{user?.email || '—'}</p>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small text-muted">Phone</label>
              <p className="form-control-plaintext mb-0">{user?.phoneNumber || '—'}</p>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small text-muted">Member since</label>
              <p className="form-control-plaintext mb-0">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="d-flex flex-column flex-lg-row gap-3">
        <div className="card flex-fill border-0 shadow-sm">
          <div className="card-body">
            <p className="text-muted text-uppercase small mb-1">Total spent</p>
            <h3 className="h4 mb-0">{formatCurrency(stats.totalSpent)}</h3>
          </div>
        </div>
        <div className="card flex-fill border-0 shadow-sm">
          <div className="card-body">
            <p className="text-muted text-uppercase small mb-1">Pending orders</p>
            <h3 className="h4 mb-0">{stats.pending}</h3>
          </div>
        </div>
        <div className="card flex-fill border-0 shadow-sm">
          <div className="card-body">
            <p className="text-muted text-uppercase small mb-1">Completed orders</p>
            <h3 className="h4 mb-0">{stats.completed}</h3>
          </div>
        </div>
        <div className="card flex-fill border-0 shadow-sm">
          <div className="card-body">
            <p className="text-muted text-uppercase small mb-1">Cancelled</p>
            <h3 className="h4 mb-0">{stats.cancelled}</h3>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
            <div>
              <h2 className="h5 mb-1">Recent orders</h2>
              <p className="text-muted small mb-0">Showing your latest {orders.length} of {ordersMeta.totalElements} orders.</p>
            </div>
            <Link to="/orders" className="btn btn-sm btn-outline-primary">View all orders</Link>
          </div>
          {ordersError && <div className="alert alert-warning" role="alert">{ordersError}</div>}
          {loadingOrders ? (
            <div className="placeholder-glow">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <span className="placeholder col-6"></span>
                  <span className="placeholder col-2"></span>
                  <span className="placeholder col-2"></span>
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <p className="text-muted mb-0">No orders yet. Start shopping from the <Link to="/">home page</Link>.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr className="table-light">
                    <th scope="col">Order</th>
                    <th scope="col">Status</th>
                    <th scope="col">Payment</th>
                    <th scope="col" className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.orderNumber ?? order.id}>
                      <td>
                        <div className="fw-semibold">{order.orderNumber ?? `Order #${order.id}`}</div>
                        {order.orderNumber && <div className="small text-muted">Order ID #{order.id}</div>}
                        <div className="small text-muted">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</div>
                      </td>
                      <td>
                        <span className={`badge text-bg-${statusTone(order.status)}`}>{order.status}</span>
                      </td>
                      <td>
                        {order.paymentStatus ? (
                          <span className={`badge text-bg-${statusTone(order.paymentStatus)}`}>{order.paymentStatus}</span>
                        ) : (
                          <span className="text-muted small">No payment yet</span>
                        )}
                      </td>
                      <td className="text-end fw-semibold">{formatCurrency(order.totalGross ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function statusTone(status) {
  if (!status) return 'secondary';
  const normalized = status.toLowerCase();
  if (normalized.includes('pending')) return 'warning';
  if (normalized.includes('cancel')) return 'danger';
  if (normalized.includes('fail')) return 'danger';
  if (normalized.includes('complete') || normalized.includes('fulfill') || normalized.includes('paid')) return 'success';
  return 'secondary';
}
