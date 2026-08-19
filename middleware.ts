import './lib/supabase/edge-realtime-polyfill';

import { NextResponse, type NextRequest } from 'next/server';
import {
  CHANGE_PASSWORD_ROUTE,
  homeFor,
  isAdminRole,
  isAdminRoute,
  isAuthRoute,
  isParticipantRoute,
  isProtectedRoute,
  isPublicRoute,
  type AppRole,
} from '@/lib/routes';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { readSupabaseSession, withAuthCookies } from '@/lib/supabase/middleware-session';

const LOCALES = ['ar', 'en'] as const;
const DEFAULT_LOCALE = 'ar';
const SESSION_COOKIE = 'fba_demo_session';

type Locale = (typeof LOCALES)[number];

function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const [, maybe, ...others] = pathname.split('/');
  if ((LOCALES as readonly string[]).includes(maybe)) {
    return { locale: maybe as Locale, rest: `/${others.join('/')}` };
  }
  return { locale: null, rest: pathname };
}

function preferredLocale(request: NextRequest): Locale {
  const header = request.headers.get('accept-language') ?? '';
  return header.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
}

interface GuardSession {
  role: AppRole;
  mustChangePassword: boolean;
}

/**
 * Demo mode only. The cookie is unsigned — it is a demo, and the data it
 * guards is fixture data in the visitor's own browser. Supabase mode never
 * reaches this function; it verifies a real JWT instead (see below).
 */
function readDemoSession(request: NextRequest): GuardSession | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { role: AppRole };
    // Demo mode has no password store, so it has no forced password change.
    return { role: parsed.role, mustChangePassword: false };
  } catch {
    return null;
  }
}

/**
 * Route guarding, in whichever mode the deployment is running.
 *
 * The two modes differ in exactly one place — how the session is obtained. The
 * guard decisions below are shared, so a route cannot be protected in demo
 * mode and forgotten in production.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale, rest } = splitLocale(pathname);

  if (!locale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const supabaseMode = isSupabaseConfigured();

  let session: GuardSession | null;
  // In Supabase mode this response carries any rotated auth cookies and must
  // be folded into whatever we finally return.
  let carrier: NextResponse | null = null;

  if (supabaseMode) {
    const supa = await readSupabaseSession(request);
    carrier = supa.carrier;
    session = supa.role
      ? { role: supa.role, mustChangePassword: supa.mustChangePassword }
      : null;
  } else {
    session = readDemoSession(request);
  }

  const send = (response: NextResponse) =>
    carrier ? withAuthCookies(carrier, response) : response;

  const redirectTo = (path: string, query = '') => {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${path}`;
    url.search = query;
    return send(NextResponse.redirect(url));
  };

  if (isProtectedRoute(rest) && !session) {
    return redirectTo('/sign-in', `?next=${encodeURIComponent(rest + search)}`);
  }

  if (session) {
    // A temporary password grants access to one screen and nothing else. This
    // is enforced here, before the page is served — not by hiding navigation.
    // Published form share links stay reachable by anyone, including someone
    // who happens to be signed in and mid-onboarding — the gate is about
    // reaching the workspace, not about a public URL.
    if (
      session.mustChangePassword &&
      rest !== CHANGE_PASSWORD_ROUTE &&
      !isAuthRoute(rest) &&
      !isPublicRoute(rest)
    ) {
      return redirectTo(CHANGE_PASSWORD_ROUTE);
    }

    const admin = isAdminRole(session.role);
    // A participant must not reach an admin route, even by typing the URL.
    if (isAdminRoute(rest) && !admin) {
      return redirectTo('/overview', '?denied=1');
    }
    // And an admin has no participant workspace to sit in.
    if (isParticipantRoute(rest) && admin) {
      return redirectTo('/dashboard');
    }
    if (isAuthRoute(rest)) {
      return redirectTo(
        session.mustChangePassword ? CHANGE_PASSWORD_ROUTE : homeFor(session.role),
      );
    }
  }

  return send(carrier ?? NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|brand|data|favicon.ico|.*\\.svg$).*)'],
};
