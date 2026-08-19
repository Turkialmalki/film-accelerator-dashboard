-- =============================================================================
-- 0005 — break a real RLS infinite-recursion cycle between forms and
-- form_audiences
--
-- form_read's USING clause correlated directly against form_audiences to
-- decide audience visibility. form_audiences' own audience_read policy
-- correlates back into forms to find its row. Both sides being plain
-- (non-SECURITY DEFINER) subqueries sends Postgres into
-- "infinite recursion detected in policy for relation forms" (42P17) on
-- every single read of `forms` — confirmed live in production: every
-- request for the real 20-team org's forms failed with this error, which
-- surfaced in the UI as a caught-but-still-broken data load (see the
-- companion app-side fix to useRepoQuery around the same time).
--
-- Fix: route the form_audiences check through a SECURITY DEFINER function,
-- exactly like current_org_id()/is_admin()/current_team_id() already do.
-- A SECURITY DEFINER function's internal queries bypass RLS, so this one
-- never re-enters form_audiences' policy, which never re-enters forms'.
-- =============================================================================

create or replace function form_audience_permits_caller(target_form_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    not exists (select 1 from form_audiences a where a.form_id = target_form_id)
    or exists (
      select 1 from form_audiences a
      where a.form_id = target_form_id
        and (a.scope = 'all' or a.team_id = current_team_id())
    );
$$;

drop policy if exists form_read on forms;
create policy form_read on forms
  for select using (
    org_id = current_org_id()
    and (
      is_admin()
      or (status = 'published' and form_audience_permits_caller(forms.id))
    )
  );
