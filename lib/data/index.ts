/**
 * The single entry point every component uses to reach data.
 *
 * If both Supabase env vars are present the Supabase adapter is selected;
 * otherwise the app runs in demo mode against localStorage. Nothing else in
 * the codebase imports an adapter directly.
 */

import { DemoAdapter } from './demo-adapter';
import { SupabaseAdapter } from './supabase-adapter';
import type { Repository } from './types';
import { ORG_ID } from './seed';
import {
  ORG_ID_ENV,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from '@/lib/supabase/env';

let instance: Repository | null = null;

/**
 * The mode detection now lives in `lib/supabase/env.ts` so that middleware,
 * the auth layer and the data layer cannot disagree about which mode the
 * deployment is in. The rule itself is unchanged.
 */
export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

export function getRepository(): Repository {
  if (instance) return instance;
  const orgId = ORG_ID_ENV || ORG_ID;

  instance = isSupabaseConfigured()
    ? new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY, orgId)
    : new DemoAdapter();
  return instance;
}

/** Only the demo adapter exposes a change stream; Supabase would use realtime. */
export function subscribeToRepository(listener: () => void): () => void {
  const repo = getRepository();
  if (repo instanceof DemoAdapter) return repo.subscribe(listener);
  return () => {};
}

export * from './types';
