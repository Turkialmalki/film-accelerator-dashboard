import type { Finding, KpiSet, PortfolioMetrics, StageBar, StatusSlice, TrendPoint } from '@/lib/analytics';
import { findingCopy } from '@/lib/analytics-copy';
import type { Bilingual, Form, Team } from '@/lib/data/types';
import type { CalendlySummary } from '@/lib/calendly/summary';
import { BOOTCAMP_DAYS, mergeBootcampIntoMentorship } from '@/lib/data/bootcamp-sessions';
import type { Dict } from '@/lib/i18n/dictionaries';
import type { ExportSection, ExportTable } from './types';

interface I18nHelpers {
  t: Dict;
  tf: (template: string, values: Record<string, string | number>) => string;
  b: (value: Bilingual | undefined | null) => string;
  fmtNumber: (value: number) => string;
  fmtDate: (value: string) => string;
  /** Only the Calendly section needs a real date+time, not just a date. */
  fmtDateTime?: (value: string) => string;
}

/**
 * The full "Mentorship sessions" export scope: the live Calendly totals
 * (merged with the bootcamp sheet, exactly like the on-screen cards — see
 * `mergeBootcampIntoMentorship`, the one place that merge happens so a
 * download can never disagree with the dashboard it came from), sessions
 * grouped by topic (real Calendly data only — the bootcamp sheet has no
 * topic recorded), every individual booked session with its own detail,
 * and the bootcamp's own day-by-day sign-up sheet.
 */
export function buildCalendlySection(
  summary: CalendlySummary | null,
  i18n: I18nHelpers,
): ExportSection {
  const { t, fmtDateTime } = i18n;
  const fmtWhen = fmtDateTime ?? i18n.fmtDate;
  const totals = summary
    ? mergeBootcampIntoMentorship(summary)
    : mergeBootcampIntoMentorship({ sessionsCompleted: 0, hoursCompleted: 0, sessionsPerMentor: [] });

  const kpiTable: ExportTable = {
    title: t.calendly.sectionTitle,
    headers: [t.common.metric, t.common.value],
    rows: [
      [t.calendly.kpiMentors, totals.mentors],
      [t.calendly.kpiSessionsCompleted, totals.sessionsCompleted],
      [t.calendly.kpiHoursCompleted, totals.hoursCompleted],
      [t.calendly.kpiSessionsCanceled, summary?.sessionsCanceled ?? 0],
      [t.calendly.kpiSessionsRescheduled, summary?.sessionsRescheduled ?? 0],
    ],
  };

  const perTopicTable: ExportTable = {
    title: t.calendly.sessionsPerTopicTitle,
    headers: [t.calendly.bookedTopic, t.calendly.kpiSessionsCompleted],
    rows: summary ? summary.sessionsPerTopic.map((r) => [r.name, r.sessions]) : [],
  };

  const bookedTable: ExportTable = {
    title: t.calendly.bookedTitle,
    headers: [
      t.calendly.bookedMentor,
      t.calendly.bookedMentee,
      t.calendly.bookedTopic,
      t.calendly.bookedWhen,
      t.calendly.bookedStatus,
    ],
    rows: summary
      ? summary.bookedSessions.map((s) => [
          s.mentorName,
          s.menteeName,
          s.topic,
          fmtWhen(s.startTime),
          s.occurred ? t.calendly.bookedStatusDone : t.calendly.bookedStatusUpcoming,
        ])
      : [],
  };

  const bootcampTable: ExportTable = {
    title: t.bootcamp.sectionTitle,
    headers: [t.common.date, t.calendly.bookedMentor, t.calendly.bookedMentee],
    rows: BOOTCAMP_DAYS.flatMap((day) =>
      day.groups.flatMap((group) =>
        group.entrepreneurs.map((name) => [
          i18n.tf(t.bootcamp.day, { n: day.day }),
          group.mentorName,
          name,
        ]),
      ),
    ),
  };

  return {
    id: 'calendly',
    label: t.calendly.sectionTitle,
    tables: [kpiTable, perTopicTable, bookedTable, bootcampTable],
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

  // Rendered on screen as the other half of the geography panel (see
  // GeographyTeamStructurePanel) but never included in the export until now.
  const structureTable: ExportTable = {
    title: t.dashboard.teams,
    headers: [t.common.metric, t.common.companies],
    rows: [
      [t.portfolio.multiFounderLabel, portfolio.teamStructure.multiFounder],
      [t.portfolio.soloFounderLabel, portfolio.teamStructure.soloFounder],
      [t.portfolio.keyPersonRiskLabel, portfolio.teamStructure.keyPersonRisk],
    ],
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
      structureTable,
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
