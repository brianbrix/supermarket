import { useMemo, useState } from 'react';

const SIZE_MAP = {
  sm: '0.9rem',
  md: '1.1rem',
  lg: '1.35rem',
};

export default function RatingStars({
  value = 0,
  count = null,
  size = 'md',
  showCount = false,
  ariaLabel,
  onChange,
  name,
  readOnly = false,
  className,
}) {
  const [hoverValue, setHoverValue] = useState(null);
  const displayValue = hoverValue ?? value ?? 0;
  const interactive = typeof onChange === 'function' && !readOnly;
  const fontSize = SIZE_MAP[size] || SIZE_MAP.md;

  const label = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    const rounded = (Number(value) || 0).toFixed(1);
    return `Rating: ${rounded} out of 5`;
  }, [ariaLabel, value]);

  const stars = useMemo(() => {
    return Array.from({ length: 5 }, (_, index) => {
      const starNumber = index + 1;
      const diff = Number(displayValue) - index;
      let icon = 'bi-star';
      if (diff >= 0.875) {
        icon = 'bi-star-fill';
      } else if (diff >= 0.375) {
        icon = 'bi-star-half';
      }
      const filled = diff >= 0.5;
      const currentChecked = Math.round(Number(value) * 10) / 10 === starNumber;
      return {
        icon,
        filled,
        starNumber,
        currentChecked,
      };
    });
  }, [displayValue, value]);

  return (
    <div
      className={joinClassNames('rating-stars d-inline-flex align-items-center gap-1', interactive && 'rating-stars--interactive', className)}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={label}
    >
      {stars.map(({ icon, starNumber }) => (
        <button
          key={starNumber}
          type="button"
          className={joinClassNames('rating-stars__star btn btn-link p-0 border-0', interactive ? 'rating-stars__star--interactive' : 'rating-stars__star--static')}
          style={{ fontSize, lineHeight: 1 }}
          aria-checked={Math.round(Number(value)) === starNumber}
          role={interactive ? 'radio' : undefined}
          onMouseEnter={interactive ? () => setHoverValue(starNumber) : undefined}
          onMouseLeave={interactive ? () => setHoverValue(null) : undefined}
          onFocus={interactive ? () => setHoverValue(starNumber) : undefined}
          onBlur={interactive ? () => setHoverValue(null) : undefined}
          onClick={interactive ? () => onChange?.(starNumber) : undefined}
          tabIndex={interactive ? 0 : -1}
          name={interactive ? name : undefined}
        >
          <i className={`bi ${icon}`} aria-hidden="true"></i>
          <span className="visually-hidden">{starNumber} star</span>
        </button>
      ))}
      {showCount && (
        <span className="rating-stars__count small text-muted ms-1">
          {formatCount(count)}
        </span>
      )}
    </div>
  );
}

function formatCount(count) {
  if (count == null) return '';
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count % 1000 >= 100 ? 1 : 0)}k`;
  }
  return `(${count})`;
}

function joinClassNames(...classes) {
  return classes.filter(Boolean).join(' ');
}
