'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Field } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { getRepository } from '@/lib/data';
import { homeFor } from '@/lib/routes';

const schema = z
  .object({
    fullName: z.string().min(2),
    email: z.string().min(1).email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    inviteCode: z.string().optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  });

type Values = z.infer<typeof schema>;

function SignUpForm() {
  const { t, href } = useI18n();
  const { refresh } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      inviteCode: params.get('code') ?? '',
    },
  });

  async function onSubmit(values: Values) {
    setServerError(null);
    try {
      const session = await getRepository().signUp({
        email: values.email,
        password: values.password,
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
  }

  return (
    <AuthShell
      title={t.auth.signUpTitle}
      subtitle={t.auth.signUpSubtitle}
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
          label={t.auth.password}
          htmlFor="password"
          hint={t.auth.passwordHint}
          error={errors.password ? t.auth.passwordHint : undefined}
        >
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
        </Field>

        <Field
          label={t.auth.confirmPassword}
          htmlFor="confirmPassword"
          error={errors.confirmPassword ? t.auth.passwordMismatch : undefined}
        >
          <PasswordInput id="confirmPassword" autoComplete="new-password" {...register('confirmPassword')} />
        </Field>

        <Field label={`${t.auth.inviteCode} · ${t.common.optional}`} htmlFor="inviteCode">
          <Input id="inviteCode" dir="ltr" placeholder="ABCD-1234" {...register('inviteCode')} />
        </Field>

        {serverError ? (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t.auth.signUp}
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
