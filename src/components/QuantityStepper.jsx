import { useCallback } from 'react';

export default function QuantityStepper({ value, min=1, max=9999, onChange, size='md', ariaLabel='Quantity' }) {
  const dec = useCallback(() => {
    onChange(Math.max(min, value - 1));
  }, [value, min, onChange]);
  const inc = useCallback(() => {
    onChange(Math.min(max, value + 1));
  }, [value, max, onChange]);
  function direct(e) {
    const v = Number(e.target.value);
    if (Number.isNaN(v)) return; 
    onChange(Math.min(max, Math.max(min, v)));
  }
  const sizeClass = size === 'sm' ? 'form-control form-control-sm' : 'form-control';
  const btnSize = size === 'sm' ? 'btn btn-outline-secondary btn-sm' : 'btn btn-outline-secondary';
  return (
    <div className="input-group" style={{maxWidth: size==='sm' ? 110 : 160}}>
      <button type="button" className={btnSize} onClick={dec} aria-label={`Decrease ${ariaLabel}`}>-</button>
      <input type="number" className={`${sizeClass} text-center`} value={value} min={min} max={max} onChange={direct} aria-label={ariaLabel} />
      <button type="button" className={btnSize} onClick={inc} aria-label={`Increase ${ariaLabel}`}>+</button>
    </div>
  );
}
