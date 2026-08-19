'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Calendar, Flag, MapPin } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { useCountUp } from '@/lib/hooks/use-count-up';
import type { Cohort, Organization } from '@/lib/data/types';

function ReadinessBadge({ value }: { value: number }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const animated = useCountUp(value);
  const shown = Math.round(animated);

  return (
    <div className="relative grid size-16 shrink-0 place-items-center sm:size-20">
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#FBAE40 0deg, #FBAE40 ${shown * 3.6}deg, rgba(255,255,255,0.14) ${shown * 3.6}deg)`,
        }}
        initial={reduced ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 0.68, 0.28, 1] }}
      />
      <div className="absolute inset-1.5 rounded-full bg-[#0F2837]" />
      <div className="relative flex flex-col items-center">
        <span className="tnum text-base font-semibold text-white sm:text-lg">{shown}%</span>
      </div>
      <span className="sr-only">
        {t.portfolio.kpiReadiness}: {value}%
      </span>
    </div>
  );
}

export function ProgramBanner({
  organization,
  cohort,
  avgReadiness,
}: {
  organization: Organization | null;
  cohort: Cohort | null;
  avgReadiness: number;
}) {
  const { t, b, fmtDate, href, dir } = useI18n();
  const reduced = useReducedMotion();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const statusTone =
    cohort?.status === 'active' ? 'success' : cohort?.status === 'completed' ? 'info' : 'neutral';

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 0.68, 0.28, 1] }}
      className="relative overflow-hidden rounded-xl border border-line shadow-card"
      style={{ background: 'linear-gradient(135deg, #0F2837 0%, #16394C 58%, #0B1A24 100%)' }}
    >
      {/* Slow warm sweep — the one piece of ambient motion in the product. */}
      {!reduced ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 120% at 20% 110%, rgba(251,174,64,0.30) 0%, rgba(251,174,64,0) 65%)',
          }}
          animate={{ opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 120% at 20% 110%, rgba(251,174,64,0.24) 0%, rgba(251,174,64,0) 65%)',
          }}
        />
      )}

      <div className="relative flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
        <motion.div
          className="min-w-0"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: reduced ? 0 : 0.08 }}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-white/55">
            {t.dashboard.bannerEyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            {b(organization?.name) || t.brand.name}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-white/75">{b(cohort?.name)}</span>
            <Badge tone={statusTone} className="border-white/15 bg-white/10 text-white">
              {cohort?.status === 'active' ? t.common.active : cohort?.status}
            </Badge>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-start gap-2.5">
              <Flag className="mt-0.5 size-4 shrink-0 text-[#FBAE40]" aria-hidden />
              <div>
                <p className="text-xs text-white/55">{t.dashboard.milestone}</p>
                <p className="text-sm font-medium text-white">{b(cohort?.current_milestone)}</p>
              </div>
            </div>
            {cohort?.next_milestone_at ? (
              <div>
                <p className="text-xs text-white/55">{t.dashboard.nextMilestone}</p>
                <p className="tnum text-sm font-medium text-white">
                  {fmtDate(cohort.next_milestone_at)}
                </p>
              </div>
            ) : null}
            <div className="flex items-start gap-2.5">
              <Calendar className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden />
              <p className="text-sm text-white/75">{t.dashboard.bannerDuration}</p>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden />
              <p className="text-sm text-white/75">{t.dashboard.bannerLocation}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="flex items-center gap-4"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: reduced ? 0 : 0.16 }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <ReadinessBadge value={avgReadiness} />
            <span className="text-[11px] text-white/55">{t.dashboard.bannerReadinessLabel}</span>
          </div>
          <Link
            href={href('/teams')}
            className="inline-flex items-center gap-2 rounded-md bg-[#FBAE40] px-4 py-2.5 text-sm font-semibold text-[#0F2837] transition-colors hover:bg-[#F89C49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2837]"
          >
            {t.dashboard.bannerCta}
            <Arrow className="size-4" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}
