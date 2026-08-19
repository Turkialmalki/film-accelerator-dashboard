'use client';

import { MapPin, Users } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { MeterRow, Panel } from '@/components/dashboard/panel';
import type { GeographyRow, TeamStructureSummary } from '@/lib/analytics';

export function GeographyTeamStructurePanel({
  geography,
  structure,
  totalCompanies,
  index = 0,
}: {
  geography: GeographyRow[];
  structure: TeamStructureSummary;
  totalCompanies: number;
  index?: number;
}) {
  const { t, tf, b, fmtNumber } = useI18n();

  const structureRows = [
    { label: t.portfolio.multiFounderLabel, value: structure.multiFounder, tone: 'success' as const },
    { label: t.portfolio.soloFounderLabel, value: structure.soloFounder, tone: 'accent' as const },
    { label: t.portfolio.keyPersonRiskLabel, value: structure.keyPersonRisk, tone: 'warning' as const },
  ];

  const top = geography[0];

  return (
    <Panel
      index={index}
      icon={<MapPin aria-hidden />}
      title={t.portfolio.geoTitle}
      subtitle={t.portfolio.geoSubtitle}
      footnote={t.portfolio.geoMultiRegionNote}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <MapPin className="size-3.5" aria-hidden />
            {t.portfolio.secondaryRegions}
          </p>
          {geography.map((row) => (
            <MeterRow
              key={row.region.ar}
              label={b(row.region)}
              labelWidth="w-20"
              value={`${fmtNumber(row.count)} · ${Math.round(row.pct)}%`}
              pct={row.pct}
            />
          ))}
        </div>

        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <Users className="size-3.5" aria-hidden />
            {t.dashboard.teams}
          </p>
          {structureRows.map((row) => (
            <MeterRow
              key={row.label}
              label={row.label}
              value={fmtNumber(row.value)}
              tone={row.tone}
              pct={totalCompanies ? (row.value / totalCompanies) * 100 : 0}
            />
          ))}
        </div>
      </div>

      {top ? (
        <p className="mt-5 text-xs text-ink-subtle">
          {tf(t.portfolio.geoInsight, { pct: Math.round(top.pct), region: b(top.region) })}
        </p>
      ) : null}
    </Panel>
  );
}
