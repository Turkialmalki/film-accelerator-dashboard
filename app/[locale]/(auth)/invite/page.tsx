'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Ticket } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { getRepository } from '@/lib/data';
import type { Invitation } from '@/lib/data/types';
import { homeFor } from '@/lib/routes';

const schema = z.object({
  code: z.string().min(4),
  fullName: z.string().min(2),
  email: z.string().min(1).email(),
});

type Values = z.infer<typeof schema>;

function InviteForm() {
  const { t, href } = useI18n();
  const { refresh } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [found, setFound] = useState<Invitation | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: params.get('code') ?? '', fullName: '', email: '' },
  });

  const code = watch('code');

  // Look the code up as it is typed so the invited person sees immediately
  // that their code is recognised, and their email is pre-filled.
  useEffect(() => {
    let cancelled = false;
    if (!code || code.length < 4) {
      setFound(null);
      return;
    }
    void getRepository()
      .lookupInvitation(code)
      .then((invitation) => {
        if (cancelled) return;
        setFound(invitation);
        if (invitation && !watch('email')) setValue('email', invitation.email);
      });
    return () => {
      cancelled = true;
    };
  }, [code, setValue, watch]);

  return (
    <AuthShell
      title={t.auth.inviteTitle}
      subtitle={t.auth.inviteSubtitle}
      footer={
        <Link href={href('/sign-in')} className="font-medium text-accent hover:underline">
          {t.auth.backToSignIn}
        </Link>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (values) => {
          setServerError(null);
          try {
            const session = await getRepository().acceptInvitation(values.code, {
              email: values.email,
              fullName: values.fullName,
            });
            await refresh();
            router.replace(href(homeFor(session.role)));
            router.refresh();
          } catch (error) {
            const errorCode = error instanceof Error ? error.message : '';
            setServerError(
              errorCode === 'INVALID_CODE'
                ? t.auth.errorInvalidCode
                : errorCode === 'REVOKED_CODE'
                  ? t.auth.errorRevoked
                  : errorCode === 'EMAIL_TAKEN'
                    ? t.auth.errorEmailTaken
                    : t.auth.errorGeneric,
            );
          }
        })}
      >
        <Field
          label={t.auth.inviteCode}
          htmlFor="code"
          error={errors.code ? t.auth.errorInvalidCode : undefined}
        >
          <Input id="code" dir="ltr" placeholder="ABCD-1234" {...register('code')} />
        </Field>

        {found ? (
          <Badge tone={found.status === 'pending' ? 'success' : 'warning'} className="w-fit">
            <Ticket className="size-3.5" aria-hidden />
            {found.status === 'pending' ? found.email : t.auth.errorRevoked}
          </Badge>
        ) : null}

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

        {serverError ? (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t.auth.acceptInvite}
        </Button>
      </form>
    </AuthShell>
  );
}

/**
 * useSearchParams() opts the page out of static prerendering, so the form has
 * to sit behind a Suspense boundary for the production build to emit a shell.
 */
export default function InvitePage() {
  return (
    <Suspense>
      <InviteForm />
    </Suspense>
  );
}
