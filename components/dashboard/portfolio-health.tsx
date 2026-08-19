'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/components/providers/locale-provider';
import { Icon } from '@/components/shell/icon';
import { Progress } from '@/components/ui/misc';
import type { PortfolioHealth } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** A CSS-only radial gauge — no chart library needed for a single value. */
function HealthRing({ value }: { value: number }) {
  const reduced = useReducedMotion();
  return (
    <div className="relative grid size-28 shrink-0 place-items-center">
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--c-accent) 0deg, var(--c-accent) ${value * 3.6}deg, var(--c-surface-muted) ${value * 3.6}deg)`,
        }}
        initial={reduced ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 0.68, 0.28, 1] }}
      />
      <div className="absolute inset-2 rounded-full bg-surface" />
      <div className="relative flex flex-col items-center">
        <span className="tnum text-2xl font-semibold text-ink">{value}</span>
        <span className="text-[11px] text-ink-subtle">/100</span>
      </div>
    </div>
  );
}

function DimensionRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <p className="w-32 shrink-0 text-xs font-medium text-ink-muted sm:w-36">{label}</p>
      <Progress value={value} className="h-1.5" />
      <span className="tnum w-9 shrink-0 text-end text-xs font-medium text-ink">{value}</span>
    </div>
  );
}

export function PortfolioHealthPanel({
  health,
  directJobs,
  operatingRegions,
  mvpCount,
  avgTeamSize,
}: {
  health: PortfolioHealth;
  directJobs: number;
  operatingRegions: number;
  mvpCount: number;
  avgTeamSize: number;
}) {
  const { t, fmtNumber } = useI18n();

  const secondary = [
    { icon: 'Briefcase', label: t.portfolio.secondaryJobs, value: fmtNumber(directJobs) },
    { icon: 'MapPin', label: t.portfolio.secondaryRegions, value: fmtNumber(operatingRegions) },
    { icon: 'Gauge', label: t.portfolio.secondaryMvp, value: fmtNumber(mvpCount) },
    { icon: 'Users', label: t.portfolio.secondaryTeamSize, value: avgTeamSize.toString() },
  ];

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.portfolio.healthTitle}</h3>
          <p className="mt-0.5 text-xs text-ink-subtle">{t.portfolio.healthSubtitle}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
        <HealthRing value={health.score} />
        <div className="flex-1 space-y-3">
          <DimensionRow label={t.portfolio.dimStageMaturity} value={health.stageMaturity} />
          <DimensionRow label={t.portfolio.dimReadiness} value={health.readiness} />
          <DimensionRow label={t.portfolio.dimRevenue} value={health.revenueGeneration} />
          <DimensionRow label={t.portfolio.dimResilience} value={health.teamResilience} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-4">
        {secondary.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent')}>
              <Icon name={item.icon} className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="tnum text-sm font-semibold text-ink">{item.value}</p>
              <p className="truncate text-[11px] text-ink-subtle">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
