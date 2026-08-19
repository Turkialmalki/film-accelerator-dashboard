/**
 * POST /api/admin/invite — create a user account and email them a temporary
 * password.
 *
 * This is the privileged half of the invitation flow, and it is a route
 * handler rather than a client call for one reason: creating an auth user
 * needs the Supabase **service-role** key, which bypasses RLS and must never
 * be shipped to a browser. `lib/data/supabase-admin.ts` is `server-only`, so
 * that constraint is enforced by the build, not by convention.
 *
 * Both deployment modes are supported, and they do genuinely different things:
 *
 *   - **Supabase mode** — verifies the caller is an owner/admin, creates (or
 *     re-issues credentials for) the auth user, writes `profiles` and
 *     `org_memberships`, records the invitation, and emails the temporary
 *     password through Resend.
 *   - **Demo mode** — verifies the caller holds an admin demo session and
 *     returns `{ mode: 'demo' }` without creating anything or sending mail.
 *     The client then records the invitation in `localStorage` through the
 *     existing `Repository.createInvitation`, so demo behaviour is byte-for-
 *     byte what it was before this route existed.
 *
 * STATUS: the Supabase branch has never been executed — no live project or
 * Resend account was available. See HANDOFF.md §9.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { canInvite, resolveCaller } from '@/lib/auth/caller';
import { generateInviteCode, generateTempPassword } from '@/lib/auth/temp-password';
import { findAuthUserByEmail, getAdminSupabase } from '@/lib/data/supabase-admin';
import { isResendConfigured, sendInviteEmail } from '@/lib/email/resend';

// node:crypto and the Resend SDK both want the Node runtime, not the Edge one.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'reviewer', 'participant']),
  teamId: z.string().min(1).nullable().optional(),
  fullName: z.string().max(200).optional(),
  /** Locale for the sign-in link in the email. */
  locale: z.enum(['ar', 'en']).optional(),
});

function signInUrl(request: NextRequest, locale: string, next?: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const url = new URL(`/${locale}/sign-in`, origin);
  if (next) url.searchParams.set('next', next);
  return url.toString();
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_INPUT', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const email = input.email.trim().toLowerCase();
  const locale = input.locale ?? 'ar';

  const caller = await resolveCaller();
  if (!caller) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (!canInvite(caller.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  /* ------------------------------------------------------------ demo mode */

  if (caller.mode === 'demo') {
    return NextResponse.json({
      mode: 'demo',
      simulated: true,
      email,
      role: input.role,
      // Nothing was created and nothing was sent. The client records the
      // invitation locally, exactly as it did before.
      note: 'Demo mode: no account was created and no email was sent.',
    });
  }

  /* -------------------------------------------------------- supabase mode */

  let admin;
  try {
    admin = getAdminSupabase();
  } catch {
    return NextResponse.json({ error: 'SERVICE_ROLE_KEY_MISSING' }, { status: 500 });
  }

  const tempPassword = generateTempPassword();
  const fullName = input.fullName?.trim() || '';
  const teamId = input.teamId ?? null;

  const appMetadata = {
    role: input.role,
    org_id: caller.orgId,
    team_id: teamId,
    must_change_password: true,
  };
  const userMetadata = {
    full_name: fullName,
    // Suppresses the sign-up trigger's invite-code branch; membership is
    // written explicitly below.
    invited_by: caller.email,
  };

  try {
    // 1. The auth user. Idempotent: re-inviting an existing address resets
    //    their temporary password rather than failing, which is what an admin
    //    re-sending an invite actually means.
    const existing = await findAuthUserByEmail(admin, email);
    let userId: string;
    let created: boolean;

    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
        password: tempPassword,
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: userMetadata,
      });
      if (error) throw error;
      userId = data.user.id;
      created = false;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        // No confirmation round trip: the temporary password *is* the proof of
        // delivery, and `must_change_password` forces it to be replaced.
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: userMetadata,
      });
      if (error) throw error;
      userId = data.user.id;
      created = true;
    }

    // 2. The profile row. `handle_new_user` in schema.sql also inserts one, so
    //    this is an upsert rather than an insert — whichever ran first wins on
    //    the id and this fills in the rest.
    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: userId,
        email,
        full_name: { ar: fullName, en: fullName },
        locale,
        must_change_password: true,
      },
      { onConflict: 'id' },
    );
    if (profileError) throw profileError;

    // 3. Authorisation. `unique (org_id, profile_id)` makes this the natural
    //    conflict target, so re-inviting updates the role instead of erroring.
    const { error: membershipError } = await admin.from('org_memberships').upsert(
      { org_id: caller.orgId, profile_id: userId, role: input.role, team_id: teamId },
      { onConflict: 'org_id,profile_id' },
    );
    if (membershipError) throw membershipError;

    // 4. Record it in `invitations` so the Teams drawer's invitation list stays
    //    the single history of who was asked in. The account already exists, so
    //    the row is born accepted rather than pending — there is no code to
    //    redeem.
    const nowIso = new Date().toISOString();
    const { data: invitation } = await admin
      .from('invitations')
      .insert({
        org_id: caller.orgId,
        team_id: teamId,
        email,
        role: input.role,
        code: generateInviteCode(),
        status: 'accepted',
        accepted_at: nowIso,
      })
      .select()
      .maybeSingle();

    // 5. Deliver it.
    const emailResult = await sendInviteEmail({
      to: email,
      fullName,
      tempPassword,
      signInUrl: signInUrl(request, locale),
    });

    return NextResponse.json({
      mode: 'supabase',
      created,
      userId,
      email,
      role: input.role,
      teamId,
      invitation: invitation ?? null,
      emailed: emailResult.sent,
      emailStatus: emailResult.sent ? 'sent' : emailResult.reason,
      emailError: emailResult.sent ? undefined : emailResult.error,
      // The password is returned to the admin **only** when it could not be
      // delivered, so the account is not stranded. When Resend did send it,
      // the credential never leaves the server.
      tempPassword: emailResult.sent ? undefined : tempPassword,
      resendConfigured: isResendConfigured(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[invite] failed', message);
    return NextResponse.json({ error: 'INVITE_FAILED', message }, { status: 500 });
  }
}
