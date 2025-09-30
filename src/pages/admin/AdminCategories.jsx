import { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';

export default function AdminCategories(){
  const [items, setItems] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:10, totalPages:0, totalElements:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', parentId:'' });
  const [qDraft, setQDraft] = useState('');
  const [qApplied, setQApplied] = useState('');
  const debounceRef = useRef();
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [flatOptions, setFlatOptions] = useState([]);

  function refreshHierarchyOptions(){
    api.categories.list()
      .then(cats => setFlatOptions(cats))
      .catch(() => {/* ignore hierarchy fetch errors; listing handles errors */});
  }

  function load(){
    setLoading(true);
    if (qApplied) {
      api.admin.categories.search({ q: qApplied, page, size: 20, sort: 'path', direction: 'asc' })
        .then(res=>{ setItems(res.content || res); setPageMeta(res); setLoading(false); })
        .catch(e=>{ setError(e.message); setLoading(false); });
    } else {
      api.admin.categories.paged(page, 20)
        .then(res=>{ setItems(res.content); setPageMeta(res); setLoading(false); })
        .catch(e=>{ setError(e.message); setLoading(false); });
    }
  }
  useEffect(()=>{ load(); }, [page, qApplied]);
  useEffect(()=>{ refreshHierarchyOptions(); }, []);
  useEffect(()=>{
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{ setQApplied(qDraft); setPage(0); }, 400);
    return ()=> clearTimeout(debounceRef.current);
  }, [qDraft]);

  function handleEdit(cat){
    setEditingId(cat.id);
    setForm({ name: cat.name, description: cat.description || '', parentId: cat.parentId != null ? String(cat.parentId) : '' });
  }

  async function handleSubmit(e){
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        parent_id: form.parentId ? Number(form.parentId) : null
      };
      if (editingId) {
        await api.admin.categories.update(editingId, payload);
      } else {
        await api.admin.categories.create(payload);
      }
      setForm({ name:'', description:'', parentId:'' });
      setEditingId(null);
      refreshHierarchyOptions();
      load();
    } catch(e){ setError(e.message); } finally { setSubmitting(false); }
  }

  async function handleDelete(id){
  const ok = await import('../../utils/swal.js').then(m => m.confirm({ title: 'Delete category?', text: 'Its direct products and child categories will be reassigned to the parent. Continue?', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' }));
  if(!ok) return;
    try {
      await api.admin.categories.delete(id);
      refreshHierarchyOptions();
      load();
    } catch(e){ setError(e.message); }
  }

  const parentCandidates = useMemo(() => {
    if (!editingId) return flatOptions;
    const current = items.find(c => c.id === editingId);
    if (!current || !current.path) return flatOptions.filter(opt => opt.id !== editingId);
    const blockedPrefix = `${current.path}/`;
    return flatOptions.filter(opt => opt.id !== editingId && !(opt.path && opt.path.startsWith(blockedPrefix)));
  }, [editingId, flatOptions, items]);

  function resetForm(){
    setEditingId(null);
    setForm({ name:'', description:'', parentId:'' });
  }

  return (
    <div className="p-3 vstack gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">Categories</h2>
        <button className="btn btn-sm btn-primary" onClick={resetForm}>New</button>
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
                      <td>
                        <div style={{ paddingLeft: `${(c.depth ?? 0) * 16}px` }}>
                          {(c.depth ?? 0) > 0 && <span className="text-muted me-1">↳</span>}
                          <strong>{c.name}</strong>
                          {c.fullName && c.fullName !== c.name && (
                            <div className="text-muted small">{c.fullName}</div>
                          )}
                        </div>
                      </td>
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
                <select
                  className="form-select form-select-sm"
                  value={form.parentId}
                  onChange={e=>setForm(f=>({ ...f, parentId: e.target.value }))}
                  aria-label="Parent category"
                >
                  <option value="">No parent (top level)</option>
                  {parentCandidates.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label ?? opt.fullName ?? opt.name}</option>
                  ))}
                </select>
                <div className="d-flex gap-2">
                  <button disabled={submitting} type="submit" className="btn btn-primary flex-grow-1">{submitting? 'Saving...' : 'Save'}</button>
                  {editingId && <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>Cancel</button>}
                </div>
              </form>
              <div className="mt-3 vstack gap-2">
                <p className="text-muted small mb-0">Names must be unique. Parent categories form a hierarchy; the parent selection excludes the current category and its descendants.</p>
              </div>
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
