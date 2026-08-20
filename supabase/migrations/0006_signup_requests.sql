-- Self-service registration is gated behind admin approval rather than
-- creating an auth user immediately. This table is the queue: one row per
-- request, decided exactly once, and never read or written by the anon key
-- — every touch goes through a service-role API route, so RLS here is
-- simply "nobody gets in through PostgREST", not a set of per-role policies.
create table signup_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  email           text not null,
  full_name       text not null,
  requested_role  text not null check (requested_role in ('admin', 'participant')),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Long random tokens, not the row id, gate the one-click email links —
  -- so a leaked/forwarded request id alone can never approve or reject one.
  approve_token   uuid not null default gen_random_uuid(),
  reject_token    uuid not null default gen_random_uuid(),
  -- Only ever set for an approved participant request: the team created for
  -- them at approval time.
  team_id         uuid references teams(id),
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);

-- One live request per email at a time — resubmitting while already pending
-- should not queue a second notification to every admin.
create unique index signup_requests_pending_email_idx
  on signup_requests (org_id, lower(email))
  where status = 'pending';

create index on signup_requests (org_id, status);

alter table signup_requests enable row level security;
-- No policies: every access goes through /api routes on the service-role
-- client, which bypasses RLS entirely. This table simply has none defined
-- for the anon or authenticated roles, so PostgREST returns nothing to them.
