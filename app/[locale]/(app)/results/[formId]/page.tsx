'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Lock,
  Search,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import {
  EmptyState,
  Progress,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { getRepository, subscribeToRepository } from '@/lib/data';
import type {
  Form,
  FormField,
  Submission,
  SubmissionAnswer,
  Team,
} from '@/lib/data/types';
import { formStats, summariseQuestion } from '@/lib/analytics';
import { isAnswerable } from '@/lib/forms/field-types';
import { QuestionChart } from '@/components/results/question-chart';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { downloadCsv } from '@/lib/csv';
import { submissionsToCsvRows } from '@/lib/submissions-csv';
import { cn } from '@/lib/utils';

export default function FormResultsPage() {
  const { t, b, locale, fmtNumber, fmtDateTime } = useI18n();
  const params = useParams<{ formId: string }>();
  const formId = params.formId;

  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [answers, setAnswers] = useState<SubmissionAnswer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const repo = getRepository();
    const loaded = await repo.getForm(formId);
    if (!loaded) {
      setLoading(false);
      return;
    }
    const [f, subs, tm] = await Promise.all([
      repo.listFields(formId),
      repo.listSubmissions(formId),
      repo.listTeams(),
    ]);
    const allAnswers = (await Promise.all(subs.map((s) => repo.listAnswers(s.id)))).flat();
    setForm(loaded);
    setFields(f);
    setSubmissions(subs);
    setAnswers(allAnswers);
    setTeams(tm);
    setLoading(false);
  }, [formId]);

  useEffect(() => {
    void load();
    return subscribeToRepository(() => void load());
  }, [load]);

  const teamName = useMemo(
    () => new Map(teams.map((team) => [team.id, b(team.name)])),
    [teams, b],
  );

  const finalised = useMemo(
    () => submissions.filter((s) => s.status !== 'draft'),
    [submissions],
  );

  const stats = useMemo(
    () => (form ? formStats(form, submissions, teams) : null),
    [form, submissions, teams],
  );

  const questionSummaries = useMemo(() => {
    const labelFor = (value: string) => teamName.get(value) ?? value;
    return fields
      .filter((field) => isAnswerable(field.type))
      .map((field) =>
        summariseQuestion(
          field,
          finalised,
          answers.filter((a) => finalised.some((s) => s.id === a.submission_id)),
          (value) => {
            const option = field.options.find((o) => o.value === value);
            return option ? b(option.label) : labelFor(value);
          },
        ),
      );
  }, [fields, finalised, answers, teamName, b]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return finalised
      .filter((s) => (onlyUnreviewed ? s.status !== 'reviewed' : true))
      .filter((s) => {
        if (!needle) return true;
        const team = s.team_id ? (teamName.get(s.team_id) ?? '') : '';
        const text = answers
          .filter((a) => a.submission_id === s.id)
          .map((a) => (Array.isArray(a.value) ? a.value.join(' ') : String(a.value ?? '')))
          .join(' ');
        return `${team} ${text}`.toLowerCase().includes(needle);
      })
      .sort((a, c) => (c.submitted_at ?? '').localeCompare(a.submitted_at ?? ''));
  }, [finalised, onlyUnreviewed, search, answers, teamName]);

  const selected = useMemo(
    () => filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  useEffect(() => {
    setNotes(selected?.internal_notes ?? '');
  }, [selected]);

  const selectedIndex = selected ? filtered.findIndex((s) => s.id === selected.id) : -1;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <Skeleton className="mb-6 h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!form || !stats) {
    return <EmptyState title={t.errors.notFound} />;
  }

  const participation = teams
    .filter((team) => team.status === 'active')
    .map((team) => ({ team, responded: stats.respondingTeamIds.includes(team.id) }));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={b(form.title)}
        subtitle={t.results.title}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadCsv(
                `fba-${form.id}-responses`,
                submissionsToCsvRows(form, fields, finalised, answers, teams, locale),
              )
            }
          >
            <Download aria-hidden />
            {t.results.exportForm}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon="Inbox" label={t.results.responseCount} value={stats.submitted} index={0} />
        <KpiCard
          icon="Gauge"
          label={t.results.responseRate}
          value={stats.responseRate}
          suffix="%"
          index={1}
        />
        <KpiCard
          icon="ClipboardCheck"
          label={t.results.reviewed}
          value={stats.reviewed}
          index={2}
        />
        <KpiCard icon="FileText" label={t.common.draft} value={stats.drafts} index={3} />
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="mb-5">
          <TabsTrigger value="analytics">{t.results.analytics}</TabsTrigger>
          <TabsTrigger value="responses">{t.results.responses}</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------------- analytics */}
        <TabsContent value="analytics">
          <section className="mb-5 rounded-lg border border-line bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold text-ink">{t.results.teamParticipation}</h3>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {fmtNumber(stats.respondingTeamIds.length)} / {fmtNumber(participation.length)}
            </p>
            <div className="mt-3">
              <Progress value={stats.responseRate} />
            </div>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {participation.map(({ team, responded }) => (
                <li key={team.id}>
                  <Badge tone={responded ? 'success' : 'neutral'}>
                    {responded ? (
                      <CheckCircle2 className="size-3" aria-hidden />
                    ) : (
                      <Circle className="size-3" aria-hidden />
                    )}
                    {b(team.name)}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>

          {questionSummaries.length === 0 ? (
            <EmptyState title={t.results.noResponses} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {questionSummaries.map((summary) => (
                <QuestionChart key={summary.field.id} summary={summary} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* -------------------------------------------------------- responses */}
        <TabsContent value="responses">
          {finalised.length === 0 ? (
            <EmptyState title={t.results.noResponses} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
              {/* list */}
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-subtle ltr:left-3 rtl:right-3"
                    aria-hidden
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.results.searchResponses}
                    aria-label={t.results.searchResponses}
                    className="ltr:pl-9 rtl:pr-9"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-md border border-line bg-surface-muted p-1">
                  <button
                    type="button"
                    onClick={() => setOnlyUnreviewed(false)}
                    aria-pressed={!onlyUnreviewed}
                    className={cn(
                      'flex-1 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
                      !onlyUnreviewed ? 'bg-surface text-ink shadow-card' : 'text-ink-muted',
                    )}
                  >
                    {t.common.all}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlyUnreviewed(true)}
                    aria-pressed={onlyUnreviewed}
                    className={cn(
                      'flex-1 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
                      onlyUnreviewed ? 'bg-surface text-ink shadow-card' : 'text-ink-muted',
                    )}
                  >
                    {t.results.unreviewed}
                  </button>
                </div>

                <ul className="scroll-thin flex max-h-[32rem] flex-col gap-1.5 overflow-y-auto">
                  {filtered.map((submission) => (
                    <li key={submission.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(submission.id)}
                        aria-current={selected?.id === submission.id}
                        className={cn(
                          'w-full rounded-md border px-3 py-2.5 text-start transition-colors',
                          selected?.id === submission.id
                            ? 'border-accent bg-accent-soft/60'
                            : 'border-line bg-surface hover:border-line-strong',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                            {submission.team_id
                              ? (teamName.get(submission.team_id) ?? submission.team_id)
                              : t.common.none}
                          </span>
                          {submission.status === 'reviewed' ? (
                            <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />
                          ) : null}
                        </span>
                        <span className="tnum mt-0.5 block text-xs text-ink-subtle">
                          {fmtDateTime(submission.submitted_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* detail */}
              <div className="rounded-lg border border-line bg-surface p-5 shadow-card">
                {!selected ? (
                  <EmptyState title={t.results.selectResponse} />
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                      <div>
                        <h3 className="text-base font-semibold text-ink">
                          {selected.team_id
                            ? (teamName.get(selected.team_id) ?? selected.team_id)
                            : t.common.none}
                        </h3>
                        <p className="tnum text-xs text-ink-subtle">
                          {t.results.submittedOn} {fmtDateTime(selected.submitted_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={selectedIndex <= 0}
                          aria-label={t.common.previous}
                          onClick={() => setSelectedId(filtered[selectedIndex - 1]?.id ?? null)}
                        >
                          <ChevronLeft className="rtl:rotate-180" aria-hidden />
                        </Button>
                        <span className="tnum text-xs text-ink-subtle">
                          {selectedIndex + 1} {t.common.of} {filtered.length}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={selectedIndex >= filtered.length - 1}
                          aria-label={t.common.next}
                          onClick={() => setSelectedId(filtered[selectedIndex + 1]?.id ?? null)}
                        >
                          <ChevronRight className="rtl:rotate-180" aria-hidden />
                        </Button>
                        <Button
                          variant={selected.status === 'reviewed' ? 'subtle' : 'primary'}
                          size="sm"
                          onClick={async () => {
                            await getRepository().setSubmissionReviewed(
                              selected.id,
                              selected.status !== 'reviewed',
                            );
                          }}
                        >
                          {selected.status === 'reviewed'
                            ? t.results.markUnreviewed
                            : t.results.markReviewed}
                        </Button>
                      </div>
                    </div>

                    <dl className="flex flex-col gap-4">
                      {fields
                        .filter((field) => isAnswerable(field.type))
                        .map((field) => {
                          const answer = answers.find(
                            (a) => a.submission_id === selected.id && a.field_id === field.id,
                          );
                          const raw = answer?.value ?? null;
                          const display = Array.isArray(raw)
                            ? raw
                                .map((value) => {
                                  const option = field.options.find((o) => o.value === value);
                                  return option ? b(option.label) : value;
                                })
                                .join('، ')
                            : raw === null || raw === ''
                              ? '—'
                              : typeof raw === 'boolean'
                                ? raw
                                  ? t.common.yes
                                  : t.common.no
                                : field.type === 'team_select'
                                  ? (teamName.get(String(raw)) ?? String(raw))
                                  : (field.options.find((o) => o.value === String(raw))
                                      ? b(field.options.find((o) => o.value === String(raw))!.label)
                                      : String(raw));
                          return (
                            <div key={field.id}>
                              <dt className="text-xs text-ink-subtle">{b(field.label)}</dt>
                              <dd className="mt-0.5 text-sm leading-relaxed text-ink">{display}</dd>
                            </div>
                          );
                        })}
                    </dl>

                    <div className="mt-6 border-t border-line pt-4">
                      <label
                        htmlFor="submissionNotes"
                        className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink"
                      >
                        <Lock className="size-3.5 text-ink-subtle" aria-hidden />
                        {t.results.internalNotes}
                      </label>
                      <p className="mb-2 text-xs text-ink-subtle">{t.results.internalNotesHint}</p>
                      <Textarea
                        id="submissionNotes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onBlur={() => void getRepository().setSubmissionNotes(selected.id, notes)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
