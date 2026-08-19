'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { navFor } from './nav-config';
import { Icon } from './icon';
import { FbaLockup, FbaMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * The sidebar is placed by the shell's flex order, not by `left`/`right`, so
 * it lands on the right in Arabic and the left in English automatically.
 *
 * Motion budget: every transition here sits inside the product's 160–450ms
 * band, and every one of them is disabled under `prefers-reduced-motion`
 * (`motion-reduce:` for CSS, `useReducedMotion()` for the shared indicator).
 */
export function SidebarContent({
  collapsed,
  onToggleCollapse,
  onNavigate,
  /** Distinguishes the desktop rail from the drawer copy, so the two mounted
      instances do not fight over one shared layout animation. */
  instance = 'desktop',
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  instance?: string;
}) {
  const { t, href, locale, dir } = useI18n();
  const { session, signOut } = useSession();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const sections = navFor(session?.role);

  const strip = pathname.replace(/^\/(ar|en)/, '') || '/';
  // The rail sits on the inline-start edge, so a collapsed tooltip has to open
  // towards the content area — the opposite side in each direction.
  const tooltipSide = dir === 'rtl' ? 'left' : 'right';

  return (
    <div className="flex h-full flex-col bg-surface">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-line px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <Link
          href={href(session?.role === 'participant' ? '/overview' : '/dashboard')}
          className="min-w-0 rounded-md"
          onClick={onNavigate}
        >
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
        {sections.map((section) => (
          <div key={section.key} className="mb-6 last:mb-0">
            <p
              className={cn(
                'mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle transition-opacity duration-200 motion-reduce:transition-none',
                collapsed && 'pointer-events-none h-0 select-none overflow-hidden opacity-0',
              )}
              aria-hidden={collapsed || undefined}
            >
              {section.label(t)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = strip === item.href || strip.startsWith(`${item.href}/`);
                const link = (
                  <Link
                    href={href(item.href)}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
                      collapsed && 'justify-center px-2',
                      active ? 'text-accent' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                    )}
                  >
                    {/* The active pill and its inline-start marker travel between
                        items rather than blinking on and off. */}
                    {active ? (
                      <>
                        <motion.span
                          layoutId={reduced ? undefined : `${instance}-nav-pill`}
                          className="absolute inset-0 rounded-md bg-accent-soft"
                          transition={{ type: 'tween', duration: 0.24, ease: [0.22, 0.68, 0.28, 1] }}
                        />
                        <motion.span
                          layoutId={reduced ? undefined : `${instance}-nav-marker`}
                          className="absolute inset-y-1.5 w-[3px] rounded-full bg-accent ltr:left-0 rtl:right-0"
                          transition={{ type: 'tween', duration: 0.24, ease: [0.22, 0.68, 0.28, 1] }}
                        />
                      </>
                    ) : null}
                    {/* `relative` on the content, not a negative z-index on the
                        pill: the sidebar's own opaque background would swallow
                        anything painted behind it. */}
                    <Icon name={item.icon} className="relative size-[18px] shrink-0" />
                    {!collapsed ? <span className="relative truncate">{item.label(t)}</span> : null}
                    {collapsed ? <span className="sr-only">{item.label(t)}</span> : null}
                  </Link>
                );

                return (
                  <li key={item.href} className="relative">
                    {collapsed ? (
                      <Tooltip label={item.label(t)} side={tooltipSide}>
                        {link}
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
      </nav>

      <div className="border-t border-line p-3">
        {collapsed && onToggleCollapse ? (
          <Tooltip label={t.nav.expand} side={tooltipSide}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="mb-2 hidden w-full lg:inline-flex"
              onClick={onToggleCollapse}
              aria-label={t.nav.expand}
            >
              <PanelLeftOpen className="rtl:rotate-180" aria-hidden />
            </Button>
          </Tooltip>
        ) : null}
        {collapsed ? (
          <Tooltip label={t.nav.signOut} side={tooltipSide}>
            <SignOutButton collapsed onSignOut={signOut} label={t.nav.signOut} />
          </Tooltip>
        ) : (
          <SignOutButton collapsed={false} onSignOut={signOut} label={t.nav.signOut} />
        )}
        {!collapsed ? (
          <p className="mt-2 px-2.5 text-[11px] text-ink-subtle" dir="ltr" lang="en">
            {locale === 'ar' ? 'FBA Platform' : 'FBA Platform'} · v1.0
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** forwardRef so the collapsed rail's tooltip can attach to it via `asChild`. */
const SignOutButton = forwardRef<
  HTMLButtonElement,
  {
    collapsed: boolean;
    onSignOut: () => void | Promise<void>;
    label: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ collapsed, onSignOut, label, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={() => void onSignOut()}
    className={cn(
      'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-danger motion-reduce:transition-none',
      collapsed && 'justify-center px-2',
    )}
    {...props}
  >
    <LogOut className="size-[18px] shrink-0 rtl:rotate-180" aria-hidden />
    {collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
  </button>
));
SignOutButton.displayName = 'SignOutButton';
