import { useEffect, useState } from 'react';
import { api, mapProductResponse } from '../services/api.js';
import { BRAND_NAME } from '../config/brand.js';
import { useSettings } from '../context/SettingsContext.jsx';
import SectionRenderer, { clamp } from '../components/homepage/SectionRenderer.jsx';

const DEFAULT_HOME_LAYOUT = () => ({
  slug: 'home',
  title: 'Default home experience',
  status: 'published',
  isActive: true,
  layout: {
    sections: [
      {
        id: 'hero-primary',
        type: 'hero',
        headline: 'Essentials delivered lightning fast',
        subheading: 'Shop fresh groceries, household staples, and top brands with same-day delivery.',
        backgroundImage: null,
        primaryCta: {
          label: 'Shop fresh picks',
          href: '/products'
        },
        secondaryCta: {
          label: 'Browse categories',
          href: '/products'
        }
      },
      {
        id: 'featured-categories',
        type: 'category-grid',
        title: 'Shop by category',
        subtitle: 'Jump into popular aisles shoppers love right now.',
        columns: 4,
        items: [
          { label: 'Fresh Produce', icon: '🥑', href: '/products?category=produce' },
          { label: 'Bakery & Breakfast', icon: '🥐', href: '/products?category=bakery' },
          { label: 'Beverages', icon: '🧃', href: '/products?category=beverages' },
          { label: 'Household Essentials', icon: '🧼', href: '/products?category=household' },
          { label: 'Snacks & Treats', icon: '🍪', href: '/products?category=snacks' },
          { label: 'Baby & Kids', icon: '🍼', href: '/products?category=baby' },
          { label: 'Health & Beauty', icon: '💄', href: '/products?category=beauty' },
          { label: 'Pet Supplies', icon: '🐾', href: '/products?category=pets' }
        ]
      },
      {
        id: 'daily-deals',
        type: 'product-carousel',
        title: 'Daily price drops',
        dataSource: {
          type: 'dynamic',
          scope: 'promotions',
          filters: {
            tag: 'daily-deals',
            limit: 8
          }
        },
        display: {
          showRating: true,
          showAddToCart: true
        }
      },
      {
        id: 'banner-delivery',
        type: 'image-banner',
        title: 'Free delivery over KSh 2,500',
        description: 'Schedule a delivery slot that works for you and we will handle the rest.',
        theme: 'success',
        media: {
          imageUrl: null,
          backgroundColor: '#e1f7e7'
        },
        cta: {
          label: 'See delivery options',
          href: '/delivery'
        }
      },
      {
        id: 'top-rated',
        type: 'product-carousel',
        title: 'Highly rated by shoppers',
        dataSource: {
          type: 'dynamic',
          scope: 'top-rated',
          filters: {
            minRating: 4,
            limit: 8
          }
        },
        display: {
          showRating: true,
          showAddToCart: true
        }
      },
      {
        id: 'content-rich-text',
        type: 'rich-text',
        title: 'Why shoppers love Supermarket+',
        body: [
          { type: 'paragraph', content: 'We combine curated products, unbeatable freshness, and delightful delivery to keep your pantry stocked without the hassle.' },
          { type: 'list', style: 'check', items: [
            'Over 5,000 items with transparent pricing',
            'Real-time order tracking and proactive support',
            'Personalized recommendations powered by your favorites'
          ] }
        ]
      }
    ]
  },
  meta: {
    theme: 'light'
  }
});

const sectionKey = (section, index = 0) => (section?.id ? String(section.id) : `${section?.type || 'section'}-${index}`);

const toSlug = (value) => {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const collectFilterTags = (filters = {}) => {
  const candidates = [];
  if (Array.isArray(filters.tags)) {
    filters.tags.filter(Boolean).forEach(tag => candidates.push(tag));
  }
  if (filters.tag) {
    candidates.push(filters.tag);
  }

  const unique = new Set();
  candidates
    .map(toSlug)
    .filter(Boolean)
    .forEach(slug => unique.add(slug));

  return Array.from(unique.values());
};

async function resolveProductsForSection(section) {
  const filters = section?.dataSource?.filters ?? {};
  const limit = clamp(Number(filters.limit ?? 8) || 8, 4, 20);
  const tagSlugs = collectFilterTags(filters);

  try {
    let response;
    if (section?.dataSource?.type === 'dynamic') {
      const payload = { page: 0, size: limit };
      if (section?.dataSource?.scope) {
        payload.scope = section.dataSource.scope;
      }
      if (filters.categoryId) payload.categoryId = filters.categoryId;
      if (filters.brand) payload.brand = filters.brand;
      if (filters.q) payload.q = filters.q;
      if (tagSlugs.length) {
        payload.tags = tagSlugs;
        if (!payload.promoTag) {
          payload.promoTag = tagSlugs[0];
        }
      }
      if (filters.minPrice != null) payload.minPrice = filters.minPrice;
      if (filters.maxPrice != null) payload.maxPrice = filters.maxPrice;
      if (filters.inStock != null) payload.inStock = filters.inStock;
  if (filters.trendingDays != null) payload.trendingDays = Number(filters.trendingDays);
      if (Array.isArray(filters.ids) && filters.ids.length > 0) {
        payload.ids = filters.ids;
      }
      response = await api.products.search(payload);
    } else {
      response = await api.products.list(0, limit);
    }

    const raw = response?.content ?? response ?? [];
    let items = raw.map(mapProductResponse);

    if (filters.minRating != null) {
      const minRating = Number(filters.minRating);
      if (!Number.isNaN(minRating)) {
        const ratedItems = items.filter(product => (product.ratingAverage ?? 0) >= minRating);
        if (ratedItems.length > 0) {
          items = ratedItems;
        }
      }
    }

    if (section?.dataSource?.scope === 'top-rated') {
      items = [...items].sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0));
    }

    if (section?.dataSource?.scope === 'promotions' && tagSlugs.length) {
      items = items.filter(product => {
        const productTagSlugs = Array.isArray(product.tagSlugs)
          ? product.tagSlugs.map(toSlug)
          : [];

        if (productTagSlugs.length === 0 && Array.isArray(product.tags)) {
          product.tags.forEach(tag => {
            const slug = toSlug(tag?.slug ?? tag?.name ?? '');
            if (slug) {
              productTagSlugs.push(slug);
            }
          });
        }

        if (productTagSlugs.length === 0) return false;

        return tagSlugs.some(slug => productTagSlugs.includes(slug));
      });
    }

    return { items: items.slice(0, limit), error: null };
  } catch (err) {
    return { items: [], error: err?.message || 'Failed to load products' };
  }
}

export default function Home() {
  const { settings } = useSettings();
  const storeName = settings?.storeName || BRAND_NAME;
  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectionProducts, setSectionProducts] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.homepage.get()
      .then(data => {
        if (cancelled) return;
        setLayout(data ?? DEFAULT_HOME_LAYOUT());
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message || 'We couldn\'t personalise the homepage right now. Showing a curated experience.');
        setLayout(DEFAULT_HOME_LAYOUT());
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!layout?.layout?.sections) {
      setSectionProducts({});
      return;
    }

    const productSections = layout.layout.sections
      .map((section, index) => ({ section, index, key: sectionKey(section, index) }))
      .filter(({ section }) => section.type === 'product-carousel');

    if (productSections.length === 0) {
      setSectionProducts({});
      return;
    }

    let cancelled = false;
    setSectionProducts(prev => {
      const next = { ...prev };
      productSections.forEach(({ key }) => {
        next[key] = { ...(next[key] ?? {}), loading: true, error: null };
      });
      return next;
    });

    Promise.all(productSections.map(async ({ section, key }) => {
      const { items, error } = await resolveProductsForSection(section);
      return { id: key, items, error };
    })).then(results => {
      if (cancelled) return;
      setSectionProducts(prev => {
        const next = { ...prev };
        results.forEach(({ id, items, error }) => {
          next[id] = { items, error, loading: false };
        });
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [layout]);

  const sections = layout?.layout?.sections?.map((section, index) => ({ section, index, key: sectionKey(section, index) })) ?? [];
  const theme = layout?.meta?.theme === 'dark' ? 'dark' : 'light';

  return (
    <div className={`homepage-page ${theme === 'dark' ? 'bg-dark text-white' : 'bg-body'}`}>
      <div className="container-fluid px-0">
        {error && (
          <div className="alert alert-warning mx-3 mx-sm-4 mt-3" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="placeholder-section py-5 text-center">
            <div className="placeholder-glow">
              <span className="placeholder col-6" style={{ height: '2.5rem' }}></span>
            </div>
            <p className="text-muted mt-3">☻ Don't worry, once this opens up you'll have an experience like never before…🤤</p>
          </div>
        )}

        {!loading && (
          <div className="vstack gap-4">
            {sections.map(({ section, index, key }) => (
              <SectionRenderer
                key={key}
                section={section}
                storeName={storeName}
                data={section.type === 'product-carousel' ? sectionProducts[key] : null}
                theme={theme}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

