/**
 * DemoAdapter — a full `Repository` implementation backed by localStorage.
 *
 * It exists so the product is genuinely usable (and demoable) without a live
 * Supabase project. Every write goes through `mutate()`, which persists the
 * whole store under one key and notifies subscribers, so React views stay in
 * sync the same way they would with Supabase realtime.
 *
 * On the server (SSR / build) there is no localStorage, so the adapter falls
 * back to the pristine seed. Pages that need live data therefore read it in a
 * client component after mount.
 */

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
  OrgMembership,
  Organization,
  Profile,
  Repository,
  Role,
  Session,
  Submission,
  SubmissionAnswer,
  Team,
  TeamInput,
  TeamMember,
  ThemePresetKey,
  ThemeSettings,
  ThemeTokens,
} from './types';
import {
  COHORT_ID,
  DEMO_ADMIN_EMAIL,
  DEMO_PARTICIPANT_EMAIL,
  DEMO_PASSWORD,
  DEMO_REVIEWER_EMAIL,
  ORG_ID,
  makeInviteCode,
  seedAuditLogs,
  seedCohort,
  seedForms,
  seedInvitations,
  seedMemberships,
  seedOrganization,
  seedProfiles,
  seedSubmissions,
  seedTeamMembers,
  seedTeams,
  seedTheme,
} from './seed';

export const STORE_KEY = 'fba.demo.store.v1';
export const SESSION_KEY = 'fba.demo.session.v1';
/** Mirrored into a cookie so Next.js middleware can guard routes. */
export const SESSION_COOKIE = 'fba_demo_session';

interface Store {
  version: number;
  organization: Organization;
  cohort: Cohort;
  profiles: Profile[];
  memberships: OrgMembership[];
  teams: Team[];
  teamMembers: TeamMember[];
  invitations: Invitation[];
  forms: Form[];
  sections: FormSection[];
  fields: FormField[];
  rules: FormRule[];
  publications: FormPublication[];
  audiences: FormAudience[];
  submissions: Submission[];
  answers: SubmissionAnswer[];
  files: FileRef[];
  theme: ThemeSettings;
  audit: AuditLog[];
}

function buildSeedStore(): Store {
  const teams = seedTeams();
  const { forms, sections, fields, rules, publications, audiences } = seedForms();
  const { submissions, answers } = seedSubmissions(teams, forms, fields);
  return {
    version: 1,
    organization: seedOrganization(),
    cohort: seedCohort(),
    profiles: seedProfiles(),
    memberships: seedMemberships(teams),
    teams,
    teamMembers: seedTeamMembers(teams),
    invitations: seedInvitations(teams),
    forms,
    sections,
    fields,
    rules,
    publications,
    audiences,
    submissions,
    answers,
    files: [],
    theme: seedTheme(),
    audit: seedAuditLogs(),
  };
}

const isBrowser = () => typeof window !== 'undefined';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function newId(prefix: string): string {
  const rand =
    isBrowser() && window.crypto?.randomUUID
      ? window.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

const nowIso = () => new Date().toISOString();

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'form';
}

type Listener = () => void;

export class DemoAdapter implements Repository {
  readonly mode = 'demo' as const;

  private cache: Store | null = null;
  private listeners = new Set<Listener>();

  /* ------------------------------------------------------------- plumbing */

  private read(): Store {
    if (this.cache) return this.cache;
    if (!isBrowser()) {
      this.cache = buildSeedStore();
      return this.cache;
    }
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Store;
        if (parsed?.version === 1) {
          this.cache = parsed;
          return this.cache;
        }
      }
    } catch {
      // Corrupt or unavailable storage falls through to a fresh seed.
    }
    this.cache = buildSeedStore();
    this.persist();
    return this.cache;
  }

  private persist() {
    if (!isBrowser() || !this.cache) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(this.cache));
    } catch {
      // Quota errors are non-fatal in demo mode; the in-memory cache still works.
    }
  }

  private mutate<T>(fn: (store: Store) => T): T {
    const store = this.read();
    const result = fn(store);
    this.persist();
    this.listeners.forEach((l) => l());
    return result;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private log(action: string, entity: string, entityId: string, meta: Record<string, unknown> = {}) {
    const store = this.read();
    store.audit.unshift({
      id: newId('audit'),
      org_id: ORG_ID,
      actor_id: this.currentProfileId() ?? 'profile_admin',
      action,
      entity,
      entity_id: entityId,
      meta,
      created_at: nowIso(),
    });
    store.audit = store.audit.slice(0, 200);
  }

  private currentProfileId(): string | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session).profile.id : null;
    } catch {
      return null;
    }
  }

  /* ------------------------------------------------------------------ auth */

  private buildSession(profile: Profile): Session {
    const store = this.read();
    const membership = store.memberships.find((m) => m.profile_id === profile.id);
    return {
      profile,
      role: membership?.role ?? 'participant',
      org_id: ORG_ID,
      cohort_id: COHORT_ID,
      team_id: membership?.team_id ?? null,
    };
  }

  private writeSession(session: Session | null) {
    if (!isBrowser()) return;
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      // Middleware reads this cookie; it holds no secret, only the role and
      // team, exactly as a signed JWT claim set would in production.
      const payload = encodeURIComponent(
        JSON.stringify({ role: session.role, team_id: session.team_id, email: session.profile.email }),
      );
      document.cookie = `${SESSION_COOKIE}=${payload}; path=/; max-age=86400; samesite=lax`;
    } else {
      window.localStorage.removeItem(SESSION_KEY);
      document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    }
  }

  async signIn(email: string, password: string): Promise<Session> {
    const store = this.read();
    const normalised = email.trim().toLowerCase();
    const profile = store.profiles.find((p) => p.email.toLowerCase() === normalised);
    if (!profile) {
      throw new Error('NO_ACCOUNT');
    }
    const isDemoAccount = [DEMO_ADMIN_EMAIL, DEMO_PARTICIPANT_EMAIL, DEMO_REVIEWER_EMAIL].includes(
      profile.email,
    );
    // Demo accounts take the shared demo password. Accounts created through
    // sign-up in this session accept any non-empty password, because there is
    // no password store in demo mode.
    if (isDemoAccount && password !== DEMO_PASSWORD) {
      throw new Error('BAD_PASSWORD');
    }
    if (!password) throw new Error('BAD_PASSWORD');
    const session = this.buildSession(profile);
    this.writeSession(session);
    return session;
  }

  async signUp(input: {
    email: string;
    password: string;
    fullName: string;
    inviteCode?: string;
  }): Promise<Session> {
    return this.mutate((store) => {
      const existing = store.profiles.find(
        (p) => p.email.toLowerCase() === input.email.trim().toLowerCase(),
      );
      if (existing) throw new Error('EMAIL_TAKEN');

      const invitation = input.inviteCode
        ? store.invitations.find(
            (i) => i.code.toUpperCase() === input.inviteCode!.toUpperCase() && i.status === 'pending',
          )
        : undefined;

      const profile: Profile = {
        id: newId('profile'),
        email: input.email.trim(),
        full_name: { ar: input.fullName, en: input.fullName },
        avatar_url: null,
        locale: 'ar',
        created_at: nowIso(),
      };
      store.profiles.push(profile);
      store.memberships.push({
        id: newId('mem'),
        org_id: ORG_ID,
        profile_id: profile.id,
        role: invitation?.role ?? 'participant',
        team_id: invitation?.team_id ?? null,
        created_at: nowIso(),
      });
      if (invitation) {
        invitation.status = 'accepted';
        invitation.accepted_at = nowIso();
      }
      const session = this.buildSession(profile);
      this.writeSession(session);
      this.log('auth.sign_up', 'profiles', profile.id, {});
      return session;
    });
  }

  async signOut(): Promise<void> {
    this.writeSession(null);
    this.listeners.forEach((l) => l());
  }

  async getSession(): Promise<Session | null> {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const stored = JSON.parse(raw) as Session;
      // Re-derive from the store so a role change is picked up on reload.
      const store = this.read();
      const profile = store.profiles.find((p) => p.id === stored.profile.id);
      return profile ? this.buildSession(profile) : null;
    } catch {
      return null;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const store = this.read();
    const profile = store.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
    // Deliberately does not reveal whether the account exists.
    if (profile) this.log('auth.reset_requested', 'profiles', profile.id, {});
  }

  async resetPassword(token: string, password: string): Promise<void> {
    if (!token || password.length < 8) throw new Error('WEAK_PASSWORD');
    // No password store in demo mode — this is a no-op that validates input.
  }

  async lookupInvitation(code: string): Promise<Invitation | null> {
    const store = this.read();
    return (
      store.invitations.find((i) => i.code.toUpperCase() === code.trim().toUpperCase()) ?? null
    );
  }

  async acceptInvitation(
    code: string,
    profileInput: { email: string; fullName: string },
  ): Promise<Session> {
    const invitation = await this.lookupInvitation(code);
    if (!invitation) throw new Error('INVALID_CODE');
    if (invitation.status === 'revoked') throw new Error('REVOKED_CODE');
    return this.signUp({
      email: profileInput.email,
      password: DEMO_PASSWORD,
      fullName: profileInput.fullName,
      inviteCode: code,
    });
  }

  /* ------------------------------------------------------- org and cohort */

  async getOrganization(): Promise<Organization> {
    return clone(this.read().organization);
  }

  async updateOrganization(patch: Partial<Organization>): Promise<Organization> {
    return this.mutate((store) => {
      store.organization = { ...store.organization, ...patch, id: store.organization.id };
      this.log('org.updated', 'organizations', store.organization.id, {});
      return clone(store.organization);
    });
  }

  async getCohort(): Promise<Cohort> {
    return clone(this.read().cohort);
  }

  async updateCohort(patch: Partial<Cohort>): Promise<Cohort> {
    return this.mutate((store) => {
      store.cohort = { ...store.cohort, ...patch, id: store.cohort.id };
      this.log('cohort.updated', 'cohorts', store.cohort.id, {});
      return clone(store.cohort);
    });
  }

  /* ----------------------------------------------------------------- teams */

  async listTeams(): Promise<Team[]> {
    return clone(this.read().teams);
  }

  async getTeam(id: string): Promise<Team | null> {
    return clone(this.read().teams.find((t) => t.id === id || t.slug === id) ?? null);
  }

  async createTeam(input: TeamInput): Promise<Team> {
    return this.mutate((store) => {
      const team: Team = {
        ...input,
        id: newId('team'),
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      store.teams.push(team);
      this.log('team.created', 'teams', team.id, { name: team.name.en });
      return clone(team);
    });
  }

  async updateTeam(id: string, patch: Partial<TeamInput>): Promise<Team> {
    return this.mutate((store) => {
      const team = store.teams.find((t) => t.id === id);
      if (!team) throw new Error('NOT_FOUND');
      Object.assign(team, patch, { updated_at: nowIso() });
      this.log('team.updated', 'teams', team.id, {});
      return clone(team);
    });
  }

  async archiveTeam(id: string): Promise<Team> {
    return this.updateTeam(id, { status: 'archived' });
  }

  async restoreTeam(id: string): Promise<Team> {
    return this.updateTeam(id, { status: 'active' });
  }

  async deleteTeam(id: string): Promise<void> {
    this.mutate((store) => {
      store.teams = store.teams.filter((t) => t.id !== id);
      store.teamMembers = store.teamMembers.filter((m) => m.team_id !== id);
      this.log('team.deleted', 'teams', id, {});
    });
  }

  async importTeams(rows: Partial<TeamInput>[]): Promise<{ created: number; updated: number }> {
    return this.mutate((store) => {
      let created = 0;
      let updated = 0;
      rows.forEach((row) => {
        if (!row.slug && !row.name) return;
        const slug = row.slug ?? slugify(row.name?.en ?? '');
        const existing = store.teams.find((t) => t.slug === slug);
        if (existing) {
          Object.assign(existing, row, { slug, updated_at: nowIso() });
          updated += 1;
        } else {
          store.teams.push({
            org_id: ORG_ID,
            cohort_id: COHORT_ID,
            slug,
            name: { ar: '', en: '' },
            track: { ar: '', en: '' },
            description: { ar: '', en: '' },
            city: { ar: '', en: '' },
            stage: 'seed',
            readiness: 0,
            revenue_band: '',
            team_size: 0,
            business_model: { ar: '', en: '' },
            key_strengths: [],
            challenges: [],
            growth_path: '',
            founders: [],
            status: 'active',
            internal_notes: '',
            ...row,
            id: newId('team'),
            created_at: nowIso(),
            updated_at: nowIso(),
          });
          created += 1;
        }
      });
      this.log('team.imported', 'teams', 'bulk', { created, updated });
      return { created, updated };
    });
  }

  /* ----------------------------------------------------------- invitations */

  async listInvitations(): Promise<Invitation[]> {
    return clone(this.read().invitations);
  }

  async createInvitation(input: {
    email: string;
    role: Role;
    team_id: string | null;
  }): Promise<Invitation> {
    return this.mutate((store) => {
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      const invitation: Invitation = {
        id: newId('inv'),
        org_id: ORG_ID,
        team_id: input.team_id,
        email: input.email.trim(),
        role: input.role,
        code: makeInviteCode(),
        status: 'pending',
        expires_at: expires.toISOString(),
        created_at: nowIso(),
        accepted_at: null,
      };
      store.invitations.unshift(invitation);
      this.log('invitation.created', 'invitations', invitation.id, { email: invitation.email });
      return clone(invitation);
    });
  }

  async revokeInvitation(id: string): Promise<Invitation> {
    return this.mutate((store) => {
      const inv = store.invitations.find((i) => i.id === id);
      if (!inv) throw new Error('NOT_FOUND');
      inv.status = 'revoked';
      this.log('invitation.revoked', 'invitations', id, {});
      return clone(inv);
    });
  }

  /* ----------------------------------------------------------------- forms */

  async listForms(): Promise<Form[]> {
    return clone(this.read().forms);
  }

  async getForm(id: string): Promise<Form | null> {
    return clone(this.read().forms.find((f) => f.id === id) ?? null);
  }

  async getFormBySlug(slug: string): Promise<Form | null> {
    const store = this.read();
    const pub = store.publications.find((p) => p.slug === slug);
    if (!pub) return null;
    return clone(store.forms.find((f) => f.id === pub.form_id) ?? null);
  }

  async createForm(input: FormInput): Promise<Form> {
    return this.mutate((store) => {
      const form: Form = { ...input, id: newId('form'), created_at: nowIso(), updated_at: nowIso() };
      store.forms.unshift(form);
      store.audiences.push({ id: newId('aud'), form_id: form.id, scope: 'all', team_id: null });
      this.log('form.created', 'forms', form.id, { template: form.template_key });
      return clone(form);
    });
  }

  async updateForm(id: string, patch: Partial<FormInput>): Promise<Form> {
    return this.mutate((store) => {
      const form = store.forms.find((f) => f.id === id);
      if (!form) throw new Error('NOT_FOUND');
      Object.assign(form, patch, { updated_at: nowIso() });
      return clone(form);
    });
  }

  async deleteForm(id: string): Promise<void> {
    this.mutate((store) => {
      store.forms = store.forms.filter((f) => f.id !== id);
      store.sections = store.sections.filter((s) => s.form_id !== id);
      store.fields = store.fields.filter((f) => f.form_id !== id);
      store.rules = store.rules.filter((r) => r.form_id !== id);
      store.publications = store.publications.filter((p) => p.form_id !== id);
      store.audiences = store.audiences.filter((a) => a.form_id !== id);
      const removed = store.submissions.filter((s) => s.form_id === id).map((s) => s.id);
      store.submissions = store.submissions.filter((s) => s.form_id !== id);
      store.answers = store.answers.filter((a) => !removed.includes(a.submission_id));
      this.log('form.deleted', 'forms', id, {});
    });
  }

  async duplicateForm(id: string): Promise<Form> {
    return this.mutate((store) => {
      const source = store.forms.find((f) => f.id === id);
      if (!source) throw new Error('NOT_FOUND');
      const newFormId = newId('form');
      const sectionIdMap = new Map<string, string>();
      const fieldIdMap = new Map<string, string>();

      const copy: Form = {
        ...clone(source),
        id: newFormId,
        title: { ar: `${source.title.ar} (نسخة)`, en: `${source.title.en} (copy)` },
        status: 'draft',
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      store.forms.unshift(copy);

      store.sections
        .filter((s) => s.form_id === id)
        .forEach((s) => {
          const nid = newId('section');
          sectionIdMap.set(s.id, nid);
          store.sections.push({ ...clone(s), id: nid, form_id: newFormId });
        });
      store.fields
        .filter((f) => f.form_id === id)
        .forEach((f) => {
          const nid = newId('field');
          fieldIdMap.set(f.id, nid);
          store.fields.push({
            ...clone(f),
            id: nid,
            form_id: newFormId,
            section_id: sectionIdMap.get(f.section_id) ?? f.section_id,
          });
        });
      store.rules
        .filter((r) => r.form_id === id)
        .forEach((r) => {
          store.rules.push({
            ...clone(r),
            id: newId('rule'),
            form_id: newFormId,
            source_field_id: fieldIdMap.get(r.source_field_id) ?? r.source_field_id,
            target_field_id: fieldIdMap.get(r.target_field_id) ?? r.target_field_id,
          });
        });
      store.audiences
        .filter((a) => a.form_id === id)
        .forEach((a) => store.audiences.push({ ...clone(a), id: newId('aud'), form_id: newFormId }));

      this.log('form.duplicated', 'forms', newFormId, { from: id });
      return clone(copy);
    });
  }

  async publishForm(id: string): Promise<FormPublication> {
    return this.mutate((store) => {
      const form = store.forms.find((f) => f.id === id);
      if (!form) throw new Error('NOT_FOUND');
      form.status = 'published';
      form.updated_at = nowIso();

      let pub = store.publications.find((p) => p.form_id === id);
      if (pub) {
        pub.unpublished_at = null;
        pub.published_at = nowIso();
      } else {
        let slug = slugify(form.title.en || form.title.ar);
        let n = 1;
        while (store.publications.some((p) => p.slug === slug)) {
          n += 1;
          slug = `${slugify(form.title.en || form.title.ar)}-${n}`;
        }
        pub = {
          id: newId('pub'),
          form_id: id,
          slug,
          published_at: nowIso(),
          published_by: this.currentProfileId() ?? 'profile_admin',
          unpublished_at: null,
        };
        store.publications.push(pub);
      }
      this.log('form.published', 'forms', id, { slug: pub.slug });
      return clone(pub);
    });
  }

  async closeForm(id: string): Promise<Form> {
    return this.mutate((store) => {
      const form = store.forms.find((f) => f.id === id);
      if (!form) throw new Error('NOT_FOUND');
      form.status = 'closed';
      form.updated_at = nowIso();
      const pub = store.publications.find((p) => p.form_id === id);
      if (pub) pub.unpublished_at = nowIso();
      this.log('form.closed', 'forms', id, {});
      return clone(form);
    });
  }

  async getPublication(formId: string): Promise<FormPublication | null> {
    return clone(this.read().publications.find((p) => p.form_id === formId) ?? null);
  }

  async listSections(formId: string): Promise<FormSection[]> {
    return clone(
      this.read()
        .sections.filter((s) => s.form_id === formId)
        .sort((a, b) => a.position - b.position),
    );
  }

  async saveSections(formId: string, sections: FormSection[]): Promise<FormSection[]> {
    return this.mutate((store) => {
      store.sections = store.sections.filter((s) => s.form_id !== formId).concat(clone(sections));
      return clone(sections);
    });
  }

  async listFields(formId: string): Promise<FormField[]> {
    return clone(
      this.read()
        .fields.filter((f) => f.form_id === formId)
        .sort((a, b) => a.position - b.position),
    );
  }

  async saveFields(formId: string, fields: FormField[]): Promise<FormField[]> {
    return this.mutate((store) => {
      const normalised = fields.map((f, i) => ({ ...clone(f), position: i }));
      store.fields = store.fields.filter((f) => f.form_id !== formId).concat(normalised);
      return clone(normalised);
    });
  }

  async listRules(formId: string): Promise<FormRule[]> {
    return clone(this.read().rules.filter((r) => r.form_id === formId));
  }

  async saveRules(formId: string, rules: FormRule[]): Promise<FormRule[]> {
    return this.mutate((store) => {
      store.rules = store.rules.filter((r) => r.form_id !== formId).concat(clone(rules));
      return clone(rules);
    });
  }

  async listAudience(formId: string): Promise<FormAudience[]> {
    return clone(this.read().audiences.filter((a) => a.form_id === formId));
  }

  async saveAudience(formId: string, audience: FormAudience[]): Promise<FormAudience[]> {
    return this.mutate((store) => {
      store.audiences = store.audiences.filter((a) => a.form_id !== formId).concat(clone(audience));
      return clone(audience);
    });
  }

  async listAssignedForms(teamId: string | null): Promise<Form[]> {
    const store = this.read();
    return clone(
      store.forms.filter((form) => {
        // Only `status` gates availability. The fixture's open/close dates sit
        // on the programme calendar, which may be ahead of the wall clock, so
        // gating on them too would leave the participant with nothing to fill.
        // A real deployment would additionally compare against `now`.
        if (form.status !== 'published') return false;
        const audience = store.audiences.filter((a) => a.form_id === form.id);
        if (!audience.length) return true;
        if (audience.some((a) => a.scope === 'all')) return true;
        return teamId ? audience.some((a) => a.team_id === teamId) : false;
      }),
    );
  }

  /* ----------------------------------------------------------- submissions */

  async listSubmissions(formId?: string): Promise<Submission[]> {
    const all = this.read().submissions;
    return clone(formId ? all.filter((s) => s.form_id === formId) : all);
  }

  async listSubmissionsForTeam(teamId: string): Promise<Submission[]> {
    return clone(this.read().submissions.filter((s) => s.team_id === teamId));
  }

  async getSubmission(id: string): Promise<Submission | null> {
    return clone(this.read().submissions.find((s) => s.id === id) ?? null);
  }

  async listAnswers(submissionId: string): Promise<SubmissionAnswer[]> {
    return clone(this.read().answers.filter((a) => a.submission_id === submissionId));
  }

  private upsertSubmission(
    input: {
      form_id: string;
      team_id: string | null;
      profile_id: string | null;
      answers: Record<string, AnswerValue>;
      submission_id?: string;
    },
    finalise: boolean,
  ): Submission {
    return this.mutate((store) => {
      let submission = input.submission_id
        ? store.submissions.find((s) => s.id === input.submission_id)
        : store.submissions.find(
            (s) =>
              s.form_id === input.form_id &&
              s.status === 'draft' &&
              (input.profile_id ? s.profile_id === input.profile_id : s.team_id === input.team_id),
          );

      if (!submission) {
        submission = {
          id: newId('sub'),
          form_id: input.form_id,
          team_id: input.team_id,
          profile_id: input.profile_id,
          status: 'draft',
          started_at: nowIso(),
          submitted_at: null,
          reviewed_at: null,
          internal_notes: '',
        };
        store.submissions.push(submission);
      }

      if (finalise) {
        submission.status = 'submitted';
        submission.submitted_at = nowIso();
      }

      store.answers = store.answers.filter((a) => a.submission_id !== submission!.id);
      Object.entries(input.answers).forEach(([fieldId, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value) && value.length === 0) return;
        store.answers.push({
          id: `ans_${submission!.id}_${fieldId}`,
          submission_id: submission!.id,
          field_id: fieldId,
          value,
        });
      });

      if (finalise) this.log('submission.submitted', 'submissions', submission.id, {
        form_id: input.form_id,
      });

      return clone(submission);
    });
  }

  async saveDraft(input: Parameters<Repository['saveDraft']>[0]): Promise<Submission> {
    return this.upsertSubmission(input, false);
  }

  async submitResponse(input: Parameters<Repository['submitResponse']>[0]): Promise<Submission> {
    return this.upsertSubmission(input, true);
  }

  async setSubmissionReviewed(id: string, reviewed: boolean): Promise<Submission> {
    return this.mutate((store) => {
      const sub = store.submissions.find((s) => s.id === id);
      if (!sub) throw new Error('NOT_FOUND');
      sub.status = reviewed ? 'reviewed' : 'submitted';
      sub.reviewed_at = reviewed ? nowIso() : null;
      return clone(sub);
    });
  }

  async setSubmissionNotes(id: string, notes: string): Promise<Submission> {
    return this.mutate((store) => {
      const sub = store.submissions.find((s) => s.id === id);
      if (!sub) throw new Error('NOT_FOUND');
      sub.internal_notes = notes;
      return clone(sub);
    });
  }

  /* ----------------------------------------------------------------- files */

  async saveFile(input: Omit<FileRef, 'id' | 'uploaded_at'>): Promise<FileRef> {
    return this.mutate((store) => {
      const file: FileRef = { ...input, id: newId('file'), uploaded_at: nowIso() };
      store.files.push(file);
      return clone(file);
    });
  }

  async listFiles(formId?: string): Promise<FileRef[]> {
    const store = this.read();
    if (!formId) return clone(store.files);
    const subs = store.submissions.filter((s) => s.form_id === formId).map((s) => s.id);
    return clone(store.files.filter((f) => f.submission_id && subs.includes(f.submission_id)));
  }

  /* ------------------------------------------------------------ appearance */

  async getTheme(): Promise<ThemeSettings> {
    return clone(this.read().theme);
  }

  async saveTheme(input: { preset: ThemePresetKey; tokens: ThemeTokens }): Promise<ThemeSettings> {
    return this.mutate((store) => {
      store.theme = {
        ...store.theme,
        preset: input.preset,
        tokens: input.tokens,
        updated_at: nowIso(),
        updated_by: this.currentProfileId() ?? 'profile_admin',
      };
      this.log('theme.published', 'theme_settings', store.theme.id, { preset: input.preset });
      return clone(store.theme);
    });
  }

  async listAuditLogs(limit = 50): Promise<AuditLog[]> {
    return clone(this.read().audit.slice(0, limit));
  }

  async resetDemoData(): Promise<void> {
    this.cache = buildSeedStore();
    this.persist();
    this.listeners.forEach((l) => l());
  }
}
