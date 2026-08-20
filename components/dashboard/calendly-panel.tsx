'use client';

import { useEffect, useState } from 'react';
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
  LegendDots,
} from '@/components/charts/chart-kit';
import { useEntranceOnce } from '@/lib/hooks/use-entrance';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import type { CalendlySummary } from '@/lib/calendly/summary';

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard index={0} icon={<KpiIconPeople />} label={t.calendly.kpiMentors} value={data.mentors} />
        <KpiCard
          index={1}
          icon={<KpiIconCalendarCheck />}
          label={t.calendly.kpiSessionsCompleted}
          value={data.sessionsCompleted}
        />
        <KpiCard
          index={2}
          icon={<KpiIconClock />}
          label={t.calendly.kpiHoursCompleted}
          value={data.hoursCompleted}
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
      <SessionsPerMentorDonut data={data.sessionsPerMentor} />
    </div>
  );
}

function SessionsPerMentorDonut({
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
      title={t.calendly.sessionsPerMentorTitle}
      subtitle={t.calendly.sessionsPerMentorSubtitle}
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
              {t.calendly.kpiSessionsCompleted}
            </span>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
