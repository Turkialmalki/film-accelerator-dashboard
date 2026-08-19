'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { Icon } from '@/components/shell/icon';
import { EASE_OUT, MOTION_MS } from '@/components/charts/chart-kit';
import { MeterRow, Panel } from '@/components/dashboard/panel';
import { useCountUp } from '@/lib/hooks/use-count-up';
import type { PortfolioHealth } from '@/lib/analytics';

/**
 * A CSS conic gauge — one value does not need a chart library.
 *
 * The sweep counts up once through the same hook the KPI cards use, so a data
 * refresh snaps rather than replaying, and reduced motion goes straight to the
 * final angle.
 */
function HealthRing({ value }: { value: number }) {
  const { t, fmtNumber } = useI18n();
  const reduced = useReducedMotion();
  const animated = useCountUp(value);
  const shown = Math.round(animated);

  return (
    <div className="relative grid size-32 shrink-0 place-items-center">
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--c-accent) 0deg, var(--c-accent) ${shown * 3.6}deg, var(--c-surface-muted) ${shown * 3.6}deg)`,
        }}
        initial={reduced ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION_MS.slow / 1000, ease: EASE_OUT }}
      />
      <div className="absolute inset-[10px] rounded-full bg-surface shadow-card" />
      <div className="relative flex flex-col items-center">
        <span className="tnum text-3xl font-semibold leading-none text-ink">
          {fmtNumber(shown)}
        </span>
        <span className="mt-1 text-[11px] text-ink-subtle">/100</span>
      </div>
      <span className="sr-only">
        {t.portfolio.healthScore}: {value}/100
      </span>
    </div>
  );
}

export function PortfolioHealthPanel({
  health,
  directJobs,
  operatingRegions,
  mvpCount,
  avgTeamSize,
  index = 0,
}: {
  health: PortfolioHealth;
  directJobs: number;
  operatingRegions: number;
  mvpCount: number;
  avgTeamSize: number;
  index?: number;
}) {
  const { t, fmtNumber } = useI18n();

  const dimensions = [
    { label: t.portfolio.dimStageMaturity, value: health.stageMaturity },
    { label: t.portfolio.dimReadiness, value: health.readiness },
    { label: t.portfolio.dimRevenue, value: health.revenueGeneration },
    { label: t.portfolio.dimResilience, value: health.teamResilience },
  ];

  const secondary = [
    { icon: 'Briefcase', label: t.portfolio.secondaryJobs, value: fmtNumber(directJobs) },
    { icon: 'MapPin', label: t.portfolio.secondaryRegions, value: fmtNumber(operatingRegions) },
    { icon: 'Gauge', label: t.portfolio.secondaryMvp, value: fmtNumber(mvpCount) },
    { icon: 'Users', label: t.portfolio.secondaryTeamSize, value: fmtNumber(avgTeamSize) },
  ];

  return (
    <Panel
      index={index}
      icon={<Activity aria-hidden />}
      title={t.portfolio.healthTitle}
      subtitle={t.portfolio.healthSubtitle}
      footnote={t.portfolio.healthMethod}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <HealthRing value={health.score} />
        <div className="flex-1 space-y-3">
          {dimensions.map((d) => (
            <MeterRow
              key={d.label}
              label={d.label}
              value={fmtNumber(d.value)}
              pct={d.value}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-4">
        {secondary.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
              <Icon name={item.icon} className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="tnum text-sm font-semibold text-ink">{item.value}</p>
              <p className="truncate text-[11px] text-ink-subtle">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
