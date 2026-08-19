'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { navFor } from './nav-config';
import { Icon } from './icon';
import { FbaLockup, FbaMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * The sidebar is placed by the shell's flex order, not by `left`/`right`, so
 * it lands on the right in Arabic and the left in English automatically.
 */
export function SidebarContent({
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const { t, href, locale } = useI18n();
  const { session, signOut } = useSession();
  const pathname = usePathname();
  const sections = navFor(session?.role);

  const strip = pathname.replace(/^\/(ar|en)/, '') || '/';

  return (
    <div className="flex h-full flex-col bg-surface">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-line px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <Link href={href(session?.role === 'participant' ? '/overview' : '/dashboard')} className="min-w-0">
          {collapsed ? <FbaMark /> : <FbaLockup className="h-8" />}
        </Link>
        {!collapsed && onToggleCollapse ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ms-auto hidden lg:inline-flex"
            onClick={onToggleCollapse}
            aria-label={t.nav.collapse}
          >
            <PanelLeftClose className="rtl:rotate-180" aria-hidden />
          </Button>
        ) : null}
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-4" aria-label={t.nav.menu}>
        <TooltipProvider delayDuration={200}>
          {sections.map((section) => (
            <div key={section.key} className="mb-6 last:mb-0">
              {!collapsed ? (
                <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  {section.label(t)}
                </p>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = strip === item.href || strip.startsWith(`${item.href}/`);
                  const link = (
                    <Link
                      href={href(item.href)}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                        collapsed && 'justify-center px-2',
                        active
                          ? 'bg-accent-soft text-accent'
                          : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      <Icon name={item.icon} className="size-[18px] shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label(t)}</span> : null}
                    </Link>
                  );
                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side={locale === 'ar' ? 'left' : 'right'}>
                            {item.label(t)}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </TooltipProvider>
      </nav>

      <div className="border-t border-line p-3">
        {collapsed && onToggleCollapse ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="mb-2 hidden w-full lg:inline-flex"
            onClick={onToggleCollapse}
            aria-label={t.nav.expand}
          >
            <PanelLeftOpen className="rtl:rotate-180" aria-hidden />
          </Button>
        ) : null}
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-danger',
            collapsed && 'justify-center px-2',
          )}
        >
          <LogOut className="size-[18px] shrink-0 rtl:rotate-180" aria-hidden />
          {!collapsed ? <span>{t.nav.signOut}</span> : null}
        </button>
        {!collapsed ? (
          <p className="mt-2 px-2.5 text-[11px] text-ink-subtle" dir="ltr" lang="en">
            {locale === 'ar' ? 'FBA Platform' : 'FBA Platform'} · v1.0
          </p>
        ) : null}
      </div>
    </div>
  );
}
