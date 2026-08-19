'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarClock, Flag } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { EASE_OUT, MOTION_MS } from '@/components/charts/chart-kit';
import type { Cohort, Organization } from '@/lib/data/types';

const CAMPAIGN_IMAGE = process.env.NEXT_PUBLIC_CAMPAIGN_IMAGE || '/brand/campaign-fba.jpg';
const WEEK_MS = 7 * 86400000;

/** Where the cohort is between its own start and end dates. Never extrapolated. */
function cohortProgress(cohort: Cohort | null) {
  if (!cohort?.starts_on || !cohort?.ends_on) return null;
  const start = new Date(cohort.starts_on).getTime();
  const end = new Date(cohort.ends_on).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const now = Date.now();
  const totalWeeks = Math.max(1, Math.round((end - start) / WEEK_MS));
  const ratio = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const week = Math.min(totalWeeks, Math.max(0, Math.ceil((now - start) / WEEK_MS)));
  return { ratio, week, totalWeeks, started: now >= start, finished: now >= end };
}

export function ProgramBanner({
  organization,
  cohort,
}: {
  organization: Organization | null;
  cohort: Cohort | null;
}) {
  const { t, b, fmtDate, fmtNumber, href, dir } = useI18n();
  const reduced = useReducedMotion();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const progress = cohortProgress(cohort);

  const statusTone =
    cohort?.status === 'active' ? 'success' : cohort?.status === 'completed' ? 'info' : 'neutral';

  const rise = (delay: number) => ({
    initial: reduced ? false : ({ opacity: 0, y: 8 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: MOTION_MS.slow / 1000, delay: reduced ? 0 : delay, ease: EASE_OUT },
  });

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION_MS.slow / 1000, ease: EASE_OUT }}
      className="relative isolate overflow-hidden rounded-xl border border-line shadow-card"
      style={{ background: 'linear-gradient(135deg, #0F2837 0%, #16394C 58%, #0B1A24 100%)' }}
    >
      {/* The programme photograph, held well back behind the copy. It drifts
          rather than cuts — one very slow scale, no panning carousel. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        initial={false}
        animate={reduced ? { scale: 1.04 } : { scale: [1.04, 1.11, 1.04] }}
        transition={reduced ? { duration: 0 } : { duration: 38, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Image
          src={CAMPAIGN_IMAGE}
          alt=""
          fill
          sizes="100vw"
          priority
          // Cropped to the top of the frame — the camera rig, not the lockup
          // baked into the middle of the photograph, which would otherwise
          // ghost the banner's own headline. Softened so it reads as texture.
          className="object-cover object-[50%_14%] opacity-[0.26] blur-[1.5px]"
        />
      </motion.div>

      {/* Two controlled overlays, both static: a directional scrim that keeps the
          headline legible over any part of the photograph, and one warm wash
          picked up from the brand amber. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          // The copy sits on the inline-start edge, so the darkest end of the
          // scrim has to follow the document direction rather than sit on left.
          background: `linear-gradient(to ${dir === 'rtl' ? 'left' : 'right'}, rgba(11,26,36,0.94) 0%, rgba(11,26,36,0.78) 45%, rgba(11,26,36,0.42) 100%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(65% 130% at ${dir === 'rtl' ? 85 : 15}% 115%, rgba(251,174,64,0.26) 0%, rgba(251,174,64,0) 62%)`,
        }}
      />

      <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
        <div className="min-w-0">
          <motion.p
            {...rise(0.04)}
            className="text-xs font-medium uppercase tracking-wider text-white/60"
          >
            {t.dashboard.bannerEyebrow}
          </motion.p>
          <motion.h2 {...rise(0.09)} className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            {b(organization?.name) || t.brand.name}
          </motion.h2>
          <motion.div {...rise(0.13)} className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-white/75">{b(cohort?.name)}</span>
            <Badge tone={statusTone} className="border-white/15 bg-white/10 text-white">
              {cohort?.status === 'active' ? t.common.active : cohort?.status}
            </Badge>
          </motion.div>

          <motion.div {...rise(0.17)} className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-start gap-2.5">
              <Flag className="mt-0.5 size-4 shrink-0 text-[#FBAE40]" aria-hidden />
              <div>
                <p className="text-xs text-white/55">{t.dashboard.milestone}</p>
                <p className="text-sm font-medium text-white">{b(cohort?.current_milestone)}</p>
              </div>
            </div>
            {cohort?.next_milestone_at ? (
              <div className="flex items-start gap-2.5">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-white/45" aria-hidden />
                <div>
                  <p className="text-xs text-white/55">{t.dashboard.nextMilestone}</p>
                  <p className="tnum text-sm font-medium text-white">
                    {fmtDate(cohort.next_milestone_at)}
                  </p>
                </div>
              </div>
            ) : null}
          </motion.div>
        </div>

        <motion.div {...rise(0.21)}>
          <Link
            href={href('/forms')}
            className="inline-flex items-center gap-2 rounded-md bg-[#FBAE40] px-4 py-2.5 text-sm font-semibold text-[#0F2837] transition-colors hover:bg-[#F89C49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2837]"
          >
            {t.dashboard.bannerCta}
            <Arrow className="size-4" aria-hidden />
          </Link>
        </motion.div>
      </div>

      {/* The progress indicator is the banner's quietest element on purpose: a
          2px rule along the bottom edge, plus one line of plain text. */}
      {progress ? (
        <motion.div {...rise(0.25)} className="relative px-6 pb-5 sm:px-8 sm:pb-6">
          <div className="flex items-baseline justify-between gap-4 pb-2 text-xs text-white/55">
            <span>{t.dashboard.bannerProgress}</span>
            <span className="tnum text-white/80">
              {!progress.started
                ? t.dashboard.bannerNotStarted
                : progress.finished
                  ? t.dashboard.bannerComplete
                  : `${t.dashboard.bannerWeek} ${fmtNumber(progress.week)} ${t.common.of} ${fmtNumber(progress.totalWeeks)}`}
            </span>
          </div>
          <div
            className="h-[3px] w-full overflow-hidden rounded-full bg-white/12"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            aria-label={t.dashboard.bannerProgress}
          >
            <motion.div
              className="h-full rounded-full bg-[#FBAE40]"
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${progress.ratio * 100}%` }}
              transition={{ duration: MOTION_MS.slow / 1000, delay: reduced ? 0 : 0.3, ease: EASE_OUT }}
            />
          </div>
        </motion.div>
      ) : null}
    </motion.section>
  );
}
