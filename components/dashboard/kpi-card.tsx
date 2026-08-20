'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/components/providers/locale-provider';
import { useCountUp } from '@/lib/hooks/use-count-up';
import { Icon } from '@/components/shell/icon';
import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  hint,
  value,
  suffix,
  icon,
  index = 0,
  className,
}: {
  label: string;
  hint?: string;
  value: number;
  suffix?: string;
  /**
   * Either the name of a registered Lucide glyph — rendered in the original
   * flat accent chip, which is what `/overview` and `/results/[formId]` still
   * pass — or a ready-made icon node, which is what the dashboard's KPI cards
   * now pass (see `components/dashboard/kpi-icons.tsx`). A node draws its own
   * plate, so it is rendered without the chip.
   */
  icon: string | React.ReactNode;
  index?: number;
  className?: string;
}) {
  const { fmtNumber } = useI18n();
  const reduced = useReducedMotion();
  const animated = useCountUp(value);
  const shown = suffix === '%' ? Math.round(animated) : Math.round(animated);

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: reduced ? 0 : index * 0.05, ease: [0.22, 0.68, 0.28, 1] }}
      className={cn(
        // A softer, one-step-larger radius than the rest of the product's
        // cards (`rounded-xl` = `--r-base + 6px`, still theme-relative —
        // Sand & Ink's tighter corners and Midnight's rounder ones both
        // scale correctly) and the two elevation tokens already tuned
        // for this product (`shadow-card` at rest, `shadow-lift` on
        // hover) rather than a bespoke shadow, so it stays in the same
        // visual family as every other surface, just with more presence.
        'group relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-card',
        'transition-[transform,box-shadow,border-color] duration-300 ease-out',
        'hover:-translate-y-1 hover:border-line-strong hover:shadow-lift',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      {/* A near-invisible glass sheen along the top edge — present on every
          theme (kept to ~5% white regardless of light/dark surface, which
          reads as a highlight either way) rather than a bespoke per-theme
          value. This is the one purely decorative touch in the card; it
          never carries information, so it is safely `aria-hidden`. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/[0.06] to-transparent"
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {typeof icon === 'string' ? (
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110">
            <Icon name={icon} className="size-4" />
          </span>
        ) : (
          <span className="relative shrink-0 transition-transform duration-300 group-hover:scale-110">
            {/* Soft colour-matched glow, invisible at rest, that blooms in
                behind the icon on hover — the one bit of "premium app"
                theatre in this card, and it costs nothing when idle. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full bg-accent/25 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100"
            />
            {icon}
          </span>
        )}
      </div>
      <p className="tnum relative mt-3 text-3xl font-semibold tracking-tight text-ink">
        {fmtNumber(shown)}
        {suffix ? <span className="text-xl text-ink-muted">{suffix}</span> : null}
      </p>
      {hint ? <p className="relative mt-1 text-xs text-ink-subtle">{hint}</p> : null}
    </motion.article>
  );
}
