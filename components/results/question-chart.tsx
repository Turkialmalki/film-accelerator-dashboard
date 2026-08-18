'use client';

import { useState } from 'react';
import {
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
import { Paperclip, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/components/providers/locale-provider';
import { AXIS_COLOR, CHART_COLORS, ChartTooltipBox, LegendDots } from '@/components/charts/chart-kit';
import type { QuestionSummary } from '@/lib/analytics';
import { FIELD_TYPE_MAP } from '@/lib/forms/field-types';

/**
 * Picks the chart that suits the field type, rather than forcing every
 * question through one shape: donut for a small single-choice set, horizontal
 * bars once the option list grows, a 0–10 column chart plus segment split for
 * NPS, a step histogram for ratings, and a searchable list for free text.
 */
export function QuestionChart({ summary }: { summary: QuestionSummary }) {
  const { t, b, fmtNumber } = useI18n();
  const [search, setSearch] = useState('');
  const meta = FIELD_TYPE_MAP[summary.field.type];

  const header = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{b(summary.field.label)}</h3>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {b(meta.label)} · {fmtNumber(summary.answered)} {t.results.answered} ·{' '}
          {fmtNumber(summary.skipped)} {t.results.skipped}
        </p>
      </div>
    </div>
  );

  if (summary.kind === 'choice') {
    const rows = summary.buckets;
    const useDonut = rows.length <= 5;
    return (
      <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
        {header}
        <div className="chart-ltr h-56">
          {useDonut ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {rows.map((row, i) => (
                    <Cell key={row.value} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipBox
                        rows={[
                          {
                            name: String(payload[0].payload.label),
                            value: fmtNumber(Number(payload[0].value)),
                          },
                        ]}
                      />
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--c-surface-muted)' }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipBox
                        rows={[
                          {
                            name: String(payload[0].payload.label),
                            value: fmtNumber(Number(payload[0].value)),
                          },
                        ]}
                      />
                    ) : null
                  }
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="var(--c-accent)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {useDonut ? (
          <div className="mt-3">
            <LegendDots
              items={rows.map((row, i) => ({
                label: row.label,
                color: CHART_COLORS[i % CHART_COLORS.length],
                value: fmtNumber(row.count),
              }))}
            />
          </div>
        ) : null}
      </section>
    );
  }

  if (summary.kind === 'rating') {
    return (
      <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
        {header}
        <p className="tnum mb-3 text-2xl font-semibold text-ink">
          {summary.average.toFixed(1)}
          <span className="ms-1 text-sm font-normal text-ink-subtle">/ {summary.scale}</span>
          <span className="ms-2 text-xs font-normal text-ink-subtle">{t.results.average}</span>
        </p>
        <div className="chart-ltr h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.buckets} margin={{ left: -20, right: 6 }}>
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
                      rows={[
                        {
                          name: String(payload[0].payload.label),
                          value: fmtNumber(Number(payload[0].value)),
                        },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="var(--c-accent)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    );
  }

  if (summary.kind === 'nps') {
    return (
      <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
        {header}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <p className="tnum text-3xl font-semibold text-ink">{Math.round(summary.score)}</p>
          <LegendDots
            items={[
              {
                label: t.results.npsPromoters,
                color: 'var(--c-success)',
                value: fmtNumber(summary.promoters),
              },
              {
                label: t.results.npsPassives,
                color: 'var(--c-ink-subtle)',
                value: fmtNumber(summary.passives),
              },
              {
                label: t.results.npsDetractors,
                color: 'var(--c-danger)',
                value: fmtNumber(summary.detractors),
              },
            ]}
          />
        </div>
        <div className="chart-ltr h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.buckets} margin={{ left: -20, right: 6 }}>
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
                      rows={[
                        {
                          name: String(payload[0].payload.label),
                          value: fmtNumber(Number(payload[0].value)),
                        },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {summary.buckets.map((bucket) => (
                  <Cell
                    key={bucket.value}
                    fill={
                      Number(bucket.value) >= 9
                        ? 'var(--c-success)'
                        : Number(bucket.value) >= 7
                          ? 'var(--c-ink-subtle)'
                          : 'var(--c-danger)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    );
  }

  if (summary.kind === 'number') {
    return (
      <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
        {header}
        <dl className="grid grid-cols-3 gap-3">
          <Stat label={t.results.average} value={fmtNumber(Math.round(summary.average))} />
          <Stat label={t.forms.min} value={fmtNumber(summary.min)} />
          <Stat label={t.forms.max} value={fmtNumber(summary.max)} />
        </dl>
      </section>
    );
  }

  if (summary.kind === 'file') {
    return (
      <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
        {header}
        {summary.values.length === 0 ? (
          <p className="text-sm text-ink-subtle">{t.results.noResponses}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {summary.values.map((value, i) => (
              <li
                key={`${value.submissionId}-${i}`}
                className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink"
              >
                <Paperclip className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
                <span className="truncate">{value.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // text and other
  const values = summary.values.filter((value) =>
    search ? value.text.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
      {header}
      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-subtle ltr:left-3 rtl:right-3"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.results.searchResponses}
          aria-label={t.results.searchResponses}
          className="ltr:pl-9 rtl:pr-9"
        />
      </div>
      {values.length === 0 ? (
        <p className="text-sm text-ink-subtle">{t.results.noResponses}</p>
      ) : (
        <ul className="scroll-thin flex max-h-72 flex-col gap-2 overflow-y-auto">
          {values.map((value, i) => (
            <li
              key={`${value.submissionId}-${i}`}
              className="rounded-md border border-line bg-surface-muted/40 px-3 py-2 text-sm leading-relaxed text-ink"
            >
              {value.text}
            </li>
          ))}
        </ul>
      )}
      <Badge tone="neutral" className="mt-3">
        {fmtNumber(values.length)}
      </Badge>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line px-3 py-2.5">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="tnum text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}
