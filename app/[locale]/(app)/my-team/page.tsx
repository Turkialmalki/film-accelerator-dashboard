'use client';

import { useCallback } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Progress } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Repository, Team } from '@/lib/data/types';

/**
 * The participant's own record. Note what is NOT here: `internal_notes` is
 * never read on this page, so a programme note cannot leak to the team even
 * if the demo store hands over the whole row.
 */
export default function MyTeamPage() {
  const { t, b, fmtNumber } = useI18n();
  const { session } = useSession();
  const teamId = session?.team_id ?? null;

  const query = useCallback(
    async (repo: Repository) => (teamId ? repo.getTeam(teamId) : null),
    [teamId],
  );
  const { data: team } = useRepoQuery<Team | null>(query, null);

  if (!team) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t.participant.myTeamTitle} subtitle={t.participant.myTeamSubtitle} />
        <EmptyState title={t.profile.noTeam} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={b(team.name)} subtitle={t.participant.myTeamSubtitle} />

      <div className="mb-5 flex flex-wrap gap-2">
        <Badge tone="accent">{t.stages[team.stage]}</Badge>
        <Badge tone="neutral">{b(team.track)}</Badge>
        <Badge tone="neutral">{b(team.city)}</Badge>
      </div>

      <div className="mb-6 rounded-lg border border-line bg-surface p-5 shadow-card">
        <p className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium text-ink">{t.teams.readiness}</span>
          <span className="tnum text-ink-muted">{fmtNumber(team.readiness)}%</span>
        </p>
        <Progress value={team.readiness} />
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t.teams.teamSize} value={fmtNumber(team.team_size)} />
        <Stat label={t.teams.revenue} value={team.revenue_band} />
        <Stat label={t.teams.businessModel} value={b(team.business_model)} />
        <Stat label={t.teams.city} value={b(team.city)} />
      </dl>

      {b(team.description) ? (
        <Section title={t.teams.description}>
          <p className="text-sm leading-relaxed text-ink-muted">{b(team.description)}</p>
        </Section>
      ) : null}

      {team.founders.length ? (
        <Section title={t.teams.founders}>
          <ul className="flex flex-col gap-2">
            {team.founders.map((founder, i) => (
              <li
                key={`${founder.name.ar}-${i}`}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">{b(founder.name)}</span>
                <span className="text-ink-subtle">{b(founder.role)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {team.key_strengths.length ? (
        <Section title={t.teams.strengths}>
          <Bullets items={team.key_strengths} color="var(--c-success)" />
        </Section>
      ) : null}

      {team.challenges.length ? (
        <Section title={t.teams.challenges}>
          <Bullets items={team.challenges} color="var(--c-warning)" />
        </Section>
      ) : null}

      {team.growth_path ? (
        <Section title={t.teams.growthPath}>
          <p className="text-sm leading-relaxed text-ink-muted">{team.growth_path}</p>
        </Section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value || '—'}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Bullets({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          {item}
        </li>
      ))}
    </ul>
  );
}
