'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Languages } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { FbaLockup, FilmCommissionMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

/**
 * Split-screen authentication frame.
 *
 * Desktop: 42% form / 58% cinematic panel. The panel sits on the inline-end
 * side, so it is on the right in English and on the left in Arabic without a
 * single direction-specific class.
 *
 * NOTE ON THE VISUAL: `public/brand/campaign-fba.jpg` is the official Film
 * Business Accelerator image, sourced from film.moc.gov.sa and saved locally
 * (see README/HANDOFF for provenance). Set NEXT_PUBLIC_CAMPAIGN_IMAGE to
 * override it with a different approved asset — no code change required.
 */

const CAMPAIGN_IMAGE = process.env.NEXT_PUBLIC_CAMPAIGN_IMAGE || '/brand/campaign-fba.jpg';
const IS_PLACEHOLDER = false;

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t, locale, switchLocale, href } = useI18n();

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* Form column */}
      <div className="flex w-full flex-col lg:w-[42%]">
        <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <Link href={href('/sign-in')} aria-label={t.brand.name}>
            <FbaLockup className="h-8 sm:h-9" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}
            aria-label={t.topbar.language}
          >
            <Languages aria-hidden />
            <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
          </Button>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 pb-10 sm:px-10">
          <div className="w-full max-w-[26rem]">
            <h1 className="text-2xl font-semibold text-ink sm:text-[1.75rem]">{title}</h1>
            <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
            {footer ? <div className="mt-6 text-sm text-ink-muted">{footer}</div> : null}
          </div>
        </main>

        <footer className="flex items-center justify-between gap-4 px-6 py-5 text-xs text-ink-subtle sm:px-10">
          <FilmCommissionMark className="h-5 opacity-70" />
          <span>© {new Date().getFullYear()} {t.brand.name}</span>
        </footer>
      </div>

      {/* Cinematic column */}
      <aside className="relative hidden overflow-hidden lg:block lg:w-[58%]">
        <Image
          src={CAMPAIGN_IMAGE}
          alt=""
          aria-hidden
          fill
          priority
          sizes="58vw"
          className="object-cover"
        />
        {/* Warm overlay — keeps the statement readable over any photograph. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(200deg, rgba(15,40,55,0.20) 0%, rgba(15,40,55,0.55) 55%, rgba(7,17,25,0.88) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 15% 100%, rgba(251,174,64,0.28) 0%, rgba(251,174,64,0) 60%)',
          }}
        />

        <div className="relative flex h-full flex-col justify-end p-12 xl:p-16">
          <p className="max-w-[22ch] text-3xl font-semibold leading-[1.35] text-white xl:text-[2.5rem]">
            {t.auth.campaignStatement}
          </p>
          <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-white/75">
            {t.auth.campaignSupport}
          </p>
          {IS_PLACEHOLDER ? (
            <p className="mt-10 inline-flex w-fit rounded-full border border-white/25 px-3 py-1 text-[11px] uppercase tracking-wide text-white/60">
              {t.auth.placeholderNote}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
