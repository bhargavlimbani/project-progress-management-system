import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage } from "../utils/format.js";

/**
 * Run an API call on mount (and on demand), tracking loading/error state so
 * pages don't repeat the same try/catch/setState boilerplate.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi(() => projectApi.list(), []);
 */
export function useApi(fetcher, deps = [], { immediate = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetcherRef.current(...args);
      const payload = response?.data !== undefined ? response.data : response;
      if (mounted.current) setData(payload);
      return payload;
    } catch (err) {
      if (mounted.current) setError(apiErrorMessage(err));
      throw err;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!immediate) return;
    execute().catch(() => {
      /* error state is already set; nothing to do here */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, refetch: execute };
}

/**
 * Fire several API calls together and expose them as a keyed object.
 * Used by dashboards that need six independent endpoints at once.
 *
 *   const { data, loading } = useApiAll({ stats: analyticsApi.adminStats, ... })
 */
export function useApiAll(fetchers, deps = []) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const keys = Object.keys(fetchers);
    try {
      const settled = await Promise.allSettled(keys.map((k) => fetchers[k]()));
      if (!mounted.current) return;

      const next = {};
      let firstError = null;
      settled.forEach((result, i) => {
        if (result.status === "fulfilled") {
          next[keys[i]] = result.value?.data !== undefined ? result.value.data : result.value;
        } else {
          next[keys[i]] = null;
          firstError = firstError || apiErrorMessage(result.reason);
        }
      });

      setData(next);
      // Only surface an error if everything failed — a single missing widget
      // shouldn't blank out an otherwise working dashboard.
      if (settled.every((r) => r.status === "rejected")) setError(firstError);
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return { data, loading, error, refetch: load };
}
