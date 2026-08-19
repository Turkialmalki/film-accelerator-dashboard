'use client';

import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { getRepository } from '@/lib/data';
import type { Team, TeamInput, TeamStage } from '@/lib/data/types';
import { COHORT_ID, ORG_ID } from '@/lib/data/seed';

const STAGES: TeamStage[] = ['idea', 'mvp', 'pre-seed', 'seed', 'pre-a', 'series-a', 'growth'];

const schema = z.object({
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  slug: z.string().min(1),
  trackAr: z.string(),
  trackEn: z.string(),
  cityAr: z.string(),
  cityEn: z.string(),
  stage: z.enum(['idea', 'mvp', 'pre-seed', 'seed', 'pre-a', 'series-a', 'growth']),
  readiness: z.number().min(0).max(100),
  teamSize: z.number().min(0),
  revenueBand: z.string(),
  businessModelAr: z.string(),
  businessModelEn: z.string(),
  descriptionAr: z.string(),
  internalNotes: z.string(),
  founders: z.array(z.object({ name: z.string(), role: z.string() })),
});

type Values = z.infer<typeof schema>;

function toValues(team: Team | null): Values {
  return {
    nameAr: team?.name.ar ?? '',
    nameEn: team?.name.en ?? '',
    slug: team?.slug ?? '',
    trackAr: team?.track.ar ?? '',
    trackEn: team?.track.en ?? '',
    cityAr: team?.city.ar ?? '',
    cityEn: team?.city.en ?? '',
    stage: team?.stage ?? 'seed',
    readiness: team?.readiness ?? 50,
    teamSize: team?.team_size ?? 1,
    revenueBand: team?.revenue_band ?? '',
    businessModelAr: team?.business_model.ar ?? '',
    businessModelEn: team?.business_model.en ?? '',
    descriptionAr: team?.description.ar ?? '',
    internalNotes: team?.internal_notes ?? '',
    founders: (team?.founders ?? []).map((f) => ({ name: f.name.ar, role: f.role.ar })),
  };
}

export function TeamFormDialog({
  open,
  onOpenChange,
  team,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
}) {
  const { t } = useI18n();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(team) });

  const founders = useFieldArray({ control, name: 'founders' });

  useEffect(() => {
    if (open) reset(toValues(team));
  }, [open, team, reset]);

  async function onSubmit(values: Values) {
    const payload: TeamInput = {
      org_id: team?.org_id ?? ORG_ID,
      cohort_id: team?.cohort_id ?? COHORT_ID,
      slug: values.slug.trim(),
      name: { ar: values.nameAr, en: values.nameEn },
      track: { ar: values.trackAr, en: values.trackEn },
      description: { ar: values.descriptionAr, en: team?.description.en ?? values.descriptionAr },
      city: { ar: values.cityAr, en: values.cityEn },
      stage: values.stage,
      readiness: values.readiness,
      revenue_band: values.revenueBand,
      team_size: values.teamSize,
      business_model: { ar: values.businessModelAr, en: values.businessModelEn },
      key_strengths: team?.key_strengths ?? [],
      challenges: team?.challenges ?? [],
      growth_path: team?.growth_path ?? '',
      founders: values.founders
        .filter((f) => f.name.trim())
        .map((f) => ({ name: { ar: f.name, en: f.name }, role: { ar: f.role, en: f.role } })),
      status: team?.status ?? 'active',
      internal_notes: values.internalNotes,
    };

    const repo = getRepository();
    if (team) await repo.updateTeam(team.id, payload);
    else await repo.createTeam(payload);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{team ? t.teams.editTeam : t.teams.addTeam}</DialogTitle>
          <DialogDescription>{t.teams.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.teams.nameAr} htmlFor="nameAr" error={errors.nameAr && t.common.required}>
              <Input id="nameAr" {...register('nameAr')} />
            </Field>
            <Field label={t.teams.nameEn} htmlFor="nameEn" error={errors.nameEn && t.common.required}>
              <Input id="nameEn" dir="ltr" {...register('nameEn')} />
            </Field>

            <Field label="slug" htmlFor="slug" error={errors.slug && t.common.required}>
              <Input id="slug" dir="ltr" {...register('slug')} />
            </Field>
            <Field label={t.teams.stage} htmlFor="stage">
              <NativeSelect id="stage" {...register('stage')}>
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {t.stages[stage]}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label={`${t.teams.track} (AR)`} htmlFor="trackAr">
              <Input id="trackAr" {...register('trackAr')} />
            </Field>
            <Field label={`${t.teams.track} (EN)`} htmlFor="trackEn">
              <Input id="trackEn" dir="ltr" {...register('trackEn')} />
            </Field>

            <Field label={`${t.teams.city} (AR)`} htmlFor="cityAr">
              <Input id="cityAr" {...register('cityAr')} />
            </Field>
            <Field label={`${t.teams.city} (EN)`} htmlFor="cityEn">
              <Input id="cityEn" dir="ltr" {...register('cityEn')} />
            </Field>

            <Field label={`${t.teams.readiness} (0–100)`} htmlFor="readiness">
              <Input
                id="readiness"
                type="number"
                min={0}
                max={100}
                dir="ltr"
                {...register('readiness', { valueAsNumber: true })}
              />
            </Field>
            <Field label={t.teams.teamSize} htmlFor="teamSize">
              <Input
                id="teamSize"
                type="number"
                min={0}
                dir="ltr"
                {...register('teamSize', { valueAsNumber: true })}
              />
            </Field>

            <Field label={t.teams.revenue} htmlFor="revenueBand">
              <Input id="revenueBand" {...register('revenueBand')} />
            </Field>
            <Field label={`${t.teams.businessModel} (AR)`} htmlFor="businessModelAr">
              <Input id="businessModelAr" {...register('businessModelAr')} />
            </Field>

            <Field label={t.teams.description} htmlFor="descriptionAr" className="sm:col-span-2">
              <Textarea id="descriptionAr" rows={3} {...register('descriptionAr')} />
            </Field>

            <Field
              label={t.teams.internalNotes}
              hint={t.teams.internalNotesHint}
              htmlFor="internalNotes"
              className="sm:col-span-2"
            >
              <Textarea id="internalNotes" rows={2} {...register('internalNotes')} />
            </Field>

            <div className="sm:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{t.teams.founders}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => founders.append({ name: '', role: '' })}
                >
                  <Plus aria-hidden />
                  {t.common.add}
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {founders.fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      aria-label={`${t.teams.founders} ${index + 1}`}
                      placeholder={t.profile.displayName}
                      {...register(`founders.${index}.name` as const)}
                    />
                    <Input
                      aria-label={`${t.profile.role} ${index + 1}`}
                      placeholder={t.profile.role}
                      {...register(`founders.${index}.role` as const)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => founders.remove(index)}
                      aria-label={t.common.delete}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
