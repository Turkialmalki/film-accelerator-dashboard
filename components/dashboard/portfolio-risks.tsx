'use client';

import { ShieldAlert, TrendingUp } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { MeterRow, Panel } from '@/components/dashboard/panel';
import type { RiskRow } from '@/lib/analytics';
import type { Team } from '@/lib/data/types';

function TeamList({ teams, tone }: { teams: Team[]; tone: 'success' | 'warning' }) {
  const { b, fmtNumber } = useI18n();
  return (
    <ul className="mt-2 space-y-1.5">
      {teams.map((team) => (
        <li key={team.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate text-ink">{b(team.name)}</span>
          <Badge tone={tone} className="shrink-0">
            {fmtNumber(team.readiness)}%
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function PortfolioRisksPanel({
  risks,
  investorReady,
  watchlist,
  index = 0,
}: {
  risks: RiskRow[];
  investorReady: Team[];
  watchlist: Team[];
  index?: number;
}) {
  const { t, tf, fmtNumber } = useI18n();
  const top = risks[0];

  return (
    <Panel
      index={index}
      icon={<ShieldAlert aria-hidden />}
      title={t.portfolio.risksTitle}
      subtitle={t.portfolio.risksSubtitle}
      footnote={t.portfolio.risksMethod}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="space-y-3">
            {risks.map((row) => (
              <MeterRow
                key={row.category}
                label={t.portfolio.riskLabels[row.category]}
                labelWidth="w-36 sm:w-48"
                value={`${fmtNumber(row.count)} · ${Math.round(row.pct)}%`}
                pct={row.pct}
                tone="warning"
              />
            ))}
          </div>
          {top ? (
            <p className="mt-4 text-xs text-ink-subtle">
              {tf(t.portfolio.risksInsight, {
                label: t.portfolio.riskLabels[top.category],
                count: fmtNumber(top.count),
                pct: Math.round(top.pct),
              })}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <TrendingUp className="size-3.5 text-success" aria-hidden />
              {t.portfolio.opportunitiesTitle}
            </p>
            <TeamList teams={investorReady} tone="success" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <ShieldAlert className="size-3.5 text-warning" aria-hidden />
              {t.portfolio.watchlistTitle}
            </p>
            <TeamList teams={watchlist} tone="warning" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
