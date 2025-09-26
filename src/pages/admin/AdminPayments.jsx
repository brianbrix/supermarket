import { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import '../../App.admin.css';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:10, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [draftFilters, setDraftFilters] = useState({ q:'', status:'', method:'', from:'', to:'', minAmount:'', maxAmount:'', sort:'createdAt', direction:'desc' });
  const [appliedFilters, setAppliedFilters] = useState({ q:'', status:'', method:'', from:'', to:'', minAmount:'', maxAmount:'', sort:'createdAt', direction:'desc' });
  const debounceRef = useRef();
  const firstDebounceRef = useRef(true); // skip first identical-to-default transition
  const didInitialLoadRef = useRef(false); // guard StrictMode double invoke

  const STATUS_OPTIONS = ['INITIATED','PENDING','SUCCESS','FAILED','REFUNDED'];
  const COD_STATUS_OPTIONS = ['PENDING','SUCCESS','FAILED','REFUNDED'];
  const METHOD_LABELS = {
    MOBILE_MONEY: 'Mobile Money',
    CASH_ON_DELIVERY: 'Cash on Delivery',
    CARD: 'Card',
    CASH: 'Cash',
    COD: 'Cash on Delivery'
  };

  function load(immediate=false){
    if (!immediate) setLoading(true);
    const { q, status, method, from, to, minAmount, maxAmount, sort, direction } = appliedFilters;
    const payload = {
      ...(q?{q}:{}),
      ...(status?{status}:{}),
      ...(method?{method}:{}),
      ...(from?{from}:{}),
      ...(to?{to}:{}),
      ...(minAmount?{minAmount}:{}),
      ...(maxAmount?{maxAmount}:{}),
      sort, direction
    };
  api.admin.payments.list(page,size,payload)
      .then(resp => {
        setPayments(resp.content?.data || resp.content || resp);
        setPageMeta(resp);
        setLoading(false);
        setError(null);
        setFlash(null);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }
  useEffect(()=>{
    if(!didInitialLoadRef.current){
      didInitialLoadRef.current = true;
      load();
      return;
    }
    load();
  }, [page, size, appliedFilters]);
  useEffect(()=>{
    if (firstDebounceRef.current){ firstDebounceRef.current = false; return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{ setAppliedFilters(a=>({ ...a, ...draftFilters })); setPage(0); }, 400);
    return ()=> clearTimeout(debounceRef.current);
  }, [draftFilters.q, draftFilters.status, draftFilters.method, draftFilters.from, draftFilters.to, draftFilters.minAmount, draftFilters.maxAmount]);
  function updateFilter(name,value){ setDraftFilters(f=>({...f,[name]:value})); }
  function applySort(e){ const [s,d]=e.target.value.split(':'); setDraftFilters(f=>({...f,sort:s,direction:d})); setAppliedFilters(a=>({...a,sort:s,direction:d})); setPage(0); load(true); }
  function clearFilters(){ const base={ q:'', status:'', method:'', from:'', to:'', minAmount:'', maxAmount:'', sort:'createdAt', direction:'desc' }; setDraftFilters(base); setAppliedFilters(base); setPage(0); load(true); }

  function formatMethodLabel(method){
    if (!method) return 'Unknown';
    const key = method.toUpperCase();
    return METHOD_LABELS[key] || method.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  }

  function formatStatusLabel(status){
    if (!status) return '—';
    return status.replace(/_/g,' ');
  }

  async function handleStatusChange(paymentId, nextStatus){
    setUpdatingId(paymentId);
    try {
      const resp = await api.admin.payments.updateStatus(paymentId, nextStatus);
      const payload = resp.data || resp;
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...payload } : p));
      setFlash(`Payment #${paymentId} marked as ${formatStatusLabel(nextStatus)}.`);
      setError(null);
    } catch (e) {
      setError(e.message);
      setFlash(null);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="container py-4">
      <h1 className="h4 mb-3">Payments</h1>
      {flash && <div className="alert alert-success alert-sm py-2" role="status">{flash}</div>}
      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-3">
          <input className="form-control form-control-sm" placeholder="Customer / Ref" value={draftFilters.q} onChange={e=>updateFilter('q', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Status">
          <select className="form-select form-select-sm" value={draftFilters.status} onChange={e=>updateFilter('status', e.target.value)}>
            <option value="">All</option>
            {STATUS_OPTIONS.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="Method">
          <select className="form-select form-select-sm" value={draftFilters.method} onChange={e=>updateFilter('method', e.target.value)}>
            <option value="">All</option>
            {['MOBILE_MONEY','CASH_ON_DELIVERY','CARD'].map(m=> <option key={m} value={m}>{formatMethodLabel(m)}</option>)}
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="From">
          <input type="date" className="form-control form-control-sm" value={draftFilters.from ? draftFilters.from.substring(0,10): ''} onChange={e=>updateFilter('from', e.target.value ? new Date(e.target.value).toISOString(): '')} />
        </FilterBar.Field>
        <FilterBar.Field label="To">
          <input type="date" className="form-control form-control-sm" value={draftFilters.to ? draftFilters.to.substring(0,10): ''} onChange={e=>updateFilter('to', e.target.value ? new Date(e.target.value).toISOString(): '')} />
        </FilterBar.Field>
        <FilterBar.Field label="Min">
          <input type="number" className="form-control form-control-sm" value={draftFilters.minAmount} onChange={e=>updateFilter('minAmount', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Max">
          <input type="number" className="form-control form-control-sm" value={draftFilters.maxAmount} onChange={e=>updateFilter('maxAmount', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Sort" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={`${draftFilters.sort}:${draftFilters.direction}`} onChange={applySort}>
            <option value="createdAt:desc">Newest</option>
            <option value="createdAt:asc">Oldest</option>
            <option value="amount:desc">Amount High→Low</option>
            <option value="amount:asc">Amount Low→High</option>
            <option value="status:asc">Status A→Z</option>
            <option value="status:desc">Status Z→A</option>
            <option value="id:asc">ID Asc</option>
            <option value="id:desc">ID Desc</option>
          </select>
        </FilterBar.Field>
  <FilterBar.Reset onClick={clearFilters} disabled={!draftFilters.q && !draftFilters.status && !draftFilters.method && !draftFilters.from && !draftFilters.to && !draftFilters.minAmount && !draftFilters.maxAmount} />
      </FilterBar>
      {loading ? <p>Loading...</p> : error ? <div className="alert alert-danger">{error}</div> : (
        <div className="table-responsive small">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>ID</th><th>Order</th><th>Amount (Gross)</th><th>Status</th><th>Method</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={6} className="text-center text-muted">No payments</td></tr>}
              {payments.map(p => {
                const amountValue = Number(p.amount);
                const statusValue = p.status || 'PENDING';
                const methodKey = (p.method || '').toUpperCase();
                const isCash = ['CASH_ON_DELIVERY','CASH','COD'].includes(methodKey);
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.orderId}</td>
                    <td className="amount-cell">{Number.isFinite(amountValue) ? amountValue.toFixed(2) : (p.amount ?? '—')}</td>
                    <td>
                      {isCash ? (
                        <div className={`status-select ${statusValue.toLowerCase()}`}>
                          <div className="d-flex align-items-center gap-2">
                            <select
                              className="form-select form-select-sm"
                              value={statusValue}
                              onChange={e => handleStatusChange(p.id, e.target.value)}
                              disabled={updatingId === p.id}
                            >
                              {COD_STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{formatStatusLabel(opt)}</option>
                              ))}
                            </select>
                            {updatingId === p.id && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                          </div>
                        </div>
                      ) : (
                        <StatusBadge status={statusValue} />
                      )}
                    </td>
                    <td>{formatMethodLabel(p.method)}</td>
                    <td>{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationBar {...pageMeta} size={size} onPageChange={setPage} alwaysVisible sizes={[10,20,50,100]} onPageSizeChange={(newSize)=>{ setSize(newSize); setPage(0); }} />
        </div>
      )}
    </div>
  );
}
