import React from 'react';

// Optional sizes selector: pass sizes array (e.g. [10,20,50]) and onPageSizeChange handler.
// If provided, renders a dropdown; changing size resets page to 0 (handled by parent typically).
export function PaginationBar({
  page,
  size,
  totalElements,
  totalPages,
  first,
  last,
  onPageChange,
  alwaysVisible=false,
  sizes,
  onPageSizeChange,
  labelPageSize = 'Per page'
}) {
  const visible = alwaysVisible || totalPages > 1 || (sizes && sizes.length > 0);
  if (!visible) return null;
  const single = totalPages <= 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0', flexWrap: 'wrap', fontSize:'0.85rem' }}>
      <button disabled={first || single} onClick={() => onPageChange(Math.max(0, page-1))} className="btn btn-sm btn-outline-secondary">Prev</button>
      <span>Page {page + 1} / {totalPages || 1}</span>
      <button disabled={last || single} onClick={() => onPageChange(Math.min((totalPages||1)-1, page+1))} className="btn btn-sm btn-outline-secondary">Next</button>
      <span style={{ opacity: 0.7 }}>Total: {totalElements}</span>
      {sizes && sizes.length > 0 && onPageSizeChange && (
        <label className="d-flex align-items-center gap-1 mb-0" style={{ fontWeight: 500 }}>
          <span style={{ opacity:0.7 }}>{labelPageSize}</span>
          <select
            value={size}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
          >
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export default PaginationBar;
