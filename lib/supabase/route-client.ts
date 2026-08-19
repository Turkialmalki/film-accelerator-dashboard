/**
 * Anon-key Supabase client for route handlers, bound to the request cookies.
 *
 * Used to answer "who is calling this API route?" — never to perform the
 * privileged writes themselves. Those go through `lib/data/supabase-admin.ts`.
 */

import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

export function createRouteSupabase(): SupabaseClient {
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Set from a Server Component render, where the cookie store is
          // read-only. Middleware refreshes the session, so this is safe to
          // swallow.
        }
      },
    },
  });
}
