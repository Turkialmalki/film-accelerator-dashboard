/**
 * GET /api/calendly/summary — admin-only aggregate view of the org's
 * Calendly account (sessions, mentors, hours, cancellations/reschedules).
 *
 * On-demand sync, not a webhook: chosen deliberately over a push-based
 * subscription because nothing this endpoint reports needs to update the
 * instant someone books — see the design discussion this shipped from. That
 * also means it's fully testable in normal `next dev`, unlike a webhook
 * receiver, which Calendly won't subscribe to until it's already live on a
 * public URL.
 */

import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/routes';
import { resolveCaller } from '@/lib/auth/caller';
import { isCalendlyConfigured } from '@/lib/calendly/client';
import { fetchCalendlySummary, type CalendlySummary } from '@/lib/calendly/summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Calendly pages through every scheduled event plus one invitees call per
// canceled event on every request; a short in-memory cache keeps a
// dashboard left open from re-fetching that on each poll. Serverless cold
// starts reset it, which just means the next request pays the real fetch —
// never a problem, since the value is always re-derived from Calendly, never
// invented while cold.
let cached: { at: number; data: CalendlySummary } | null = null;
const CACHE_MS = 3 * 60 * 1000;

export async function GET() {
  const caller = await resolveCaller();
  if (!caller || !isAdminRole(caller.role)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isCalendlyConfigured()) {
    return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 200 });
  }

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ data: cached.data, cached: true });
  }

  try {
    const data = await fetchCalendlySummary();
    cached = { at: Date.now(), data };
    return NextResponse.json({ data, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[calendly summary] failed', message);
    return NextResponse.json({ error: 'FETCH_FAILED', message }, { status: 502 });
  }
}
