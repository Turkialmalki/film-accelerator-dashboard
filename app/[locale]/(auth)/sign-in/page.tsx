'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Field } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { DEMO_ADMIN_EMAIL, DEMO_PARTICIPANT_EMAIL, DEMO_PASSWORD } from '@/lib/data/seed';
import { homeFor } from '@/lib/routes';

/**
 * Demo sign-in shortcuts are compiled out of production bundles. `NODE_ENV`
 * is statically replaced at build time, so the branch below is dead code that
 * the minifier drops entirely in `next build` with NODE_ENV=production.
 */
const DEMO_LOGIN_ENABLED = process.env.NODE_ENV !== 'production';

const schema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});

type Values = z.infer<typeof schema>;

function SignInForm() {
  const { t, href } = useI18n();
  const { signIn } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  async function attempt(email: string, password: string) {
    setServerError(null);
    try {
      const session = await signIn(email, password);
      const next = params.get('next');
      router.replace(href(next && next.startsWith('/') ? next : homeFor(session.role)));
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setServerError(
        code === 'NO_ACCOUNT'
          ? t.auth.errorNoAccount
          : code === 'BAD_PASSWORD'
            ? t.auth.errorBadPassword
            : t.auth.errorGeneric,
      );
    }
  }

  return (
    <AuthShell
      title={t.auth.signInTitle}
      footer={
        <span>
          {t.auth.noAccount}{' '}
          <Link href={href('/sign-up')} className="font-medium text-accent hover:underline">
            {t.auth.signUp}
          </Link>
        </span>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => attempt(values.email, values.password))}
      >
        <Field
          label={t.auth.email}
          htmlFor="email"
          error={errors.email ? t.auth.invalidEmail : undefined}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            placeholder="you@example.com"
            {...register('email')}
          />
        </Field>

        <Field
          label={t.auth.password}
          htmlFor="password"
          error={errors.password ? t.common.required : undefined}
        >
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
        </Field>

        {serverError ? (
          <p
            role="alert"
            className="rounded-md border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger"
          >
            {serverError}
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          <Link
            href={href('/forgot-password')}
            className="text-sm text-ink-muted hover:text-accent hover:underline"
          >
            {t.auth.forgotLink}
          </Link>
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t.auth.signIn}
        </Button>
      </form>

      {DEMO_LOGIN_ENABLED ? (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong bg-surface-muted/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t.auth.demoHeading}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => {
                setValue('email', DEMO_ADMIN_EMAIL);
                setValue('password', DEMO_PASSWORD);
                void attempt(DEMO_ADMIN_EMAIL, DEMO_PASSWORD);
              }}
            >
              <ShieldCheck aria-hidden />
              {t.auth.demoAdmin}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => {
                setValue('email', DEMO_PARTICIPANT_EMAIL);
                setValue('password', DEMO_PASSWORD);
                void attempt(DEMO_PARTICIPANT_EMAIL, DEMO_PASSWORD);
              }}
            >
              <UserRound aria-hidden />
              {t.auth.demoParticipant}
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-subtle">{t.auth.demoNote}</p>
        </div>
      ) : null}
    </AuthShell>
  );
}

/**
 * useSearchParams() opts the page out of static prerendering, so the form has
 * to sit behind a Suspense boundary for the production build to emit a shell.
 */
export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
