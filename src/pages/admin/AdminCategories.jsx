import { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';

export default function AdminCategories(){
  const [items, setItems] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:10, totalPages:0, totalElements:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name:'', description:'' });
  const [qDraft, setQDraft] = useState('');
  const [qApplied, setQApplied] = useState('');
  const debounceRef = useRef();
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function load(){
    setLoading(true);
    if (qApplied) {
      api.admin.categories.search(qApplied, page, 20)
        .then(res=>{ setItems(res.content || res); setPageMeta(res); setLoading(false); })
        .catch(e=>{ setError(e.message); setLoading(false); });
    } else {
      api.admin.categories.paged(page, 20)
        .then(res=>{ setItems(res.content); setPageMeta(res); setLoading(false); })
        .catch(e=>{ setError(e.message); setLoading(false); });
    }
  }
  useEffect(()=>{ load(); }, [page, qApplied]);
  useEffect(()=>{
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{ setQApplied(qDraft); setPage(0); }, 400);
    return ()=> clearTimeout(debounceRef.current);
  }, [qDraft]);

  function handleEdit(cat){
    setEditingId(cat.id);
    setForm({ name: cat.name, description: cat.description || '' });
  }

  async function handleSubmit(e){
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { name: form.name, description: form.description || null };
      if (editingId) {
        await api.admin.categories.update(editingId, payload);
      } else {
        await api.admin.categories.create(payload);
      }
      setForm({ name:'', description:'' });
      setEditingId(null);
      load();
    } catch(e){ setError(e.message); } finally { setSubmitting(false); }
  }

  async function handleDelete(id){
    if(!window.confirm('Delete category? Products referencing it will keep a foreign key unless cascades are configured. Continue?')) return;
    try { await api.admin.categories.delete(id); load(); } catch(e){ setError(e.message); }
  }

  return (
    <div className="p-3 vstack gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">Categories</h2>
        <button className="btn btn-sm btn-primary" onClick={()=>{ setEditingId(null); setForm({ name:'', description:'' }); }}>New</button>
      </div>
      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-4">
          <div className="input-group input-group-sm">
            <span className="input-group-text">Q</span>
            <input className="form-control" placeholder="Name or description" value={qDraft} onChange={e=>setQDraft(e.target.value)} />
            {qDraft && <button className="btn btn-outline-secondary" type="button" onClick={()=>setQDraft('')}>×</button>}
          </div>
        </FilterBar.Field>
      </FilterBar>
      {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
      <div className="row g-3">
        <div className="col-12 col-lg-7">
          {loading ? <div className="text-muted small">Loading...</div> : (
            <div className="table-responsive small">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th style={{width:60}}>ID</th>
                    <th>Name</th>
                    <th style={{width:'30%'}}>Description</th>
                    <th style={{width:100}}>Products</th>
                    <th style={{width:110}}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length===0 && <tr><td colSpan={5} className="text-center text-muted small">No categories</td></tr>}
                  {items.map(c=> (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{c.name}</td>
                      <td className="small text-muted" style={{maxWidth:220, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.description || '-'}</td>
                      <td>{c.productCount ?? '-'}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={()=>handleEdit(c)}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDelete(c.id)}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination meta={pageMeta} onChange={setPage} />
            </div>
          )}
        </div>
        <div className="col-12 col-lg-5">
          <div className="card">
            <div className="card-body">
              <h3 className="h6 mb-3">{editingId ? 'Edit Category' : 'New Category'}</h3>
              <form onSubmit={handleSubmit} className="vstack gap-2">
                <input required className="form-control" placeholder="Name" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} />
                <textarea className="form-control" rows={3} placeholder="Description (optional)" value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))}></textarea>
                <div className="d-flex gap-2">
                  <button disabled={submitting} type="submit" className="btn btn-primary flex-grow-1">{submitting? 'Saving...' : 'Save'}</button>
                  {editingId && <button type="button" className="btn btn-outline-secondary" onClick={()=>{ setEditingId(null); setForm({ name:'', description:'' }); }}>Cancel</button>}
                </div>
              </form>
              <p className="text-muted small mt-3 mb-0">Names must be unique. Product counts are read-only.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pagination({ meta, onChange }) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="d-flex justify-content-between align-items-center mt-2">
      <button disabled={meta.first} className="btn btn-sm btn-outline-secondary" onClick={()=>onChange(meta.page-1)}>Prev</button>
      <span className="small">Page {meta.page+1} / {meta.totalPages}</span>
      <button disabled={meta.last} className="btn btn-sm btn-outline-secondary" onClick={()=>onChange(meta.page+1)}>Next</button>
    </div>
  );
}
