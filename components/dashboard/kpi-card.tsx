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
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduced ? 0 : index * 0.06, ease: [0.22, 0.68, 0.28, 1] }}
      className={cn('rounded-lg border border-line bg-surface p-5 shadow-card', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {typeof icon === 'string' ? (
          <span className="flex size-8 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Icon name={icon} className="size-4" />
          </span>
        ) : (
          icon
        )}
      </div>
      <p className="tnum mt-3 text-3xl font-semibold text-ink">
        {fmtNumber(shown)}
        {suffix ? <span className="text-xl text-ink-muted">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
    </motion.article>
  );
}
