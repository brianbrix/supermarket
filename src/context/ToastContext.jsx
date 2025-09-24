import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type='info', ttl=3000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ttl);
  }, []);
  const value = { push };

  return (
    <ToastContext.Provider value={value}>
      {children}
  <div className="toast-container position-fixed p-3 toast-container-responsive" style={{zIndex:1080, minWidth:'260px', top:0, right:0}} aria-live="polite" aria-atomic="true">
        {toasts.map(t => {
          const msg = (t.message ?? '').toString();
          return (
            <div key={t.id} className="toast show mb-2 border-0 shadow" role={t.type==='error' ? 'alert' : 'status'} aria-live="assertive" aria-atomic="true" style={{opacity:1}}>
              <div className={`toast-header ${t.type==='error' ? 'bg-danger text-white' : 'bg-success text-white'} py-1`}> 
                <strong className="me-auto small d-flex align-items-center gap-1">
                  {t.type==='error' ? '⚠️' : '✅'} {t.type==='error' ? 'Error' : 'Notice'}
                </strong>
                <button type="button" className="btn-close btn-close-white ms-2" aria-label="Close" onClick={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}></button>
              </div>
              <div className="toast-body small" style={{display:'block'}}>{msg || <em className="text-muted">(no message)</em>}</div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(){
  return useContext(ToastContext);
}
