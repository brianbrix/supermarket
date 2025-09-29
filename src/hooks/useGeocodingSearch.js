import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from './useDebounce.js';
import { api } from '../services/api.js';

const MIN_QUERY_LENGTH = 3;

export function useGeocodingSearch(initialQuery = '', { debounceMs = 350, limit = 5 } = {}) {
  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebounce(query, debounceMs);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const latestQueryRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    async function runSearch() {
      const trimmed = debounced.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      latestQueryRef.current = trimmed;
      try {
        const res = await api.delivery.geoSearch(trimmed, { limit });
        if (cancelled) return;
        const payload = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
        setResults(payload);
      } catch (err) {
        if (cancelled) return;
        console.warn('geocode search failure', err);
        setError(err instanceof Error ? err : new Error('Failed to search locations'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    runSearch();
    return () => {
      cancelled = true;
    };
  }, [debounced, limit]);

  const apiHelpers = useMemo(() => ({
    setQuery,
    reset: () => {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }), []);

  return {
    query,
    setQuery,
    debouncedQuery: debounced,
    results,
    loading,
    error,
    latestQuery: latestQueryRef.current,
    ...apiHelpers
  };
}

export default useGeocodingSearch;
