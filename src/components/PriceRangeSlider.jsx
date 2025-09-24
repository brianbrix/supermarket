import { useEffect, useRef, useState } from 'react';

// A simple dual range slider built from two range inputs layered together.
// Props: min, max, valueMin, valueMax, onChange({min, max})
export default function PriceRangeSlider({ min, max, valueMin, valueMax, onChange, step=1 }) {
  const [internalMin, setInternalMin] = useState(valueMin);
  const [internalMax, setInternalMax] = useState(valueMax);
  const minRef = useRef(null);
  const maxRef = useRef(null);

  useEffect(()=>{ setInternalMin(valueMin); }, [valueMin]);
  useEffect(()=>{ setInternalMax(valueMax); }, [valueMax]);

  function clampValues(nextMin, nextMax){
    if (nextMin > nextMax) {
      // swap to maintain invariant
      return [nextMax, nextMax];
    }
    return [nextMin, nextMax];
  }

  function handleMin(e){
    const v = Number(e.target.value);
    const [nm, nx] = clampValues(v, internalMax);
    setInternalMin(nm);
    onChange({ min: nm, max: nx });
  }
  function handleMax(e){
    const v = Number(e.target.value);
    const [nm, nx] = clampValues(internalMin, v);
    setInternalMax(nx);
    onChange({ min: nm, max: nx });
  }

  const percentMin = ((internalMin - min) / (max - min)) * 100;
  const percentMax = ((internalMax - min) / (max - min)) * 100;

  return (
    <div className="price-range-slider">
      <div className="position-relative" style={{height:'38px'}}>
        <div className="range-track bg-body-secondary position-absolute top-50 start-0 w-100 translate-middle-y rounded-pill" style={{height:'6px'}}></div>
        <div className="range-active bg-success position-absolute top-50 translate-middle-y" style={{height:'6px', left:`${percentMin}%`, width:`${percentMax - percentMin}%`, borderRadius:'6px'}}></div>
        <input ref={minRef} type="range" min={min} max={max} step={step} value={internalMin} onChange={handleMin} aria-label="Minimum price" className="form-range position-absolute top-0 start-0 w-100" style={{pointerEvents:'auto'}} />
        <input ref={maxRef} type="range" min={min} max={max} step={step} value={internalMax} onChange={handleMax} aria-label="Maximum price" className="form-range position-absolute top-0 start-0 w-100" style={{pointerEvents:'auto'}} />
      </div>
      <div className="d-flex justify-content-between small mt-1">
        <span>{internalMin}</span>
        <span>{internalMax}</span>
      </div>
    </div>
  );
}
