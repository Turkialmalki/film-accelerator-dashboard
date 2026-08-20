'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, Loader2, MailCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { getRepository, isDemoMode } from '@/lib/data';
import { homeFor } from '@/lib/routes';

const schema = z
  .object({
    fullName: z.string().min(2),
    email: z.string().min(1).email(),
    requestedRole: z.enum(['admin', 'participant']),
    // Only meaningful (and only required) once an invite code is supplied —
    // see the refine() below. A real invite is still the old, instant,
    // admin-authorised path; without one, no password is collected here at
    // all, because the account is not created until an admin approves it.
    password: z.string(),
    confirmPassword: z.string(),
    inviteCode: z.string(),
  })
  .refine((v) => !(v.inviteCode || isDemoMode()) || v.password.length >= 8, {
    path: ['password'],
    message: 'required',
  })
  .refine((v) => !(v.inviteCode || isDemoMode()) || v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  });

type Values = z.infer<typeof schema>;

/** mm:ss, counting up from submission — a live sign the request is not
 * stuck, not a real ETA (there isn't one; a human has to act). */
function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function SignUpForm() {
  const { t, href } = useI18n();
  const { refresh } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const elapsed = useElapsed(pending);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      requestedRole: 'participant',
      password: '',
      confirmPassword: '',
      inviteCode: params.get('code') ?? '',
    },
  });

  // Demo mode has no approval workflow at all — signUp() there is always
  // the instant, local path, so it always needs its own password too.
  const hasInviteCode = Boolean(watch('inviteCode')) || isDemoMode();

  async function onSubmit(values: Values) {
    setServerError(null);

    // A real invite code is an admin-authorised, already-approved path —
    // keep the original instant account creation for it, unchanged.
    if (values.inviteCode || isDemoMode()) {
      try {
        const session = await getRepository().signUp({
          email: values.email,
          password: values.password || 'demo-password-0000',
          fullName: values.fullName,
          inviteCode: values.inviteCode || undefined,
        });
        await refresh();
        router.replace(href(homeFor(session.role)));
        router.refresh();
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        setServerError(code === 'EMAIL_TAKEN' ? t.auth.errorEmailTaken : t.auth.errorGeneric);
      }
      return;
    }

    // No invite code: queue a request instead of creating an account.
    try {
      const response = await fetch('/api/auth/signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          fullName: values.fullName,
          requestedRole: values.requestedRole,
          locale: typeof document !== 'undefined' ? document.documentElement.lang : undefined,
        }),
      });
      if (!response.ok) throw new Error('REQUEST_FAILED');
      setPending(true);
    } catch {
      setServerError(t.auth.errorGeneric);
    }
  }

  if (pending) {
    return (
      <AuthShell
        title={t.auth.pendingTitle}
        subtitle={t.auth.pendingBody}
        footer={
          <Link href={href('/sign-in')} className="font-medium text-accent hover:underline">
            {t.auth.backToSignIn}
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 rounded-lg border border-success/25 bg-success/8 px-6 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-ink">{t.auth.pendingBody}</p>
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-muted">
            <Clock className="size-4 animate-pulse text-accent" aria-hidden />
            <span>{t.auth.pendingWaiting}</span>
            <span className="tnum font-semibold text-ink" dir="ltr">
              {elapsed}
            </span>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t.auth.signUpTitle}
      footer={
        <span>
          {t.auth.hasAccount}{' '}
          <Link href={href('/sign-in')} className="font-medium text-accent hover:underline">
            {t.auth.signIn}
          </Link>
        </span>
      }
    >
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Field
          label={t.auth.fullName}
          htmlFor="fullName"
          error={errors.fullName ? t.auth.nameRequired : undefined}
        >
          <Input id="fullName" autoComplete="name" {...register('fullName')} />
        </Field>

        <Field label={t.auth.email} htmlFor="email" error={errors.email ? t.auth.invalidEmail : undefined}>
          <Input id="email" type="email" dir="ltr" autoComplete="email" {...register('email')} />
        </Field>

        <Field
          label={t.auth.registeringAs}
          htmlFor="requestedRole"
          error={errors.requestedRole ? t.auth.roleRequired : undefined}
        >
          <NativeSelect id="requestedRole" required {...register('requestedRole')}>
            <option value="participant">{t.auth.roleStartup}</option>
            <option value="admin">{t.auth.roleAdmin}</option>
          </NativeSelect>
        </Field>

        <Field label={`${t.auth.inviteCode} · ${t.common.optional}`} htmlFor="inviteCode">
          <Input id="inviteCode" dir="ltr" placeholder="ABCD-1234" {...register('inviteCode')} />
        </Field>

        {/* A password is only meaningful once a real invite code says this
            account should exist right now — otherwise nothing is created
            until an admin approves the request below, and the temporary
            password in that approval email is what signs them in the first
            time. */}
        {hasInviteCode ? (
          <>
            <Field
              label={t.auth.password}
              htmlFor="password"
              hint={t.auth.passwordHint}
              error={errors.password ? t.auth.passwordHint : undefined}
            >
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            </Field>

            <Field
              label={t.auth.confirmPassword}
              htmlFor="confirmPassword"
              error={errors.confirmPassword ? t.auth.passwordMismatch : undefined}
            >
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            </Field>
          </>
        ) : null}

        {serverError ? (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {hasInviteCode ? t.auth.signUp : t.auth.signUpRequestCta}
        </Button>
      </form>
    </AuthShell>
  );
}

/**
 * useSearchParams() opts the page out of static prerendering, so the form has
 * to sit behind a Suspense boundary for the production build to emit a shell.
 */
export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
