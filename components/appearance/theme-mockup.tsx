import type { CSSProperties } from 'react';
import type { ThemeTokens } from '@/lib/data/types';
import { tokensToCssVars } from '@/lib/theme/presets';

/**
 * A miniature, always-accurate preview of the product's own chrome —
 * sidebar, topbar, KPI cards, one primary button — built from the exact
 * same Tailwind tokens (`bg-canvas`, `bg-surface`, `text-ink`, `bg-accent`,
 * …) every real page uses. Not a screenshot: the tokens for `preset` are
 * scoped onto this wrapper's own `style`, so nested elements read *these*
 * CSS custom properties instead of whatever is painted on `<html>` — three
 * of these can sit on screen at once, each honestly showing its own preset,
 * with zero drift from what publishing it actually looks like.
 */
export function ThemeMockup({ tokens, className }: { tokens: ThemeTokens; className?: string }) {
  const style = tokensToCssVars(tokens) as CSSProperties;

  return (
    <div
      style={style}
      className={`overflow-hidden rounded-lg border border-line bg-canvas ${className ?? ''}`}
      aria-hidden
    >
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="flex w-[26%] flex-col gap-1.5 border-line bg-surface p-2 ltr:border-r rtl:border-l">
          <div className="mb-1 h-1.5 w-3/5 rounded-full bg-accent" />
          <div className="h-1 w-full rounded-full bg-line" />
          <div className="h-1 w-4/5 rounded-full bg-line" />
          <div className="h-1 w-full rounded-full bg-accent-soft" />
          <div className="h-1 w-3/5 rounded-full bg-line" />
        </div>
        {/* Main */}
        <div className="flex-1 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="h-1.5 w-1/3 rounded-full bg-ink opacity-80" />
            <div className="h-3 w-8 rounded-md bg-accent" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-md border border-line bg-surface p-1.5 shadow-card"
                style={{ borderRadius: `calc(var(--r-base) * 0.4)` }}
              >
                <div className="h-1 w-3/5 rounded-full bg-ink-subtle" />
                <div className="mt-1.5 h-2 w-2/5 rounded-full bg-ink" />
              </div>
            ))}
          </div>
          <div
            className="mt-2 rounded-md border border-line bg-surface-muted p-1.5"
            style={{ borderRadius: `calc(var(--r-base) * 0.4)` }}
          >
            <div className="h-1 w-1/4 rounded-full bg-ink-muted" />
            <div className="mt-1.5 h-6 w-full rounded-sm bg-line" />
          </div>
        </div>
      </div>
    </div>
  );
}
