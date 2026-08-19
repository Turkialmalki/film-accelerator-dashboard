import {
  getCurrentUser,
  listEventTypes,
  listInvitees,
  listScheduledEvents,
  type CalendlyScheduledEvent,
} from './client';

export interface MentorSlice {
  name: string;
  sessions: number;
}

export interface CalendlySummary {
  mentors: number;
  sessionsCompleted: number;
  sessionsCanceled: number;
  sessionsRescheduled: number;
  hoursCompleted: number;
  sessionsPerMentor: MentorSlice[];
  eventTypesIncluded: number;
  fetchedAt: string;
}

/**
 * A rescheduled session is not a distinct event-level status in Calendly's
 * API — the original slot still comes back with status "canceled". What
 * distinguishes it from a real cancellation is the invitee: rescheduling
 * marks the original invitee `rescheduled: true` and links forward via
 * `new_invitee`, rather than just carrying a `cancellation` reason. Counting
 * by invitee, not by event, is what keeps "canceled" from double-counting
 * every reschedule as a lost session too.
 */
function classifyCanceledEvent(
  invitees: { rescheduled: boolean }[],
): 'rescheduled' | 'canceled' {
  return invitees.some((i) => i.rescheduled) ? 'rescheduled' : 'canceled';
}

function hostName(event: CalendlyScheduledEvent): string {
  return event.event_memberships[0]?.user_name || 'Unknown';
}

function durationHours(event: CalendlyScheduledEvent): number {
  const ms = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
  return Math.max(0, ms) / 3_600_000;
}

/**
 * Fetches and aggregates every scheduled event across every event type on
 * the organization's Calendly account. There is no per-organization invitee
 * list endpoint, so classifying a canceled event as a real cancellation vs a
 * reschedule costs one invitees call per canceled event — fine at this
 * program's scale (tens of sessions), not something to paginate around.
 */
export async function fetchCalendlySummary(): Promise<CalendlySummary> {
  const user = await getCurrentUser();
  const [eventTypes, events] = await Promise.all([
    listEventTypes(user.current_organization),
    listScheduledEvents(user.current_organization),
  ]);

  const canceled = events.filter((e) => e.status === 'canceled');
  const invitees = await Promise.all(canceled.map((e) => listInvitees(e.uri)));

  let sessionsCanceled = 0;
  let sessionsRescheduled = 0;
  canceled.forEach((_, i) => {
    if (classifyCanceledEvent(invitees[i]) === 'rescheduled') sessionsRescheduled += 1;
    else sessionsCanceled += 1;
  });

  const completed = events.filter((e) => e.status === 'active');
  const hoursCompleted = completed.reduce((sum, e) => sum + durationHours(e), 0);

  const perMentor = new Map<string, number>();
  events.forEach((e) => {
    const name = hostName(e);
    perMentor.set(name, (perMentor.get(name) ?? 0) + 1);
  });
  const sessionsPerMentor = Array.from(perMentor.entries())
    .map(([name, sessions]) => ({ name, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  return {
    mentors: perMentor.size,
    sessionsCompleted: completed.length,
    sessionsCanceled,
    sessionsRescheduled,
    hoursCompleted: Math.round(hoursCompleted * 10) / 10,
    sessionsPerMentor,
    eventTypesIncluded: eventTypes.length,
    fetchedAt: new Date().toISOString(),
  };
}
