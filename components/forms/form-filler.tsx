'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress, Separator } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { getRepository } from '@/lib/data';
import type {
  AnswerValue,
  Form,
  FormField,
  FormRule,
  Profile,
  Submission,
  Team,
} from '@/lib/data/types';
import { FieldInput } from './field-input';
import { isAnswerable } from '@/lib/forms/field-types';
import { hiddenFieldIds } from '@/lib/forms/rules';
import { validateAnswers } from '@/lib/forms/validate';

/**
 * The participant-facing fill experience. One implementation serves the public
 * share link, the participant workspace, and the builder preview — so what the
 * admin previews is literally the same component the cohort fills in.
 */
export function FormFiller({
  form,
  fields,
  rules,
  teams,
  profiles,
  teamId,
  profileId,
  existing,
  existingAnswers,
  previewOnly = false,
  onSubmitted,
}: {
  form: Form;
  fields: FormField[];
  rules: FormRule[];
  teams: Team[];
  profiles?: Profile[];
  teamId?: string | null;
  profileId?: string | null;
  existing?: Submission | null;
  existingAnswers?: Record<string, AnswerValue>;
  previewOnly?: boolean;
  onSubmitted?: (submission: Submission) => void;
}) {
  const { t, b, tf } = useI18n();

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(existingAnswers ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const submissionIdRef = useRef<string | undefined>(existing?.id);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (existingAnswers) setAnswers(existingAnswers);
  }, [existingAnswers]);

  const hidden = useMemo(() => hiddenFieldIds(fields, rules, answers), [fields, rules, answers]);
  const visible = useMemo(() => fields.filter((f) => !hidden.has(f.id)), [fields, hidden]);

  // A multi-step form pages on explicit page breaks; without breaks the whole
  // form is one page, which is what most short forms want.
  const pages = useMemo(() => {
    if (!form.settings.multi_step) return [visible];
    const result: FormField[][] = [[]];
    visible.forEach((field) => {
      if (field.type === 'page_break') {
        result.push([]);
        return;
      }
      result[result.length - 1].push(field);
    });
    return result.filter((page) => page.length > 0);
  }, [visible, form.settings.multi_step]);

  const answerable = visible.filter((f) => isAnswerable(f.type));
  const answeredCount = answerable.filter((f) => {
    const value = answers[f.id];
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }).length;
  const progress = answerable.length ? (answeredCount / answerable.length) * 100 : 0;

  /* --------------------------------------------------------------- autosave */

  const persistDraft = useCallback(async () => {
    if (previewOnly || !form.settings.allow_drafts || !dirtyRef.current) return;
    dirtyRef.current = false;
    const submission = await getRepository().saveDraft({
      form_id: form.id,
      team_id: teamId ?? null,
      profile_id: profileId ?? null,
      answers,
      submission_id: submissionIdRef.current,
    });
    submissionIdRef.current = submission.id;
    setDraftSavedAt(new Date().toISOString());
  }, [answers, form.id, form.settings.allow_drafts, previewOnly, teamId, profileId]);

  useEffect(() => {
    if (previewOnly || done) return;
    const handle = setTimeout(() => void persistDraft(), 1200);
    return () => clearTimeout(handle);
  }, [answers, persistDraft, previewOnly, done]);

  /* ------------------------------------------------------------------ done */

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-16 text-center shadow-card">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <h2 className="text-xl font-semibold text-ink">{t.fill.thanksTitle}</h2>
        <p className="max-w-md text-sm text-ink-muted">{b(form.settings.confirmation_message)}</p>
      </div>
    );
  }

  const page = pages[Math.min(step, pages.length - 1)] ?? [];
  const isLast = step >= pages.length - 1;

  function setAnswer(fieldId: string, value: AnswerValue) {
    dirtyRef.current = true;
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function validateCurrentPage(): boolean {
    const pageErrors = validateAnswers(page, answers, hidden, t);
    setErrors(pageErrors);
    return Object.keys(pageErrors).length === 0;
  }

  async function submit() {
    const all = validateAnswers(visible, answers, hidden, t);
    setErrors(all);
    if (Object.keys(all).length) {
      // Jump to the first page that carries an error so the message is visible.
      const firstBadId = Object.keys(all)[0];
      const pageIndex = pages.findIndex((p) => p.some((f) => f.id === firstBadId));
      if (pageIndex >= 0) setStep(pageIndex);
      return;
    }
    if (previewOnly) {
      setDone(true);
      return;
    }
    setSubmitting(true);
    const submission = await getRepository().submitResponse({
      form_id: form.id,
      team_id: teamId ?? null,
      profile_id: profileId ?? null,
      answers,
      submission_id: submissionIdRef.current,
    });
    setSubmitting(false);
    setDone(true);
    onSubmitted?.(submission);

    // Best-effort admin notification — the submission above already
    // succeeded and is real, committed data; this can never block or fail
    // the thing the participant actually came here to do.
    fetch('/api/notifications/form-submitted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formId: form.id, teamId: teamId ?? null }),
    }).catch(() => {});
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-xs text-ink-subtle">
          <span>
            {form.settings.multi_step && pages.length > 1
              ? tf(t.fill.step, { current: step + 1, total: pages.length })
              : t.fill.progress}
          </span>
          <span className="tnum">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} aria-label={t.fill.progress} />
      </div>

      <div className="flex flex-col gap-6">
        {page.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={answers[field.id] ?? null}
            onChange={(value) => setAnswer(field.id, value)}
            error={errors[field.id]}
            teams={teams}
            profiles={profiles}
          />
        ))}
      </div>

      {Object.keys(errors).length ? (
        <p role="alert" className="mt-5 rounded-md border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger">
          {t.fill.fixErrors}
        </p>
      ) : null}

      <Separator className="my-6" />

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            {t.common.previous}
          </Button>
        ) : null}

        {isLast ? (
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {submitting ? t.fill.submitting : t.common.submit}
          </Button>
        ) : (
          <Button
            onClick={() => {
              if (validateCurrentPage()) setStep(step + 1);
            }}
          >
            {t.common.next}
          </Button>
        )}

        {!previewOnly && form.settings.allow_drafts ? (
          <Button
            variant="ghost"
            onClick={() => {
              dirtyRef.current = true;
              void persistDraft();
            }}
          >
            <Save aria-hidden />
            {t.forms.saveDraft}
          </Button>
        ) : null}

        {draftSavedAt ? (
          <span className="text-xs text-ink-subtle" aria-live="polite">
            {t.fill.autosaved}
          </span>
        ) : null}
      </div>
    </div>
  );
}
