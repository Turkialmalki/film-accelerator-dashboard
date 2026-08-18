import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import '@/app/globals.css';
import { LOCALES, dirOf, getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/data/types';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { SessionProvider } from '@/components/providers/session-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';

/**
 * This is the application's root layout. The locale lives in the URL, so the
 * <html> element can carry the correct `lang` and `dir` on the server — no
 * client-side flip, no flash of the wrong direction.
 */

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#faf8f5',
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = (LOCALES as string[]).includes(params.locale)
    ? (params.locale as Locale)
    : 'ar';
  const t = getDictionary(locale);
  return {
    title: { default: t.brand.name, template: `%s · ${t.brand.name}` },
    description:
      locale === 'ar'
        ? 'منصة إدارة مسرعة الأعمال في الأفلام: الفرق، الاستمارات، والنتائج.'
        : 'The Film Business Accelerator platform: teams, forms, and results.',
    icons: { icon: '/brand/fba-mark.svg' },
  };
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!(LOCALES as string[]).includes(params.locale)) notFound();
  const locale = params.locale as Locale;

  return (
    <html lang={locale} dir={dirOf(locale)} className={plexArabic.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <LocaleProvider locale={locale}>
          <ThemeProvider>
            <SessionProvider>{children}</SessionProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
