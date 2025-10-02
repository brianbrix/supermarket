import { useEffect, useId, useMemo, useState } from 'react';

export default function AdminCollapsibleSection({
  title,
  description,
  defaultOpen = true,
  children,
  className = '',
  bodyClassName = 'mt-3',
  actions = null,
  id: providedId,
  onToggle,
  rememberState = false,
  persistKey,
}) {
  const generatedId = useId();
  const safeGeneratedId = typeof generatedId === 'string' ? generatedId.replace(/[:]/g, '') : 'section';
  const sectionId = providedId || `admin-collapsible-${safeGeneratedId}`;
  const contentId = `${sectionId}-content`;
  const storageKey = useMemo(() => {
    if (!rememberState) {
      return null;
    }
    if (persistKey && typeof persistKey === 'string') {
      return persistKey;
    }
    return `admin-collapsible:${sectionId}`;
  }, [persistKey, rememberState, sectionId]);
  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored !== null) {
          return stored === 'true';
        }
      } catch (err) {
        // ignore storage errors and fall back to default
      }
    }
    return defaultOpen;
  });

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (typeof onToggle === 'function') {
        onToggle(next);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, String(isOpen));
    } catch (err) {
      // Best-effort persistence; ignore storage failures silently
    }
  }, [isOpen, storageKey]);

  return (
    <section className={`admin-collapsible-section ${className}`.trim()}>
      <div className="d-flex flex-column flex-lg-row gap-3 align-items-lg-start justify-content-between">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="h5 mb-0" id={sectionId}>{title}</h2>
          </div>
          {description ? (
            <p className="text-muted small mb-0 mt-1">{description}</p>
          ) : null}
        </div>
        <div className="d-flex align-items-center gap-2 ms-lg-auto">
          {actions}
          <button
            type="button"
            className="btn btn-link btn-sm p-0 d-inline-flex align-items-center gap-1"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-controls={contentId}
          >
            <i className={`bi bi-${isOpen ? 'chevron-up' : 'chevron-down'}`}></i>
            <span>{isOpen ? 'Hide section' : 'Show section'}</span>
          </button>
        </div>
      </div>
      <div id={contentId} className={`collapse${isOpen ? ' show' : ''}`} aria-labelledby={sectionId}>
        <div className={bodyClassName}>{children}</div>
      </div>
    </section>
  );
}
