import { NextResponse, type NextRequest } from 'next/server';
import {
  homeFor,
  isAdminRole,
  isAdminRoute,
  isAuthRoute,
  isParticipantRoute,
  isProtectedRoute,
  type AppRole,
} from '@/lib/routes';

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

interface CookieSession {
  role: AppRole;
  team_id: string | null;
  email: string;
}

function readSession(request: NextRequest): CookieSession | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as CookieSession;
  } catch {
    return null;
  }
}

/**
 * In demo mode the session cookie is unsigned — it is a demo, and the data it
 * guards is fixture data in the visitor's own browser. In production this
 * middleware would verify the Supabase JWT instead of parsing JSON, which is
 * the only change required here.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale, rest } = splitLocale(pathname);

  if (!locale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const session = readSession(request);

  if (isProtectedRoute(rest) && !session) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
    url.search = `?next=${encodeURIComponent(rest + search)}`;
    return NextResponse.redirect(url);
  }

  if (session) {
    const admin = isAdminRole(session.role);
    // A participant must not reach an admin route, even by typing the URL.
    if (isAdminRoute(rest) && !admin) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/overview`;
      url.search = '?denied=1';
      return NextResponse.redirect(url);
    }
    // And an admin has no participant workspace to sit in.
    if (isParticipantRoute(rest) && admin) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/dashboard`;
      url.search = '';
      return NextResponse.redirect(url);
    }
    if (isAuthRoute(rest)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${homeFor(session.role)}`;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|brand|data|favicon.ico|.*\\.svg$).*)'],
};
