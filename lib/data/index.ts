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

let instance: Repository | null = null;

export function isDemoMode(): boolean {
  return !(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getRepository(): Repository {
  if (instance) return instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const orgId = process.env.NEXT_PUBLIC_ORG_ID ?? ORG_ID;

  instance = url && key ? new SupabaseAdapter(url, key, orgId) : new DemoAdapter();
  return instance;
}

/** Only the demo adapter exposes a change stream; Supabase would use realtime. */
export function subscribeToRepository(listener: () => void): () => void {
  const repo = getRepository();
  if (repo instanceof DemoAdapter) return repo.subscribe(listener);
  return () => {};
}

export * from './types';
