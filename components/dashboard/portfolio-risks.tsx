'use client';

import { useI18n } from '@/components/providers/locale-provider';
import { Icon } from '@/components/shell/icon';
import { Progress } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import type { RiskRow } from '@/lib/analytics';
import type { Team } from '@/lib/data/types';

export function PortfolioRisksPanel({
  risks,
  investorReady,
  watchlist,
}: {
  risks: RiskRow[];
  investorReady: Team[];
  watchlist: Team[];
}) {
  const { t, b, fmtNumber } = useI18n();

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-card lg:col-span-2">
      <h3 className="text-sm font-semibold text-ink">{t.portfolio.risksTitle}</h3>
      <p className="mt-0.5 text-xs text-ink-subtle">{t.portfolio.risksSubtitle}</p>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {risks.map((row) => (
            <div key={row.category} className="flex items-center gap-3">
              <p className="w-40 shrink-0 truncate text-xs text-ink-muted sm:w-48">
                {t.portfolio.riskLabels[row.category]}
              </p>
              <Progress value={row.pct} className="h-1.5" />
              <span className="tnum w-14 shrink-0 text-end text-xs font-medium text-ink">
                {fmtNumber(row.count)} · {Math.round(row.pct)}%
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <Icon name="TrendingUp" className="size-3.5 text-success" />
              {t.portfolio.opportunitiesTitle}
            </p>
            <ul className="mt-2 space-y-1.5">
              {investorReady.map((team) => (
                <li key={team.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{b(team.name)}</span>
                  <Badge tone="success">{team.readiness}%</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <Icon name="ShieldAlert" className="size-3.5 text-warning" />
              {t.portfolio.watchlistTitle}
            </p>
            <ul className="mt-2 space-y-1.5">
              {watchlist.map((team) => (
                <li key={team.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{b(team.name)}</span>
                  <Badge tone="warning">{team.readiness}%</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-subtle">{t.portfolio.risksInsight}</p>
    </section>
  );
}
