import type {
  Form,
  FormField,
  Locale,
  Submission,
  SubmissionAnswer,
  Team,
} from '@/lib/data/types';
import { isAnswerable } from '@/lib/forms/field-types';
import { bi } from '@/lib/utils';

/**
 * One row per submission, one column per answerable field — the shape a
 * programme manager expects to open in Excel and pivot.
 */
export function submissionsToCsvRows(
  form: Form,
  fields: FormField[],
  submissions: Submission[],
  answers: SubmissionAnswer[],
  teams: Team[],
  locale: Locale,
): string[][] {
  const columns = fields.filter((f) => isAnswerable(f.type));
  const teamName = new Map(teams.map((team) => [team.id, bi(team.name, locale)]));
  const bySubmission = new Map<string, Map<string, SubmissionAnswer>>();
  answers.forEach((answer) => {
    if (!bySubmission.has(answer.submission_id)) bySubmission.set(answer.submission_id, new Map());
    bySubmission.get(answer.submission_id)!.set(answer.field_id, answer);
  });

  const optionLabel = (field: FormField, raw: string) => {
    if (field.type === 'team_select') return teamName.get(raw) ?? raw;
    const option = field.options.find((o) => o.value === raw);
    return option ? bi(option.label, locale) : raw;
  };

  const header = [
    'submission_id',
    'form',
    'team',
    'status',
    'submitted_at',
    'reviewed_at',
    ...columns.map((f) => bi(f.label, locale) || f.id),
  ];

  const rows = submissions.map((submission) => {
    const map = bySubmission.get(submission.id);
    return [
      submission.id,
      bi(form.title, locale),
      submission.team_id ? (teamName.get(submission.team_id) ?? submission.team_id) : '',
      submission.status,
      submission.submitted_at ?? '',
      submission.reviewed_at ?? '',
      ...columns.map((field) => {
        const answer = map?.get(field.id);
        if (!answer || answer.value === null) return '';
        if (Array.isArray(answer.value)) {
          return answer.value.map((v) => optionLabel(field, v)).join(' | ');
        }
        if (typeof answer.value === 'boolean') return answer.value ? 'yes' : 'no';
        if (typeof answer.value === 'number') return String(answer.value);
        return optionLabel(field, answer.value);
      }),
    ];
  });

  return [header, ...rows];
}
