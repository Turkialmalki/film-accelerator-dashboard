/**
 * GET /api/admin/signup-requests/[id]/reject?token=... — the "Reject"
 * button in the admin notification email. See the sibling `approve` route
 * for why this is a token-gated GET rather than an authenticated POST.
 */

import { type NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/data/supabase-admin';
import { sendSignupRejectedEmail } from '@/lib/email/resend';
import { decisionPage } from '../../decision-page';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    .select('id, reject_token')
    .eq('id', params.id)
    .maybeSingle();

  if (!lookupRow) {
    return decisionPage({ ok: false, title: 'Not found', body: 'This request no longer exists.' });
  }
  if (lookupRow.reject_token !== token) {
    return decisionPage({ ok: false, title: 'Invalid link', body: 'This rejection link is not valid.' });
  }

  // Same atomic claim as the approve route — see its comment for why a
  // prior SELECT check isn't enough on its own.
  const { data: reqRow } = await admin
    .from('signup_requests')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (!reqRow) {
    const { data: current } = await admin.from('signup_requests').select('status').eq('id', params.id).maybeSingle();
    return decisionPage({
      ok: true,
      title: 'Already decided',
      body: `This request was already ${current?.status === 'approved' ? 'approved' : 'rejected'} — no action taken.`,
    });
  }

  await sendSignupRejectedEmail({ to: reqRow.email, fullName: reqRow.full_name });

  return decisionPage({
    ok: true,
    title: 'Rejected',
    body: `${reqRow.full_name} (${reqRow.email}) has been rejected and notified by email.`,
  });
}
