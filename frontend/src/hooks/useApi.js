import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for fetching data with loading/error states and auto-refresh.
 *
 * @param {string} url - The API endpoint to fetch
 * @param {object} options
 * @param {number} options.refreshInterval - Auto-refresh interval in ms (0 to disable)
 * @param {*} options.fallback - Fallback data if the fetch fails
 * @param {boolean} options.immediate - Whether to fetch immediately (default true)
 */
export function useApi(url, { refreshInterval = 0, fallback = null, immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const json = await response.json();
      setData(json);
      return json;
    } catch (err) {
      setError(err.message);
      if (fallback !== null) {
        setData(fallback);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [url, fallback]);

  useEffect(() => {
    if (!immediate) return;
    fetchData();
  }, [fetchData, immediate]);

  useEffect(() => {
    if (refreshInterval <= 0) return;

    intervalRef.current = setInterval(fetchData, refreshInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refreshInterval]);

  return { data, loading, error, refetch: fetchData };
}

export default useApi;
