'use client';

/**
 * Client-side wrapper around `POST /api/admin/invite`.
 *
 * The UI calls this and never talks to Supabase Admin itself — it cannot; the
 * service-role key lives only on the server. What this module does own is the
 * mode difference in the *result*:
 *
 *   - Supabase mode: the route created the account and mailed the temporary
 *     password. The invitation row is already in the database.
 *   - Demo mode: the route created nothing, so the local invitation record is
 *     written here through the existing `Repository.createInvitation` — the
 *     exact call the drawer made before this flow existed, so demo behaviour
 *     is unchanged.
 */

import { getRepository } from '@/lib/data';
import type { Role } from '@/lib/data/types';

export interface InviteRequest {
  email: string;
  role: Role;
  teamId: string | null;
  fullName?: string;
  locale?: 'ar' | 'en';
}

export type InviteOutcome =
  | { status: 'demo' }
  | { status: 'sent' }
  /** Account created, but the mail never left — hand the password over by hand. */
  | { status: 'created_not_emailed'; tempPassword: string; reason: string }
  | { status: 'forbidden' }
  | { status: 'failed'; message: string };

export async function inviteUser(request: InviteRequest): Promise<InviteOutcome> {
  let response: Response;
  try {
    response = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: request.email.trim(),
        role: request.role,
        teamId: request.teamId,
        fullName: request.fullName,
        locale: request.locale,
      }),
    });
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : 'network' };
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (response.status === 401 || response.status === 403) return { status: 'forbidden' };
  if (!response.ok) {
    return { status: 'failed', message: String(payload.error ?? response.status) };
  }

  if (payload.mode === 'demo') {
    await getRepository().createInvitation({
      email: request.email.trim(),
      role: request.role,
      team_id: request.teamId,
    });
    return { status: 'demo' };
  }

  if (payload.emailed === true) return { status: 'sent' };

  return {
    status: 'created_not_emailed',
    tempPassword: String(payload.tempPassword ?? ''),
    reason: String(payload.emailStatus ?? 'send_failed'),
  };
}
