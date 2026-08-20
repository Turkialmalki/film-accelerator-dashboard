/**
 * POST /api/auth/signup-request — self-service registration, gated.
 *
 * Open registration used to create a real, immediately-usable auth account
 * the moment someone submitted the sign-up form. That is wrong for this
 * product: anyone landing on /sign-up should be asking to join, not letting
 * themselves in. This route replaces the instant `signUp()` path (still used
 * as-is when a real invite code is supplied — that is already an
 * admin-authorised route) with a request queued for a human decision:
 *
 *   1. Write a `signup_requests` row (service-role; never touched by the
 *      anon key — see migrations/0006).
 *   2. Email every owner/admin in the org a one-click Approve/Reject pair.
 *   3. Return a generic `{ok:true}` — this route deliberately does not
 *      reveal whether the email already has an account or a pending
 *      request, matching the non-enumerating contract the rest of auth
 *      already holds to.
 *
 * Approving/rejecting happens in the two sibling routes under
 * /api/admin/signup-requests/[id]/{approve,reject} — GET routes, clickable
 * straight from an email client, gated by a single-use token rather than a
 * signed-in session.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/data/supabase-admin';
import { sendSignupRequestAdminEmail } from '@/lib/email/resend';
import { ORG_ID_ENV } from '@/lib/supabase/env';
import { ORG_ID } from '@/lib/data/seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(200),
  requestedRole: z.enum(['admin', 'participant']),
  locale: z.enum(['ar', 'en']).optional(),
});

function decisionUrl(request: NextRequest, id: string, token: string, action: 'approve' | 'reject'): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const url = new URL(`/api/admin/signup-requests/${id}/${action}`, origin);
  url.searchParams.set('token', token);
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
    return NextResponse.json({ error: 'INVALID_INPUT', issues: parsed.error.issues }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const fullName = parsed.data.fullName.trim();
  const orgId = ORG_ID_ENV || ORG_ID;

  // Always the same shape back to the caller, whatever happens below.
  const ok = NextResponse.json({ ok: true });

  let admin;
  try {
    admin = getAdminSupabase();
  } catch {
    return ok;
  }

  // An email that already has a real account has nothing to request.
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingProfile) return ok;

  // Insert-or-ignore on the "one pending request per email" unique index —
  // resubmitting the form while already pending must not re-notify every
  // admin, and must still answer `{ok:true}` either way.
  const { data: reqRow, error: insertError } = await admin
    .from('signup_requests')
    .insert({
      org_id: orgId,
      email,
      full_name: fullName,
      requested_role: parsed.data.requestedRole,
    })
    .select('id, approve_token, reject_token')
    .maybeSingle();

  if (insertError || !reqRow) return ok; // Most likely: already pending. Stay generic.

  // Notify every owner/admin — one email each, not one email with everyone
  // on the To line.
  const { data: admins } = await admin
    .from('org_memberships')
    .select('profile_id, role, profiles(email, full_name)')
    .eq('org_id', orgId)
    .in('role', ['owner', 'admin']);

  const orgRow = await admin.from('organizations').select('name').eq('id', orgId).maybeSingle();
  const orgName = (orgRow.data?.name as { en?: string; ar?: string } | null)?.en;

  const approveUrl = decisionUrl(request, reqRow.id, reqRow.approve_token, 'approve');
  const rejectUrl = decisionUrl(request, reqRow.id, reqRow.reject_token, 'reject');

  await Promise.all(
    (admins ?? [])
      .map((row) => (row as unknown as { profiles: { email: string } | null }).profiles?.email)
      .filter((email): email is string => Boolean(email))
      .map((adminEmail) =>
        sendSignupRequestAdminEmail({
          to: adminEmail,
          requesterName: fullName,
          requesterEmail: email,
          requestedRole: parsed.data.requestedRole,
          approveUrl,
          rejectUrl,
          orgName,
        }),
      ),
  );

  return ok;
}
