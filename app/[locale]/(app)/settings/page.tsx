'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field, Separator } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { getRepository, isDemoMode } from '@/lib/data';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Cohort, CohortStatus, Organization, Repository } from '@/lib/data/types';

export default function SettingsPage() {
  const { t } = useI18n();
  const query = useCallback(
    async (repo: Repository) => ({
      organization: await repo.getOrganization(),
      cohort: await repo.getCohort(),
    }),
    [],
  );
  const { data } = useRepoQuery(query, {
    organization: null as Organization | null,
    cohort: null as Cohort | null,
  });

  const [org, setOrg] = useState<Organization | null>(null);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data.organization) setOrg(data.organization);
    if (data.cohort) setCohort(data.cohort);
  }, [data.organization, data.cohort]);

  if (!org || !cohort) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.settings.title}
        subtitle={t.settings.subtitle}
        actions={
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const repo = getRepository();
              await repo.updateOrganization({ name: org.name, slug: org.slug });
              await repo.updateCohort({
                name: cohort.name,
                status: cohort.status,
                starts_on: cohort.starts_on,
                ends_on: cohort.ends_on,
                current_milestone: cohort.current_milestone,
                next_milestone_at: cohort.next_milestone_at,
              });
              setSaving(false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2200);
            }}
          >
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : saved ? <Check aria-hidden /> : null}
            {saved ? t.common.saved : t.common.save}
          </Button>
        }
      />

      <section className="mb-8">
        <h3 className="mb-4 text-sm font-semibold text-ink">{t.settings.orgSection}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.settings.orgNameAr} htmlFor="orgNameAr">
            <Input
              id="orgNameAr"
              value={org.name.ar}
              onChange={(e) => setOrg({ ...org, name: { ...org.name, ar: e.target.value } })}
            />
          </Field>
          <Field label={t.settings.orgNameEn} htmlFor="orgNameEn">
            <Input
              id="orgNameEn"
              dir="ltr"
              value={org.name.en}
              onChange={(e) => setOrg({ ...org, name: { ...org.name, en: e.target.value } })}
            />
          </Field>
          <Field label={t.settings.orgSlug} htmlFor="orgSlug">
            <Input
              id="orgSlug"
              dir="ltr"
              value={org.slug}
              onChange={(e) => setOrg({ ...org, slug: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <Separator className="my-8" />

      <section>
        <h3 className="mb-4 text-sm font-semibold text-ink">{t.settings.cohortSection}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.settings.cohortNameAr} htmlFor="cohortNameAr">
            <Input
              id="cohortNameAr"
              value={cohort.name.ar}
              onChange={(e) => setCohort({ ...cohort, name: { ...cohort.name, ar: e.target.value } })}
            />
          </Field>
          <Field label={t.settings.cohortNameEn} htmlFor="cohortNameEn">
            <Input
              id="cohortNameEn"
              dir="ltr"
              value={cohort.name.en}
              onChange={(e) => setCohort({ ...cohort, name: { ...cohort.name, en: e.target.value } })}
            />
          </Field>

          <Field label={t.settings.cohortStatus} htmlFor="cohortStatus">
            <NativeSelect
              id="cohortStatus"
              value={cohort.status}
              onChange={(e) => setCohort({ ...cohort, status: e.target.value as CohortStatus })}
            >
              <option value="draft">{t.common.draft}</option>
              <option value="active">{t.common.active}</option>
              <option value="completed">{t.common.closed}</option>
              <option value="archived">{t.common.archived}</option>
            </NativeSelect>
          </Field>
          <Field label={t.settings.nextMilestone} htmlFor="nextMilestone">
            <Input
              id="nextMilestone"
              type="date"
              dir="ltr"
              value={cohort.next_milestone_at ?? ''}
              onChange={(e) => setCohort({ ...cohort, next_milestone_at: e.target.value || null })}
            />
          </Field>

          <Field label={t.settings.startsOn} htmlFor="startsOn">
            <Input
              id="startsOn"
              type="date"
              dir="ltr"
              value={cohort.starts_on}
              onChange={(e) => setCohort({ ...cohort, starts_on: e.target.value })}
            />
          </Field>
          <Field label={t.settings.endsOn} htmlFor="endsOn">
            <Input
              id="endsOn"
              type="date"
              dir="ltr"
              value={cohort.ends_on}
              onChange={(e) => setCohort({ ...cohort, ends_on: e.target.value })}
            />
          </Field>

          <Field label={t.settings.milestoneAr} htmlFor="milestoneAr" className="sm:col-span-2">
            <Input
              id="milestoneAr"
              value={cohort.current_milestone.ar}
              onChange={(e) =>
                setCohort({
                  ...cohort,
                  current_milestone: { ...cohort.current_milestone, ar: e.target.value },
                })
              }
            />
          </Field>
          <Field label={t.settings.milestoneEn} htmlFor="milestoneEn" className="sm:col-span-2">
            <Input
              id="milestoneEn"
              dir="ltr"
              value={cohort.current_milestone.en}
              onChange={(e) =>
                setCohort({
                  ...cohort,
                  current_milestone: { ...cohort.current_milestone, en: e.target.value },
                })
              }
            />
          </Field>
        </div>
      </section>

      {isDemoMode() ? (
        <>
          <Separator className="my-8" />
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t.settings.dangerZone}</h3>
            <p className="mb-3 text-sm text-ink-muted">{t.settings.resetDemoHint}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                if (!window.confirm(t.settings.resetDemoConfirm)) return;
                await getRepository().resetDemoData?.();
                window.location.reload();
              }}
            >
              <RotateCcw aria-hidden />
              {t.settings.resetDemo}
            </Button>
          </section>
        </>
      ) : null}
    </div>
  );
}
