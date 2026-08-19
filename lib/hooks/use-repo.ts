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
 *
 * A rejected `query` must never leave a caller stuck showing a skeleton
 * forever — every consumer of this hook renders `loading ? <Skeleton /> :
 * <realContent using data />`, so an uncaught rejection here means "this
 * screen never finishes loading," silently, with no error visible anywhere.
 * That happened for real: the Supabase adapter's very first request after
 * sign-in occasionally lost the race with the auth session attaching to the
 * client, and every page built on this hook froze on its loading state.
 * `loading` now always resolves; `error` is exposed for a caller that wants
 * to show something better than silently falling back to `initial`.
 */
export function useRepoQuery<T>(
  query: (repo: Repository) => Promise<T>,
  initial: T,
): { data: T; loading: boolean; error: unknown; refresh: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const run = useCallback(() => {
    let cancelled = false;
    query(getRepository())
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useRepoQuery] query failed', err);
        setError(err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    const cancel = run();
    const unsubscribe = subscribeToRepository(() => {
      query(getRepository())
        .then(setData)
        .catch((err) => console.error('[useRepoQuery] refresh failed', err));
    });
    return () => {
      cancel();
      unsubscribe();
    };
  }, [run, query]);

  return { data, loading, error, refresh: run };
}
