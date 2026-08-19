/**
 * "Who is calling this API route, and may they do this?" — server only.
 *
 * There are two honest answers depending on the deployment mode, and the route
 * handlers need to tell them apart rather than paper over the difference:
 *
 *   - **Supabase mode**: the caller is a real, JWT-verified user. Their role is
 *     re-read from `org_memberships` with the *service-role* client rather than
 *     trusted from the JWT claim, because this is the check that gates account
 *     creation — the one place worth the extra round trip.
 *   - **Demo mode**: the caller is whoever holds the unsigned `fba_demo_session`
 *     cookie. That is not a security boundary and is not pretended to be; it
 *     exists so the invite UI behaves identically in the demo, where the route
 *     creates nothing and sends nothing.
 */

import 'server-only';

import { cookies } from 'next/headers';
import { ORG_ID_ENV, INVITER_ROLE_NAMES, isSupabaseConfigured } from '@/lib/supabase/env';
import { getAdminSupabase } from '@/lib/data/supabase-admin';
import { createRouteSupabase } from '@/lib/supabase/route-client';
import { ORG_ID } from '@/lib/data/seed';
import type { AppRole } from '@/lib/routes';

const DEMO_SESSION_COOKIE = 'fba_demo_session';

export type Caller =
  | { mode: 'demo'; role: AppRole; email: string; orgId: string }
  | { mode: 'supabase'; role: AppRole; email: string; orgId: string; userId: string };

export function canInvite(role: AppRole): boolean {
  return (INVITER_ROLE_NAMES as readonly string[]).includes(role);
}

export async function resolveCaller(): Promise<Caller | null> {
  const orgId = ORG_ID_ENV || ORG_ID;

  if (!isSupabaseConfigured()) {
    const raw = cookies().get(DEMO_SESSION_COOKIE)?.value;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as { role: AppRole; email?: string };
      if (!parsed?.role) return null;
      return { mode: 'demo', role: parsed.role, email: parsed.email ?? '', orgId };
    } catch {
      return null;
    }
  }

  const supabase = createRouteSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const admin = getAdminSupabase();
  const { data: membership } = await admin
    .from('org_memberships')
    .select('role, org_id')
    .eq('profile_id', data.user.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!membership?.role) return null;

  return {
    mode: 'supabase',
    role: membership.role as AppRole,
    email: data.user.email ?? '',
    orgId: (membership.org_id as string) ?? orgId,
    userId: data.user.id,
  };
}
