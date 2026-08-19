'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { getRepository } from '@/lib/data';

const schema = z
  .object({ password: z.string().min(8), confirmPassword: z.string().min(8) })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  });

type Values = z.infer<typeof schema>;

function ResetPasswordForm() {
  const { t, href } = useI18n();
  const params = useSearchParams();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  return (
    <AuthShell
      title={t.auth.resetTitle}
      subtitle={t.auth.resetSubtitle}
      footer={
        <Link href={href('/sign-in')} className="font-medium text-accent hover:underline">
          {t.auth.backToSignIn}
        </Link>
      }
    >
      {done ? (
        <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/8 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p className="text-sm text-ink">{t.common.saved}</p>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async (values) => {
            await getRepository().resetPassword(params.get('token') ?? 'demo-token', values.password);
            setDone(true);
          })}
        >
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
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t.auth.setPassword}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

/**
 * useSearchParams() opts the page out of static prerendering, so the form has
 * to sit behind a Suspense boundary for the production build to emit a shell.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
