'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/components/providers/locale-provider';
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

/** The product's motion budget: nothing shorter than 160ms, nothing longer than 450ms. */
export const MOTION_MS = { fast: 160, base: 260, slow: 420 } as const;
export const EASE_OUT = [0.22, 0.68, 0.28, 1] as const;

/**
 * A chart card.
 *
 * Accessibility: the drawn SVG is `aria-hidden` — a Recharts tree announces as
 * a wall of unlabelled graphics — and the same numbers are exposed to assistive
 * technology as a real `<table>` in the `summary` prop. Screen-reader users get
 * the data, not a description of a picture.
 */
export function ChartFrame({
  title,
  subtitle,
  action,
  summary,
  footer,
  children,
  className,
  height = 260,
  index = 0,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** The chart's numbers, rendered as a screen-reader-only data table. */
  summary?: { label: string; value: string }[];
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  height?: number;
  index?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION_MS.slow / 1000,
        delay: reduced ? 0 : index * 0.06,
        ease: EASE_OUT,
      }}
      className={cn(
        'flex flex-col rounded-lg border border-line bg-surface p-5 shadow-card',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p> : null}
        </div>
        {action}
      </div>

      {summary?.length ? (
        <table className="sr-only">
          <caption>{title}</caption>
          <tbody>
            {summary.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {/* Recharts computes geometry left-to-right; forcing LTR here keeps the
          axes from mirroring inside an RTL document. */}
      <div className="chart-ltr" style={{ height }} aria-hidden={summary?.length ? true : undefined}>
        {children}
      </div>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </motion.section>
  );
}

export function ChartTooltipBox({
  label,
  rows,
  note,
}: {
  label?: string;
  rows: { name: string; value: string; color?: string }[];
  note?: string;
}) {
  const { dir } = useI18n();
  return (
    <div
      dir={dir}
      className="min-w-[9rem] rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lift"
    >
      {label ? <p className="mb-1.5 font-semibold text-ink">{label}</p> : null}
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-2 text-ink-muted">
          {row.color ? (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
          ) : null}
          <span className="truncate">{row.name}</span>
          <span className="tnum ms-auto font-semibold text-ink">{row.value}</span>
        </p>
      ))}
      {note ? <p className="mt-1.5 border-t border-line pt-1.5 text-ink-subtle">{note}</p> : null}
    </div>
  );
}

/**
 * A single flex-wrap line reads fine for three or four categories, but a
 * legend with a dozen-plus names (e.g. every topic across two languages)
 * wraps into a dense, hard-to-scan paragraph instead. A multi-column grid
 * was tried here first and made it worse, not better: fixed-width grid
 * tracks plus labels of wildly different lengths (a 3-character Arabic word
 * next to "Fireflies ↔ Notion Transcript Test") left some rows' numbers
 * lining up with completely different rows' labels. Each entry is its own
 * full-width row instead — the dot+label group pinned to one side and the
 * value pinned to the other, `justify-between` inside that one row and
 * nothing else — so alignment never depends on any other row's content.
 * `dir="auto"` on the label still lets it set its own direction from its
 * own text rather than inheriting the page's.
 */
export function LegendDots({
  items,
}: {
  items: { label: string; color: string; value?: string; muted?: boolean }[];
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item.label}
          className={cn(
            'flex items-center justify-between gap-3 text-xs text-ink-muted',
            item.muted && 'opacity-55',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span dir="auto" className="min-w-0 truncate" title={item.label}>
              {item.label}
            </span>
          </span>
          {item.value ? (
            <span className="tnum shrink-0 font-semibold text-ink">{item.value}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The empty state for a chart with genuinely no data.
 *
 * Zero submissions is the honest state of this programme right now, so this is
 * a first-class state with its own copy and a way forward — not a placeholder,
 * and never a reason to draw an invented series.
 */
export function ChartEmpty({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const { dir } = useI18n();
  return (
    <div
      dir={dir}
      className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-surface-muted/40 px-6 py-6 text-center"
    >
      {icon ? (
        <span className="flex size-9 items-center justify-center rounded-full bg-surface text-ink-subtle shadow-card [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="max-w-[34ch] text-xs leading-relaxed text-ink-subtle">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
