'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Download,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, NativeSelect } from '@/components/ui/input';
import {
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Label,
  Progress,
  Skeleton,
} from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import { getRepository } from '@/lib/data';
import type { Repository, Team, TeamStage } from '@/lib/data/types';
import { TeamFormDialog } from '@/components/teams/team-form-dialog';
import { TeamDetailDrawer } from '@/components/teams/team-detail-drawer';
import { csvToTeamInputs, teamsToCsvRows } from '@/lib/teams-csv';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

type SortKey = 'name' | 'readiness' | 'stage' | 'updated';
type ViewMode = 'cards' | 'table';

const STAGES: TeamStage[] = ['idea', 'mvp', 'pre-seed', 'seed', 'pre-a', 'series-a', 'growth'];
const STAGE_RANK: Record<TeamStage, number> = {
  idea: 0,
  mvp: 1,
  'pre-seed': 2,
  seed: 3,
  'pre-a': 4,
  'series-a': 5,
  growth: 6,
};

export default function TeamsPage() {
  const { t, b, tf, fmtNumber, fmtDate, locale } = useI18n();
  const { session } = useSession();
  const query = useCallback((repo: Repository) => repo.listTeams(), []);
  const { data: teams, loading } = useRepoQuery<Team[]>(query, []);

  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<'all' | TeamStage>('all');
  const [track, setTrack] = useState('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState<ViewMode>('cards');

  const [editing, setEditing] = useState<Team | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detail, setDetail] = useState<Team | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const tracks = useMemo(
    () => Array.from(new Set(teams.map((team) => b(team.track)).filter(Boolean))).sort(),
    [teams, b],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return teams
      .filter((team) => (showArchived ? true : team.status === 'active'))
      .filter((team) => (stage === 'all' ? true : team.stage === stage))
      .filter((team) => (track === 'all' ? true : b(team.track) === track))
      .filter((team) =>
        needle
          ? [team.name.ar, team.name.en, team.track.ar, team.track.en, team.city.ar, team.city.en, team.slug]
              .join(' ')
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, c) => {
        switch (sort) {
          case 'readiness':
            return c.readiness - a.readiness;
          case 'stage':
            return STAGE_RANK[c.stage] - STAGE_RANK[a.stage];
          case 'updated':
            return c.updated_at.localeCompare(a.updated_at);
          default:
            return b(a.name).localeCompare(b(c.name), locale === 'ar' ? 'ar' : 'en');
        }
      });
  }, [teams, search, stage, track, sort, showArchived, b, locale]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={t.teams.title}
        subtitle={t.teams.subtitle}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file || !session) return;
                try {
                  const text = await file.text();
                  const rows = csvToTeamInputs(text, session.org_id, session.cohort_id);
                  if (!rows.length) throw new Error('EMPTY');
                  const result = await getRepository().importTeams(rows);
                  setImportMessage(
                    tf(t.teams.importResult, { created: result.created, updated: result.updated }),
                  );
                } catch {
                  setImportMessage(t.teams.importFailed);
                }
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden />
              {t.common.import}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadCsv('fba-teams', teamsToCsvRows(visible))}
            >
              <Download aria-hidden />
              {t.common.export}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus aria-hidden />
              {t.teams.addTeam}
            </Button>
          </>
        }
      />

      {importMessage ? (
        <p className="mb-4 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink">
          {importMessage}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {importMessage}
      </p>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-subtle ltr:left-3 rtl:right-3"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.teams.searchPlaceholder}
            aria-label={t.common.search}
            className="ltr:pl-9 rtl:pr-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stageFilter" className="text-xs text-ink-subtle">
            {t.teams.stage}
          </Label>
          <NativeSelect
            id="stageFilter"
            value={stage}
            onChange={(e) => setStage(e.target.value as 'all' | TeamStage)}
            className="w-40"
          >
            <option value="all">{t.common.all}</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {t.stages[s]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trackFilter" className="text-xs text-ink-subtle">
            {t.teams.track}
          </Label>
          <NativeSelect
            id="trackFilter"
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className="w-52"
          >
            <option value="all">{t.common.all}</option>
            {tracks.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortBy" className="text-xs text-ink-subtle">
            {t.common.sort}
          </Label>
          <NativeSelect
            id="sortBy"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-40"
          >
            <option value="name">{t.teams.sortName}</option>
            <option value="readiness">{t.teams.sortReadiness}</option>
            <option value="stage">{t.teams.sortStage}</option>
            <option value="updated">{t.teams.sortUpdated}</option>
          </NativeSelect>
        </div>

        <label className="flex cursor-pointer items-center gap-2 py-2.5 text-sm text-ink-muted">
          <Checkbox
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          {t.teams.showArchived}
        </label>

        <div className="ms-auto flex items-center gap-1 rounded-md border border-line bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setView('cards')}
            aria-pressed={view === 'cards'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
              view === 'cards' ? 'bg-surface text-ink shadow-card' : 'text-ink-muted',
            )}
          >
            <LayoutGrid className="size-3.5" aria-hidden />
            {t.teams.cardView}
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
              view === 'table' ? 'bg-surface text-ink shadow-card' : 'text-ink-muted',
            )}
          >
            <Rows3 className="size-3.5" aria-hidden />
            {t.teams.tableView}
          </button>
        </div>
      </div>

      <p className="mb-3 text-sm text-ink-subtle">
        <span className="tnum font-medium text-ink">{fmtNumber(visible.length)}</span> {t.teams.count}
      </p>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<Users />} title={t.teams.noResults} />
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((team) => (
            <article
              key={team.id}
              className="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDetail(team)}
                  className="min-w-0 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <h3 className="truncate text-base font-semibold text-ink hover:text-accent">
                    {b(team.name)}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-ink-subtle">{b(team.track)}</p>
                </button>
                <TeamMenu team={team} onEdit={() => { setEditing(team); setDialogOpen(true); }} />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="accent">{t.stages[team.stage]}</Badge>
                <Badge tone="neutral">{b(team.city)}</Badge>
                {team.status === 'archived' ? (
                  <Badge tone="warning">{t.common.archived}</Badge>
                ) : null}
              </div>

              <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-muted">
                {b(team.description)}
              </p>

              <div className="mt-4">
                <p className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-ink-subtle">{t.teams.readiness}</span>
                  <span className="tnum font-medium text-ink">{fmtNumber(team.readiness)}%</span>
                </p>
                <Progress value={team.readiness} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-subtle">
                <span className="tnum">
                  {fmtNumber(team.team_size)} · {team.revenue_band}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setDetail(team)}>
                  {t.common.open}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="scroll-thin overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-subtle">
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.teams.nameAr}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.teams.track}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.teams.stage}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.teams.city}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.teams.readiness}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t.teams.sortUpdated}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-semibold">
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((team) => (
                <tr key={team.id} className="border-b border-line last:border-0 hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetail(team)}
                      className="font-medium text-ink hover:text-accent hover:underline"
                    >
                      {b(team.name)}
                    </button>
                    {team.status === 'archived' ? (
                      <Badge tone="warning" className="ms-2">
                        {t.common.archived}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{b(team.track)}</td>
                  <td className="px-4 py-3">
                    <Badge tone="accent">{t.stages[team.stage]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{b(team.city)}</td>
                  <td className="tnum px-4 py-3 text-ink-muted">{fmtNumber(team.readiness)}%</td>
                  <td className="tnum px-4 py-3 text-xs text-ink-subtle">{fmtDate(team.updated_at)}</td>
                  <td className="px-4 py-3 text-end">
                    <TeamMenu team={team} onEdit={() => { setEditing(team); setDialogOpen(true); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TeamFormDialog open={dialogOpen} onOpenChange={setDialogOpen} team={editing} />
      <TeamDetailDrawer
        team={detail}
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        onEdit={(team) => {
          setDetail(null);
          setEditing(team);
          setDialogOpen(true);
        }}
      />
    </div>
  );
}

function TeamMenu({ team, onEdit }: { team: Team; onEdit: () => void }) {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden />
          {t.common.edit}
        </DropdownMenuItem>
        {team.status === 'active' ? (
          <DropdownMenuItem
            onSelect={() => {
              if (window.confirm(t.teams.archiveConfirm)) void getRepository().archiveTeam(team.id);
            }}
          >
            <Archive aria-hidden />
            {t.common.archive}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => void getRepository().restoreTeam(team.id)}>
            <ArchiveRestore aria-hidden />
            {t.common.restore}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={() => {
            if (window.confirm(t.teams.deleteConfirm)) void getRepository().deleteTeam(team.id);
          }}
        >
          <Trash2 aria-hidden />
          {t.common.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
