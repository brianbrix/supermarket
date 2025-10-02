import { Link } from 'react-router-dom';
import {
  PROMO_VARIANTS,
  normalizePromoVariant,
  normalizePromoContent,
  normalizePromoLinkType,
} from '../data/catalogPresentation.js';

const VARIANT_MAP = new Map(PROMO_VARIANTS.map(variant => [variant.id, variant]));

const buildInternalLink = (linkType, target) => {
  if (!target) return '';
  const params = new URLSearchParams();
  if (linkType === 'category') {
    params.set('categoryId', target);
  }
  if (linkType === 'tag') {
    params.append('tags[]', target);
  }
  const qs = params.toString();
  return `/products${qs ? `?${qs}` : ''}`;
};

export default function CatalogPromoBanner({ variant, content, placement = 'top', className = '' }) {
  const normalizedVariant = normalizePromoVariant(variant);
  if (normalizedVariant === 'none') {
    return null;
  }

  const config = VARIANT_MAP.get(normalizedVariant) ?? VARIANT_MAP.get('none');
  if (!config || normalizedVariant === 'none') {
    return null;
  }

  const resolvedContent = normalizePromoContent(content);
  const accent = config.accent || 'primary';
  const iconName = config.icon || 'sparkles';
  const eyebrow = resolvedContent.eyebrow || 'Featured';
  const headline = resolvedContent.headline || config.headline || config.title;
  const description = resolvedContent.body || config.body || '';
  const ctaLabel = resolvedContent.ctaLabel || config.ctaLabel || '';
  const linkType = normalizePromoLinkType(resolvedContent.ctaLinkType);
  const linkTarget = resolvedContent.ctaLinkTarget || '';

  let ctaNode = null;
  if (ctaLabel) {
    if (linkType === 'url' && linkTarget) {
      ctaNode = (
        <a
          href={linkTarget}
          className={`btn btn-${accent} btn-sm`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {ctaLabel}
        </a>
      );
    } else if ((linkType === 'category' || linkType === 'tag') && linkTarget) {
      const href = buildInternalLink(linkType, linkTarget);
      ctaNode = (
        <Link
          to={href}
          className={`btn btn-${accent} btn-sm`}
        >
          {ctaLabel}
        </Link>
      );
    } else {
      const helpText = linkType === 'none'
        ? 'This campaign intentionally has no link.'
        : 'Add a link target to enable this button.';
      ctaNode = (
        <span
          className={`btn btn-${accent} btn-sm disabled`}
          aria-disabled="true"
          title={helpText}
        >
          {ctaLabel}
        </span>
      );
    }
  }

  const classes = [
    'catalog-promo-banner',
    `catalog-promo-banner--${placement}`,
    `catalog-promo-banner--accent-${accent}`,
  ];
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')}>
      <div className="catalog-promo-banner__surface">
        <div className={`catalog-promo-banner__icon text-${accent}`} aria-hidden="true">
          <i className={`bi bi-${iconName}`}></i>
        </div>
        <div className="catalog-promo-banner__content">
          {eyebrow && <span className={`catalog-promo-banner__eyebrow text-${accent}`}>{eyebrow}</span>}
          <h3 className="catalog-promo-banner__headline">{headline}</h3>
          {description && <p className="catalog-promo-banner__copy text-muted mb-0">{description}</p>}
        </div>
        {ctaNode && (
          <div className="catalog-promo-banner__cta">
            {ctaNode}
          </div>
        )}
      </div>
    </div>
  );
}
