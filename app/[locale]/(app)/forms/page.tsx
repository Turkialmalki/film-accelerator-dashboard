'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, FileText, MoreHorizontal, Plus, Trash2, Unlock, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Skeleton,
} from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import { getRepository } from '@/lib/data';
import type { Form, FormTemplateKey, Repository, Submission } from '@/lib/data/types';
import { TemplateChooser } from '@/components/forms/template-chooser';
import { buildTemplate, TEMPLATE_MAP } from '@/lib/forms/templates';
import { CINEMA_WHITE } from '@/lib/theme/presets';
import { COHORT_ID, ORG_ID } from '@/lib/data/seed';
import { uid } from '@/lib/utils';

export default function FormsPage() {
  const { t, b, fmtNumber, fmtDate, href } = useI18n();
  const router = useRouter();
  const [chooserOpen, setChooserOpen] = useState(false);

  const query = useCallback(
    async (repo: Repository) => ({
      forms: await repo.listForms(),
      submissions: await repo.listSubmissions(),
      fields: await Promise.all((await repo.listForms()).map((f) => repo.listFields(f.id))),
    }),
    [],
  );
  const { data, loading } = useRepoQuery(query, {
    forms: [] as Form[],
    submissions: [] as Submission[],
    fields: [] as Awaited<ReturnType<Repository['listFields']>>[],
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    data.submissions.forEach((s) => {
      if (s.status === 'draft') return;
      map.set(s.form_id, (map.get(s.form_id) ?? 0) + 1);
    });
    return map;
  }, [data.submissions]);

  async function createFromTemplate(key: FormTemplateKey) {
    const repo = getRepository();
    const blueprint = TEMPLATE_MAP[key];
    const form = await repo.createForm({
      org_id: ORG_ID,
      cohort_id: COHORT_ID,
      template_key: key,
      title: blueprint.title,
      description: blueprint.description,
      status: 'draft',
      settings: {
        accent_color: CINEMA_WHITE.accent,
        multi_step: false,
        allow_drafts: true,
        allow_edit_after_submit: true,
        response_limit: 0,
        opens_at: null,
        closes_at: null,
        confirmation_message: {
          ar: 'وصلتنا إجابتك. شكراً لوقتك.',
          en: 'We have your response. Thank you for your time.',
        },
      },
      created_by: 'profile_admin',
    });

    const built = buildTemplate(key, form.id, (scope) => uid(scope));
    await repo.saveSections(form.id, built.sections);
    await repo.saveFields(form.id, built.fields);
    await repo.saveRules(form.id, built.rules);

    setChooserOpen(false);
    router.push(href(`/forms/${form.id}`));
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={t.forms.title}
        subtitle={t.forms.subtitle}
        actions={
          <Button size="sm" onClick={() => setChooserOpen(true)}>
            <Plus aria-hidden />
            {t.forms.newForm}
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : data.forms.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={t.forms.noForms}
          action={
            <Button size="sm" onClick={() => setChooserOpen(true)}>
              <Plus aria-hidden />
              {t.forms.newForm}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.forms.map((form, index) => (
            <article
              key={form.id}
              className="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={href(`/forms/${form.id}`)}
                  className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <h3 className="truncate text-base font-semibold text-ink hover:text-accent">
                    {b(form.title)}
                  </h3>
                </Link>
                <FormMenu form={form} />
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  tone={
                    form.status === 'published' ? 'success' : form.status === 'closed' ? 'warning' : 'neutral'
                  }
                >
                  {form.status === 'published'
                    ? t.common.published
                    : form.status === 'closed'
                      ? t.common.closed
                      : t.common.draft}
                </Badge>
                <Badge tone="outline">{b(TEMPLATE_MAP[form.template_key].title)}</Badge>
              </div>

              <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-muted">{b(form.description)}</p>

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
                <div>
                  <dt className="text-ink-subtle">{t.forms.fieldsLabel}</dt>
                  <dd className="tnum font-semibold text-ink">
                    {fmtNumber(data.fields[index]?.length ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">{t.forms.responsesLabel}</dt>
                  <dd className="tnum font-semibold text-ink">{fmtNumber(counts.get(form.id) ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">{t.forms.closesAt}</dt>
                  <dd className="tnum font-semibold text-ink">{fmtDate(form.settings.closes_at)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <TemplateChooser
        open={chooserOpen}
        onOpenChange={setChooserOpen}
        onChoose={(key) => void createFromTemplate(key)}
      />
    </div>
  );
}

function FormMenu({ form }: { form: Form }) {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void getRepository().duplicateForm(form.id)}>
          <Copy aria-hidden />
          {t.forms.duplicate}
        </DropdownMenuItem>
        {form.status === 'published' ? (
          <DropdownMenuItem onSelect={() => void getRepository().closeForm(form.id)}>
            <XCircle aria-hidden />
            {t.forms.closeForm}
          </DropdownMenuItem>
        ) : form.status === 'closed' ? (
          <DropdownMenuItem onSelect={() => void getRepository().publishForm(form.id)}>
            <Unlock aria-hidden />
            {t.forms.reopen}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={() => {
            if (window.confirm(t.forms.deleteConfirm)) void getRepository().deleteForm(form.id);
          }}
        >
          <Trash2 aria-hidden />
          {t.common.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
