import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../ProductCard.jsx';
import { STORE_THEMES, DEFAULT_STORE_THEME, normalizeStoreTheme } from '../../config/storeThemes.js';

function resolveStoreTheme(themeKey) {
  const key = normalizeStoreTheme(themeKey);
  const config = STORE_THEMES[key] ?? STORE_THEMES[DEFAULT_STORE_THEME];
  return { key, config };
}

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

const HERO_THEMES = {
  'classic-fresh': {
    background: 'linear-gradient(120deg, #e8f5e9 0%, #c8e6c9 100%)',
    textTone: 'dark',
    textColor: '#123b26',
    eyebrowColor: '#0a5c2b',
    subheadingColor: '#275f40',
    primaryClasses: 'btn btn-success btn-lg shadow-sm',
    secondaryClasses: 'btn btn-outline-success btn-lg'
  },
  'sunrise-citrus': {
    background: 'linear-gradient(120deg, #fff1db 0%, #ffe0bf 45%, #ffc898 100%)',
    textTone: 'dark',
    textColor: '#5c3210',
    eyebrowColor: '#a95a07',
    subheadingColor: '#7c4518',
    primaryClasses: 'btn btn-warning btn-lg text-dark fw-semibold shadow-sm border-0',
    secondaryClasses: 'btn btn-outline-dark btn-lg border-dark'
  },
  'midnight-bloom': {
    background: 'linear-gradient(120deg, #121c3d 0%, #2f2959 45%, #563a7c 100%)',
    textTone: 'light',
    textColor: '#f5f2ff',
    eyebrowColor: '#ffe38f',
    subheadingColor: '#d9cffd',
    primaryClasses: 'btn btn-primary btn-lg shadow-sm',
    secondaryClasses: 'btn btn-outline-light btn-lg border-light'
  },
  'aqua-mist': {
    background: 'linear-gradient(120deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%)',
    textTone: 'dark',
    textColor: '#074958',
    eyebrowColor: '#007a8a',
    subheadingColor: '#0b6676',
    primaryClasses: 'btn btn-info btn-lg text-dark fw-semibold border-0 shadow-sm',
    secondaryClasses: 'btn btn-outline-info btn-lg'
  }
};

const CATEGORY_GRID_THEMES = {
  'fresh-canopy': {
    background: 'linear-gradient(135deg, #f1fbf6 0%, #e3f5eb 100%)',
    shadow: '0 24px 60px -36px rgba(21, 96, 58, 0.25)',
    headingColor: '#0f3c25',
    subtitleColor: '#3c6c55',
    linkColor: '#0f6c3f',
    cardStyle: {
      background: 'rgba(255,255,255,0.9)',
      border: '1px solid rgba(20, 118, 67, 0.08)',
      boxShadow: '0 16px 32px -28px rgba(22, 68, 43, 0.35)'
    },
    iconStyle: {
      background: 'rgba(19, 125, 59, 0.12)',
      color: '#137d3b'
    },
    cardTitleColor: '#1d3f2c',
    cardSubtitleColor: '#4c6f5c'
  },
  'sunset-horizon': {
    background: 'linear-gradient(135deg, #fff0e6 0%, #ffd9c2 45%, #ffbd99 100%)',
    shadow: '0 24px 60px -32px rgba(173, 74, 30, 0.25)',
    headingColor: '#723213',
    subtitleColor: '#a4562f',
    linkColor: '#a14b1f',
    cardStyle: {
      background: 'rgba(255,255,255,0.92)',
      border: '1px solid rgba(185, 77, 30, 0.12)',
      boxShadow: '0 16px 32px -28px rgba(143, 62, 24, 0.3)'
    },
    iconStyle: {
      background: 'rgba(255, 174, 120, 0.18)',
      color: '#c55a1e'
    },
    cardTitleColor: '#693525',
    cardSubtitleColor: '#9a5b3d'
  },
  'midnight-velvet': {
    background: 'linear-gradient(135deg, #111828 0%, #1f2f4c 50%, #2f3e63 100%)',
    shadow: '0 28px 70px -34px rgba(6, 14, 28, 0.5)',
    headingColor: '#f1f4ff',
    subtitleColor: '#c0c6e8',
    linkColor: '#9ab4ff',
    cardStyle: {
      background: 'rgba(20, 28, 44, 0.85)',
      border: '1px solid rgba(108, 130, 190, 0.16)',
      boxShadow: '0 18px 36px -28px rgba(7, 14, 28, 0.6)'
    },
    iconStyle: {
      background: 'rgba(148, 174, 255, 0.18)',
      color: '#9ab4ff'
    },
    cardTitleColor: '#f4f6ff',
    cardSubtitleColor: '#cbd4f7'
  }
};

const PRODUCT_CAROUSEL_THEMES = {
  classic: {
    headingColor: null,
    subtitleColor: null,
    viewAllClass: 'btn btn-outline-success btn-sm'
  },
  'glass-emerald': {
    background: 'linear-gradient(135deg, rgba(231, 250, 241, 0.92) 0%, rgba(208, 242, 224, 0.95) 100%)',
    shadow: '0 24px 60px -38px rgba(21, 96, 58, 0.25)',
    headingColor: '#0f3c25',
    subtitleColor: '#3c6c55',
    viewAllClass: 'btn btn-success btn-sm shadow-sm text-white',
    viewAllStyle: { border: 'none' }
  },
  'midnight-luxe': {
    background: 'linear-gradient(135deg, rgba(15, 21, 40, 0.95) 0%, rgba(32, 39, 70, 0.92) 100%)',
    shadow: '0 32px 70px -36px rgba(6, 12, 28, 0.65)',
    headingColor: '#f4f6ff',
    subtitleColor: '#cbd4ff',
    viewAllClass: 'btn btn-outline-light btn-sm border-light text-light'
  },
  'sunset-candy': {
    background: 'linear-gradient(135deg, rgba(255, 235, 235, 0.95) 0%, rgba(255, 214, 224, 0.92) 100%)',
    shadow: '0 24px 58px -34px rgba(190, 76, 110, 0.28)',
    headingColor: '#7a2450',
    subtitleColor: '#ad4f76',
    viewAllClass: 'btn btn-outline-danger btn-sm'
  }
};

const RICH_TEXT_THEMES = {
  'calm-paper': {
    background: 'linear-gradient(135deg, #fdfdf9 0%, #f4f6f0 100%)',
    shadow: '0 24px 60px -40px rgba(22, 40, 34, 0.18)',
    headingColor: '#1f3025',
    bodyColor: '#39483f',
    accentColor: '#0a5c2b'
  },
  'nocturne': {
    background: 'linear-gradient(135deg, #151924 0%, #1d2636 45%, #243552 100%)',
    shadow: '0 24px 60px -36px rgba(4, 8, 20, 0.65)',
    headingColor: '#f2f5ff',
    bodyColor: '#c5d1f5',
    accentColor: '#7fb0ff'
  },
  'sunset-quartz': {
    background: 'linear-gradient(135deg, #fff0eb 0%, #ffe2da 45%, #ffd3cb 100%)',
    shadow: '0 24px 54px -36px rgba(166, 77, 61, 0.28)',
    headingColor: '#6d2b1e',
    bodyColor: '#7f3e31',
    accentColor: '#b8563d'
  }
};

const IMAGE_BANNER_THEMES = {
  'emerald-luxe': {
    background: 'linear-gradient(120deg, #0f2d19 0%, #145a32 50%, #0f4930 100%)',
    shadow: '0 40px 80px -48px rgba(8, 45, 25, 0.65)',
    textColor: '#dcffe5',
    eyebrowColor: '#a9f7c7',
    headlineColor: '#ffffff',
    bodyColor: '#d0f6de',
    accentGlow: 'rgba(126, 255, 196, 0.45)',
    cta: {
      primary: { className: 'btn btn-success btn-lg shadow', style: { border: 'none' } },
      outline: { className: 'btn btn-outline-light btn-lg border-light' },
      link: { className: 'btn btn-link text-light fw-semibold px-0' }
    }
  },
  'sunrise-breeze': {
    background: 'linear-gradient(120deg, #fff9f0 0%, #ffe4cc 55%, #ffd0a8 100%)',
    shadow: '0 32px 70px -40px rgba(213, 118, 45, 0.35)',
    textColor: '#6a340d',
    eyebrowColor: '#c55d17',
    headlineColor: '#8a410f',
    bodyColor: '#7c4d26',
    accentGlow: 'rgba(255, 185, 120, 0.35)',
    cta: {
      primary: { className: 'btn btn-warning btn-lg text-dark fw-semibold shadow-sm', style: { border: 'none' } },
      outline: { className: 'btn btn-outline-dark btn-lg' },
      link: { className: 'btn btn-link text-dark fw-semibold px-0' }
    }
  },
  'midnight-neon': {
    background: 'linear-gradient(135deg, #111828 0%, #1d2b46 55%, #243a63 100%)',
    shadow: '0 36px 80px -42px rgba(10, 18, 39, 0.65)',
    textColor: '#d9e1ff',
    eyebrowColor: '#84f0ff',
    headlineColor: '#ffffff',
    bodyColor: '#c0ccff',
    accentGlow: 'rgba(108, 217, 255, 0.35)',
    cta: {
      primary: { className: 'btn btn-primary btn-lg shadow-sm' },
      outline: { className: 'btn btn-outline-light btn-lg border-light text-light' },
      link: { className: 'btn btn-link text-light fw-semibold px-0' }
    }
  },
  'crisp-minimal': {
    background: 'linear-gradient(130deg, #f6fbff 0%, #edf4ff 50%, #e2ecff 100%)',
    shadow: '0 36px 76px -48px rgba(31, 60, 95, 0.28)',
    textColor: '#1c2d40',
    eyebrowColor: '#2a6ec4',
    headlineColor: '#132338',
    bodyColor: '#2f4760',
    accentGlow: 'rgba(59, 126, 214, 0.12)',
    cta: {
      primary: { className: 'btn btn-info btn-lg text-dark fw-semibold', style: { border: 'none' } },
      outline: { className: 'btn btn-outline-primary btn-lg' },
      link: { className: 'btn btn-link px-0 fw-semibold text-primary' }
    }
  }
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function SectionRenderer({ section, storeName, data, theme, experienceTheme }) {
  const { key: experienceKey, config: experienceConfig } = resolveStoreTheme(experienceTheme);
  switch (section.type) {
    case 'hero':
      return <HeroSection section={section} storeName={storeName} theme={theme} experienceTheme={experienceConfig} experienceKey={experienceKey} />;
    case 'category-grid':
      return <CategoryGridSection section={section} experienceTheme={experienceConfig} experienceKey={experienceKey} />;
    case 'product-carousel':
      return <ProductCarouselSection section={section} data={data} theme={theme} experienceTheme={experienceConfig} experienceKey={experienceKey} />;
    case 'promo-strip':
      return <PromoStripSection section={section} />;
    case 'image-banner':
      return <ImageBannerSection section={section} theme={theme} experienceTheme={experienceConfig} experienceKey={experienceKey} />;
    case 'rich-text':
      return <RichTextSection section={section} theme={theme} experienceTheme={experienceConfig} experienceKey={experienceKey} />;
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

export function HeroSection({ section, storeName, theme, experienceTheme, experienceKey }) {
  const heroFallback = experienceTheme?.sectionDefaults?.hero || 'classic-fresh';
  const heroThemeKey = section.style || heroFallback;
  const heroTheme = HERO_THEMES[heroThemeKey] ?? HERO_THEMES['classic-fresh'];
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
        background: heroTheme.background
      };
  const textTone = hasImage ? 'light' : (heroTheme.textTone ?? 'dark');
  const textColorStyle = !hasImage && heroTheme.textColor ? { color: heroTheme.textColor } : undefined;
  const eyebrowStyle = !hasImage && heroTheme.eyebrowColor ? { color: heroTheme.eyebrowColor } : undefined;
  const subheadingStyle = !hasImage && heroTheme.subheadingColor ? { color: heroTheme.subheadingColor } : undefined;
  const primaryClasses = heroTheme.primaryClasses ?? 'btn btn-success btn-lg';
  const secondaryClasses = heroTheme.secondaryClasses ?? `btn btn-outline-${theme === 'dark' ? 'light' : 'success'} btn-lg`;
  const primaryStyle = heroTheme.primaryStyle;
  const secondaryStyle = heroTheme.secondaryStyle;

  const surfaceStyle = experienceTheme?.page?.surface
    ? { '--page-surface': experienceTheme.page.surface }
    : undefined;

  return (
    <section
      className={`hero-section py-5 ${textTone === 'light' ? 'text-white' : ''}`}
      style={{ ...heroStyle, ...surfaceStyle }}
      data-theme={heroThemeKey}
      data-store-theme={experienceKey}
    >
      <div className="container px-3 px-sm-4">
        <div className="col-12 col-lg-8" style={textColorStyle}>
          <p className="text-uppercase small fw-semibold mb-2" style={eyebrowStyle}>{section.eyebrow || storeName}</p>
          <h1 className="display-5 fw-bold mb-3">{headline}</h1>
          <p className="lead mb-4" style={subheadingStyle}>{subheading}</p>
          <div className="d-flex flex-wrap gap-2">
            {section.primaryCta && (
              <a href={section.primaryCta.href || '#'} className={primaryClasses} style={primaryStyle}>
                {section.primaryCta.label || 'Shop now'}
              </a>
            )}
            {section.secondaryCta && (
              <a href={section.secondaryCta.href || '#'} className={secondaryClasses} style={secondaryStyle}>
                {section.secondaryCta.label || 'Explore'}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryGridSection({ section, experienceTheme, experienceKey }) {
  const columns = clamp(Number(section.columns ?? 4) || 4, 2, 6);
  const items = Array.isArray(section.items) ? section.items : [];
  const fallbackTheme = experienceTheme?.sectionDefaults?.category || 'fresh-canopy';
  const themeKey = section.style || fallbackTheme;
  const gridTheme = CATEGORY_GRID_THEMES[themeKey] ?? CATEGORY_GRID_THEMES['fresh-canopy'];
  const surfaceStyle = {
    borderRadius: '28px',
    padding: '1.75rem clamp(1rem, 3vw, 2.25rem)',
    ...(gridTheme.background ? { background: gridTheme.background } : {}),
    ...(gridTheme.shadow ? { boxShadow: gridTheme.shadow } : {})
  };
  const headingStyle = gridTheme.headingColor ? { color: gridTheme.headingColor } : undefined;
  const subtitleStyle = gridTheme.subtitleColor ? { color: gridTheme.subtitleColor } : undefined;
  const linkStyle = gridTheme.linkColor ? { color: gridTheme.linkColor } : undefined;
  const cardStyle = gridTheme.cardStyle ? { ...gridTheme.cardStyle } : undefined;
  const iconStyle = gridTheme.iconStyle ? { ...gridTheme.iconStyle } : undefined;
  const cardTitleStyle = gridTheme.cardTitleColor ? { color: gridTheme.cardTitleColor } : undefined;
  const cardSubtitleStyle = gridTheme.cardSubtitleColor ? { color: gridTheme.cardSubtitleColor } : undefined;

  return (
    <section className="container px-3 px-sm-4" data-store-theme={experienceKey}>
      <div className="category-grid-surface" style={surfaceStyle} data-theme={themeKey}>
        <header className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <h2 className="h4 mb-1" style={headingStyle}>{section.title || 'Shop by category'}</h2>
            {section.subtitle && <p className="mb-0" style={subtitleStyle}>{section.subtitle}</p>}
          </div>
          <a className="btn btn-link p-0 fw-semibold" href="/products" style={linkStyle}>See all products</a>
        </header>
        <div className="row g-3">
          {items.map((item, idx) => (
            <div key={`${section.id || 'category'}-${idx}`} className={`col-6 col-md-${Math.max(3, 12 / columns)} col-lg-${Math.max(3, 12 / columns)}`}>
              <a href={item.href || '/products'} className="text-decoration-none">
                <div className="card h-100 border-0 p-3" style={cardStyle}>
                  <div className="d-flex align-items-center gap-3">
                    <span className="category-grid__icon" style={iconStyle}>{item.icon || '🛒'}</span>
                    <div>
                      <div className="fw-semibold" style={cardTitleStyle}>{item.label || 'Category'}</div>
                      {item.description && <div className="small" style={cardSubtitleStyle}>{item.description}</div>}
                    </div>
                  </div>
                </div>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProductCarouselSection({ section, data, experienceTheme, experienceKey }) {
  const state = data ?? { items: [], loading: true, error: null };
  const items = state.items ?? [];
  const requestedLimit = Number(section?.dataSource?.filters?.limit ?? (items?.length || 6));
  const skeletonCount = clamp(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 6, 4, 12);
  const fallbackTheme = experienceTheme?.sectionDefaults?.carousel || 'classic';
  const themeKey = section.style || fallbackTheme;
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
    if (experienceKey) params.set('experienceTheme', experienceKey);
    params.set('sectionStyle', themeKey);
    return `/products${params.toString() ? `?${params.toString()}` : ''}`;
  })();
  const carouselTheme = PRODUCT_CAROUSEL_THEMES[themeKey] ?? PRODUCT_CAROUSEL_THEMES.classic;
  const surfaceStyle = {
    borderRadius: '28px',
    padding: '1.75rem clamp(1rem, 3vw, 2.25rem)',
    ...(carouselTheme.background ? { background: carouselTheme.background } : {}),
    ...(carouselTheme.shadow ? { boxShadow: carouselTheme.shadow } : {})
  };
  const headingStyle = carouselTheme.headingColor ? { color: carouselTheme.headingColor } : undefined;
  const subtitleStyle = carouselTheme.subtitleColor ? { color: carouselTheme.subtitleColor } : undefined;
  const viewAllClass = carouselTheme.viewAllClass || 'btn btn-outline-success btn-sm';
  const viewAllStyle = carouselTheme.viewAllStyle;

  return (
    <section className="container px-3 px-sm-4" data-store-theme={experienceKey}>
      <div className="product-carousel-surface" style={surfaceStyle} data-theme={themeKey}>
        <header className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
          <div>
            <h2 className="h4 mb-1" style={headingStyle}>{section.title || 'Recommended for you'}</h2>
            {section.subtitle && <p className="mb-0" style={subtitleStyle}>{section.subtitle}</p>}
          </div>
          <a href={viewAllHref} className={viewAllClass} style={viewAllStyle}>View all</a>
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
          <p className="text-muted mb-0">No products available right now.</p>
        ) : (
          <div className="product-carousel-track">
            {items.map(product => (
              <div key={product.id} className="product-carousel-card">
                <ProductCard product={product} compact />
              </div>
            ))}
          </div>
        )}
      </div>
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

export function ImageBannerSection({ section, theme, experienceTheme, experienceKey }) {
  const slides = useMemo(() => {
    if (Array.isArray(section.media?.slides)) {
      return section.media.slides.filter(slide => slide && slide.url);
    }
    if (section.media?.imageUrl) {
      return [{ id: section.media.id || `${section.id}-legacy`, url: section.media.imageUrl, alt: section.title || 'Banner image' }];
    }
    return [];
  }, [section.media, section.id, section.title]);

  const fallbackSurface = experienceTheme?.page?.surface || (theme === 'dark' ? '#0f2d19' : '#e1f7e7');
  const themeKey = section.style || section.theme || experienceTheme?.sectionDefaults?.imageBanner || 'emerald-luxe';
  const bannerTheme = IMAGE_BANNER_THEMES[themeKey] ?? IMAGE_BANNER_THEMES['emerald-luxe'];
  const background = section.media?.backgroundColor || bannerTheme.background || fallbackSurface;
  const surfaceStyle = {
    borderRadius: '36px',
    padding: '2.5rem clamp(1.25rem, 4vw, 3.5rem)',
    background,
    boxShadow: bannerTheme.shadow || '0 24px 64px -42px rgba(14, 33, 24, 0.35)'
  };

  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    if (activeSlide >= slides.length) {
      setActiveSlide(slides.length > 0 ? slides.length - 1 : 0);
    }
  }, [slides.length, activeSlide]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (slides.length <= 1) return undefined;
    if (section.media?.autoplay === false) return undefined;
    const interval = Math.max(Number(section.media?.interval) || 6000, 2500);
    const timer = window.setInterval(() => {
      setActiveSlide(prev => (prev + 1) % slides.length);
    }, interval);
    return () => {
      window.clearInterval(timer);
    };
  }, [slides.length, section.media?.interval, section.media?.autoplay]);

  const goTo = (index) => {
    if (slides.length === 0) return;
    const next = (index + slides.length) % slides.length;
    setActiveSlide(next);
  };

  const ctaMode = (section.cta?.style || 'primary');
  const ctaTheme = bannerTheme.cta?.[ctaMode] ?? bannerTheme.cta?.primary ?? { className: 'btn btn-success btn-lg' };
  const eyebrowStyle = bannerTheme.eyebrowColor ? { color: bannerTheme.eyebrowColor } : undefined;
  const headlineStyle = bannerTheme.headlineColor ? { color: bannerTheme.headlineColor } : undefined;
  const bodyStyle = bannerTheme.bodyColor ? { color: bannerTheme.bodyColor } : undefined;
  const textColorStyle = bannerTheme.textColor ? { color: bannerTheme.textColor } : undefined;
  const accentGlow = bannerTheme.accentGlow ? { boxShadow: `0 0 80px 0 ${bannerTheme.accentGlow}` } : undefined;

  return (
    <section className="container px-3 px-sm-4" data-store-theme={experienceKey}>
      <div className="image-banner-surface" style={{ ...surfaceStyle, ...accentGlow }} data-theme={themeKey}>
        <div className="row align-items-center g-4 g-xl-5">
          <div className="col-12 col-lg-5">
            <div className="image-banner-copy" style={textColorStyle}>
              {section.eyebrow && <span className="image-banner__eyebrow text-uppercase fw-semibold small" style={eyebrowStyle}>{section.eyebrow}</span>}
              <h2 className="image-banner__headline display-6 fw-bold" style={headlineStyle}>{section.title || 'Special announcement'}</h2>
              {section.description && <p className="image-banner__body lead mb-4" style={bodyStyle}>{section.description}</p>}
              {section.cta?.label && (
                <a href={section.cta.href || '#'} className={ctaTheme.className || 'btn btn-success btn-lg'} style={ctaTheme.style}>
                  {section.cta.label}
                </a>
              )}
            </div>
          </div>
          <div className="col-12 col-lg-7">
            {slides.length === 0 ? (
              <div className="image-banner-placeholder border rounded-4 bg-body-secondary text-muted p-4 text-center">
                <p className="mb-0">Add banner images in the admin to see the carousel here.</p>
              </div>
            ) : (
              <div className="image-banner-carousel" data-slide-count={slides.length}>
                <div className="image-banner-carousel__frame">
                  <div
                    className="image-banner-carousel__track"
                    style={{ width: `${slides.length * 100}%`, transform: `translateX(-${activeSlide * (100 / slides.length)}%)` }}
                  >
                    {slides.map((slide, idx) => (
                      <div
                        key={slide.id || `${section.id}-slide-${idx}`}
                        className="image-banner-carousel__slide"
                        style={{ width: `${100 / slides.length}%` }}
                      >
                        <img src={slide.url} alt={slide.alt || `Banner slide ${idx + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>
                {slides.length > 1 && (
                  <>
                    <div className="image-banner-carousel__controls">
                      <button type="button" className="btn btn-light btn-sm shadow-sm" onClick={() => goTo(activeSlide - 1)} aria-label="Previous banner slide">
                        <i className="bi bi-chevron-left" aria-hidden="true"></i>
                      </button>
                      <button type="button" className="btn btn-light btn-sm shadow-sm" onClick={() => goTo(activeSlide + 1)} aria-label="Next banner slide">
                        <i className="bi bi-chevron-right" aria-hidden="true"></i>
                      </button>
                    </div>
                    <div className="image-banner-carousel__dots">
                      {slides.map((_, idx) => (
                        <button
                          key={`dot-${section.id}-${idx}`}
                          type="button"
                          className={`image-banner-carousel__dot${idx === activeSlide ? ' is-active' : ''}`}
                          onClick={() => goTo(idx)}
                          aria-label={`Go to slide ${idx + 1}`}
                        ></button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function RichTextSection({ section, theme, experienceTheme, experienceKey }) {
  const body = Array.isArray(section.body) ? section.body : [];
  const fallbackTheme = experienceTheme?.sectionDefaults?.richText || 'calm-paper';
  const themeKey = section.style || fallbackTheme;
  const richTheme = RICH_TEXT_THEMES[themeKey] ?? RICH_TEXT_THEMES['calm-paper'];
  const surfaceStyle = {
    borderRadius: '28px',
    padding: '1.75rem clamp(1rem, 3vw, 2.5rem)',
    ...(richTheme.background ? { background: richTheme.background } : {}),
    ...(richTheme.shadow ? { boxShadow: richTheme.shadow } : {})
  };
  const headingStyle = richTheme.headingColor ? { color: richTheme.headingColor } : undefined;
  const bodyStyle = richTheme.bodyColor ? { color: richTheme.bodyColor } : undefined;
  const accentColor = richTheme.accentColor;

  return (
    <section className="container px-3 px-sm-4" data-store-theme={experienceKey}>
      <div className="rich-text-surface" style={surfaceStyle} data-theme={themeKey}>
        {section.title && <h2 className="h4 mb-3" style={headingStyle}>{section.title}</h2>}
        <div className="vstack gap-3">
          {body.map((block, idx) => {
            if (block?.type === 'list') {
              const items = Array.isArray(block.items) ? block.items : [];
              const isCheck = block.style === 'check';
              return (
                <ul key={idx} className="list-unstyled" style={bodyStyle}>
                  {items.map((item, itemIdx) => (
                    <li key={itemIdx} className="d-flex align-items-start gap-2">
                      {isCheck ? <span style={{ color: accentColor || '#198754' }}>✔️</span> : <span>•</span>}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            if (block?.type === 'paragraph') {
              return <p key={idx} className="mb-0" style={bodyStyle}>{block.content}</p>;
            }
            return <p key={idx} className="mb-0" style={bodyStyle}>{typeof block === 'string' ? block : JSON.stringify(block)}</p>;
          })}
        </div>
      </div>
    </section>
  );
}
