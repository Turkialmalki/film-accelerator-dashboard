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

export interface SignupRequestAdminEmailInput {
  /** One email per admin/owner — sent as separate messages, not one email
   * with everyone on the To line, so nobody sees the whole admin roster. */
  to: string;
  requesterName: string;
  requesterEmail: string;
  requestedRole: 'admin' | 'participant';
  approveUrl: string;
  rejectUrl: string;
  orgName?: string;
}

/**
 * Notifies one admin/owner that someone asked to join, with the whole
 * decision made in one click from the inbox — no sign-in required. The
 * links carry a single-use token each; the route on the other end is what
 * actually enforces that, this email is just the delivery.
 */
export async function sendSignupRequestAdminEmail(input: SignupRequestAdminEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'not_configured' };

  const org = input.orgName || 'Film Business Accelerator';
  const roleLabelAr = input.requestedRole === 'admin' ? 'مشرف' : 'شركة ناشئة / رائد أعمال';
  const roleLabelEn = input.requestedRole === 'admin' ? 'Admin' : 'Startup / Entrepreneur';

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#141414">
  <div dir="rtl" style="text-align:right;line-height:1.8">
    <h2 style="margin:0 0 12px">طلب انضمام جديد</h2>
    <p style="margin:0 0 4px"><strong>${escapeHtml(input.requesterName)}</strong> (${escapeHtml(input.requesterEmail)})</p>
    <p style="margin:0 0 16px;color:#666">طلب الانضمام إلى <strong>${escapeHtml(org)}</strong> بصفة: ${roleLabelAr}</p>
    <table role="presentation" style="margin:0 0 16px"><tr>
      <td style="padding-inline-end:10px"><a href="${escapeHtml(input.approveUrl)}" style="display:inline-block;padding:10px 20px;background:#2F7D62;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">قبول</a></td>
      <td><a href="${escapeHtml(input.rejectUrl)}" style="display:inline-block;padding:10px 20px;background:#B03A31;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">رفض</a></td>
    </tr></table>
    <p style="margin:0;font-size:13px;color:#666">عند القبول سيُرسَل له بريد بكلمة مرور مؤقتة تلقائياً.</p>
  </div>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <div dir="ltr" style="text-align:left;line-height:1.7">
    <h3 style="margin:0 0 12px">New registration request</h3>
    <p style="margin:0 0 4px"><strong>${escapeHtml(input.requesterName)}</strong> (${escapeHtml(input.requesterEmail)})</p>
    <p style="margin:0 0 16px;color:#666">Asked to join <strong>${escapeHtml(org)}</strong> as: ${roleLabelEn}</p>
    <table role="presentation" style="margin:0 0 16px"><tr>
      <td style="padding-right:10px"><a href="${escapeHtml(input.approveUrl)}" style="display:inline-block;padding:10px 20px;background:#2F7D62;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Approve</a></td>
      <td><a href="${escapeHtml(input.rejectUrl)}" style="display:inline-block;padding:10px 20px;background:#B03A31;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reject</a></td>
    </tr></table>
    <p style="margin:0;font-size:13px;color:#666">Approving emails them a temporary password automatically.</p>
  </div>
</div>`.trim();

  const text = [
    `طلب انضمام جديد: ${input.requesterName} (${input.requesterEmail}) — ${roleLabelAr}`,
    `قبول: ${input.approveUrl}`,
    `رفض: ${input.rejectUrl}`,
    '',
    `New registration request: ${input.requesterName} (${input.requesterEmail}) — ${roleLabelEn}`,
    `Approve: ${input.approveUrl}`,
    `Reject: ${input.rejectUrl}`,
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: resolveFrom(),
      to: input.to,
      subject: `طلب انضمام جديد من ${input.requesterName} / New registration request`,
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

export interface SignupRejectedEmailInput {
  to: string;
  fullName?: string;
  orgName?: string;
}

/** Polite, honest rejection notice — no reason is invented; there simply
 * wasn't one supplied at decision time. */
export async function sendSignupRejectedEmail(input: SignupRejectedEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'not_configured' };

  const org = input.orgName || 'Film Business Accelerator';
  const name = input.fullName || input.to.split('@')[0];

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#141414">
  <div dir="rtl" style="text-align:right;line-height:1.8">
    <h2 style="margin:0 0 12px">مرحباً ${escapeHtml(name)}</h2>
    <p style="margin:0">لم تتم الموافقة على طلب انضمامك إلى <strong>${escapeHtml(org)}</strong> في الوقت الحالي. لأي استفسار، يمكنك مراسلتنا مباشرة.</p>
  </div>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <div dir="ltr" style="text-align:left;line-height:1.7">
    <h3 style="margin:0 0 12px">Hello ${escapeHtml(name)}</h3>
    <p style="margin:0">Your request to join <strong>${escapeHtml(org)}</strong> was not approved at this time. For any questions, feel free to reach out directly.</p>
  </div>
</div>`.trim();

  const text = [
    `مرحباً ${name} — لم تتم الموافقة على طلب انضمامك إلى ${org} في الوقت الحالي.`,
    '',
    `Hello ${name} — your request to join ${org} was not approved at this time.`,
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: resolveFrom(),
      to: input.to,
      subject: `تحديث بخصوص طلبك / Update on your request — ${org}`,
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

export interface FormSubmittedEmailInput {
  to: string;
  teamName: string;
  formTitle: string;
  resultsUrl: string;
  orgName?: string;
}

/** Tells one admin a team just submitted a form — sent once per admin, same
 * pattern as the signup-request notification. */
export async function sendFormSubmittedEmail(input: FormSubmittedEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'not_configured' };

  const org = input.orgName || 'Film Business Accelerator';

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#141414">
  <div dir="rtl" style="text-align:right;line-height:1.8">
    <h2 style="margin:0 0 12px">إرسال استمارة جديد</h2>
    <p style="margin:0 0 4px">أرسل فريق <strong>${escapeHtml(input.teamName)}</strong> استمارة:</p>
    <p style="margin:0 0 16px;color:#666">${escapeHtml(input.formTitle)}</p>
    <p style="margin:0 0 16px"><a href="${escapeHtml(input.resultsUrl)}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;border-radius:8px;text-decoration:none">عرض النتائج</a></p>
  </div>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <div dir="ltr" style="text-align:left;line-height:1.7">
    <h3 style="margin:0 0 12px">New form submission</h3>
    <p style="margin:0 0 4px"><strong>${escapeHtml(input.teamName)}</strong> submitted:</p>
    <p style="margin:0 0 16px;color:#666">${escapeHtml(input.formTitle)}</p>
    <p style="margin:0"><a href="${escapeHtml(input.resultsUrl)}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;border-radius:8px;text-decoration:none">View results</a></p>
  </div>
</div>`.trim();

  const text = [
    `إرسال استمارة جديد: ${input.teamName} — ${input.formTitle}`,
    `عرض النتائج: ${input.resultsUrl}`,
    '',
    `New form submission: ${input.teamName} — ${input.formTitle}`,
    `View results: ${input.resultsUrl}`,
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: resolveFrom(),
      to: input.to,
      subject: `${input.teamName} أرسل استمارة / ${input.teamName} submitted a form — ${org}`,
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
