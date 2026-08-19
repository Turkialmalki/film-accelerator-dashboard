/**
 * Pure aggregation helpers. No React, no data access — they take rows and
 * return the numbers the dashboard and results pages draw.
 */

import type {
  AnswerValue,
  Bilingual,
  Form,
  FormField,
  Submission,
  SubmissionAnswer,
  Team,
  TeamStage,
} from '@/lib/data/types';

export interface KpiSet {
  teams: number;
  activeForms: number;
  submissions: number;
  responseRate: number;
  pendingReview: number;
}

export function computeKpis(teams: Team[], forms: Form[], submissions: Submission[]): KpiSet {
  const activeTeams = teams.filter((t) => t.status === 'active');
  const activeForms = forms.filter((f) => f.status === 'published');
  const finalised = submissions.filter((s) => s.status !== 'draft');
  const expected = activeForms.length * activeTeams.length;

  return {
    teams: activeTeams.length,
    activeForms: activeForms.length,
    submissions: finalised.length,
    responseRate: expected
      ? Math.min(100, (finalised.filter((s) => activeForms.some((f) => f.id === s.form_id)).length / expected) * 100)
      : 0,
    pendingReview: submissions.filter((s) => s.status === 'submitted').length,
  };
}

export interface StatusSlice {
  key: 'draft' | 'submitted' | 'reviewed';
  value: number;
}

export function statusBreakdown(submissions: Submission[]): StatusSlice[] {
  return [
    { key: 'draft', value: submissions.filter((s) => s.status === 'draft').length },
    { key: 'submitted', value: submissions.filter((s) => s.status === 'submitted').length },
    { key: 'reviewed', value: submissions.filter((s) => s.status === 'reviewed').length },
  ];
}

export interface TrendPoint {
  label: string;
  iso: string;
  value: number;
}

/** Buckets submissions into ISO weeks, oldest first. */
export function responseTrend(submissions: Submission[], weeks = 10): TrendPoint[] {
  const finalised = submissions.filter((s) => s.submitted_at);
  if (!finalised.length) return [];

  const times = finalised.map((s) => new Date(s.submitted_at!).getTime());
  const end = Math.max(...times);
  const WEEK = 7 * 86400000;
  const start = end - (weeks - 1) * WEEK;

  const buckets: TrendPoint[] = [];
  for (let i = 0; i < weeks; i += 1) {
    const from = start + i * WEEK;
    const to = from + WEEK;
    const iso = new Date(from).toISOString();
    buckets.push({
      label: iso.slice(5, 10),
      iso,
      value: times.filter((t) => t >= from && t < to).length,
    });
  }
  return buckets;
}

export interface StageBar {
  stage: TeamStage;
  value: number;
}

// Must enumerate every TeamStage: a stage missing here is silently dropped
// from the chart *and* from its total, which is how the two Pre-A companies
// went uncounted when that stage was added.
const STAGE_ORDER: TeamStage[] = [
  'idea',
  'mvp',
  'pre-seed',
  'seed',
  'pre-a',
  'series-a',
  'growth',
];

export function stageDistribution(teams: Team[]): StageBar[] {
  const active = teams.filter((t) => t.status === 'active');
  return STAGE_ORDER.map((stage) => ({
    stage,
    value: active.filter((t) => t.stage === stage).length,
  })).filter((bar) => bar.value > 0);
}

/* --------------------------------------------------------- per-form stats */

export interface FormStats {
  form: Form;
  total: number;
  submitted: number;
  drafts: number;
  reviewed: number;
  responseRate: number;
  lastResponseAt: string | null;
  respondingTeamIds: string[];
}

export function formStats(form: Form, submissions: Submission[], teams: Team[]): FormStats {
  const rows = submissions.filter((s) => s.form_id === form.id);
  const finalised = rows.filter((s) => s.status !== 'draft');
  const activeTeams = teams.filter((t) => t.status === 'active');
  const respondingTeamIds = Array.from(
    new Set(finalised.map((s) => s.team_id).filter((id): id is string => Boolean(id))),
  );
  const times = finalised
    .map((s) => s.submitted_at)
    .filter((t): t is string => Boolean(t))
    .sort();

  return {
    form,
    total: rows.length,
    submitted: finalised.length,
    drafts: rows.filter((s) => s.status === 'draft').length,
    reviewed: rows.filter((s) => s.status === 'reviewed').length,
    responseRate: activeTeams.length ? (respondingTeamIds.length / activeTeams.length) * 100 : 0,
    lastResponseAt: times.length ? times[times.length - 1] : null,
    respondingTeamIds,
  };
}

/* ---------------------------------------------------- per-question stats */

export type QuestionSummary =
  | { kind: 'choice'; field: FormField; answered: number; skipped: number; buckets: { label: string; value: string; count: number }[] }
  | { kind: 'rating'; field: FormField; answered: number; skipped: number; average: number; scale: number; buckets: { label: string; value: string; count: number }[] }
  | { kind: 'nps'; field: FormField; answered: number; skipped: number; score: number; promoters: number; passives: number; detractors: number; buckets: { label: string; value: string; count: number }[] }
  | { kind: 'number'; field: FormField; answered: number; skipped: number; average: number; min: number; max: number }
  | { kind: 'text'; field: FormField; answered: number; skipped: number; values: { submissionId: string; text: string }[] }
  | { kind: 'file'; field: FormField; answered: number; skipped: number; values: { submissionId: string; name: string }[] }
  | { kind: 'other'; field: FormField; answered: number; skipped: number; values: { submissionId: string; text: string }[] };

function asArray(value: AnswerValue): string[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [String(value)];
}

export function summariseQuestion(
  field: FormField,
  submissions: Submission[],
  answers: SubmissionAnswer[],
  labelFor: (value: string) => string,
): QuestionSummary {
  const relevant = answers.filter((a) => a.field_id === field.id);
  const answered = relevant.length;
  const skipped = Math.max(0, submissions.length - answered);

  switch (field.type) {
    case 'select':
    case 'radio':
    case 'multi_select':
    case 'checkbox':
    case 'likert':
    case 'consent':
    case 'team_select':
    case 'participant_select': {
      const counts = new Map<string, number>();
      relevant.forEach((a) => {
        asArray(a.value).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
      });
      const seeded =
        field.options.length && field.type !== 'team_select' && field.type !== 'participant_select'
          ? field.options.map((o) => o.value)
          : Array.from(counts.keys());
      const buckets = seeded.map((value) => ({
        value,
        label: labelFor(value),
        count: counts.get(value) ?? 0,
      }));
      counts.forEach((count, value) => {
        if (!buckets.some((b) => b.value === value)) {
          buckets.push({ value, label: labelFor(value), count });
        }
      });
      return { kind: 'choice', field, answered, skipped, buckets };
    }
    case 'rating': {
      const scale = field.validation.scale ?? 5;
      const nums = relevant.map((a) => Number(a.value)).filter((n) => !Number.isNaN(n));
      const buckets = Array.from({ length: scale }, (_, i) => {
        const step = i + 1;
        return {
          value: String(step),
          label: String(step),
          count: nums.filter((n) => n === step).length,
        };
      });
      return {
        kind: 'rating',
        field,
        answered,
        skipped,
        scale,
        average: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
        buckets,
      };
    }
    case 'nps': {
      const nums = relevant.map((a) => Number(a.value)).filter((n) => !Number.isNaN(n));
      const promoters = nums.filter((n) => n >= 9).length;
      const passives = nums.filter((n) => n >= 7 && n <= 8).length;
      const detractors = nums.filter((n) => n <= 6).length;
      const buckets = Array.from({ length: 11 }, (_, i) => ({
        value: String(i),
        label: String(i),
        count: nums.filter((n) => n === i).length,
      }));
      return {
        kind: 'nps',
        field,
        answered,
        skipped,
        promoters,
        passives,
        detractors,
        score: nums.length ? ((promoters - detractors) / nums.length) * 100 : 0,
        buckets,
      };
    }
    case 'number': {
      const nums = relevant.map((a) => Number(a.value)).filter((n) => !Number.isNaN(n));
      return {
        kind: 'number',
        field,
        answered,
        skipped,
        average: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
        min: nums.length ? Math.min(...nums) : 0,
        max: nums.length ? Math.max(...nums) : 0,
      };
    }
    case 'file':
    case 'image':
      return {
        kind: 'file',
        field,
        answered,
        skipped,
        values: relevant.map((a) => ({ submissionId: a.submission_id, name: String(a.value) })),
      };
    case 'short_text':
    case 'long_text':
    case 'email':
    case 'phone':
    case 'url':
      return {
        kind: 'text',
        field,
        answered,
        skipped,
        values: relevant.map((a) => ({ submissionId: a.submission_id, text: String(a.value) })),
      };
    default:
      return {
        kind: 'other',
        field,
        answered,
        skipped,
        values: relevant.map((a) => ({ submissionId: a.submission_id, text: String(a.value) })),
      };
  }
}

/* ================================================================= */
/* Portfolio analytics — the executive dashboard's data source.       */
/*                                                                     */
/* Every function below is pure: it takes the active `Team[]` (the     */
/* real 20-company cohort in demo mode, or whatever the Supabase       */
/* adapter returns) and derives numbers straight from `Team` fields    */
/* (`readiness`, `stage`, `revenue_band`, `city`, `team_size`,          */
/* `founders`, `challenges`, `growth_path`). Nothing here is a magic    */
/* constant — where a metric cannot be read off a field directly       */
/* (revenue bands, geography, key-person risk, the risk taxonomy) the  */
/* derivation rule is written out and documented next to the code, so  */
/* it is auditable and recomputes correctly if the roster changes.     */
/*                                                                     */
/* One metric in the programme's reference snapshot — "female-led      */
/* companies" — is intentionally NOT computed anywhere in this file.   */
/* Founder gender is not a field in the domain model (`TeamFounder`     */
/* carries only a bilingual name and role) and inferring it from a      */
/* name would be a guess, not a computation. See HANDOFF.md.           */
/* ================================================================= */

const ACTIVE = (teams: Team[]) => teams.filter((t) => t.status === 'active');

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ------------------------------------------------------- readiness ------ */

export interface ReadinessSummary {
  average: number;
  median: number;
  min: number;
  max: number;
}

export function readinessSummary(teams: Team[]): ReadinessSummary {
  const rows = ACTIVE(teams).map((t) => t.readiness);
  if (!rows.length) return { average: 0, median: 0, min: 0, max: 0 };
  const sorted = [...rows].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    average: round1(rows.reduce((a, b) => a + b, 0) / rows.length),
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/** Investor-ready = readiness at or above 74, the threshold the programme
 * uses to flag a company for warm introductions to investors. */
export const INVESTOR_READY_THRESHOLD = 74;
/** Follow-up watchlist = readiness under 55: needs a structured intervention. */
export const WATCHLIST_THRESHOLD = 55;

export function investorReadyTeams(teams: Team[]): Team[] {
  return ACTIVE(teams)
    .filter((t) => t.readiness >= INVESTOR_READY_THRESHOLD)
    .sort((a, b) => b.readiness - a.readiness);
}

export function watchlistTeams(teams: Team[]): Team[] {
  return ACTIVE(teams)
    .filter((t) => t.readiness < WATCHLIST_THRESHOLD)
    .sort((a, b) => a.readiness - b.readiness);
}

export interface ReadinessRankRow {
  team: Team;
  readiness: number;
}

/** Highest-readiness companies, cohort order preserved as the tie-break so
 * the ranking is stable across re-renders. */
export function topReadiness(teams: Team[], limit = 8): ReadinessRankRow[] {
  return ACTIVE(teams)
    .map((team) => ({ team, readiness: team.readiness }))
    .sort((a, b) => b.readiness - a.readiness)
    .slice(0, limit);
}

/* ---------------------------------------------------- stage & funding --- */

export const STAGE_ORDER_FULL: TeamStage[] = [
  'idea',
  'mvp',
  'pre-seed',
  'seed',
  'pre-a',
  'series-a',
  'growth',
];

/** Ordinal maturity score per stage (0–100), used only for the portfolio
 * health composite below — never shown to users as a raw number. */
const STAGE_SCORE: Record<TeamStage, number> = {
  idea: 0,
  mvp: 20,
  'pre-seed': 40,
  seed: 60,
  'pre-a': 80,
  'series-a': 100,
  growth: 100,
};

export interface StageDistributionRow {
  stage: TeamStage;
  count: number;
  pct: number;
}

export function investmentStageDistribution(teams: Team[]): StageDistributionRow[] {
  const active = ACTIVE(teams);
  const total = active.length || 1;
  return STAGE_ORDER_FULL.map((stage) => {
    const count = active.filter((t) => t.stage === stage).length;
    return { stage, count, pct: (count / total) * 100 };
  }).filter((row) => row.count > 0);
}

export interface StageReadinessRow {
  stage: TeamStage;
  avgReadiness: number;
  count: number;
}

export function readinessByStage(teams: Team[]): StageReadinessRow[] {
  const active = ACTIVE(teams);
  return STAGE_ORDER_FULL.map((stage) => {
    const rows = active.filter((t) => t.stage === stage);
    return {
      stage,
      count: rows.length,
      avgReadiness: rows.length
        ? round1(rows.reduce((a, t) => a + t.readiness, 0) / rows.length)
        : 0,
    };
  }).filter((row) => row.count > 0);
}

/* ---------------------------------------------------------- revenue ----- */

export type RevenueBand = 'under_100k' | 'band_100k_500k' | 'band_500k_1m' | 'above_1m';

/** `revenue_band` is stored verbatim from the programme's intake form as a
 * free-text Arabic range. Bucketed by substring match rather than parsed as
 * a number, since the source strings are ranges ("100,000 - 500,000 ر.س"),
 * not single values. */
export function revenueBandOf(raw: string): RevenueBand {
  const s = raw || '';
  if (s.includes('1,000,000+') || s.includes('1٫000٫000+')) return 'above_1m';
  if (s.includes('500,000 - 1,000,000')) return 'band_500k_1m';
  if (s.includes('أقل من') || s.toLowerCase().includes('under')) return 'under_100k';
  return 'band_100k_500k';
}

/** Conservative floor (SAR) used only to derive a *minimum* cumulative
 * portfolio revenue — the low end of each declared band, so the total can
 * never overstate what the cohort has actually generated. */
const REVENUE_BAND_FLOOR: Record<RevenueBand, number> = {
  under_100k: 0,
  band_100k_500k: 100_000,
  band_500k_1m: 500_000,
  above_1m: 1_000_000,
};

/** Ordinal index (1–4) used only for the portfolio health composite. */
const REVENUE_BAND_INDEX: Record<RevenueBand, number> = {
  under_100k: 1,
  band_100k_500k: 2,
  band_500k_1m: 3,
  above_1m: 4,
};

export interface RevenueDistributionRow {
  band: RevenueBand;
  count: number;
  pct: number;
}

export function revenueDistribution(teams: Team[]): RevenueDistributionRow[] {
  const active = ACTIVE(teams);
  const total = active.length || 1;
  const bands: RevenueBand[] = ['under_100k', 'band_100k_500k', 'band_500k_1m', 'above_1m'];
  return bands.map((band) => {
    const count = active.filter((t) => revenueBandOf(t.revenue_band) === band).length;
    return { band, count, pct: (count / total) * 100 };
  });
}

/** Companies whose declared revenue band is above the lowest tier — the
 * programme's definition of "revenue-active". */
export function revenueActiveTeams(teams: Team[]): Team[] {
  return ACTIVE(teams).filter((t) => revenueBandOf(t.revenue_band) !== 'under_100k');
}

/** Sum of each company's band floor — a documented *minimum*, not an actual
 * revenue figure (the platform does not collect exact revenue amounts). */
export function minCumulativeRevenueSar(teams: Team[]): number {
  return ACTIVE(teams).reduce((sum, t) => sum + REVENUE_BAND_FLOOR[revenueBandOf(t.revenue_band)], 0);
}

/* --------------------------------------------------------- geography ---- */

export interface GeographyRow {
  region: Bilingual;
  count: number;
  pct: number;
}

/** A team's `city` field may carry more than one region ("Jeddah / Riyadh"
 * for a company operating out of both). Splitting on the separator means a
 * multi-region company is counted once per region it actually operates in
 * — so the sum of counts can exceed the team count, by design. */
export function geographyBreakdown(teams: Team[]): GeographyRow[] {
  const active = ACTIVE(teams);
  const total = active.length || 1;
  const counts = new Map<string, { ar: string; en: string; count: number }>();

  active.forEach((team) => {
    const arParts = team.city.ar.split('/').map((s) => s.trim()).filter(Boolean);
    const enParts = team.city.en.split('/').map((s) => s.trim()).filter(Boolean);
    arParts.forEach((ar, i) => {
      const en = enParts[i] ?? enParts[0] ?? ar;
      const key = ar;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { ar, en, count: 1 });
    });
  });

  return Array.from(counts.values())
    .map((row) => ({ region: { ar: row.ar, en: row.en }, count: row.count, pct: (row.count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

export function operatingRegionsCount(teams: Team[]): number {
  return geographyBreakdown(teams).length;
}

/* ---------------------------------------------------- team structure ---- */

export interface TeamStructureSummary {
  multiFounder: number;
  soloFounder: number;
  keyPersonRisk: number;
}

/** "Key-person risk" is a structural signal, not a self-report: a company
 * run by a single founder with a team of three or fewer has no redundancy
 * if that one person is unavailable. */
export function isKeyPersonRisk(team: Team): boolean {
  return team.founders.length <= 1 && team.team_size <= 3;
}

export function teamStructureSummary(teams: Team[]): TeamStructureSummary {
  const active = ACTIVE(teams);
  return {
    multiFounder: active.filter((t) => t.founders.length > 1).length,
    soloFounder: active.filter((t) => t.founders.length <= 1).length,
    keyPersonRisk: active.filter(isKeyPersonRisk).length,
  };
}

export function directJobs(teams: Team[]): number {
  return ACTIVE(teams).reduce((sum, t) => sum + t.team_size, 0);
}

export function avgTeamSize(teams: Team[]): number {
  const active = ACTIVE(teams);
  return active.length ? round1(directJobs(teams) / active.length) : 0;
}

/* ------------------------------------------------------- risk taxonomy -- */

export type RiskCategory =
  | 'fragmented_positioning'
  | 'key_person_dependency'
  | 'liquidity_pressure'
  | 'untested_revenue'
  | 'no_institutional_channel'
  | 'government_dependency'
  | 'pricing_resistance';

export const RISK_CATEGORIES: RiskCategory[] = [
  'fragmented_positioning',
  'key_person_dependency',
  'liquidity_pressure',
  'untested_revenue',
  'no_institutional_channel',
  'government_dependency',
  'pricing_resistance',
];

/**
 * Keyword classifier over each team's own authored `challenges` and
 * `growth_path` text (Arabic, as submitted by the company — nothing
 * invented). A team can match zero, one, or several categories.
 *
 * This is a documented heuristic, not a guarantee of matching any external
 * editorial snapshot: two people categorising the same free text by hand
 * would not always agree either. It is deterministic and re-runs correctly
 * whenever `data/startups.json` changes.
 */
const RISK_KEYWORDS: Record<RiskCategory, string[]> = {
  fragmented_positioning: ['تشتت', 'التوزع بين', 'دون سردية', 'دون رسالة موحدة', 'دفعة واحدة', 'نطاقها المعلن'],
  key_person_dependency: ['شخص واحد', 'مطور واحد', 'اعتماد مطلق', 'دون قائد', 'اعتماد كلي على'],
  liquidity_pressure: ['سيولة', 'رأس مال عامل', 'تحصيل المستحقات', 'تدفق نقدي', 'تأخر التدفق'],
  untested_revenue: ['فرضية غير مختبرة', 'لم يختبر فعلياً', 'لم تختبر', 'النموذج الربحي', 'لم يؤمن'],
  no_institutional_channel: ['قناة مبيعات', 'صفقات فردية', 'التوصيات الشخصية', 'بأسلوب العلاقات غير الرسمية'],
  government_dependency: ['عقود حكومية', 'الحكومية المتقطعة', 'المستحقات الحكومية', 'عقود حكومي'],
  pricing_resistance: ['احتكاك', 'عمولات سداد', 'الدفع لكل', 'تسعيرها الرمزي', 'إقناع المشاهد بالدفع'],
};

function teamRiskText(team: Team): string {
  return [...team.challenges, team.growth_path].join(' ');
}

export function riskCategoriesOf(team: Team): RiskCategory[] {
  const text = teamRiskText(team);
  return RISK_CATEGORIES.filter((cat) => RISK_KEYWORDS[cat].some((kw) => text.includes(kw)));
}

export interface RiskRow {
  category: RiskCategory;
  count: number;
  pct: number;
  teams: Team[];
}

export function priorityRisks(teams: Team[]): RiskRow[] {
  const active = ACTIVE(teams);
  const total = active.length || 1;
  return RISK_CATEGORIES.map((category) => {
    const matches = active.filter((t) => riskCategoriesOf(t).includes(category));
    return { category, count: matches.length, pct: (matches.length / total) * 100, teams: matches };
  })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

/* -------------------------------------------------- portfolio health ---- */

export interface PortfolioHealth {
  score: number;
  stageMaturity: number;
  readiness: number;
  revenueGeneration: number;
  teamResilience: number;
}

/**
 * A single 0–100 composite so an executive can read portfolio health at a
 * glance, backed by four transparent, independently-computed dimensions:
 *
 *  - stage maturity: mean ordinal stage score (MVP 20 → Series A 100)
 *  - readiness: mean self/mentor-assessed readiness
 *  - revenue generation: mean revenue-band ordinal score (25 per tier)
 *  - team resilience: 70% weight on the *absence* of key-person risk,
 *    30% weight on multi-founder prevalence
 *
 * The overall score is the unweighted mean of the four — no dimension is
 * allowed to dominate the headline number.
 */
export function portfolioHealth(teams: Team[]): PortfolioHealth {
  const active = ACTIVE(teams);
  const n = active.length || 1;

  const stageMaturity = Math.round(active.reduce((s, t) => s + STAGE_SCORE[t.stage], 0) / n);
  const readiness = Math.round(active.reduce((s, t) => s + t.readiness, 0) / n);
  const revenueGeneration = Math.round(
    active.reduce((s, t) => s + REVENUE_BAND_INDEX[revenueBandOf(t.revenue_band)] * 25, 0) / n,
  );

  const structure = teamStructureSummary(teams);
  const keyPersonPct = (structure.keyPersonRisk / n) * 100;
  const multiFounderPct = (structure.multiFounder / n) * 100;
  const teamResilience = Math.round(0.7 * (100 - keyPersonPct) + 0.3 * multiFounderPct);

  const score = Math.round((stageMaturity + readiness + revenueGeneration + teamResilience) / 4);

  return { score, stageMaturity, readiness, revenueGeneration, teamResilience };
}

/* ---------------------------------------------------------- the bundle -- */

export interface PortfolioMetrics {
  totalCompanies: number;
  readiness: ReadinessSummary;
  mvpCount: number;
  revenueActiveCount: number;
  investorReadyCount: number;
  directJobs: number;
  avgTeamSize: number;
  operatingRegions: number;
  keyPersonRiskCount: number;
  health: PortfolioHealth;
  stageDistribution: StageDistributionRow[];
  readinessByStage: StageReadinessRow[];
  revenueDistribution: RevenueDistributionRow[];
  minCumulativeRevenueSar: number;
  geography: GeographyRow[];
  teamStructure: TeamStructureSummary;
  topReadiness: ReadinessRankRow[];
  risks: RiskRow[];
  investorReady: Team[];
  watchlist: Team[];
}

/** One call, the whole executive dashboard. Everything downstream is a pure
 * read of this object — no component recomputes an aggregate on its own. */
export function computePortfolioMetrics(teams: Team[]): PortfolioMetrics {
  const active = ACTIVE(teams);
  return {
    totalCompanies: active.length,
    readiness: readinessSummary(teams),
    mvpCount: active.filter((t) => t.stage === 'mvp').length,
    revenueActiveCount: revenueActiveTeams(teams).length,
    investorReadyCount: investorReadyTeams(teams).length,
    directJobs: directJobs(teams),
    avgTeamSize: avgTeamSize(teams),
    operatingRegions: operatingRegionsCount(teams),
    keyPersonRiskCount: teamStructureSummary(teams).keyPersonRisk,
    health: portfolioHealth(teams),
    stageDistribution: investmentStageDistribution(teams),
    readinessByStage: readinessByStage(teams),
    revenueDistribution: revenueDistribution(teams),
    minCumulativeRevenueSar: minCumulativeRevenueSar(teams),
    geography: geographyBreakdown(teams),
    teamStructure: teamStructureSummary(teams),
    topReadiness: topReadiness(teams),
    risks: priorityRisks(teams),
    investorReady: investorReadyTeams(teams),
    watchlist: watchlistTeams(teams),
  };
}

/* ------------------------------------------------------- key findings --- */

export type FindingKind =
  | 'revenue_active'
  | 'geo_concentration'
  | 'investor_ready'
  | 'key_person'
  | 'stage_concentration'
  | 'readiness_spread';

/** How the finding should read, not how it should look: `watch` means the
 * number is a flag for attention, never a judgement rendered in analytics. */
export type FindingTone = 'positive' | 'watch' | 'neutral';

export interface Finding {
  kind: FindingKind;
  tone: FindingTone;
  /** Values the dictionary template interpolates. Numbers stay numbers here so
   * the UI can format them in the reader's locale. */
  values: Record<string, string | number>;
  /** Stage keys / region records the UI has to translate before display. */
  stages?: TeamStage[];
  region?: Bilingual;
}

/**
 * The narrative layer over `computePortfolioMetrics`.
 *
 * Every finding is derived from the metrics on this render — none of them is a
 * sentence with a number baked into the dictionary, because a hard-coded
 * "60% of the portfolio" silently becomes a lie the first time the roster
 * changes. A finding that cannot be computed is omitted rather than guessed.
 */
export function keyFindings(m: PortfolioMetrics): Finding[] {
  const findings: Finding[] = [];
  const total = m.totalCompanies;
  if (!total) return findings;

  const pct = (n: number) => Math.round((n / total) * 100);

  findings.push({
    kind: 'revenue_active',
    tone: m.revenueActiveCount / total >= 0.5 ? 'positive' : 'neutral',
    values: { pct: pct(m.revenueActiveCount), count: m.revenueActiveCount, total },
  });

  const topRegion = m.geography[0];
  if (topRegion) {
    findings.push({
      kind: 'geo_concentration',
      // Concentration is only worth flagging when it actually is concentration.
      tone: topRegion.pct >= 60 ? 'watch' : 'neutral',
      values: { pct: Math.round(topRegion.pct), regions: m.geography.length },
      region: topRegion.region,
    });
  }

  if (m.investorReadyCount > 0) {
    findings.push({
      kind: 'investor_ready',
      tone: 'positive',
      values: { count: m.investorReadyCount, threshold: INVESTOR_READY_THRESHOLD },
    });
  }

  if (m.keyPersonRiskCount > 0) {
    findings.push({
      kind: 'key_person',
      tone: 'watch',
      values: { count: m.keyPersonRiskCount, pct: pct(m.keyPersonRiskCount) },
    });
  }

  const topTwo = [...m.stageDistribution].sort((a, b) => b.count - a.count).slice(0, 2);
  if (topTwo.length === 2) {
    findings.push({
      kind: 'stage_concentration',
      tone: 'neutral',
      values: { pct: Math.round(topTwo.reduce((s, r) => s + r.pct, 0)) },
      stages: topTwo.map((r) => r.stage),
    });
  }

  findings.push({
    kind: 'readiness_spread',
    tone: 'neutral',
    values: {
      min: m.readiness.min,
      max: m.readiness.max,
      spread: m.readiness.max - m.readiness.min,
    },
  });

  return findings;
}
