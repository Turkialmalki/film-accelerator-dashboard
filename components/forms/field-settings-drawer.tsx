'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field, Label, Separator, Switch } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { FIELD_TYPE_MAP, hasOptions, isAnswerable } from '@/lib/forms/field-types';
import type { FormField, FormRule, RuleOperator } from '@/lib/data/types';
import { uid } from '@/lib/utils';

const OPERATORS: RuleOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'is_empty',
  'is_not_empty',
  'greater_than',
  'less_than',
];

const OPERATOR_LABEL: Record<RuleOperator, { ar: string; en: string }> = {
  equals: { ar: 'يساوي', en: 'equals' },
  not_equals: { ar: 'لا يساوي', en: 'does not equal' },
  contains: { ar: 'يحتوي على', en: 'contains' },
  is_empty: { ar: 'فارغ', en: 'is empty' },
  is_not_empty: { ar: 'غير فارغ', en: 'is not empty' },
  greater_than: { ar: 'أكبر من', en: 'is greater than' },
  less_than: { ar: 'أصغر من', en: 'is less than' },
};

export function FieldSettingsDrawer({
  field,
  allFields,
  rules,
  onChange,
  onRulesChange,
  onClose,
}: {
  field: FormField | null;
  allFields: FormField[];
  rules: FormRule[];
  onChange: (field: FormField) => void;
  onRulesChange: (rules: FormRule[]) => void;
  onClose: () => void;
}) {
  const { t, b, locale } = useI18n();
  if (!field) return null;

  const meta = FIELD_TYPE_MAP[field.type];
  const ownRules = rules.filter((r) => r.target_field_id === field.id);
  // Only earlier fields can drive a rule; a later answer is not known yet.
  const sourceCandidates = allFields.filter(
    (f) => f.id !== field.id && isAnswerable(f.type) && f.position < field.position,
  );

  const patch = (changes: Partial<FormField>) => onChange({ ...field, ...changes });

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent width="max-w-lg">
        <DrawerHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
            {t.forms.fieldSettings}
          </p>
          <h2 className="text-lg font-semibold text-ink">{b(meta.label)}</h2>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-5">
          <Field label={t.forms.labelAr} htmlFor="labelAr">
            <Input
              id="labelAr"
              value={field.label.ar}
              onChange={(e) => patch({ label: { ...field.label, ar: e.target.value } })}
            />
          </Field>
          <Field label={t.forms.labelEn} htmlFor="labelEn">
            <Input
              id="labelEn"
              dir="ltr"
              value={field.label.en}
              onChange={(e) => patch({ label: { ...field.label, en: e.target.value } })}
            />
          </Field>

          <Field label={t.forms.descriptionAr} htmlFor="descAr">
            <Textarea
              id="descAr"
              rows={2}
              value={field.description.ar}
              onChange={(e) => patch({ description: { ...field.description, ar: e.target.value } })}
            />
          </Field>
          <Field label={t.forms.descriptionEn} htmlFor="descEn">
            <Textarea
              id="descEn"
              dir="ltr"
              rows={2}
              value={field.description.en}
              onChange={(e) => patch({ description: { ...field.description, en: e.target.value } })}
            />
          </Field>

          {isAnswerable(field.type) ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.forms.placeholderAr} htmlFor="phAr">
                  <Input
                    id="phAr"
                    value={field.placeholder.ar}
                    onChange={(e) =>
                      patch({ placeholder: { ...field.placeholder, ar: e.target.value } })
                    }
                  />
                </Field>
                <Field label={t.forms.placeholderEn} htmlFor="phEn">
                  <Input
                    id="phEn"
                    dir="ltr"
                    value={field.placeholder.en}
                    onChange={(e) =>
                      patch({ placeholder: { ...field.placeholder, en: e.target.value } })
                    }
                  />
                </Field>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-md border border-line px-3 py-2.5">
                <span className="text-sm font-medium text-ink">{t.forms.required}</span>
                <Switch
                  checked={field.required}
                  onCheckedChange={(checked) => patch({ required: checked })}
                />
              </label>
            </>
          ) : null}

          {field.type === 'hidden' ? (
            <Field label={t.forms.defaultValue} htmlFor="defaultValue">
              <Input
                id="defaultValue"
                dir="ltr"
                value={field.default_value}
                onChange={(e) => patch({ default_value: e.target.value })}
              />
            </Field>
          ) : null}

          {/* ---------------------------------------------------- options */}
          {hasOptions(field.type) ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>{t.forms.options}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    patch({
                      options: [
                        ...field.options,
                        {
                          id: uid('option'),
                          value: `option_${field.options.length + 1}`,
                          label: { ar: '', en: '' },
                        },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden />
                  {t.forms.addOption}
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {field.options.map((option, index) => (
                  <li key={option.id} className="flex items-center gap-2">
                    <Input
                      aria-label={t.forms.optionLabelAr}
                      placeholder={t.forms.optionLabelAr}
                      value={option.label.ar}
                      onChange={(e) => {
                        const next = [...field.options];
                        next[index] = { ...option, label: { ...option.label, ar: e.target.value } };
                        patch({ options: next });
                      }}
                    />
                    <Input
                      aria-label={t.forms.optionLabelEn}
                      placeholder={t.forms.optionLabelEn}
                      dir="ltr"
                      value={option.label.en}
                      onChange={(e) => {
                        const next = [...field.options];
                        next[index] = { ...option, label: { ...option.label, en: e.target.value } };
                        patch({ options: next });
                      }}
                    />
                    <Input
                      aria-label={t.forms.optionValue}
                      placeholder={t.forms.optionValue}
                      dir="ltr"
                      className="w-32"
                      value={option.value}
                      onChange={(e) => {
                        const next = [...field.options];
                        next[index] = { ...option, value: e.target.value };
                        patch({ options: next });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.common.delete}
                      onClick={() =>
                        patch({ options: field.options.filter((o) => o.id !== option.id) })
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ------------------------------------------------- validation */}
          {isAnswerable(field.type) ? (
            <div>
              <Label className="mb-2 block">{t.forms.validation}</Label>
              <div className="grid grid-cols-2 gap-3">
                {field.type === 'number' ? (
                  <>
                    <Field label={t.forms.min} htmlFor="min">
                      <Input
                        id="min"
                        type="number"
                        dir="ltr"
                        value={field.validation.min ?? ''}
                        onChange={(e) =>
                          patch({
                            validation: {
                              ...field.validation,
                              min: e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                    <Field label={t.forms.max} htmlFor="max">
                      <Input
                        id="max"
                        type="number"
                        dir="ltr"
                        value={field.validation.max ?? ''}
                        onChange={(e) =>
                          patch({
                            validation: {
                              ...field.validation,
                              max: e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                  </>
                ) : null}

                {field.type === 'short_text' || field.type === 'long_text' ? (
                  <>
                    <Field label={t.forms.minLength} htmlFor="minLength">
                      <Input
                        id="minLength"
                        type="number"
                        dir="ltr"
                        value={field.validation.minLength ?? ''}
                        onChange={(e) =>
                          patch({
                            validation: {
                              ...field.validation,
                              minLength: e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                    <Field label={t.forms.maxLength} htmlFor="maxLength">
                      <Input
                        id="maxLength"
                        type="number"
                        dir="ltr"
                        value={field.validation.maxLength ?? ''}
                        onChange={(e) =>
                          patch({
                            validation: {
                              ...field.validation,
                              maxLength: e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                  </>
                ) : null}

                {field.type === 'rating' ? (
                  <Field label={t.forms.scale} htmlFor="scale">
                    <Input
                      id="scale"
                      type="number"
                      min={2}
                      max={10}
                      dir="ltr"
                      value={field.validation.scale ?? 5}
                      onChange={(e) =>
                        patch({ validation: { ...field.validation, scale: Number(e.target.value) } })
                      }
                    />
                  </Field>
                ) : null}

                {field.type === 'file' || field.type === 'image' ? (
                  <>
                    <Field label={t.forms.accept} htmlFor="accept">
                      <Input
                        id="accept"
                        dir="ltr"
                        placeholder=".pdf,.png"
                        value={(field.validation.accept ?? []).join(',')}
                        onChange={(e) =>
                          patch({
                            validation: {
                              ...field.validation,
                              accept: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                      />
                    </Field>
                    <Field label={t.forms.maxSize} htmlFor="maxSize">
                      <Input
                        id="maxSize"
                        type="number"
                        dir="ltr"
                        value={field.validation.maxSizeMb ?? ''}
                        onChange={(e) =>
                          patch({
                            validation: {
                              ...field.validation,
                              maxSizeMb: e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <Separator />

          {/* --------------------------------------------- rule editor */}
          <div>
            <Label className="mb-1 block">{t.forms.conditional}</Label>
            <p className="mb-3 text-xs text-ink-subtle">{t.forms.conditionalHint}</p>

            {ownRules.length === 0 ? (
              <p className="mb-3 text-sm text-ink-subtle">{t.forms.noRules}</p>
            ) : (
              <ul className="mb-3 flex flex-col gap-2">
                {ownRules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-muted/50 p-2.5 text-sm"
                  >
                    <span className="text-ink-subtle">{t.forms.ruleWhen}</span>
                    <NativeSelect
                      aria-label={t.forms.ruleWhen}
                      className="h-8 w-40 text-xs"
                      value={rule.source_field_id}
                      onChange={(e) =>
                        onRulesChange(
                          rules.map((r) =>
                            r.id === rule.id ? { ...r, source_field_id: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      {sourceCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {b(candidate.label)}
                        </option>
                      ))}
                    </NativeSelect>

                    <NativeSelect
                      aria-label={t.forms.ruleIs}
                      className="h-8 w-32 text-xs"
                      value={rule.operator}
                      onChange={(e) =>
                        onRulesChange(
                          rules.map((r) =>
                            r.id === rule.id ? { ...r, operator: e.target.value as RuleOperator } : r,
                          ),
                        )
                      }
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {locale === 'ar' ? OPERATOR_LABEL[op].ar : OPERATOR_LABEL[op].en}
                        </option>
                      ))}
                    </NativeSelect>

                    {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' ? (
                      <Input
                        aria-label={t.forms.optionValue}
                        className="h-8 w-28 text-xs"
                        value={rule.value}
                        onChange={(e) =>
                          onRulesChange(
                            rules.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r)),
                          )
                        }
                      />
                    ) : null}

                    <span className="text-ink-subtle">{t.forms.ruleThen}</span>
                    <NativeSelect
                      aria-label={t.forms.ruleThen}
                      className="h-8 w-36 text-xs"
                      value={rule.action}
                      onChange={(e) =>
                        onRulesChange(
                          rules.map((r) =>
                            r.id === rule.id ? { ...r, action: e.target.value as 'show' | 'hide' } : r,
                          ),
                        )
                      }
                    >
                      <option value="show">{t.forms.ruleShow}</option>
                      <option value="hide">{t.forms.ruleHide}</option>
                    </NativeSelect>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ms-auto"
                      aria-label={t.common.delete}
                      onClick={() => onRulesChange(rules.filter((r) => r.id !== rule.id))}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="secondary"
              size="sm"
              disabled={sourceCandidates.length === 0}
              onClick={() =>
                onRulesChange([
                  ...rules,
                  {
                    id: uid('rule'),
                    form_id: field.form_id,
                    target_field_id: field.id,
                    source_field_id: sourceCandidates[0].id,
                    operator: 'equals',
                    value: '',
                    action: 'show',
                  },
                ])
              }
            >
              <Plus aria-hidden />
              {t.forms.addRule}
            </Button>
          </div>
        </DrawerBody>

        <DrawerFooter>
          <Button onClick={onClose}>{t.common.close}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
