'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Check, Eye, Loader2, Send, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Checkbox,
  Field,
  Label,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { getRepository } from '@/lib/data';
import type {
  Form,
  FormAudience,
  FormField,
  FormPublication,
  FormRule,
  FormSection,
  Team,
} from '@/lib/data/types';
import { FIELD_TYPE_MAP } from '@/lib/forms/field-types';
import { FieldPalette } from '@/components/forms/field-palette';
import { BuilderCanvas } from '@/components/forms/builder-canvas';
import { FieldSettingsDrawer } from '@/components/forms/field-settings-drawer';
import { SharePanel } from '@/components/forms/share-panel';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';
import type { FieldType } from '@/lib/data/types';
import { uid } from '@/lib/utils';

export default function FormBuilderPage() {
  const { t, b, href } = useI18n();
  const params = useParams<{ formId: string }>();
  const router = useRouter();
  const formId = params.formId;

  const [form, setForm] = useState<Form | null>(null);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [rules, setRules] = useState<FormRule[]>([]);
  const [audience, setAudience] = useState<FormAudience[]>([]);
  const [publication, setPublication] = useState<FormPublication | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    const repo = getRepository();
    const loaded = await repo.getForm(formId);
    if (!loaded) {
      setLoading(false);
      return;
    }
    const [s, f, r, a, p, tm] = await Promise.all([
      repo.listSections(formId),
      repo.listFields(formId),
      repo.listRules(formId),
      repo.listAudience(formId),
      repo.getPublication(formId),
      repo.listTeams(),
    ]);
    setForm(loaded);
    setSections(s);
    setFields(f);
    setRules(r);
    setAudience(a);
    setPublication(p);
    setTeams(tm);
    setLoading(false);
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => fields.find((f) => f.id === selectedId) ?? null, [fields, selectedId]);

  function touch() {
    setDirty(true);
    setJustSaved(false);
  }

  function addField(type: FieldType, atIndex?: number) {
    const meta = FIELD_TYPE_MAP[type];
    const sectionId = sections[0]?.id ?? uid('section');
    if (!sections.length) {
      setSections([
        {
          id: sectionId,
          form_id: formId,
          title: { ar: 'القسم الأول', en: 'Section one' },
          description: { ar: '', en: '' },
          position: 0,
        },
      ]);
    }
    const field: FormField = {
      id: uid('field'),
      form_id: formId,
      section_id: sectionId,
      type,
      label: { ar: meta.label.ar, en: meta.label.en },
      description: { ar: '', en: '' },
      placeholder: { ar: '', en: '' },
      required: false,
      position: atIndex ?? fields.length,
      options: meta.hasOptions
        ? [
            { id: uid('option'), value: 'option_1', label: { ar: 'الخيار الأول', en: 'Option one' } },
            { id: uid('option'), value: 'option_2', label: { ar: 'الخيار الثاني', en: 'Option two' } },
          ]
        : [],
      validation: type === 'rating' ? { scale: 5 } : {},
      default_value: '',
    };
    const next = [...fields];
    next.splice(atIndex ?? fields.length, 0, field);
    setFields(next.map((f, i) => ({ ...f, position: i })));
    setSelectedId(field.id);
    touch();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const fromPalette = String(active.id).startsWith('palette:');
    if (fromPalette) {
      const type = String(active.id).slice('palette:'.length) as FieldType;
      const overIndex = fields.findIndex((f) => f.id === over.id);
      addField(type, overIndex === -1 ? fields.length : overIndex);
      return;
    }
    if (active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from === -1 || to === -1) return;
    setFields(arrayMove(fields, from, to).map((f, i) => ({ ...f, position: i })));
    touch();
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    const repo = getRepository();
    await repo.updateForm(form.id, {
      title: form.title,
      description: form.description,
      settings: form.settings,
    });
    await repo.saveSections(form.id, sections);
    await repo.saveFields(form.id, fields);
    await repo.saveRules(form.id, rules);
    await repo.saveAudience(form.id, audience);
    setSaving(false);
    setDirty(false);
    setJustSaved(true);
  }

  async function publish() {
    await save();
    const pub = await getRepository().publishForm(formId);
    setPublication(pub);
    await load();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <Skeleton className="mb-6 h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-lg font-semibold text-ink">{t.errors.notFound}</p>
        <Button className="mt-4" onClick={() => router.push(href('/forms'))}>
          {t.forms.title}
        </Button>
      </div>
    );
  }

  const audienceScope = audience[0]?.scope ?? 'all';
  const targetedTeamIds = audience.filter((a) => a.scope === 'team' && a.team_id).map((a) => a.team_id!);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={b(form.title)}
        subtitle={t.forms.builderTitle}
        actions={
          <>
            <Badge
              tone={form.status === 'published' ? 'success' : form.status === 'closed' ? 'warning' : 'neutral'}
            >
              {form.status === 'published'
                ? t.common.published
                : form.status === 'closed'
                  ? t.common.closed
                  : t.common.draft}
            </Badge>
            {dirty ? <Badge tone="warning">{t.forms.unsaved}</Badge> : null}
            <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye aria-hidden />
              {t.common.preview}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : justSaved ? <Check aria-hidden /> : null}
              {justSaved && !dirty ? t.common.saved : t.forms.saveDraft}
            </Button>
            {form.status === 'published' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await getRepository().closeForm(formId);
                  await load();
                }}
              >
                <XCircle aria-hidden />
                {t.forms.closeForm}
              </Button>
            ) : (
              <Button size="sm" onClick={() => void publish()}>
                <Send aria-hidden />
                {t.common.publish}
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="build">
        <TabsList className="mb-5 flex-wrap">
          <TabsTrigger value="build">{t.forms.tabBuild}</TabsTrigger>
          <TabsTrigger value="settings">{t.forms.tabSettings}</TabsTrigger>
          <TabsTrigger value="audience">{t.forms.tabAudience}</TabsTrigger>
          <TabsTrigger value="share">{t.forms.tabShare}</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------ build */}
        <TabsContent value="build">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[16rem_1fr]">
              <aside className="scroll-thin lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pe-2">
                <FieldPalette onAdd={(type) => addField(type)} />
              </aside>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">{t.forms.canvas}</h3>
                <BuilderCanvas
                  fields={fields}
                  rules={rules}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onDuplicate={(id) => {
                    const source = fields.find((f) => f.id === id);
                    if (!source) return;
                    const index = fields.findIndex((f) => f.id === id);
                    const copy: FormField = {
                      ...JSON.parse(JSON.stringify(source)),
                      id: uid('field'),
                      options: source.options.map((o) => ({ ...o, id: uid('option') })),
                    };
                    const next = [...fields];
                    next.splice(index + 1, 0, copy);
                    setFields(next.map((f, i) => ({ ...f, position: i })));
                    touch();
                  }}
                  onRemove={(id) => {
                    setFields(fields.filter((f) => f.id !== id).map((f, i) => ({ ...f, position: i })));
                    setRules(rules.filter((r) => r.target_field_id !== id && r.source_field_id !== id));
                    if (selectedId === id) setSelectedId(null);
                    touch();
                  }}
                  onMove={(id, direction) => {
                    const index = fields.findIndex((f) => f.id === id);
                    const target = index + direction;
                    if (index === -1 || target < 0 || target >= fields.length) return;
                    setFields(arrayMove(fields, index, target).map((f, i) => ({ ...f, position: i })));
                    touch();
                  }}
                />
              </section>
            </div>
          </DndContext>
        </TabsContent>

        {/* --------------------------------------------------------- settings */}
        <TabsContent value="settings">
          <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.forms.titleAr} htmlFor="titleAr">
              <Input
                id="titleAr"
                value={form.title.ar}
                onChange={(e) => {
                  setForm({ ...form, title: { ...form.title, ar: e.target.value } });
                  touch();
                }}
              />
            </Field>
            <Field label={t.forms.titleEn} htmlFor="titleEn">
              <Input
                id="titleEn"
                dir="ltr"
                value={form.title.en}
                onChange={(e) => {
                  setForm({ ...form, title: { ...form.title, en: e.target.value } });
                  touch();
                }}
              />
            </Field>

            <Field label={t.forms.formDescAr} htmlFor="descAr" className="sm:col-span-2">
              <Textarea
                id="descAr"
                rows={2}
                value={form.description.ar}
                onChange={(e) => {
                  setForm({ ...form, description: { ...form.description, ar: e.target.value } });
                  touch();
                }}
              />
            </Field>
            <Field label={t.forms.formDescEn} htmlFor="descEn" className="sm:col-span-2">
              <Textarea
                id="descEn"
                dir="ltr"
                rows={2}
                value={form.description.en}
                onChange={(e) => {
                  setForm({ ...form, description: { ...form.description, en: e.target.value } });
                  touch();
                }}
              />
            </Field>

            <Field label={t.forms.accentColor} htmlFor="accent">
              <div className="flex items-center gap-2">
                <input
                  id="accent"
                  type="color"
                  className="h-10 w-14 cursor-pointer rounded-md border border-line bg-surface p-1"
                  value={form.settings.accent_color}
                  onChange={(e) => {
                    setForm({ ...form, settings: { ...form.settings, accent_color: e.target.value } });
                    touch();
                  }}
                />
                <Input
                  dir="ltr"
                  aria-label={t.forms.accentColor}
                  value={form.settings.accent_color}
                  onChange={(e) => {
                    setForm({ ...form, settings: { ...form.settings, accent_color: e.target.value } });
                    touch();
                  }}
                />
              </div>
            </Field>

            <Field label={t.forms.responseLimit} htmlFor="limit">
              <Input
                id="limit"
                type="number"
                min={0}
                dir="ltr"
                value={form.settings.response_limit}
                onChange={(e) => {
                  setForm({
                    ...form,
                    settings: { ...form.settings, response_limit: Number(e.target.value) },
                  });
                  touch();
                }}
              />
            </Field>

            <Field label={t.forms.opensAt} htmlFor="opensAt">
              <Input
                id="opensAt"
                type="date"
                dir="ltr"
                value={form.settings.opens_at?.slice(0, 10) ?? ''}
                onChange={(e) => {
                  setForm({
                    ...form,
                    settings: {
                      ...form.settings,
                      opens_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    },
                  });
                  touch();
                }}
              />
            </Field>
            <Field label={t.forms.closesAt} htmlFor="closesAt">
              <Input
                id="closesAt"
                type="date"
                dir="ltr"
                value={form.settings.closes_at?.slice(0, 10) ?? ''}
                onChange={(e) => {
                  setForm({
                    ...form,
                    settings: {
                      ...form.settings,
                      closes_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    },
                  });
                  touch();
                }}
              />
            </Field>

            <Field label={t.forms.confirmationAr} htmlFor="confirmAr" className="sm:col-span-2">
              <Input
                id="confirmAr"
                value={form.settings.confirmation_message.ar}
                onChange={(e) => {
                  setForm({
                    ...form,
                    settings: {
                      ...form.settings,
                      confirmation_message: {
                        ...form.settings.confirmation_message,
                        ar: e.target.value,
                      },
                    },
                  });
                  touch();
                }}
              />
            </Field>
            <Field label={t.forms.confirmationEn} htmlFor="confirmEn" className="sm:col-span-2">
              <Input
                id="confirmEn"
                dir="ltr"
                value={form.settings.confirmation_message.en}
                onChange={(e) => {
                  setForm({
                    ...form,
                    settings: {
                      ...form.settings,
                      confirmation_message: {
                        ...form.settings.confirmation_message,
                        en: e.target.value,
                      },
                    },
                  });
                  touch();
                }}
              />
            </Field>

            <div className="flex flex-col gap-3 sm:col-span-2">
              <ToggleRow
                label={t.forms.multiStep}
                hint={t.forms.multiStepHint}
                checked={form.settings.multi_step}
                onChange={(checked) => {
                  setForm({ ...form, settings: { ...form.settings, multi_step: checked } });
                  touch();
                }}
              />
              <ToggleRow
                label={t.forms.allowDrafts}
                checked={form.settings.allow_drafts}
                onChange={(checked) => {
                  setForm({ ...form, settings: { ...form.settings, allow_drafts: checked } });
                  touch();
                }}
              />
              <ToggleRow
                label={t.forms.allowEdit}
                checked={form.settings.allow_edit_after_submit}
                onChange={(checked) => {
                  setForm({
                    ...form,
                    settings: { ...form.settings, allow_edit_after_submit: checked },
                  });
                  touch();
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* --------------------------------------------------------- audience */}
        <TabsContent value="audience">
          <div className="max-w-3xl">
            <Field label={t.forms.audience} htmlFor="audienceScope">
              <NativeSelect
                id="audienceScope"
                value={audienceScope}
                onChange={(e) => {
                  const scope = e.target.value as 'all' | 'team';
                  setAudience(
                    scope === 'all'
                      ? [{ id: uid('aud'), form_id: formId, scope: 'all', team_id: null }]
                      : [],
                  );
                  touch();
                }}
              >
                <option value="all">{t.forms.audienceAll}</option>
                <option value="team">{t.forms.audienceSelected}</option>
              </NativeSelect>
            </Field>

            {audienceScope === 'team' ? (
              <div className="mt-4">
                <p className="mb-3 text-sm text-ink-muted">
                  {t.forms.audienceCount.replace('{n}', String(targetedTeamIds.length))}
                </p>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {teams
                    .filter((team) => team.status === 'active')
                    .map((team) => {
                      const checked = targetedTeamIds.includes(team.id);
                      return (
                        <li key={team.id}>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2.5 text-sm transition-colors hover:border-accent">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                setAudience(
                                  value === true
                                    ? [
                                        ...audience,
                                        {
                                          id: uid('aud'),
                                          form_id: formId,
                                          scope: 'team',
                                          team_id: team.id,
                                        },
                                      ]
                                    : audience.filter((a) => a.team_id !== team.id),
                                );
                                touch();
                              }}
                            />
                            <span className="truncate text-ink">{b(team.name)}</span>
                          </label>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ) : null}
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------ share */}
        <TabsContent value="share">
          <SharePanel publication={form.status === 'draft' ? null : publication} />
        </TabsContent>
      </Tabs>

      <FieldSettingsDrawer
        field={selected}
        allFields={fields}
        rules={rules}
        onChange={(updated) => {
          setFields(fields.map((f) => (f.id === updated.id ? updated : f)));
          touch();
        }}
        onRulesChange={(next) => {
          setRules(next);
          touch();
        }}
        onClose={() => setSelectedId(null)}
      />

      <FormPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        form={form}
        fields={fields}
        rules={rules}
        teams={teams}
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-line px-3 py-2.5">
      <div>
        <Label>{label}</Label>
        {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
