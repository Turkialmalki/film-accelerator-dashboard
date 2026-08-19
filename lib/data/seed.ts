/**
 * Deterministic demo fixture.
 *
 * The 20 teams are the REAL accelerator cohort, read verbatim from
 * `data/startups.json` (the same file the legacy static site used). Nothing in
 * this file invents a team, a founder or a piece of Arabic copy — it only
 * reshapes the existing records into the platform's domain model and adds an
 * English label for the fields the source file only carried in Arabic.
 *
 * Everything else (forms, submissions, invitations) is synthesised, but with a
 * seeded PRNG so the numbers are identical on every boot.
 */

import rawStartups from '@/data/startups.json';
import { buildTemplate } from '@/lib/forms/templates';
import { isAnswerable } from '@/lib/forms/field-types';
import { CINEMA_WHITE } from '@/lib/theme/presets';
import type {
  AnswerValue,
  Cohort,
  Form,
  FormAudience,
  FormField,
  FormPublication,
  FormRule,
  FormSection,
  Invitation,
  OrgMembership,
  Organization,
  Profile,
  Submission,
  SubmissionAnswer,
  Team,
  TeamMember,
  TeamStage,
  ThemeSettings,
  AuditLog,
} from './types';

/* ---------------------------------------------------------------- raw shape */

interface RawFounder {
  name_ar: string;
  name_en?: string;
  role: string;
}

interface RawStartup {
  id: string;
  startup_name_ar: string;
  startup_name_en: string;
  category: string;
  description: string;
  location?: string;
  city?: string;
  stage: string;
  readiness: number;
  revenue: string;
  team_size: number;
  founders?: RawFounder[];
  leadership?: { name_ar: string; role: string }[];
  key_strengths?: string[];
  challenges?: string[];
  growth_path?: string;
  business_model?: string;
}

const RAW = rawStartups as unknown as RawStartup[];

/* ------------------------------------------------------- bilingual lexicons */

/**
 * English labels for the Arabic-only source fields. Written by hand — these
 * are editorial equivalents, not machine translations.
 */
const TRACK_EN: Record<string, string> = {
  'تقنيات الإنتاج والذكاء الاصطناعي': 'Production tech & AI',
  'بيانات سينمائية واستوديو ملكية فكرية': 'Film data & IP studio',
  'خدمات وتسهيلات إنتاجية (Fixer)': 'Production services & fixing',
  'تصميم أزياء وبنية تحتية سينمائية': 'Costume design & film infrastructure',
  'تعليم سينمائي منصات رقمية': 'Film education platforms',
  'تطوير مجتمعات وعروض سينمائية': 'Community building & screenings',
  'تمويل سينمائي وتطوير مواهب': 'Film financing & talent development',
  'استديو وشريك إنتاج محلي': 'Studio & local production partner',
  'تطوير نصوص وما قبل الإنتاج (IP)': 'Script development & pre-production',
  'منصة سوق العمل الميداني للسينما': 'Film crew marketplace',
  'استديو أنيميشن ونموذج امتياز IP': 'Animation studio & IP franchise',
  'منصة مجتمع وبيانات سينمائية': 'Film community & data platform',
  'بنية تحتية للمهرجانات والتحكيم': 'Festival & jury infrastructure',
  'منصة تعليم أنيميشن ومؤثرات': 'Animation & VFX education',
  'توزيع سينمائي ووكالة مبيعات (Sales Agent)': 'Film distribution & sales agency',
  'منصة بث الأفلام القصيرة (TVOD)': 'Short-film streaming (TVOD)',
  'ملكية فكرية وتوأم رقمي بالذكاء الاصطناعي': 'IP & AI digital twins',
  'ذكاء اصطناعي للمراقبة اللحظية في موقع التصوير': 'On-set real-time AI monitoring',
  'سينما رقمية منزلية (TVOD)': 'Home digital cinema (TVOD)',
  'وكالة تسويق أفلام ومجتمع صناع': 'Film marketing agency & creator community',
};

const CITY_EN: Record<string, string> = {
  الرياض: 'Riyadh',
  جدة: 'Jeddah',
  'جدة / الرياض': 'Jeddah / Riyadh',
  الأحساء: 'Al-Ahsa',
  الطائف: 'Taif',
};

const BUSINESS_MODEL_EN: Record<string, string> = {
  'ترخيص تقني ومشاريع إنتاج': 'Technology licensing & production projects',
  'اشتراكات وبيانات': 'Subscriptions & data',
  'خدمات ومشاريع': 'Services & projects',
  'اشتراكات تعليمية B2B/B2G': 'B2B/B2G education subscriptions',
  'عضويات وفعاليات': 'Memberships & events',
  'تمويل بحصة من الإيراد': 'Revenue-share financing',
  'شراكة إنتاج': 'Production partnership',
  'تطوير نصوص وملكية فكرية': 'Script development & IP',
  'عمولة على المعاملات': 'Transaction commission',
  'امتياز وملكية فكرية': 'Franchise & IP',
  'اشتراكات B2B': 'B2B subscriptions',
  'اشتراكات وخدمات تحكيم': 'Subscriptions & jury services',
  'اشتراكات تعليمية': 'Education subscriptions',
  'وكالة مبيعات بحصة': 'Sales agency on commission',
  'بيع مباشر للمشاهدة TVOD': 'Direct-to-viewer TVOD',
  'ترخيص ذكاء اصطناعي': 'AI licensing',
  'اشتراكات برمجية B2B': 'B2B software subscriptions',
  'وكالة تسويق بالخدمة': 'Marketing agency retainer',
};

const STAGE_MAP: Record<string, TeamStage> = {
  MVP: 'mvp',
  'Pre-Seed': 'pre-seed',
  Seed: 'seed',
  'Pre-A': 'pre-a',
  'Series A': 'series-a',
};

export const STAGE_LABEL: Record<TeamStage, { ar: string; en: string }> = {
  idea: { ar: 'فكرة', en: 'Idea' },
  mvp: { ar: 'منتج أولي', en: 'MVP' },
  'pre-seed': { ar: 'ما قبل التأسيس', en: 'Pre-seed' },
  seed: { ar: 'التأسيس', en: 'Seed' },
  'pre-a': { ar: 'ما قبل الجولة أ', en: 'Pre-A' },
  'series-a': { ar: 'الجولة أ', en: 'Series A' },
  growth: { ar: 'النمو', en: 'Growth' },
};

/* ------------------------------------------------------------------ helpers */

/** mulberry32 — tiny, fast, and identical on every run for a given seed. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const intBetween = (rng: () => number, lo: number, hi: number) =>
  lo + Math.floor(rng() * (hi - lo + 1));

export const ORG_ID = 'org_fba';
export const COHORT_ID = 'cohort_2026_01';

const PROGRAM_START = '2026-05-10T08:00:00.000Z';

function dayOffset(days: number, hour = 11): string {
  const d = new Date(PROGRAM_START);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

/* -------------------------------------------------------------------- teams */

export function seedTeams(): Team[] {
  return RAW.map((raw, index) => {
    const city = raw.city ?? raw.location ?? 'الرياض';
    const founders = (raw.founders ?? []).map((f) => ({
      name: { ar: f.name_ar, en: f.name_en || f.name_ar },
      role: { ar: f.role, en: f.role },
    }));
    const leadership = (raw.leadership ?? []).map((f) => ({
      name: { ar: f.name_ar, en: f.name_ar },
      role: { ar: f.role, en: f.role },
    }));
    const allFounders = founders.length ? founders : leadership;

    return {
      id: `team_${raw.id}`,
      org_id: ORG_ID,
      cohort_id: COHORT_ID,
      slug: raw.id,
      name: { ar: raw.startup_name_ar, en: raw.startup_name_en },
      track: { ar: raw.category, en: TRACK_EN[raw.category] ?? raw.category },
      description: { ar: raw.description, en: raw.description },
      city: { ar: city, en: CITY_EN[city] ?? city },
      stage: STAGE_MAP[raw.stage] ?? 'seed',
      readiness: raw.readiness,
      revenue_band: raw.revenue,
      team_size: raw.team_size,
      business_model: {
        ar: raw.business_model ?? '',
        en: BUSINESS_MODEL_EN[raw.business_model ?? ''] ?? raw.business_model ?? '',
      },
      key_strengths: raw.key_strengths ?? [],
      challenges: raw.challenges ?? [],
      growth_path: raw.growth_path ?? '',
      founders: allFounders,
      status: 'active' as const,
      internal_notes: '',
      created_at: dayOffset(-30 + index),
      updated_at: dayOffset(index),
    };
  });
}

export function seedTeamMembers(teams: Team[]): TeamMember[] {
  const members: TeamMember[] = [];
  teams.forEach((team) => {
    team.founders.forEach((f, i) => {
      members.push({
        id: `tm_${team.slug}_${i}`,
        team_id: team.id,
        profile_id: null,
        name: f.name,
        role: f.role,
        email: null,
        is_primary: i === 0,
      });
    });
  });
  return members;
}

/* ----------------------------------------------------------------- identity */

export const DEMO_ADMIN_EMAIL = 'admin@fba.demo';
export const DEMO_PARTICIPANT_EMAIL = 'founder@fba.demo';
export const DEMO_REVIEWER_EMAIL = 'mentor@fba.demo';
export const DEMO_PASSWORD = 'accelerate';

/** The demo participant is bound to the first real team in the cohort. */
export const DEMO_PARTICIPANT_TEAM_SLUG = 'specter';

export function seedProfiles(): Profile[] {
  return [
    {
      id: 'profile_admin',
      email: DEMO_ADMIN_EMAIL,
      full_name: { ar: 'إدارة البرنامج', en: 'Programme Admin' },
      avatar_url: null,
      locale: 'ar',
      created_at: dayOffset(-40),
    },
    {
      id: 'profile_participant',
      email: DEMO_PARTICIPANT_EMAIL,
      full_name: { ar: 'أحمد الحويماني', en: 'Ahmed Alhuwaimani' },
      avatar_url: null,
      locale: 'ar',
      created_at: dayOffset(-28),
    },
    {
      id: 'profile_reviewer',
      email: DEMO_REVIEWER_EMAIL,
      full_name: { ar: 'مرشد البرنامج', en: 'Programme Mentor' },
      avatar_url: null,
      locale: 'ar',
      created_at: dayOffset(-26),
    },
  ];
}

export function seedMemberships(teams: Team[]): OrgMembership[] {
  const participantTeam = teams.find((t) => t.slug === DEMO_PARTICIPANT_TEAM_SLUG);
  return [
    {
      id: 'mem_admin',
      org_id: ORG_ID,
      profile_id: 'profile_admin',
      role: 'admin',
      team_id: null,
      created_at: dayOffset(-40),
    },
    {
      id: 'mem_participant',
      org_id: ORG_ID,
      profile_id: 'profile_participant',
      role: 'participant',
      team_id: participantTeam?.id ?? null,
      created_at: dayOffset(-28),
    },
    {
      id: 'mem_reviewer',
      org_id: ORG_ID,
      profile_id: 'profile_reviewer',
      role: 'reviewer',
      team_id: null,
      created_at: dayOffset(-26),
    },
  ];
}

export function seedOrganization(): Organization {
  return {
    id: ORG_ID,
    name: { ar: 'مسرعة الأعمال في الأفلام', en: 'Film Business Accelerator' },
    slug: 'fba',
    logo_url: '/brand/fba-lockup.svg',
    created_at: dayOffset(-120),
  };
}

export function seedCohort(): Cohort {
  return {
    id: COHORT_ID,
    org_id: ORG_ID,
    name: { ar: 'الدفعة الأولى · 2026', en: 'Cohort 01 · 2026' },
    status: 'active',
    starts_on: '2026-05-10',
    ends_on: '2026-09-24',
    current_milestone: {
      ar: 'أسبوع بناء العرض الاستثماري',
      en: 'Investment pitch build week',
    },
    next_milestone_at: '2026-09-10',
    created_at: dayOffset(-120),
  };
}

export function seedInvitations(teams: Team[]): Invitation[] {
  const rng = makeRng(7781);
  const targets = teams.slice(1, 6);
  return targets.map((team, i) => ({
    id: `inv_${team.slug}`,
    org_id: ORG_ID,
    team_id: team.id,
    email: `founder+${team.slug}@fba.demo`,
    role: 'participant' as const,
    code: makeInviteCode(rng),
    status: i === 0 ? ('accepted' as const) : ('pending' as const),
    expires_at: dayOffset(60 + i),
    created_at: dayOffset(-10 + i),
    accepted_at: i === 0 ? dayOffset(-8) : null,
  }));
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeInviteCode(rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
    if (i === 3) out += '-';
  }
  return out;
}

/* -------------------------------------------------------------------- forms */

export interface SeededForms {
  forms: Form[];
  sections: FormSection[];
  fields: FormField[];
  rules: FormRule[];
  publications: FormPublication[];
  audiences: FormAudience[];
}

const stableId = (scope: string, hint: string) => `${scope}_${hint}`.replace(/[^a-zA-Z0-9_-]/g, '_');

export function seedForms(): SeededForms {
  const forms: Form[] = [];
  const sections: FormSection[] = [];
  const fields: FormField[] = [];
  const rules: FormRule[] = [];
  const publications: FormPublication[] = [];
  const audiences: FormAudience[] = [];

  const defs: {
    id: string;
    key: Parameters<typeof buildTemplate>[0];
    status: Form['status'];
    slug: string | null;
    opens: number;
    closes: number;
  }[] = [
    { id: 'form_workshop_eval', key: 'workshop_evaluation', status: 'published', slug: 'workshop-evaluation-w6', opens: 40, closes: 62 },
    { id: 'form_pitch_deck', key: 'presentation_submission', status: 'published', slug: 'pitch-deck-submission', opens: 55, closes: 96 },
    { id: 'form_mentor_feedback', key: 'mentor_feedback', status: 'published', slug: 'mentor-feedback-cycle-2', opens: 30, closes: 110 },
    { id: 'form_attendance', key: 'attendance', status: 'closed', slug: 'session-check-in', opens: 12, closes: 34 },
    { id: 'form_demo_day', key: 'presentation_submission', status: 'draft', slug: null, opens: 100, closes: 130 },
  ];

  defs.forEach((def, i) => {
    const built = buildTemplate(def.key, def.id, (scope, hint) => stableId(scope, `${def.id}_${hint}`));

    const title =
      def.id === 'form_demo_day'
        ? { ar: 'تسليم عرض يوم العرض النهائي', en: 'Demo Day submission' }
        : def.id === 'form_workshop_eval'
          ? { ar: 'تقييم ورشة الأسبوع السادس', en: 'Week 6 workshop evaluation' }
          : def.id === 'form_mentor_feedback'
            ? { ar: 'ملاحظات المرشدين — الدورة الثانية', en: 'Mentor feedback — cycle 2' }
            : def.id === 'form_attendance'
              ? { ar: 'تسجيل حضور الجلسات', en: 'Session check-in' }
              : { ar: 'تسليم العرض الاستثماري', en: 'Investment deck submission' };

    forms.push({
      id: def.id,
      org_id: ORG_ID,
      cohort_id: COHORT_ID,
      template_key: def.key,
      title,
      description: {
        ar: 'استمارة رسمية من إدارة مسرعة الأعمال في الأفلام.',
        en: 'An official form from the Film Business Accelerator programme office.',
      },
      status: def.status,
      settings: {
        accent_color: CINEMA_WHITE.accent,
        multi_step: def.key === 'workshop_evaluation',
        allow_drafts: true,
        allow_edit_after_submit: def.key !== 'attendance',
        response_limit: 0,
        opens_at: dayOffset(def.opens),
        closes_at: dayOffset(def.closes),
        confirmation_message: {
          ar: 'وصلتنا إجابتك. شكراً لوقتك.',
          en: 'We have your response. Thank you for your time.',
        },
      },
      created_by: 'profile_admin',
      created_at: dayOffset(def.opens - 6),
      updated_at: dayOffset(def.opens - 1),
    });

    sections.push(...built.sections);
    fields.push(...built.fields);
    rules.push(...built.rules);

    if (def.slug && def.status !== 'draft') {
      publications.push({
        id: `pub_${def.id}`,
        form_id: def.id,
        slug: def.slug,
        published_at: dayOffset(def.opens),
        published_by: 'profile_admin',
        unpublished_at: def.status === 'closed' ? dayOffset(def.closes) : null,
      });
    }

    audiences.push({
      id: `aud_${def.id}`,
      form_id: def.id,
      scope: i === 2 ? 'team' : 'all',
      team_id: null,
    });
  });

  return { forms, sections, fields, rules, publications, audiences };
}

/* -------------------------------------------------------------- submissions */

const OPEN_TEXT_AR = [
  'أوضح جزء كان تفكيك نموذج التسعير إلى وحدات قابلة للقياس بدل الحديث العام عن القيمة.',
  'الجلسة أعادت ترتيب أولوياتنا: أوقفنا منتجين وركّزنا على واحد يمكن بيعه هذا الربع.',
  'التمرين على صياغة السردية أمام الغرفة كان مؤلماً ومفيداً في الوقت نفسه.',
  'استفدنا من قالب النموذج المالي أكثر من أي شيء آخر — طبقناه في اليوم التالي.',
  'أخيراً فهمنا الفرق بين مقياس النمو ومقياس الغرور في لوحة مؤشراتنا.',
  'أفضل جزء كان مراجعة عروض الفرق الأخرى ورؤية أخطائنا في عروضهم.',
  'ملاحظات المرشد على شريحة السوق كانت دقيقة وغيّرت الرقم الذي نستخدمه.',
];

const IMPROVE_TEXT_AR = [
  'نحتاج وقتاً أطول للتمارين العملية ووقتاً أقل للعرض النظري.',
  'أقترح توزيع المواد قبل الجلسة بيومين على الأقل.',
  'مجموعات العمل كانت كبيرة؛ أربعة فرق في المجموعة أفضل من ثمانية.',
  'تكرار بعض المحتوى مع ورشة الأسبوع الرابع.',
  'لا شيء جوهري، الجلسة كانت مضبوطة.',
];

export interface SeededSubmissions {
  submissions: Submission[];
  answers: SubmissionAnswer[];
}

export function seedSubmissions(
  teams: Team[],
  forms: Form[],
  fields: FormField[],
): SeededSubmissions {
  const rng = makeRng(20260510);
  const submissions: Submission[] = [];
  const answers: SubmissionAnswer[] = [];
  const activeTeams = teams.filter((t) => t.status === 'active');

  // Response coverage per published form — deliberately partial so the
  // response-rate KPI and the "pending" states are meaningful.
  const coverage: Record<string, number> = {
    form_workshop_eval: 16,
    form_pitch_deck: 11,
    form_mentor_feedback: 13,
    form_attendance: 19,
  };

  forms
    .filter((f) => f.status !== 'draft')
    .forEach((form) => {
      const formFields = fields.filter((f) => f.form_id === form.id && isAnswerable(f.type));
      const count = coverage[form.id] ?? 0;
      const responders = activeTeams.slice(0, count);

      responders.forEach((team, i) => {
        const isDraft = form.id === 'form_pitch_deck' && i >= count - 2;
        const openDay = Math.round(
          (new Date(form.settings.opens_at ?? PROGRAM_START).getTime() -
            new Date(PROGRAM_START).getTime()) /
            86400000,
        );
        const at = dayOffset(openDay + 1 + Math.floor(i * 0.8), 9 + (i % 8));
        const reviewed = !isDraft && rng() > 0.55;

        const submissionId = `sub_${form.id}_${team.slug}`;
        submissions.push({
          id: submissionId,
          form_id: form.id,
          team_id: team.id,
          profile_id: team.slug === DEMO_PARTICIPANT_TEAM_SLUG ? 'profile_participant' : null,
          status: isDraft ? 'draft' : reviewed ? 'reviewed' : 'submitted',
          started_at: at,
          submitted_at: isDraft ? null : at,
          reviewed_at: reviewed ? dayOffset(Math.round(openDay) + 4 + i) : null,
          internal_notes: reviewed && i % 5 === 0 ? 'روجعت مع المرشد المسؤول، لا حاجة لتصعيد.' : '',
        });

        formFields.forEach((field) => {
          const value = synthAnswer(field, team, rng);
          if (value === null) return;
          answers.push({
            id: `ans_${submissionId}_${field.id}`,
            submission_id: submissionId,
            field_id: field.id,
            value,
          });
        });
      });
    });

  return { submissions, answers };
}

function synthAnswer(field: FormField, team: Team, rng: () => number): AnswerValue {
  switch (field.type) {
    case 'team_select':
      return team.id;
    case 'participant_select':
      return pick(rng, ['profile_reviewer', 'profile_admin']);
    case 'rating':
      return intBetween(rng, 3, 5);
    case 'nps':
      return intBetween(rng, 5, 10);
    case 'likert':
      return String(intBetween(rng, 3, 5));
    case 'select':
    case 'radio':
      return field.options.length ? pick(rng, field.options).value : null;
    case 'multi_select':
    case 'checkbox': {
      if (!field.options.length) return null;
      const n = intBetween(rng, 1, Math.min(3, field.options.length));
      const shuffled = [...field.options].sort(() => rng() - 0.5);
      return shuffled.slice(0, n).map((o) => o.value);
    }
    case 'consent':
      return true;
    case 'long_text':
      return field.label.en.toLowerCase().includes('improve')
        ? pick(rng, IMPROVE_TEXT_AR)
        : pick(rng, OPEN_TEXT_AR);
    case 'short_text':
      if (field.label.en.includes('Presenter') || field.label.en.includes('Attendee')) {
        return team.founders[0]?.name.ar ?? team.name.ar;
      }
      return `${team.name.ar} — ${field.label.ar}`;
    case 'email':
      return `founder+${team.slug}@fba.demo`;
    case 'phone':
      return `+9665${intBetween(rng, 10000000, 99999999)}`;
    case 'url':
      return `https://vimeo.com/fba/${team.slug}`;
    case 'number':
      return intBetween(rng, 1, 40) * 25000;
    case 'date':
      return dayOffset(intBetween(rng, 20, 70)).slice(0, 10);
    case 'time':
      return `${String(intBetween(rng, 8, 17)).padStart(2, '0')}:${pick(rng, ['00', '15', '30', '45'])}`;
    case 'datetime':
      return dayOffset(intBetween(rng, 60, 90)).slice(0, 16);
    case 'file':
    case 'image':
      return `${team.slug}-deck.pdf`;
    default:
      return null;
  }
}

/* --------------------------------------------------------------- appearance */

export function seedTheme(): ThemeSettings {
  return {
    id: 'theme_default',
    org_id: ORG_ID,
    preset: 'cinema_white',
    tokens: CINEMA_WHITE,
    updated_at: dayOffset(-100),
    updated_by: 'profile_admin',
  };
}

export function seedAuditLogs(): AuditLog[] {
  return [
    {
      id: 'audit_1',
      org_id: ORG_ID,
      actor_id: 'profile_admin',
      action: 'form.published',
      entity: 'forms',
      entity_id: 'form_workshop_eval',
      meta: { slug: 'workshop-evaluation-w6' },
      created_at: dayOffset(40),
    },
    {
      id: 'audit_2',
      org_id: ORG_ID,
      actor_id: 'profile_admin',
      action: 'theme.published',
      entity: 'theme_settings',
      entity_id: 'theme_default',
      meta: { preset: 'cinema_white' },
      created_at: dayOffset(-100),
    },
  ];
}
