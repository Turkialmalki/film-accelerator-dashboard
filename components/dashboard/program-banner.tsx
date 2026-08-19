'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarClock, Flag, MapPin, Users } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { EASE_OUT, MOTION_MS } from '@/components/charts/chart-kit';
import { useCountUp } from '@/lib/hooks/use-count-up';
import type { Cohort, Organization } from '@/lib/data/types';

const CAMPAIGN_IMAGE = process.env.NEXT_PUBLIC_CAMPAIGN_IMAGE || '/brand/campaign-fba.jpg';
const WEEK_MS = 7 * 86400000;

/**
 * The real programme structure, from the Film Commission's own page
 * (film.moc.gov.sa/Initiatives/Film_Accelerator): a three-day training
 * bootcamp closing with a pitch to the evaluation committee, then a sixteen-
 * week accelerator phase. Nothing here is inferred beyond those two durations.
 */
const BOOTCAMP_DAYS = 3;

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

  // The bootcamp is the programme's first three days; everything after it is
  // the accelerator phase. Derived from the cohort's own start date, so it is
  // a real read of the data rather than a hard-coded label.
  const inBootcamp = now >= start && now < start + BOOTCAMP_DAYS * 86400000;

  return {
    ratio,
    week,
    totalWeeks,
    started: now >= start,
    finished: now >= end,
    phase: (now < start ? 'pending' : inBootcamp ? 'bootcamp' : 'accelerator') as
      | 'pending'
      | 'bootcamp'
      | 'accelerator',
  };
}

/** The cohort's average readiness, counted up once. */
function ReadinessDial({ value }: { value: number }) {
  const { t, fmtNumber } = useI18n();
  const reduced = useReducedMotion();
  const animated = useCountUp(value);
  const shown = Math.round(animated);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative grid size-[68px] shrink-0 place-items-center sm:size-20">
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(#FBAE40 0deg, #FBAE40 ${shown * 3.6}deg, rgba(255,255,255,0.16) ${shown * 3.6}deg)`,
          }}
          initial={reduced ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: MOTION_MS.slow / 1000, ease: EASE_OUT }}
        />
        <div className="absolute inset-[5px] rounded-full bg-[#0F2837]" />
        <span className="tnum relative text-base font-semibold text-white sm:text-lg">
          {fmtNumber(shown)}%
        </span>
      </div>
      <span className="text-[11px] text-white/60">{t.dashboard.bannerReadinessLabel}</span>
      <span className="sr-only">
        {t.dashboard.bannerReadinessLabel}: {value}%
      </span>
    </div>
  );
}

export function ProgramBanner({
  organization,
  cohort,
  avgReadiness,
  totalCompanies,
}: {
  organization: Organization | null;
  cohort: Cohort | null;
  avgReadiness: number;
  totalCompanies: number;
}) {
  const { t, b, fmtDate, fmtNumber, href, dir } = useI18n();
  const reduced = useReducedMotion();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const progress = cohortProgress(cohort);
  const ref = useRef<HTMLElement>(null);

  // Framer Motion's `useReducedMotion` resolves after mount, so the parallax
  // hooks have to be called unconditionally and neutralised instead.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const rawParallax = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);
  const parallaxY = useSpring(rawParallax, { stiffness: 90, damping: 24, mass: 0.4 });

  // The slow ken-burns drift is a keyframe animation; only start it once the
  // component knows the user has not asked for reduced motion.
  const [drift, setDrift] = useState(false);
  useEffect(() => {
    if (!reduced) setDrift(true);
  }, [reduced]);

  const statusTone =
    cohort?.status === 'active' ? 'success' : cohort?.status === 'completed' ? 'info' : 'neutral';

  const rise = (delay: number) => ({
    initial: reduced ? false : ({ opacity: 0, y: 10 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: MOTION_MS.slow / 1000, delay: reduced ? 0 : delay, ease: EASE_OUT },
  });

  const phaseTitle =
    progress?.phase === 'bootcamp'
      ? t.dashboard.bannerPhaseBootcamp
      : t.dashboard.bannerPhaseAccelerator;
  const phaseDetail =
    progress?.phase === 'bootcamp'
      ? t.dashboard.bannerPhaseBootcampDetail
      : t.dashboard.bannerPhaseAcceleratorDetail;

  return (
    <motion.section
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION_MS.slow / 1000, ease: EASE_OUT }}
      className="relative isolate overflow-hidden rounded-xl border border-line shadow-card"
      style={{ background: 'linear-gradient(135deg, #0F2837 0%, #16394C 58%, #0B1A24 100%)' }}
    >
      {/* Parallax layer: the photograph lags the page as it scrolls, and drifts
          on a very slow scale of its own. Both are inert under reduced motion —
          the spring sits at 0% and the keyframes never start. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-[8%] -z-10 h-[124%]"
        style={reduced ? undefined : { y: parallaxY }}
      >
        <motion.div
          className="absolute inset-0"
          animate={drift ? { scale: [1.04, 1.12, 1.04] } : { scale: 1.04 }}
          transition={
            drift ? { duration: 42, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }
          }
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
            className="object-cover object-[50%_14%] opacity-[0.28] blur-[1.5px]"
          />
        </motion.div>
      </motion.div>

      {/* Two controlled, static overlays: a direction-aware scrim that keeps the
          headline legible over any part of the photograph, and one warm wash
          from the brand amber. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(to ${dir === 'rtl' ? 'left' : 'right'}, rgba(11,26,36,0.95) 0%, rgba(11,26,36,0.80) 45%, rgba(11,26,36,0.44) 100%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(65% 130% at ${dir === 'rtl' ? 85 : 15}% 115%, rgba(251,174,64,0.26) 0%, rgba(251,174,64,0) 62%)`,
        }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-6 p-6 sm:p-8">
        <div className="min-w-0 max-w-2xl">
          <motion.p
            {...rise(0.04)}
            className="text-xs font-medium uppercase tracking-wider text-white/60"
          >
            {t.dashboard.bannerEyebrow}
          </motion.p>
          <motion.h2 {...rise(0.09)} className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            {b(organization?.name) || t.brand.name}
          </motion.h2>

          {/* The programme's own mission statement, quoted from its public page. */}
          <motion.p {...rise(0.13)} className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">
            {t.dashboard.bannerMission}
          </motion.p>

          <motion.div {...rise(0.17)} className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-white/75">{b(cohort?.name)}</span>
            <Badge tone={statusTone} className="border-white/15 bg-white/10 text-white">
              {cohort?.status === 'active' ? t.common.active : cohort?.status}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
              <Users className="size-3.5" aria-hidden />
              {t.portfolio.kpiCompanies} · {fmtNumber(totalCompanies)}
            </span>
          </motion.div>

          <motion.div {...rise(0.21)} className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            {progress ? (
              <div className="flex items-start gap-2.5">
                <Flag className="mt-0.5 size-4 shrink-0 text-[#FBAE40]" aria-hidden />
                <div>
                  <p className="text-xs text-white/55">{t.dashboard.bannerPhaseLabel}</p>
                  <p className="text-sm font-medium text-white">{phaseTitle}</p>
                  <p className="mt-0.5 max-w-xs text-xs leading-relaxed text-white/55">
                    {phaseDetail}
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex items-start gap-2.5">
              <Flag className="mt-0.5 size-4 shrink-0 text-white/45" aria-hidden />
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

          <motion.p
            {...rise(0.25)}
            className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/55"
          >
            <MapPin className="size-3.5" aria-hidden />
            <span>{t.dashboard.bannerFormat}</span>
            <span aria-hidden>·</span>
            <span>{t.dashboard.bannerInvestorAccess}</span>
          </motion.p>
        </div>

        <motion.div {...rise(0.29)} className="flex items-center gap-5">
          <ReadinessDial value={avgReadiness} />
          <Link
            href={href('/teams')}
            className="inline-flex items-center gap-2 rounded-md bg-[#FBAE40] px-4 py-2.5 text-sm font-semibold text-[#0F2837] transition-colors duration-200 hover:bg-[#F89C49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2837] motion-reduce:transition-none"
          >
            {t.dashboard.bannerCta}
            <Arrow className="size-4" aria-hidden />
          </Link>
        </motion.div>
      </div>

      {/* The progress indicator is the banner's quietest element on purpose. */}
      {progress ? (
        <motion.div {...rise(0.33)} className="relative px-6 pb-5 sm:px-8 sm:pb-6">
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
              transition={{
                duration: MOTION_MS.slow / 1000,
                delay: reduced ? 0 : 0.38,
                ease: EASE_OUT,
              }}
            />
          </div>
        </motion.div>
      ) : null}
    </motion.section>
  );
}
