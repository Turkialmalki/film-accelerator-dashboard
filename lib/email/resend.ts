/**
 * Transactional email through Resend. Server only.
 *
 * Absence of credentials is a first-class state here, exactly as it is for
 * Supabase: with no `RESEND_API_KEY` the send is skipped and reported as
 * skipped, so the invite route can still succeed and hand the temporary
 * password back to the admin to pass on by another channel. Nothing throws
 * just because a demo deployment has no mail provider.
 */

import 'server-only';

import { Resend } from 'resend';

/** The Resend sandbox sender. Works without a verified domain, and only to the
 *  account owner's own address — fine for a smoke test, not for real invites. */
const FALLBACK_FROM = 'onboarding@resend.dev';

export type EmailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: 'not_configured' | 'send_failed'; error?: string };

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function resolveFrom(): string {
  const configured = process.env.RESEND_FROM_EMAIL;
  if (configured) return configured;
  console.warn(
    '[resend] RESEND_FROM_EMAIL is not set; falling back to the Resend sandbox sender ' +
      `"${FALLBACK_FROM}". It can only deliver to the Resend account owner's own address. ` +
      'Set RESEND_FROM_EMAIL to an address on a verified domain before inviting real users.',
  );
  return FALLBACK_FROM;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export interface InviteEmailInput {
  to: string;
  /** Display name for the greeting; falls back to the email local part. */
  fullName?: string;
  tempPassword: string;
  /** Absolute URL of the sign-in page. */
  signInUrl: string;
  /** Organisation name shown in the subject and body. */
  orgName?: string;
}

/**
 * Send the temporary-password invitation.
 *
 * Bilingual, Arabic first, matching the product's own voice. The password is
 * in the body rather than behind a magic link on purpose: this flow exists so
 * an operator can stand up accounts for a cohort without every participant
 * needing a working inbox link click, and `must_change_password` forces the
 * credential to be replaced on first sign-in anyway.
 */
export async function sendInviteEmail(input: InviteEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'not_configured' };

  const org = input.orgName || 'Film Business Accelerator';
  const name = input.fullName || input.to.split('@')[0];

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#141414">
  <div dir="rtl" style="text-align:right;line-height:1.8">
    <h2 style="margin:0 0 12px">مرحباً ${escapeHtml(name)}</h2>
    <p style="margin:0 0 12px">تم إنشاء حساب لك في منصة <strong>${escapeHtml(org)}</strong>.</p>
    <p style="margin:0 0 8px">كلمة المرور المؤقتة:</p>
    <p style="margin:0 0 16px"><code dir="ltr" style="display:inline-block;padding:10px 14px;background:#f4f4f5;border-radius:8px;font-size:16px;letter-spacing:1px">${escapeHtml(input.tempPassword)}</code></p>
    <p style="margin:0 0 16px"><a href="${escapeHtml(input.signInUrl)}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;border-radius:8px;text-decoration:none">تسجيل الدخول</a></p>
    <p style="margin:0 0 24px;font-size:13px;color:#666">ستُطلب منك إعادة تعيين كلمة المرور عند أول تسجيل دخول. لا تشارك هذه الرسالة مع أحد.</p>
  </div>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <div dir="ltr" style="text-align:left;line-height:1.7">
    <h3 style="margin:0 0 12px">Hello ${escapeHtml(name)}</h3>
    <p style="margin:0 0 12px">An account has been created for you on <strong>${escapeHtml(org)}</strong>.</p>
    <p style="margin:0 0 8px">Your temporary password:</p>
    <p style="margin:0 0 16px"><code style="display:inline-block;padding:10px 14px;background:#f4f4f5;border-radius:8px;font-size:16px;letter-spacing:1px">${escapeHtml(input.tempPassword)}</code></p>
    <p style="margin:0 0 16px"><a href="${escapeHtml(input.signInUrl)}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;border-radius:8px;text-decoration:none">Sign in</a></p>
    <p style="margin:0;font-size:13px;color:#666">You will be asked to choose a new password on first sign-in. Do not forward this message.</p>
  </div>
</div>`.trim();

  const text = [
    `مرحباً ${name} — تم إنشاء حساب لك في ${org}.`,
    `كلمة المرور المؤقتة: ${input.tempPassword}`,
    `تسجيل الدخول: ${input.signInUrl}`,
    '',
    `Hello ${name} — an account has been created for you on ${org}.`,
    `Temporary password: ${input.tempPassword}`,
    `Sign in: ${input.signInUrl}`,
    '',
    'You will be asked to choose a new password on first sign-in.',
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: resolveFrom(),
      to: input.to,
      subject: `دعوة إلى ${org} / Your ${org} account`,
      html,
      text,
    });
    if (error) return { sent: false, reason: 'send_failed', error: error.message };
    return { sent: true, id: data?.id ?? null };
  } catch (error) {
    return {
      sent: false,
      reason: 'send_failed',
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

export interface PasswordResetEmailInput {
  to: string;
  /** Display name for the greeting; falls back to the email local part. */
  fullName?: string;
  /**
   * The real Supabase recovery link (a GoTrue `/auth/v1/verify?...` URL),
   * generated server-side with the service-role key. Clicking it verifies
   * the recovery token and redirects the browser to our own
   * `/reset-password` page with a live session already attached — the
   * password form on that page never sees or needs a separate token.
   */
  actionLink: string;
  /** Organisation name shown in the subject and body. */
  orgName?: string;
}

/**
 * Send the "reset your password" email ourselves, through Resend.
 *
 * This deliberately bypasses Supabase's own built-in mailer
 * (`auth.resetPasswordForEmail`), which sends from Supabase's shared
 * infrastructure using whatever Site URL is configured in the dashboard —
 * on this project that was still the local-dev default, so the link in the
 * email pointed at `localhost` no matter what domain the user was actually
 * signed in on. Generating the link ourselves with the admin client and
 * mailing it through the same Resend account used for invites means the
 * link, sender, and branding are all fully under this app's control.
 */
export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'not_configured' };

  const org = input.orgName || 'Film Business Accelerator';
  const name = input.fullName || input.to.split('@')[0];

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#141414">
  <div dir="rtl" style="text-align:right;line-height:1.8">
    <h2 style="margin:0 0 12px">مرحباً ${escapeHtml(name)}</h2>
    <p style="margin:0 0 12px">وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في <strong>${escapeHtml(org)}</strong>.</p>
    <p style="margin:0 0 16px"><a href="${escapeHtml(input.actionLink)}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;border-radius:8px;text-decoration:none">إعادة تعيين كلمة المرور</a></p>
    <p style="margin:0 0 24px;font-size:13px;color:#666">إذا لم تطلب ذلك، تجاهل هذه الرسالة ولن يتغيّر شيء. تنتهي صلاحية هذا الرابط بعد فترة قصيرة.</p>
  </div>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <div dir="ltr" style="text-align:left;line-height:1.7">
    <h3 style="margin:0 0 12px">Hello ${escapeHtml(name)}</h3>
    <p style="margin:0 0 12px">We received a request to reset the password on your <strong>${escapeHtml(org)}</strong> account.</p>
    <p style="margin:0 0 16px"><a href="${escapeHtml(input.actionLink)}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;border-radius:8px;text-decoration:none">Reset password</a></p>
    <p style="margin:0;font-size:13px;color:#666">If you didn't request this, you can ignore this message — nothing will change. This link expires shortly.</p>
  </div>
</div>`.trim();

  const text = [
    `مرحباً ${name} — وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في ${org}.`,
    `إعادة تعيين كلمة المرور: ${input.actionLink}`,
    'إذا لم تطلب ذلك، تجاهل هذه الرسالة.',
    '',
    `Hello ${name} — we received a request to reset your ${org} account password.`,
    `Reset password: ${input.actionLink}`,
    "If you didn't request this, ignore this message.",
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: resolveFrom(),
      to: input.to,
      subject: `إعادة تعيين كلمة المرور / Reset your ${org} password`,
      html,
      text,
    });
    if (error) return { sent: false, reason: 'send_failed', error: error.message };
    return { sent: true, id: data?.id ?? null };
  } catch (error) {
    return {
      sent: false,
      reason: 'send_failed',
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}
