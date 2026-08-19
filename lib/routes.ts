/**
 * One place that decides who may see what.
 *
 * Both the middleware (URL-level guard) and the shell (render-level guard)
 * read these lists, so a route cannot be protected in one and forgotten in
 * the other.
 */

export const ADMIN_ROUTES = [
  '/dashboard',
  '/teams',
  '/forms',
  '/results',
  '/appearance',
  '/settings',
] as const;

export const PARTICIPANT_ROUTES = [
  '/overview',
  '/my-team',
  '/assigned-forms',
  '/my-submissions',
] as const;

/**
 * The forced password-change screen.
 *
 * It is not an AUTH_ROUTE — auth routes bounce a signed-in visitor away, and
 * this one is only reachable *while* signed in. It is not an admin or
 * participant route either, so no role redirect applies to it. It is simply a
 * shared, protected route that every other protected route defers to while
 * `must_change_password` is set.
 */
export const CHANGE_PASSWORD_ROUTE = '/change-password';

/** Signed in, any role. */
export const SHARED_ROUTES = ['/profile', '/help', CHANGE_PASSWORD_ROUTE] as const;

export const AUTH_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/invite',
] as const;

/** Reachable without a session (published form fill links). */
export const PUBLIC_PREFIXES = ['/f/'] as const;

export type AppRole = 'owner' | 'admin' | 'reviewer' | 'participant';

const ADMIN_ROLE_SET: AppRole[] = ['owner', 'admin', 'reviewer'];

export function isAdminRole(role: AppRole | null | undefined): boolean {
  return !!role && ADMIN_ROLE_SET.includes(role);
}

function matches(pathname: string, routes: readonly string[]): boolean {
  return routes.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export function isAdminRoute(pathname: string): boolean {
  return matches(pathname, ADMIN_ROUTES);
}

export function isParticipantRoute(pathname: string): boolean {
  return matches(pathname, PARTICIPANT_ROUTES);
}

export function isAuthRoute(pathname: string): boolean {
  return matches(pathname, AUTH_ROUTES);
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isProtectedRoute(pathname: string): boolean {
  return isAdminRoute(pathname) || isParticipantRoute(pathname) || matches(pathname, SHARED_ROUTES);
}

/** Where a role lands after sign-in. */
export function homeFor(role: AppRole | null | undefined): string {
  return isAdminRole(role) ? '/dashboard' : '/overview';
}
