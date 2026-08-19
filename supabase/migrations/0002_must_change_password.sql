-- =============================================================================
-- 0002 — profiles.must_change_password
--
-- Adds the forced-password-change flag used by the admin invite flow
-- (app/api/admin/invite/route.ts) and cleared by the change-password route
-- (app/api/auth/change-password/route.ts).
--
-- Apply this ONLY to a project where supabase/schema.sql was applied before
-- this feature existed. A project created from the current schema.sql already
-- has the column; `add column if not exists` makes running it anyway a no-op,
-- so this file is safe to re-run.
--
-- There is no 0001 file. schema.sql remains the single source of truth for a
-- fresh project; this directory holds only the deltas needed by projects that
-- were stood up earlier.
--
-- STATUS: never executed. No Supabase project was available. See HANDOFF.md §9.
-- =============================================================================

alter table profiles
  add column if not exists must_change_password boolean not null default false;

comment on column profiles.must_change_password is
  'True while the account still holds an admin-generated temporary password. '
  'The enforced copy lives in auth.users.raw_app_meta_data->>''must_change_password'', '
  'which middleware.ts reads from the verified JWT; this column is the durable, '
  'queryable record. Both are written together by the invite and change-password routes.';

-- --------------------------------------------------------------------------
-- Backfill. Any existing profile predates the invite flow and therefore holds
-- a password its owner chose, so the default of false is already correct and
-- no UPDATE is needed. Stated explicitly so the omission is not read as an
-- oversight.
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- Column privileges.
--
-- Reads need nothing new: `profile_self_read` (`id = auth.uid()`) is
-- column-agnostic, and the service-role key bypasses RLS entirely for the
-- writes performed by the invite and change-password routes.
--
-- Writes do. `profile_self_write` lets a user update their own row, which
-- would let them clear their own gate. Column-level grants close that; the
-- table-level privilege has to go first for the column list to be consulted.
-- This block is identical to the one now in supabase/rls.sql, repeated here so
-- an already-provisioned project can be brought forward with this file alone.
-- --------------------------------------------------------------------------

revoke update on profiles from authenticated;
grant update (email, full_name, avatar_url, locale) on profiles to authenticated;
