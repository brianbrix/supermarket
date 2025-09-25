import { useState, useRef, useEffect } from 'react';

/*
 InfoTooltip
 Props:
  - text (string | node): tooltip body
  - label (string) optional override for trigger visible label (default: i)
  - placement: 'top' | 'right' | 'bottom' | 'left' (visual only; simple positioning)
  - className: extra classes for wrapper

 Accessible keyboard + focus handling:
  - Focus or hover shows tooltip
  - ESC closes
  - Tooltip is not focus-trapped; simple informational pattern
*/
export default function InfoTooltip({ text, label='i', placement='top', className='' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const idRef = useRef(`tt-${Math.random().toString(36).slice(2)}`);

  useEffect(()=>{
    function onKey(e){ if(e.key==='Escape') setOpen(false); }
    if(open) window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span className={`info-tooltip position-relative d-inline-block ${className}`}
          onMouseEnter={()=>setOpen(true)}
          onMouseLeave={()=>setOpen(false)}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setOpen(false)}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-sm btn-outline-secondary p-0 d-inline-flex justify-content-center align-items-center"
        aria-describedby={open ? idRef.current : undefined}
        style={{width:18,height:18,lineHeight:'1',fontSize:'0.6rem',borderRadius:'50%'}}
        onClick={()=>setOpen(o=>!o)}
      >{label}</button>
      {open && (
        <div
          id={idRef.current}
          role="tooltip"
          className={`info-tooltip-popup bg-dark text-light p-2 rounded shadow-sm small position-absolute fade-in`}
          style={computePosition(triggerRef.current, placement)}
        >
          {text}
        </div>
      )}
    </span>
  );
}

function computePosition(triggerEl, placement){
  // Simple positioning + wider default width; allow horizontal expansion.
  const base = {whiteSpace:'normal', maxWidth:340, zIndex:1000};
  if(!triggerEl) return { ...base };
  switch(placement){
    case 'right': return { ...base, top:'50%', left:'100%', transform:'translate(10px,-50%)' };
    case 'left': return { ...base, top:'50%', right:'100%', transform:'translate(-10px,-50%)' };
    case 'bottom': return { ...base, top:'100%', left:'50%', transform:'translate(-50%,10px)' };
    case 'top':
    default: return { ...base, bottom:'100%', left:'50%', transform:'translate(-50%,-10px)' };
  }
}
