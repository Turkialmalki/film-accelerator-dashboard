/**
 * One place that answers "is this deployment wired to a real Supabase project?"
 *
 * The detection rule is exactly the one `lib/data/index.ts` already used: both
 * public variables must be present, or the whole application stays in demo
 * mode. Auth, middleware and the invite route all read this, so there is no
 * way for the data layer and the auth layer to disagree about which mode they
 * are in.
 *
 * The `process.env.NEXT_PUBLIC_*` members are written out literally rather
 * than destructured, because Next inlines them at build time only when it can
 * see the full member expression in the source.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** The `organizations.id` this deployment serves. */
export const ORG_ID_ENV = process.env.NEXT_PUBLIC_ORG_ID ?? '';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Roles that may reach the admin half of the product. */
export const ADMIN_ROLE_NAMES = ['owner', 'admin', 'reviewer'] as const;

/** Roles that may invite other people. A reviewer reads; it does not staff. */
export const INVITER_ROLE_NAMES = ['owner', 'admin'] as const;
