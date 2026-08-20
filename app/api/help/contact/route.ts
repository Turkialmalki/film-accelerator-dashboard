/**
 * POST /api/help/contact — the Help page's "send an email" action.
 *
 * Sends for real, through this app's own Resend account, instead of a
 * `mailto:` link. A `mailto:` link only works if the visitor's own device
 * has a default mail client configured — unreliable enough on its own, and
 * likely to silently do nothing for exactly the people using this page (a
 * founder on a locked-down work laptop, a mobile browser with no mail app
 * signed in). This route requires an authenticated session — it is a
 * signed-in app page, not a public contact form — and sends with
 * `replyTo` set to the caller's own address, so answering it in an inbox
 * goes straight back to them.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveCaller } from '@/lib/auth/caller';
import { getAdminSupabase } from '@/lib/data/supabase-admin';
import { sendHelpContactEmail } from '@/lib/email/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
});

/** Real support inbox for the programme — same default as the Help page. */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'turkialmalki202200@gmail.com';

export async function POST(request: NextRequest) {
  const caller = await resolveCaller();
  if (!caller) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

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

  // Demo mode has nothing to send through — the caller has no real
  // Resend-reachable identity and there is no mail provider behind it. The
  // client already treats a non-ok response as failure and shows a
  // message accordingly, so this is a normal, expected outcome there.
  if (caller.mode === 'demo') {
    return NextResponse.json({ error: 'DEMO_MODE' }, { status: 400 });
  }

  let fromName = caller.email.split('@')[0];
  try {
    const admin = getAdminSupabase();
    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', caller.userId).maybeSingle();
    const name = (profile?.full_name as { ar?: string; en?: string } | null)?.en;
    if (name) fromName = name;
  } catch {
    // Fall back to the email-derived name below; a missing profile lookup
    // must not block sending the actual message.
  }

  const result = await sendHelpContactEmail({
    to: SUPPORT_EMAIL,
    fromName,
    fromEmail: caller.email,
    message: parsed.data.message,
  });

  if (!result.sent) {
    return NextResponse.json({ error: 'SEND_FAILED', reason: result.reason }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
