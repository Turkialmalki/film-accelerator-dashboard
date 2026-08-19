'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Field } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { isDemoMode } from '@/lib/data';
import { getBrowserSupabase } from '@/lib/supabase/browser-client';
import { homeFor } from '@/lib/routes';

/**
 * The forced password-change screen.
 *
 * Reaching it is not optional: `middleware.ts` sends every request from a user
 * whose JWT carries `must_change_password` here before the requested page is
 * ever rendered, so this is a server-enforced gate rather than hidden
 * navigation.
 *
 * The change itself is performed by `POST /api/auth/change-password` with the
 * service-role key, because clearing the gate means writing `app_metadata`,
 * which the browser must not be able to do. After it succeeds the session is
 * refreshed so the *new* access token — the one without the flag — is the one
 * middleware reads on the next navigation.
 */

const schema = z
  .object({
    currentPassword: z.string().optional(),
    password: z.string().min(8),
    confirm: z.string().min(1),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'mismatch' });

type Values = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const { t, href } = useI18n();
  const { session, refresh } = useSession();
  const router = useRouter();
  const demo = isDemoMode();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', password: '', confirm: '' },
  });

  if (demo) {
    return (
      <AuthShell title={t.auth.changeTitle} subtitle={t.auth.changeDemoNote}>
        <Button asChild size="lg">
          <a href={href(homeFor(session?.role))}>{t.auth.goHome}</a>
        </Button>
      </AuthShell>
    );
  }

  async function submit(values: Values) {
    setServerError(null);
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        password: values.password,
        currentPassword: values.currentPassword || undefined,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setServerError(
        payload.error === 'BAD_CURRENT_PASSWORD' || payload.error === 'CURRENT_PASSWORD_REQUIRED'
          ? t.auth.errorCurrentPassword
          : payload.error === 'WEAK_PASSWORD'
            ? t.auth.passwordHint
            : t.auth.errorGeneric,
      );
      return;
    }

    // The access token in the cookie still carries must_change_password until
    // it is reissued; without this refresh the middleware would bounce the
    // user straight back to this screen.
    await getBrowserSupabase().auth.refreshSession();
    await refresh();
    router.replace(href(homeFor(session?.role)));
    router.refresh();
  }

  return (
    <AuthShell title={t.auth.changeTitle} subtitle={t.auth.changeSubtitle}>
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
        <Field label={t.auth.currentPassword} htmlFor="currentPassword">
          <PasswordInput id="currentPassword" autoComplete="current-password" {...register('currentPassword')} />
        </Field>

        <Field
          label={t.auth.newPassword}
          htmlFor="password"
          error={errors.password ? t.auth.passwordHint : undefined}
        >
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
        </Field>

        <Field
          label={t.auth.confirmPassword}
          htmlFor="confirm"
          error={errors.confirm ? t.auth.passwordMismatch : undefined}
        >
          <PasswordInput id="confirm" autoComplete="new-password" {...register('confirm')} />
        </Field>

        {serverError ? (
          <p
            role="alert"
            className="rounded-md border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger"
          >
            {serverError}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t.auth.changeSubmit}
        </Button>
      </form>
    </AuthShell>
  );
}
