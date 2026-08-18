'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
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
  CHART_COLORS,
  ChartFrame,
  ChartTooltipBox,
  LegendDots,
} from '@/components/charts/chart-kit';
import type { StageBar, StatusSlice, TrendPoint } from '@/lib/analytics';
import { EmptyState } from '@/components/ui/misc';

const STATUS_COLORS: Record<StatusSlice['key'], string> = {
  draft: 'var(--c-ink-subtle)',
  submitted: 'var(--c-accent)',
  reviewed: 'var(--c-success)',
};

export function StatusDonut({ data }: { data: StatusSlice[] }) {
  const { t, fmtNumber } = useI18n();
  const labels: Record<StatusSlice['key'], string> = {
    draft: t.dashboard.statusDraft,
    submitted: t.dashboard.statusSubmitted,
    reviewed: t.dashboard.statusReviewed,
  };
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const rows = data.filter((d) => d.value > 0);

  return (
    <ChartFrame title={t.dashboard.donutTitle} subtitle={t.dashboard.donutSubtitle} height={240}>
      {total === 0 ? (
        <EmptyState title={t.common.empty} className="h-full" />
      ) : (
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="key"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {rows.map((row) => (
                    <Cell key={row.key} fill={STATUS_COLORS[row.key]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipBox
                        rows={[
                          {
                            name: labels[payload[0].payload.key as StatusSlice['key']],
                            value: fmtNumber(Number(payload[0].value)),
                            color: STATUS_COLORS[payload[0].payload.key as StatusSlice['key']],
                          },
                        ]}
                      />
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-3">
            <LegendDots
              items={data.map((d) => ({
                label: labels[d.key],
                color: STATUS_COLORS[d.key],
                value: fmtNumber(d.value),
              }))}
            />
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

export function ResponseTrend({ data }: { data: TrendPoint[] }) {
  const { t, fmtNumber, fmtDate } = useI18n();

  return (
    <ChartFrame title={t.dashboard.trendTitle} subtitle={t.dashboard.trendSubtitle} height={240}>
      {data.length === 0 ? (
        <EmptyState title={t.common.empty} className="h-full" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
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
                  />
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--c-accent)"
              strokeWidth={2}
              fill="url(#trendFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

export function StageBars({ data }: { data: StageBar[] }) {
  const { t, fmtNumber } = useI18n();
  const rows = data.map((d) => ({ ...d, label: t.stages[d.stage] }));

  return (
    <ChartFrame title={t.dashboard.stageTitle} subtitle={t.dashboard.stageSubtitle} height={240}>
      {rows.length === 0 ? (
        <EmptyState title={t.common.empty} className="h-full" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ fill: 'var(--c-surface-muted)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipBox
                    label={String(payload[0].payload.label)}
                    rows={[
                      {
                        name: t.dashboard.teams,
                        value: fmtNumber(Number(payload[0].value)),
                        color: CHART_COLORS[0],
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--c-accent)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
