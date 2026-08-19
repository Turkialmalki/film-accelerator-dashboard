'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/locale-provider';

export default function LocaleNotFound() {
  const { t, href } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="tnum text-5xl font-semibold text-accent">404</p>
      <h1 className="text-xl font-semibold text-ink">{t.errors.notFound}</h1>
      <p className="max-w-md text-sm text-ink-muted">{t.errors.notFoundBody}</p>
      <Button asChild>
        <Link href={href('/sign-in')}>{t.errors.goHome}</Link>
      </Button>
    </div>
  );
}
