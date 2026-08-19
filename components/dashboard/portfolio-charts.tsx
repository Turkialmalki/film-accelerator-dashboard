'use client';

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
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
import { EmptyState } from '@/components/ui/misc';
import type { RevenueDistributionRow, StageDistributionRow, StageReadinessRow } from '@/lib/analytics';
import { fmtTemplate } from '@/lib/utils';

export function StageDistributionDonut({ data }: { data: StageDistributionRow[] }) {
  const { t, fmtNumber } = useI18n();
  const rows = data.map((d, i) => ({ ...d, label: t.stages[d.stage], color: CHART_COLORS[i % CHART_COLORS.length] }));

  return (
    <ChartFrame
      title={t.portfolio.stageDonutTitle}
      subtitle={t.portfolio.stageDonutSubtitle}
      height={220}
    >
      {rows.length === 0 ? (
        <EmptyState title={t.common.empty} className="h-full" />
      ) : (
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="60%"
                  outerRadius="92%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {rows.map((row) => (
                    <Cell key={row.stage} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipBox
                        rows={[
                          {
                            name: String(payload[0].payload.label),
                            value: `${fmtNumber(Number(payload[0].payload.count))} (${Math.round(payload[0].payload.pct)}%)`,
                            color: payload[0].payload.color,
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
              items={rows.map((r) => ({ label: r.label, color: r.color, value: `${fmtNumber(r.count)}` }))}
            />
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-subtle">{t.portfolio.stageDonutInsight}</p>
    </ChartFrame>
  );
}

export function ReadinessByStageChart({
  data,
  benchmark,
}: {
  data: StageReadinessRow[];
  benchmark: number;
}) {
  const { t, fmtNumber } = useI18n();
  const rows = data.map((d) => ({ ...d, label: t.stages[d.stage] }));

  return (
    <ChartFrame
      title={t.portfolio.readinessStageTitle}
      subtitle={t.portfolio.readinessStageSubtitle}
      height={220}
    >
      {rows.length === 0 ? (
        <EmptyState title={t.common.empty} className="h-full" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <ReferenceLine
              y={benchmark}
              stroke="var(--c-ink-subtle)"
              strokeDasharray="4 4"
              label={{
                value: fmtTemplate(t.portfolio.benchmarkLabel, { value: benchmark }),
                position: 'insideTopRight',
                fill: 'var(--c-ink-subtle)',
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ fill: 'var(--c-surface-muted)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipBox
                    label={String(payload[0].payload.label)}
                    rows={[
                      {
                        name: t.portfolio.dimReadiness,
                        value: `${fmtNumber(Number(payload[0].value))}%`,
                        color: CHART_COLORS[0],
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="avgReadiness" radius={[6, 6, 0, 0]} fill="var(--c-accent)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="mt-3 text-xs text-ink-subtle">{t.portfolio.readinessStageInsight}</p>
    </ChartFrame>
  );
}

export function RevenueBandChart({
  data,
  minCumulativeSar,
}: {
  data: RevenueDistributionRow[];
  minCumulativeSar: number;
}) {
  const { t, fmtNumber } = useI18n();
  const rows = data.map((d) => ({ ...d, label: t.portfolio.revenueBands[d.band] }));

  return (
    <ChartFrame title={t.portfolio.revenueTitle} subtitle={t.portfolio.revenueSubtitle} height={220}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={108}
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
                      value: `${fmtNumber(Number(payload[0].payload.count))} (${Math.round(payload[0].payload.pct)}%)`,
                      color: CHART_COLORS[2],
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="var(--c-success)" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-3 text-xs text-ink-subtle">
        {fmtTemplate(t.portfolio.revenueInsight, { value: fmtNumber(minCumulativeSar) })}
      </p>
    </ChartFrame>
  );
}
