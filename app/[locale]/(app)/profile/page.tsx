'use client';

import { useCallback } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Repository, Team } from '@/lib/data/types';

export default function ProfilePage() {
  const { t, b, locale, switchLocale } = useI18n();
  const { session } = useSession();

  const query = useCallback((repo: Repository) => repo.listTeams(), []);
  const { data: teams } = useRepoQuery<Team[]>(query, []);

  if (!session) return null;
  const team = teams.find((item) => item.id === session.team_id) ?? null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.profile.title} subtitle={t.profile.subtitle} />

      <div className="flex flex-col gap-4">
        <Field label={t.profile.displayName} htmlFor="displayName">
          <Input id="displayName" readOnly value={b(session.profile.full_name)} />
        </Field>

        <Field label={t.profile.email} htmlFor="email">
          <Input id="email" readOnly dir="ltr" value={session.profile.email} />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">{t.profile.role}</p>
          <Badge tone="accent">{t.roles[session.role]}</Badge>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">{t.profile.team}</p>
          {team ? (
            <Badge tone="neutral">{b(team.name)}</Badge>
          ) : (
            <p className="text-sm text-ink-subtle">{t.profile.noTeam}</p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">{t.profile.preferredLocale}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={locale === 'ar' ? 'primary' : 'secondary'}
              onClick={() => switchLocale('ar')}
            >
              العربية
            </Button>
            <Button
              size="sm"
              variant={locale === 'en' ? 'primary' : 'secondary'}
              onClick={() => switchLocale('en')}
            >
              English
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
