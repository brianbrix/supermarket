import { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import OrderDetailModal from '../../components/admin/OrderDetailModal.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { mergeOrders, normalizeOrder } from '../../utils/order.js';
import '../../App.admin.css';
import { useCurrencyFormatter, useSettings } from '../../context/SettingsContext.jsx';

const STATUSES = ['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:10, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [draftFilters, setDraftFilters] = useState({ q:'', status:'', from:'', to:'', minTotal:'', maxTotal:'', sort:'createdAt', direction:'desc' });
  const [appliedFilters, setAppliedFilters] = useState({ q:'', status:'', from:'', to:'', minTotal:'', maxTotal:'', sort:'createdAt', direction:'desc' });
  const debounceRef = useRef();
  // Guard against React StrictMode double-invoking effects so we don't double load
  const didInitialLoadRef = useRef(false);
  // Skip first debounce run (initial draft == applied)
  const firstDebounceRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);
  const formatCurrency = useCurrencyFormatter();
  const { settings } = useSettings();
  const currencyLabel = settings?.currency?.symbol || settings?.currency?.code || 'KES';
  const formatAmount = (value) => formatCurrency(Number(value ?? 0));

  function load(immediate=false) {
    if (!immediate) setLoading(true);
  const { q, status, from, to, minTotal, maxTotal, sort, direction } = appliedFilters;
    const filterPayload = {
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(minTotal ? { minTotal } : {}),
      ...(maxTotal ? { maxTotal } : {}),
      sort, direction
    };
  api.admin.orders.list(page, size, filterPayload)
      .then(resp => { 
        // Expecting PageResponse shape { content, page, size, ... }
        if (Array.isArray(resp)) {
          // backend might have returned a raw array (fallback)
            setOrders(resp.map(normalizeOrder));
            setPageMeta(pm => ({ ...pm, page, size, totalPages:1, totalElements: resp.length, first:true, last:true }));
        } else {
          const normalizedContent = (resp.content || []).map(normalizeOrder);
          setOrders(normalizedContent);
          setPageMeta(resp);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }
  // Load when page OR applied filters change (filters debounced below)
  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      load();
      return;
    }
    load();
  }, [page, size, appliedFilters]);

  // Debounced filters for expensive queries
  useEffect(()=>{
    if (firstDebounceRef.current) { firstDebounceRef.current = false; return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{ setAppliedFilters(d=>({ ...d, ...draftFilters })); setPage(0); }, 400);
    return ()=> clearTimeout(debounceRef.current);
  }, [draftFilters.q, draftFilters.status, draftFilters.from, draftFilters.to, draftFilters.minTotal, draftFilters.maxTotal]);

  function updateFilter(name, value){ setDraftFilters(f => ({ ...f, [name]: value })); }
  function applySort(e){ const [s, dir] = e.target.value.split(':'); setDraftFilters(f=>({...f, sort:s, direction:dir })); setAppliedFilters(a=>({...a, sort:s, direction:dir })); setPage(0); load(true); }
  function clearFilters(){ const base={ q:'', status:'', from:'', to:'', minTotal:'', maxTotal:'', sort:'createdAt', direction:'desc' }; setDraftFilters(base); setAppliedFilters(base); setPage(0); load(true); }

  async function changeStatus(id, status) {
    try {
      const updated = await api.admin.orders.updateStatus(id, status);
      setOrders(prev => prev.map(o => o.id === id ? mergeOrders(o, updated) : o));
      if (selectedOrder?.id === id) {
        setSelectedOrder(prev => mergeOrders(prev, updated));
      }
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="container py-4">
      <h1 className="h4 mb-3">Admin: Orders</h1>
      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-3">
          <input className="form-control form-control-sm" placeholder="Customer name/phone" value={draftFilters.q} onChange={e=>updateFilter('q', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Status">
          <select className="form-select form-select-sm" value={draftFilters.status} onChange={e=>updateFilter('status', e.target.value)}>
            <option value="">All</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="From">
          <input type="date" className="form-control form-control-sm" value={draftFilters.from ? draftFilters.from.substring(0,10): ''} onChange={e=>updateFilter('from', e.target.value ? new Date(e.target.value).toISOString() : '')} />
        </FilterBar.Field>
        <FilterBar.Field label="To">
          <input type="date" className="form-control form-control-sm" value={draftFilters.to ? draftFilters.to.substring(0,10): ''} onChange={e=>updateFilter('to', e.target.value ? new Date(e.target.value).toISOString() : '')} />
        </FilterBar.Field>
        <FilterBar.Field label="Min">
          <input type="number" className="form-control form-control-sm" value={draftFilters.minTotal} onChange={e=>updateFilter('minTotal', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Max">
          <input type="number" className="form-control form-control-sm" value={draftFilters.maxTotal} onChange={e=>updateFilter('maxTotal', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Sort" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={`${draftFilters.sort}:${draftFilters.direction}`} onChange={applySort}>
            <option value="createdAt:desc">Newest</option>
            <option value="createdAt:asc">Oldest</option>
            <option value="totalGross:desc">Total High→Low</option>
            <option value="totalGross:asc">Total Low→High</option>
            <option value="status:asc">Status A→Z</option>
            <option value="status:desc">Status Z→A</option>
            <option value="id:asc">ID Asc</option>
            <option value="id:desc">ID Desc</option>
          </select>
        </FilterBar.Field>
  <FilterBar.Reset onClick={clearFilters} disabled={!draftFilters.q && !draftFilters.status && !draftFilters.from && !draftFilters.to && !draftFilters.minTotal && !draftFilters.maxTotal} />
      </FilterBar>
      {loading ? <p>Loading...</p> : error ? <div className="alert alert-danger">{error}</div> : (
        <div className="table-responsive small">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total Gross ({currencyLabel})</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(orders || []).map(o => (
                <tr key={o.id} style={{cursor:'pointer'}} onClick={e=>{
                  if (e.target.tagName === 'SELECT' || e.target.closest('select')) return;
                  openOrder(o);
                }}>
                  <td>
                    <div className="d-flex flex-column">
                      <span className="fw-semibold">{o.orderNumber ?? o.order_number ?? `#${o.id}`}</span>
                      {o.orderNumber && <span className="text-muted small">ID #{o.id}</span>}
                    </div>
                  </td>
                  <td>{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
                  <td>{o.customerName || '—'}</td>
                  <td>{(o.items || []).reduce((s,i)=>s + (i.quantity || 0),0) || o.itemsCount || 0}</td>
                  <td>{o.totalGross != null ? formatAmount(o.totalGross) : '—'}</td>
                  <td style={{minWidth:'140px'}}>
                    <div className={`d-flex flex-column gap-1 status-select ${o.status?.toLowerCase()}`}> 
                      <StatusBadge status={o.status} />
                      <select className="form-select form-select-sm" value={o.status} onChange={e=>changeStatus(o.id, e.target.value)}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar {...pageMeta} size={size} onPageChange={setPage} alwaysVisible sizes={[10,20,50,100]} onPageSizeChange={(newSize)=>{ setSize(newSize); setPage(0); }} />
        </div>
      )}
      <OrderDetailModal order={selectedOrder} loading={selectedOrderLoading} onClose={()=>setSelectedOrder(null)} />
    </div>
  );

  async function openOrder(orderSummary) {
    if (!orderSummary) return;
    const normalizedSummary = normalizeOrder(orderSummary);
    setSelectedOrder(normalizedSummary);
    try {
      setSelectedOrderLoading(true);
      const detailed = await api.orders.get(orderSummary.id);
      setSelectedOrder(prev => mergeOrders(prev ?? normalizedSummary, detailed));
    } catch (err) {
      // keep summary if detail fetch fails
      setError(err.message);
    } finally {
      setSelectedOrderLoading(false);
    }
  }
}
