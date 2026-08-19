'use client';

import Link from 'next/link';
import { useI18n } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import type { ReadinessRankRow } from '@/lib/analytics';

export function ReadinessRankingCard({ rows }: { rows: ReadinessRankRow[] }) {
  const { t, b, href } = useI18n();

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
      <h3 className="text-sm font-semibold text-ink">{t.portfolio.rankingTitle}</h3>
      <p className="mt-0.5 text-xs text-ink-subtle">{t.portfolio.rankingSubtitle}</p>

      <ol className="mt-4 space-y-2.5">
        {rows.map((row, i) => (
          <li key={row.team.id}>
            <Link
              href={href('/teams')}
              className="flex items-center gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="tnum w-4 shrink-0 text-xs font-medium text-ink-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{b(row.team.name)}</span>
              <Badge tone="outline" className="shrink-0">
                {t.stages[row.team.stage]}
              </Badge>
              <span className="tnum w-10 shrink-0 text-end text-sm font-semibold text-ink">
                {row.readiness}%
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-subtle">{t.portfolio.rankingInsight}</p>
    </section>
  );
}
