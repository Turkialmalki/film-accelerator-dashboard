/**
 * Turns a computed `Finding` into its title/body text.
 *
 * Split out of `components/dashboard/portfolio-findings.tsx` so the export
 * feature can produce the exact same sentences the dashboard renders,
 * without a data-export module importing a 'use client' component file or
 * duplicating the template-selection switch a second time.
 */

import type { Finding } from '@/lib/analytics';
import type { Bilingual } from '@/lib/data/types';
import type { Dict } from '@/lib/i18n/dictionaries';

export function findingCopy(
  f: Finding,
  t: Dict,
  tf: (template: string, values: Record<string, string | number>) => string,
  b: (value: Bilingual | undefined | null) => string,
  fmtNumber: (value: number) => string,
): { title: string; body: string } {
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
}
