import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import PaginationBar from '../../components/PaginationBar.jsx';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:20, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const size = 20;

  useEffect(()=>{
    setLoading(true);
    api.admin.payments.list(page,size)
      .then(resp => { setPayments(resp.content); setPageMeta(resp); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [page]);

  return (
    <div className="container py-4">
      <h1 className="h4 mb-3">Payments</h1>
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
              {payments.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.orderId}</td>
                  <td>{p.amount}</td>
                  <td><span className="badge text-bg-secondary">{p.status || 'PAID'}</span></td>
                  <td>{p.method || 'MOBILE'}</td>
                  <td>{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar {...pageMeta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
