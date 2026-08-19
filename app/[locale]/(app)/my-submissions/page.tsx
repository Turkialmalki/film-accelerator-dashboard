'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Form, Repository, Submission } from '@/lib/data/types';

export default function MySubmissionsPage() {
  const { t, b, href, fmtDateTime } = useI18n();
  const { session } = useSession();
  const teamId = session?.team_id ?? null;

  const query = useCallback(
    async (repo: Repository) => ({
      forms: await repo.listForms(),
      submissions: teamId ? await repo.listSubmissionsForTeam(teamId) : [],
    }),
    [teamId],
  );
  const { data } = useRepoQuery(query, { forms: [] as Form[], submissions: [] as Submission[] });

  const rows = useMemo(
    () =>
      data.submissions
        .slice()
        .sort((a, c) =>
          (c.submitted_at ?? c.started_at).localeCompare(a.submitted_at ?? a.started_at),
        ),
    [data.submissions],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t.participant.submissionsTitle} subtitle={t.participant.submissionsSubtitle} />

      {rows.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t.participant.noSubmissions} />
      ) : (
        <div className="scroll-thin overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-subtle">
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.forms.title}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.common.status}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.results.submittedOn}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-semibold">
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((submission) => {
                const form = data.forms.find((f) => f.id === submission.form_id);
                return (
                  <tr key={submission.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {form ? b(form.title) : submission.form_id}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          submission.status === 'reviewed'
                            ? 'success'
                            : submission.status === 'submitted'
                              ? 'accent'
                              : 'warning'
                        }
                      >
                        {submission.status === 'reviewed'
                          ? t.results.reviewed
                          : submission.status === 'submitted'
                            ? t.dashboard.statusSubmitted
                            : t.common.draft}
                      </Badge>
                    </td>
                    <td className="tnum px-4 py-3 text-ink-muted">
                      {fmtDateTime(submission.submitted_at ?? submission.started_at)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {form ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={href(`/assigned-forms/${form.id}`)}>
                            {t.participant.viewSubmission}
                          </Link>
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
