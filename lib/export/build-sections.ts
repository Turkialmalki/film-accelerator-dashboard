import type { Finding, KpiSet, PortfolioMetrics, StageBar, StatusSlice, TrendPoint } from '@/lib/analytics';
import { findingCopy } from '@/lib/analytics-copy';
import type { Bilingual, Form, Team } from '@/lib/data/types';
import type { CalendlySummary } from '@/lib/calendly/summary';
import type { Dict } from '@/lib/i18n/dictionaries';
import type { ExportSection, ExportTable } from './types';

interface I18nHelpers {
  t: Dict;
  tf: (template: string, values: Record<string, string | number>) => string;
  b: (value: Bilingual | undefined | null) => string;
  fmtNumber: (value: number) => string;
  fmtDate: (value: string) => string;
}

export function buildCalendlySection(
  summary: CalendlySummary | null,
  i18n: I18nHelpers,
): ExportSection {
  const { t } = i18n;
  const kpiTable: ExportTable = {
    title: t.calendly.sectionTitle,
    headers: [t.common.metric, t.common.value],
    rows: summary
      ? [
          [t.calendly.kpiMentors, summary.mentors],
          [t.calendly.kpiSessionsCompleted, summary.sessionsCompleted],
          [t.calendly.kpiHoursCompleted, summary.hoursCompleted],
          [t.calendly.kpiSessionsCanceled, summary.sessionsCanceled],
          [t.calendly.kpiSessionsRescheduled, summary.sessionsRescheduled],
        ]
      : [],
  };
  const perMentorTable: ExportTable = {
    title: t.calendly.sessionsPerMentorTitle,
    headers: [t.calendly.kpiMentors, t.calendly.kpiSessionsCompleted],
    rows: summary ? summary.sessionsPerMentor.map((r) => [r.name, r.sessions]) : [],
  };
  return {
    id: 'calendly',
    label: t.calendly.sectionTitle,
    tables: [kpiTable, perMentorTable],
  };
}

export function buildPortfolioSection(
  portfolio: PortfolioMetrics,
  findings: Finding[],
  teams: Team[],
  i18n: I18nHelpers,
): ExportSection {
  const { t, tf, b, fmtNumber } = i18n;

  const kpiTable: ExportTable = {
    title: t.portfolio.sectionEyebrow,
    headers: [t.common.metric, t.common.value],
    rows: [
      [t.portfolio.kpiCompanies, portfolio.totalCompanies],
      [t.portfolio.kpiReadiness, `${Math.round(portfolio.readiness.average)}%`],
      [t.portfolio.kpiMvp, portfolio.mvpCount],
      [t.portfolio.kpiJobs, portfolio.directJobs],
      [t.portfolio.kpiRevenueActive, portfolio.revenueActiveCount],
      [t.portfolio.kpiInvestorReady, portfolio.investorReadyCount],
      [t.portfolio.kpiSoloRisk, portfolio.keyPersonRiskCount],
      [t.portfolio.healthScore, portfolio.health.score],
    ],
  };

  const findingsTable: ExportTable = {
    title: t.portfolio.findingsTitle,
    headers: [t.common.finding, t.common.detail],
    rows: findings.map((f) => {
      const copy = findingCopy(f, t, tf, b, fmtNumber);
      return [copy.title, copy.body];
    }),
  };

  const stageTable: ExportTable = {
    title: t.portfolio.stageDonutTitle,
    headers: [t.common.stage, t.common.companies, t.common.share],
    rows: portfolio.stageDistribution.map((r) => [
      t.stages[r.stage],
      r.count,
      `${Math.round(r.pct)}%`,
    ]),
  };

  const readinessStageTable: ExportTable = {
    title: t.portfolio.readinessStageTitle,
    headers: [t.common.stage, t.portfolio.kpiReadiness, t.common.companies],
    rows: portfolio.readinessByStage.map((r) => [t.stages[r.stage], `${r.avgReadiness}%`, r.count]),
  };

  const revenueTable: ExportTable = {
    title: t.portfolio.revenueTitle,
    headers: [t.common.band, t.common.companies, t.common.share],
    rows: portfolio.revenueDistribution.map((r) => [
      t.portfolio.revenueBands[r.band],
      r.count,
      `${Math.round(r.pct)}%`,
    ]),
  };

  const geoTable: ExportTable = {
    title: t.portfolio.geoTitle,
    headers: [t.common.region, t.common.companies, t.common.share],
    rows: portfolio.geography.map((r) => [b(r.region), r.count, `${Math.round(r.pct)}%`]),
  };

  const rankingTable: ExportTable = {
    title: t.portfolio.rankingTitle,
    headers: [t.common.company, t.common.stage, t.portfolio.kpiReadiness],
    rows: portfolio.topReadiness.map((r) => [b(r.team.name), t.stages[r.team.stage], `${r.readiness}%`]),
  };

  const risksTable: ExportTable = {
    title: t.portfolio.risksTitle,
    headers: [t.common.risk, t.common.companies, t.common.share],
    rows: portfolio.risks.map((r) => [
      t.portfolio.riskLabels[r.category],
      r.count,
      `${Math.round(r.pct)}%`,
    ]),
  };

  const rosterTable: ExportTable = {
    title: t.teams.title,
    headers: [
      t.common.company,
      t.teams.track,
      t.common.stage,
      t.portfolio.kpiReadiness,
      t.teams.city,
      t.teams.teamSize,
      t.common.status,
    ],
    rows: teams.map((team) => [
      b(team.name),
      b(team.track),
      t.stages[team.stage],
      `${team.readiness}%`,
      b(team.city),
      team.team_size,
      team.status === 'active' ? t.common.active : t.common.archived,
    ]),
  };

  return {
    id: 'portfolio',
    label: t.portfolio.sectionEyebrow,
    tables: [
      kpiTable,
      findingsTable,
      stageTable,
      readinessStageTable,
      revenueTable,
      geoTable,
      rankingTable,
      risksTable,
      rosterTable,
    ],
  };
}

export function buildOperationsSection(
  kpis: KpiSet,
  status: StatusSlice[],
  trend: TrendPoint[],
  stages: StageBar[],
  forms: Form[],
  i18n: I18nHelpers,
): ExportSection {
  const { t, b, fmtDate } = i18n;

  const kpiTable: ExportTable = {
    title: t.dashboard.operationsTitle,
    headers: [t.common.metric, t.common.value],
    rows: [
      [t.dashboard.kpiTeams, kpis.teams],
      [t.dashboard.kpiForms, kpis.activeForms],
      [t.dashboard.kpiSubmissions, kpis.submissions],
      [t.dashboard.kpiRate, `${Math.round(kpis.responseRate)}%`],
      [t.dashboard.kpiPending, kpis.pendingReview],
    ],
  };

  const statusLabel: Record<StatusSlice['key'], string> = {
    draft: t.dashboard.statusDraft,
    submitted: t.dashboard.statusSubmitted,
    reviewed: t.dashboard.statusReviewed,
  };
  const statusTable: ExportTable = {
    title: t.dashboard.donutTitle,
    headers: [t.common.status, t.common.value],
    rows: status.map((s) => [statusLabel[s.key], s.value]),
  };

  const trendTable: ExportTable = {
    title: t.dashboard.trendTitle,
    headers: [t.common.date, t.common.value],
    rows: trend.map((p) => [p.label, p.value]),
  };

  const stagesTable: ExportTable = {
    title: t.dashboard.stageTitle,
    headers: [t.common.stage, t.common.companies],
    rows: stages.map((s) => [t.stages[s.stage], s.value]),
  };

  const formsTable: ExportTable = {
    title: t.forms.title,
    headers: [t.common.title, t.common.status, t.common.date],
    rows: forms.map((f) => [b(f.title), f.status, fmtDate(f.created_at)]),
  };

  return {
    id: 'operations',
    label: t.dashboard.operationsTitle,
    tables: [kpiTable, statusTable, trendTable, stagesTable, formsTable],
  };
}
