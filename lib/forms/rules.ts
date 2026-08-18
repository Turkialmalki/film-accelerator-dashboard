import type { AnswerValue, FormField, FormRule } from '@/lib/data/types';

/** Evaluates one condition against the current answer set. */
function test(rule: FormRule, value: AnswerValue): boolean {
  const asString = Array.isArray(value) ? value.join(',') : value === null ? '' : String(value);
  const asNumber = Number(asString);

  switch (rule.operator) {
    case 'equals':
      return Array.isArray(value) ? value.includes(rule.value) : asString === rule.value;
    case 'not_equals':
      return Array.isArray(value) ? !value.includes(rule.value) : asString !== rule.value;
    case 'contains':
      return asString.toLowerCase().includes(rule.value.toLowerCase());
    case 'is_empty':
      return asString.trim() === '';
    case 'is_not_empty':
      return asString.trim() !== '';
    case 'greater_than':
      return !Number.isNaN(asNumber) && asNumber > Number(rule.value);
    case 'less_than':
      return !Number.isNaN(asNumber) && asNumber < Number(rule.value);
    default:
      return false;
  }
}

/**
 * Returns the ids of fields hidden by the current answers.
 *
 * A field with no rules is always visible. A field with `show` rules is hidden
 * until one matches; a field with `hide` rules is visible until one matches.
 */
export function hiddenFieldIds(
  fields: FormField[],
  rules: FormRule[],
  answers: Record<string, AnswerValue>,
): Set<string> {
  const hidden = new Set<string>();

  fields.forEach((field) => {
    const own = rules.filter((r) => r.target_field_id === field.id);
    if (!own.length) return;

    const showRules = own.filter((r) => r.action === 'show');
    const hideRules = own.filter((r) => r.action === 'hide');

    if (showRules.length && !showRules.some((r) => test(r, answers[r.source_field_id] ?? null))) {
      hidden.add(field.id);
      return;
    }
    if (hideRules.some((r) => test(r, answers[r.source_field_id] ?? null))) {
      hidden.add(field.id);
    }
  });

  return hidden;
}
