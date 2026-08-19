'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Circle, Lightbulb, TriangleAlert } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { EASE_OUT, MOTION_MS } from '@/components/charts/chart-kit';
import { Panel } from '@/components/dashboard/panel';
import type { Finding, FindingTone } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const TONE_ICON: Record<FindingTone, typeof Circle> = {
  positive: ArrowUpRight,
  watch: TriangleAlert,
  neutral: Circle,
};

const TONE_CLASS: Record<FindingTone, string> = {
  positive: 'bg-[color:var(--c-success)]/10 text-success',
  watch: 'bg-[color:var(--c-warning)]/12 text-warning',
  neutral: 'bg-surface-muted text-ink-subtle',
};

/**
 * The narrative layer: one card per computed finding.
 *
 * Nothing here is authored prose with a number in it — `keyFindings()` derives
 * the values and this component only picks the sentence template and fills it,
 * so a finding cannot drift out of step with the roster it describes.
 */
export function KeyFindings({ findings, index = 0 }: { findings: Finding[]; index?: number }) {
  const { t, tf, b, fmtNumber } = useI18n();
  const reduced = useReducedMotion();

  if (!findings.length) return null;

  const copyFor = (f: Finding): { title: string; body: string } => {
    // Locale-aware values, resolved here rather than in the pure analytics layer.
    const values: Record<string, string | number> = Object.fromEntries(
      Object.entries(f.values).map(([k, v]) => [k, typeof v === 'number' ? fmtNumber(v) : v]),
    );
    if (f.region) values.region = b(f.region);
    if (f.stages) values.stages = f.stages.map((s) => t.stages[s]).join(' + ');

    switch (f.kind) {
      case 'revenue_active':
        return {
          title: tf(t.portfolio.findingRevenueActive, values),
          body: tf(t.portfolio.findingRevenueActiveBody, values),
        };
      case 'geo_concentration':
        return {
          title: tf(t.portfolio.findingGeoConcentration, values),
          body: tf(t.portfolio.findingGeoConcentrationBody, values),
        };
      case 'investor_ready':
        return {
          title: tf(t.portfolio.findingInvestorReady, values),
          body: tf(t.portfolio.findingInvestorReadyBody, values),
        };
      case 'key_person':
        return {
          title: tf(t.portfolio.findingKeyPerson, values),
          body: tf(t.portfolio.findingKeyPersonBody, values),
        };
      case 'stage_concentration':
        return {
          title: tf(t.portfolio.findingStageConcentration, values),
          body: tf(t.portfolio.findingStageConcentrationBody, values),
        };
      case 'readiness_spread':
        return {
          title: tf(t.portfolio.findingReadinessSpread, values),
          body: tf(t.portfolio.findingReadinessSpreadBody, values),
        };
    }
  };

  return (
    <Panel
      index={index}
      icon={<Lightbulb aria-hidden />}
      title={t.portfolio.findingsTitle}
      subtitle={t.portfolio.findingsSubtitle}
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {findings.map((finding, i) => {
          const { title, body } = copyFor(finding);
          const ToneIcon = TONE_ICON[finding.tone];
          return (
            <motion.li
              key={finding.kind}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: MOTION_MS.base / 1000,
                delay: reduced ? 0 : 0.05 + i * 0.045,
                ease: EASE_OUT,
              }}
              className="flex gap-3 rounded-md border border-line bg-surface-muted/40 p-3.5"
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  TONE_CLASS[finding.tone],
                )}
              >
                <ToneIcon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-ink">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-subtle">{body}</p>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </Panel>
  );
}
