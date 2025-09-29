import { useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';

const defaultMeta = {
  page: 0,
  size: 20,
  totalPages: 0,
  totalElements: 0,
  first: true,
  last: true
};

const makeEmptyForm = () => ({
  name: '',
  slug: '',
  description: '',
  active: true,
  categoryIds: []
});

const slugify = (value) => {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export default function AdminBrands() {
  const [items, setItems] = useState([]);
  const [pageMeta, setPageMeta] = useState(defaultMeta);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(makeEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const debounceRef = useRef();
  const selectMenuPortalTarget = typeof document !== 'undefined' ? document.body : undefined;

  useEffect(() => {
    let cancelled = false;
    api.categories.list()
      .then((list) => {
        if (cancelled) return;
        setCategories(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((prev) => prev ?? (err.message ?? 'Failed to load categories'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchApplied(searchDraft.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchDraft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = {
      page,
      size: 20
    };
    if (searchApplied) params.q = searchApplied;
    if (categoryFilter) params.categoryId = categoryFilter;
    if (activeFilter) params.active = activeFilter;

    api.admin.brands.list(params)
      .then((res) => {
        if (cancelled) return;
        const content = res?.content ?? [];
        setItems(content);
        setPageMeta(res ?? defaultMeta);