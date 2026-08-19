/**
 * Server-side session verification for `middleware.ts`, Supabase mode only.
 *
 * This is the module that replaces the unsigned `fba_demo_session` cookie once
 * real credentials are present. It does three things:
 *
 *  1. Builds a request-bound Supabase client whose cookie jar is the incoming
 *     request, so `auth.getUser()` reads (and refreshes) the real session.
 *  2. Returns the caller's role and their `must_change_password` state.
 *  3. Hands back a carrier `NextResponse` holding any refreshed auth cookies,
 *     which the middleware must fold into whatever response it finally sends —
 *     otherwise a token rotated during this request is dropped and the user is
 *     silently signed out.
 *
 * Where the role comes from. `auth.getUser()` contacts the Supabase Auth
 * server and validates the JWT, so `user.app_metadata` is trustworthy — it can
 * only be written with the service-role key, never by the user. The invite
 * route and the bootstrap script both stamp `role` and `must_change_password`
 * there for exactly this reason: the common case then costs no database query.
 * If those claims are absent (a user created some other way, e.g. straight
 * through the Supabase dashboard) we fall back to reading `org_memberships`
 * with the caller's own anon-key session, which RLS permits for their own row.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { AppRole } from '@/lib/routes';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

const ROLES: AppRole[] = ['owner', 'admin', 'reviewer', 'participant'];

function asRole(value: unknown): AppRole | null {
  return typeof value === 'string' && (ROLES as string[]).includes(value)
    ? (value as AppRole)
    : null;
}

export interface SupabaseMiddlewareSession {
  /** null when nobody is signed in. */
  role: AppRole | null;
  email: string | null;
  teamId: string | null;
  mustChangePassword: boolean;
  /** Carries refreshed auth cookies. Never returned to the browser as-is. */
  carrier: NextResponse;
}

export async function readSupabaseSession(
  request: NextRequest,
): Promise<SupabaseMiddlewareSession> {
  let carrier = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        carrier = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          carrier.cookies.set(name, value, options),
        );
      },
    },
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // A network failure talking to Supabase must not hard-fail every request;
    // it degrades to "not signed in", which the guards below handle safely.
    user = null;
  }

  if (!user) {
    return { role: null, email: null, teamId: null, mustChangePassword: false, carrier };
  }

  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  let role = asRole(appMeta.role);
  let teamId = typeof appMeta.team_id === 'string' ? appMeta.team_id : null;

  if (!role) {
    try {
      const { data } = await supabase
        .from('org_memberships')
        .select('role, team_id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();
      role = asRole(data?.role) ?? null;
      teamId = (data?.team_id as string | null) ?? teamId;
    } catch {
      role = null;
    }
  }

  return {
    role,
    email: user.email ?? null,
    teamId,
    mustChangePassword: appMeta.must_change_password === true,
    carrier,
  };
}

/**
 * Move the auth cookies the carrier collected onto the response that is
 * actually being sent. Without this a redirect issued in the same request that
 * rotated a refresh token would lose the new token.
 */
export function withAuthCookies(carrier: NextResponse, response: NextResponse): NextResponse {
  carrier.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}
