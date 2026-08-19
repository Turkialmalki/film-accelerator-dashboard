'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Form, Repository, Submission } from '@/lib/data/types';

export default function AssignedFormsPage() {
  const { t, b, href, fmtDate } = useI18n();
  const { session } = useSession();
  const teamId = session?.team_id ?? null;

  const query = useCallback(
    async (repo: Repository) => ({
      forms: await repo.listAssignedForms(teamId),
      submissions: teamId ? await repo.listSubmissionsForTeam(teamId) : [],
    }),
    [teamId],
  );
  const { data } = useRepoQuery(query, { forms: [] as Form[], submissions: [] as Submission[] });

  const byForm = useMemo(
    () => new Map(data.submissions.map((s) => [s.form_id, s])),
    [data.submissions],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t.participant.assignedTitle} subtitle={t.participant.assignedSubtitle} />

      {data.forms.length === 0 ? (
        <EmptyState icon={<FileText />} title={t.participant.noOpenForms} />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.forms.map((form) => {
            const submission = byForm.get(form.id);
            const finished = submission?.status === 'submitted' || submission?.status === 'reviewed';
            return (
              <li
                key={form.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-5 shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-ink">{b(form.title)}</h3>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{b(form.description)}</p>
                  <p className="tnum mt-1 text-xs text-ink-subtle">
                    {t.forms.closesAt}: {fmtDate(form.settings.closes_at)}
                  </p>
                </div>

                <Badge
                  tone={
                    submission?.status === 'reviewed'
                      ? 'success'
                      : submission?.status === 'submitted'
                        ? 'accent'
                        : submission?.status === 'draft'
                          ? 'warning'
                          : 'neutral'
                  }
                >
                  {submission?.status === 'reviewed'
                    ? t.results.reviewed
                    : submission?.status === 'submitted'
                      ? t.dashboard.statusSubmitted
                      : submission?.status === 'draft'
                        ? t.common.draft
                        : t.results.notResponded}
                </Badge>

                <Button size="sm" variant={finished ? 'secondary' : 'primary'} asChild>
                  <Link href={href(`/assigned-forms/${form.id}`)}>
                    {finished
                      ? form.settings.allow_edit_after_submit
                        ? t.fill.editResponse
                        : t.participant.viewSubmission
                      : submission?.status === 'draft'
                        ? t.participant.continueForm
                        : t.participant.startForm}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
