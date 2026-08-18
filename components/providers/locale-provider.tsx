'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Bilingual, Locale } from '@/lib/data/types';
import { dirOf, getDictionary, interpolate, type Dict } from '@/lib/i18n/dictionaries';
import { bi, formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/utils';

interface LocaleContextValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: Dict;
  /** Interpolates {token} placeholders in a dictionary string. */
  tf: (template: string, values: Record<string, string | number>) => string;
  /** Reads a bilingual record in the active locale. */
  b: (value: Bilingual | undefined | null) => string;
  fmtDate: (iso: string | null | undefined) => string;
  fmtDateTime: (iso: string | null | undefined) => string;
  fmtNumber: (value: number) => string;
  fmtPercent: (value: number) => string;
  switchLocale: (next: Locale) => void;
  /** Prefixes a path with the active locale segment. */
  href: (path: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const value = useMemo<LocaleContextValue>(() => {
    const t = getDictionary(locale);
    return {
      locale,
      dir: dirOf(locale),
      t,
      tf: (template, values) => interpolate(template, values),
      b: (v) => bi(v, locale),
      fmtDate: (iso) => formatDate(iso, locale),
      fmtDateTime: (iso) => formatDateTime(iso, locale),
      fmtNumber: (n) => formatNumber(n, locale),
      fmtPercent: (n) => formatPercent(n, locale),
      href: (path) => `/${locale}${path.startsWith('/') ? path : `/${path}`}`,
      switchLocale: (next) => {
        if (next === locale) return;
        const rest = pathname.replace(/^\/(ar|en)/, '') || '/';
        router.push(`/${next}${rest}`);
      },
    };
  }, [locale, pathname, router]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useI18n must be used inside <LocaleProvider>');
  return ctx;
}
