'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getRepository } from '@/lib/data';
import type { Role, Session } from '@/lib/data/types';

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Roles allowed into the admin half of the product. */
export const ADMIN_ROLES: Role[] = ['owner', 'admin', 'reviewer'];

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getRepository().getSession();
    setSession(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      isAdmin: session ? ADMIN_ROLES.includes(session.role) : false,
      signIn: async (email, password) => {
        const next = await getRepository().signIn(email, password);
        setSession(next);
        return next;
      },
      signOut: async () => {
        await getRepository().signOut();
        setSession(null);
      },
      refresh,
    }),
    [session, loading, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
