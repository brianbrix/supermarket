import { useEffect, useState } from 'react';

// Replaced slider UI with two numeric inputs while keeping the same external API.
// Props: min, max, valueMin, valueMax, onChange({min, max}), step
export default function PriceRangeSlider({ min, max, valueMin, valueMax, onChange, step = 1 }) {
  const [internalMin, setInternalMin] = useState(valueMin);
  const [internalMax, setInternalMax] = useState(valueMax);

  // Sync internal state with controlled values from parent
  useEffect(() => { setInternalMin(valueMin); }, [valueMin]);
  useEffect(() => { setInternalMax(valueMax); }, [valueMax]);

  function normalize(nextMin, nextMax) {
    if (isNaN(nextMin)) nextMin = min;
    if (isNaN(nextMax)) nextMax = max;
    if (nextMin < min) nextMin = min;
    if (nextMax > max) nextMax = max;
    if (nextMin > nextMax) {
      // Collapse to the entered value to avoid flip-flop UX
      nextMax = nextMin;
    }
    return [nextMin, nextMax];
  }

  function commit(nextMin, nextMax) {
    const [nm, nx] = normalize(nextMin, nextMax);
    setInternalMin(nm);
    setInternalMax(nx);
    onChange({ min: nm, max: nx });
  }

  function handleMinChange(e) {
    const v = Number(e.target.value);
    commit(v, internalMax);
  }

  function handleMaxChange(e) {
    const v = Number(e.target.value);
    commit(internalMin, v);
  }

  return (
    <div className="price-range-inputs">
      <div className="row g-2 align-items-end">
        <div className="col-6">
          <label className="form-label small mb-1" htmlFor="priceMin">Min</label>
          <input
            id="priceMin"
            type="number"
            className="form-control form-control-sm"
            min={min}
            max={internalMax}
            step={step}
            value={internalMin}
            onChange={handleMinChange}
            aria-label="Minimum price"
          />
        </div>
        <div className="col-6">
          <label className="form-label small mb-1" htmlFor="priceMax">Max</label>
            <input
              id="priceMax"
              type="number"
              className="form-control form-control-sm"
              min={internalMin}
              max={max}
              step={step}
              value={internalMax}
              onChange={handleMaxChange}
              aria-label="Maximum price"
            />
        </div>
      </div>
      <div className="d-flex justify-content-between mt-1 small text-muted">
        <span>{internalMin}</span>
        <span>{internalMax}</span>
      </div>
    </div>
  );
}
