#!/usr/bin/env node
/**
 * bootstrap-admin — create (or promote) the very first organisation owner.
 *
 *   node scripts/bootstrap-admin.mjs someone@example.com
 *   node scripts/bootstrap-admin.mjs someone@example.com --role admin --name "Full Name"
 *
 * WHY THIS EXISTS. The web invite flow (`POST /api/admin/invite`) requires an
 * authenticated owner or admin to already exist. On a brand new Supabase
 * project nobody does, so there is a chicken-and-egg problem. This closes it
 * from the operator's own machine, where the service-role key already lives in
 * .env.local — rather than by shipping a self-service "make me an admin" web
 * route, which would be a permanent hole left open to solve a one-time problem.
 *
 * It is a MANUAL CLI TOOL. It is not wired into any build, deploy, npm script
 * or CI job, and it must not be. Nothing imports it.
 *
 * IDEMPOTENT and safe to re-run. Re-running against an existing email resets
 * that user's temporary password and re-asserts the membership role; it never
 * creates a duplicate user or membership.
 *
 * Prints the temporary password to stdout exactly once. The account is flagged
 * `must_change_password`, so it has to be replaced at first sign-in.
 *
 * STATUS: never executed against a live project — no Supabase credentials were
 * available when it was written. See HANDOFF.md §9.
 */

import { readFileSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// @supabase/supabase-js constructs a RealtimeClient in createClient() even
// though this script never subscribes to anything, and that constructor
// throws immediately if `globalThis.WebSocket` is missing. Native WebSocket
// only landed in Node 21 (stable in 22); on Node <21 — the LTS this was first
// run under — createClient() crashes before a single query runs. Polyfilling
// with `ws` costs nothing on newer Node, where this branch is simply skipped.
if (typeof globalThis.WebSocket === 'undefined') {
  const { WebSocket } = await import('ws');
  globalThis.WebSocket = WebSocket;
}

const { createClient } = await import('@supabase/supabase-js');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* --------------------------------------------------------------- env ----- */

/**
 * A deliberately small .env reader. `dotenv` is not a dependency of this
 * project and adding one for a script that runs a handful of times in its life
 * is not worth it. Handles `KEY=value`, `export KEY=value`, comments, blank
 * lines and surrounding quotes; does not handle multi-line values.
 */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue; // real env wins
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, '.env.local'));
loadEnvFile(resolve(ROOT, '.env'));

/* ------------------------------------------------------------- args ------ */

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const email = String(positional[0] ?? '').trim().toLowerCase();
const role = String(flags.role ?? 'owner');
const fullName = String(flags.name ?? '');

function die(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

if (!email || !email.includes('@')) {
  die('Usage: node scripts/bootstrap-admin.mjs <email> [--role owner|admin] [--name "Full Name"]');
}
if (!['owner', 'admin'].includes(role)) {
  die(`--role must be "owner" or "admin"; got "${role}".`);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) die('NEXT_PUBLIC_SUPABASE_URL is not set (looked in the environment and .env.local).');
if (!SERVICE_ROLE_KEY) die('SUPABASE_SERVICE_ROLE_KEY is not set (looked in the environment and .env.local).');

/* -------------------------------------------------------- password ------- */

/**
 * Mirrors lib/auth/temp-password.ts. It is duplicated rather than imported
 * because that module is TypeScript and `server-only`, and this script runs as
 * plain node with no build step. Eight lines of duplication beats adding a
 * bundler to a one-shot operator tool.
 */
function generateTempPassword(length = 16) {
  const LOWER = 'abcdefghijkmnopqrstuvwxyz';
  const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const DIGIT = '23456789';
  const SYMBOL = '!@#$%*?';
  const ALL = LOWER + UPPER + DIGIT + SYMBOL;
  const pick = (set) => set[randomInt(0, set.length)];
  const chars = [
    pick(LOWER),
    pick(UPPER),
    pick(DIGIT),
    pick(SYMBOL),
    ...Array.from({ length: Math.max(0, length - 4) }, () => pick(ALL)),
  ];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/* ----------------------------------------------------------- helpers ----- */

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target) {
  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function resolveOrgId() {
  const configured = process.env.NEXT_PUBLIC_ORG_ID;
  if (configured) {
    const { data, error } = await admin
      .from('organizations')
      .select('id, name')
      .eq('id', configured)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      die(
        `NEXT_PUBLIC_ORG_ID is "${configured}" but no organizations row has that id. ` +
          'Seed the organisation first (see HANDOFF.md §4).',
      );
    }
    return data.id;
  }

  const { data, error } = await admin
    .from('organizations')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(2);
  if (error) throw error;
  if (!data || data.length === 0) {
    die('No rows in `organizations`. Seed one organisation and one cohort first (HANDOFF.md §4).');
  }
  if (data.length > 1) {
    die('More than one organisation exists. Set NEXT_PUBLIC_ORG_ID so this script is unambiguous.');
  }
  return data[0].id;
}

/* -------------------------------------------------------------- main ----- */

async function main() {
  const orgId = await resolveOrgId();
  const tempPassword = generateTempPassword();

  const appMetadata = {
    role,
    org_id: orgId,
    team_id: null,
    must_change_password: true,
  };

  const existing = await findUserByEmail(email);
  let userId;
  let action;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: tempPassword,
      email_confirm: true,
      app_metadata: appMetadata,
      ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
    });
    if (error) throw error;
    userId = data.user.id;
    action = 'promoted (existing user; temporary password reset)';
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    userId = data.user.id;
    action = 'created';
  }

  // profiles — upsert, because the handle_new_user trigger may have inserted
  // the row already during createUser.
  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name: { ar: fullName, en: fullName },
      must_change_password: true,
    },
    { onConflict: 'id' },
  );
  if (profileError) throw profileError;

  // org_memberships — `unique (org_id, profile_id)` makes the upsert idempotent.
  const { error: membershipError } = await admin.from('org_memberships').upsert(
    { org_id: orgId, profile_id: userId, role, team_id: null },
    { onConflict: 'org_id,profile_id' },
  );
  if (membershipError) throw membershipError;

  console.log('');
  console.log('  ✓ Bootstrap complete');
  console.log('  ────────────────────────────────────────────────');
  console.log(`  email              ${email}`);
  console.log(`  role               ${role}`);
  console.log(`  organization       ${orgId}`);
  console.log(`  auth user          ${userId} — ${action}`);
  console.log('');
  console.log(`  TEMPORARY PASSWORD ${tempPassword}`);
  console.log('');
  console.log('  Shown once. Sign in with it; the app will force a password change');
  console.log('  before any other route becomes reachable.');
  console.log('');
}

main().catch((error) => {
  console.error('\n  ✗ Bootstrap failed:', error?.message ?? error);
  if (error?.hint) console.error('    hint:', error.hint);
  process.exit(1);
});
