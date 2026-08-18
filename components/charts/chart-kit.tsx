'use client';

import { cn } from '@/lib/utils';

/**
 * Chart colours are CSS custom properties, not hex literals, so every chart
 * retints with the Appearance studio. SVG `fill`/`stroke` resolve var() natively.
 *
 * The categorical sequence is ordered by contrast against the surface, not by
 * hue, so the first two series are always the most legible pair.
 */
export const CHART_COLORS = [
  'var(--c-accent)',
  'var(--c-info)',
  'var(--c-success)',
  'var(--c-warning)',
  'var(--c-ink-muted)',
  'var(--c-danger)',
];

export const AXIS_COLOR = 'var(--c-ink-subtle)';
export const GRID_COLOR = 'var(--c-line)';

export function ChartFrame({
  title,
  subtitle,
  action,
  children,
  className,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <section className={cn('rounded-lg border border-line bg-surface p-5 shadow-card', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {/* Recharts computes geometry left-to-right; forcing LTR here keeps the
          axes from mirroring inside an RTL document. */}
      <div className="chart-ltr" style={{ height }}>
        {children}
      </div>
    </section>
  );
}

export function ChartTooltipBox({
  label,
  rows,
}: {
  label?: string;
  rows: { name: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lift">
      {label ? <p className="mb-1 font-medium text-ink">{label}</p> : null}
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-2 text-ink-muted">
          {row.color ? (
            <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
          ) : null}
          <span>{row.name}</span>
          <span className="tnum ms-auto font-medium text-ink">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

export function LegendDots({
  items,
}: {
  items: { label: string; color: string; value?: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
          {item.value ? <span className="tnum font-medium text-ink">{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}
