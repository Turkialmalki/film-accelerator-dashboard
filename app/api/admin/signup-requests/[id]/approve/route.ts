/**
 * GET /api/admin/signup-requests/[id]/approve?token=... — the "Approve"
 * button in the admin notification email, clicked straight from an inbox.
 *
 * GET, not POST: this link has to work with nothing but a click in an email
 * client — there is no page, no JS, no session to attach a POST body to.
 * The token in the query string *is* the authorization; it is a random
 * uuid stored only in this row, checked against the row the path names, and
 * the row's own `pending` status is the single-use guard — a second click,
 * a forwarded link, or an email client's automatic link-prefetcher hitting
 * this URL before a human ever does, all land on the same atomic
 * `UPDATE ... WHERE status = 'pending'` claim below, so only one of any
 * number of near-simultaneous hits ever proceeds to create an account.
 *
 * On approval:
 *   - `admin` requests get an `admin` org_membership on the existing org.
 *   - `participant` requests first get a brand-new team created for them
 *     (name from what they typed at sign-up; every other field defaults),
 *     because the participant experience is built entirely around having
 *     one — an admin can rename/complete it from Teams afterward.
 * Either way the account is created (or, if it somehow already exists,
 * reset) exactly like `/api/admin/invite` does, and the same temporary-
 * password email goes out through Resend — approving a registration and
 * inviting someone by hand end up as the same account, not two kinds.
 */

import { type NextRequest } from 'next/server';
import { findAuthUserByEmail, getAdminSupabase } from '@/lib/data/supabase-admin';
import { generateTempPassword } from '@/lib/auth/temp-password';
import { isResendConfigured, sendInviteEmail } from '@/lib/email/resend';
import { decisionPage } from '../../decision-page';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'team') + '-' + Math.random().toString(36).slice(2, 7);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = request.nextUrl.searchParams.get('token') ?? '';

  let admin;
  try {
    admin = getAdminSupabase();
  } catch {
    return decisionPage({ ok: false, title: 'Not configured', body: 'The service-role key is missing.' });
  }

  const { data: lookupRow } = await admin
    .from('signup_requests')
    .select('id, approve_token, status')
    .eq('id', params.id)
    .maybeSingle();

  if (!lookupRow) {
    return decisionPage({ ok: false, title: 'Not found', body: 'This request no longer exists.' });
  }
  if (lookupRow.approve_token !== token) {
    return decisionPage({ ok: false, title: 'Invalid link', body: 'This approval link is not valid.' });
  }

  // Claim the row atomically — `status = 'pending'` in the WHERE clause,
  // not a prior SELECT, is what actually closes the race: two requests
  // (a real double-click, an email client's link-prefetcher, a platform
  // retry) can both read `pending` before either writes, but only one of
  // them can be the row this UPDATE actually touches. `.select()` on an
  // UPDATE returns the rows it changed, so an empty result here means this
  // request lost the race — not that anything went wrong.
  const { data: claimed } = await admin
    .from('signup_requests')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (!claimed) {
    const { data: reqRow } = await admin.from('signup_requests').select('status').eq('id', params.id).maybeSingle();
    return decisionPage({
      ok: true,
      title: 'Already decided',
      body: `This request was already ${reqRow?.status === 'approved' ? 'approved' : 'rejected'} — no action taken.`,
    });
  }

  const reqRow = claimed;
  const email = reqRow.email as string;
  const fullName = reqRow.full_name as string;
  const orgId = reqRow.org_id as string;
  const requestedRole = reqRow.requested_role as 'admin' | 'participant';

  let teamId: string | null = null;
  if (requestedRole === 'participant') {
    const { data: cohort } = await admin
      .from('cohorts')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    const { data: team, error: teamError } = await admin
      .from('teams')
      .insert({
        org_id: orgId,
        cohort_id: cohort?.id,
        slug: slugify(fullName || email),
        name: { ar: fullName, en: fullName },
      })
      .select('id')
      .maybeSingle();

    if (teamError || !team) {
      return decisionPage({
        ok: false,
        title: 'Could not create team',
        body: teamError?.message || 'Unknown error creating the participant team.',
      });
    }
    teamId = team.id;
  }

  const tempPassword = generateTempPassword();
  const appMetadata = {
    role: requestedRole,
    org_id: orgId,
    team_id: teamId,
    must_change_password: true,
  };
  const userMetadata = { full_name: fullName };

  const existing = await findAuthUserByEmail(admin, email);
  let userId: string;
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: tempPassword,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    });
    if (error) return decisionPage({ ok: false, title: 'Could not update account', body: error.message });
    userId = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    });
    if (error) return decisionPage({ ok: false, title: 'Could not create account', body: error.message });
    userId = data.user.id;
  }

  await admin.from('profiles').upsert(
    { id: userId, email, full_name: { ar: fullName, en: fullName }, must_change_password: true },
    { onConflict: 'id' },
  );
  await admin.from('org_memberships').upsert(
    { org_id: orgId, profile_id: userId, role: requestedRole, team_id: teamId },
    { onConflict: 'org_id,profile_id' },
  );
  // Status and decided_at were already set atomically by the claim above;
  // team_id is the one field that could only be known after creating it.
  if (teamId) {
    await admin.from('signup_requests').update({ team_id: teamId }).eq('id', reqRow.id);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const signInUrl = new URL('/ar/sign-in', origin).toString();
  const emailResult = await sendInviteEmail({ to: email, fullName, tempPassword, signInUrl });

  return decisionPage({
    ok: true,
    title: 'Approved',
    body: emailResult.sent
      ? `${fullName} (${email}) has been approved and emailed their temporary password.`
      : `${fullName} (${email}) has been approved, but the email could not be sent (${
          isResendConfigured() ? emailResult.reason : 'Resend is not configured'
        }). Their temporary password: ${tempPassword}`,
  });
}
