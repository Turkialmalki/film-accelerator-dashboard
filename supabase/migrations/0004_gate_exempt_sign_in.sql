-- =============================================================================
-- 0004 — one-time grace pass on the forced password-change gate
--
-- Product decision: an admin-invited user's FIRST sign-in with their temp
-- password lands in the app normally; the forced change screen only appears
-- starting their *second* sign-in attempt. (Security note: this means the
-- temp password, which travelled by email, stays valid for one full session
-- before rotation is required — a deliberate tradeoff the product owner chose
-- over the stricter default of gating immediately.)
--
-- `gate_exempt_sign_in_at` records the `last_sign_in_at` timestamp of the one
-- sign-in event middleware has already let through. Supabase's `last_sign_in_at`
-- changes only on a new password-grant sign-in, not on token refresh, so:
--   - NULL                                   -> never exempted; exempt this one
--     and record its last_sign_in_at.
--   - equals the current last_sign_in_at     -> still the same exempted
--     session continuing; keep letting it through.
--   - anything else (an older timestamp)     -> a genuinely later sign-in;
--     enforce the gate now.
--
-- Deliberately NOT self-writable: only the service-role client (used from
-- middleware.ts, never from a client bundle) writes this column. If it were
-- grantable to `authenticated` the way `email`/`full_name` are, a signed-in
-- user could re-stamp it on every request and permanently skip ever changing
-- their temporary password.
-- =============================================================================

alter table profiles
  add column if not exists gate_exempt_sign_in_at timestamptz;

comment on column profiles.gate_exempt_sign_in_at is
  'The last_sign_in_at of the one sign-in event already exempted from the '
  'forced password-change gate. Written only by the service-role client.';
