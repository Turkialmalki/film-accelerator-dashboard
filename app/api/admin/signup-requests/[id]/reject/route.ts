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

  const { data: reqRow } = await admin
    .from('signup_requests')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!reqRow) {
    return decisionPage({ ok: false, title: 'Not found', body: 'This request no longer exists.' });
  }
  if (reqRow.reject_token !== token) {
    return decisionPage({ ok: false, title: 'Invalid link', body: 'This rejection link is not valid.' });
  }
  if (reqRow.status !== 'pending') {
    return decisionPage({
      ok: true,
      title: 'Already decided',
      body: `This request was already ${reqRow.status === 'approved' ? 'approved' : 'rejected'} — no action taken.`,
    });
  }

  await admin
    .from('signup_requests')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', reqRow.id);

  await sendSignupRejectedEmail({ to: reqRow.email, fullName: reqRow.full_name });

  return decisionPage({
    ok: true,
    title: 'Rejected',
    body: `${reqRow.full_name} (${reqRow.email}) has been rejected and notified by email.`,
  });
}
