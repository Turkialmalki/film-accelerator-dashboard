'use client';

import { useI18n } from '@/components/providers/locale-provider';
import { Icon } from '@/components/shell/icon';
import { Progress } from '@/components/ui/misc';
import type { GeographyRow, TeamStructureSummary } from '@/lib/analytics';

export function GeographyTeamStructurePanel({
  geography,
  structure,
  totalCompanies,
}: {
  geography: GeographyRow[];
  structure: TeamStructureSummary;
  totalCompanies: number;
}) {
  const { t, b, fmtNumber } = useI18n();

  const structureRows = [
    { label: t.portfolio.multiFounderLabel, value: structure.multiFounder },
    { label: t.portfolio.soloFounderLabel, value: structure.soloFounder },
    { label: t.portfolio.keyPersonRiskLabel, value: structure.keyPersonRisk },
  ];

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
      <h3 className="text-sm font-semibold text-ink">{t.portfolio.geoTitle}</h3>
      <p className="mt-0.5 text-xs text-ink-subtle">{t.portfolio.geoSubtitle}</p>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <Icon name="MapPin" className="size-3.5" />
            {t.portfolio.secondaryRegions}
          </p>
          {geography.map((row) => (
            <div key={row.region.ar} className="flex items-center gap-3">
              <p className="w-20 shrink-0 truncate text-xs text-ink-muted">{b(row.region)}</p>
              <Progress value={row.pct} className="h-1.5" />
              <span className="tnum w-14 shrink-0 text-end text-xs font-medium text-ink">
                {fmtNumber(row.count)} · {Math.round(row.pct)}%
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <Icon name="Users" className="size-3.5" />
            {t.dashboard.teams}
          </p>
          {structureRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <p className="w-32 shrink-0 truncate text-xs text-ink-muted sm:w-36">{row.label}</p>
              <Progress value={totalCompanies ? (row.value / totalCompanies) * 100 : 0} className="h-1.5" />
              <span className="tnum w-9 shrink-0 text-end text-xs font-medium text-ink">
                {fmtNumber(row.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-subtle">{t.portfolio.geoInsight}</p>
    </section>
  );
}
