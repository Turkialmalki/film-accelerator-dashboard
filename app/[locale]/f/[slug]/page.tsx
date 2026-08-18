'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { FbaLockup, FilmCommissionMark } from '@/components/brand/logo';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { getRepository } from '@/lib/data';
import type { Form, FormField, FormRule, Profile, Team } from '@/lib/data/types';
import { FormFiller } from '@/components/forms/form-filler';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

/**
 * The public share link for a published form. No session is required — the
 * link itself is the credential, which is what a QR code at the door needs.
 * A signed-in participant's team is attached automatically when present.
 */
export default function PublicFormPage() {
  const { t, b, locale, switchLocale } = useI18n();
  const { session } = useSession();
  const params = useParams<{ slug: string }>();

  const [state, setState] = useState<{
    form: Form | null;
    fields: FormField[];
    rules: FormRule[];
    teams: Team[];
    profiles: Profile[];
    loading: boolean;
  }>({ form: null, fields: [], rules: [], teams: [], profiles: [], loading: true });

  useEffect(() => {
    async function load() {
      const repo = getRepository();
      const form = await repo.getFormBySlug(params.slug);
      if (!form) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const [fields, rules, teams] = await Promise.all([
        repo.listFields(form.id),
        repo.listRules(form.id),
        repo.listTeams(),
      ]);
      setState({ form, fields, rules, teams, profiles: [], loading: false });
    }
    void load();
  }, [params.slug]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <FbaLockup className="h-8" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}
            aria-label={t.topbar.language}
          >
            <Languages aria-hidden />
            {locale === 'ar' ? 'English' : 'العربية'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {state.loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-ink-subtle" aria-hidden />
            <span className="sr-only">{t.common.loading}</span>
          </div>
        ) : !state.form ? (
          <EmptyState title={t.fill.notFound} />
        ) : state.form.status === 'closed' ? (
          <EmptyState title={t.fill.closedTitle} body={t.fill.closedBody} />
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-ink">{b(state.form.title)}</h1>
            {b(state.form.description) ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{b(state.form.description)}</p>
            ) : null}

            <div className="mt-8 rounded-lg border border-line bg-surface p-6 shadow-card">
              <FormFiller
                form={state.form}
                fields={state.fields}
                rules={state.rules}
                teams={state.teams}
                profiles={state.profiles}
                teamId={session?.team_id ?? null}
                profileId={session?.profile.id ?? null}
              />
            </div>
          </>
        )}
      </main>

      <footer className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-8 text-xs text-ink-subtle">
        <FilmCommissionMark className="h-5 opacity-70" />
        <span>{t.brand.name}</span>
      </footer>
    </div>
  );
}
