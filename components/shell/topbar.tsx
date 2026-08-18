'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Languages, Menu, Moon, Sun, UserRound } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { isDemoMode } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { navFor } from './nav-config';
import { initials } from '@/lib/utils';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t, b, locale, switchLocale, href, dir } = useI18n();
  const { session, signOut } = useSession();
  const { mode, toggleMode } = useTheme();
  const pathname = usePathname();

  const strip = pathname.replace(/^\/(ar|en)/, '') || '/';
  const sections = navFor(session?.role);
  const current = sections
    .flatMap((s) => s.items)
    .find((item) => strip === item.href || strip.startsWith(`${item.href}/`));
  const isNested = current ? strip !== current.href : false;
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label={t.nav.menu}>
        <Menu aria-hidden />
      </Button>

      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <span>{t.brand.short}</span>
          {current ? (
            <>
              <Chevron className="size-3" aria-hidden />
              {isNested ? (
                <Link href={href(current.href)} className="hover:text-accent hover:underline">
                  {current.label(t)}
                </Link>
              ) : (
                <span className="text-ink-muted">{current.label(t)}</span>
              )}
            </>
          ) : null}
        </nav>
        <h1 className="truncate text-[15px] font-semibold text-ink">
          {current ? current.label(t) : t.brand.name}
        </h1>
      </div>

      {isDemoMode() ? (
        <Badge tone="warning" className="hidden sm:inline-flex" title={t.topbar.demoTooltip}>
          {t.topbar.demoBadge}
        </Badge>
      ) : null}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}
        aria-label={t.topbar.language}
        title={locale === 'ar' ? 'English' : 'العربية'}
      >
        <Languages aria-hidden />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMode}
        aria-label={t.topbar.theme}
        title={mode === 'light' ? t.topbar.darkMode : t.topbar.lightMode}
      >
        {mode === 'light' ? <Moon aria-hidden /> : <Sun aria-hidden />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            aria-label={t.topbar.account}
          >
            {session ? initials(b(session.profile.full_name)) : <UserRound className="size-4" aria-hidden />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{session ? b(session.profile.full_name) : t.topbar.account}</DropdownMenuLabel>
          <div className="px-2.5 pb-2 text-xs text-ink-subtle" dir="ltr">
            {session?.profile.email}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={href('/profile')}>
              <UserRound aria-hidden />
              {t.nav.profile}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => void signOut()}>
            {t.nav.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
