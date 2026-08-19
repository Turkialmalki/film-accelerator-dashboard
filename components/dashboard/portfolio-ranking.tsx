'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/dashboard/panel';
import { INVESTOR_READY_THRESHOLD, WATCHLIST_THRESHOLD } from '@/lib/analytics';
import type { ReadinessRankRow } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** Same thresholds the dashboard's other panels use, so a green bar here means
 *  exactly what a green badge means anywhere else in the product. */
function toneFor(readiness: number) {
  if (readiness >= INVESTOR_READY_THRESHOLD) return 'bg-success';
  if (readiness < WATCHLIST_THRESHOLD) return 'bg-warning';
  return 'bg-accent';
}

export function ReadinessRankingCard({
  rows,
  investorReadyCount,
  index = 0,
}: {
  rows: ReadinessRankRow[];
  investorReadyCount: number;
  index?: number;
}) {
  const { t, tf, b, href, fmtNumber } = useI18n();

  return (
    <Panel
      index={index}
      icon={<Trophy aria-hidden />}
      title={t.portfolio.rankingTitle}
      subtitle={t.portfolio.rankingSubtitle}
    >
      <ol className="space-y-1">
        {rows.map((row, i) => (
          <li key={row.team.id}>
            <Link
              href={href('/teams')}
              className="flex items-center gap-3 rounded-md px-1.5 py-1.5 transition-colors duration-200 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
            >
              <span className="tnum w-4 shrink-0 text-xs font-semibold text-ink-subtle">
                {fmtNumber(i + 1)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{b(row.team.name)}</span>
              <span className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-muted sm:block">
                <span
                  className={cn('block h-full rounded-full', toneFor(row.readiness))}
                  style={{ width: `${row.readiness}%` }}
                />
              </span>
              <Badge tone="outline" className="hidden shrink-0 sm:inline-flex">
                {t.stages[row.team.stage]}
              </Badge>
              <span className="tnum w-10 shrink-0 text-end text-sm font-semibold text-ink">
                {fmtNumber(row.readiness)}%
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-subtle">
        {tf(t.portfolio.rankingInsight, {
          count: fmtNumber(investorReadyCount),
          threshold: INVESTOR_READY_THRESHOLD,
        })}
      </p>
    </Panel>
  );
}
