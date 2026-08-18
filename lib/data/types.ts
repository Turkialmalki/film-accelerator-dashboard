/**
 * Domain model for the Film Business Accelerator platform.
 *
 * These types mirror `supabase/schema.sql` one-for-one. Both the demo adapter
 * (localStorage) and the future Supabase adapter satisfy the same
 * `Repository` interface at the bottom of this file, so swapping the backing
 * store is a one-line change in `lib/data/index.ts`.
 */

export type Locale = 'ar' | 'en';

/** Every user-facing string in authored content is bilingual. */
export interface Bilingual {
  ar: string;
  en: string;
}

export type Role = 'owner' | 'admin' | 'reviewer' | 'participant';

export interface Organization {
  id: string;
  name: Bilingual;
  slug: string;
  logo_url: string | null;
  created_at: string;
}

export type CohortStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Cohort {
  id: string;
  org_id: string;
  name: Bilingual;
  status: CohortStatus;
  starts_on: string;
  ends_on: string;
  current_milestone: Bilingual;
  next_milestone_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: Bilingual;
  avatar_url: string | null;
  locale: Locale;
  created_at: string;
}

export interface OrgMembership {
  id: string;
  org_id: string;
  profile_id: string;
  role: Role;
  team_id: string | null;
  created_at: string;
}

export type TeamStage =
  | 'idea'
  | 'mvp'
  | 'pre-seed'
  | 'seed'
  | 'series-a'
  | 'growth';

export type TeamStatus = 'active' | 'archived';

export interface TeamFounder {
  name: Bilingual;
  role: Bilingual;
}

export interface Team {
  id: string;
  org_id: string;
  cohort_id: string;
  /** Stable human key carried over from the legacy `data/startups.json`. */
  slug: string;
  name: Bilingual;
  track: Bilingual;
  description: Bilingual;
  city: Bilingual;
  stage: TeamStage;
  readiness: number;
  revenue_band: string;
  team_size: number;
  business_model: Bilingual;
  key_strengths: string[];
  challenges: string[];
  growth_path: string;
  founders: TeamFounder[];
  status: TeamStatus;
  /** Admin-only. Never returned to a participant-scoped read. */
  internal_notes: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  profile_id: string | null;
  name: Bilingual;
  role: Bilingual;
  email: string | null;
  is_primary: boolean;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invitation {
  id: string;
  org_id: string;
  team_id: string | null;
  email: string;
  role: Role;
  code: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

/* ------------------------------------------------------------------ forms */

export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'number'
  | 'url'
  | 'select'
  | 'multi_select'
  | 'radio'
  | 'checkbox'
  | 'consent'
  | 'rating'
  | 'likert'
  | 'nps'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'
  | 'image'
  | 'team_select'
  | 'participant_select'
  | 'section_heading'
  | 'description'
  | 'divider'
  | 'page_break'
  | 'hidden';

export interface FieldOption {
  id: string;
  label: Bilingual;
  value: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  /** For rating: number of steps. For likert: number of columns. */
  scale?: number;
  /** Accepted file extensions for file/image fields. */
  accept?: string[];
  maxSizeMb?: number;
}

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than';

export interface FormRule {
  id: string;
  form_id: string;
  /** The field whose visibility this rule controls. */
  target_field_id: string;
  /** The field whose answer is examined. */
  source_field_id: string;
  operator: RuleOperator;
  value: string;
  action: 'show' | 'hide';
}

export interface FormField {
  id: string;
  form_id: string;
  section_id: string;
  type: FieldType;
  label: Bilingual;
  description: Bilingual;
  placeholder: Bilingual;
  required: boolean;
  position: number;
  options: FieldOption[];
  validation: FieldValidation;
  /** Static value for `hidden` fields. */
  default_value: string;
}

export interface FormSection {
  id: string;
  form_id: string;
  title: Bilingual;
  description: Bilingual;
  position: number;
}

export type FormStatus = 'draft' | 'published' | 'closed';

export type FormTemplateKey =
  | 'workshop_evaluation'
  | 'presentation_submission'
  | 'mentor_feedback'
  | 'attendance'
  | 'blank';

export interface FormSettings {
  accent_color: string;
  multi_step: boolean;
  allow_drafts: boolean;
  allow_edit_after_submit: boolean;
  /** 0 = unlimited. */
  response_limit: number;
  opens_at: string | null;
  closes_at: string | null;
  confirmation_message: Bilingual;
}

export interface Form {
  id: string;
  org_id: string;
  cohort_id: string;
  template_key: FormTemplateKey;
  title: Bilingual;
  description: Bilingual;
  status: FormStatus;
  settings: FormSettings;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FormPublication {
  id: string;
  form_id: string;
  slug: string;
  published_at: string;
  published_by: string;
  /** null = still open. */
  unpublished_at: string | null;
}

export interface FormAudience {
  id: string;
  form_id: string;
  /** 'all' targets every active team in the cohort. */
  scope: 'all' | 'team';
  team_id: string | null;
}

export type SubmissionStatus = 'draft' | 'submitted' | 'reviewed';

export interface Submission {
  id: string;
  form_id: string;
  team_id: string | null;
  profile_id: string | null;
  status: SubmissionStatus;
  started_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  /** Admin-only. */
  internal_notes: string;
}

export type AnswerValue = string | number | boolean | string[] | null;

export interface SubmissionAnswer {
  id: string;
  submission_id: string;
  field_id: string;
  value: AnswerValue;
}

export interface FileRef {
  id: string;
  org_id: string;
  submission_id: string | null;
  field_id: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  /** In demo mode this is a data: URL held in memory, not a storage path. */
  url: string;
  uploaded_at: string;
}

/* ------------------------------------------------------------ appearance */

export interface ThemeTokens {
  canvas: string;
  surface: string;
  surfaceMuted: string;
  line: string;
  lineStrong: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentInk: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  radius: number;
  shadowCard: string;
  shadowLift: string;
  shadowPop: string;
}

export type ThemePresetKey = 'cinema_white' | 'midnight_screening' | 'sand_ink';

export interface ThemeSettings {
  id: string;
  org_id: string;
  preset: ThemePresetKey;
  tokens: ThemeTokens;
  updated_at: string;
  updated_by: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  meta: Record<string, unknown>;
  created_at: string;
}

/* --------------------------------------------------------------- session */

export interface Session {
  profile: Profile;
  role: Role;
  org_id: string;
  cohort_id: string;
  team_id: string | null;
}

/* ------------------------------------------------------------ repository */

export type TeamInput = Omit<Team, 'id' | 'created_at' | 'updated_at'>;
export type FormInput = Omit<Form, 'id' | 'created_at' | 'updated_at'>;

/**
 * The single data contract for the whole application.
 *
 * `DemoAdapter` implements it against localStorage with deterministic seed
 * data; `SupabaseAdapter` implements it against Postgres. No component imports
 * either adapter directly — they go through `getRepository()`.
 */
export interface Repository {
  readonly mode: 'demo' | 'supabase';

  /* auth */
  signIn(email: string, password: string): Promise<Session>;
  signUp(input: {
    email: string;
    password: string;
    fullName: string;
    inviteCode?: string;
  }): Promise<Session>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  acceptInvitation(code: string, profile: { email: string; fullName: string }): Promise<Session>;
  lookupInvitation(code: string): Promise<Invitation | null>;

  /* org + cohort */
  getOrganization(): Promise<Organization>;
  updateOrganization(patch: Partial<Organization>): Promise<Organization>;
  getCohort(): Promise<Cohort>;
  updateCohort(patch: Partial<Cohort>): Promise<Cohort>;

  /* teams */
  listTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | null>;
  createTeam(input: TeamInput): Promise<Team>;
  updateTeam(id: string, patch: Partial<TeamInput>): Promise<Team>;
  archiveTeam(id: string): Promise<Team>;
  restoreTeam(id: string): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  importTeams(rows: Partial<TeamInput>[]): Promise<{ created: number; updated: number }>;

  /* invitations */
  listInvitations(): Promise<Invitation[]>;
  createInvitation(input: {
    email: string;
    role: Role;
    team_id: string | null;
  }): Promise<Invitation>;
  revokeInvitation(id: string): Promise<Invitation>;

  /* forms */
  listForms(): Promise<Form[]>;
  getForm(id: string): Promise<Form | null>;
  getFormBySlug(slug: string): Promise<Form | null>;
  createForm(input: FormInput): Promise<Form>;
  updateForm(id: string, patch: Partial<FormInput>): Promise<Form>;
  deleteForm(id: string): Promise<void>;
  duplicateForm(id: string): Promise<Form>;
  publishForm(id: string): Promise<FormPublication>;
  closeForm(id: string): Promise<Form>;
  getPublication(formId: string): Promise<FormPublication | null>;

  listSections(formId: string): Promise<FormSection[]>;
  saveSections(formId: string, sections: FormSection[]): Promise<FormSection[]>;
  listFields(formId: string): Promise<FormField[]>;
  saveFields(formId: string, fields: FormField[]): Promise<FormField[]>;
  listRules(formId: string): Promise<FormRule[]>;
  saveRules(formId: string, rules: FormRule[]): Promise<FormRule[]>;
  listAudience(formId: string): Promise<FormAudience[]>;
  saveAudience(formId: string, audience: FormAudience[]): Promise<FormAudience[]>;
  /** Forms visible to the given team, published and inside their window. */
  listAssignedForms(teamId: string | null): Promise<Form[]>;

  /* submissions */
  listSubmissions(formId?: string): Promise<Submission[]>;
  listSubmissionsForTeam(teamId: string): Promise<Submission[]>;
  getSubmission(id: string): Promise<Submission | null>;
  listAnswers(submissionId: string): Promise<SubmissionAnswer[]>;
  saveDraft(input: {
    form_id: string;
    team_id: string | null;
    profile_id: string | null;
    answers: Record<string, AnswerValue>;
    submission_id?: string;
  }): Promise<Submission>;
  submitResponse(input: {
    form_id: string;
    team_id: string | null;
    profile_id: string | null;
    answers: Record<string, AnswerValue>;
    submission_id?: string;
  }): Promise<Submission>;
  setSubmissionReviewed(id: string, reviewed: boolean): Promise<Submission>;
  setSubmissionNotes(id: string, notes: string): Promise<Submission>;

  /* files */
  saveFile(input: Omit<FileRef, 'id' | 'uploaded_at'>): Promise<FileRef>;
  listFiles(formId?: string): Promise<FileRef[]>;

  /* appearance */
  getTheme(): Promise<ThemeSettings>;
  saveTheme(input: { preset: ThemePresetKey; tokens: ThemeTokens }): Promise<ThemeSettings>;

  /* audit */
  listAuditLogs(limit?: number): Promise<AuditLog[]>;

  /* demo-only escape hatch */
  resetDemoData?(): Promise<void>;
}
