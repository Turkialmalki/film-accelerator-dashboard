'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, Users } from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useI18n } from '@/components/providers/locale-provider';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Badge } from '@/components/ui/badge';
import {
  KpiIconCalendarCheck,
  KpiIconCanceled,
  KpiIconClock,
  KpiIconPeople,
  KpiIconRescheduled,
} from '@/components/dashboard/kpi-icons';
import {
  CHART_COLORS,
  ChartEmpty,
  ChartFrame,
  ChartTooltipBox,
  EASE_OUT,
  LegendDots,
} from '@/components/charts/chart-kit';
import { useEntranceOnce } from '@/lib/hooks/use-entrance';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import type { BookedSession, CalendlySummary } from '@/lib/calendly/summary';
import { mergeBootcampIntoMentorship } from '@/lib/data/bootcamp-sessions';

type FetchState =
  | { status: 'loading' }
  | { status: 'not_configured' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CalendlySummary };

/**
 * Mentorship-session metrics, sourced live from Calendly — on-demand sync,
 * not a webhook (see app/api/calendly/summary/route.ts for why). This panel
 * never shows a number it didn't just get from that endpoint: not configured
 * and fetch-failed are distinct, visible states, not silently zero.
 */
export function CalendlyPanel() {
  const { t } = useI18n();
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/calendly/summary')
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: 'error', message: body?.message ?? `HTTP ${res.status}` });
        } else if (body.error === 'NOT_CONFIGURED') {
          setState({ status: 'not_configured' });
        } else {
          setState({ status: 'ready', data: body.data as CalendlySummary });
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[124px]" />
        ))}
      </div>
    );
  }

  if (state.status === 'not_configured') {
    return (
      <EmptyState
        icon={<CalendarClock aria-hidden />}
        title={t.calendly.notConfiguredTitle}
        body={t.calendly.notConfiguredBody}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        icon={<CalendarClock aria-hidden />}
        title={t.calendly.errorTitle}
        body={state.message}
      />
    );
  }

  const { data } = state;
  const totals = mergeBootcampIntoMentorship(data);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard index={0} icon={<KpiIconPeople />} label={t.calendly.kpiMentors} value={totals.mentors} />
        <KpiCard
          index={1}
          icon={<KpiIconCalendarCheck />}
          label={t.calendly.kpiSessionsCompleted}
          value={totals.sessionsCompleted}
        />
        <KpiCard
          index={2}
          icon={<KpiIconClock />}
          label={t.calendly.kpiHoursCompleted}
          value={totals.hoursCompleted}
        />
        <KpiCard
          index={3}
          icon={<KpiIconCanceled />}
          label={t.calendly.kpiSessionsCanceled}
          value={data.sessionsCanceled}
        />
        <KpiCard
          index={4}
          icon={<KpiIconRescheduled />}
          label={t.calendly.kpiSessionsRescheduled}
          value={data.sessionsRescheduled}
        />
      </div>
      <SessionsPerTopicDonut data={data.sessionsPerTopic} />
      <BookedSessionsTable sessions={data.bookedSessions} />
    </div>
  );
}

/**
 * The detail behind the KPI cards above: every individual booked session in
 * the window, mentor and mentee together, not just a count. Rows animate in
 * once, staggered, the same restrained "premium app" motion the rest of the
 * dashboard now uses — never replays on a hover or a re-render.
 */
function BookedSessionsTable({ sessions }: { sessions: BookedSession[] }) {
  const { t, fmtDateTime } = useI18n();
  const reduced = useReducedMotion();

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="overflow-hidden rounded-xl border border-line bg-surface shadow-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.calendly.bookedTitle}</h3>
          <p className="mt-0.5 text-xs text-ink-subtle">{t.calendly.bookedSubtitle}</p>
        </div>
        <Badge tone="accent">{t.calendly.rangeLabel}</Badge>
      </div>

      {sessions.length === 0 ? (
        <div className="p-6">
          <ChartEmpty icon={<CalendarClock aria-hidden />} title={t.calendly.bookedEmpty} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60 text-xs text-ink-subtle">
                <th className="px-5 py-2.5 text-start font-medium">{t.calendly.bookedMentor}</th>
                <th className="px-5 py-2.5 text-start font-medium">{t.calendly.bookedMentee}</th>
                <th className="px-5 py-2.5 text-start font-medium">{t.calendly.bookedTopic}</th>
                <th className="px-5 py-2.5 text-start font-medium">{t.calendly.bookedWhen}</th>
                <th className="px-5 py-2.5 text-start font-medium">{t.calendly.bookedStatus}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, i) => (
                <motion.tr
                  key={`${session.mentorName}-${session.startTime}-${i}`}
                  initial={reduced ? false : { opacity: 0, x: -6 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: reduced ? 0 : Math.min(i, 14) * 0.03, ease: EASE_OUT }}
                  className="border-b border-line/70 last:border-0 transition-colors hover:bg-surface-muted/50"
                >
                  <td className="px-5 py-3 font-medium text-ink">{session.mentorName}</td>
                  <td className="px-5 py-3 text-ink-muted">{session.menteeName}</td>
                  <td className="px-5 py-3 text-ink-muted">{session.topic}</td>
                  <td className="tnum px-5 py-3 text-ink-muted">{fmtDateTime(session.startTime)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={session.occurred ? 'success' : 'info'}>
                      {session.occurred ? t.calendly.bookedStatusDone : t.calendly.bookedStatusUpcoming}
                    </Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  );
}

/**
 * What mentees actually came in for, not who they sat with — grouped by the
 * Calendly event type's own name ("القانونية", "الاستثمار", ...).
 * Deliberately reads straight from the live Calendly summary, never the
 * bootcamp-merged totals: the bootcamp sheet has no topic recorded for any
 * of its sessions, so mixing it in here would mean showing a number this
 * chart cannot actually back up. Real, accurate Calendly data only.
 */
function SessionsPerTopicDonut({
  data,
}: {
  data: { name: string; sessions: number }[];
}) {
  const { t, fmtNumber } = useI18n();
  const { animate, duration } = useEntranceOnce();

  const rows = data.map((d, i) => ({ ...d, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const total = rows.reduce((sum, r) => sum + r.sessions, 0);

  return (
    <ChartFrame
      title={t.calendly.sessionsPerTopicTitle}
      subtitle={t.calendly.sessionsPerTopicSubtitle}
      height={280}
      summary={
        rows.length
          ? rows.map((r) => ({ label: r.name, value: fmtNumber(r.sessions) }))
          : undefined
      }
      footer={
        rows.length ? (
          <LegendDots
            items={rows.map((r) => ({
              label: r.name,
              color: r.color,
              value: fmtNumber(r.sessions),
            }))}
          />
        ) : null
      }
    >
      {rows.length === 0 ? (
        <ChartEmpty
          icon={<Users aria-hidden />}
          title={t.calendly.noSessions}
          body={t.calendly.noSessionsBody}
        />
      ) : (
        <div className="relative h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="sessions"
                nameKey="name"
                innerRadius="62%"
                outerRadius="94%"
                paddingAngle={rows.length > 1 ? 3 : 0}
                cornerRadius={6}
                strokeWidth={0}
                isAnimationActive={animate}
                animationDuration={duration}
                animationEasing="ease-out"
              >
                {rows.map((row) => (
                  <Cell key={row.name} fill={row.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <ChartTooltipBox
                      rows={[
                        {
                          name: String(payload[0].payload.name),
                          value: fmtNumber(Number(payload[0].payload.sessions)),
                          color: String(payload[0].payload.color),
                        },
                      ]}
                    />
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-2xl font-semibold leading-none text-ink">
              {fmtNumber(total)}
            </span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
              {t.calendly.calendlySessionsLabel}
            </span>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
