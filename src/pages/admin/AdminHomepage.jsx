import { useEffect, useMemo, useRef, useState } from 'react';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import SectionRenderer, { clamp } from '../../components/homepage/SectionRenderer.jsx';
import { STORE_THEMES, STORE_THEME_KEYS, DEFAULT_STORE_THEME, normalizeStoreTheme } from '../../config/storeThemes.js';

const defaultPageMeta = {
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 1,
  first: true,
  last: true
};

const CTA_LINK_PATTERN = /^(https?:\/\/|\/)/i;

function validateLinkValue(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return 'Link cannot be empty';
  if (!CTA_LINK_PATTERN.test(trimmed)) {
    return 'Link must start with "/" for internal routes or "http(s)://" for external URLs';
  }
  return null;
}

function validateSection(section) {
  const fieldErrors = {};
  const issues = [];

  if (!section || !section.type) {
    return { fieldErrors, issues };
  }

  const pushIssue = (severity, message) => {
    issues.push({ severity, message });
  };

  if (section.type === 'hero') {
    const primaryLabel = section.primaryCta?.label?.trim();
    const primaryHref = section.primaryCta?.href;
    if (primaryLabel && !primaryHref) {
      fieldErrors.primaryHref = 'Provide a link for the primary CTA.';
      pushIssue('error', 'Hero primary CTA is missing a link.');
    } else {
      const error = validateLinkValue(primaryHref);
      if (error) {
        fieldErrors.primaryHref = error;
        pushIssue('error', 'Hero primary CTA link must be internal (/path) or absolute URL.');
      }
    }

    const secondaryLabel = section.secondaryCta?.label?.trim();
    const secondaryHref = section.secondaryCta?.href;
    if (secondaryLabel && !secondaryHref) {
      fieldErrors.secondaryHref = 'Provide a link for the secondary CTA.';
      pushIssue('error', 'Hero secondary CTA is missing a link.');
    } else {
      const error = validateLinkValue(secondaryHref);
      if (error) {
        fieldErrors.secondaryHref = error;
        pushIssue('error', 'Hero secondary CTA link must be internal (/path) or absolute URL.');
      }
    }
  }

  if (section.type === 'category-grid') {
    const items = Array.isArray(section.items) ? section.items : [];
    const itemErrors = [];
    items.forEach((item, idx) => {
      const label = item?.label?.trim() || `Item ${idx + 1}`;
      const href = item?.href;
      if (label && !href) {
        itemErrors[idx] = 'Link required for this category item.';
        pushIssue('error', `${label} is missing a link.`);
      } else {
        const error = validateLinkValue(href);
        if (error) {
          itemErrors[idx] = error;
          pushIssue('error', `${label} has an invalid link format.`);
        }
      }
    });
    if (itemErrors.some(Boolean)) {
      fieldErrors.items = itemErrors;
    }
  }

  if (section.type === 'image-banner') {
    const hasCta = section.cta?.label || section.cta?.href;
    if (hasCta) {
      const error = validateLinkValue(section.cta?.href);
      if (error) {
        fieldErrors.ctaHref = error;
        pushIssue('error', 'Image banner CTA link must start with "/" or "http(s)://".');
      }
    }
    const slides = Array.isArray(section.media?.slides)
      ? section.media.slides
      : (section.media?.imageUrl ? [{ url: section.media.imageUrl }] : []);
    if (!Array.isArray(section.media?.slides) && section.media?.imageUrl) {
      // legacy support, no validation issues when single legacy image present
    }
    if (slides.length === 0) {
      pushIssue('warning', 'Add at least one slide image so the banner has visual impact.');
    }
    if (slides.length > 5) {
      pushIssue('error', 'Image banner supports a maximum of five slides.');
    }
    const slideErrors = slides.map((slide) => {
      if (!slide || !slide.url) {
        return 'Image URL required';
      }
      return null;
    });
    if (slides.length > 0 && slideErrors.some(Boolean)) {
      fieldErrors.slides = slideErrors;
    }
  }

  if (section.type === 'rich-text') {
    const body = Array.isArray(section.body) ? section.body : [];
    if (body.length === 0) {
      pushIssue('warning', 'Rich text sections perform best with at least one paragraph.');
    }
  }

  if (section.type === 'promo-strip') {
    const label = section.cta?.label?.trim();
    const href = section.cta?.href;
    if (label && !href) {
      fieldErrors.promoStripCtaHref = 'Provide a link for the promo strip CTA.';
      pushIssue('error', 'Promo strip CTA is missing a link.');
    } else if (href) {
      const error = validateLinkValue(href);
      if (error) {
        fieldErrors.promoStripCtaHref = error;
        pushIssue('error', 'Promo strip CTA link must be internal or absolute.');
      }
    }
    if (!section.headline && !section.eyebrow) {
      pushIssue('warning', 'Promo strip works best with a headline or eyebrow text.');
    }
  }

  return { fieldErrors, issues };
}

const PREVIEW_STORE_NAME = 'Supermarket+';

function buildPreviewProductItems(section) {
  const limit = clamp(Number(section?.dataSource?.filters?.limit ?? 6) || 6, 4, 12);
  return Array.from({ length: limit }).map((_, idx) => ({
    id: `preview-product-${idx + 1}`,
    name: `Preview product ${idx + 1}`,
    description: 'Layout preview sample copy. Real products will appear when published.',
    brand: 'Preview',
    price: 249 + idx * 20,
    unit: 'ea',
    image: '',
    ratingAverage: 4.5,
    ratingCount: 132,
    stock: 8
  }));
}

const SECTION_LIBRARY = {
  hero: {
    label: 'Hero Banner',
    description: 'Large hero with headline, subheading, and CTAs.',
    template: () => ({
      id: `hero-${Date.now()}`,
      type: 'hero',
      style: 'classic-fresh',
      headline: 'Headline',
      subheading: 'Subheading',
      backgroundImage: null,
      primaryCta: { label: 'Shop now', href: '/products' },
      secondaryCta: { label: 'Browse categories', href: '/products' }
    })
  },
  'promo-strip': {
    label: 'Promo Strip',
    description: 'Slim, eye-catching strip for seasonal moments.',
    template: () => ({
      id: `promo-strip-${Date.now()}`,
      type: 'promo-strip',
      eyebrow: 'Holiday highlight',
      headline: 'Black Friday sparkle — up to 40% off',
      subtext: 'Stock up early so you can glide through checkout when the sale opens.',
      style: 'twilight-glow',
      cta: {
        label: 'Preview deals',
        href: '/products?tag=black-friday'
      }
    })
  },
  'category-grid': {
    label: 'Category Grid',
    description: 'Multi-column grid of curated categories.',
    template: () => ({
      id: `cat-grid-${Date.now()}`,
      type: 'category-grid',
      style: 'fresh-canopy',
      title: 'Shop by category',
      subtitle: 'Popular aisles curated for you.',
      columns: 4,
      items: [
        { label: 'Fresh Produce', icon: '🥬', href: '/products?category=produce' },
        { label: 'Household', icon: '🧼', href: '/products?category=household' }
      ]
    })
  },
  'product-carousel': {
    label: 'Product Carousel',
    description: 'Horizontally scrollable collection fed by analytics.',
    template: () => ({
      id: `carousel-${Date.now()}`,
      type: 'product-carousel',
      style: 'classic',
      title: 'Personalised picks',
      dataSource: {
        type: 'dynamic',
        scope: 'promotions',
        filters: {
          limit: 8
        }
      },
      display: {
        showRating: true,
        showAddToCart: true
      }
    })
  },
  'image-banner': {
    label: 'Image Banner',
    description: 'Full-width banner with optional CTA.',
    template: () => ({
      id: `banner-${Date.now()}`,
      type: 'image-banner',
      style: 'emerald-luxe',
      eyebrow: 'Weekend freshness',
      title: 'Free delivery over KSh 2,500',
      description: 'Schedule a delivery slot that works for you and we will handle the rest.',
      media: {
        backgroundColor: '#0f2d19',
        slides: [
          {
            id: `banner-slide-${Date.now()}-1`,
            url: 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80',
            alt: 'Fresh groceries packed in a bag'
          },
          {
            id: `banner-slide-${Date.now()}-2`,
            url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
            alt: 'Assorted vegetables on a table'
          }
        ]
      },
      cta: {
        label: 'See delivery options',
        href: '/delivery',
        style: 'primary'
      }
    })
  },
  'rich-text': {
    label: 'Rich Text',
    description: 'A section of editorial copy or list content.',
    template: () => ({
      id: `rich-${Date.now()}`,
      type: 'rich-text',
      style: 'calm-paper',
      title: 'Why shoppers love us',
      body: [
        { type: 'paragraph', content: 'We combine curated products, unbeatable freshness, and delightful delivery.' }
      ]
    })
  }
};

const DEFAULT_TEMPLATE_SECTIONS = () => [
  SECTION_LIBRARY.hero.template(),
  SECTION_LIBRARY['promo-strip'].template(),
  SECTION_LIBRARY['category-grid'].template(),
  SECTION_LIBRARY['product-carousel'].template(),
  SECTION_LIBRARY['image-banner'].template(),
  SECTION_LIBRARY['rich-text'].template()
];

const PROMO_STRIP_THEME_OPTIONS = [
  { value: 'twilight-glow', label: 'Twilight glow (indigo → magenta)' },
  { value: 'candy-crush', label: 'Candy crush (crimson → amber)' },
  { value: 'forest-lights', label: 'Forest lights (emerald → mint)' },
  { value: 'nordic-spark', label: 'Nordic spark (icy blue → silver)' }
];

const HERO_THEME_OPTIONS = [
  { value: 'classic-fresh', label: 'Classic fresh greens' },
  { value: 'sunrise-citrus', label: 'Sunrise citrus glow' },
  { value: 'aqua-mist', label: 'Aqua mist' },
  { value: 'midnight-bloom', label: 'Midnight bloom' }
];

const CATEGORY_GRID_THEME_OPTIONS = [
  { value: 'fresh-canopy', label: 'Fresh canopy' },
  { value: 'sunset-horizon', label: 'Sunset horizon' },
  { value: 'midnight-velvet', label: 'Midnight velvet' }
];

const CAROUSEL_THEME_OPTIONS = [
  { value: 'classic', label: 'Classic minimal' },
  { value: 'glass-emerald', label: 'Glass emerald' },
  { value: 'sunset-candy', label: 'Sunset candy' },
  { value: 'midnight-luxe', label: 'Midnight luxe' }
];

const RICH_TEXT_THEME_OPTIONS = [
  { value: 'calm-paper', label: 'Calm paper' },
  { value: 'sunset-quartz', label: 'Sunset quartz' },
  { value: 'nocturne', label: 'Nocturne' }
];

const IMAGE_BANNER_THEME_OPTIONS = [
  { value: 'emerald-luxe', label: 'Emerald luxe (deep green glow)' },
  { value: 'sunrise-breeze', label: 'Sunrise breeze (golden gradients)' },
  { value: 'midnight-neon', label: 'Midnight neon (dark with neon accents)' },
  { value: 'crisp-minimal', label: 'Crisp minimal (light modern)' }
];

const clone = (value) => JSON.parse(JSON.stringify(value));

function normaliseLayoutPayload(layout) {
  const payload = {
    title: layout.title || null,
    layout: clone(layout.layout ?? { sections: [] }),
    meta: clone(layout.meta ?? {})
  };
  if (layout.status === 'draft' || layout.status === 'archived') {
    payload.status = layout.status;
  }
  // Ensure every section has an id
  if (Array.isArray(payload.layout?.sections)) {
    payload.layout.sections = payload.layout.sections.map((section, idx) => {
      if (!section.id) {
        return { ...section, id: `${section.type || 'section'}-${idx}-${Date.now()}` };
      }
      return section;
    });
  }
  return payload;
}

export default function AdminHomepage() {
  const [layouts, setLayouts] = useState([]);
  const [pageMeta, setPageMeta] = useState(defaultPageMeta);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastSaveLabel, setLastSaveLabel] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ slug: 'home', title: '', template: 'default' });
  const [advancedMetaOpen, setAdvancedMetaOpen] = useState(false);
  const [tagOptions, setTagOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const tagsLoadedRef = useRef(false);
  const categoriesLoadedRef = useRef(false);
  const autoSaveTimerRef = useRef(null);

  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setListError(null);
    api.admin.homepageLayouts.list({
      page,
      size,
      q: search.trim() || undefined,
      status: statusFilter || undefined
    })
      .then(response => {
        if (cancelled) return;
        const content = Array.isArray(response?.content)
          ? response.content
          : Array.isArray(response)
            ? response
            : [];
        setLayouts(content);
        const meta = {
          page: Number.isFinite(Number(response?.page)) ? Number(response.page) : page,
          size: Number.isFinite(Number(response?.size)) ? Number(response.size) : size,
          totalElements: Number.isFinite(Number(response?.totalElements)) ? Number(response.totalElements) : content.length,
          totalPages: Number.isFinite(Number(response?.totalPages)) ? Number(response.totalPages) : Math.max(1, Math.ceil(content.length / size)),
          first: typeof response?.first === 'boolean' ? response.first : page <= 0,
          last: typeof response?.last === 'boolean' ? response.last : (Number.isFinite(Number(response?.totalPages)) ? page >= Number(response.totalPages) - 1 : true)
        };
        setPageMeta(meta);
        if (!selectedId && content.length > 0) {
          setSelectedId(content[0].id);
          setDraft(clone(content[0]));
          setIsDirty(false);
        }
      })
      .catch(err => {
        if (cancelled) return;
        setListError(err?.message || 'Failed to load homepage layouts.');
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, size, search, statusFilter]);

  useEffect(() => {
    if (tagsLoadedRef.current) return;
    tagsLoadedRef.current = true;
    api.admin.productTags.list({ page: 0, size: 200, sort: 'name', direction: 'asc' })
      .then((res) => {
        const items = res?.content ?? res ?? [];
        items.sort((a, b) => {
          const nameA = (a?.name || a?.slug || '').toLowerCase();
          const nameB = (b?.name || b?.slug || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setTagOptions(items);
      })
      .catch((err) => {
        console.error('Failed to load product tags for homepage editor', err);
      });
  }, []);

  useEffect(() => {
    if (categoriesLoadedRef.current) return;
    categoriesLoadedRef.current = true;
    api.categories.list()
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        const normalized = list.map(item => ({
          id: item.id ?? null,
          label: item.label ?? item.fullName ?? item.name ?? `Category ${item.id ?? ''}`,
          slug: item.slug ?? '',
          path: item.path ?? null,
          raw: item
        })).sort((a, b) => a.label.localeCompare(b.label));
        setCategoryOptions(normalized);
      })
      .catch((err) => {
        console.error('Failed to load categories for homepage editor', err);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      setIsDirty(false);
      return;
    }
    const selected = layouts.find(item => item.id === selectedId);
    if (selected && !isDirty) {
      setDraft(clone(selected));
    }
  }, [layouts, selectedId, isDirty]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const selectedLayout = useMemo(() => {
    if (!selectedId) return null;
    return layouts.find(l => l.id === selectedId) || null;
  }, [layouts, selectedId]);

  function scheduleAutoSave() {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    if (typeof window === 'undefined') return;
    autoSaveTimerRef.current = window.setTimeout(() => {
      handleSave({ silent: true });
    }, 8000);
  }

  function markDirtyUpdater(updater) {
    let shouldSchedule = false;
    setDraft(prev => {
      if (!prev) return prev;
      const next = clone(prev);
      updater(next);
      setIsDirty(true);
      shouldSchedule = true;
      return next;
    });
    if (shouldSchedule) {
      scheduleAutoSave();
    }
  }

  function handleSelectLayout(id) {
    if (isDirty && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    setSelectedId(id);
    const target = layouts.find(l => l.id === id);
    setDraft(target ? clone(target) : null);
    setIsDirty(false);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }

  function handleCreateSubmit(event) {
    event.preventDefault();
    const slug = createForm.slug.trim();
    if (!slug) {
      toast.push('Slug is required.', 'error');
      return;
    }
    const slugNormalized = slug.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const layout = {
      slug: slugNormalized,
      title: createForm.title ? createForm.title.trim() : null,
      layout: {
        sections: createForm.template === 'blank' ? [] : DEFAULT_TEMPLATE_SECTIONS()
      },
      meta: {
        theme: 'light'
      }
    };

    api.admin.homepageLayouts.create(layout)
      .then(created => {
        toast.push('Draft layout created.', 'success');
        setShowCreate(false);
        setCreateForm({ slug: 'home', title: '', template: 'default' });
        setLayouts(prev => [created, ...prev]);
        setSelectedId(created.id);
        setDraft(clone(created));
        setIsDirty(false);
      })
      .catch(err => {
        toast.push(err?.message || 'Failed to create layout.', 'error');
      });
  }

  function handleAddSection(type) {
    const libraryItem = SECTION_LIBRARY[type];
    if (!libraryItem) return;
    markDirtyUpdater(next => {
      if (!Array.isArray(next.layout?.sections)) {
        next.layout = { sections: [] };
      }
      next.layout.sections.push(libraryItem.template());
    });
  }

  function handleRemoveSection(index) {
    if (!draft?.layout?.sections) return;
    markDirtyUpdater(next => {
      next.layout.sections.splice(index, 1);
    });
  }

  function handleMoveSection(index, direction) {
    if (!draft?.layout?.sections) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draft.layout.sections.length) return;
    markDirtyUpdater(next => {
      const sections = next.layout.sections;
      const temp = sections[index];
      sections[index] = sections[targetIndex];
      sections[targetIndex] = temp;
    });
  }

  function handleSectionChange(index, nextSection) {
    markDirtyUpdater(draftLayout => {
      draftLayout.layout.sections[index] = nextSection;
    });
  }

  function handleMetaChange(field, value) {
    markDirtyUpdater(next => {
      next.meta = next.meta ?? {};
      if (value === '' || value == null) {
        delete next.meta[field];
      } else {
        next.meta[field] = value;
      }
    });
  }

  function handleStatusChange(value) {
    markDirtyUpdater(next => {
      next.status = value;
      if (value !== 'published') {
        next.isActive = false;
      }
    });
  }

  function handleSave({ silent = false } = {}) {
    if (!draft || saving) return;
    if (!draft.id) {
      toast.push('Save unavailable until layout has been created.', 'error');
      return;
    }
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setSaving(true);
    setSaveMode(silent ? 'auto' : 'manual');
    const payload = normaliseLayoutPayload(draft);
    api.admin.homepageLayouts.update(draft.id, payload)
      .then(updated => {
        if (!silent) {
          toast.push('Layout saved.', 'success');
        }
        setLayouts(prev => prev.map(item => item.id === updated.id ? updated : item));
        setDraft(clone(updated));
        setIsDirty(false);
        const timestamp = Date.now();
        setLastSavedAt(timestamp);
        setLastSaveLabel(silent ? 'auto' : 'manual');
      })
      .catch(err => {
        const message = err?.message || 'Failed to save layout.';
        if (silent) {
          toast.push(`Autosave failed: ${message}`, 'error');
        } else {
          toast.push(message, 'error');
        }
      })
      .finally(() => {
        setSaving(false);
        setSaveMode(null);
      });
  }

  function handlePublish() {
    if (!draft) return;
    setPublishing(true);
    api.admin.homepageLayouts.publish(draft.id)
      .then(updated => {
        toast.push('Layout published and set active.', 'success');
        setLayouts(prev => prev.map(item => item.id === updated.id ? updated : item));
        setDraft(clone(updated));
        setIsDirty(false);
      })
      .catch(err => {
        toast.push(err?.message || 'Failed to publish layout.', 'error');
      })
      .finally(() => setPublishing(false));
  }

  function handleDelete() {
    if (!draft || draft.isActive) {
      toast.push('Cannot delete the active layout.', 'error');
      return;
    }
    if (!window.confirm('Delete this layout? This action cannot be undone.')) return;
    setDeleting(true);
    api.admin.homepageLayouts.remove(draft.id)
      .then(() => {
        toast.push('Layout deleted.', 'success');
        setLayouts(prev => prev.filter(item => item.id !== draft.id));
        setDraft(null);
        setSelectedId(null);
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
      })
      .catch(err => {
        toast.push(err?.message || 'Failed to delete layout.', 'error');
      })
      .finally(() => setDeleting(false));
  }

  const sections = draft?.layout?.sections ?? [];

  const hasPublishedActive = layouts.some(l => l.isActive);
  const saveButtonLabel = saving ? (saveMode === 'auto' ? 'Auto-saving…' : 'Saving…') : (isDirty ? 'Save changes' : 'Saved');
  const saveMetaText = isDirty
    ? 'Unsaved changes'
    : lastSavedAt
      ? `${lastSaveLabel === 'auto' ? 'Autosaved' : 'Saved'} at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';
  const saveMetaClass = isDirty ? 'text-danger' : 'text-muted';

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h1 className="h4 mb-1">Admin: Homepage Layouts</h1>
          <p className="text-muted small mb-0">Design and publish responsive homepage experiences.</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowCreate(s => !s)}>
            {showCreate ? 'Cancel' : 'New Draft'}
          </button>
          {draft && (
            <button type="button" className="btn btn-success btn-sm" onClick={handlePublish} disabled={publishing || saving || (draft.status === 'published' && draft.isActive)}>
              {publishing ? 'Publishing…' : draft.status === 'published' && draft.isActive ? 'Active' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="card mb-4">
          <div className="card-body">
            <h2 className="h6">Create new layout</h2>
            <p className="text-muted small">Use a ready-made template or start from a blank canvas.</p>
            <form className="row g-3" onSubmit={handleCreateSubmit}>
              <div className="col-12 col-md-3">
                <label className="form-label" htmlFor="layoutSlug">Slug</label>
                <input id="layoutSlug" className="form-control" value={createForm.slug} onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value }))} placeholder="home" required />
                <div className="form-text">Lowercase slug, e.g. "home" or "valentines".</div>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label" htmlFor="layoutTitle">Title</label>
                <input id="layoutTitle" className="form-control" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Homepage name (optional)" />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label" htmlFor="layoutTemplate">Template</label>
                <select id="layoutTemplate" className="form-select" value={createForm.template} onChange={e => setCreateForm(f => ({ ...f, template: e.target.value }))}>
                  <option value="default">Default – hero, categories, carousels</option>
                  <option value="blank">Blank canvas</option>
                </select>
              </div>
              <div className="col-12 col-md-2 d-flex align-items-end">
                <button type="submit" className="btn btn-primary w-100">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-5 col-xl-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h2 className="h6 mb-0">Layouts</h2>
                <span className="badge text-bg-light text-secondary">{pageMeta.totalElements} total</span>
              </div>
              <FilterBar className="mb-3">
                <FilterBar.Field label="Search" width="col-12">
                  <input type="search" className="form-control form-control-sm" placeholder="Slug or title" value={search} onChange={e => setSearch(e.target.value)} />
                </FilterBar.Field>
                <FilterBar.Field label="Status" width="col-12">
                  <select className="form-select form-select-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </FilterBar.Field>
                <FilterBar.Reset onClick={() => { setSearch(''); setStatusFilter(''); setPage(0); }} disabled={!search && !statusFilter} />
              </FilterBar>
              {listError && <div className="alert alert-danger py-2 small" role="alert">{listError}</div>}
              {loadingList ? (
                <p className="text-muted small">Loading layouts…</p>
              ) : layouts.length === 0 ? (
                <p className="text-muted small">No homepage layouts found yet.</p>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '420px' }}>
                  <table className="table table-sm align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Slug</th>
                        <th>Status</th>
                        <th>Version</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {layouts.map(layout => (
                        <tr key={layout.id} className={layout.id === selectedId ? 'table-success' : ''}>
                          <td>
                            <div className="fw-semibold small">{layout.slug}</div>
                            <div className="text-muted small">{layout.title || 'Untitled'}</div>
                          </td>
                          <td>
                            <span className={`badge text-bg-${layout.isActive ? 'success' : layout.status === 'draft' ? 'secondary' : 'primary'} text-uppercase`}>{layout.isActive ? 'ACTIVE' : layout.status || 'DRAFT'}</span>
                          </td>
                          <td className="small">v{layout.version}</td>
                          <td className="text-end">
                            <button type="button" className="btn btn-link btn-sm" onClick={() => handleSelectLayout(layout.id)}>Open</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <PaginationBar {...pageMeta} size={size} onPageChange={setPage} onPageSizeChange={(value) => { setSize(value); setPage(0); }} sizes={[5, 10, 20, 50]} alwaysVisible={false} />
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-7 col-xl-8">
          {!draft ? (
            <div className="border border-dashed rounded p-4 text-center text-muted">
              <p className="mb-1">Select a layout to begin editing.</p>
              {!hasPublishedActive && <p className="small mb-0">Tip: publish a layout to make it live on the storefront.</p>}
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div>
                    <h2 className="h5 mb-0">Editing: {draft.title || draft.slug}</h2>
                    <div className="text-muted small">Slug: {draft.slug} · Version {draft.version} · {draft.status?.toUpperCase()}</div>
                    {draft.isActive && <div className="badge text-bg-success mt-2">Active</div>}
                  </div>
                  <div className="d-flex flex-column align-items-end gap-1">
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleDelete} disabled={deleting || draft.isActive}>{deleting ? 'Deleting…' : 'Delete'}</button>
                      <button type="button" className="btn btn-primary btn-sm" disabled={saving || !isDirty} onClick={() => handleSave()}>{saveButtonLabel}</button>
                    </div>
                    {saveMetaText && <div className={`small ${saveMetaClass}`}>{saveMetaText}</div>}
                  </div>
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="layoutTitleInput">Layout title</label>
                    <input id="layoutTitleInput" className="form-control" value={draft.title || ''} onChange={e => markDirtyUpdater(next => { next.title = e.target.value; })} placeholder="Homepage hero campaign" />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label" htmlFor="layoutStatusSelect">Status</label>
                    <select id="layoutStatusSelect" className="form-select" value={draft.status || 'draft'} onChange={e => handleStatusChange(e.target.value)}>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                      <option value="published" disabled={!draft.isActive}>Published</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label" htmlFor="layoutThemeSelect">Experience theme</label>
                    <select
                      id="layoutThemeSelect"
                      className="form-select"
                      value={normalizeStoreTheme(draft.meta?.theme || DEFAULT_STORE_THEME)}
                      onChange={e => handleMetaChange('theme', e.target.value)}
                    >
                      {STORE_THEME_KEYS.map((key) => (
                        <option key={key} value={key}>{STORE_THEMES[key].label}</option>
                      ))}
                    </select>
                    <div className="form-text">Determines homepage palette and matching product experience.</div>
                  </div>
                </div>

                <div className="mb-3">
                  <button type="button" className="btn btn-link p-0" onClick={() => setAdvancedMetaOpen(open => !open)}>
                    {advancedMetaOpen ? 'Hide' : 'Show'} advanced meta JSON
                  </button>
                  {advancedMetaOpen && (
                    <textarea className="form-control font-monospace mt-2" rows={6} value={JSON.stringify(draft.meta ?? {}, null, 2)} onChange={e => {
                      try {
                        const parsed = JSON.parse(e.target.value || '{}');
                        markDirtyUpdater(next => { next.meta = parsed; });
                      } catch (err) {
                        // Ignore invalid JSON until valid
                      }
                    }}></textarea>
                  )}
                </div>

                <hr />
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                  <h3 className="h6 mb-0">Sections</h3>
                  <div className="d-flex gap-2">
                    <select className="form-select form-select-sm" onChange={e => {
                      const type = e.target.value;
                      if (type) {
                        handleAddSection(type);
                        e.target.value = '';
                      }
                    }} defaultValue="">
                      <option value="" disabled>Add section…</option>
                      {Object.entries(SECTION_LIBRARY).map(([type, meta]) => (
                        <option key={type} value={type}>{meta.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {sections.length === 0 ? (
                  <div className="border border-dashed rounded p-3 text-center text-muted small">No sections yet. Use “Add section…” to start building.</div>
                ) : (
                  <div className="vstack gap-3">
                    {sections.map((section, idx) => {
                      const experienceKey = normalizeStoreTheme(draft.meta?.theme || DEFAULT_STORE_THEME);
                      const previewThemeMode = draft.meta?.mode === 'dark'
                        ? 'dark'
                        : (STORE_THEMES[experienceKey]?.mode === 'dark' ? 'dark' : 'light');
                      const previewStoreName = draft.meta?.storeName || draft.meta?.brandName || PREVIEW_STORE_NAME;
                      return (
                        <SectionEditor
                          key={section.id || `${section.type}-${idx}`}
                          section={section}
                          index={idx}
                          total={sections.length}
                          onChange={nextSection => handleSectionChange(idx, nextSection)}
                          onMove={(direction) => handleMoveSection(idx, direction)}
                          onRemove={() => handleRemoveSection(idx)}
                          storeName={previewStoreName}
                          themeMode={previewThemeMode}
                          experienceTheme={experienceKey}
                          tagOptions={tagOptions}
                          categoryOptions={categoryOptions}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionEditor({ section, index, total, onChange, onMove, onRemove, storeName, themeMode = 'light', experienceTheme = DEFAULT_STORE_THEME, tagOptions = [], categoryOptions = [] }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const headerLabel = SECTION_LIBRARY[section.type]?.label || (section.type ? section.type : `Section ${index + 1}`);
  const description = SECTION_LIBRARY[section.type]?.description;

  const validation = useMemo(() => validateSection(section), [section]);
  const errorIssues = validation.issues.filter(issue => issue.severity === 'error');
  const warningIssues = validation.issues.filter(issue => issue.severity === 'warning');
  const previewStoreName = storeName || PREVIEW_STORE_NAME;
  const previewThemeMode = themeMode === 'dark' ? 'dark' : 'light';
  const previewExperienceTheme = normalizeStoreTheme(experienceTheme || DEFAULT_STORE_THEME);
  const previewData = useMemo(() => {
    if (section.type === 'product-carousel') {
      return { items: buildPreviewProductItems(section), loading: false, error: null };
    }
    return null;
  }, [section]);

  const handleBasicChange = (field, value) => {
    onChange({ ...section, [field]: value });
  };

  const advancedValue = useMemo(() => JSON.stringify(section, null, 2), [section]);

  return (
    <div className="border rounded p-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div>
          <strong>{headerLabel}</strong>
          <div className="text-muted small">Type: {section.type}</div>
        </div>
        <div className="btn-group btn-group-sm" role="group">
          <button type="button" className="btn btn-outline-secondary" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move section up">
            <i className="bi bi-arrow-up"></i>
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move section down">
            <i className="bi bi-arrow-down"></i>
          </button>
          <button type="button" className="btn btn-outline-danger" onClick={onRemove} aria-label="Remove section">
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>
      {description && <p className="text-muted small mb-3">{description}</p>}

      {(errorIssues.length > 0 || warningIssues.length > 0) && (
        <div className="mb-3">
          {errorIssues.length > 0 && (
            <div className="alert alert-danger small mb-2" role="alert">
              <ul className="mb-0 ps-3">
                {errorIssues.map((issue, idx) => (
                  <li key={`err-${idx}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
          {warningIssues.length > 0 && (
            <div className="alert alert-warning small mb-0" role="alert">
              <ul className="mb-0 ps-3">
                {warningIssues.map((issue, idx) => (
                  <li key={`warn-${idx}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {section.type === 'hero' && (
        <HeroSectionEditor value={section} onChange={onChange} errors={validation.fieldErrors} />
      )}
      {section.type === 'category-grid' && (
        <CategoryGridSectionEditor value={section} onChange={onChange} errors={validation.fieldErrors} categoryOptions={categoryOptions} />
      )}
      {section.type === 'product-carousel' && (
        <ProductCarouselSectionEditor value={section} onChange={onChange} tagOptions={tagOptions} />
      )}
      {section.type === 'promo-strip' && (
        <PromoStripSectionEditor
          value={section}
          onChange={onChange}
          errors={validation.fieldErrors}
          tagOptions={tagOptions}
          categoryOptions={categoryOptions}
        />
      )}
      {section.type === 'image-banner' && (
        <ImageBannerSectionEditor value={section} onChange={onChange} errors={validation.fieldErrors} />
      )}
      {section.type === 'rich-text' && (
        <RichTextSectionEditor value={section} onChange={onChange} />
      )}
      {!['hero', 'category-grid', 'product-carousel', 'promo-strip', 'image-banner', 'rich-text'].includes(section.type) && (
        <div className="alert alert-warning small" role="alert">
          Unknown section type. Use advanced JSON editing below to modify this block safely.
        </div>
      )}

      <SectionLivePreview
        section={section}
        storeName={previewStoreName}
        themeMode={previewThemeMode}
        experienceTheme={previewExperienceTheme}
        data={previewData}
      />

      <div className="mt-3">
        <button type="button" className="btn btn-link p-0" onClick={() => setShowAdvanced(open => !open)}>
          {showAdvanced ? 'Hide' : 'Show'} advanced JSON
        </button>
        {showAdvanced && (
          <textarea
            className="form-control font-monospace mt-2"
            rows={8}
            value={advancedValue}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch (err) {
                // ignore until valid JSON entered
              }
            }}
          ></textarea>
        )}
      </div>
    </div>
  );
}

function HeroSectionEditor({ value, onChange, errors = {} }) {
  const update = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });
  const updatePrimary = (field, fieldValue) => onChange({ ...value, primaryCta: { ...(value.primaryCta || {}), [field]: fieldValue } });
  const updateSecondary = (field, fieldValue) => onChange({ ...value, secondaryCta: { ...(value.secondaryCta || {}), [field]: fieldValue } });

  return (
    <div className="row g-3">
      <div className="col-12 col-md-4">
        <label className="form-label" htmlFor={`hero-style-${value.id}`}>Theme</label>
        <select
          id={`hero-style-${value.id}`}
          className="form-select"
          value={value.style || 'classic-fresh'}
          onChange={e => update('style', e.target.value)}
        >
          {HERO_THEME_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {errors.style && <div className="invalid-feedback d-block">{errors.style}</div>}
        <div className="form-text">Switch background palette and CTA styling.</div>
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`hero-headline-${value.id}`}>Headline</label>
        <input id={`hero-headline-${value.id}`} className="form-control" value={value.headline || ''} onChange={e => update('headline', e.target.value)} placeholder="Big promise text" />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`hero-subheading-${value.id}`}>Subheading</label>
        <textarea id={`hero-subheading-${value.id}`} className="form-control" rows={2} value={value.subheading || ''} onChange={e => update('subheading', e.target.value)}></textarea>
      </div>
      <div className="col-12 col-md-6">
        <label className="form-label" htmlFor={`hero-bg-${value.id}`}>Background image (URL)</label>
        <input id={`hero-bg-${value.id}`} className="form-control" value={value.backgroundImage || ''} onChange={e => update('backgroundImage', e.target.value)} placeholder="https://…" />
        <div className="form-text">Leave blank for themed background.</div>
      </div>
      <div className="col-12 col-md-3">
        <label className="form-label" htmlFor={`hero-primary-label-${value.id}`}>Primary CTA label</label>
        <input id={`hero-primary-label-${value.id}`} className="form-control" value={value.primaryCta?.label || ''} onChange={e => updatePrimary('label', e.target.value)} />
      </div>
      <div className="col-12 col-md-3">
        <label className="form-label" htmlFor={`hero-primary-href-${value.id}`}>Primary CTA link</label>
        <input
          id={`hero-primary-href-${value.id}`}
          className={`form-control${errors.primaryHref ? ' is-invalid' : ''}`}
          value={value.primaryCta?.href || ''}
          onChange={e => updatePrimary('href', e.target.value)}
          placeholder="/products"
        />
        {errors.primaryHref && <div className="invalid-feedback">{errors.primaryHref}</div>}
      </div>
      <div className="col-12 col-md-3">
        <label className="form-label" htmlFor={`hero-secondary-label-${value.id}`}>Secondary CTA label</label>
        <input id={`hero-secondary-label-${value.id}`} className="form-control" value={value.secondaryCta?.label || ''} onChange={e => updateSecondary('label', e.target.value)} />
      </div>
      <div className="col-12 col-md-3">
        <label className="form-label" htmlFor={`hero-secondary-href-${value.id}`}>Secondary CTA link</label>
        <input
          id={`hero-secondary-href-${value.id}`}
          className={`form-control${errors.secondaryHref ? ' is-invalid' : ''}`}
          value={value.secondaryCta?.href || ''}
          onChange={e => updateSecondary('href', e.target.value)}
          placeholder="/products"
        />
        {errors.secondaryHref && <div className="invalid-feedback">{errors.secondaryHref}</div>}
      </div>
    </div>
  );
}

function SectionLivePreview({ section, storeName, themeMode = 'light', experienceTheme = DEFAULT_STORE_THEME, data }) {
  if (!section) return null;
  const experienceKey = normalizeStoreTheme(experienceTheme || DEFAULT_STORE_THEME);
  return (
    <div className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong className="small text-uppercase text-muted">Live preview</strong>
        <span className="badge text-bg-light text-secondary text-uppercase">{section.type}</span>
      </div>
      <div className="border rounded bg-body-tertiary" data-store-theme={experienceKey}>
        <div className="section-preview-surface" style={{ pointerEvents: 'none' }}>
          <SectionRenderer
            section={section}
            storeName={storeName}
            theme={themeMode}
            data={data}
            experienceTheme={experienceKey}
          />
        </div>
      </div>
    </div>
  );
}

function CategoryGridSectionEditor({ value, onChange, errors = {}, categoryOptions = [] }) {
  const update = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });
  const updateItem = (index, newItem) => {
    const items = Array.isArray(value.items) ? [...value.items] : [];
    items[index] = newItem;
    onChange({ ...value, items });
  };
  const removeItem = (index) => {
    const items = Array.isArray(value.items) ? value.items.filter((_, i) => i !== index) : [];
    onChange({ ...value, items });
  };

  const addItem = () => {
    const items = Array.isArray(value.items) ? [...value.items] : [];
    items.push({ label: 'New category', icon: '🛍️', href: '/products' });
    onChange({ ...value, items });
  };

  const resolvedCategoryOptions = useMemo(() => {
    return (Array.isArray(categoryOptions) ? categoryOptions : [])
      .map(option => ({
        value: option.slug || '',
        label: option.label || option.slug || 'Unnamed',
        id: option.id ?? null,
        raw: option.raw ?? option
      }))
      .filter(option => option.value);
  }, [categoryOptions]);

  const extractSlugFromHref = (href) => {
    if (typeof href !== 'string') return '';
    const match = href.match(/[?&]category=([^&]+)/i);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch (err) {
        return match[1];
      }
    }
    return '';
  };

  const handleCategorySelect = (index, slug) => {
    const items = Array.isArray(value.items) ? [...value.items] : [];
    const current = items[index] || { label: '', icon: '', href: '' };
    const selected = resolvedCategoryOptions.find(option => option.value === slug) || null;
    const next = {
      ...current,
      categorySlug: slug || undefined,
      categoryId: selected?.id ?? undefined
    };
    if (selected) {
      const generatedHref = `/products?category=${selected.value}`;
      next.href = generatedHref;
      if (!current.label || current.label === 'New category' || current.label === current.categoryLabel) {
        next.label = selected.label;
        next.categoryLabel = selected.label;
      } else {
        next.categoryLabel = selected.label;
      }
    }
    updateItem(index, next);
  };

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`category-style-${value.id}`}>Theme</label>
          <select
            id={`category-style-${value.id}`}
            className="form-select"
            value={value.style || 'fresh-canopy'}
            onChange={e => update('style', e.target.value)}
          >
            {CATEGORY_GRID_THEME_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.style && <div className="invalid-feedback d-block">{errors.style}</div>}
          <div className="form-text">Tweaks gradient accents and card styling.</div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor={`category-title-${value.id}`}>Section title</label>
          <input id={`category-title-${value.id}`} className="form-control" value={value.title || ''} onChange={e => update('title', e.target.value)} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor={`category-subtitle-${value.id}`}>Subtitle</label>
          <input id={`category-subtitle-${value.id}`} className="form-control" value={value.subtitle || ''} onChange={e => update('subtitle', e.target.value)} />
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label" htmlFor={`category-columns-${value.id}`}>Columns</label>
          <input id={`category-columns-${value.id}`} type="number" min="2" max="6" className="form-control" value={value.columns ?? 4} onChange={e => update('columns', Number(e.target.value) || 4)} />
        </div>
      </div>
      <div>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <strong className="small">Grid items</strong>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addItem}>Add item</button>
        </div>
        {(!value.items || value.items.length === 0) && <p className="text-muted small mb-0">No items yet.</p>}
        {Array.isArray(value.items) && value.items.length > 0 && (
          <div className="vstack gap-2">
            {value.items.map((item, idx) => (
              <div key={`${value.id}-item-${idx}`} className="border rounded p-2">
                <div className="row g-2 align-items-center">
                  <div className="col-12 col-md-3">
                    <label className="form-label form-label-sm" htmlFor={`category-item-label-${value.id}-${idx}`}>Label</label>
                    <input id={`category-item-label-${value.id}-${idx}`} className="form-control form-control-sm" value={item.label || ''} onChange={e => updateItem(idx, { ...item, label: e.target.value })} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label form-label-sm" htmlFor={`category-item-category-${value.id}-${idx}`}>Category</label>
                    <select
                      id={`category-item-category-${value.id}-${idx}`}
                      className="form-select form-select-sm"
                      value={item.categorySlug ?? extractSlugFromHref(item.href) ?? ''}
                      onChange={e => handleCategorySelect(idx, e.target.value)}
                    >
                      <option value="">Custom link…</option>
                      {resolvedCategoryOptions.map(option => (
                        <option key={`${value.id}-cat-${option.value}`} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <div className="form-text">Select a category to auto-fill the slug and link.</div>
                  </div>
                  <div className="col-6 col-md-1">
                    <label className="form-label form-label-sm" htmlFor={`category-item-icon-${value.id}-${idx}`}>Icon</label>
                    <input id={`category-item-icon-${value.id}-${idx}`} className="form-control form-control-sm" value={item.icon || ''} onChange={e => updateItem(idx, { ...item, icon: e.target.value })} />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label form-label-sm" htmlFor={`category-item-href-${value.id}-${idx}`}>Link</label>
                    <input
                      id={`category-item-href-${value.id}-${idx}`}
                      className={`form-control form-control-sm${errors.items?.[idx] ? ' is-invalid' : ''}`}
                      value={item.href || ''}
                      onChange={e => updateItem(idx, { ...item, href: e.target.value })}
                      placeholder="/products?category=produce"
                    />
                    {errors.items?.[idx] && <div className="invalid-feedback">{errors.items[idx]}</div>}
                  </div>
                  <div className="col-6 col-md-1 d-flex align-items-end">
                    <button type="button" className="btn btn-outline-danger btn-sm w-100" onClick={() => removeItem(idx)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCarouselSectionEditor({ value, onChange, tagOptions = [] }) {
  const update = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });
  const updateDataSource = (dataSourceUpdater) => {
    const dataSource = clone(value.dataSource ?? {});
    dataSourceUpdater(dataSource);
    onChange({ ...value, dataSource });
  };
  const updateDisplay = (displayUpdater) => {
    const display = { ...(value.display ?? {}) };
    displayUpdater(display);
    onChange({ ...value, display });
  };

  const resolvedTagOptions = Array.isArray(tagOptions) ? tagOptions : [];
  const selectedTagSlug = value.dataSource?.filters?.tag ?? '';
  const selectedTagMissing = selectedTagSlug && !resolvedTagOptions.some((tag) => tag?.slug === selectedTagSlug);

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`carousel-style-${value.id}`}>Theme</label>
          <select
            id={`carousel-style-${value.id}`}
            className="form-select"
            value={value.style || 'classic'}
            onChange={e => update('style', e.target.value)}
          >
            {CAROUSEL_THEME_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="form-text">Controls card surfaces and badge colors.</div>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor={`carousel-title-${value.id}`}>Title</label>
          <input id={`carousel-title-${value.id}`} className="form-control" value={value.title || ''} onChange={e => update('title', e.target.value)} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor={`carousel-scope-${value.id}`}>Scope</label>
          <select id={`carousel-scope-${value.id}`} className="form-select" value={value.dataSource?.scope || 'promotions'} onChange={e => updateDataSource(ds => { ds.scope = e.target.value; ds.type = ds.type || 'dynamic'; })}>
            <option value="promotions">Promotions</option>
            <option value="top-rated">Top rated</option>
            <option value="trending">Trending</option>
            <option value="recent">Recently viewed</option>
          </select>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label" htmlFor={`carousel-limit-${value.id}`}>Limit</label>
          <input id={`carousel-limit-${value.id}`} type="number" min="2" max="20" className="form-control" value={value.dataSource?.filters?.limit ?? 8} onChange={e => updateDataSource(ds => {
            ds.filters = ds.filters ?? {};
            ds.filters.limit = Number(e.target.value) || 8;
          })} />
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label" htmlFor={`carousel-min-rating-${value.id}`}>Min rating</label>
          <input id={`carousel-min-rating-${value.id}`} type="number" min="0" max="5" step="0.1" className="form-control" value={value.dataSource?.filters?.minRating ?? ''} onChange={e => updateDataSource(ds => {
            ds.filters = ds.filters ?? {};
            const next = e.target.value;
            if (next === '') delete ds.filters.minRating;
            else ds.filters.minRating = Number(next);
          })} />
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label" htmlFor={`carousel-tag-${value.id}`}>Tag</label>
          <select
            id={`carousel-tag-${value.id}`}
            className="form-select"
            value={selectedTagSlug}
            onChange={e => updateDataSource(ds => {
              ds.filters = ds.filters ?? {};
              const next = e.target.value;
              if (!next) delete ds.filters.tag;
              else ds.filters.tag = next;
            })}
          >
            <option value="">All tags</option>
            {selectedTagMissing && (
              <option value={selectedTagSlug}>{selectedTagSlug} (inactive)</option>
            )}
            {resolvedTagOptions.map((tag) => (
              <option key={tag.id ?? tag.slug} value={tag.slug}>
                {tag.name || tag.slug}
              </option>
            ))}
          </select>
          <div className="form-text">Filters carousel items to products that include the selected tag.</div>
        </div>
      </div>
      <div className="d-flex gap-3">
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id={`carousel-show-rating-${value.id}`} checked={value.display?.showRating ?? true} onChange={e => updateDisplay(display => { display.showRating = e.target.checked; })} />
          <label className="form-check-label" htmlFor={`carousel-show-rating-${value.id}`}>Show rating</label>
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id={`carousel-show-cart-${value.id}`} checked={value.display?.showAddToCart ?? true} onChange={e => updateDisplay(display => { display.showAddToCart = e.target.checked; })} />
          <label className="form-check-label" htmlFor={`carousel-show-cart-${value.id}`}>Show add-to-cart</label>
        </div>
      </div>
    </div>
  );
}

function PromoStripSectionEditor({ value, onChange, errors = {}, tagOptions = [], categoryOptions = [] }) {
  const update = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });
  const setCta = (updater) => {
    const next = typeof updater === 'function'
      ? updater({ ...(value.cta ?? {}) })
      : { ...(updater ?? {}) };
    onChange({ ...value, cta: next });
  };
  const updateCta = (field, fieldValue) => setCta(prev => ({ ...prev, [field]: fieldValue }));

  const resolvedTagOptions = Array.isArray(tagOptions) ? tagOptions : [];
  const resolvedCategoryOptions = Array.isArray(categoryOptions) ? categoryOptions : [];

  const safeSlug = (input) => {
    if (input == null) return '';
    return String(input)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const extractLinkBinding = (href) => {
    if (!href || typeof href !== 'string') return { tagSlug: '', categorySlug: '', categoryId: '' };
    const queryIndex = href.indexOf('?');
    if (queryIndex === -1) return { tagSlug: '', categorySlug: '', categoryId: '' };
    const qs = href.slice(queryIndex + 1);
    const params = new URLSearchParams(qs);
    return {
      tagSlug: params.get('tag') || '',
      categorySlug: params.get('category') || '',
      categoryId: params.get('categoryId') || ''
    };
  };

  const currentBinding = extractLinkBinding(value.cta?.href || '');
  const selectedTagSlug = currentBinding.tagSlug || '';
  const selectedCategory = (() => {
    if (!currentBinding.categorySlug && !currentBinding.categoryId) return null;
    return resolvedCategoryOptions.find(option => {
      const optionSlug = option.slug || safeSlug(option.label || option.name || option.path || '');
      if (currentBinding.categoryId && String(option.id) === String(currentBinding.categoryId)) return true;
      if (currentBinding.categorySlug && safeSlug(currentBinding.categorySlug) === safeSlug(optionSlug)) return true;
      return false;
    }) || null;
  })();
  const selectedCategoryId = selectedCategory?.id ? String(selectedCategory.id) : '';

  const buildHref = ({ tagSlug, categoryOption }) => {
    const params = new URLSearchParams();
    if (tagSlug) params.set('tag', tagSlug);
    if (categoryOption) {
      const categorySlug = categoryOption.slug || safeSlug(categoryOption.label || categoryOption.name || categoryOption.path || '');
      if (categorySlug) params.set('category', categorySlug);
      if (categoryOption.id != null) params.set('categoryId', categoryOption.id);
    }
    return params.toString() ? `/products?${params.toString()}` : '';
  };

  const handleTagSelect = (event) => {
    const slug = event.target.value;
    const tag = resolvedTagOptions.find(option => option.slug === slug);
    const href = buildHref({ tagSlug: slug || '', categoryOption: selectedCategory || null });
    setCta(prev => {
      const next = { ...(prev ?? {}) };
      next.href = href;
      if ((next.label == null || String(next.label).trim().length === 0) && tag) {
        next.label = `Shop ${tag.name || tag.slug}`;
      }
      return next;
    });
  };

  const handleCategorySelect = (event) => {
    const selectedId = event.target.value;
    const category = resolvedCategoryOptions.find(option => String(option.id) === String(selectedId));
    const href = buildHref({ tagSlug: selectedTagSlug || '', categoryOption: category || null });
    setCta(prev => {
      const next = { ...(prev ?? {}) };
      next.href = href;
      if ((next.label == null || String(next.label).trim().length === 0) && category) {
        const name = category.label || category.name || 'Collection';
        next.label = `Shop ${name}`;
      }
      return next;
    });
  };

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`promo-eyebrow-${value.id}`}>Eyebrow text</label>
          <input
            id={`promo-eyebrow-${value.id}`}
            className="form-control"
            value={value.eyebrow || ''}
            onChange={e => update('eyebrow', e.target.value)}
            placeholder="Holiday spotlight"
          />
        </div>
        <div className="col-12 col-md-8">
          <label className="form-label" htmlFor={`promo-headline-${value.id}`}>Headline</label>
          <input
            id={`promo-headline-${value.id}`}
            className="form-control"
            value={value.headline || ''}
            onChange={e => update('headline', e.target.value)}
            placeholder="Black Friday sparkle — midnight offers"
          />
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-8">
          <label className="form-label" htmlFor={`promo-subtext-${value.id}`}>Supporting line</label>
          <textarea
            id={`promo-subtext-${value.id}`}
            className="form-control"
            rows={2}
            value={value.subtext || ''}
            onChange={e => update('subtext', e.target.value)}
            placeholder="Line up your favourites now so checkout is a breeze later."
          ></textarea>
          <div className="form-text">Keep the copy short and energetic—one quick sentence works best.</div>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`promo-style-${value.id}`}>Theme</label>
          <select
            id={`promo-style-${value.id}`}
            className="form-select"
            value={value.style || 'twilight-glow'}
            onChange={e => update('style', e.target.value)}
          >
            {PROMO_STRIP_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="form-text">Each theme tweaks the gradient, sparkles, and accent colour.</div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`promo-cta-label-${value.id}`}>CTA label</label>
          <input
            id={`promo-cta-label-${value.id}`}
            className="form-control"
            value={value.cta?.label || ''}
            onChange={e => updateCta('label', e.target.value)}
            placeholder="Shop the drop"
          />
        </div>
        <div className="col-12 col-md-5">
          <label className="form-label" htmlFor={`promo-cta-href-${value.id}`}>CTA link</label>
          <input
            id={`promo-cta-href-${value.id}`}
            className={`form-control${errors.promoStripCtaHref ? ' is-invalid' : ''}`}
            value={value.cta?.href || ''}
            onChange={e => updateCta('href', e.target.value)}
            placeholder="/products?tag=holiday"
          />
          {errors.promoStripCtaHref && <div className="invalid-feedback">{errors.promoStripCtaHref}</div>}
        </div>
        <div className="col-12 col-md-3 d-flex align-items-end">
          <div className="form-text">Leave CTA blank if the strip is purely decorative.</div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor={`promo-cta-tag-${value.id}`}>Link to tag</label>
          <select
            id={`promo-cta-tag-${value.id}`}
            className="form-select"
            value={selectedTagSlug}
            onChange={handleTagSelect}
          >
            <option value="">No tag filter</option>
            {resolvedTagOptions.map(tag => (
              <option key={tag.id ?? tag.slug} value={tag.slug}>{tag.name || tag.slug}</option>
            ))}
          </select>
          <div className="form-text">Selecting a tag updates the CTA link to /products with that tag filter.</div>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor={`promo-cta-category-${value.id}`}>Link to category</label>
          <select
            id={`promo-cta-category-${value.id}`}
            className="form-select"
            value={selectedCategoryId}
            onChange={handleCategorySelect}
          >
            <option value="">No category filter</option>
            {resolvedCategoryOptions.map(category => (
              <option key={category.id ?? category.slug} value={category.id ?? category.slug}>
                {category.label || category.name || category.slug}
              </option>
            ))}
          </select>
          <div className="form-text">Combine with a tag to create richer curated CTA destinations.</div>
        </div>
      </div>
    </div>
  );
}

function ImageBannerSectionEditor({ value, onChange, errors = {} }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const maxSlides = 5;

  const slides = useMemo(() => {
    if (Array.isArray(value.media?.slides)) {
      return value.media.slides.slice(0, maxSlides);
    }
    if (value.media?.imageUrl) {
      return [
        {
          id: value.media.id || `legacy-slide-${value.id}`,
          url: value.media.imageUrl,
          alt: value.title || 'Banner image'
        }
      ];
    }
    return [];
  }, [value, maxSlides]);

  const update = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });
  const updateMedia = (updater) => {
    const nextMedia = typeof updater === 'function'
      ? updater({ ...(value.media ?? {}) })
      : { ...(value.media ?? {}), ...(updater ?? {}) };
    onChange({ ...value, media: nextMedia });
  };
  const updateCta = (field, fieldValue) => onChange({ ...value, cta: { ...(value.cta ?? {}), [field]: fieldValue } });

  const syncSlides = (nextSlides) => {
    updateMedia(media => {
      const cleaned = { ...media, slides: nextSlides };
      if (cleaned.imageUrl) delete cleaned.imageUrl;
      return cleaned;
    });
  };

  const handleSlideChange = (index, updater) => {
    const nextSlides = slides.map((slide, idx) => {
      if (idx !== index) return slide;
      return typeof updater === 'function' ? updater(slide) : { ...slide, ...updater };
    });
    syncSlides(nextSlides);
  };

  const handleRemoveSlide = (index) => {
    const nextSlides = slides.filter((_, idx) => idx !== index);
    syncSlides(nextSlides);
  };

  const handleMoveSlide = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    const nextSlides = [...slides];
    const temp = nextSlides[index];
    nextSlides[index] = nextSlides[targetIndex];
    nextSlides[targetIndex] = temp;
    syncSlides(nextSlides);
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const uploadSlide = async (file, indexOffset = 0) => {
    if (typeof api?.admin?.homepageLayouts?.uploadMedia === 'function') {
      const response = await api.admin.homepageLayouts.uploadMedia(file);
      const url = response?.url || response?.data?.url || response?.location || response?.absoluteUrl;
      if (!url) {
        throw new Error('Upload succeeded but returned no URL.');
      }
      return {
        id: `banner-slide-${Date.now()}-${indexOffset}`,
        url,
        alt: file.name ? file.name.replace(/\.[^.]+$/, '').trim() || 'Banner slide' : 'Banner slide'
      };
    }
    const dataUrl = await readFileAsDataUrl(file);
    return {
      id: `banner-slide-${Date.now()}-${indexOffset}`,
      url: dataUrl,
      alt: file.name ? file.name.replace(/\.[^.]+$/, '').trim() || 'Banner slide' : 'Banner slide',
      isInlineData: true
    };
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    const available = maxSlides - slides.length;
    if (available <= 0) {
      toast.push('You already have five slides in this banner.', 'warning');
      return;
    }
    const queue = files.slice(0, available);
    setUploading(true);
    const created = [];
    let fallbackNoticeShown = false;
    for (let i = 0; i < queue.length; i += 1) {
      const file = queue[i];
      try {
        const slide = await uploadSlide(file, i);
        created.push(slide);
      } catch (err) {
        console.error('Banner slide upload failed', err);
        try {
          const dataUrl = await readFileAsDataUrl(file);
          created.push({
            id: `banner-slide-${Date.now()}-${i}-inline`,
            url: dataUrl,
            alt: file.name ? file.name.replace(/\.[^.]+$/, '').trim() || 'Banner slide' : 'Banner slide',
            isInlineData: true
          });
          if (!fallbackNoticeShown) {
            toast.push((err?.message ? `${err.message}. ` : '') + 'Falling back to embedded image data. Consider trying again later.', 'warning');
            fallbackNoticeShown = true;
          }
        } catch (readErr) {
          console.error('Failed to read banner slide as data URL', readErr);
          toast.push(err?.message || `Failed to upload ${file.name || 'image'}.`, 'error');
        }
      }
    }
    if (created.length > 0) {
      syncSlides([...slides, ...created]);
    }
    setUploading(false);
  };

  const themeValue = value.style || value.theme || 'emerald-luxe';
  const backgroundColor = value.media?.backgroundColor ?? '';

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-12 col-md-3">
          <label className="form-label" htmlFor={`banner-eyebrow-${value.id}`}>Eyebrow</label>
          <input id={`banner-eyebrow-${value.id}`} className="form-control" value={value.eyebrow || ''} onChange={e => update('eyebrow', e.target.value)} placeholder="Quick highlight" />
        </div>
        <div className="col-12 col-md-5">
          <label className="form-label" htmlFor={`banner-title-${value.id}`}>Headline</label>
          <input id={`banner-title-${value.id}`} className="form-control" value={value.title || ''} onChange={e => update('title', e.target.value)} placeholder="Free delivery over KSh 2,500" />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`banner-style-${value.id}`}>Theme</label>
          <select
            id={`banner-style-${value.id}`}
            className="form-select"
            value={themeValue}
            onChange={e => update('style', e.target.value)}
          >
            {IMAGE_BANNER_THEME_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="form-text">Switch typography + accent treatments for the left text block.</div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-8">
          <label className="form-label" htmlFor={`banner-description-${value.id}`}>Supporting copy</label>
          <textarea
            id={`banner-description-${value.id}`}
            className="form-control"
            rows={3}
            value={value.description || ''}
            onChange={e => update('description', e.target.value)}
            placeholder="Schedule a delivery slot that works for you and we will handle the rest."
          ></textarea>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`banner-background-${value.id}`}>Background override</label>
          <input
            id={`banner-background-${value.id}`}
            className="form-control"
            value={backgroundColor}
            onChange={e => {
              const nextValue = e.target.value;
              updateMedia(media => {
                const next = { ...(media ?? {}) };
                if (!nextValue.trim()) delete next.backgroundColor;
                else next.backgroundColor = nextValue;
                return next;
              });
            }}
            placeholder="#0f2d19"
          />
          <div className="form-text">Optional hex/gradient overrides. Leave blank to use theme default.</div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`banner-cta-label-${value.id}`}>CTA label</label>
          <input id={`banner-cta-label-${value.id}`} className="form-control" value={value.cta?.label || ''} onChange={e => updateCta('label', e.target.value)} placeholder="See delivery options" />
        </div>
        <div className="col-12 col-md-5">
          <label className="form-label" htmlFor={`banner-cta-href-${value.id}`}>CTA link</label>
          <input
            id={`banner-cta-href-${value.id}`}
            className={`form-control${errors.ctaHref ? ' is-invalid' : ''}`}
            value={value.cta?.href || ''}
            onChange={e => updateCta('href', e.target.value)}
            placeholder="/delivery"
          />
          {errors.ctaHref && <div className="invalid-feedback">{errors.ctaHref}</div>}
          <div className="form-text">Accepts internal "/path" or full https:// links.</div>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label" htmlFor={`banner-cta-style-${value.id}`}>CTA style</label>
          <select
            id={`banner-cta-style-${value.id}`}
            className="form-select"
            value={value.cta?.style || 'primary'}
            onChange={e => updateCta('style', e.target.value)}
          >
            <option value="primary">Solid button</option>
            <option value="outline">Outline button</option>
            <option value="link">Text link</option>
          </select>
          <div className="form-text">Preview updates instantly in the live preview.</div>
        </div>
      </div>

      <div className="border rounded p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div>
            <strong className="small">Carousel images</strong>
            <div className="text-muted small">Upload up to five slides. They appear to the right of the copy block.</div>
          </div>
          <span className="badge text-bg-secondary">{slides.length}/{maxSlides}</span>
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          className="form-control form-control-sm"
          disabled={uploading || slides.length >= maxSlides}
          onChange={handleFileSelect}
        />
        {uploading && <div className="form-text text-success mt-1">Uploading…</div>}
        {errors.slides && Array.isArray(errors.slides) && errors.slides.some(Boolean) && (
          <div className="alert alert-danger py-2 small mt-3" role="alert">
            <ul className="mb-0 ps-3">
              {errors.slides.map((message, idx) => message ? <li key={`slide-error-${idx}`}>Slide {idx + 1}: {message}</li> : null)}
            </ul>
          </div>
        )}
        {slides.length === 0 ? (
          <p className="text-muted small mb-0 mt-3">Add at least one image to unlock the banner carousel.</p>
        ) : (
          <div className="vstack gap-2 mt-3">
            {slides.map((slide, idx) => (
              <div key={slide.id || `${value.id}-slide-${idx}`} className="border rounded p-2">
                <div className="row g-2 align-items-center">
                  <div className="col-12 col-md-3">
                    <div className="ratio ratio-16x9" style={{ borderRadius: 8, overflow: 'hidden', background: '#f3f5f6' }}>
                      {slide.url ? (
                        <img src={slide.url} alt={slide.alt || `Slide ${idx + 1}`} style={{ objectFit: 'cover' }} />
                      ) : (
                        <div className="d-flex align-items-center justify-content-center text-muted small">No image</div>
                      )}
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label form-label-sm" htmlFor={`banner-slide-alt-${value.id}-${idx}`}>Alt text</label>
                    <input
                      id={`banner-slide-alt-${value.id}-${idx}`}
                      className="form-control form-control-sm"
                      value={slide.alt || ''}
                      onChange={e => handleSlideChange(idx, { alt: e.target.value })}
                    />
                    <div className="form-text">Describe the slide for accessibility.</div>
                  </div>
                  <div className="col-12 col-md-3 d-flex gap-1 justify-content-end">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => handleMoveSlide(idx, -1)} disabled={idx === 0}>
                      <i className="bi bi-arrow-up" aria-hidden="true"></i>
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => handleMoveSlide(idx, 1)} disabled={idx === slides.length - 1}>
                      <i className="bi bi-arrow-down" aria-hidden="true"></i>
                    </button>
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleRemoveSlide(idx)}>
                      <i className="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RichTextSectionEditor({ value, onChange }) {
  const update = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });
  const bodyText = useMemo(() => {
    if (!Array.isArray(value.body)) return '';
    return value.body.map(block => {
      if (block.type === 'paragraph') return block.content;
      if (block.type === 'list') return (block.items || []).join('\n');
      return typeof block === 'string' ? block : JSON.stringify(block);
    }).join('\n\n');
  }, [value.body]);

  const handleBodyChange = (text) => {
    const blocks = text
      .split(/\n{2,}/)
      .map(part => part.trim())
      .filter(Boolean)
      .map(content => ({ type: 'paragraph', content }));
    onChange({ ...value, body: blocks });
  };

  return (
    <div className="vstack gap-3">
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor={`rich-style-${value.id}`}>Theme</label>
          <select
            id={`rich-style-${value.id}`}
            className="form-select"
            value={value.style || 'calm-paper'}
            onChange={e => update('style', e.target.value)}
          >
            {RICH_TEXT_THEME_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="form-text">Updates typography scale and accents.</div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor={`rich-title-${value.id}`}>Title</label>
          <input id={`rich-title-${value.id}`} className="form-control" value={value.title || ''} onChange={e => update('title', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="form-label" htmlFor={`rich-body-${value.id}`}>Body</label>
        <textarea id={`rich-body-${value.id}`} className="form-control" rows={5} value={bodyText} onChange={e => handleBodyChange(e.target.value)} placeholder="Write paragraphs separated by blank lines."></textarea>
        <div className="form-text">Advanced formatting (lists, highlights) can be adjusted via JSON editor.</div>
      </div>
    </div>
  );
}
