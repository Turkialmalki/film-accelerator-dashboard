'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { SidebarContent } from './sidebar';
import { Topbar } from './topbar';
import { homeFor, isAdminRole, isAdminRoute, isParticipantRoute } from '@/lib/routes';

const COLLAPSE_KEY = 'fba.sidebar.collapsed.v1';

/**
 * The signed-in frame.
 *
 * Route protection is enforced twice on purpose: middleware blocks the URL
 * before the page is served, and this component blocks the render in case the
 * cookie and the stored session ever disagree (for example after a manual
 * cookie edit). Neither layer trusts the other.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, href } = useI18n();
  const { session, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // Storage unavailable: the sidebar simply starts expanded.
    }
  }, []);

  const strip = pathname.replace(/^\/(ar|en)/, '') || '/';
  const admin = isAdminRole(session?.role);
  const denied =
    !!session && ((isAdminRoute(strip) && !admin) || (isParticipantRoute(strip) && admin));

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace(href(`/sign-in?next=${encodeURIComponent(strip)}`));
      return;
    }
    if (denied) router.replace(href(homeFor(session.role)));
  }, [loading, session, denied, router, href, strip]);

  if (loading || !session || denied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-ink-subtle" aria-hidden />
        <span className="sr-only">{t.common.loading}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop sidebar. Flex order puts it on the inline-start edge, which
          the html[dir] attribute already mirrors. The width transition uses a
          slight-overshoot easing curve to read as a soft spring; reduced
          motion drops straight to the CSS `transition-none` variant. */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 overflow-hidden border-line transition-[width] duration-300 ease-[cubic-bezier(0.34,1.15,0.64,1)] motion-reduce:transition-none lg:block ltr:border-r rtl:border-l',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => {
            const next = !collapsed;
            setCollapsed(next);
            try {
              window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
            } catch {
              // Non-fatal.
            }
          }}
        />
      </aside>

      {/* Mobile drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent side="start" width="max-w-[17rem]" className="p-0">
          <SidebarContent collapsed={false} onNavigate={() => setDrawerOpen(false)} />
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
