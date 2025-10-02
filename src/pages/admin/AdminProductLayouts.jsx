import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import {
  DEFAULT_FILTER_STYLE,
  FILTER_STYLE_OPTIONS,
  normalizeFilterStyle,
  PROMO_VARIANTS,
  DEFAULT_PROMO_VARIANT,
  DEFAULT_PROMO_FREQUENCY,
  normalizePromoVariant,
  normalizePromoFrequency,
  DEFAULT_PROMO_CONTENT,
  PROMO_LINK_TYPES,
  normalizePromoContent,
  normalizePromoLinkType,
} from '../../data/catalogPresentation.js';

const LAYOUT_OPTIONS = [
  {
    id: 'grid-classic',
    title: 'Classic Grid',
    description: 'Four-column grid with balanced cards. Great default for mixed catalog sizes.',
    features: [
      'Shows four products per row on desktop',
      'Highlights ratings and add-to-cart equally',
      'Responsive down to two columns on tablets'
    ]
  },
  {
    id: 'grid-comfort',
    title: 'Comfort Grid',
    description: 'Three-card grid with increased breathing room and taller imagery.',
    features: [
      'Emphasizes photography with taller cards',
      'Three products per row on desktop, two on tablets',
      'Ideal for premium or seasonal collections'
    ]
  },
  {
    id: 'grid-cards',
    title: 'Showcase Cards',
    description: 'Two-up card tiles with soft gradient panels and prominent CTAs.',
    features: [
      'Focuses on storytelling with wider cards',
      'Best for curated or featured product lines',
      'Overflow-safe on mobile with single column layout'
    ]
  },
  {
    id: 'list-media',
    title: 'Media List',
    description: 'Magazine-style list with left-aligned imagery and detailed copy.',
    features: [
      'Great for long descriptions and comparison shoppers',
      'Shows extra metadata like brand and availability inline',
      'Switches to stacked media row on small screens'
    ]
  },
  {
    id: 'list-dense',
    title: 'Compact List',
    description: 'High-density list built for power users scanning inventory quickly.',
    features: [
      'Fits up to eight products above the fold',
      'Keeps imagery small to prioritise pricing',
      'Perfect for B2B or wholesale style browsing'
    ]
  }
];

const LAYOUT_IDS = new Set(LAYOUT_OPTIONS.map(option => option.id));
const DEFAULT_LAYOUT = 'grid-classic';

function normalizeLayout(value) {
  if (value == null) return DEFAULT_LAYOUT;
  const normalized = String(value).trim().toLowerCase();
  return LAYOUT_IDS.has(normalized) ? normalized : DEFAULT_LAYOUT;
}

const parseBoolean = (value, fallback = false) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const clonePromoContent = (content = DEFAULT_PROMO_CONTENT) => normalizePromoContent({
  ...DEFAULT_PROMO_CONTENT,
  ...(content || {}),
});

const parsePromoContentValue = (value) => {
  if (!value) return clonePromoContent();
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return clonePromoContent(parsed);
    } catch (err) {
      return clonePromoContent();
    }
  }
  if (typeof value === 'object') {
    return clonePromoContent(value);
  }
  return clonePromoContent();
};

const promoContentsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    (a.eyebrow || '') === (b.eyebrow || '')
    && (a.headline || '') === (b.headline || '')
    && (a.body || '') === (b.body || '')
    && (a.ctaLabel || '') === (b.ctaLabel || '')
    && (a.ctaLinkType || 'none') === (b.ctaLinkType || 'none')
    && (a.ctaLinkTarget || '') === (b.ctaLinkTarget || '')
  );
};


export default function AdminProductLayouts() {
  const [selectedLayout, setSelectedLayout] = useState(DEFAULT_LAYOUT);
  const [initialLayout, setInitialLayout] = useState(DEFAULT_LAYOUT);
  const [filterStyle, setFilterStyle] = useState(DEFAULT_FILTER_STYLE);
  const [initialFilterStyle, setInitialFilterStyle] = useState(DEFAULT_FILTER_STYLE);
  const [topPromoVariant, setTopPromoVariant] = useState(DEFAULT_PROMO_VARIANT);
  const [inlinePromoVariant, setInlinePromoVariant] = useState(DEFAULT_PROMO_VARIANT);
  const [inlinePromoFrequency, setInlinePromoFrequency] = useState(DEFAULT_PROMO_FREQUENCY);
  const [topPromoContent, setTopPromoContent] = useState(() => clonePromoContent());
  const [inlinePromoContent, setInlinePromoContent] = useState(() => clonePromoContent());
  const [initialPromos, setInitialPromos] = useState({
    top: DEFAULT_PROMO_VARIANT,
    inline: DEFAULT_PROMO_VARIANT,
    inlineFrequency: DEFAULT_PROMO_FREQUENCY,
    topContent: clonePromoContent(),
    inlineContent: clonePromoContent(),
  });
  const [brandRequiresCategory, setBrandRequiresCategory] = useState(false);
  const [initialBrandRequiresCategory, setInitialBrandRequiresCategory] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { push } = useToast();
  const { refresh } = useSettings();

  useEffect(() => {
    let cancelled = false;
    setCategoryLoading(true);
    api.categories.list()
      .then(list => {
        if (cancelled) return;
        if (Array.isArray(list)) {
          setCategoryOptions(list);
        } else {
          setCategoryOptions([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCategoryOptions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setCategoryLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.admin.systemSettings.list()
      .then(settings => {
        if (!active) return;
        const settingsArray = Array.isArray(settings) ? settings : [];
        const map = new Map(settingsArray.map(entry => [entry?.key, entry?.value]));

        const layout = normalizeLayout(map.get('catalog.product_layout'));
        const resolvedFilterStyle = normalizeFilterStyle(map.get('catalog.filter_style'));
        const resolvedTopPromo = normalizePromoVariant(map.get('catalog.promo_top_variant'));
        const resolvedInlinePromo = normalizePromoVariant(map.get('catalog.promo_inline_variant'));
        const resolvedFrequency = normalizePromoFrequency(map.get('catalog.promo_inline_frequency'));
        const topContentRaw = map.get('catalog.promo_top_content')
          ?? map.get('catalog.promo_top_content_json')
          ?? map.get('catalog.promo_top_content_v2');
        const inlineContentRaw = map.get('catalog.promo_inline_content')
          ?? map.get('catalog.promo_inline_content_json')
          ?? map.get('catalog.promo_inline_content_v2');
        const resolvedTopContent = parsePromoContentValue(topContentRaw);
        const resolvedInlineContent = parsePromoContentValue(inlineContentRaw);
        const resolvedBrandRequiresCategory = parseBoolean(map.get('catalog.brand_requires_category'), false);

        setSelectedLayout(layout);
        setInitialLayout(layout);
        setFilterStyle(resolvedFilterStyle);
        setInitialFilterStyle(resolvedFilterStyle);
        setTopPromoVariant(resolvedTopPromo);
        setInlinePromoVariant(resolvedInlinePromo);
        setInlinePromoFrequency(resolvedFrequency);
        setTopPromoContent(resolvedTopContent);
        setInlinePromoContent(resolvedInlineContent);
        setInitialPromos({
          top: resolvedTopPromo,
          inline: resolvedInlinePromo,
          inlineFrequency: resolvedFrequency,
          topContent: resolvedTopContent,
          inlineContent: resolvedInlineContent,
        });
        setBrandRequiresCategory(resolvedBrandRequiresCategory);
        setInitialBrandRequiresCategory(resolvedBrandRequiresCategory);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setError(err?.message || 'Failed to load product layout setting');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const isDirty = selectedLayout !== initialLayout
    || filterStyle !== initialFilterStyle
    || topPromoVariant !== initialPromos.top
    || inlinePromoVariant !== initialPromos.inline
    || inlinePromoFrequency !== initialPromos.inlineFrequency
    || !promoContentsEqual(topPromoContent, initialPromos.topContent)
    || !promoContentsEqual(inlinePromoContent, initialPromos.inlineContent)
    || brandRequiresCategory !== initialBrandRequiresCategory;

  function handleChoose(layoutId) {
    const normalized = normalizeLayout(layoutId);
    setSelectedLayout(normalized);
  }

  function handleReset() {
    setSelectedLayout(initialLayout);
    setFilterStyle(initialFilterStyle);
    setTopPromoVariant(initialPromos.top);
    setInlinePromoVariant(initialPromos.inline);
    setInlinePromoFrequency(initialPromos.inlineFrequency);
    setTopPromoContent(clonePromoContent(initialPromos.topContent));
    setInlinePromoContent(clonePromoContent(initialPromos.inlineContent));
    setBrandRequiresCategory(initialBrandRequiresCategory);
  }

  function handleSave() {
    if (saving || !isDirty) return;
    setSaving(true);
    setError(null);
    const normalizedTopContent = normalizePromoContent(topPromoContent);
    const normalizedInlineContent = normalizePromoContent(inlinePromoContent);
    const payload = [
      {
        key: 'catalog.product_layout',
        type: 'string',
        value: selectedLayout,
      },
      {
        key: 'catalog.filter_style',
        type: 'string',
        value: filterStyle,
      },
      {
        key: 'catalog.promo_top_variant',
        type: 'string',
        value: topPromoVariant,
      },
      {
        key: 'catalog.promo_inline_variant',
        type: 'string',
        value: inlinePromoVariant,
      },
      {
        key: 'catalog.promo_inline_frequency',
        type: 'number',
        value: inlinePromoFrequency,
      },
      {
        key: 'catalog.promo_top_content',
        type: 'string',
        value: JSON.stringify(normalizedTopContent),
      },
      {
        key: 'catalog.promo_inline_content',
        type: 'string',
        value: JSON.stringify(normalizedInlineContent),
      },
      {
        key: 'catalog.brand_requires_category',
        type: 'boolean',
        value: brandRequiresCategory,
      },
    ];
    api.admin.systemSettings.save(payload)
      .then(() => {
        setSaving(false);
        setInitialLayout(selectedLayout);
        setInitialFilterStyle(filterStyle);
        setInitialPromos({
          top: topPromoVariant,
          inline: inlinePromoVariant,
          inlineFrequency: inlinePromoFrequency,
          topContent: normalizedTopContent,
          inlineContent: normalizedInlineContent,
        });
        setInitialBrandRequiresCategory(brandRequiresCategory);
        refresh?.();
        push('Catalog presentation settings updated successfully.', 'success');
      })
      .catch(err => {
        setSaving(false);
        const message = err?.message || 'Could not save layout selection';
        setError(message);
        push(message, 'danger');
      });
  }

  return (
    <section className="container-fluid py-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
        <div>
          <h1 className="h4 mb-1">Product Layouts</h1>
          <p className="text-muted mb-0">Choose the storefront design that best matches your catalogue strategy.</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={handleReset} disabled={loading || saving || !isDirty}>
            Reset
          </button>
          <button type="button" className="btn btn-success" onClick={handleSave} disabled={loading || saving || !isDirty}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving…
              </>
            ) : 'Save selection'}
          </button>
        </div>
      </div>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="d-flex align-items-center gap-3 text-muted">
          <span className="spinner-border" role="status" aria-hidden="true"></span>
          <span>Loading layout options…</span>
        </div>
      ) : (
        <div className="row g-4">
          {LAYOUT_OPTIONS.map(option => (
            <div className="col-12 col-md-6 col-xl-4" key={option.id}>
              <div className={`card h-100 shadow-sm border${selectedLayout === option.id ? ' border-success border-2' : ''}`}>
                <div className="card-body d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between gap-2 align-items-start">
                    <div>
                      <h2 className="h6 mb-1">{option.title}</h2>
                      <p className="text-muted small mb-0">{option.description}</p>
                    </div>
                    {selectedLayout === option.id && (
                      <span className="badge text-bg-success">Selected</span>
                    )}
                  </div>
                  <LayoutPreview layoutId={option.id} />
                  <ul className="list-unstyled small text-muted d-flex flex-column gap-1 mb-0">
                    {option.features.map(feature => (
                      <li key={feature} className="d-flex align-items-start gap-2">
                        <i className="bi bi-check-circle-fill text-success mt-1" aria-hidden="true"></i>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card-footer bg-body-tertiary d-flex justify-content-between align-items-center">
                  <div className="form-check mb-0">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="productLayout"
                      id={`layout-${option.id}`}
                      value={option.id}
                      checked={selectedLayout === option.id}
                      onChange={() => handleChoose(option.id)}
                    />
                    <label className="form-check-label" htmlFor={`layout-${option.id}`}>
                      Use this layout
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => handleChoose(option.id)}
                    disabled={selectedLayout === option.id}
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && (
        <section className="mt-5">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
            <div>
              <h2 className="h5 mb-1">Filter bar styles</h2>
              <p className="text-muted small mb-0">Control how shoppers interact with filters — compact pills for speed, floating toolbars for campaigns, or the familiar card grid.</p>
            </div>
          </div>
          <div className="row g-4">
            {FILTER_STYLE_OPTIONS.map(option => (
              <div className="col-12 col-lg-4" key={option.id}>
                <div className={`card h-100 border ${filterStyle === option.id ? 'border-primary border-2 shadow-sm' : 'border-light'}`}>
                  <div className="card-body d-flex flex-column gap-3">
                    <div className="d-flex justify-content-between gap-2 align-items-start">
                      <div>
                        <h3 className="h6 mb-1">{option.title}</h3>
                        <p className="text-muted small mb-0">{option.description}</p>
                      </div>
                      {filterStyle === option.id && (
                        <span className="badge text-bg-primary">Active</span>
                      )}
                    </div>
                    <FilterStylePreview variant={option.id} />
                    <ul className="list-unstyled small text-muted d-flex flex-column gap-1 mb-0">
                      {option.highlights.map(item => (
                        <li key={item} className="d-flex align-items-start gap-2">
                          <i className="bi bi-check-circle-fill text-primary mt-1" aria-hidden="true"></i>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card-footer bg-body-tertiary d-flex justify-content-between align-items-center">
                    <div className="form-check mb-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="filterStyle"
                        id={`filter-style-${option.id}`}
                        value={option.id}
                        checked={filterStyle === option.id}
                        onChange={() => setFilterStyle(option.id)}
                      />
                      <label className="form-check-label" htmlFor={`filter-style-${option.id}`}>
                        Use this style
                      </label>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => setFilterStyle(option.id)}
                      disabled={filterStyle === option.id}
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {!loading && (
        <section className="mt-5">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
            <div>
              <h2 className="h5 mb-1">Filter behaviour</h2>
              <p className="text-muted small mb-0">Decide if shoppers must pick a category before brand filters appear. Helpful when your brand catalog is huge.</p>
            </div>
          </div>
          <div className="card shadow-sm">
            <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
              <div>
                <h3 className="h6 mb-1">Require category for brand filter</h3>
                <p className="text-muted small mb-0">When enabled, the brand multi-select unlocks only after a category is chosen.</p>
              </div>
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="toggleBrandRequiresCategory"
                  checked={brandRequiresCategory}
                  onChange={event => setBrandRequiresCategory(event.target.checked)}
                  disabled={saving}
                />
                <label className="form-check-label" htmlFor="toggleBrandRequiresCategory">
                  {brandRequiresCategory ? 'Enabled' : 'Disabled'}
                </label>
              </div>
            </div>
          </div>
        </section>
      )}
      {!loading && (
        <section className="mt-5">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
            <div>
              <h2 className="h5 mb-1">Promotional banners</h2>
              <p className="text-muted small mb-0">Spotlight offers above the filters and weave brand moments inside long product grids. Keep it subtle or go all-in during campaigns.</p>
            </div>
          </div>
          <div className="row g-4">
            <div className="col-12 col-xl-6">
              <div className="card h-100 shadow-sm">
                <div className="card-body d-flex flex-column gap-3">
                  <div>
                    <h3 className="h6 mb-1">Top hero banner</h3>
                    <p className="text-muted small mb-0">Appears above the filters to greet shoppers with key campaigns or service perks.</p>
                  </div>
                  <div>
                    <label className="form-label small text-muted" htmlFor="topPromoVariant">Banner variant</label>
                    <select
                      id="topPromoVariant"
                      className="form-select form-select-sm"
                      value={topPromoVariant}
                      onChange={event => setTopPromoVariant(normalizePromoVariant(event.target.value))}
                    >
                      {PROMO_VARIANTS.map(variant => (
                        <option key={`top-${variant.id}`} value={variant.id}>{variant.title}</option>
                      ))}
                    </select>
                  </div>
                  <PromoContentEditor
                    placement="top"
                    content={topPromoContent}
                    onChange={next => setTopPromoContent(clonePromoContent(next))}
                    disabled={topPromoVariant === 'none'}
                    categoryOptions={categoryOptions}
                    categoryLoading={categoryLoading}
                  />
                  <PromoBannerPreview variant={topPromoVariant} content={topPromoContent} placement="top" />
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-6">
              <div className="card h-100 shadow-sm">
                <div className="card-body d-flex flex-column gap-3">
                  <div>
                    <h3 className="h6 mb-1">Inline promo cards</h3>
                    <p className="text-muted small mb-0">Inject branded callouts between product rows to keep long lists engaging.</p>
                  </div>
                  <div>
                    <label className="form-label small text-muted" htmlFor="inlinePromoVariant">Banner variant</label>
                    <select
                      id="inlinePromoVariant"
                      className="form-select form-select-sm"
                      value={inlinePromoVariant}
                      onChange={event => setInlinePromoVariant(normalizePromoVariant(event.target.value))}
                    >
                      {PROMO_VARIANTS.map(variant => (
                        <option key={`inline-${variant.id}`} value={variant.id}>{variant.title}</option>
                      ))}
                    </select>
                  </div>
                  <PromoContentEditor
                    placement="inline"
                    content={inlinePromoContent}
                    onChange={next => setInlinePromoContent(clonePromoContent(next))}
                    disabled={inlinePromoVariant === 'none'}
                    categoryOptions={categoryOptions}
                    categoryLoading={categoryLoading}
                  />
                  {inlinePromoVariant !== 'none' && (
                    <div>
                      <label className="form-label small text-muted" htmlFor="inlinePromoFrequency">Frequency (items)</label>
                      <input
                        id="inlinePromoFrequency"
                        type="number"
                        className="form-control form-control-sm"
                        min="2"
                        max="12"
                        value={inlinePromoFrequency}
                        onChange={event => setInlinePromoFrequency(normalizePromoFrequency(event.target.value))}
                      />
                      <div className="form-text small">Inject after every {inlinePromoFrequency} products. Clamp between 2 and 12 for comfort.</div>
                    </div>
                  )}
                  <PromoBannerPreview variant={inlinePromoVariant} content={inlinePromoContent} placement="inline" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      <aside className="mt-5">
        <h2 className="h6 mb-2">Design guidance</h2>
        <div className="border rounded-3 p-3 bg-body-tertiary text-muted small">
          <p className="mb-2">The selected layout updates the public products page immediately after saving. Use the <strong>Comfort</strong> or <strong>Showcase</strong> options when you have rich photography, and switch to <strong>Compact</strong> during high-volume sales to surface more inventory per scroll.</p>
          <p className="mb-0">Need more control? Pair layouts with homepage sections that drive shoppers directly into filtered views.</p>
        </div>
      </aside>
    </section>
  );
}

function LayoutPreview({ layoutId }) {
  const normalized = normalizeLayout(layoutId);
  return (
    <div className="product-layout-preview" data-layout={normalized} aria-hidden="true">
      {Array.from({ length: normalized.startsWith('grid') ? 6 : 5 }).map((_, index) => (
        <div key={index} className="product-layout-preview__card">
          <div className="product-layout-preview__media"></div>
          <div className="product-layout-preview__body">
            <span className="product-layout-preview__line product-layout-preview__line--title"></span>
            <span className="product-layout-preview__line product-layout-preview__line--meta"></span>
            <span className="product-layout-preview__line product-layout-preview__line--price"></span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterStylePreview({ variant }) {
  const normalized = normalizeFilterStyle(variant);
  return (
    <div className="filter-style-preview" data-variant={normalized} aria-hidden="true">
      <div className="filter-style-preview__bar">
        <span className="filter-style-preview__chip filter-style-preview__chip--wide"></span>
        <span className="filter-style-preview__chip"></span>
        <span className="filter-style-preview__chip"></span>
        <span className="filter-style-preview__chip filter-style-preview__chip--cta"></span>
      </div>
      <div className="filter-style-preview__fields">
        <span className="filter-style-preview__field filter-style-preview__field--long"></span>
        <span className="filter-style-preview__field"></span>
        <span className="filter-style-preview__field"></span>
      </div>
    </div>
  );
}

function PromoBannerPreview({ variant, placement = 'inline', content }) {
  const normalized = normalizePromoVariant(variant);
  const config = PROMO_VARIANTS.find(item => item.id === normalized) ?? PROMO_VARIANTS[0];
  const resolvedContent = clonePromoContent(content);

  if (normalized === 'none') {
    return (
      <div className="promo-banner-preview promo-banner-preview--empty" aria-hidden="true">
        <span className="small text-muted">No banner will render for this placement.</span>
      </div>
    );
  }

  const accent = config.accent || 'primary';
  const eyebrow = resolvedContent.eyebrow || 'Featured';
  const headline = resolvedContent.headline || config.headline;
  const body = resolvedContent.body || config.body;
  const ctaLabel = resolvedContent.ctaLabel || config.ctaLabel;

  return (
    <div className={`promo-banner-preview promo-banner-preview--${placement}`} data-accent={accent} aria-hidden="true">
      <span className={`badge text-bg-${accent} mb-2`}>{eyebrow || 'Featured'}</span>
      <h4 className="h6 mb-1">{headline || 'Your headline here'}</h4>
      <p className="small mb-2 text-muted">{body || 'Add supporting copy to describe your campaign.'}</p>
      {ctaLabel && (
        <span className={`badge rounded-pill text-bg-${accent} opacity-75 align-self-start`}>{ctaLabel}</span>
      )}
    </div>
  );
}

function PromoContentEditor({
  placement,
  content,
  onChange,
  disabled = false,
  categoryOptions = [],
  categoryLoading = false,
}) {
  const resolved = clonePromoContent(content);
  const linkType = normalizePromoLinkType(resolved.ctaLinkType);

  if (disabled) {
    return (
      <div className="promo-content-editor promo-content-editor--disabled border rounded-3 bg-body-tertiary p-3">
        <p className="small mb-0 text-muted">Select a banner variant to customise its content.</p>
      </div>
    );
  }

  const handleFieldChange = (field) => (event) => {
    const value = event?.target?.value ?? '';
    onChange(normalizePromoContent({
      ...resolved,
      [field]: value,
    }));
  };

  const handleLinkTypeChange = (event) => {
    const nextType = normalizePromoLinkType(event?.target?.value);
    onChange(normalizePromoContent({
      ...resolved,
      ctaLinkType: nextType,
      ctaLinkTarget: nextType === 'none' ? '' : resolved.ctaLinkTarget,
    }));
  };

  const handleLinkTargetChange = (event) => {
    const value = event?.target?.value ?? '';
    onChange(normalizePromoContent({
      ...resolved,
      ctaLinkTarget: value,
    }));
  };

  return (
    <fieldset className="promo-content-editor border rounded-3 bg-body-secondary bg-opacity-25 p-3 d-flex flex-column gap-3">
      <legend className="visually-hidden">{placement} banner content</legend>
      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <label className="form-label small text-muted" htmlFor={`${placement}-promo-eyebrow`}>Eyebrow label</label>
          <input
            id={`${placement}-promo-eyebrow`}
            type="text"
            className="form-control form-control-sm"
            value={resolved.eyebrow}
            onChange={handleFieldChange('eyebrow')}
            placeholder="e.g. Featured"
          />
        </div>
        <div className="col-12 col-lg-8">
          <label className="form-label small text-muted" htmlFor={`${placement}-promo-headline`}>Headline</label>
          <input
            id={`${placement}-promo-headline`}
            type="text"
            className="form-control form-control-sm"
            value={resolved.headline}
            onChange={handleFieldChange('headline')}
            placeholder="Campaign headline"
            required={false}
          />
        </div>
        <div className="col-12">
          <label className="form-label small text-muted" htmlFor={`${placement}-promo-body`}>Body copy</label>
          <textarea
            id={`${placement}-promo-body`}
            className="form-control form-control-sm"
            rows={3}
            value={resolved.body}
            onChange={handleFieldChange('body')}
            placeholder="Add supporting messaging for this promotion"
          ></textarea>
        </div>
        <div className="col-12 col-lg-4">
          <label className="form-label small text-muted" htmlFor={`${placement}-promo-cta-label`}>CTA label</label>
          <input
            id={`${placement}-promo-cta-label`}
            type="text"
            className="form-control form-control-sm"
            value={resolved.ctaLabel}
            onChange={handleFieldChange('ctaLabel')}
            placeholder="e.g. Shop now"
          />
        </div>
        <div className="col-12 col-lg-4">
          <label className="form-label small text-muted" htmlFor={`${placement}-promo-link-type`}>CTA link type</label>
          <select
            id={`${placement}-promo-link-type`}
            className="form-select form-select-sm"
            value={linkType}
            onChange={handleLinkTypeChange}
          >
            {PROMO_LINK_TYPES.map(type => (
              <option key={`${placement}-promo-link-${type.id}`} value={type.id}>{type.label}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-lg-4">
          {linkType === 'url' && (
            <div>
              <label className="form-label small text-muted" htmlFor={`${placement}-promo-link-url`}>Link URL</label>
              <input
                id={`${placement}-promo-link-url`}
                type="url"
                className="form-control form-control-sm"
                value={resolved.ctaLinkTarget}
                onChange={handleLinkTargetChange}
                placeholder="https://example.com"
              />
              <div className="form-text small">Open this link in a new tab.</div>
            </div>
          )}
          {linkType === 'category' && (
            <div>
              <label className="form-label small text-muted" htmlFor={`${placement}-promo-link-category`}>Link category</label>
              <select
                id={`${placement}-promo-link-category`}
                className="form-select form-select-sm"
                value={resolved.ctaLinkTarget}
                onChange={handleLinkTargetChange}
                disabled={categoryLoading || categoryOptions.length === 0}
              >
                <option value="">{categoryLoading ? 'Loading categories…' : 'Select category'}</option>
                {categoryOptions.map(option => (
                  <option key={`promo-cat-${option.id}`} value={option.id}>{option.fullName ?? option.label ?? option.name}</option>
                ))}
              </select>
              <div className="form-text small">Links shoppers to the chosen category page.</div>
            </div>
          )}
          {linkType === 'tag' && (
            <div>
              <label className="form-label small text-muted" htmlFor={`${placement}-promo-link-tag`}>Tag slug</label>
              <input
                id={`${placement}-promo-link-tag`}
                type="text"
                className="form-control form-control-sm"
                value={resolved.ctaLinkTarget}
                onChange={handleLinkTargetChange}
                placeholder="e.g. seasonal"
              />
              <div className="form-text small">Matches the tag slug configured on products or sections.</div>
            </div>
          )}
          {linkType === 'none' && (
            <div className="form-text small text-muted">CTA button will not render without a link.</div>
          )}
        </div>
      </div>
    </fieldset>
  );
}
