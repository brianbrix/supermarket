import ProductCard from '../ProductCard.jsx';

const PROMO_STRIP_THEMES = {
  'twilight-glow': {
    gradient: 'linear-gradient(120deg, #1a237e 0%, #5c6bc0 45%, #b388ff 100%)',
    textColor: '#ffffff',
    accent: '#ffe57f',
    sheen: 'rgba(255,255,255,0.55)'
  },
  'candy-crush': {
    gradient: 'linear-gradient(120deg, #ff416c 0%, #ff4b2b 40%, #ff9a44 100%)',
    textColor: '#fff8f6',
    accent: '#fffacd',
    sheen: 'rgba(255,255,255,0.6)'
  },
  'forest-lights': {
    gradient: 'linear-gradient(120deg, #0b8457 0%, #13c792 50%, #8ef6c3 100%)',
    textColor: '#eafff4',
    accent: '#f1ffbf',
    sheen: 'rgba(255,255,255,0.45)'
  },
  'nordic-spark': {
    gradient: 'linear-gradient(120deg, #003973 0%, #4286f4 45%, #8e9eab 100%)',
    textColor: '#f4fbff',
    accent: '#d9f5ff',
    sheen: 'rgba(255,255,255,0.55)'
  }
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function SectionRenderer({ section, storeName, data, theme }) {
  switch (section.type) {
    case 'hero':
      return <HeroSection section={section} storeName={storeName} theme={theme} />;
    case 'category-grid':
      return <CategoryGridSection section={section} theme={theme} />;
    case 'product-carousel':
      return <ProductCarouselSection section={section} data={data} theme={theme} />;
    case 'promo-strip':
      return <PromoStripSection section={section} />;
    case 'image-banner':
      return <ImageBannerSection section={section} theme={theme} />;
    case 'rich-text':
      return <RichTextSection section={section} theme={theme} />;
    default:
      return (
        <div className="container px-3 px-sm-4">
          <div className="border rounded p-4 bg-body-secondary text-muted">
            <p className="mb-1 fw-semibold">Unsupported section</p>
            <code className="small">{section.type}</code>
          </div>
        </div>
      );
  }
}

export function HeroSection({ section, storeName, theme }) {
  const headline = section.headline || `Welcome to ${storeName}`;
  const subheading = section.subheading || 'Discover fresh deals hand-picked for you.';
  const backgroundImage = section.backgroundImage;
  const hasImage = Boolean(backgroundImage);
  const heroStyle = hasImage
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {
        background: theme === 'dark' ? 'linear-gradient(120deg, #101f14, #1a7f37)' : 'linear-gradient(120deg, #e8f5e9, #c8e6c9)'
      };

  return (
    <section className="py-5" style={heroStyle}>
      <div className="container px-3 px-sm-4">
        <div className={`col-12 col-lg-8 ${hasImage ? 'text-white' : ''}`}>
          <p className="text-uppercase small fw-semibold mb-2">{storeName}</p>
          <h1 className="display-5 fw-bold mb-3">{headline}</h1>
          <p className="lead mb-4">{subheading}</p>
          <div className="d-flex flex-wrap gap-2">
            {section.primaryCta && (
              <a href={section.primaryCta.href || '#'} className="btn btn-success btn-lg">
                {section.primaryCta.label || 'Shop now'}
              </a>
            )}
            {section.secondaryCta && (
              <a href={section.secondaryCta.href || '#'} className={`btn btn-outline-${theme === 'dark' ? 'light' : 'success'} btn-lg`}>
                {section.secondaryCta.label || 'Explore'}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryGridSection({ section }) {
  const columns = clamp(Number(section.columns ?? 4) || 4, 2, 6);
  const items = Array.isArray(section.items) ? section.items : [];

  return (
    <section className="container px-3 px-sm-4">
      <header className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h2 className="h4 mb-1">{section.title || 'Shop by category'}</h2>
          {section.subtitle && <p className="text-muted mb-0">{section.subtitle}</p>}
        </div>
        <a className="btn btn-link p-0" href="/products">See all products</a>
      </header>
      <div className="row g-3">
        {items.map((item, idx) => (
          <div key={`${section.id || 'category'}-${idx}`} className={`col-6 col-md-${Math.max(3, 12 / columns)} col-lg-${Math.max(3, 12 / columns)}`}>
            <a href={item.href || '/products'} className="text-decoration-none">
              <div className="card h-100 border-0 shadow-sm p-3">
                <div className="d-flex align-items-center gap-3">
                  <span className="fs-3">{item.icon || '🛒'}</span>
                  <div>
                    <div className="fw-semibold text-body">{item.label || 'Category'}</div>
                    {item.description && <div className="small text-muted">{item.description}</div>}
                  </div>
                </div>
              </div>
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductCarouselSection({ section, data }) {
  const state = data ?? { items: [], loading: true, error: null };
  const items = state.items ?? [];
  const requestedLimit = Number(section?.dataSource?.filters?.limit ?? (items?.length || 6));
  const skeletonCount = clamp(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 6, 4, 12);
  const viewAllHref = (() => {
    const filters = section?.dataSource?.filters ?? {};
    const params = new URLSearchParams();
    params.set('sectionId', section?.id || 'product-carousel');
    if (section?.title) params.set('sectionTitle', section.title);
    if (filters.q) params.set('q', filters.q);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.minPrice != null) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice != null) params.set('maxPrice', filters.maxPrice);
    if (filters.inStock != null) params.set('inStock', filters.inStock ? '1' : '0');
    if (filters.minRating != null) params.set('minRating', filters.minRating);
    if (filters.trendingDays != null) params.set('trendingDays', filters.trendingDays);
    if (filters.categorySlug) params.set('category', filters.categorySlug);
    if (filters.promoTag) params.set('promoTag', filters.promoTag);
    if (section?.dataSource?.scope) params.set('scope', section.dataSource.scope);
    const tagList = Array.isArray(filters.tags) ? filters.tags : [];
    tagList.filter(Boolean).forEach(tag => params.append('tags[]', tag));
    if (filters.tag) params.append('tags[]', filters.tag);
    const idsList = Array.isArray(filters.ids) ? filters.ids : [];
    idsList.filter(Boolean).forEach(id => params.append('ids[]', id));
    return `/products${params.toString() ? `?${params.toString()}` : ''}`;
  })();

  return (
    <section className="container px-3 px-sm-4">
      <header className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h2 className="h4 mb-1">{section.title || 'Recommended for you'}</h2>
          {section.subtitle && <p className="text-muted mb-0">{section.subtitle}</p>}
        </div>
        <a href={viewAllHref} className="btn btn-outline-success btn-sm">View all</a>
      </header>
      {state.error && (
        <div className="alert alert-warning small" role="alert">{state.error}</div>
      )}
      {state.loading ? (
        <div className="product-carousel-track">
          {Array.from({ length: skeletonCount }).map((_, idx) => (
            <div key={idx} className="product-carousel-card">
              <div className="product-card-skeleton card placeholder-glow border-0 shadow-sm">
                <div className="card-body">
                  <span className="placeholder col-12 rounded" style={{ height: 120 }}></span>
                  <span className="placeholder col-9 mt-3"></span>
                  <span className="placeholder col-6 mt-2"></span>
                  <span className="placeholder col-4 mt-2"></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted">No products available right now.</p>
      ) : (
        <div className="product-carousel-track">
          {items.map(product => (
            <div key={product.id} className="product-carousel-card">
              <ProductCard product={product} compact />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PromoStripSection({ section }) {
  const themeKey = section.style || 'twilight-glow';
  const theme = PROMO_STRIP_THEMES[themeKey] ?? PROMO_STRIP_THEMES['twilight-glow'];
  const eyebrow = section.eyebrow?.trim();
  const headline = section.headline?.trim();
  const subtext = section.subtext?.trim();
  const ctaLabel = section.cta?.label?.trim();
  const ctaHref = section.cta?.href || '#';

  return (
    <section className="container px-3 px-sm-4">
      <div
        className="promo-strip"
        style={{
          '--promo-strip-gradient': theme.gradient,
          '--promo-strip-text': theme.textColor,
          '--promo-strip-accent': theme.accent,
          '--promo-strip-sheen': theme.sheen
        }}
      >
        <span className="promo-strip__shimmer" aria-hidden="true"></span>
        <div className="promo-strip__content">
          <div className="promo-strip__copy">
            {eyebrow && <span className="promo-strip__eyebrow">{eyebrow}</span>}
            {headline && <span className="promo-strip__headline">{headline}</span>}
            {subtext && <span className="promo-strip__subtext">{subtext}</span>}
          </div>
          {ctaLabel && (
            <a href={ctaHref} className="promo-strip__cta">
              <span>{ctaLabel}</span>
              <i className="bi bi-arrow-right-short" aria-hidden="true"></i>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export function ImageBannerSection({ section, theme }) {
  const backgroundColor = section.media?.backgroundColor || (theme === 'dark' ? '#0f2d19' : '#e1f7e7');

  return (
    <section className="container px-3 px-sm-4">
      <div className="rounded-4 p-4 p-md-5" style={{ backgroundColor }}>
        <div className="row align-items-center g-4">
          <div className="col-12 col-md-7">
            <h2 className="h3 mb-2">{section.title || 'Special announcement'}</h2>
            {section.description && <p className="mb-0">{section.description}</p>}
          </div>
          <div className="col-12 col-md-3 text-md-end">
            {section.cta && (
              <a href={section.cta.href || '#'} className="btn btn-success btn-lg">
                {section.cta.label || 'Learn more'}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function RichTextSection({ section, theme }) {
  const body = Array.isArray(section.body) ? section.body : [];

  return (
    <section className="container px-3 px-sm-4">
      <div className={`rounded-4 p-4 p-md-5 ${theme === 'dark' ? 'bg-dark-subtle' : 'bg-body-secondary'}`}>
        {section.title && <h2 className="h4 mb-3">{section.title}</h2>}
        <div className="vstack gap-3">
          {body.map((block, idx) => {
            if (block?.type === 'list') {
              const items = Array.isArray(block.items) ? block.items : [];
              return (
                <ul key={idx} className={`list-unstyled ${block.style === 'check' ? 'text-success' : ''}`}>
                  {items.map((item, itemIdx) => (
                    <li key={itemIdx} className="d-flex align-items-start gap-2">
                      {block.style === 'check' ? <span className="text-success">✔️</span> : <span>•</span>}
                      <span className="text-body">{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            if (block?.type === 'paragraph') {
              return <p key={idx} className="mb-0 text-body">{block.content}</p>;
            }
            return <p key={idx} className="mb-0 text-body">{typeof block === 'string' ? block : JSON.stringify(block)}</p>;
          })}
        </div>
      </div>
    </section>
  );
}
