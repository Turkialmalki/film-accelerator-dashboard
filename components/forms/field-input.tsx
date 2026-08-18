'use client';

import { useId } from 'react';
import { Paperclip, Star } from 'lucide-react';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Checkbox, Label, RadioGroup, RadioItem, Separator } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import type { AnswerValue, FormField, Profile, Team } from '@/lib/data/types';

/**
 * One component renders every field type, in both the builder preview and the
 * live fill experience. Keeping them the same means the preview cannot drift
 * from what a participant actually sees.
 */
export function FieldInput({
  field,
  value,
  onChange,
  error,
  teams,
  profiles,
  disabled,
}: {
  field: FormField;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  error?: string;
  teams?: Team[];
  profiles?: Profile[];
  disabled?: boolean;
}) {
  const { t, b } = useI18n();
  const reactId = useId();
  const id = `${field.id}-${reactId}`;
  const describedBy = error ? `${id}-error` : b(field.description) ? `${id}-hint` : undefined;

  /* ----------------------------------------------------------- layout-only */

  if (field.type === 'section_heading') {
    return (
      <div className="pt-2">
        <h3 className="text-lg font-semibold text-ink">{b(field.label)}</h3>
        {b(field.description) ? (
          <p className="mt-1 text-sm text-ink-muted">{b(field.description)}</p>
        ) : null}
      </div>
    );
  }
  if (field.type === 'description') {
    return <p className="text-sm leading-relaxed text-ink-muted">{b(field.label)}</p>;
  }
  if (field.type === 'divider') return <Separator />;
  if (field.type === 'page_break') {
    return (
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-subtle">
        <Separator className="flex-1" />
        {b(field.label) || 'page break'}
        <Separator className="flex-1" />
      </div>
    );
  }
  if (field.type === 'hidden') return null;

  /* ------------------------------------------------------------- control */

  const control = (() => {
    switch (field.type) {
      case 'long_text':
        return (
          <Textarea
            id={id}
            rows={4}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            maxLength={field.validation.maxLength}
            placeholder={b(field.placeholder)}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'number':
        return (
          <Input
            id={id}
            type="number"
            dir="ltr"
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            min={field.validation.min}
            max={field.validation.max}
            placeholder={b(field.placeholder)}
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
        );
      case 'email':
      case 'phone':
      case 'url':
      case 'date':
      case 'time':
      case 'datetime':
        return (
          <Input
            id={id}
            dir={field.type === 'phone' || field.type === 'email' || field.type === 'url' ? 'ltr' : undefined}
            type={
              field.type === 'email'
                ? 'email'
                : field.type === 'phone'
                  ? 'tel'
                  : field.type === 'url'
                    ? 'url'
                    : field.type === 'datetime'
                      ? 'datetime-local'
                      : field.type
            }
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            placeholder={b(field.placeholder)}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'select':
        return (
          <NativeSelect
            id={id}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">{t.common.none}</option>
            {field.options.map((option) => (
              <option key={option.id} value={option.value}>
                {b(option.label)}
              </option>
            ))}
          </NativeSelect>
        );
      case 'team_select':
        return (
          <NativeSelect
            id={id}
            disabled={disabled}
            aria-describedby={describedBy}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">{t.fill.selectTeam}</option>
            {(teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {b(team.name)}
              </option>
            ))}
          </NativeSelect>
        );
      case 'participant_select':
        return (
          <NativeSelect
            id={id}
            disabled={disabled}
            aria-describedby={describedBy}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">{t.fill.selectParticipant}</option>
            {(profiles ?? []).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {b(profile.full_name)}
              </option>
            ))}
          </NativeSelect>
        );
      case 'radio':
        return (
          <RadioGroup
            value={typeof value === 'string' ? value : ''}
            onValueChange={onChange}
            disabled={disabled}
            className="flex flex-col gap-2"
            aria-describedby={describedBy}
          >
            {field.options.map((option) => (
              <div key={option.id} className="flex items-center gap-2.5">
                <RadioItem value={option.value} id={`${id}-${option.id}`} />
                <Label htmlFor={`${id}-${option.id}`} className="cursor-pointer font-normal">
                  {b(option.label)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'multi_select':
      case 'checkbox': {
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-col gap-2" aria-describedby={describedBy}>
            {field.options.map((option) => (
              <div key={option.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={`${id}-${option.id}`}
                  disabled={disabled}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...selected, option.value]
                        : selected.filter((v) => v !== option.value),
                    )
                  }
                />
                <Label htmlFor={`${id}-${option.id}`} className="cursor-pointer font-normal">
                  {b(option.label)}
                </Label>
              </div>
            ))}
          </div>
        );
      }
      case 'consent':
        return (
          <div className="flex items-start gap-2.5">
            <Checkbox
              id={id}
              disabled={disabled}
              checked={value === true}
              onCheckedChange={(checked) => onChange(checked === true)}
              aria-describedby={describedBy}
            />
            <Label htmlFor={id} className="cursor-pointer font-normal leading-relaxed">
              {b(field.label)}
            </Label>
          </div>
        );
      case 'likert': {
        const options = field.options.length
          ? field.options
          : [1, 2, 3, 4, 5].map((n) => ({ id: String(n), value: String(n), label: { ar: String(n), en: String(n) } }));
        return (
          <RadioGroup
            value={typeof value === 'string' ? value : ''}
            onValueChange={onChange}
            disabled={disabled}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
            aria-describedby={describedBy}
          >
            {options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-line px-2 py-2.5 text-center text-xs text-ink-muted transition-colors hover:border-accent hover:bg-accent-soft/50 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <RadioItem value={option.value} id={`${id}-${option.id}`} />
                <span>{b(option.label)}</span>
              </label>
            ))}
          </RadioGroup>
        );
      }
      case 'rating': {
        const scale = field.validation.scale ?? 5;
        const current = Number(value) || 0;
        return (
          <div className="flex items-center gap-1.5" role="radiogroup" aria-describedby={describedBy}>
            {Array.from({ length: scale }, (_, i) => i + 1).map((step) => (
              <button
                key={step}
                type="button"
                role="radio"
                aria-checked={current === step}
                aria-label={String(step)}
                disabled={disabled}
                onClick={() => onChange(step)}
                className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                <Star
                  className={cn(
                    'size-6',
                    step <= current ? 'fill-accent text-accent' : 'text-line-strong',
                  )}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        );
      }
      case 'nps': {
        const current = value === null || value === undefined ? null : Number(value);
        return (
          <div aria-describedby={describedBy}>
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={current === n}
                  disabled={disabled}
                  onClick={() => onChange(n)}
                  className={cn(
                    'tnum size-9 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    current === n
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line bg-surface text-ink-muted hover:border-accent hover:text-accent',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-subtle">
              <span>{t.fill.npsLow}</span>
              <span>{t.fill.npsHigh}</span>
            </div>
          </div>
        );
      }
      case 'file':
      case 'image':
        return (
          <div>
            <label
              htmlFor={id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface-muted/50 px-4 py-3 text-sm text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Paperclip className="size-4" aria-hidden />
              {typeof value === 'string' && value ? value : t.fill.chooseFile}
            </label>
            <input
              id={id}
              type="file"
              className="sr-only"
              disabled={disabled}
              accept={
                field.type === 'image'
                  ? 'image/*'
                  : field.validation.accept?.join(',') || undefined
              }
              onChange={(e) => onChange(e.target.files?.[0]?.name ?? null)}
            />
            {field.validation.maxSizeMb ? (
              <p className="mt-1.5 text-xs text-ink-subtle">
                {t.forms.maxSize}: {field.validation.maxSizeMb} MB
              </p>
            ) : null}
          </div>
        );
      default:
        return (
          <Input
            id={id}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            maxLength={field.validation.maxLength}
            placeholder={b(field.placeholder)}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  })();

  return (
    <div className="flex flex-col gap-2">
      {field.type !== 'consent' ? (
        <Label htmlFor={id} className="leading-relaxed">
          {b(field.label)}
          {field.required ? (
            <span className="text-danger" aria-hidden>
              {' '}
              *
            </span>
          ) : null}
        </Label>
      ) : null}
      {b(field.description) ? (
        <p id={`${id}-hint`} className="text-xs text-ink-subtle">
          {b(field.description)}
        </p>
      ) : null}
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
