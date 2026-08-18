import type { AnswerValue, FormField } from '@/lib/data/types';
import { isAnswerable } from './field-types';
import type { Dict } from '@/lib/i18n/dictionaries';
import { interpolate } from '@/lib/i18n/dictionaries';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isEmpty(value: AnswerValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'boolean') return value === false;
  return false;
}

/** Returns a map of field id → localised error message. */
export function validateAnswers(
  fields: FormField[],
  answers: Record<string, AnswerValue>,
  hidden: Set<string>,
  t: Dict,
): Record<string, string> {
  const errors: Record<string, string> = {};

  fields.forEach((field) => {
    if (!isAnswerable(field.type)) return;
    if (hidden.has(field.id)) return;

    const value = answers[field.id] ?? null;

    if (field.required && isEmpty(value)) {
      errors[field.id] = t.fill.requiredError;
      return;
    }
    if (isEmpty(value)) return;

    const text = typeof value === 'string' ? value : '';

    if (field.type === 'email' && !EMAIL.test(text)) {
      errors[field.id] = t.fill.invalidEmail;
      return;
    }
    if (field.type === 'url') {
      try {
        const parsed = new URL(text);
        if (!parsed.protocol.startsWith('http')) throw new Error('scheme');
      } catch {
        errors[field.id] = t.fill.invalidUrl;
        return;
      }
    }
    if (field.type === 'number') {
      const n = Number(value);
      if (Number.isNaN(n)) {
        errors[field.id] = t.fill.invalidNumber;
        return;
      }
      const { min, max } = field.validation;
      if ((min !== undefined && n < min) || (max !== undefined && n > max)) {
        errors[field.id] = interpolate(t.fill.outOfRange, {
          min: min ?? '−∞',
          max: max ?? '∞',
        });
        return;
      }
    }
    const { minLength, maxLength } = field.validation;
    if (minLength !== undefined && text.length < minLength) {
      errors[field.id] = interpolate(t.fill.tooShort, { n: minLength });
      return;
    }
    if (maxLength !== undefined && text.length > maxLength) {
      errors[field.id] = interpolate(t.fill.tooLong, { n: maxLength });
    }
  });

  return errors;
}
