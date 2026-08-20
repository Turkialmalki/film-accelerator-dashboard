/**
 * SupabaseAdapter — the production implementation of `Repository`.
 *
 * STATUS: SCAFFOLD. The client wiring, table names, and the shape of every
 * query are in place and match `supabase/schema.sql`, but this adapter has
 * NEVER been executed against a live project — no Supabase credentials were
 * available while it was written. Treat every method as unverified until it is
 * run against a real database.
 *
 * To activate it: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (see .env.example). `getRepository()` in ./index.ts switches automatically.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/browser-client';
import type {
  AnswerValue,
  AuditLog,
  Cohort,
  FileRef,
  Form,
  FormAudience,
  FormField,
  FormInput,
  FormPublication,
  FormRule,
  FormSection,
  Invitation,
  Organization,
  Repository,
  Role,
  Session,
  Submission,
  SubmissionAnswer,
  Team,
  TeamInput,
  ThemePresetKey,
  ThemeSettings,
  ThemeTokens,
} from './types';

const NOT_IMPLEMENTED = (method: string) =>
  new Error(
    `SupabaseAdapter.${method} is a scaffold and has not been verified against a live project.`,
  );

export class SupabaseAdapter implements Repository {
  readonly mode = 'supabase' as const;

  private url: string;
  private anonKey: string;
  private orgId: string;
  private cached: SupabaseClient | null = null;

  constructor(url: string, anonKey: string, orgId: string) {
    this.url = url;
    this.anonKey = anonKey;
    this.orgId = orgId;
  }

  /**
   * The client is built on first use rather than in the constructor. A client
   * component still renders once on the server, and `getRepository()` may be
   * reached during that render; the browser client wants a cookie jar that
   * only exists in the document.
   *
   * It is the **cookie-backed** `createBrowserClient` from `@supabase/ssr`,
   * not the localStorage-backed `createClient`. `middleware.ts` runs before
   * any page JavaScript and can only read cookies, so a localStorage session
   * would leave every protected route looking anonymous to the route guard.
   */
  private get client(): SupabaseClient {
    if (!this.cached) this.cached = getBrowserSupabase(this.url, this.anonKey);
    return this.cached;
  }

  private async one<T>(table: string, match: Record<string, unknown>): Promise<T | null> {
    const { data, error } = await this.client.from(table).select('*').match(match).maybeSingle();
    if (error) throw error;
    return (data as T) ?? null;
  }

  private async many<T>(table: string, match: Record<string, unknown> = {}): Promise<T[]> {
    const { data, error } = await this.client.from(table).select('*').match(match);
    if (error) throw error;
    return (data ?? []) as T[];
  }

  /* ------------------------------------------------------------------ auth */

  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const session = await this.sessionFromUser(data.user?.id ?? null);
    if (!session) throw new Error('NO_MEMBERSHIP');
    return session;
  }

  async signUp(input: {
    email: string;
    password: string;
    fullName: string;
    inviteCode?: string;
  }): Promise<Session> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { full_name: input.fullName, invite_code: input.inviteCode } },
    });
    if (error) throw error;
    // A Postgres trigger (`handle_new_user`, see schema.sql) creates the
    // profile row and redeems the invitation into an org_membership.
    const session = await this.sessionFromUser(data.user?.id ?? null);
    if (!session) throw new Error('NO_MEMBERSHIP');
    return session;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  private async sessionFromUser(userId: string | null): Promise<Session | null> {
    if (!userId) return null;
    const profile = await this.one<Session['profile']>('profiles', { id: userId });
    if (!profile) return null;
    const membership = await this.one<{ role: Role; team_id: string | null; org_id: string }>(
      'org_memberships',
      { profile_id: userId, org_id: this.orgId },
    );
    if (!membership) return null;
    const cohort = await this.one<Cohort>('cohorts', { org_id: this.orgId, status: 'active' });
    return {
      profile,
      role: membership.role,
      org_id: membership.org_id,
      cohort_id: cohort?.id ?? '',
      team_id: membership.team_id,
    };
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getUser();
    return this.sessionFromUser(data.user?.id ?? null);
  }

  async requestPasswordReset(email: string): Promise<void> {
    // Deliberately not `this.client.auth.resetPasswordForEmail()` — that
    // sends from Supabase's own mailer and redirects to whatever "Site URL"
    // is configured in the project's Auth settings, which on this project
    // points at localhost. `/api/auth/request-reset` generates the recovery
    // link with the service-role key, redirecting to this app's own origin,
    // and emails it through Resend instead. See that route for the full
    // rationale.
    const locale = typeof document !== 'undefined' ? document.documentElement.lang : undefined;
    const response = await fetch('/api/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, locale: locale === 'en' ? 'en' : 'ar' }),
    });
    if (!response.ok) throw new Error('RESET_REQUEST_FAILED');
  }

  async resetPassword(_token: string, password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
  }

  async lookupInvitation(code: string): Promise<Invitation | null> {
    return this.one<Invitation>('invitations', { code, org_id: this.orgId });
  }

  async acceptInvitation(): Promise<Session> {
    throw NOT_IMPLEMENTED('acceptInvitation');
  }

  /* -------------------------------------------------------- org and cohort */

  async getOrganization(): Promise<Organization> {
    const org = await this.one<Organization>('organizations', { id: this.orgId });
    if (!org) throw new Error('NOT_FOUND');
    return org;
  }

  async updateOrganization(patch: Partial<Organization>): Promise<Organization> {
    const { data, error } = await this.client
      .from('organizations')
      .update(patch)
      .eq('id', this.orgId)
      .select()
      .single();
    if (error) throw error;
    return data as Organization;
  }

  async getCohort(): Promise<Cohort> {
    const cohort = await this.one<Cohort>('cohorts', { org_id: this.orgId, status: 'active' });
    if (!cohort) throw new Error('NOT_FOUND');
    return cohort;
  }

  async updateCohort(patch: Partial<Cohort>): Promise<Cohort> {
    const current = await this.getCohort();
    const { data, error } = await this.client
      .from('cohorts')
      .update(patch)
      .eq('id', current.id)
      .select()
      .single();
    if (error) throw error;
    return data as Cohort;
  }

  /* ----------------------------------------------------------------- teams */

  async listTeams(): Promise<Team[]> {
    return this.many<Team>('teams', { org_id: this.orgId });
  }

  async getTeam(id: string): Promise<Team | null> {
    return this.one<Team>('teams', { id });
  }

  async createTeam(input: TeamInput): Promise<Team> {
    const { data, error } = await this.client.from('teams').insert(input).select().single();
    if (error) throw error;
    return data as Team;
  }

  async updateTeam(id: string, patch: Partial<TeamInput>): Promise<Team> {
    const { data, error } = await this.client
      .from('teams')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Team;
  }

  async archiveTeam(id: string): Promise<Team> {
    return this.updateTeam(id, { status: 'archived' });
  }

  async restoreTeam(id: string): Promise<Team> {
    return this.updateTeam(id, { status: 'active' });
  }

  async deleteTeam(id: string): Promise<void> {
    const { error } = await this.client.from('teams').delete().eq('id', id);
    if (error) throw error;
  }

  async importTeams(rows: Partial<TeamInput>[]): Promise<{ created: number; updated: number }> {
    const { error } = await this.client.from('teams').upsert(rows, { onConflict: 'org_id,slug' });
    if (error) throw error;
    // Postgrest does not report created-vs-updated counts; a SQL function
    // would be needed for an exact split.
    return { created: rows.length, updated: 0 };
  }

  /* ----------------------------------------------------------- invitations */

  async listInvitations(): Promise<Invitation[]> {
    return this.many<Invitation>('invitations', { org_id: this.orgId });
  }

  async createInvitation(input: {
    email: string;
    role: Role;
    team_id: string | null;
  }): Promise<Invitation> {
    const { data, error } = await this.client
      .from('invitations')
      .insert({ ...input, org_id: this.orgId })
      .select()
      .single();
    if (error) throw error;
    return data as Invitation;
  }

  async revokeInvitation(id: string): Promise<Invitation> {
    const { data, error } = await this.client
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Invitation;
  }

  /* ----------------------------------------------------------------- forms */

  async listForms(): Promise<Form[]> {
    return this.many<Form>('forms', { org_id: this.orgId });
  }

  async getForm(id: string): Promise<Form | null> {
    return this.one<Form>('forms', { id });
  }

  async getFormBySlug(slug: string): Promise<Form | null> {
    const pub = await this.one<FormPublication>('form_publications', { slug });
    return pub ? this.getForm(pub.form_id) : null;
  }

  async createForm(input: FormInput): Promise<Form> {
    const { data, error } = await this.client.from('forms').insert(input).select().single();
    if (error) throw error;
    return data as Form;
  }

  async updateForm(id: string, patch: Partial<FormInput>): Promise<Form> {
    const { data, error } = await this.client
      .from('forms')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Form;
  }

  async deleteForm(id: string): Promise<void> {
    const { error } = await this.client.from('forms').delete().eq('id', id);
    if (error) throw error;
  }

  async duplicateForm(): Promise<Form> {
    // Needs a `duplicate_form(uuid)` SQL function to stay transactional.
    throw NOT_IMPLEMENTED('duplicateForm');
  }

  async publishForm(): Promise<FormPublication> {
    // Needs a `publish_form(uuid)` SQL function so slug allocation is atomic.
    throw NOT_IMPLEMENTED('publishForm');
  }

  async closeForm(id: string): Promise<Form> {
    return this.updateForm(id, { status: 'closed' });
  }

  async getPublication(formId: string): Promise<FormPublication | null> {
    return this.one<FormPublication>('form_publications', { form_id: formId });
  }

  async listSections(formId: string): Promise<FormSection[]> {
    return this.many<FormSection>('form_sections', { form_id: formId });
  }

  async saveSections(formId: string, sections: FormSection[]): Promise<FormSection[]> {
    await this.client.from('form_sections').delete().eq('form_id', formId);
    const { data, error } = await this.client.from('form_sections').insert(sections).select();
    if (error) throw error;
    return data as FormSection[];
  }

  async listFields(formId: string): Promise<FormField[]> {
    return this.many<FormField>('form_fields', { form_id: formId });
  }

  async saveFields(formId: string, fields: FormField[]): Promise<FormField[]> {
    await this.client.from('form_fields').delete().eq('form_id', formId);
    const { data, error } = await this.client.from('form_fields').insert(fields).select();
    if (error) throw error;
    return data as FormField[];
  }

  async listRules(formId: string): Promise<FormRule[]> {
    return this.many<FormRule>('form_rules', { form_id: formId });
  }

  async saveRules(formId: string, rules: FormRule[]): Promise<FormRule[]> {
    await this.client.from('form_rules').delete().eq('form_id', formId);
    const { data, error } = await this.client.from('form_rules').insert(rules).select();
    if (error) throw error;
    return data as FormRule[];
  }

  async listAudience(formId: string): Promise<FormAudience[]> {
    return this.many<FormAudience>('form_audiences', { form_id: formId });
  }

  async saveAudience(formId: string, audience: FormAudience[]): Promise<FormAudience[]> {
    await this.client.from('form_audiences').delete().eq('form_id', formId);
    const { data, error } = await this.client.from('form_audiences').insert(audience).select();
    if (error) throw error;
    return data as FormAudience[];
  }

  async listAssignedForms(): Promise<Form[]> {
    // In production this is enforced by RLS on `forms` joined to
    // `form_audiences`; the client simply selects and gets what it may see.
    const { data, error } = await this.client.from('forms').select('*').eq('status', 'published');
    if (error) throw error;
    return (data ?? []) as Form[];
  }

  /* ----------------------------------------------------------- submissions */

  async listSubmissions(formId?: string): Promise<Submission[]> {
    return formId ? this.many<Submission>('submissions', { form_id: formId }) : this.many<Submission>('submissions');
  }

  async listSubmissionsForTeam(teamId: string): Promise<Submission[]> {
    return this.many<Submission>('submissions', { team_id: teamId });
  }

  async getSubmission(id: string): Promise<Submission | null> {
    return this.one<Submission>('submissions', { id });
  }

  async listAnswers(submissionId: string): Promise<SubmissionAnswer[]> {
    return this.many<SubmissionAnswer>('submission_answers', { submission_id: submissionId });
  }

  private async writeSubmission(
    input: {
      form_id: string;
      team_id: string | null;
      profile_id: string | null;
      answers: Record<string, AnswerValue>;
      submission_id?: string;
    },
    finalise: boolean,
  ): Promise<Submission> {
    const payload: Record<string, unknown> = {
      form_id: input.form_id,
      team_id: input.team_id,
      profile_id: input.profile_id,
      status: finalise ? 'submitted' : 'draft',
      submitted_at: finalise ? new Date().toISOString() : null,
    };
    if (input.submission_id) payload.id = input.submission_id;
    const { data, error } = await this.client
      .from('submissions')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    const submission = data as Submission;

    await this.client.from('submission_answers').delete().eq('submission_id', submission.id);
    const rows = Object.entries(input.answers)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([field_id, value]) => ({ submission_id: submission.id, field_id, value }));
    if (rows.length) {
      const { error: answerError } = await this.client.from('submission_answers').insert(rows);
      if (answerError) throw answerError;
    }
    return submission;
  }

  async saveDraft(input: Parameters<Repository['saveDraft']>[0]): Promise<Submission> {
    return this.writeSubmission(input, false);
  }

  async submitResponse(input: Parameters<Repository['submitResponse']>[0]): Promise<Submission> {
    return this.writeSubmission(input, true);
  }

  async setSubmissionReviewed(id: string, reviewed: boolean): Promise<Submission> {
    const { data, error } = await this.client
      .from('submissions')
      .update({
        status: reviewed ? 'reviewed' : 'submitted',
        reviewed_at: reviewed ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Submission;
  }

  async setSubmissionNotes(id: string, notes: string): Promise<Submission> {
    const { data, error } = await this.client
      .from('submissions')
      .update({ internal_notes: notes })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Submission;
  }

  /* ----------------------------------------------------------------- files */

  async saveFile(input: Omit<FileRef, 'id' | 'uploaded_at'>): Promise<FileRef> {
    const { data, error } = await this.client.from('files').insert(input).select().single();
    if (error) throw error;
    return data as FileRef;
  }

  async listFiles(): Promise<FileRef[]> {
    return this.many<FileRef>('files', { org_id: this.orgId });
  }

  /* ------------------------------------------------------------ appearance */

  async getTheme(): Promise<ThemeSettings> {
    const theme = await this.one<ThemeSettings>('theme_settings', { org_id: this.orgId });
    if (!theme) throw new Error('NOT_FOUND');
    return theme;
  }

  async saveTheme(input: { preset: ThemePresetKey; tokens: ThemeTokens }): Promise<ThemeSettings> {
    // `org_id` carries its own UNIQUE constraint (see schema.sql) but is not
    // the primary key — `id` is. Without an explicit `onConflict`, upsert()
    // targets the primary key by default, so every save after the very
    // first one tried to INSERT a fresh row and collided with the org_id
    // constraint instead of updating the existing one: a 409 on every
    // publish after the first, silently swallowed by nothing (the request
    // just failed) until the Appearance page started publishing on every
    // click instead of behind an explicit "Publish" button.
    const { data, error } = await this.client
      .from('theme_settings')
      .upsert({ org_id: this.orgId, ...input, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
      .select()
      .single();
    if (error) throw error;
    return data as ThemeSettings;
  }

  async listAuditLogs(limit = 50): Promise<AuditLog[]> {
    const { data, error } = await this.client
      .from('audit_logs')
      .select('*')
      .eq('org_id', this.orgId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AuditLog[];
  }
}
