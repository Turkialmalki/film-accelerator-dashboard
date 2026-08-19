'use client';

import { Suspense, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Progress } from '@/components/ui/misc';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Form, Repository, Submission, Team } from '@/lib/data/types';

function ParticipantOverview() {
  const { t, b, href, fmtDate, dir } = useI18n();
  const { session } = useSession();
  const params = useSearchParams();
  const denied = params.get('denied') === '1';
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const teamId = session?.team_id ?? null;

  const query = useCallback(
    async (repo: Repository) => ({
      forms: await repo.listAssignedForms(teamId),
      submissions: teamId ? await repo.listSubmissionsForTeam(teamId) : [],
      team: teamId ? await repo.getTeam(teamId) : null,
    }),
    [teamId],
  );
  const { data } = useRepoQuery(query, {
    forms: [] as Form[],
    submissions: [] as Submission[],
    team: null as Team | null,
  });

  const byForm = useMemo(
    () => new Map(data.submissions.map((s) => [s.form_id, s])),
    [data.submissions],
  );

  const open = data.forms.filter((form) => byForm.get(form.id)?.status !== 'submitted' && byForm.get(form.id)?.status !== 'reviewed');
  const submitted = data.submissions.filter((s) => s.status !== 'draft').length;
  const drafts = data.submissions.filter((s) => s.status === 'draft').length;

  const nextDue = data.forms
    .map((form) => form.settings.closes_at)
    .filter((date): date is string => Boolean(date))
    .sort()[0];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${t.participant.welcome}${session ? `، ${b(session.profile.full_name)}` : ''}`}
        subtitle={data.team ? b(data.team.name) : t.participant.overviewTitle}
      />

      {denied ? (
        <p
          role="alert"
          className="mb-5 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2.5 text-sm text-ink"
        >
          <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden />
          {t.errors.forbiddenBody}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon="FileText" label={t.participant.openForms} value={open.length} index={0} />
        <KpiCard icon="Inbox" label={t.participant.submitted} value={submitted} index={1} />
        <KpiCard icon="ClipboardCheck" label={t.participant.drafts} value={drafts} index={2} />
      </div>

      {data.team ? (
        <section className="mb-6 rounded-lg border border-line bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink">{b(data.team.name)}</h3>
              <p className="mt-0.5 text-sm text-ink-subtle">{b(data.team.track)}</p>
            </div>
            <Badge tone="accent">{t.stages[data.team.stage]}</Badge>
          </div>
          <div className="mt-4">
            <p className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="text-ink-subtle">{t.teams.readiness}</span>
              <span className="tnum font-medium text-ink">{data.team.readiness}%</span>
            </p>
            <Progress value={data.team.readiness} />
          </div>
          <Button variant="ghost" size="sm" className="mt-4" asChild>
            <Link href={href('/my-team')}>
              {t.participant.myTeamTitle}
              <Arrow className="size-3.5" aria-hidden />
            </Link>
          </Button>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">{t.participant.openForms}</h3>
          {nextDue ? (
            <p className="tnum text-xs text-ink-subtle">
              {t.participant.nextDue}: {fmtDate(nextDue)}
            </p>
          ) : null}
        </div>

        {open.length === 0 ? (
          <EmptyState title={t.participant.noOpenForms} />
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map((form) => {
              const submission = byForm.get(form.id);
              return (
                <li
                  key={form.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{b(form.title)}</p>
                    <p className="tnum text-xs text-ink-subtle">
                      {t.forms.closesAt}: {fmtDate(form.settings.closes_at)}
                    </p>
                  </div>
                  {submission?.status === 'draft' ? <Badge tone="warning">{t.common.draft}</Badge> : null}
                  <Button size="sm" variant={submission ? 'secondary' : 'primary'} asChild>
                    <Link href={href(`/assigned-forms/${form.id}`)}>
                      {submission?.status === 'draft' ? t.participant.continueForm : t.participant.startForm}
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * useSearchParams() opts the page out of static prerendering, so the body has
 * to sit behind a Suspense boundary for the production build to emit a shell.
 */
export default function ParticipantOverviewPage() {
  return (
    <Suspense>
      <ParticipantOverview />
    </Suspense>
  );
}
