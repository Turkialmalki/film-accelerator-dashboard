'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
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

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t, locale, switchLocale, href } = useI18n();
  const reduced = useReducedMotion();

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
          <motion.div
            className="w-full max-w-[26rem]"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 0.68, 0.28, 1] }}
          >
            <h1 className="text-2xl font-semibold text-ink sm:text-[1.75rem]">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-ink-muted">{subtitle}</p> : null}
            <div className={subtitle ? 'mt-7' : 'mt-5'}>{children}</div>
            {footer ? <div className="mt-6 text-sm text-ink-muted">{footer}</div> : null}
          </motion.div>
        </main>

        <footer className="flex items-center justify-between gap-4 px-6 py-5 text-xs text-ink-subtle sm:px-10">
          <FilmCommissionMark className="h-5 opacity-70" />
          <span>© {new Date().getFullYear()} {t.brand.name}</span>
        </footer>
      </div>

      {/* Cinematic column */}
      <aside className="relative hidden overflow-hidden lg:block lg:w-[58%]">
        <motion.div
          className="absolute inset-0"
          initial={reduced ? false : { scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 16, ease: 'easeOut' }}
        >
          <Image
            src={CAMPAIGN_IMAGE}
            alt=""
            aria-hidden
            fill
            priority
            sizes="58vw"
            className="object-cover"
          />
        </motion.div>
        {/* Soft warm overlay — blends the photograph into the panel edges. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(200deg, rgba(15,40,55,0.08) 0%, rgba(15,40,55,0.18) 55%, rgba(7,17,25,0.32) 100%)',
          }}
        />
      </aside>
    </div>
  );
}
