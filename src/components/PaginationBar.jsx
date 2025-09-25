import React from 'react';

export function PaginationBar({ page, size, totalElements, totalPages, first, last, onPageChange, alwaysVisible=false }) {
  const visible = alwaysVisible || totalPages > 1;
  if (!visible) return null;
  const single = totalPages <= 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0', flexWrap: 'wrap', fontSize:'0.85rem' }}>
      <button disabled={first || single} onClick={() => onPageChange(Math.max(0, page-1))} className="btn btn-sm btn-outline-secondary">Prev</button>
      <span>Page {page + 1} / {totalPages || 1}</span>
      <button disabled={last || single} onClick={() => onPageChange(Math.min((totalPages||1)-1, page+1))} className="btn btn-sm btn-outline-secondary">Next</button>
      <span style={{ opacity: 0.7 }}>Total: {totalElements}</span>
    </div>
  );
}

export default PaginationBar;
