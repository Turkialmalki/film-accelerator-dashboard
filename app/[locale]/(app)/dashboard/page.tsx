'use client';

import { useCallback, useMemo } from 'react';
import { useI18n } from '@/components/providers/locale-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Repository } from '@/lib/data/types';
import { computeKpis, responseTrend, stageDistribution, statusBreakdown } from '@/lib/analytics';
import { ProgramBanner } from '@/components/dashboard/program-banner';
import { KpiCard } from '@/components/dashboard/kpi-card';
import {
  ResponseTrend,
  StageBars,
  StatusDonut,
} from '@/components/dashboard/dashboard-charts';
import { Skeleton } from '@/components/ui/misc';

/**
 * The programme overview. Deliberately has no team table — the roster lives on
 * /teams, and duplicating it here would make this page a second, staler copy.
 */
export default function DashboardPage() {
  const { t } = useI18n();

  const query = useCallback(
    async (repo: Repository) => ({
      organization: await repo.getOrganization(),
      cohort: await repo.getCohort(),
      teams: await repo.listTeams(),
      forms: await repo.listForms(),
      submissions: await repo.listSubmissions(),
    }),
    [],
  );

  const { data, loading } = useRepoQuery(query, {
    organization: null,
    cohort: null,
    teams: [],
    forms: [],
    submissions: [],
  } as {
    organization: Awaited<ReturnType<Repository['getOrganization']>> | null;
    cohort: Awaited<ReturnType<Repository['getCohort']>> | null;
    teams: Awaited<ReturnType<Repository['listTeams']>>;
    forms: Awaited<ReturnType<Repository['listForms']>>;
    submissions: Awaited<ReturnType<Repository['listSubmissions']>>;
  });

  const kpis = useMemo(
    () => computeKpis(data.teams, data.forms, data.submissions),
    [data.teams, data.forms, data.submissions],
  );
  const status = useMemo(() => statusBreakdown(data.submissions), [data.submissions]);
  const trend = useMemo(() => responseTrend(data.submissions), [data.submissions]);
  const stages = useMemo(() => stageDistribution(data.teams), [data.teams]);

  return (
    <div className="mx-auto max-w-7xl">
      <ProgramBanner organization={data.organization} cohort={data.cohort} />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[124px]" />)
        ) : (
          <>
            <KpiCard
              index={0}
              icon="Users"
              label={t.dashboard.kpiTeams}
              hint={t.dashboard.kpiTeamsHint}
              value={kpis.teams}
            />
            <KpiCard
              index={1}
              icon="FileText"
              label={t.dashboard.kpiForms}
              hint={t.dashboard.kpiFormsHint}
              value={kpis.activeForms}
            />
            <KpiCard
              index={2}
              icon="Inbox"
              label={t.dashboard.kpiSubmissions}
              hint={t.dashboard.kpiSubmissionsHint}
              value={kpis.submissions}
            />
            <KpiCard
              index={3}
              icon="Gauge"
              label={t.dashboard.kpiRate}
              hint={t.dashboard.kpiRateHint}
              value={kpis.responseRate}
              suffix="%"
            />
            <KpiCard
              index={4}
              icon="ClipboardCheck"
              label={t.dashboard.kpiPending}
              hint={t.dashboard.kpiPendingHint}
              value={kpis.pendingReview}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatusDonut data={status} />
        <ResponseTrend data={trend} />
        <StageBars data={stages} />
      </div>
    </div>
  );
}
