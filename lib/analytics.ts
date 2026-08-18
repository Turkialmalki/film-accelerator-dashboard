/**
 * Pure aggregation helpers. No React, no data access — they take rows and
 * return the numbers the dashboard and results pages draw.
 */

import type {
  AnswerValue,
  Form,
  FormField,
  Submission,
  SubmissionAnswer,
  Team,
  TeamStage,
} from '@/lib/data/types';

export interface KpiSet {
  teams: number;
  activeForms: number;
  submissions: number;
  responseRate: number;
  pendingReview: number;
}

export function computeKpis(teams: Team[], forms: Form[], submissions: Submission[]): KpiSet {
  const activeTeams = teams.filter((t) => t.status === 'active');
  const activeForms = forms.filter((f) => f.status === 'published');
  const finalised = submissions.filter((s) => s.status !== 'draft');
  const expected = activeForms.length * activeTeams.length;

  return {
    teams: activeTeams.length,
    activeForms: activeForms.length,
    submissions: finalised.length,
    responseRate: expected
      ? Math.min(100, (finalised.filter((s) => activeForms.some((f) => f.id === s.form_id)).length / expected) * 100)
      : 0,
    pendingReview: submissions.filter((s) => s.status === 'submitted').length,
  };
}

export interface StatusSlice {
  key: 'draft' | 'submitted' | 'reviewed';
  value: number;
}

export function statusBreakdown(submissions: Submission[]): StatusSlice[] {
  return [
    { key: 'draft', value: submissions.filter((s) => s.status === 'draft').length },
    { key: 'submitted', value: submissions.filter((s) => s.status === 'submitted').length },
    { key: 'reviewed', value: submissions.filter((s) => s.status === 'reviewed').length },
  ];
}

export interface TrendPoint {
  label: string;
  iso: string;
  value: number;
}

/** Buckets submissions into ISO weeks, oldest first. */
export function responseTrend(submissions: Submission[], weeks = 10): TrendPoint[] {
  const finalised = submissions.filter((s) => s.submitted_at);
  if (!finalised.length) return [];

  const times = finalised.map((s) => new Date(s.submitted_at!).getTime());
  const end = Math.max(...times);
  const WEEK = 7 * 86400000;
  const start = end - (weeks - 1) * WEEK;

  const buckets: TrendPoint[] = [];
  for (let i = 0; i < weeks; i += 1) {
    const from = start + i * WEEK;
    const to = from + WEEK;
    const iso = new Date(from).toISOString();
    buckets.push({
      label: iso.slice(5, 10),
      iso,
      value: times.filter((t) => t >= from && t < to).length,
    });
  }
  return buckets;
}

export interface StageBar {
  stage: TeamStage;
  value: number;
}

const STAGE_ORDER: TeamStage[] = ['idea', 'mvp', 'pre-seed', 'seed', 'series-a', 'growth'];

export function stageDistribution(teams: Team[]): StageBar[] {
  const active = teams.filter((t) => t.status === 'active');
  return STAGE_ORDER.map((stage) => ({
    stage,
    value: active.filter((t) => t.stage === stage).length,
  })).filter((bar) => bar.value > 0);
}

/* --------------------------------------------------------- per-form stats */

export interface FormStats {
  form: Form;
  total: number;
  submitted: number;
  drafts: number;
  reviewed: number;
  responseRate: number;
  lastResponseAt: string | null;
  respondingTeamIds: string[];
}

export function formStats(form: Form, submissions: Submission[], teams: Team[]): FormStats {
  const rows = submissions.filter((s) => s.form_id === form.id);
  const finalised = rows.filter((s) => s.status !== 'draft');
  const activeTeams = teams.filter((t) => t.status === 'active');
  const respondingTeamIds = Array.from(
    new Set(finalised.map((s) => s.team_id).filter((id): id is string => Boolean(id))),
  );
  const times = finalised
    .map((s) => s.submitted_at)
    .filter((t): t is string => Boolean(t))
    .sort();

  return {
    form,
    total: rows.length,
    submitted: finalised.length,
    drafts: rows.filter((s) => s.status === 'draft').length,
    reviewed: rows.filter((s) => s.status === 'reviewed').length,
    responseRate: activeTeams.length ? (respondingTeamIds.length / activeTeams.length) * 100 : 0,
    lastResponseAt: times.length ? times[times.length - 1] : null,
    respondingTeamIds,
  };
}

/* ---------------------------------------------------- per-question stats */

export type QuestionSummary =
  | { kind: 'choice'; field: FormField; answered: number; skipped: number; buckets: { label: string; value: string; count: number }[] }
  | { kind: 'rating'; field: FormField; answered: number; skipped: number; average: number; scale: number; buckets: { label: string; value: string; count: number }[] }
  | { kind: 'nps'; field: FormField; answered: number; skipped: number; score: number; promoters: number; passives: number; detractors: number; buckets: { label: string; value: string; count: number }[] }
  | { kind: 'number'; field: FormField; answered: number; skipped: number; average: number; min: number; max: number }
  | { kind: 'text'; field: FormField; answered: number; skipped: number; values: { submissionId: string; text: string }[] }
  | { kind: 'file'; field: FormField; answered: number; skipped: number; values: { submissionId: string; name: string }[] }
  | { kind: 'other'; field: FormField; answered: number; skipped: number; values: { submissionId: string; text: string }[] };

function asArray(value: AnswerValue): string[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [String(value)];
}

export function summariseQuestion(
  field: FormField,
  submissions: Submission[],
  answers: SubmissionAnswer[],
  labelFor: (value: string) => string,
): QuestionSummary {
  const relevant = answers.filter((a) => a.field_id === field.id);
  const answered = relevant.length;
  const skipped = Math.max(0, submissions.length - answered);

  switch (field.type) {
    case 'select':
    case 'radio':
    case 'multi_select':
    case 'checkbox':
    case 'likert':
    case 'consent':
    case 'team_select':
    case 'participant_select': {
      const counts = new Map<string, number>();
      relevant.forEach((a) => {
        asArray(a.value).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
      });
      const seeded =
        field.options.length && field.type !== 'team_select' && field.type !== 'participant_select'
          ? field.options.map((o) => o.value)
          : Array.from(counts.keys());
      const buckets = seeded.map((value) => ({
        value,
        label: labelFor(value),
        count: counts.get(value) ?? 0,
      }));
      counts.forEach((count, value) => {
        if (!buckets.some((b) => b.value === value)) {
          buckets.push({ value, label: labelFor(value), count });
        }
      });
      return { kind: 'choice', field, answered, skipped, buckets };
    }
    case 'rating': {
      const scale = field.validation.scale ?? 5;
      const nums = relevant.map((a) => Number(a.value)).filter((n) => !Number.isNaN(n));
      const buckets = Array.from({ length: scale }, (_, i) => {
        const step = i + 1;
        return {
          value: String(step),
          label: String(step),
          count: nums.filter((n) => n === step).length,
        };
      });
      return {
        kind: 'rating',
        field,
        answered,
        skipped,
        scale,
        average: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
        buckets,
      };
    }
    case 'nps': {
      const nums = relevant.map((a) => Number(a.value)).filter((n) => !Number.isNaN(n));
      const promoters = nums.filter((n) => n >= 9).length;
      const passives = nums.filter((n) => n >= 7 && n <= 8).length;
      const detractors = nums.filter((n) => n <= 6).length;
      const buckets = Array.from({ length: 11 }, (_, i) => ({
        value: String(i),
        label: String(i),
        count: nums.filter((n) => n === i).length,
      }));
      return {
        kind: 'nps',
        field,
        answered,
        skipped,
        promoters,
        passives,
        detractors,
        score: nums.length ? ((promoters - detractors) / nums.length) * 100 : 0,
        buckets,
      };
    }
    case 'number': {
      const nums = relevant.map((a) => Number(a.value)).filter((n) => !Number.isNaN(n));
      return {
        kind: 'number',
        field,
        answered,
        skipped,
        average: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
        min: nums.length ? Math.min(...nums) : 0,
        max: nums.length ? Math.max(...nums) : 0,
      };
    }
    case 'file':
    case 'image':
      return {
        kind: 'file',
        field,
        answered,
        skipped,
        values: relevant.map((a) => ({ submissionId: a.submission_id, name: String(a.value) })),
      };
    case 'short_text':
    case 'long_text':
    case 'email':
    case 'phone':
    case 'url':
      return {
        kind: 'text',
        field,
        answered,
        skipped,
        values: relevant.map((a) => ({ submissionId: a.submission_id, text: String(a.value) })),
      };
    default:
      return {
        kind: 'other',
        field,
        answered,
        skipped,
        values: relevant.map((a) => ({ submissionId: a.submission_id, text: String(a.value) })),
      };
  }
}
