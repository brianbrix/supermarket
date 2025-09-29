import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, mapProductResponse } from '../services/api.js';
import { BRAND_NAME } from '../config/brand.js';
import { useSettings } from '../context/SettingsContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import PaginationBar from '../components/PaginationBar.jsx';

const toSlug = (value) => {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const parseSectionFilters = (params) => {
  const sectionId = params.get('sectionId') || null;
  const collectionTitle = params.get('sectionTitle') || '';
  const query = params.get('q') || '';
  const brand = params.get('brand') || '';
  const brandIdParam = params.get('brandId');
  const brandSlugParam = toSlug(params.get('brandSlug') || params.get('brand')) || null;
  const categoryIdParam = params.get('categoryId');
  const categorySlug = toSlug(params.get('category')) || null;
  const inStockRaw = params.get('inStock');
  const minPriceRaw = params.get('minPrice');
  const maxPriceRaw = params.get('maxPrice');
  const scope = params.get('scope') || null;
  const promoTag = params.get('promoTag') || null;
  const minRatingRaw = params.get('minRating');
  const trendingDaysRaw = params.get('trendingDays');
  const tags = params.getAll('tags[]').filter(Boolean);
  const ids = params.getAll('ids[]').filter(Boolean);

  const parseNumber = (value) => {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const boolFromParam = (value) => {
    if (value == null) return null;
    const normalized = String(value).toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return null;
  };

  return {
    sectionId,
    collectionTitle,
    state: {
      query,
      brand,
  brandId: brandIdParam ? String(brandIdParam) : null,
  brandSlug: brandSlugParam,
      categoryId: categoryIdParam ? String(categoryIdParam) : null,
      categorySlug,
      inStock: boolFromParam(inStockRaw) ?? false,
      minPrice: parseNumber(minPriceRaw),
      maxPrice: parseNumber(maxPriceRaw)
    },
    staticFilters: {
      scope,
      promoTag,
      minRating: parseNumber(minRatingRaw),
      trendingDays: parseNumber(trendingDaysRaw),
      tags,
      ids
    }
  };
};

const applyStaticFiltersToPayload = (payload, staticFilters) => {
  if (!staticFilters) return;
  if (staticFilters.scope) {
    payload.scope = staticFilters.scope;
  }
  if (Array.isArray(staticFilters.ids) && staticFilters.ids.length > 0) {
    payload.ids = [...staticFilters.ids];
  }
  if (staticFilters.promoTag) {
    payload.promoTag = staticFilters.promoTag;
  }
  if (staticFilters.minRating != null) {
    payload.minRating = staticFilters.minRating;
  }
  if (staticFilters.trendingDays != null) {
    payload.trendingDays = staticFilters.trendingDays;
  }
  if (Array.isArray(staticFilters.tags) && staticFilters.tags.length > 0) {
    const tagSet = new Set(staticFilters.tags.filter(Boolean).map(value => String(value)));
    const tagList = Array.from(tagSet);
    if (tagList.length > 0) {
      payload.tags = tagList;
      if (!payload.promoTag) {
        payload.promoTag = tagList[0];
      }
    }
  }
};

const applyStaticFiltersToResults = (items, staticFilters) => {
  if (!Array.isArray(items)) return [];
  let next = items;
  if (staticFilters?.minRating != null) {
    const minRating = Number(staticFilters.minRating);
    if (!Number.isNaN(minRating)) {
      next = next.filter(product => (product.ratingAverage ?? 0) >= minRating);
    }
  }
  return next;
};

const ALL_CATEGORY_KEY = 'all';

const normalizeBrandOptions = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const options = [];
  list.forEach(brand => {
    const rawId = brand?.id ?? brand?.brandId ?? brand?.value ?? null;
    const id = rawId == null ? '' : String(rawId).trim();
    if (!id || seen.has(id)) return;
    const nameSource = brand?.name ?? brand?.title ?? brand?.displayName ?? brand?.label ?? '';
    const name = String(nameSource).trim();
    if (!name) return;
    seen.add(id);
    const slugSource = brand?.slug ?? brand?.handle ?? name;
    const slug = toSlug(slugSource) || null;
    options.push({
      id,
      name,
      slug,
      raw: brand
    });
  });
  options.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return options;
};

export default function Products() {
  const location = useLocation();
  const navigate = useNavigate();
  const slugToIdRef = useRef({});
  const initialParsedFiltersRef = useRef(null);
  if (initialParsedFiltersRef.current === null) {
    initialParsedFiltersRef.current = parseSectionFilters(new URLSearchParams(location.search));
  }
  const initialParsed = initialParsedFiltersRef.current;
  const initialCategorySlugRef = useRef(null);
  const initialCategoryIdRef = useRef(null);
  const initialBrandSlugRef = useRef(null);
  const initialBrandIdRef = useRef(null);
  const initialBrandNameRef = useRef('');
  const initialBrandHydratedRef = useRef(false);
  const syncingFromUrlRef = useRef(false);
  if (initialCategorySlugRef.current === null) {
    initialCategorySlugRef.current = initialParsed.state.categorySlug ?? toSlug(new URLSearchParams(location.search).get('category'));
  }
  if (initialCategoryIdRef.current === null) {
    initialCategoryIdRef.current = initialParsed.state.categoryId;
  }
  if (initialBrandSlugRef.current === null) {
    initialBrandSlugRef.current = initialParsed.state.brandSlug ?? toSlug(initialParsed.state.brand);
  }
  if (initialBrandIdRef.current === null) {
    initialBrandIdRef.current = initialParsed.state.brandId ?? null;
  }
  if (initialBrandNameRef.current === '') {
    initialBrandNameRef.current = initialParsed.state.brand || '';
  }
  const { settings } = useSettings();
  const storeName = settings?.storeName || BRAND_NAME;
  const [sectionFilters, setSectionFilters] = useState(initialParsed);
  const [collectionTitle, setCollectionTitle] = useState(initialParsed.collectionTitle);
  const [query, setQuery] = useState(initialParsed.state.query || '');
  const [brandId, setBrandId] = useState(initialParsed.state.brandId ?? 'all');
  const [brandOptionsByCategory, setBrandOptionsByCategory] = useState({});
  const [brandOptions, setBrandOptions] = useState([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [categoryId, setCategoryId] = useState(initialParsed.state.categoryId ?? 'all');
  const [categories, setCategories] = useState([]);
  const categoriesRef = useRef([]);
  const [results, setResults] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:100, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const size = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(initialParsed.state.inStock ?? false);
  const [priceRange, setPriceRange] = useState({
    min: initialParsed.state.minPrice ?? 0,
    max: initialParsed.state.maxPrice ?? 0
  });
  const [sliderBounds, setSliderBounds] = useState({ min: 0, max: 0 });
  const [baselineLoaded, setBaselineLoaded] = useState(false);
  const initialSearchSkippedRef = useRef(false);
  const lastSearchKeyRef = useRef('');
  const lastFiltersNoPageRef = useRef('');
  const fetchingBrandKeysRef = useRef(new Set());
  const activeCollectionTitle = (collectionTitle ?? '').trim();
  const locationSearchRef = useRef(location.search);
  const locationPathRef = useRef(location.pathname);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  useEffect(() => {
    locationSearchRef.current = location.search;
  }, [location.search]);

  useEffect(() => {
    locationPathRef.current = location.pathname;
  }, [location.pathname]);

  const setCategorySelection = useCallback((value, { fromUrl = false, categoriesSnapshot } = {}) => {
    const normalizedValue = value == null || value === '' ? 'all' : String(value);
    if (fromUrl) {
      syncingFromUrlRef.current = true;
    }
    setCategoryId(normalizedValue);
    if (fromUrl) {
      return;
    }
    const list = categoriesSnapshot ?? categoriesRef.current;
    const params = new URLSearchParams(locationSearchRef.current);
    if (normalizedValue === 'all') {
      params.delete('category');
      params.delete('categoryId');
    } else {
      const match = list.find(cat => String(cat.id) === normalizedValue);
      if (!match) return;
      const slug = toSlug(match.slug ?? match.raw?.slug ?? match.name);
      if (!slug) return;
      params.set('category', slug);
      params.set('categoryId', normalizedValue);
    }
    const qs = params.toString();
    navigate(`${locationPathRef.current}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [navigate]);

  const setBrandSelection = useCallback((value, { fromUrl = false, brandSnapshot, brandName, brandSlug } = {}) => {
    const normalizedValue = value == null || value === '' ? 'all' : String(value);
    const list = brandSnapshot ?? brandOptions;
    const selectedOption = normalizedValue === 'all' ? null : list.find(option => String(option.id) === normalizedValue);
    const fallbackName = brandName ?? initialBrandNameRef.current ?? '';
    const resolvedName = normalizedValue === 'all' ? '' : (selectedOption?.name ?? fallbackName);
    const resolvedSlug = normalizedValue === 'all' ? null : (selectedOption?.slug ?? brandSlug ?? (resolvedName ? toSlug(resolvedName) : null));

    setSectionFilters(prev => ({
      ...prev,
      state: {
        ...prev.state,
        brand: resolvedName,
        brandId: normalizedValue === 'all' ? null : normalizedValue,
        brandSlug: normalizedValue === 'all' ? null : resolvedSlug
      }
    }));

    initialBrandIdRef.current = normalizedValue === 'all' ? null : normalizedValue;
    initialBrandNameRef.current = resolvedName;
    initialBrandSlugRef.current = resolvedSlug;

    if (fromUrl) {
      syncingFromUrlRef.current = true;
      setBrandId(normalizedValue);
      return;
    }

    if (brandId !== normalizedValue) {
      setBrandId(normalizedValue);
    }

    const params = new URLSearchParams(location.search);
    if (normalizedValue === 'all') {
      params.delete('brandId');
      params.delete('brandSlug');
      params.delete('brand');
    } else if (selectedOption) {
      params.set('brandId', normalizedValue);
      const slug = toSlug(selectedOption.slug ?? selectedOption.name ?? resolvedName);
      if (slug) params.set('brandSlug', slug);
      if (selectedOption.name || resolvedName) {
        params.set('brand', selectedOption.name ?? resolvedName);
      }
    } else {
      params.set('brandId', normalizedValue);
      if (resolvedSlug) params.set('brandSlug', resolvedSlug);
      if (resolvedName) params.set('brand', resolvedName);
    }

    const qs = params.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [brandOptions, brandId, location.pathname, location.search, navigate]);

  useEffect(() => {
    const parsed = parseSectionFilters(new URLSearchParams(location.search));
    setSectionFilters(parsed);
    setCollectionTitle(parsed.collectionTitle);
    setQuery(parsed.state.query || '');
    if (parsed.state.brandId) {
      const id = String(parsed.state.brandId);
      initialBrandIdRef.current = id;
      setBrandId(id);
    } else {
      initialBrandIdRef.current = null;
      setBrandId('all');
    }
    if (parsed.state.brandSlug) {
      initialBrandSlugRef.current = parsed.state.brandSlug;
    }
    if (parsed.state.brand) {
      initialBrandNameRef.current = parsed.state.brand;
    }
    setInStockOnly(parsed.state.inStock ?? false);
    setCategoryId(parsed.state.categoryId ?? 'all');
    if (parsed.state.minPrice != null || parsed.state.maxPrice != null) {
      setPriceRange(prev => ({
        min: parsed.state.minPrice ?? prev.min,
        max: parsed.state.maxPrice ?? prev.max
      }));
    }
    if (parsed.state.categorySlug) {
      initialCategorySlugRef.current = parsed.state.categorySlug;
    }
    if (parsed.state.categoryId) {
      initialCategoryIdRef.current = parsed.state.categoryId;
    }
  }, [location.search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
  const requestedSlug = initialCategorySlugRef.current;
  const requestedCategoryId = initialCategoryIdRef.current ? String(initialCategoryIdRef.current) : null;

    (async () => {
      try {
        const cats = await api.categories.list();
        if (!active) return;

        const catOptions = cats.map(c => ({
          id: c.id,
          name: c.name,
          label: c.label ?? c.fullName ?? c.name,
          fullName: c.fullName ?? c.raw?.fullName ?? c.name,
          slug: c.slug ?? c.raw?.slug ?? toSlug(c.name),
          path: c.path ?? c.raw?.path,
          raw: c.raw ?? c
        }));

        const lookup = {};
        catOptions.forEach(cat => {
          const variants = [cat.slug, cat.raw?.slug, cat.path, cat.raw?.path, cat.name, cat.fullName];
          const pathSegments = typeof cat.path === 'string' ? cat.path.split('/') : [];
          if (pathSegments.length) {
            variants.push(pathSegments[pathSegments.length - 1]);
          }
          const rawPathSegments = typeof cat.raw?.path === 'string' ? cat.raw.path.split('/') : [];
          if (rawPathSegments.length) {
            variants.push(rawPathSegments[rawPathSegments.length - 1]);
          }
          variants
            .map(toSlug)
            .filter(Boolean)
            .forEach(slug => {
              lookup[slug] = String(cat.id);
            });
        });
        slugToIdRef.current = lookup;
        setCategories(catOptions);

        let initialCategory = 'all';
        if (requestedCategoryId && catOptions.some(cat => String(cat.id) === requestedCategoryId)) {
          initialCategory = requestedCategoryId;
          initialCategoryIdRef.current = initialCategory;
          setCategorySelection(initialCategory, { fromUrl: true, categoriesSnapshot: catOptions });
        } else if (requestedSlug && lookup[requestedSlug]) {
          initialCategory = lookup[requestedSlug];
          initialCategoryIdRef.current = initialCategory;
          setCategorySelection(initialCategory, { fromUrl: true, categoriesSnapshot: catOptions });
        }

        const staticFilters = initialParsed.staticFilters;
        const searchPayload = { page: 0, size };
        if (initialCategory !== 'all') {
          searchPayload.categoryId = initialCategory;
        }
        if (initialParsed.state.query) {
          searchPayload.q = initialParsed.state.query;
        }
        if (initialParsed.state.brandId) {
          searchPayload.brandId = initialParsed.state.brandId;
        } else if (initialParsed.state.brandSlug) {
          searchPayload.brandSlug = initialParsed.state.brandSlug;
        } else if (initialParsed.state.brand) {
          searchPayload.brand = initialParsed.state.brand;
        }
        if (initialParsed.state.inStock) {
          searchPayload.inStock = true;
        }
        if (initialParsed.state.minPrice != null) {
          searchPayload.minPrice = initialParsed.state.minPrice;
        }
        if (initialParsed.state.maxPrice != null) {
          searchPayload.maxPrice = initialParsed.state.maxPrice;
        }
        applyStaticFiltersToPayload(searchPayload, staticFilters);
        const hasStaticFilters = Boolean(
          (staticFilters?.scope) ||
          (staticFilters?.promoTag) ||
          (staticFilters?.minRating != null) ||
          (staticFilters?.trendingDays != null) ||
          (Array.isArray(staticFilters?.tags) && staticFilters.tags.length > 0) ||
          (Array.isArray(staticFilters?.ids) && staticFilters.ids.length > 0)
        );
  const shouldSearch = hasStaticFilters || initialCategory !== 'all' || Boolean(initialParsed.state.query) || Boolean(initialParsed.state.brandId) || Boolean(initialParsed.state.brand) || initialParsed.state.inStock || initialParsed.state.minPrice != null || initialParsed.state.maxPrice != null;
        const [pageResp, range] = await Promise.all([
          shouldSearch ? api.products.search(searchPayload) : api.products.list(0, size),
          api.products.priceRange(initialCategory !== 'all' ? initialCategory : undefined)
        ]);

        if (!active) return;

  const pageData = (pageResp?.content ?? pageResp) || [];
  const mapped = pageData.map(mapProductResponse);
  const hydrated = applyStaticFiltersToResults(mapped, staticFilters);
  setResults(hydrated);
        setPageMeta(pageResp);
        const min = Number(range?.min ?? 0);
        const max = Number(range?.max ?? 0);
        setSliderBounds({ min, max });
        const presetMin = initialParsed.state.minPrice;
        const presetMax = initialParsed.state.maxPrice;
        setPriceRange({
          min: presetMin != null ? presetMin : min,
          max: presetMax != null ? presetMax : max
        });
        initialSearchSkippedRef.current = true;
  const initialBrandKey = initialBrandIdRef.current ? String(initialBrandIdRef.current) : '';
  lastFiltersNoPageRef.current = JSON.stringify({ q: '', brandId: initialBrandKey, cat: initialCategory, min, max, stock: 0 });
        lastSearchKeyRef.current = `${lastFiltersNoPageRef.current}|page=0`;
        setBaselineLoaded(true);
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [size, initialParsed, setCategorySelection]);

  const debouncedQuery = useDebounce(query, 500);
  const debouncedBrandId = useDebounce(brandId, 300);
  const debouncedRange = useDebounce(priceRange, 400);
  const debouncedInStock = useDebounce(inStockOnly, 300);
  const debouncedCategory = useDebounce(categoryId, 300);

  useEffect(() => {
    let active = true;
    const catId = debouncedCategory !== 'all' ? debouncedCategory : undefined;
    api.products.priceRange(catId)
      .then(range => {
        if (!active) return;
        const min = Number(range?.min ?? 0);
        const max = Number(range?.max ?? 0);
        setSliderBounds({ min, max });
        const priceMin = sectionFilters.state.minPrice;
        const priceMax = sectionFilters.state.maxPrice;
        setPriceRange(prev => {
          const nextMin = priceMin != null ? priceMin : min;
          const nextMax = priceMax != null ? priceMax : max;
          if (prev.min === nextMin && prev.max === nextMax) return prev;
          return { min: nextMin, max: nextMax };
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [debouncedCategory, sectionFilters.state.minPrice, sectionFilters.state.maxPrice]);

  useEffect(() => {
    if (!baselineLoaded) return;

    const rangeUninitialized = debouncedRange.min === 0 && debouncedRange.max === 0 && (sliderBounds.min !== 0 || sliderBounds.max !== 0);
    const effectiveMin = rangeUninitialized ? sliderBounds.min : debouncedRange.min;
    const effectiveMax = rangeUninitialized ? sliderBounds.max : debouncedRange.max;

    const normalizedBrandId = debouncedBrandId && debouncedBrandId !== 'all' ? String(debouncedBrandId) : '';

    const filtersNoPageKey = JSON.stringify({
      q: debouncedQuery || '',
      brandId: normalizedBrandId,
      cat: debouncedCategory,
      min: effectiveMin,
      max: effectiveMax,
      stock: debouncedInStock ? 1 : 0
    });

    if (page !== 0 && filtersNoPageKey !== lastFiltersNoPageRef.current) {
      setPage(0);
      return;
    }

    const filtersKey = `${filtersNoPageKey}|page=${page}|scope=${sectionFilters.staticFilters.scope || ''}|tags=${(sectionFilters.staticFilters.tags || []).join(',')}|promo=${sectionFilters.staticFilters.promoTag || ''}|ids=${(sectionFilters.staticFilters.ids || []).join(',')}|minRating=${sectionFilters.staticFilters.minRating ?? ''}|trend=${sectionFilters.staticFilters.trendingDays ?? ''}`;
    if (filtersKey === lastSearchKeyRef.current) return;

    if (!initialSearchSkippedRef.current) {
      const noFiltersApplied = !debouncedQuery && !normalizedBrandId && debouncedCategory === 'all' && !debouncedInStock && page === 0 &&
        effectiveMin === sliderBounds.min && effectiveMax === sliderBounds.max;
      if (noFiltersApplied) {
        initialSearchSkippedRef.current = true;
        lastFiltersNoPageRef.current = filtersNoPageKey;
        lastSearchKeyRef.current = filtersKey;
        return;
      }
    }

    lastFiltersNoPageRef.current = filtersNoPageKey;
    lastSearchKeyRef.current = filtersKey;
    const requestKey = filtersKey;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const payload = {
      page,
      size
    };
    applyStaticFiltersToPayload(payload, sectionFilters.staticFilters);
    if (debouncedQuery) payload.q = debouncedQuery;
    if (normalizedBrandId) payload.brandId = normalizedBrandId;
    if (debouncedCategory !== 'all') payload.categoryId = debouncedCategory;
    if (!rangeUninitialized && (effectiveMin !== sliderBounds.min || effectiveMax !== sliderBounds.max)) {
      payload.minPrice = effectiveMin;
      payload.maxPrice = effectiveMax;
    }
    if (debouncedInStock) payload.inStock = true;

    api.products.search(payload)
      .then(pageResp => {
        if (cancelled || lastSearchKeyRef.current !== requestKey) return;
        const mapped = pageResp.content.map(mapProductResponse);
        const hydrated = applyStaticFiltersToResults(mapped, sectionFilters.staticFilters);
        setResults(hydrated);
        setPageMeta(pageResp);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled || lastSearchKeyRef.current !== requestKey) return;
        setError(e.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, debouncedBrandId, debouncedCategory, debouncedRange.min, debouncedRange.max, debouncedInStock, page, baselineLoaded, size, sliderBounds.min, sliderBounds.max, sectionFilters.staticFilters]);

  useEffect(() => { setPage(0); }, [debouncedQuery, debouncedBrandId, debouncedCategory, debouncedRange.min, debouncedRange.max, debouncedInStock]);

  useEffect(() => {
    if (!syncingFromUrlRef.current) return;
    const selectedCategory = categories.find(cat => String(cat.id) === categoryId);
    const selectedBrand = brandOptions.find(option => String(option.id) === brandId);
    setSectionFilters(prev => ({
      ...prev,
      state: {
        ...prev.state,
        categoryId: categoryId === 'all' ? null : categoryId,
        categorySlug: selectedCategory?.slug ?? selectedCategory?.raw?.slug ?? (selectedCategory?.name ? toSlug(selectedCategory.name) : null),
        brand: brandId === 'all' ? '' : (selectedBrand?.name ?? initialBrandNameRef.current ?? ''),
        brandId: brandId === 'all' ? null : brandId,
        brandSlug: brandId === 'all' ? null : (selectedBrand?.slug ?? toSlug(selectedBrand?.name ?? initialBrandNameRef.current ?? ''))
      }
    }));
    syncingFromUrlRef.current = false;
  }, [categoryId, brandId, categories, brandOptions]);

  useEffect(() => {
    if (!categories.length) return;
    const slug = toSlug(new URLSearchParams(location.search).get('category'));
    if (!slug) {
      if (categoryId !== 'all') {
        setCategorySelection('all', { fromUrl: true, categoriesSnapshot: categories });
      }
      return;
    }
    const matchId = slugToIdRef.current[slug];
    if (matchId && String(matchId) !== String(categoryId)) {
      setCategorySelection(matchId, { fromUrl: true, categoriesSnapshot: categories });
    }
  }, [location.search, categories, categoryId, setCategorySelection]);

  useEffect(() => {
    const key = categoryId === 'all' ? ALL_CATEGORY_KEY : String(categoryId);
    const options = brandOptionsByCategory[key] ?? [];
    setBrandOptions(options);
  }, [categoryId, brandOptionsByCategory]);

  useEffect(() => {
    if (brandLoading || !Array.isArray(brandOptions)) return;

    if (brandOptions.length === 0) {
      if (brandId !== 'all') {
        setBrandSelection('all', { brandSnapshot: [] });
      }
      return;
    }

    if (brandId !== 'all') {
      const match = brandOptions.find(option => String(option.id) === String(brandId));
      if (!match) {
        setBrandSelection('all', { brandSnapshot: brandOptions });
      } else {
        initialBrandIdRef.current = match.id;
        initialBrandNameRef.current = match.name;
        initialBrandSlugRef.current = match.slug ?? toSlug(match.name);
        initialBrandHydratedRef.current = true;
      }
      return;
    }

    if (initialBrandHydratedRef.current) return;

    if (initialBrandIdRef.current) {
      const byId = brandOptions.find(option => String(option.id) === String(initialBrandIdRef.current));
      if (byId) {
        setBrandSelection(String(byId.id), {
          fromUrl: true,
          brandSnapshot: brandOptions,
          brandName: byId.name,
          brandSlug: byId.slug ?? toSlug(byId.name)
        });
        initialBrandHydratedRef.current = true;
        return;
      }
    }

    if (initialBrandSlugRef.current) {
      const bySlug = brandOptions.find(option => toSlug(option.slug ?? option.name) === initialBrandSlugRef.current);
      if (bySlug) {
        setBrandSelection(String(bySlug.id), {
          fromUrl: true,
          brandSnapshot: brandOptions,
          brandName: bySlug.name,
          brandSlug: bySlug.slug ?? toSlug(bySlug.name)
        });
      }
    }
    initialBrandHydratedRef.current = true;
  }, [brandOptions, brandId, brandLoading, setBrandSelection]);

  useEffect(() => {
    if (Array.isArray(brandOptionsByCategory[ALL_CATEGORY_KEY]) || fetchingBrandKeysRef.current.has(ALL_CATEGORY_KEY)) {
      return;
    }

    let cancelled = false;
    fetchingBrandKeysRef.current.add(ALL_CATEGORY_KEY);
    setBrandLoading(true);

    (async () => {
      let options = [];
      try {
        const response = await api.brands.list({ active: true, limit: 200 });
        options = normalizeBrandOptions(response);
      } catch {
        options = [];
      }

      if (!cancelled) {
        setBrandOptionsByCategory(prev => ({ ...prev, [ALL_CATEGORY_KEY]: options }));
      }

      fetchingBrandKeysRef.current.delete(ALL_CATEGORY_KEY);
      if (!cancelled && fetchingBrandKeysRef.current.size === 0) {
        setBrandLoading(false);
      } else if (fetchingBrandKeysRef.current.size === 0) {
        setBrandLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandOptionsByCategory]);

  useEffect(() => {
    if (categoryId === 'all' || categoryId == null) {
      return;
    }

    const key = String(categoryId);
    if (Array.isArray(brandOptionsByCategory[key]) || fetchingBrandKeysRef.current.has(key)) {
      return;
    }

    let cancelled = false;
    fetchingBrandKeysRef.current.add(key);
    setBrandLoading(true);

    const params = { active: true, limit: 200, categoryId: categoryId };

    (async () => {
      let options = [];
      try {
        const response = await api.brands.list(params);
        options = normalizeBrandOptions(response);
      } catch {
        options = [];
      }

      if (!cancelled) {
        setBrandOptionsByCategory(prev => ({ ...prev, [key]: options }));
      }

      fetchingBrandKeysRef.current.delete(key);
      if (!cancelled && fetchingBrandKeysRef.current.size === 0) {
        setBrandLoading(false);
      } else if (fetchingBrandKeysRef.current.size === 0) {
        setBrandLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryId, brandOptionsByCategory]);



  function handlePriceChange(r) { setPriceRange(r); }

  function handleCategorySelect(event) {
    setCategorySelection(event.target.value);
  }

  function handleBrandSelect(event) {
    setBrandSelection(event.target.value);
  }

  function resetFilters() {
    setQuery('');
    setCategorySelection('all');
    setBrandSelection('all');
    setInStockOnly(false);
    setPriceRange({ ...sliderBounds });
    setCollectionTitle('');
    setSectionFilters({
      sectionId: null,
      collectionTitle: '',
      state: {
        query: '',
        brand: '',
        brandId: null,
        brandSlug: null,
        categoryId: null,
        categorySlug: null,
        inStock: false,
        minPrice: null,
        maxPrice: null
      },
      staticFilters: {}
    });
    navigate(location.pathname, { replace: false });
  }

  const activeFilterCount = (
    (query ? 1 : 0) +
    (brandId !== 'all' ? 1 : 0) +
    (categoryId !== 'all' ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (priceRange.min !== sliderBounds.min ? 1 : 0) +
    (priceRange.max !== sliderBounds.max ? 1 : 0)
  );
  const [showFilters, setShowFilters] = useState(true);
  useEffect(()=> { if (window.innerWidth < 576) setShowFilters(false); }, []);

  return (
    <section className="container-fluid py-3 px-3 px-sm-4">
      <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-3 mb-3">
        <div className="flex-grow-1">
          <h1 className="h3 mb-1">{activeCollectionTitle ? activeCollectionTitle : `Browse ${storeName} products`}</h1>
          {activeCollectionTitle ? (
            <p className="text-muted mb-2">Curated results powered by “{activeCollectionTitle}”. Adjust filters or reset to browse everything.</p>
          ) : (
            <p className="text-muted mb-2">Use filters to explore thousands of essentials.</p>
          )}
        </div>
      </div>
      <div className="mb-2 d-flex align-items-center gap-2 flex-wrap">
        <h2 className="h6 m-0">Filter Products</h2>
        <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={()=>setShowFilters(s=>!s)} aria-expanded={showFilters} aria-controls="filtersPanel">
          <i className={`bi ${showFilters ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
          <span className="d-sm-none">{showFilters ? 'Hide' : 'Show'}</span>
          <span className="d-none d-sm-inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
          {activeFilterCount > 0 && <span className="badge text-bg-success ms-1">{activeFilterCount}</span>}
        </button>
        <button type="button" className="btn btn-link p-0 small" onClick={resetFilters}>Reset</button>
      </div>
      {showFilters && (
      <form id="filtersPanel" className="row g-3 mb-4" onSubmit={e=>e.preventDefault()} aria-label="Product filters">
        <div className="col-12 col-md-6 col-lg-3">
          <label className="form-label small text-muted" htmlFor="filterSearch">Search</label>
          <input id="filterSearch" type="search" className="form-control" placeholder="e.g. unga" value={query} onChange={e=>setQuery(e.target.value)} />
        </div>
        <div className="col-6 col-md-3 col-lg-2">
          <label className="form-label small text-muted" htmlFor="filterBrand">Brand</label>
          <select
            id="filterBrand"
            className="form-select form-select-sm"
            value={brandId}
            onChange={handleBrandSelect}
            disabled={brandLoading || (categoryId !== 'all' && !brandLoading && brandOptions.length === 0)}
          >
            <option value="all">All brands</option>
            {brandOptions.map(option => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          {brandLoading && <small className="form-text text-muted">Loading brands…</small>}
          {!brandLoading && categoryId !== 'all' && brandOptions.length === 0 && (
            <small className="form-text text-muted">No brands linked to this category yet.</small>
          )}
        </div>
        <div className="col-6 col-md-3 col-lg-2">
          <label className="form-label small text-muted" htmlFor="filterCategory">Category</label>
          <select id="filterCategory" className="form-select" value={categoryId} onChange={handleCategorySelect}>
            <option value="all">All</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-6 col-lg-4">
          <label className="form-label small text-muted d-block" htmlFor="priceMinInput">Price Range</label>
          <div className="d-flex gap-2 align-items-start">
            <div className="flex-grow-1">
              <input
                id="priceMinInput"
                type="number"
                className="form-control form-control-sm"
                min={sliderBounds.min}
                max={priceRange.max}
                value={priceRange.min}
                onChange={e=>handlePriceChange({ min: Number(e.target.value), max: priceRange.max })}
                aria-label="Minimum price"
                placeholder="Min"
              />
            </div>
            <span className="small mt-1">–</span>
            <div className="flex-grow-1">
              <input
                id="priceMaxInput"
                type="number"
                className="form-control form-control-sm"
                min={priceRange.min}
                max={sliderBounds.max}
                value={priceRange.max}
                onChange={e=>handlePriceChange({ min: priceRange.min, max: Number(e.target.value) })}
                aria-label="Maximum price"
                placeholder="Max"
              />
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3 col-lg-2">
          <label className="form-label small text-muted d-block" htmlFor="inStockToggle">In stock only</label>
          <div className="form-check m-0">
            <input className="form-check-input" type="checkbox" id="inStockToggle" checked={inStockOnly} onChange={e=>setInStockOnly(e.target.checked)} />
          </div>
        </div>
        <div className="col-6 col-md-3 col-lg-1 d-grid align-content-end">
          <label className="form-label small text-muted visually-hidden" htmlFor="clearFiltersButton">Clear filters</label>
          <button id="clearFiltersButton" type="button" onClick={resetFilters} className="btn btn-outline-secondary btn-sm">Clear</button>
        </div>
      </form>
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading ? (
        <div className="row g-3">
          {Array.from({length:8}).map((_,i)=>(
            <div key={i} className="col-6 col-md-4 col-lg-3">
              <div className="card h-100 p-3">
                <div className="placeholder-glow mb-2 text-center" style={{fontSize:'2.5rem'}}>
                  <span className="placeholder col-6" style={{height:'2.5rem'}}></span>
                </div>
                <p className="placeholder-glow mb-2">
                  <span className="placeholder col-8"></span>
                </p>
                <p className="placeholder-glow mb-2 small">
                  <span className="placeholder col-10"></span>
                  <span className="placeholder col-7"></span>
                </p>
                <div className="mt-auto placeholder-glow">
                  <span className="placeholder col-5"></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-muted">No products match your search.</p>
      ) : (
        <div className="row g-3">
          {results.map(p => (
            <div key={p.id} className="col-6 col-md-4 col-lg-3">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
      <PaginationBar {...pageMeta} onPageChange={setPage} />
    </section>
  );
}
