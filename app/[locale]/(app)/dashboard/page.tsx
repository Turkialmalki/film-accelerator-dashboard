'use client';

import { useCallback, useMemo } from 'react';
import { useI18n } from '@/components/providers/locale-provider';
import { useRepoQuery } from '@/lib/hooks/use-repo';
import type { Repository } from '@/lib/data/types';
import {
  computeKpis,
  computePortfolioMetrics,
  responseTrend,
  stageDistribution,
  statusBreakdown,
} from '@/lib/analytics';
import { PageHeader } from '@/components/shell/page-header';
import { ProgramBanner } from '@/components/dashboard/program-banner';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PortfolioHealthPanel } from '@/components/dashboard/portfolio-health';
import {
  ReadinessByStageChart,
  RevenueBandChart,
  StageDistributionDonut,
} from '@/components/dashboard/portfolio-charts';
import { GeographyTeamStructurePanel } from '@/components/dashboard/portfolio-geo-structure';
import { ReadinessRankingCard } from '@/components/dashboard/portfolio-ranking';
import { PortfolioRisksPanel } from '@/components/dashboard/portfolio-risks';
import { ResponseTrend, StageBars, StatusDonut } from '@/components/dashboard/dashboard-charts';
import { Skeleton } from '@/components/ui/misc';
import { fmtTemplate } from '@/lib/utils';

/**
 * The executive overview. Deliberately has no team table — the roster lives
 * on /teams, and duplicating it here would make this page a second, staler
 * copy. Every number below is read from `computePortfolioMetrics`, a pure
 * function over the real 20-company cohort (see lib/analytics.ts).
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

  const portfolio = useMemo(() => computePortfolioMetrics(data.teams), [data.teams]);
  const kpis = useMemo(
    () => computeKpis(data.teams, data.forms, data.submissions),
    [data.teams, data.forms, data.submissions],
  );
  const status = useMemo(() => statusBreakdown(data.submissions), [data.submissions]);
  const trend = useMemo(() => responseTrend(data.submissions), [data.submissions]);
  const stages = useMemo(() => stageDistribution(data.teams), [data.teams]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t.dashboard.title} subtitle={t.portfolio.sectionEyebrow} />

      <ProgramBanner
        organization={data.organization}
        cohort={data.cohort}
        avgReadiness={portfolio.readiness.average}
      />

      {/* Primary KPI cards — the four numbers an executive reads first. */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[124px]" />)
        ) : (
          <>
            <KpiCard
              index={0}
              icon="Building2"
              label={t.portfolio.kpiCompanies}
              hint={t.portfolio.kpiCompaniesHint}
              value={portfolio.totalCompanies}
            />
            <KpiCard
              index={1}
              icon="Gauge"
              label={t.portfolio.kpiReadiness}
              hint={fmtTemplate(t.portfolio.kpiReadinessHint, {
                median: portfolio.readiness.median,
                min: portfolio.readiness.min,
                max: portfolio.readiness.max,
              })}
              value={Math.round(portfolio.readiness.average)}
              suffix="%"
            />
            <KpiCard
              index={2}
              icon="TrendingUp"
              label={t.portfolio.kpiRevenueActive}
              hint={t.portfolio.kpiRevenueActiveHint}
              value={portfolio.revenueActiveCount}
            />
            <KpiCard
              index={3}
              icon="ShieldCheck"
              label={t.portfolio.kpiInvestorReady}
              hint={t.portfolio.kpiInvestorReadyHint}
              value={portfolio.investorReadyCount}
            />
          </>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-[220px]" />
        ) : (
          <PortfolioHealthPanel
            health={portfolio.health}
            directJobs={portfolio.directJobs}
            operatingRegions={portfolio.operatingRegions}
            mvpCount={portfolio.mvpCount}
            avgTeamSize={portfolio.avgTeamSize}
          />
        )}
      </div>

      {/* Portfolio analytics — the answers to "how healthy is this cohort". */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[300px]" />)
        ) : (
          <>
            <StageDistributionDonut data={portfolio.stageDistribution} />
            <ReadinessByStageChart
              data={portfolio.readinessByStage}
              benchmark={Math.round(portfolio.readiness.average)}
            />
            <RevenueBandChart
              data={portfolio.revenueDistribution}
              minCumulativeSar={portfolio.minCumulativeRevenueSar}
            />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <Skeleton className="h-[280px]" />
            <Skeleton className="h-[280px]" />
          </>
        ) : (
          <>
            <GeographyTeamStructurePanel
              geography={portfolio.geography}
              structure={portfolio.teamStructure}
              totalCompanies={portfolio.totalCompanies}
            />
            <ReadinessRankingCard rows={portfolio.topReadiness} />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        {loading ? (
          <Skeleton className="h-[280px]" />
        ) : (
          <PortfolioRisksPanel
            risks={portfolio.risks}
            investorReady={portfolio.investorReady}
            watchlist={portfolio.watchlist}
          />
        )}
      </div>

      {/* Programme operations — forms and responses, demoted below the
          portfolio analytics but preserved in full from the previous build. */}
      <div className="mt-10 border-t border-line pt-6">
        <p className="text-sm font-semibold text-ink">{t.dashboard.operationsTitle}</p>
        <p className="mt-0.5 text-xs text-ink-subtle">{t.dashboard.operationsSubtitle}</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatusDonut data={status} />
          <ResponseTrend data={trend} />
          <StageBars data={stages} />
        </div>
      </div>
    </div>
  );
}
