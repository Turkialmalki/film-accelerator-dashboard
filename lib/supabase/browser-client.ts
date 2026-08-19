/**
 * The one browser-side Supabase client.
 *
 * It is created with `createBrowserClient` from `@supabase/ssr` rather than
 * the plain `createClient`, because that variant persists the session into
 * **cookies** instead of `localStorage`. That is the whole reason it exists:
 * `middleware.ts` runs before any JavaScript on the page and can only see
 * cookies, so a localStorage session would be invisible to the server-side
 * route guard.
 *
 * Anon key only. The service-role key never comes near this module — see
 * `lib/data/supabase-admin.ts`, which is server-only.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

let client: SupabaseClient | null = null;

/**
 * Lazily built, and memoised, so that a client component rendering on the
 * server during SSR never constructs a browser client it cannot use.
 */
export function getBrowserSupabase(
  url: string = SUPABASE_URL,
  anonKey: string = SUPABASE_ANON_KEY,
): SupabaseClient {
  if (!client) {
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
