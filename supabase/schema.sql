-- ============================================================================
-- Founder Validation Intelligence Platform — Supabase schema
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- It is safe to re-run: every statement is idempotent.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.workshop_responses (
  id                    uuid primary key default gen_random_uuid(),

  workshop_id           text not null,
  startup_id            text not null,

  -- Which device/tab produced the latest write. Never shown in the mentor UI.
  session_id            text not null,
  -- Which founder or team member searched. Never shown in the mentor UI.
  participant_name      text,

  challenge             text        default '',
  challenge_tags        jsonb       default '[]'::jsonb,
  reflection_answers    jsonb       default '{}'::jsonb,
  assumption_status     jsonb       default '{}'::jsonb,
  commitment            text        default '',

  validation_score      integer     default 0,
  completion_percentage integer     default 0,
  submitted             boolean     default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- One row per startup per workshop. This is what makes duplicate submissions
-- impossible: the client upserts on this constraint, so a founder pressing
-- Submit twice — or two team members submitting from different phones —
-- updates the same row instead of creating a second one.
create unique index if not exists workshop_responses_workshop_startup_key
  on public.workshop_responses (workshop_id, startup_id);

-- The mentor dashboard always reads one workshop at a time.
create index if not exists workshop_responses_workshop_idx
  on public.workshop_responses (workshop_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  -- created_at must survive an upsert that rewrites the row.
  new.created_at = coalesce(old.created_at, new.created_at, now());
  return new;
end;
$$;

drop trigger if exists workshop_responses_touch_updated_at on public.workshop_responses;
create trigger workshop_responses_touch_updated_at
  before update on public.workshop_responses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The workshop runs without authentication: founders scan a QR code and start
-- answering. So the anon role must be able to read and write this table.
--
-- Understand the trade-off before using this in another context: anyone who
-- has the anon key (it ships in the client, so that is anyone who opens the
-- page) can read and write workshop_responses. That is acceptable for a
-- time-boxed workshop with non-sensitive content, and is not acceptable for
-- anything else. Delete the data after the session.
-- ---------------------------------------------------------------------------

alter table public.workshop_responses enable row level security;

drop policy if exists "anon can read responses"   on public.workshop_responses;
drop policy if exists "anon can insert responses" on public.workshop_responses;
drop policy if exists "anon can update responses" on public.workshop_responses;

create policy "anon can read responses"
  on public.workshop_responses for select
  to anon, authenticated
  using (true);

create policy "anon can insert responses"
  on public.workshop_responses for insert
  to anon, authenticated
  with check (true);

create policy "anon can update responses"
  on public.workshop_responses for update
  to anon, authenticated
  using (true)
  with check (true);

-- Deliberately no DELETE policy: a founder cannot wipe another team's answers
-- mid-workshop. Clean up from the SQL editor afterwards.

-- ---------------------------------------------------------------------------
-- Realtime
--
-- This is what makes the mentor dashboard update without a refresh.
-- Also enable Realtime for this table in Dashboard → Database → Replication.
-- ---------------------------------------------------------------------------

-- `alter publication ... add table` raises 42710 if the table is already a
-- member, which would abort a re-run of this file partway through. Guarded so
-- the script stays idempotent end to end.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workshop_responses'
  ) then
    alter publication supabase_realtime add table public.workshop_responses;
  end if;
end
$$;

-- REPLICA IDENTITY FULL makes the old row available on UPDATE events, so the
-- dashboard can reconcile edits rather than only insertions.
alter table public.workshop_responses replica identity full;

-- ---------------------------------------------------------------------------
-- Useful afterwards
-- ---------------------------------------------------------------------------

-- Inspect a workshop:
--   select startup_id, completion_percentage, submitted, updated_at
--   from public.workshop_responses
--   where workshop_id = 'film-accelerator-2026' order by updated_at desc;

-- Reset a workshop before a new cohort:
--   delete from public.workshop_responses where workshop_id = 'film-accelerator-2026';

-- ---------------------------------------------------------------------------
-- Verification
--
-- Run these after installing. Every row should report `ok`.
-- ---------------------------------------------------------------------------

-- 1. Table, columns and defaults
select case when count(*) = 15 then 'ok' else 'MISSING COLUMNS' end as columns_check
from information_schema.columns
where table_schema = 'public' and table_name = 'workshop_responses';

-- 2. The unique constraint that makes upsert-on-conflict work
select case when count(*) = 1 then 'ok' else 'MISSING UNIQUE INDEX' end as unique_check
from pg_indexes
where schemaname = 'public' and indexname = 'workshop_responses_workshop_startup_key';

-- 3. Row Level Security enabled
select case when relrowsecurity then 'ok' else 'RLS DISABLED' end as rls_check
from pg_class where oid = 'public.workshop_responses'::regclass;

-- 4. The three anon policies
select case when count(*) = 3 then 'ok' else 'MISSING POLICIES' end as policy_check
from pg_policies
where schemaname = 'public' and tablename = 'workshop_responses';

-- 5. Realtime publication membership
select case when count(*) = 1 then 'ok' else 'REALTIME NOT ENABLED' end as realtime_check
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
  and tablename = 'workshop_responses';

-- 6. REPLICA IDENTITY FULL, so UPDATE events carry the old row
select case when relreplident = 'f' then 'ok' else 'REPLICA IDENTITY NOT FULL' end as replica_check
from pg_class where oid = 'public.workshop_responses'::regclass;
