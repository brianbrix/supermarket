import { useEffect, useState, useRef } from 'react';
import { api, paymentBranding } from '../../services/api.js';
import '../../App.admin.css';

const PROVIDERS = ['MPESA','AIRTEL'];
// Hide legacy *_STK_PUSH entries; STK is now a capability via supportsStk flag on base channels.
const CHANNELS = [
  'MPESA_PAYBILL','MPESA_TILL','MPESA_P2P','MPESA_POCHI',
  'AIRTEL_COLLECTION'
];

export default function AdminPaymentOptions(){
  const [options,setOptions] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(null);
  const [editing,setEditing] = useState(null); // object or null
  const [form,setForm] = useState(baseForm());
  const [saving,setSaving] = useState(false);
  const dialogRef = useRef(null);

  function baseForm(){
    return {
      provider:'MPESA',
      channel:'MPESA_PAYBILL',
      displayName:'',
      shortDescription:'',
      instructionsMarkdown:'',
      paybillNumber:'',
      tillNumber:'',
      businessShortCode:'',
      recipientPhone:'',
      accountReferenceTemplate:'',
      supportsStk:true,
      active:true,
      sortOrder:0,
      metadataJson:''
    };
  }

  async function load(){
    setLoading(true);
    try {
      const data = await api.admin.payments.options.list();
      setOptions(data);
    } catch(e){
      setError(e.message);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); },[]);

  function openCreate(){ setEditing(null); setForm(baseForm()); dialogRef.current.showModal(); }
  function openEdit(opt){ setEditing(opt); setForm({ ...opt }); dialogRef.current.showModal(); }
  function close(){ if(dialogRef.current?.open) dialogRef.current.close(); }

  function onChange(e){ const {name,value,type,checked} = e.target; setForm(f=>({...f,[name]: type==='checkbox'? checked : value })); }
  function channelRequires(field){
    if(form.channel === 'MPESA_PAYBILL' && field==='paybillNumber') return true;
    if(form.channel === 'MPESA_TILL' && field==='tillNumber') return true;
  if(['MPESA_P2P','MPESA_POCHI'].includes(form.channel) && field==='recipientPhone') return true;
    return false;
  }

  async function save(){
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) {
        await api.admin.payments.options.update(editing.id, payload);
      } else {
        await api.admin.payments.options.create(payload);
      }
      await load();
      close();
    } catch(e){ setError(e.message); }
    finally { setSaving(false); }
  }

  async function remove(opt){
    if(!confirm(`Delete payment option '${opt.displayName}'?`)) return;
    try {
      await api.admin.payments.options.delete(opt.id);
      setOptions(o=>o.filter(x=>x.id!==opt.id));
    } catch(e){ setError(e.message); }
  }

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0">Payment Options</h1>
        <button className="btn btn-success btn-sm ms-auto" onClick={openCreate}><i className="bi bi-plus-lg me-1"></i>New Option</button>
      </div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {loading ? <p>Loading...</p> : (
        <div className="table-responsive small mb-4">
          <table className="table table-sm align-middle">
            <thead><tr><th>ID</th><th>Name</th><th>Provider</th><th>Channel</th><th>Active</th><th>STK</th><th>Sort</th><th></th></tr></thead>
            <tbody>
              {options.length===0 && <tr><td colSpan={8} className="text-center text-muted">No options configured</td></tr>}
              {options.map(o => {
                const b = paymentBranding[o.provider] || { color:'#555', bg:'#eee', logoText:o.provider };
                return (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td className="fw-semibold" style={{color:b.color}}>{o.displayName}</td>
                    <td>{o.provider}</td>
                    <td className="text-nowrap">{o.channel}</td>
                    <td>{o.active ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>}</td>
              <td>{o.supportsStk && !['MPESA_STK_PUSH', 'AIRTEL_STK_PUSH'].includes(o.channel) ? <span className="badge bg-info text-dark">STK</span> : ''}</td>
                    <td>{o.sortOrder ?? 0}</td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-outline-primary btn-sm me-1" onClick={()=>openEdit(o)}><i className="bi bi-pencil"></i></button>
                      <button className="btn btn-outline-danger btn-sm" onClick={()=>remove(o)}><i className="bi bi-trash"></i></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <dialog ref={dialogRef} className="payment-option-modal admin-config" style={{padding:0,border:'none',borderRadius:16}}>
        <div className="pom-surface border-0 p-0" style={{maxWidth:720}}>
          <form onSubmit={e=>{e.preventDefault(); save();}} className="d-flex flex-column" style={{maxWidth:720}}>
            <div className="p-3 border-bottom d-flex align-items-center gap-2 pom-header" style={{borderTopLeftRadius:16,borderTopRightRadius:16}}>
              <h2 className="h6 mb-0">{editing ? 'Edit' : 'Create'} Payment Option</h2>
              <button type="button" onClick={close} className="btn-close ms-auto" aria-label="Close"></button>
            </div>
            <div className="p-3 overflow-auto pom-body" style={{maxHeight:'70vh'}}>
              <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label small">Provider</label>
                <select name="provider" className="form-select form-select-sm" value={form.provider} onChange={onChange}>{PROVIDERS.map(p=> <option key={p}>{p}</option>)}</select>
              </div>
              <div className="col-md-4">
                <label className="form-label small">Channel</label>
                <select name="channel" className="form-select form-select-sm" value={form.channel} onChange={onChange}>{CHANNELS.map(c=> <option key={c}>{c}</option>)}</select>
              </div>
              <div className="col-md-4">
                <label className="form-label small">Sort Order</label>
                <input name="sortOrder" type="number" className="form-control form-control-sm" value={form.sortOrder} onChange={onChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label small">Display Name *</label>
                <input name="displayName" required className="form-control form-control-sm" value={form.displayName} onChange={onChange} />
              </div>
              <div className="col-md-6">
                <label className="form-label small">Short Description</label>
                <input name="shortDescription" className="form-control form-control-sm" value={form.shortDescription} onChange={onChange} />
              </div>
              <div className="col-12">
                <label className="form-label small">Instructions (Markdown)</label>
                <textarea name="instructionsMarkdown" rows={3} className="form-control form-control-sm" value={form.instructionsMarkdown} onChange={onChange} placeholder={'e.g. **Steps**:\n1. Go to M-Pesa\n2. Choose Lipa na M-Pesa'} />
              </div>
              {/* Conditional fields */}
              { (form.channel==='MPESA_PAYBILL') && (
                <div className="col-md-4">
                  <label className="form-label small">PayBill Number *</label>
                  <input name="paybillNumber" required={channelRequires('paybillNumber')} className="form-control form-control-sm" value={form.paybillNumber} onChange={onChange} />
                </div>) }
              { (form.channel==='MPESA_TILL') && (
                <div className="col-md-4">
                  <label className="form-label small">Till Number *</label>
                  <input name="tillNumber" required={channelRequires('tillNumber')} className="form-control form-control-sm" value={form.tillNumber} onChange={onChange} />
                </div>) }
              { (['MPESA_P2P','MPESA_POCHI'].includes(form.channel)) && (
                <div className="col-md-4">
                  <label className="form-label small">Recipient Phone *</label>
                  <input name="recipientPhone" required={channelRequires('recipientPhone')} className="form-control form-control-sm" value={form.recipientPhone} onChange={onChange} />
                </div>) }
              <div className="col-md-4">
                <label className="form-label small">Account Ref Template</label>
                <input name="accountReferenceTemplate" className="form-control form-control-sm" value={form.accountReferenceTemplate} onChange={onChange} placeholder="ORDER-{orderId}" />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Business Short Code</label>
                <input name="businessShortCode" className="form-control form-control-sm" value={form.businessShortCode} onChange={onChange} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Metadata JSON</label>
                <input name="metadataJson" className="form-control form-control-sm" value={form.metadataJson} onChange={onChange} placeholder='{"key":"value"}' />
              </div>
              <div className="col-md-3 form-check ms-2">
                <input name="supportsStk" id="supportsStk" type="checkbox" className="form-check-input" checked={form.supportsStk} onChange={onChange} />
                <label htmlFor="supportsStk" className="form-check-label small">Supports STK</label>
              </div>
              <div className="col-md-3 form-check ms-2">
                <input name="active" id="active" type="checkbox" className="form-check-input" checked={form.active} onChange={onChange} />
                <label htmlFor="active" className="form-check-label small">Active</label>
              </div>
              </div>
            </div>
            <div className="p-3 d-flex gap-2 justify-content-end border-top pom-footer" style={{background:'rgba(255,255,255,0.55)'}}>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={close}>Cancel</button>
              <button disabled={saving} type="submit" className="btn btn-success btn-sm">{saving? 'Saving…':'Save'}</button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
