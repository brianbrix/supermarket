import React from 'react';

export function PaginationBar({ page, size, totalElements, totalPages, first, last, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0', flexWrap: 'wrap' }}>
      <button disabled={first} onClick={() => onPageChange(Math.max(0, page-1))}>Prev</button>
      <span>Page {page + 1} / {totalPages}</span>
      <button disabled={last} onClick={() => onPageChange(Math.min(totalPages-1, page+1))}>Next</button>
      <span style={{ opacity: 0.7 }}>Total: {totalElements}</span>
    </div>
  );
}

export default PaginationBar;
