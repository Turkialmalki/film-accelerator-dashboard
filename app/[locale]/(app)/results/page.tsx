'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Progress, Skeleton } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Form, Repository, Submission, Team } from '@/lib/data/types';
import { formStats } from '@/lib/analytics';

export default function ResultsOverviewPage() {
  const { t, b, fmtNumber, fmtDate, href, dir } = useI18n();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const query = useCallback(
    async (repo: Repository) => ({
      forms: await repo.listForms(),
      submissions: await repo.listSubmissions(),
      teams: await repo.listTeams(),
    }),
    [],
  );
  const { data, loading } = useRepoQuery(query, {
    forms: [] as Form[],
    submissions: [] as Submission[],
    teams: [] as Team[],
  });

  const published = useMemo(
    () => data.forms.filter((form) => form.status !== 'draft'),
    [data.forms],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t.results.title} subtitle={t.results.subtitle} />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : published.length === 0 ? (
        <EmptyState icon={<BarChart3 />} title={t.results.noPublished} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {published.map((form) => {
            const stats = formStats(form, data.submissions, data.teams);
            return (
              <Link
                key={form.id}
                href={href(`/results/${form.id}`)}
                className="group flex flex-col rounded-lg border border-line bg-surface p-5 shadow-card transition-all hover:border-accent hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-ink group-hover:text-accent">
                    {b(form.title)}
                  </h3>
                  <Badge tone={form.status === 'published' ? 'success' : 'warning'}>
                    {form.status === 'published' ? t.common.published : t.common.closed}
                  </Badge>
                </div>

                <p className="tnum mt-4 text-3xl font-semibold text-ink">
                  {fmtNumber(stats.submitted)}
                  <span className="ms-2 text-sm font-normal text-ink-subtle">
                    {t.results.responseCount}
                  </span>
                </p>

                <div className="mt-4">
                  <p className="mb-1.5 flex items-baseline justify-between text-xs">
                    <span className="text-ink-subtle">{t.results.responseRate}</span>
                    <span className="tnum font-medium text-ink">
                      {fmtNumber(Math.round(stats.responseRate))}%
                    </span>
                  </p>
                  <Progress value={stats.responseRate} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
                  <div>
                    <dt className="text-ink-subtle">{t.results.lastResponse}</dt>
                    <dd className="tnum font-medium text-ink">{fmtDate(stats.lastResponseAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">{t.results.closesOn}</dt>
                    <dd className="tnum font-medium text-ink">{fmtDate(form.settings.closes_at)}</dd>
                  </div>
                </dl>

                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                  {t.results.analytics}
                  <Arrow className="size-3.5" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
