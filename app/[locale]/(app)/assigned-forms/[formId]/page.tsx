'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { getRepository } from '@/lib/data';
import type {
  AnswerValue,
  Form,
  FormField,
  FormRule,
  Submission,
  Team,
} from '@/lib/data/types';
import { FormFiller } from '@/components/forms/form-filler';

export default function AssignedFormPage() {
  const { t, b } = useI18n();
  const { session } = useSession();
  const params = useParams<{ formId: string }>();
  const formId = params.formId;
  const teamId = session?.team_id ?? null;

  const [state, setState] = useState<{
    form: Form | null;
    fields: FormField[];
    rules: FormRule[];
    teams: Team[];
    submission: Submission | null;
    answers: Record<string, AnswerValue>;
    loading: boolean;
  }>({
    form: null,
    fields: [],
    rules: [],
    teams: [],
    submission: null,
    answers: {},
    loading: true,
  });

  const load = useCallback(async () => {
    const repo = getRepository();
    const form = await repo.getForm(formId);
    if (!form) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const [fields, rules, teams, mine] = await Promise.all([
      repo.listFields(formId),
      repo.listRules(formId),
      repo.listTeams(),
      teamId ? repo.listSubmissionsForTeam(teamId) : Promise.resolve([]),
    ]);
    const submission = mine.find((s) => s.form_id === formId) ?? null;
    const answerRows = submission ? await repo.listAnswers(submission.id) : [];
    const answers: Record<string, AnswerValue> = {};
    answerRows.forEach((row) => {
      answers[row.field_id] = row.value;
    });
    setState({ form, fields, rules, teams, submission, answers, loading: false });
  }, [formId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink-subtle" aria-hidden />
        <span className="sr-only">{t.common.loading}</span>
      </div>
    );
  }

  if (!state.form) return <EmptyState title={t.fill.notFound} />;
  if (state.form.status === 'closed') {
    return <EmptyState title={t.fill.closedTitle} body={t.fill.closedBody} />;
  }

  const locked =
    (state.submission?.status === 'submitted' || state.submission?.status === 'reviewed') &&
    !state.form.settings.allow_edit_after_submit;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={b(state.form.title)} subtitle={b(state.form.description)} />

      <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
        {locked ? (
          <EmptyState title={t.fill.thanksTitle} body={b(state.form.settings.confirmation_message)} />
        ) : (
          <FormFiller
            key={state.submission?.id ?? 'new'}
            form={state.form}
            fields={state.fields}
            rules={state.rules}
            teams={state.teams}
            teamId={teamId}
            profileId={session?.profile.id ?? null}
            existing={state.submission}
            existingAnswers={state.answers}
            onSubmitted={() => void load()}
          />
        )}
      </div>
    </div>
  );
}
