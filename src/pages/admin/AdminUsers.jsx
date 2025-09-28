import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import OrderDetailModal from '../../components/admin/OrderDetailModal.jsx';
import { normalizeOrder, mergeOrders } from '../../utils/order.js';
import { useToast } from '../../context/ToastContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import '../../App.admin.css';
import { useCurrencyFormatter, useSettings } from '../../context/SettingsContext.jsx';

const ROLE_OPTIONS = ['ADMIN', 'USER'];

const INITIAL_PAGE_META = { page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true };
const INITIAL_ORDERS_META = { page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [pageMeta, setPageMeta] = useState(INITIAL_PAGE_META);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [draftFilters, setDraftFilters] = useState({ q: '', role: '', active: '' });
  const [appliedFilters, setAppliedFilters] = useState({ q: '', role: '', active: '' });
  const debounceRef = useRef();
  const firstDebounceRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [ordersMeta, setOrdersMeta] = useState(INITIAL_ORDERS_META);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersSize, setOrdersSize] = useState(10);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);

  const { push } = useToast();
  const formatCurrency = useCurrencyFormatter();
  const { settings } = useSettings();
  const currencyLabel = settings?.currency?.symbol || settings?.currency?.code || 'KES';
  const formatAmount = (value) => formatCurrency(Number(value ?? 0));

  useEffect(() => {
    if (firstDebounceRef.current) {
      firstDebounceRef.current = false;
      setAppliedFilters(draftFilters);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAppliedFilters(draftFilters);
      setPage(0);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [draftFilters.q, draftFilters.role, draftFilters.active]);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      setLoading(true);
      setError(null);
      try {
        const payload = { ...appliedFilters, sort: 'created_at', direction: 'desc' };
        const resp = await api.admin.users.list(page, size, payload);
        if (cancelled) return;
        if (Array.isArray(resp)) {
          setUsers(resp.map(normalizeUser));
          setPageMeta({ ...INITIAL_PAGE_META, page, size, totalElements: resp.length, totalPages: 1, first: true, last: true });
        } else {
          const normalizedContent = (resp.content || []).map(normalizeUser);
          setUsers(normalizedContent);
          setPageMeta({
            page: resp.page ?? page,
            size: resp.size ?? size,
            totalElements: resp.totalElements ?? normalizedContent.length,
            totalPages: resp.totalPages ?? 1,
            first: resp.first ?? page === 0,
            last: resp.last ?? true,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadUsers();
    return () => { cancelled = true; };
  }, [page, size, appliedFilters.q, appliedFilters.role, appliedFilters.active]);

  useEffect(() => {
    if (!selectedUser) return;
    let cancelled = false;
    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const resp = await api.admin.users.orders(selectedUser.id, {
          page: ordersPage,
          size: ordersSize,
          sort: 'created_at',
          direction: 'desc'
        });
        if (cancelled) return;
        if (Array.isArray(resp)) {
          setUserOrders(resp.map(normalizeOrder));
          setOrdersMeta({ ...INITIAL_ORDERS_META, page: ordersPage, size: ordersSize, totalElements: resp.length, totalPages: 1, first: true, last: true });
        } else {
          const normalized = (resp.content || []).map(normalizeOrder);
          setUserOrders(normalized);
          setOrdersMeta({
            page: resp.page ?? ordersPage,
            size: resp.size ?? ordersSize,
            totalElements: resp.totalElements ?? normalized.length,
            totalPages: resp.totalPages ?? 1,
            first: resp.first ?? ordersPage === 0,
            last: resp.last ?? true,
          });
        }
      } catch (err) {
        if (!cancelled) setOrdersError(err.message);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }
    loadOrders();
    return () => { cancelled = true; };
  }, [selectedUser, ordersPage, ordersSize]);

  function updateFilter(name, value) {
    setDraftFilters(prev => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    const reset = { q: '', role: '', active: '' };
    setDraftFilters(reset);
    setAppliedFilters(reset);
    setPage(0);
  }

  async function toggleActive(user) {
    try {
      const apiCall = user.active ? api.admin.users.deactivate : api.admin.users.activate;
      const updated = await apiCall(user.id);
      const normalized = normalizeUser(updated);
      setUsers(prev => prev.map(u => (u.id === normalized.id ? normalized : u)));
      push(`${normalized.username || normalized.email || `User #${normalized.id}`} ${normalized.active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      setError(err.message);
    }
  }

  function openOrders(user) {
    const normalized = normalizeUser(user);
    setSelectedUser(normalized);
    setUserOrders([]);
    setOrdersMeta({ ...INITIAL_ORDERS_META, size: ordersSize });
    setOrdersPage(0);
  }

  function closeOrders() {
    setSelectedUser(null);
    setUserOrders([]);
    setOrdersMeta(INITIAL_ORDERS_META);
    setOrdersError(null);
    setOrdersLoading(false);
  }

  async function openOrderDetail(orderSummary) {
    if (!orderSummary) return;
    const normalizedSummary = normalizeOrder(orderSummary);
    setSelectedOrder(normalizedSummary);
    try {
      setSelectedOrderLoading(true);
      const detailed = await api.orders.get(orderSummary.id);
      setSelectedOrder(prev => mergeOrders(prev ?? normalizedSummary, detailed));
    } catch (err) {
      setError(err.message);
    } finally {
      setSelectedOrderLoading(false);
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2 mb-3">
        <h1 className="h4 mb-0">Admin: Users</h1>
        <span className="text-muted small">Manage user access and review order history</span>
      </div>
      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-4">
          <input
            className="form-control form-control-sm"
            placeholder="Name, username or email"
            value={draftFilters.q}
            onChange={e => updateFilter('q', e.target.value)}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Role" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={draftFilters.role} onChange={e => updateFilter('role', e.target.value)}>
            <option value="">All</option>
            {ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="Status" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={draftFilters.active} onChange={e => updateFilter('active', e.target.value)}>
            <option value="">Any</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </FilterBar.Field>
        <FilterBar.Reset onClick={clearFilters} disabled={!draftFilters.q && !draftFilters.role && draftFilters.active === ''} />
      </FilterBar>
      {loading ? (
        <p>Loading users...</p>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <div className="table-responsive small">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Orders</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Login</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted py-4">No users found.</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="d-flex flex-column">
                      <span className="fw-semibold">{formatName(u)}</span>
                      <span className="text-muted small">#{u.id}</span>
                    </div>
                  </td>
                  <td>{u.username || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td><span className="badge text-bg-secondary">{u.role || 'USER'}</span></td>
                  <td>{u.ordersCount ?? 0}</td>
                  <td>
                    <span className={`badge ${u.active ? 'text-bg-success' : 'text-bg-danger'}`}>{u.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '—'}</td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openOrders(u)}>
                        Orders
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${u.active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar {...pageMeta} size={size} onPageChange={setPage} alwaysVisible sizes={[10, 20, 50]} onPageSizeChange={newSize => { setSize(newSize); setPage(0); }} />

      <UserOrdersModal
        open={!!selectedUser}
        user={selectedUser}
        orders={userOrders}
        meta={ordersMeta}
        loading={ordersLoading}
        error={ordersError}
        onClose={closeOrders}
        onPageChange={setOrdersPage}
        onPageSizeChange={newSize => { setOrdersSize(newSize); setOrdersPage(0); }}
        onViewOrder={openOrderDetail}
        formatAmount={formatAmount}
        currencyLabel={currencyLabel}
      />

      <OrderDetailModal order={selectedOrder} loading={selectedOrderLoading} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}

function UserOrdersModal({ open, user, orders, meta, loading, error, onClose, onPageChange, onPageSizeChange, onViewOrder, formatAmount, currencyLabel }) {
  const formatValue = typeof formatAmount === 'function' ? formatAmount : (value) => {
    const target = Number(value ?? 0);
    return Number.isFinite(target) ? target.toFixed(2) : '0.00';
  };
  const label = currencyLabel || 'KES';
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    if (!open) return;
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !user) return null;

  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="userOrdersTitle">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title" id="userOrdersTitle">Orders for {formatName(user)}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="small text-muted mb-3">Total orders: {meta.totalElements ?? orders.length}</div>
            {loading ? (
              <p>Loading orders...</p>
            ) : error ? (
              <div className="alert alert-danger small mb-0">{error}</div>
            ) : (
              <div className="table-responsive small">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="text-end">Total ({label})</th>
                      <th>Items</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted py-4">No orders for this user.</td></tr>
                    )}
                    {orders.map(order => (
                      <tr key={order.id}>
                        <td>
                          <div className="d-flex flex-column">
                            <span className="fw-semibold">{order.orderNumber ?? `#${order.id}`}</span>
                            <span className="text-muted small">ID #{order.id}</span>
                          </div>
                        </td>
                        <td>{order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td className="text-end">{order.totalGross != null ? formatValue(order.totalGross) : '—'}</td>
                        <td>{order.itemsCount ?? (order.items?.length ?? 0)}</td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onViewOrder(order)}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="modal-footer d-flex flex-column flex-sm-row align-items-sm-center justify-content-sm-between gap-2 py-2">
            <PaginationBar {...meta} size={meta.size ?? orders.length} onPageChange={onPageChange} sizes={[5, 10, 20, 50]} onPageSizeChange={onPageSizeChange} labelPageSize="Orders" />
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeUser(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    username: raw.username ?? raw.userName,
    email: raw.email,
    firstName: raw.firstName ?? raw.first_name ?? '',
    lastName: raw.lastName ?? raw.last_name ?? '',
    role: raw.role ?? (raw.roles?.[0] ?? 'USER'),
    active: raw.active ?? raw.enabled ?? false,
    ordersCount: raw.ordersCount ?? raw.orders_count ?? 0,
    lastLogin: raw.lastLogin ?? raw.last_login ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
  };
}

function formatName(user) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  if (parts.length === 0) return user?.username || user?.email || 'User';
  return parts.join(' ');
}
