/**
 * POST /api/auth/request-reset — "forgot my password", handled entirely by
 * this app instead of Supabase's built-in mailer.
 *
 * `supabase.auth.resetPasswordForEmail()` sends its email from Supabase's own
 * infrastructure and points the link at whatever "Site URL" is configured in
 * the project's Auth settings — which on this project was still the local-dev
 * default, so every reset email landed on `localhost` regardless of which
 * domain the user actually visited. This route sidesteps that entirely:
 *
 *   1. Use the **service-role** admin client to generate a real recovery
 *      link ourselves (`auth.admin.generateLink`), explicitly redirecting to
 *      *this* request's own origin — so it always matches whatever domain
 *      the user is actually on (production or a preview deploy).
 *   2. Email that link through Resend, using the same sender and template
 *      family as the invite flow.
 *
 * Deliberately unauthenticated (a forgotten-password user isn't signed in)
 * and deliberately silent about whether the address exists — the response
 * shape is identical either way, matching `DemoAdapter.requestPasswordReset`'s
 * existing "does not reveal whether the account exists" contract.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { findAuthUserByEmail, getAdminSupabase } from '@/lib/data/supabase-admin';
import { sendPasswordResetEmail } from '@/lib/email/resend';

// node:crypto and the Resend SDK both want the Node runtime, not the Edge one.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  locale: z.enum(['ar', 'en']).optional(),
});

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
  const locale = parsed.data.locale ?? 'ar';

  // Generic response shape, always returned, whether or not anything below
  // actually happens — the caller cannot distinguish "no such account" from
  // "email delivery failed" from "sent", by design.
  const ok = NextResponse.json({ ok: true });

  let admin;
  try {
    admin = getAdminSupabase();
  } catch {
    return ok; // No service-role key configured: nothing to do, still generic.
  }

  const existing = await findAuthUserByEmail(admin, email);
  if (!existing) return ok;

  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const redirectTo = new URL(`/${locale}/reset-password`, origin).toString();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (error || !data?.properties?.action_link) return ok;

  const profile = await admin
    .from('profiles')
    .select('full_name, locale')
    .eq('id', existing.id)
    .maybeSingle();
  const fullNameField = profile.data?.full_name as { ar?: string; en?: string } | null | undefined;
  const fullName = fullNameField?.[locale] || fullNameField?.en || fullNameField?.ar || undefined;

  await sendPasswordResetEmail({
    to: email,
    fullName,
    actionLink: data.properties.action_link,
  });

  return ok;
}
