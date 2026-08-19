/**
 * Calendly REST API client. Server only — CALENDLY_API_TOKEN is a personal
 * access token with write scopes on the account (event_types:write,
 * organizations:write, webhooks:write, ...), so it must never reach a client
 * bundle. `import 'server-only'` makes that a build failure, not a review
 * habit, matching the same pattern as `lib/data/supabase-admin.ts`.
 *
 * This app only ever calls the read endpoints it actually uses below —
 * listing event types, scheduled events and their invitees — regardless of
 * what the token is scoped to do.
 */

import 'server-only';

const API_BASE = 'https://api.calendly.com';

export function isCalendlyConfigured(): boolean {
  return Boolean(process.env.CALENDLY_API_TOKEN);
}

function token(): string {
  const t = process.env.CALENDLY_API_TOKEN;
  if (!t) throw new Error('CALENDLY_API_TOKEN_MISSING');
  return t;
}

async function calendlyFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}` },
    // Aggregation is computed fresh per request (see the route's own cache);
    // Calendly's own data should never be served stale from fetch() itself.
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`CALENDLY_${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface CalendlyUser {
  uri: string;
  name: string;
  current_organization: string;
}

export async function getCurrentUser(): Promise<CalendlyUser> {
  const data = await calendlyFetch<{ resource: CalendlyUser }>(`${API_BASE}/users/me`);
  return data.resource;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  scheduling_url: string;
}

export async function listEventTypes(organizationUri: string): Promise<CalendlyEventType[]> {
  const out: CalendlyEventType[] = [];
  let url: string | null =
    `${API_BASE}/event_types?organization=${encodeURIComponent(organizationUri)}&count=100`;
  while (url) {
    const page: { collection: CalendlyEventType[]; pagination: { next_page: string | null } } =
      await calendlyFetch(url);
    out.push(...page.collection);
    url = page.pagination.next_page;
  }
  return out;
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: 'active' | 'canceled';
  start_time: string;
  end_time: string;
  event_type: string;
  event_memberships: { user: string; user_name: string; user_email: string }[];
  cancellation: { canceled_by: string; canceler_type: string; reason: string } | null;
}

export async function listScheduledEvents(
  organizationUri: string,
): Promise<CalendlyScheduledEvent[]> {
  const out: CalendlyScheduledEvent[] = [];
  let url: string | null =
    `${API_BASE}/scheduled_events?organization=${encodeURIComponent(organizationUri)}&count=100`;
  while (url) {
    const page: {
      collection: CalendlyScheduledEvent[];
      pagination: { next_page: string | null };
    } = await calendlyFetch(url);
    out.push(...page.collection);
    url = page.pagination.next_page;
  }
  return out;
}

export interface CalendlyInvitee {
  uri: string;
  status: 'active' | 'canceled';
  rescheduled: boolean;
  old_invitee: string | null;
  new_invitee: string | null;
  cancellation: { reason: string } | null;
}

export async function listInvitees(eventUri: string): Promise<CalendlyInvitee[]> {
  const out: CalendlyInvitee[] = [];
  let url: string | null = `${eventUri}/invitees?count=100`;
  while (url) {
    const page: { collection: CalendlyInvitee[]; pagination: { next_page: string | null } } =
      await calendlyFetch(url);
    out.push(...page.collection);
    url = page.pagination.next_page;
  }
  return out;
}
