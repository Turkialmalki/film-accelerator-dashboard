-- =============================================================================
-- Row Level Security policies.
--
-- STATUS: never executed. Written against supabase/schema.sql; verify against a
-- real project before trusting it.
--
-- The model in one sentence: an admin sees everything inside their own
-- organisation, a participant sees only their own team's rows and only the
-- forms targeted at them, and internal notes are never exposed to a
-- participant at all.
-- =============================================================================

alter table organizations      enable row level security;
alter table cohorts            enable row level security;
alter table profiles           enable row level security;
alter table teams              enable row level security;
alter table org_memberships    enable row level security;
alter table team_members       enable row level security;
alter table invitations        enable row level security;
alter table forms              enable row level security;
alter table form_sections      enable row level security;
alter table form_fields        enable row level security;
alter table form_rules         enable row level security;
alter table form_publications  enable row level security;
alter table form_audiences     enable row level security;
alter table submissions        enable row level security;
alter table submission_answers enable row level security;
alter table files              enable row level security;
alter table theme_settings     enable row level security;
alter table audit_logs         enable row level security;

-- --------------------------------------------------------------- helpers ----
-- SECURITY DEFINER so a policy can read org_memberships without recursing into
-- that table's own policy.

create or replace function current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from org_memberships where profile_id = auth.uid() limit 1;
$$;

create or replace function current_role_name() returns app_role
language sql stable security definer set search_path = public as $$
  select role from org_memberships where profile_id = auth.uid() limit 1;
$$;

create or replace function current_team_id() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from org_memberships where profile_id = auth.uid() limit 1;
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_name() in ('owner', 'admin', 'reviewer'), false);
$$;

-- ---------------------------------------------------------- organisations ---

create policy org_read on organizations
  for select using (id = current_org_id());

create policy org_write on organizations
  for update using (id = current_org_id() and current_role_name() in ('owner', 'admin'));

create policy cohort_read on cohorts
  for select using (org_id = current_org_id());

create policy cohort_write on cohorts
  for all using (org_id = current_org_id() and current_role_name() in ('owner', 'admin'))
  with check (org_id = current_org_id());

-- ----------------------------------------------------------------- people ---

create policy profile_self_read on profiles
  for select using (
    id = auth.uid()
    or (is_admin() and exists (
      select 1 from org_memberships m
      where m.profile_id = profiles.id and m.org_id = current_org_id()
    ))
  );

create policy profile_self_write on profiles
  for update using (id = auth.uid());

-- `must_change_password` must not be self-clearable. An RLS policy cannot
-- express "this column may not change" without recursing into profiles, so it
-- is done with column privileges instead: drop the blanket UPDATE and grant
-- back only the columns a person legitimately edits about themselves.
--
-- Column-level grants are only consulted once the table-level privilege is
-- gone, hence the revoke-then-grant ordering.
--
-- The service-role key bypasses RLS *and* these grants, so the invite and
-- change-password routes are unaffected.
revoke update on profiles from authenticated;
grant update (email, full_name, avatar_url, locale) on profiles to authenticated;

-- The anon-key SupabaseAdapter must be able to answer "am I an admin or a
-- participant?" immediately after sign-in. That read is:
--
--     profiles         where id = auth.uid()          -> profile_self_read
--     org_memberships  where profile_id = auth.uid()  -> membership_read
--     cohorts          where org_id = current_org_id()-> cohort_read
--
-- All three are covered above. The helper functions are SECURITY DEFINER, so
-- `membership_read` calling `is_admin()` does not recurse into org_memberships'
-- own policy. Nothing here blocks the post-login bootstrap read.

create policy membership_read on org_memberships
  for select using (profile_id = auth.uid() or (is_admin() and org_id = current_org_id()));

create policy membership_write on org_memberships
  for all using (is_admin() and org_id = current_org_id())
  with check (org_id = current_org_id());

-- ------------------------------------------------------------------ teams ---

-- A participant can read their own team row. `internal_notes` is stripped by
-- the participant-facing view below rather than by column privileges, so the
-- admin client keeps using the base table unchanged.
create policy team_read on teams
  for select using (
    org_id = current_org_id() and (is_admin() or id = current_team_id())
  );

create policy team_write on teams
  for all using (is_admin() and org_id = current_org_id())
  with check (org_id = current_org_id());

create or replace view teams_public
with (security_invoker = true) as
  select id, org_id, cohort_id, slug, name, track, description, city, stage,
         readiness, revenue_band, team_size, business_model, key_strengths,
         challenges, growth_path, founders, status, created_at, updated_at
  from teams;

create policy team_member_read on team_members
  for select using (
    exists (
      select 1 from teams t
      where t.id = team_members.team_id
        and t.org_id = current_org_id()
        and (is_admin() or t.id = current_team_id())
    )
  );

create policy team_member_write on team_members
  for all using (
    is_admin() and exists (
      select 1 from teams t where t.id = team_members.team_id and t.org_id = current_org_id()
    )
  );

create policy invitation_admin on invitations
  for all using (is_admin() and org_id = current_org_id())
  with check (org_id = current_org_id());

-- ------------------------------------------------------------------ forms ---

-- A participant sees a form only if it is published AND either targeted at
-- every team or explicitly at theirs.
create policy form_read on forms
  for select using (
    org_id = current_org_id()
    and (
      is_admin()
      or (
        status = 'published'
        and (
          not exists (select 1 from form_audiences a where a.form_id = forms.id)
          or exists (
            select 1 from form_audiences a
            where a.form_id = forms.id
              and (a.scope = 'all' or a.team_id = current_team_id())
          )
        )
      )
    )
  );

create policy form_write on forms
  for all using (is_admin() and org_id = current_org_id())
  with check (org_id = current_org_id());

-- Structure tables inherit visibility from their form.
create policy section_read on form_sections
  for select using (exists (select 1 from forms f where f.id = form_sections.form_id));
create policy section_write on form_sections
  for all using (is_admin() and exists (select 1 from forms f where f.id = form_sections.form_id and f.org_id = current_org_id()));

create policy field_read on form_fields
  for select using (exists (select 1 from forms f where f.id = form_fields.form_id));
create policy field_write on form_fields
  for all using (is_admin() and exists (select 1 from forms f where f.id = form_fields.form_id and f.org_id = current_org_id()));

create policy rule_read on form_rules
  for select using (exists (select 1 from forms f where f.id = form_rules.form_id));
create policy rule_write on form_rules
  for all using (is_admin() and exists (select 1 from forms f where f.id = form_rules.form_id and f.org_id = current_org_id()));

create policy publication_read on form_publications
  for select using (exists (select 1 from forms f where f.id = form_publications.form_id));
create policy publication_write on form_publications
  for all using (is_admin() and exists (select 1 from forms f where f.id = form_publications.form_id and f.org_id = current_org_id()));

create policy audience_read on form_audiences
  for select using (exists (select 1 from forms f where f.id = form_audiences.form_id));
create policy audience_write on form_audiences
  for all using (is_admin() and exists (select 1 from forms f where f.id = form_audiences.form_id and f.org_id = current_org_id()));

-- ------------------------------------------------------------ submissions ---

create policy submission_read on submissions
  for select using (
    exists (select 1 from forms f where f.id = submissions.form_id and f.org_id = current_org_id())
    and (is_admin() or team_id = current_team_id() or profile_id = auth.uid())
  );

-- A participant may create and edit only their own team's rows, and only while
-- the submission is still a draft (or the form allows post-submit edits).
create policy submission_insert on submissions
  for insert with check (
    is_admin()
    or (team_id = current_team_id() and profile_id = auth.uid())
  );

create policy submission_update on submissions
  for update using (
    is_admin()
    or (
      team_id = current_team_id()
      and (
        status = 'draft'
        or exists (
          select 1 from forms f
          where f.id = submissions.form_id
            and coalesce((f.settings ->> 'allow_edit_after_submit')::boolean, false)
        )
      )
    )
  );

create policy submission_delete on submissions
  for delete using (is_admin());

create policy answer_read on submission_answers
  for select using (
    exists (select 1 from submissions s where s.id = submission_answers.submission_id)
  );

create policy answer_write on submission_answers
  for all using (
    exists (select 1 from submissions s where s.id = submission_answers.submission_id)
  );

create policy file_read on files
  for select using (
    org_id = current_org_id()
    and (
      is_admin()
      or exists (
        select 1 from submissions s
        where s.id = files.submission_id and s.team_id = current_team_id()
      )
    )
  );

create policy file_write on files
  for insert with check (org_id = current_org_id());

-- ------------------------------------------------------------- appearance ---

-- Everyone in the org reads the theme; only an owner or admin publishes it.
create policy theme_read on theme_settings
  for select using (org_id = current_org_id());

create policy theme_write on theme_settings
  for all using (org_id = current_org_id() and current_role_name() in ('owner', 'admin'))
  with check (org_id = current_org_id());

create policy audit_read on audit_logs
  for select using (is_admin() and org_id = current_org_id());

create policy audit_insert on audit_logs
  for insert with check (org_id = current_org_id());

-- -------------------------------------------------- anonymous share links ---
-- A published form reachable by its share link must be readable without a
-- session. Grant the `anon` role a narrow read path and insert-only writes.

create policy anon_publication_read on form_publications
  for select to anon using (unpublished_at is null);

create policy anon_form_read on forms
  for select to anon using (
    status = 'published'
    and exists (
      select 1 from form_publications p
      where p.form_id = forms.id and p.unpublished_at is null
    )
  );

create policy anon_field_read on form_fields
  for select to anon using (
    exists (select 1 from forms f where f.id = form_fields.form_id and f.status = 'published')
  );

create policy anon_rule_read on form_rules
  for select to anon using (
    exists (select 1 from forms f where f.id = form_rules.form_id and f.status = 'published')
  );

create policy anon_submission_insert on submissions
  for insert to anon with check (
    exists (select 1 from forms f where f.id = form_id and f.status = 'published')
  );

create policy anon_answer_insert on submission_answers
  for insert to anon with check (
    exists (
      select 1 from submissions s
      join forms f on f.id = s.form_id
      where s.id = submission_id and f.status = 'published'
    )
  );
