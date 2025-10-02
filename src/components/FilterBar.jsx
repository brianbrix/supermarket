import React from 'react';

/*
 Generic horizontal filter bar container.
 Usage:
 <FilterBar>
   <FilterBar.Group>
     <FilterBar.Field label="Search">
       <input ... />
     </FilterBar.Field>
   </FilterBar.Group>
 </FilterBar>
*/
export function FilterBar({ children, className='' }) {
  return (
    <div className={`card p-2 mb-3 small ${className}`}>
      <div className="row g-2 align-items-end">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, width }) {
  return (
    <div className={width || 'col-6 col-md-2'}>
      {label && <label className="form-label mb-1">{label}</label>}
      {children}
    </div>
  );
}
FilterBar.Field = Field;

function Group({ children }) { return <>{children}</>; }
FilterBar.Group = Group;

function Reset({ onClick, disabled }) {
  return (
    <div className="col-6 col-md-1">
      <label className="form-label mb-1">&nbsp;</label>
      <button type="button" className="btn btn-outline-secondary btn-sm w-100" disabled={disabled} onClick={onClick}>Reset</button>
    </div>
  );
}
FilterBar.Reset = Reset;

function Extra({ children, className = '' }) {
  return (
    <div className={`col-12 col-md-auto ms-md-auto d-flex justify-content-md-end ${className}`}>
      {children}
    </div>
  );
}
FilterBar.Extra = Extra;

export default FilterBar;
