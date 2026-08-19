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
import type { ThemePresetKey, ThemeSettings, ThemeTokens } from '@/lib/data/types';
import { CINEMA_WHITE, MIDNIGHT_SCREENING, tokensToCssVars } from '@/lib/theme/presets';

export type ColorMode = 'light' | 'dark';

const MODE_KEY = 'fba.mode.v1';

interface ThemeContextValue {
  /** The org's published theme — what the Appearance studio persists. */
  published: ThemeSettings | null;
  /** Tokens currently painted on <html>. */
  active: ThemeTokens;
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  /** Paint tokens without persisting — used by the Appearance live preview. */
  preview: (tokens: ThemeTokens | null) => void;
  publish: (input: { preset: ThemePresetKey; tokens: ThemeTokens }) => Promise<ThemeSettings>;
  reload: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function applyTokens(tokens: ThemeTokens) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(tokensToCssVars(tokens)).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<ThemeSettings | null>(null);
  const [previewTokens, setPreviewTokens] = useState<ThemeTokens | null>(null);
  const [mode, setModeState] = useState<ColorMode>('light');

  const reload = useCallback(async () => {
    try {
      const theme = await getRepository().getTheme();
      setPublished(theme);
    } catch {
      // A theme fetch must never be able to take the whole app down with it —
      // `active` already falls back to CINEMA_WHITE when `published` is null
      // (see below), so the product still renders correctly, just on the
      // default preset instead of whatever the org actually published. This
      // also covers the org's very first request, right after sign-in,
      // before the auth session is fully attached to the Supabase client —
      // an unhandled rejection here was silently freezing every other
      // provider's data fetch behind it.
    }
  }, []);

  useEffect(() => {
    void reload();
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === 'dark' || saved === 'light') setModeState(saved);
    } catch {
      // Storage can be unavailable in private browsing; light stays default.
    }
  }, [reload]);

  // Dark mode is not a second set of authored tokens — it swaps in the
  // Midnight Screening preset, which is the brand's own dark palette. If the
  // org has published Midnight Screening as its theme, dark mode is a no-op.
  const active = useMemo<ThemeTokens>(() => {
    if (previewTokens) return previewTokens;
    const base = published?.tokens ?? CINEMA_WHITE;
    if (mode === 'dark' && published?.preset !== 'midnight_screening') {
      return { ...MIDNIGHT_SCREENING, radius: base.radius };
    }
    return base;
  }, [previewTokens, published, mode]);

  useEffect(() => {
    applyTokens(active);
    document.documentElement.dataset.theme = mode;
  }, [active, mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      published,
      active,
      mode,
      setMode: (next) => {
        setModeState(next);
        try {
          window.localStorage.setItem(MODE_KEY, next);
        } catch {
          // Non-fatal: the mode simply will not persist.
        }
      },
      toggleMode: () => {
        const next = mode === 'light' ? 'dark' : 'light';
        setModeState(next);
        try {
          window.localStorage.setItem(MODE_KEY, next);
        } catch {
          // Non-fatal.
        }
      },
      preview: setPreviewTokens,
      publish: async (input) => {
        const saved = await getRepository().saveTheme(input);
        setPublished(saved);
        setPreviewTokens(null);
        return saved;
      },
      reload,
    }),
    [published, active, mode, reload],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
