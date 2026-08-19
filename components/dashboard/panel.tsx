'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT, MOTION_MS } from '@/components/charts/chart-kit';
import { cn } from '@/lib/utils';

/**
 * The non-chart sibling of `ChartFrame`: same surface, radius, shadow, header
 * rhythm and one-shot entrance, so a panel and a chart card sit on the same
 * grid without looking like two different products.
 */
export function Panel({
  title,
  subtitle,
  icon,
  footnote,
  children,
  className,
  index = 0,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Small print under a rule — how a number was derived, usually. */
  footnote?: string;
  children: React.ReactNode;
  className?: string;
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
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mt-4 flex-1">{children}</div>

      {footnote ? (
        <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-subtle">
          {footnote}
        </p>
      ) : null}
    </motion.section>
  );
}

/** A labelled bar row — the shape every distribution in the portfolio uses. */
export function MeterRow({
  label,
  value,
  pct,
  labelWidth = 'w-32 sm:w-36',
  tone = 'accent',
}: {
  label: string;
  value: string;
  pct: number;
  labelWidth?: string;
  tone?: 'accent' | 'success' | 'warning';
}) {
  const fill =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warning'
        ? 'bg-warning'
        : 'bg-accent';

  return (
    <div className="flex items-center gap-3">
      <p className={cn('shrink-0 truncate text-xs text-ink-muted', labelWidth)}>{label}</p>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn('h-full rounded-full', fill)}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="tnum w-16 shrink-0 text-end text-xs font-semibold text-ink">{value}</span>
    </div>
  );
}
