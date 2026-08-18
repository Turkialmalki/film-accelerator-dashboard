'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Flag } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import type { Cohort, Organization } from '@/lib/data/types';

export function ProgramBanner({
  organization,
  cohort,
}: {
  organization: Organization | null;
  cohort: Cohort | null;
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

      <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
        <div className="min-w-0">
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
          </div>
        </div>

        <Link
          href={href('/forms')}
          className="inline-flex items-center gap-2 rounded-md bg-[#FBAE40] px-4 py-2.5 text-sm font-semibold text-[#0F2837] transition-colors hover:bg-[#F89C49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2837]"
        >
          {t.dashboard.bannerCta}
          <Arrow className="size-4" aria-hidden />
        </Link>
      </div>
    </motion.section>
  );
}
