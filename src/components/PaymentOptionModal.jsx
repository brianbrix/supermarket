import { useEffect, useRef, useState } from 'react';
import { paymentBranding } from '../services/api.js';

// Very tiny markdown -> HTML (safe subset) for **bold**, *italics*, line breaks
// Simple templating: replace {{placeholder}} occurrences with provided map values first
function applyTemplate(md='', vars={}) {
  return md.replace(/{{\s*(\w+)\s*}}/g, (m, key) => (vars[key] != null ? String(vars[key]) : m));
}

function renderMarkdown(md='') {
  if (!md) return '';
  return md
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/\n/g,'<br/>');
}

export function PaymentOptionModal({ option, open, onClose, onInitiate, onReconcile, reconciling, paymentStatus, loading, phone, setPhone, accountRef, setAccountRef, amount, paymentHookStatus }) {
  const dialogRef = useRef(null);
  const phoneInputRef = useRef(null);
  const manualPhoneRef = useRef(null);
  const [reconAmount, setReconAmount] = useState(amount);
  const [manualPhone, setManualPhone] = useState('');
  const [manualPhoneDirty, setManualPhoneDirty] = useState(false);

  // Keep manual phone auto-populated from main phone until user edits the manual field
  useEffect(()=>{
    if (!manualPhoneDirty) {
      setManualPhone(phone || '');
    }
  }, [phone, manualPhoneDirty]);
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!open && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [open]);

  if (!option) return null;
  const branding = paymentBranding[option.provider] || { color:'#222', bg:'#f5f5f5', logoText: option.provider };
  const requiresAccountRef = /PAYBILL|TILL/i.test(option.channel) && option.accountReferenceTemplate;
  const supportsStk = option.supportsStk;

  // Build template variables for instructions
  const vars = {
    amount,
    paybill: option.paybillNumber,
    till: option.tillNumber,
    shortcode: option.businessShortCode || option.paybillNumber,
    account: accountRef || '',
    phone,
    channel: option.channel
  };
  const instructions = option.instructionsMarkdown ? renderMarkdown(applyTemplate(option.instructionsMarkdown, vars)) : '';

  return (
    <dialog ref={dialogRef} className="payment-option-modal" onCancel={onClose}>
      <div className="pom-surface border-0 p-0" style={{minWidth:'min(500px, 92vw)'}}>
        <div style={{borderBottom:`2px solid ${branding.color}`}} className="pom-header p-3 d-flex align-items-center gap-2">
          {branding.logo ? (
            <div className="pom-logo-wrapper" style={{width:48,height:48,position:'relative'}}>
              <img src={branding.logo} alt={branding.logoText} className="pom-logo" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:12,border:`2px solid ${branding.ring||branding.color}`}} />
            </div>
          ) : (
            <div style={{width:40,height:40,borderRadius:'8px',background:branding.color,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600}}>{branding.logoText[0]}</div>
          )}
          <div>
            <h2 className="h6 mb-0" style={{color:branding.color}}>{option.displayName}</h2>
            <p className="small mb-0 text-muted">{option.shortDescription || option.channel}</p>
          </div>
          <button type="button" className="btn-close ms-auto" aria-label="Close" onClick={onClose}></button>
        </div>
        <div className="p-3 pom-body">
          <form onSubmit={(e)=>{ e.preventDefault(); onInitiate(); }} className="d-flex flex-column gap-3">
            <div>
              <label className="form-label small">Phone Number</label>
              <input ref={phoneInputRef} required type="tel" className="form-control" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07xx xxx xxx" />
            </div>
            {requiresAccountRef && (
              <div>
                <label className="form-label small">Account Reference</label>
                <input type="text" className="form-control" value={accountRef} onChange={e=>setAccountRef(e.target.value)} placeholder={option.accountReferenceTemplate?.replace('{orderId}','1234')} />
                <div className="form-text">Template: {option.accountReferenceTemplate}</div>
              </div>
            )}
            {supportsStk && <div className="alert alert-info py-2 small mb-0">A prompt will appear on your phone after you click Continue.<br/> Enter you PIN and send.</div>}
            <div className="d-flex gap-2 justify-content-end border-bottom pb-3 mb-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={loading} className="btn btn-success">{loading ? 'Processing…' : (supportsStk ? 'Continue' : 'Record Payment')}</button>
            </div>
            {instructions && (
              <div className="slide-up">
                <p className="small fw-semibold mb-2 instructions-heading">If the phone prompt or automatic process does not work, follow these steps first:</p>
                <div className="small mb-3" dangerouslySetInnerHTML={{ __html: instructions }} />
              </div>
            )}
            {/* Manual reconciliation block (always visible now, below steps) */}
            <div className="reconcile-block border rounded p-2 fade-in">
              <div className="manual-divider small text-uppercase fw-semibold mb-2">Manual Confirmation</div>
              <p className="small fw-semibold mb-2 mb-sm-1">Already paid? <span className="fw-normal">Confirm below:</span></p>
              {supportsStk && <p className="small text-muted mb-2 mt-n1">(Use if you completed payment but no confirmation arrived or you paid manually)</p>}
              <div className="row g-2 align-items-end">
                <div className="col-12 col-sm-5">
                  <label className="form-label small mb-1">Phone Used <span className="text-muted fw-normal">(required)</span></label>
                  <input
                    ref={manualPhoneRef}
                    type="tel"
                    className="form-control form-control-sm"
                    value={manualPhone}
                    onChange={e=>{ const v = e.target.value; setManualPhone(v); if (!manualPhoneDirty && v !== (phone||'')) setManualPhoneDirty(true); }}
                    placeholder={phone || '07xx xxx xxx'}
                  />
                  <div className="form-text">Enter the exact number that sent the payment.</div>
                </div>
                <div className="col-12 col-sm-4">
                  <label className="form-label small mb-1">Amount <span className="text-muted fw-normal">(optional)</span></label>
                  <input type="number" min="0" step="0.01" className="form-control form-control-sm" value={reconAmount} onChange={e=>setReconAmount(e.target.value)} placeholder={amount} />
                  <div className="form-text">Defaults to order total if left blank.</div>
                </div>
                <div className="col-12 col-sm-3 d-grid">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={reconciling}
                    onClick={()=>{
                      const usedPhone = manualPhone.trim() || phone;
                      if (!usedPhone) {
                        // Prefer focusing manual field if empty
                        (manualPhoneRef.current || phoneInputRef.current)?.focus();
                        return;
                      }
                      onReconcile?.(usedPhone, reconAmount || undefined);
                    }}
                  >{reconciling ? 'Checking…' : 'Confirm'}</button>
                </div>
                <div className="col-12">
                  {!(manualPhone.trim() || phone) && <p className="small text-danger mb-1">Phone number is required to confirm.</p>}
                  {reconciling && <p className="small text-muted mb-1">Contacting provider…</p>}
                  {paymentStatus === 'INITIATED' && !reconciling && <p className="small text-warning mb-1">Still pending. Try again shortly.</p>}
                  {paymentStatus === 'SUCCESS' && <p className="small text-success mb-1">Payment confirmed!</p>}
                  {paymentStatus === 'FAILED' && <p className="small text-danger mb-1">Payment failed.</p>}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  );
}

export default PaymentOptionModal;
