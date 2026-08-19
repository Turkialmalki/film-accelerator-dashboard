'use client';

import { Layers, TrendingUp, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  ChartEmpty,
  ChartFrame,
  ChartTooltipBox,
  GRID_COLOR,
  LegendDots,
} from '@/components/charts/chart-kit';
import { useEntranceOnce } from '@/lib/hooks/use-entrance';
import type {
  RevenueDistributionRow,
  StageDistributionRow,
  StageReadinessRow,
} from '@/lib/analytics';

/**
 * The portfolio charts. Same frame, same tokens and the same one-shot entrance
 * as the operations charts — every colour resolves through a CSS custom
 * property, so these retint with the Appearance studio rather than carrying a
 * palette of their own.
 *
 * Every caption under a chart is computed from the rows on screen. A sentence
 * with a number baked into the dictionary quietly becomes a lie the first time
 * the roster changes.
 */

/* ------------------------------------------- investment-stage distribution */

export function StageDistributionDonut({
  data,
  index = 0,
}: {
  data: StageDistributionRow[];
  index?: number;
}) {
  const { t, tf, fmtNumber } = useI18n();
  const { animate, duration } = useEntranceOnce();

  const rows = data.map((d, i) => ({
    ...d,
    label: t.stages[d.stage],
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const topTwo = [...rows].sort((a, b) => b.count - a.count).slice(0, 2);

  return (
    <ChartFrame
      index={index}
      title={t.portfolio.stageDonutTitle}
      subtitle={t.portfolio.stageDonutSubtitle}
      height={200}
      summary={
        rows.length
          ? rows.map((r) => ({
              label: r.label,
              value: `${fmtNumber(r.count)} (${Math.round(r.pct)}%)`,
            }))
          : undefined
      }
      footer={
        rows.length ? (
          <>
            <LegendDots
              items={rows.map((r) => ({
                label: r.label,
                color: r.color,
                value: `${fmtNumber(r.count)} · ${Math.round(r.pct)}%`,
              }))}
            />
            {topTwo.length === 2 ? (
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-subtle">
                {tf(t.portfolio.stageDonutInsight, {
                  stages: topTwo.map((r) => r.label).join(' + '),
                  pct: Math.round(topTwo.reduce((s, r) => s + r.pct, 0)),
                })}
              </p>
            ) : null}
          </>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <ChartEmpty
          icon={<Layers aria-hidden />}
          title={t.portfolio.noTeams}
          body={t.portfolio.noTeamsBody}
        />
      ) : (
        <div className="relative h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="count"
                nameKey="label"
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
                          value: fmtNumber(Number(payload[0].payload.count)),
                          color: String(payload[0].payload.color),
                        },
                      ]}
                      note={tf(t.dashboard.chartShareOfCohort, {
                        pct: Math.round(Number(payload[0].payload.pct)),
                      })}
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
              {t.portfolio.kpiCompanies}
            </span>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

/* ----------------------------------------------- average readiness by stage */

export function ReadinessByStageChart({
  data,
  benchmark,
  index = 0,
}: {
  data: StageReadinessRow[];
  benchmark: number;
  index?: number;
}) {
  const { t, tf, fmtNumber } = useI18n();
  const { animate, duration } = useEntranceOnce();

  const rows = data.map((d) => ({ ...d, label: t.stages[d.stage] }));
  const sorted = [...rows].sort((a, b) => b.avgReadiness - a.avgReadiness);
  const top = sorted[0];
  const low = sorted[sorted.length - 1];

  return (
    <ChartFrame
      index={index}
      title={t.portfolio.readinessStageTitle}
      subtitle={t.portfolio.readinessStageSubtitle}
      height={200}
      summary={
        rows.length
          ? rows.map((r) => ({
              label: r.label,
              value: `${fmtNumber(r.avgReadiness)}% (${fmtNumber(r.count)})`,
            }))
          : undefined
      }
      footer={
        top && low && top !== low ? (
          <p className="text-xs text-ink-subtle">
            {tf(t.portfolio.readinessStageInsight, {
              topStage: top.label,
              topValue: top.avgReadiness,
              lowStage: low.label,
              lowValue: low.avgReadiness,
            })}
          </p>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <ChartEmpty
          icon={<TrendingUp aria-hidden />}
          title={t.portfolio.noTeams}
          body={t.portfolio.noTeamsBody}
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="readinessStageFill" x1="0" y1="0" x2="0" y2="1">
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
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <ReferenceLine
              y={benchmark}
              stroke="var(--c-ink-subtle)"
              strokeDasharray="4 4"
              label={{
                value: tf(t.portfolio.benchmarkLabel, { value: benchmark }),
                position: 'insideTopRight',
                fill: 'var(--c-ink-subtle)',
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ fill: 'var(--c-surface-muted)', radius: 6 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipBox
                    label={String(payload[0].payload.label)}
                    rows={[
                      {
                        name: t.portfolio.dimReadiness,
                        value: `${fmtNumber(Number(payload[0].value))}%`,
                        color: 'var(--c-accent)',
                      },
                      {
                        name: t.portfolio.kpiCompanies,
                        value: fmtNumber(Number(payload[0].payload.count)),
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Bar
              dataKey="avgReadiness"
              radius={[8, 8, 2, 2]}
              maxBarSize={46}
              fill="url(#readinessStageFill)"
              isAnimationActive={animate}
              animationDuration={duration}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/* --------------------------------------------------- revenue-band spread */

export function RevenueBandChart({
  data,
  minCumulativeSar,
  index = 0,
}: {
  data: RevenueDistributionRow[];
  minCumulativeSar: number;
  index?: number;
}) {
  const { t, tf, fmtNumber } = useI18n();
  const { animate, duration } = useEntranceOnce();

  const rows = data.map((d) => ({ ...d, label: t.portfolio.revenueBands[d.band] }));
  const anyData = rows.some((r) => r.count > 0);

  return (
    <ChartFrame
      index={index}
      title={t.portfolio.revenueTitle}
      subtitle={t.portfolio.revenueSubtitle}
      height={200}
      summary={
        anyData
          ? rows.map((r) => ({
              label: r.label,
              value: `${fmtNumber(r.count)} (${Math.round(r.pct)}%)`,
            }))
          : undefined
      }
      footer={
        anyData ? (
          <>
            <p className="text-xs text-ink-subtle">
              {tf(t.portfolio.revenueInsight, { value: fmtNumber(minCumulativeSar) })}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-subtle/80">
              {t.portfolio.minRevenueNote}
            </p>
          </>
        ) : null
      }
    >
      {!anyData ? (
        <ChartEmpty
          icon={<Wallet aria-hidden />}
          title={t.portfolio.noTeams}
          body={t.portfolio.noTeamsBody}
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--c-success)" stopOpacity={0.6} />
                <stop offset="100%" stopColor="var(--c-success)" stopOpacity={0.95} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 5" horizontal={false} />
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={104}
            />
            <Tooltip
              cursor={{ fill: 'var(--c-surface-muted)', radius: 6 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipBox
                    label={String(payload[0].payload.label)}
                    rows={[
                      {
                        name: t.portfolio.kpiCompanies,
                        value: fmtNumber(Number(payload[0].payload.count)),
                        color: 'var(--c-success)',
                      },
                    ]}
                    note={tf(t.dashboard.chartShareOfCohort, {
                      pct: Math.round(Number(payload[0].payload.pct)),
                    })}
                  />
                ) : null
              }
            />
            <Bar
              dataKey="count"
              radius={[0, 8, 8, 0]}
              maxBarSize={26}
              fill="url(#revenueFill)"
              isAnimationActive={animate}
              animationDuration={duration}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
