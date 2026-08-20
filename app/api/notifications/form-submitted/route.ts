/**
 * POST /api/notifications/form-submitted — fire-and-forget admin email when
 * a participant submits a form.
 *
 * Called from the client right after `submitResponse()` succeeds (see
 * `components/forms/form-filler.tsx`). It is intentionally best-effort: the
 * submission itself already happened and is real, committed data before
 * this route is ever reached, so a failure here (missing Resend key, a
 * lookup miss, a network blip) must never surface as an error to the person
 * who just submitted — it only costs the admins a notification, not the
 * data.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/data/supabase-admin';
import { sendFormSubmittedEmail } from '@/lib/email/resend';
import { ORG_ID_ENV } from '@/lib/supabase/env';
import { ORG_ID } from '@/lib/data/seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  formId: z.string().min(1),
  teamId: z.string().min(1).nullable().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true }); // Best-effort — never block the caller.

  const orgId = ORG_ID_ENV || ORG_ID;

  let admin;
  try {
    admin = getAdminSupabase();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const [{ data: form }, { data: team }, { data: admins }, { data: org }] = await Promise.all([
    admin.from('forms').select('title').eq('id', parsed.data.formId).maybeSingle(),
    parsed.data.teamId
      ? admin.from('teams').select('name').eq('id', parsed.data.teamId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('org_memberships')
      .select('profiles(email)')
      .eq('org_id', orgId)
      .in('role', ['owner', 'admin']),
    admin.from('organizations').select('name').eq('id', orgId).maybeSingle(),
  ]);

  const formTitle = ((form?.title as { ar?: string; en?: string } | null)?.en) || 'Untitled form';
  const teamName = ((team?.name as { ar?: string; en?: string } | null)?.en) || 'A participant team';
  const orgName = (org?.name as { en?: string } | null)?.en;

  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const resultsUrl = new URL(`/ar/results/${parsed.data.formId}`, origin).toString();

  await Promise.all(
    (admins ?? [])
      .map((row) => (row as unknown as { profiles: { email: string } | null }).profiles?.email)
      .filter((email): email is string => Boolean(email))
      .map((email) => sendFormSubmittedEmail({ to: email, teamName, formTitle, resultsUrl, orgName })),
  );

  return NextResponse.json({ ok: true });
}
