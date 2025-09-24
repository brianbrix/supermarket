import { useState } from 'react';

// Simple reusable image component that swaps to a placeholder if the real image fails.
// Props: src, alt, className, style, placeholder(optional), onClick(optional)
export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  style = {},
  placeholder = '🧺',
  onClick
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`d-inline-flex align-items-center justify-content-center bg-light border rounded ${className}`}
        style={{ width: 120, height: 120, fontSize: '2.5rem', ...style }}
        aria-label={alt || 'placeholder image'}
        role="img"
        onClick={onClick}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ maxWidth: '100%', height: 'auto', ...style }}
      loading="lazy"
      onError={() => setErrored(true)}
      onClick={onClick}
    />
  );
}
