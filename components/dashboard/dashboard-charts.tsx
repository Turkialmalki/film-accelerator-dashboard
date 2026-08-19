'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CalendarRange, Inbox, Layers } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '@/components/providers/locale-provider';
import {
  AXIS_COLOR,
  ChartEmpty,
  ChartFrame,
  ChartTooltipBox,
  GRID_COLOR,
  LegendDots,
} from '@/components/charts/chart-kit';
import { useEntranceOnce } from '@/lib/hooks/use-entrance';
import { Button } from '@/components/ui/button';
import type { StageBar, StatusSlice, TrendPoint } from '@/lib/analytics';

const STATUS_COLORS: Record<StatusSlice['key'], string> = {
  draft: 'var(--c-ink-subtle)',
  submitted: 'var(--c-accent)',
  reviewed: 'var(--c-success)',
};

/** Rounds to a whole percent without ever reading 0% for a non-zero slice. */
function share(value: number, total: number): number {
  if (!total) return 0;
  const pct = (value / total) * 100;
  return pct > 0 && pct < 1 ? 1 : Math.round(pct);
}

/* ----------------------------------------------------------------- donut */

export function StatusDonut({ data, index = 0 }: { data: StatusSlice[]; index?: number }) {
  const { t, tf, fmtNumber, href } = useI18n();
  const { animate, duration } = useEntranceOnce();

  const labels: Record<StatusSlice['key'], string> = {
    draft: t.dashboard.statusDraft,
    submitted: t.dashboard.statusSubmitted,
    reviewed: t.dashboard.statusReviewed,
  };
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const rows = data.filter((d) => d.value > 0);

  const summary = data.map((d) => ({
    label: labels[d.key],
    value: `${fmtNumber(d.value)} (${share(d.value, total)}%)`,
  }));

  return (
    <ChartFrame
      index={index}
      title={t.dashboard.donutTitle}
      subtitle={t.dashboard.donutSubtitle}
      height={220}
      summary={total === 0 ? undefined : summary}
      footer={
        total === 0 ? null : (
          <LegendDots
            items={data.map((d) => ({
              label: labels[d.key],
              color: STATUS_COLORS[d.key],
              value: `${fmtNumber(d.value)} · ${share(d.value, total)}%`,
              muted: d.value === 0,
            }))}
          />
        )
      }
    >
      {total === 0 ? (
        <ChartEmpty
          icon={<Inbox aria-hidden />}
          title={t.dashboard.donutEmptyTitle}
          body={t.dashboard.donutEmptyBody}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href={href('/forms')}>{t.dashboard.emptyFormsCta}</Link>
            </Button>
          }
        />
      ) : (
        <div className="relative h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="key"
                innerRadius="64%"
                outerRadius="94%"
                paddingAngle={rows.length > 1 ? 3 : 0}
                cornerRadius={6}
                strokeWidth={0}
                isAnimationActive={animate}
                animationDuration={duration}
                animationEasing="ease-out"
              >
                {rows.map((row) => (
                  <Cell key={row.key} fill={STATUS_COLORS[row.key]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const key = payload[0].payload.key as StatusSlice['key'];
                  const value = Number(payload[0].value);
                  return (
                    <ChartTooltipBox
                      rows={[
                        { name: labels[key], value: fmtNumber(value), color: STATUS_COLORS[key] },
                      ]}
                      note={tf(t.dashboard.chartShareOfTotal, { pct: share(value, total) })}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* The hole is the most valuable space in a donut; the total goes in it. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-2xl font-semibold leading-none text-ink">
              {fmtNumber(total)}
            </span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
              {t.dashboard.chartTotal}
            </span>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------ trend area */

export function ResponseTrend({ data, index = 0 }: { data: TrendPoint[]; index?: number }) {
  const { t, tf, fmtNumber, fmtDate } = useI18n();
  const { animate, duration } = useEntranceOnce();

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const peak = useMemo(
    () => data.reduce<TrendPoint | null>((best, d) => (!best || d.value > best.value ? d : best), null),
    [data],
  );

  return (
    <ChartFrame
      index={index}
      title={t.dashboard.trendTitle}
      subtitle={t.dashboard.trendSubtitle}
      height={220}
      summary={
        data.length === 0
          ? undefined
          : data.map((d) => ({ label: fmtDate(d.iso), value: fmtNumber(d.value) }))
      }
      footer={
        data.length === 0 ? null : (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
            <span>
              {t.dashboard.responses}{' '}
              <span className="tnum font-semibold text-ink">{fmtNumber(total)}</span>
            </span>
            {peak && peak.value > 0 ? (
              <span>
                {t.dashboard.trendPeak}{' '}
                <span className="tnum font-semibold text-ink">{fmtDate(peak.iso)}</span>
              </span>
            ) : null}
          </p>
        )
      }
    >
      {data.length === 0 ? (
        <ChartEmpty
          icon={<CalendarRange aria-hidden />}
          title={t.dashboard.trendEmptyTitle}
          body={t.dashboard.trendEmptyBody}
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.34} />
                <stop offset="60%" stopColor="var(--c-accent)" stopOpacity={0.1} />
                <stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={12}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ stroke: 'var(--c-line-strong)', strokeDasharray: '3 4' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipBox
                    label={fmtDate(payload[0].payload.iso)}
                    rows={[
                      {
                        name: t.dashboard.responses,
                        value: fmtNumber(Number(payload[0].value)),
                        color: 'var(--c-accent)',
                      },
                    ]}
                    note={tf(t.dashboard.chartShareOfTotal, {
                      pct: share(Number(payload[0].value), total),
                    })}
                  />
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--c-accent)"
              strokeWidth={2.25}
              strokeLinecap="round"
              fill="url(#trendFill)"
              isAnimationActive={animate}
              animationDuration={duration}
              animationEasing="ease-out"
              activeDot={{
                r: 4.5,
                fill: 'var(--c-accent)',
                stroke: 'var(--c-surface)',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/* -------------------------------------------------------------- stage bars */

export function StageBars({ data, index = 0 }: { data: StageBar[]; index?: number }) {
  const { t, tf, fmtNumber, href } = useI18n();
  const { animate, duration } = useEntranceOnce();

  const rows = data.map((d) => ({ ...d, label: t.stages[d.stage] }));
  const total = rows.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartFrame
      index={index}
      title={t.dashboard.stageTitle}
      subtitle={t.dashboard.stageSubtitle}
      height={220}
      summary={
        rows.length === 0
          ? undefined
          : rows.map((d) => ({
              label: d.label,
              value: `${fmtNumber(d.value)} (${share(d.value, total)}%)`,
            }))
      }
      footer={
        rows.length === 0 ? null : (
          <p className="text-xs text-ink-subtle">
            {t.dashboard.teams}{' '}
            <span className="tnum font-semibold text-ink">{fmtNumber(total)}</span>
          </p>
        )
      }
    >
      {rows.length === 0 ? (
        <ChartEmpty
          icon={<Layers aria-hidden />}
          title={t.dashboard.stageEmptyTitle}
          body={t.dashboard.stageEmptyBody}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href={href('/teams')}>{t.dashboard.emptyTeamsCta}</Link>
            </Button>
          }
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 20, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="stageFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ fill: 'var(--c-surface-muted)', radius: 6 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipBox
                    label={String(payload[0].payload.label)}
                    rows={[
                      {
                        name: t.dashboard.teams,
                        value: fmtNumber(Number(payload[0].value)),
                        color: 'var(--c-accent)',
                      },
                    ]}
                    note={tf(t.dashboard.chartShareOfCohort, {
                      pct: share(Number(payload[0].value), total),
                    })}
                  />
                ) : null
              }
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 2, 2]}
              maxBarSize={46}
              fill="url(#stageFill)"
              isAnimationActive={animate}
              animationDuration={duration}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey="value"
                position="top"
                offset={8}
                className="tnum"
                fill="var(--c-ink-muted)"
                fontSize={11}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
