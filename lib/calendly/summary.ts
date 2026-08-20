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

/** One real, individually identifiable mentorship session — the detail
 * behind the aggregate counts, not another rollup. */
export interface BookedSession {
  mentorName: string;
  menteeName: string;
  /** The Calendly event type's own name (e.g. "القانونية") — what kind of
   * session this was, not a generic label. */
  topic: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'canceled';
  /** Whether `startTime` is already in the past at fetch time — the same
   * "active" Calendly status covers both an upcoming booking and a session
   * that already happened; this is the one bit of derived state that
   * actually answers "is this done yet". */
  occurred: boolean;
}

export interface CalendlySummary {
  mentors: number;
  sessionsCompleted: number;
  sessionsCanceled: number;
  sessionsRescheduled: number;
  hoursCompleted: number;
  sessionsPerMentor: MentorSlice[];
  /** Every booked session grouped by its real Calendly event-type name
   * (e.g. "القانونية", "الاستثمار") rather than who hosted it — what a
   * mentee actually came in for. Deliberately Calendly-only, never merged
   * with the bootcamp sheet: the sheet records who sat with whom, not what
   * kind of session it was, so folding it in here would mean inventing a
   * topic that was never recorded. */
  sessionsPerTopic: MentorSlice[];
  eventTypesIncluded: number;
  fetchedAt: string;
  /** The window every number above is actually scoped to. */
  rangeStart: string;
  rangeEnd: string;
  /** Every booked (non-canceled) session in the window, individually —
   * what the KPI cards summarize, laid out one row per real session. */
  bookedSessions: BookedSession[];
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

/**
 * Fetches and aggregates every scheduled event across every event type on
 * the organization's Calendly account, scoped to a fixed reporting window —
 * mentorship sessions from 12 Aug 2026 onward, the date the programme's
 * mentorship track actually started, through the moment this runs. There is
 * no per-organization invitee list endpoint, so getting each session's
 * mentee name (for the detail table) and classifying a canceled event as a
 * real cancellation vs a reschedule both cost one invitees call per event —
 * fine at this program's scale (dozens of sessions in the window), not
 * something to paginate around.
 */
/**
 * Internal test/integration events that live on the same Calendly account as
 * real mentor bookings but aren't sessions with anyone — e.g. "Fireflies ↔
 * Notion Transcript Test", booked and attended by the programme's own
 * account rather than a founder. Matched by name rather than an id list:
 * whoever runs these tools names the test event something recognisable,
 * and a fixed id would silently stop working the next time someone re-runs
 * a test under a fresh event.
 */
const NON_SESSION_EVENT_NAME_PATTERNS = [/fireflies/i, /transcript test/i];

function isRealMentorshipSession(eventName: string): boolean {
  return !NON_SESSION_EVENT_NAME_PATTERNS.some((pattern) => pattern.test(eventName));
}

export async function fetchCalendlySummary(): Promise<CalendlySummary> {
  const rangeStart = '2026-08-12T00:00:00.000Z';
  const rangeEnd = new Date().toISOString();

  const user = await getCurrentUser();
  const [eventTypes, rawEvents] = await Promise.all([
    listEventTypes(user.current_organization),
    listScheduledEvents(user.current_organization, { minStartTime: rangeStart, maxStartTime: rangeEnd }),
  ]);
  // Filtered before anything downstream ever sees it — not just kept out of
  // the per-topic chart, but out of every count that reads from this list:
  // sessions completed, hours, mentors, and the booked-sessions table too.
  const events = rawEvents.filter((e) => isRealMentorshipSession(e.name));

  // One invitees call per event: canceled events need it to tell a real
  // cancellation from a reschedule, active events need it for the mentee's
  // name in the detail table below.
  const inviteesByEvent = await Promise.all(events.map((e) => listInvitees(e.uri)));

  let sessionsCanceled = 0;
  let sessionsRescheduled = 0;
  const now = Date.now();
  const bookedSessions: BookedSession[] = [];

  events.forEach((event, i) => {
    const invitees = inviteesByEvent[i];
    if (event.status === 'canceled') {
      if (classifyCanceledEvent(invitees) === 'rescheduled') sessionsRescheduled += 1;
      else sessionsCanceled += 1;
      return;
    }
    const mentee = invitees.find((inv) => inv.status === 'active') ?? invitees[0];
    bookedSessions.push({
      mentorName: hostName(event),
      menteeName: mentee?.name || '—',
      topic: event.name,
      startTime: event.start_time,
      endTime: event.end_time,
      status: 'active',
      occurred: new Date(event.start_time).getTime() <= now,
    });
  });
  bookedSessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const completed = bookedSessions.filter((s) => s.occurred);
  const hoursCompleted = completed.reduce((sum, s) => {
    const ms = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
    return sum + Math.max(0, ms) / 3_600_000;
  }, 0);

  const perMentor = new Map<string, number>();
  bookedSessions.forEach((s) => {
    perMentor.set(s.mentorName, (perMentor.get(s.mentorName) ?? 0) + 1);
  });
  const sessionsPerMentor = Array.from(perMentor.entries())
    .map(([name, sessions]) => ({ name, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  const perTopic = new Map<string, number>();
  bookedSessions.forEach((s) => {
    perTopic.set(s.topic, (perTopic.get(s.topic) ?? 0) + 1);
  });
  const sessionsPerTopic = Array.from(perTopic.entries())
    .map(([name, sessions]) => ({ name, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  return {
    mentors: perMentor.size,
    sessionsCompleted: completed.length,
    sessionsCanceled,
    sessionsRescheduled,
    hoursCompleted: Math.round(hoursCompleted * 10) / 10,
    sessionsPerMentor,
    sessionsPerTopic,
    eventTypesIncluded: eventTypes.length,
    fetchedAt: new Date().toISOString(),
    rangeStart,
    rangeEnd,
    bookedSessions,
  };
}
