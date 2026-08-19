-- =============================================================================
-- Film Business Accelerator — target production schema
--
-- STATUS: this file has NEVER been executed. It was written alongside
-- lib/data/types.ts so the two stay in step, but no Supabase project was
-- available while building, so nothing here has been applied or verified.
-- Review it before running `supabase db push`.
--
-- Conventions
--   * Every user-authored string is bilingual and stored as jsonb: {"ar": …, "en": …}.
--   * Every tenant-scoped table carries org_id so RLS can be a single predicate.
--   * Deletes cascade down the ownership chain: org → cohort → form → submission.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ enums ---

create type app_role        as enum ('owner', 'admin', 'reviewer', 'participant');
create type cohort_status   as enum ('draft', 'active', 'completed', 'archived');
create type team_stage      as enum ('idea', 'mvp', 'pre-seed', 'seed', 'pre-a', 'series-a', 'growth');
create type team_status     as enum ('active', 'archived');
create type invite_status   as enum ('pending', 'accepted', 'revoked', 'expired');
create type form_status     as enum ('draft', 'published', 'closed');
create type submission_status as enum ('draft', 'submitted', 'reviewed');
create type audience_scope  as enum ('all', 'team');
create type rule_operator   as enum (
  'equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty',
  'greater_than', 'less_than'
);
create type rule_action     as enum ('show', 'hide');
create type field_type      as enum (
  'short_text', 'long_text', 'email', 'phone', 'number', 'url',
  'select', 'multi_select', 'radio', 'checkbox', 'consent',
  'rating', 'likert', 'nps',
  'date', 'time', 'datetime',
  'file', 'image',
  'team_select', 'participant_select',
  'section_heading', 'description', 'divider', 'page_break', 'hidden'
);

-- ------------------------------------------------------------ organisations -

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        jsonb not null,
  slug        text not null unique,
  logo_url    text,
  created_at  timestamptz not null default now()
);

create table cohorts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  name              jsonb not null,
  status            cohort_status not null default 'draft',
  starts_on         date not null,
  ends_on           date not null,
  current_milestone jsonb not null default '{"ar":"","en":""}'::jsonb,
  next_milestone_at date,
  created_at        timestamptz not null default now()
);

create index on cohorts (org_id, status);

-- ------------------------------------------------------------------ people --

-- Mirrors auth.users. Populated by the handle_new_user trigger below.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   jsonb not null default '{"ar":"","en":""}'::jsonb,
  avatar_url  text,
  locale      text not null default 'ar' check (locale in ('ar', 'en')),
  -- Set when an admin creates the account with a generated temporary password.
  -- The durable record; the enforced copy is the `must_change_password` claim
  -- in app_metadata, which middleware reads on every request without a query.
  -- Cleared by POST /api/auth/change-password, which writes both.
  -- Also shipped separately as migrations/0002_must_change_password.sql for
  -- projects where this schema has already been applied.
  must_change_password boolean not null default false,
  created_at  timestamptz not null default now()
);

create table teams (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  cohort_id      uuid not null references cohorts(id) on delete cascade,
  slug           text not null,
  name           jsonb not null,
  track          jsonb not null default '{"ar":"","en":""}'::jsonb,
  description    jsonb not null default '{"ar":"","en":""}'::jsonb,
  city           jsonb not null default '{"ar":"","en":""}'::jsonb,
  stage          team_stage not null default 'seed',
  readiness      int not null default 0 check (readiness between 0 and 100),
  revenue_band   text not null default '',
  team_size      int not null default 0,
  business_model jsonb not null default '{"ar":"","en":""}'::jsonb,
  key_strengths  text[] not null default '{}',
  challenges     text[] not null default '{}',
  growth_path    text not null default '',
  founders       jsonb not null default '[]'::jsonb,
  status         team_status not null default 'active',
  -- Admin-only column. The participant SELECT policy excludes it via a view.
  internal_notes text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, slug)
);

create index on teams (cohort_id, status);

-- org_memberships is the authorisation table: role and (for participants) the
-- single team the person belongs to.
create table org_memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        app_role not null default 'participant',
  team_id     uuid references teams(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (org_id, profile_id)
);

create index on org_memberships (profile_id);

create table team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  profile_id  uuid references profiles(id) on delete set null,
  name        jsonb not null,
  role        jsonb not null default '{"ar":"","en":""}'::jsonb,
  email       text,
  is_primary  boolean not null default false
);

create table invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  team_id     uuid references teams(id) on delete cascade,
  email       text not null,
  role        app_role not null default 'participant',
  code        text not null unique,
  status      invite_status not null default 'pending',
  expires_at  timestamptz not null default (now() + interval '30 days'),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

create index on invitations (org_id, status);

-- ------------------------------------------------------------------- forms --

create table forms (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  cohort_id    uuid not null references cohorts(id) on delete cascade,
  template_key text not null default 'blank',
  title        jsonb not null,
  description  jsonb not null default '{"ar":"","en":""}'::jsonb,
  status       form_status not null default 'draft',
  -- accent_color, multi_step, allow_drafts, allow_edit_after_submit,
  -- response_limit, opens_at, closes_at, confirmation_message
  settings     jsonb not null default '{}'::jsonb,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on forms (org_id, status);

create table form_sections (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references forms(id) on delete cascade,
  title       jsonb not null default '{"ar":"","en":""}'::jsonb,
  description jsonb not null default '{"ar":"","en":""}'::jsonb,
  position    int not null default 0
);

create index on form_sections (form_id, position);

create table form_fields (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references forms(id) on delete cascade,
  section_id    uuid references form_sections(id) on delete cascade,
  type          field_type not null,
  label         jsonb not null default '{"ar":"","en":""}'::jsonb,
  description   jsonb not null default '{"ar":"","en":""}'::jsonb,
  placeholder   jsonb not null default '{"ar":"","en":""}'::jsonb,
  required      boolean not null default false,
  position      int not null default 0,
  -- [{id, value, label:{ar,en}}]
  options       jsonb not null default '[]'::jsonb,
  -- {min,max,minLength,maxLength,pattern,scale,accept,maxSizeMb}
  validation    jsonb not null default '{}'::jsonb,
  default_value text not null default ''
);

create index on form_fields (form_id, position);

create table form_rules (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null references forms(id) on delete cascade,
  target_field_id uuid not null references form_fields(id) on delete cascade,
  source_field_id uuid not null references form_fields(id) on delete cascade,
  operator        rule_operator not null default 'equals',
  value           text not null default '',
  action          rule_action not null default 'show',
  check (target_field_id <> source_field_id)
);

create index on form_rules (form_id);

create table form_publications (
  id             uuid primary key default gen_random_uuid(),
  form_id        uuid not null references forms(id) on delete cascade,
  slug           text not null unique,
  published_at   timestamptz not null default now(),
  published_by   uuid references profiles(id) on delete set null,
  unpublished_at timestamptz
);

create table form_audiences (
  id      uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  scope   audience_scope not null default 'all',
  team_id uuid references teams(id) on delete cascade,
  -- 'all' rows must not name a team; 'team' rows must.
  check ((scope = 'all' and team_id is null) or (scope = 'team' and team_id is not null))
);

create index on form_audiences (form_id);

-- ------------------------------------------------------------- submissions --

create table submissions (
  id             uuid primary key default gen_random_uuid(),
  form_id        uuid not null references forms(id) on delete cascade,
  team_id        uuid references teams(id) on delete set null,
  profile_id     uuid references profiles(id) on delete set null,
  status         submission_status not null default 'draft',
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  -- Admin-only column; participants never select it (see rls.sql).
  internal_notes text not null default ''
);

create index on submissions (form_id, status);
create index on submissions (team_id);

create table submission_answers (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  field_id      uuid not null references form_fields(id) on delete cascade,
  -- jsonb, because an answer may be a string, number, boolean or string[].
  value         jsonb,
  unique (submission_id, field_id)
);

create index on submission_answers (submission_id);
create index on submission_answers (field_id);

create table files (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  field_id      uuid references form_fields(id) on delete set null,
  filename      text not null,
  mime_type     text not null default 'application/octet-stream',
  size_bytes    bigint not null default 0,
  -- Storage object path, resolved to a signed URL at read time.
  url           text not null,
  uploaded_at   timestamptz not null default now()
);

-- -------------------------------------------------------------- appearance --

create table theme_settings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade unique,
  preset     text not null default 'cinema_white',
  tokens     jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

create table audit_logs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  actor_id   uuid references profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on audit_logs (org_id, created_at desc);

-- --------------------------------------------------------------- triggers ---

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_touch before update on teams
  for each row execute function touch_updated_at();
create trigger forms_touch before update on forms
  for each row execute function touch_updated_at();

-- Creates the profile row and redeems an invitation code passed in the
-- sign-up metadata, so SupabaseAdapter.signUp needs no second round trip.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invite invitations%rowtype;
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    jsonb_build_object(
      'ar', coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      'en', coalesce(new.raw_user_meta_data ->> 'full_name', '')
    )
  );

  select * into invite
  from invitations
  where code = (new.raw_user_meta_data ->> 'invite_code')
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if found then
    insert into org_memberships (org_id, profile_id, role, team_id)
    values (invite.org_id, new.id, invite.role, invite.team_id);

    update invitations
    set status = 'accepted', accepted_at = now()
    where id = invite.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Allocates a unique slug and flips the form to published atomically. The
-- client cannot do this safely because slug collision is a race.
create or replace function publish_form(target uuid) returns form_publications
language plpgsql security definer set search_path = public as $$
declare
  base   text;
  slug   text;
  n      int := 1;
  result form_publications%rowtype;
begin
  select lower(regexp_replace(coalesce(title ->> 'en', title ->> 'ar'), '[^a-zA-Z0-9]+', '-', 'g'))
  into base from forms where id = target;

  slug := trim(both '-' from base);
  while exists (select 1 from form_publications where form_publications.slug = slug) loop
    n := n + 1;
    slug := trim(both '-' from base) || '-' || n;
  end loop;

  update forms set status = 'published' where id = target;

  insert into form_publications (form_id, slug, published_by)
  values (target, slug, auth.uid())
  on conflict (form_id) do update
    set unpublished_at = null, published_at = now()
  returning * into result;

  return result;
end;
$$;
