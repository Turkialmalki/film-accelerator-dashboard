/**
 * POST /api/auth/change-password — replace the caller's own password and clear
 * the `must_change_password` gate.
 *
 * Why the change happens here rather than client-side via
 * `supabase.auth.updateUser({ password })`: the gate lives in
 * `app_metadata.must_change_password`, which only the service-role key can
 * write. If the client changed the password and then asked the server to clear
 * the flag, a user holding a temporary password could simply call the
 * flag-clearing endpoint and skip the change entirely. Doing both in one
 * privileged, session-verified call closes that hole.
 *
 * The caller may only ever act on themselves: the target id comes from the
 * verified session, never from the request body.
 *
 * STATUS: never executed against a live project. See HANDOFF.md §9.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/data/supabase-admin';
import { createRouteSupabase } from '@/lib/supabase/route-client';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  password: z.string().min(8).max(200),
  /** Required for a voluntary change; optional while the gate is set, because
   *  the user proved that credential moments ago at sign-in. */
  currentPassword: z.string().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    // Demo mode has no password store at all; the screen says so and there is
    // nothing here to do.
    return NextResponse.json({ error: 'DEMO_MODE' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'WEAK_PASSWORD' }, { status: 400 });
  }

  const supabase = createRouteSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const user = userData.user;
  const gated = (user.app_metadata as Record<string, unknown>)?.must_change_password === true;

  if (!gated) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json({ error: 'CURRENT_PASSWORD_REQUIRED' }, { status: 400 });
    }
    // Verified on a throwaway client so the check cannot disturb the cookie
    // session that is authenticating this very request.
    const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await verifier.auth.signInWithPassword({
      email: user.email ?? '',
      password: parsed.data.currentPassword,
    });
    if (error) {
      return NextResponse.json({ error: 'BAD_CURRENT_PASSWORD' }, { status: 403 });
    }
    await verifier.auth.signOut();
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: parsed.data.password,
      app_metadata: {
        ...(user.app_metadata as Record<string, unknown>),
        must_change_password: false,
      },
    });
    if (error) throw error;

    // Mirror it onto the durable column. The JWT claim is what middleware
    // reads on every request; this row is what an operator queries.
    const { error: profileError } = await admin
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);
    if (profileError) throw profileError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[change-password] failed', message);
    return NextResponse.json({ error: 'CHANGE_FAILED', message }, { status: 500 });
  }
}
