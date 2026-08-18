'use client';

import { useCallback, useEffect, useState } from 'react';
import { getRepository, subscribeToRepository } from '@/lib/data';
import type { Repository } from '@/lib/data/types';

/**
 * Reads from the repository and re-reads whenever anything writes to it.
 *
 * Data lives in the browser in demo mode, so every read happens after mount —
 * that also keeps the server-rendered HTML free of fixture data and avoids
 * hydration mismatches.
 *
 * `query` must be stable (wrap it in useCallback at the call site).
 */
export function useRepoQuery<T>(
  query: (repo: Repository) => Promise<T>,
  initial: T,
): { data: T; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    let cancelled = false;
    void query(getRepository()).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    const cancel = run();
    const unsubscribe = subscribeToRepository(() => {
      void query(getRepository()).then(setData);
    });
    return () => {
      cancel();
      unsubscribe();
    };
  }, [run, query]);

  return { data, loading, refresh: run };
}
