import type { Team, TeamInput, TeamStage } from '@/lib/data/types';
import { csvToObjects } from '@/lib/csv';

/** The exchange format for the Teams import/export round-trip. */
export const TEAM_CSV_HEADER = [
  'slug',
  'name_ar',
  'name_en',
  'track_ar',
  'track_en',
  'city_ar',
  'city_en',
  'stage',
  'readiness',
  'team_size',
  'revenue_band',
  'business_model_ar',
  'business_model_en',
  'status',
  'founders',
] as const;

const STAGES: TeamStage[] = ['idea', 'mvp', 'pre-seed', 'seed', 'pre-a', 'series-a', 'growth'];

export function teamsToCsvRows(teams: Team[]): (string | number)[][] {
  return [
    [...TEAM_CSV_HEADER],
    ...teams.map((team) => [
      team.slug,
      team.name.ar,
      team.name.en,
      team.track.ar,
      team.track.en,
      team.city.ar,
      team.city.en,
      team.stage,
      team.readiness,
      team.team_size,
      team.revenue_band,
      team.business_model.ar,
      team.business_model.en,
      team.status,
      // Founders collapse to "name (role)" pairs separated by a pipe, which
      // survives a round-trip through Excel without needing a second sheet.
      team.founders.map((f) => `${f.name.ar} (${f.role.ar})`).join(' | '),
    ]),
  ];
}

export function csvToTeamInputs(
  text: string,
  orgId: string,
  cohortId: string,
): Partial<TeamInput>[] {
  return csvToObjects(text)
    .filter((row) => row.slug || row.name_ar || row.name_en)
    .map((row) => {
      const stage = STAGES.includes(row.stage as TeamStage) ? (row.stage as TeamStage) : 'seed';
      const founders = (row.founders ?? '')
        .split('|')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const match = chunk.match(/^(.*?)\s*\((.*)\)$/);
          const name = (match?.[1] ?? chunk).trim();
          const role = (match?.[2] ?? '').trim();
          return { name: { ar: name, en: name }, role: { ar: role, en: role } };
        });

      const input: Partial<TeamInput> = {
        org_id: orgId,
        cohort_id: cohortId,
        slug: row.slug || undefined,
        name: { ar: row.name_ar ?? '', en: row.name_en ?? '' },
        track: { ar: row.track_ar ?? '', en: row.track_en ?? '' },
        city: { ar: row.city_ar ?? '', en: row.city_en ?? '' },
        stage,
        readiness: Number(row.readiness) || 0,
        team_size: Number(row.team_size) || 0,
        revenue_band: row.revenue_band ?? '',
        business_model: { ar: row.business_model_ar ?? '', en: row.business_model_en ?? '' },
        status: row.status === 'archived' ? 'archived' : 'active',
      };
      if (founders.length) input.founders = founders;
      return input;
    });
}
