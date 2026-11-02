import { useCallback, useEffect, useRef, useState } from "react";

// Keys include session, project and location; stale responses never cross those boundaries.
export function useScopedResource<T>(key: string, load: () => Promise<T>, delay = 0) {
  const [loaded, setLoaded] = useState<{ key: string; value: T } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const current = useRef(key);
  current.current = key;
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!key || current.current !== key) {
      return;
    }

    const request = ++version.current;
    const active = () => current.current === key && request === version.current;
    setFailure(null);
    try {
      const value = await load();
      if (active()) {
        setLoaded({ key, value });
      }
    } catch (error) {
      if (active()) {
        setLoaded(null);
        setFailure({ key, message: (error as Error).message });
        throw error;
      }
    }
  }, [key, load]);
  useEffect(() => {
    if (!key) {
      return;
    }

    const timer = setTimeout(() => void refresh().catch(() => {}), delay);
    const polling = setInterval(() => void refresh().catch(() => {}), 30000);

    return () => {
      version.current++;
      clearTimeout(timer);
      clearInterval(polling);
    };
  }, [key, refresh, delay]);
  const error = failure?.key === key ? failure.message : "";
  const value = loaded?.key === key ? loaded.value : null;

  return { value, error, loading: !!key && !error && !value, refresh };
}
