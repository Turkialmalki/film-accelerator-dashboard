/**
 * The service-role Supabase client. **Server only. Never import this from a
 * client component.**
 *
 * The service-role key bypasses Row Level Security entirely — anyone holding
 * it owns the database. The `import 'server-only'` on the first line is not
 * decoration: it makes the build fail loudly if any module in a client bundle
 * ever reaches this file, which is a stronger guarantee than a code review
 * convention.
 *
 * It is deliberately a **separate module from `SupabaseAdapter`**. That adapter
 * keeps using the anon key so that every normal read and write stays governed
 * by the RLS policies in `supabase/rls.sql`. This client is used only for the
 * handful of operations that genuinely require privilege:
 *
 *   - creating an auth user on an admin's behalf (`auth.admin.createUser`)
 *   - stamping `app_metadata` claims, which a user must not be able to forge
 *   - writing the matching `profiles` / `org_memberships` rows
 *
 * STATUS: never executed against a live project. No Supabase credentials were
 * available while this was written — see HANDOFF.md §9.
 */

import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/supabase/env';

let client: SupabaseClient | null = null;

export function isAdminClientConfigured(): boolean {
  return Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Throws rather than returning null, because every caller needs the client to
 * exist and a silent no-op here would look like a successful invite.
 */
export function getAdminSupabase(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

/**
 * Find an auth user by email. The v2 admin API has no `getUserByEmail`, so
 * this pages through `listUsers`. Fine at accelerator scale (tens of users);
 * if this ever runs against thousands, add an indexed lookup on `profiles`
 * instead and read the id from there.
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return { id: hit.id, email: hit.email ?? target };
    if (data.users.length < perPage) return null;
  }
  return null;
}
