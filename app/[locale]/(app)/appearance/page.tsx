'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RotateCcw, Send, Star } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label, Progress, Separator } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { CINEMA_WHITE, THEME_PRESETS } from '@/lib/theme/presets';
import type { ThemePresetKey, ThemeTokens } from '@/lib/data/types';
import { cn } from '@/lib/utils';

/**
 * Appearance studio.
 *
 * Editing paints the tokens straight onto <html> through the theme provider,
 * so the "live preview" is the entire application, not a mock panel. Publishing
 * writes to the data layer — localStorage in demo mode, `theme_settings` in
 * production — which is why a refresh keeps the change.
 */

const COLOR_TOKENS: { key: keyof ThemeTokens; label: (t: ReturnType<typeof useI18n>['t']) => string }[] = [
  { key: 'canvas', label: (t) => t.appearance.tokenCanvas },
  { key: 'surface', label: (t) => t.appearance.tokenSurface },
  { key: 'surfaceMuted', label: (t) => t.appearance.tokenSurfaceMuted },
  { key: 'line', label: (t) => t.appearance.tokenLine },
  { key: 'ink', label: (t) => t.appearance.tokenInk },
  { key: 'inkMuted', label: (t) => t.appearance.tokenInkMuted },
  { key: 'accent', label: (t) => t.appearance.tokenAccent },
  { key: 'accentHover', label: (t) => t.appearance.tokenAccentHover },
  { key: 'accentSoft', label: (t) => t.appearance.tokenAccentSoft },
  { key: 'success', label: (t) => t.appearance.tokenSuccess },
  { key: 'warning', label: (t) => t.appearance.tokenWarning },
  { key: 'danger', label: (t) => t.appearance.tokenDanger },
  { key: 'info', label: (t) => t.appearance.tokenInfo },
];

export default function AppearancePage() {
  const { t, b, fmtDateTime } = useI18n();
  const { published, preview, publish } = useTheme();

  const [preset, setPreset] = useState<ThemePresetKey>('cinema_white');
  const [tokens, setTokens] = useState<ThemeTokens>(CINEMA_WHITE);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justPublished, setJustPublished] = useState(false);

  useEffect(() => {
    if (!published) return;
    setPreset(published.preset);
    setTokens(published.tokens);
    setDirty(false);
  }, [published]);

  // Paint edits live, and put the published theme back when leaving the page.
  useEffect(() => {
    if (!dirty) return;
    preview(tokens);
  }, [tokens, dirty, preview]);

  useEffect(() => () => preview(null), [preview]);

  const activePreset = useMemo(() => THEME_PRESETS.find((p) => p.key === preset), [preset]);

  function apply(next: Partial<ThemeTokens>) {
    setTokens((current) => ({ ...current, ...next }));
    setDirty(true);
    setJustPublished(false);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={t.appearance.title}
        subtitle={t.appearance.subtitle}
        actions={
          <>
            {dirty ? <Badge tone="warning">{t.appearance.unsaved}</Badge> : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (published) {
                  setPreset(published.preset);
                  setTokens(published.tokens);
                }
                setDirty(false);
                preview(null);
              }}
              disabled={!dirty}
            >
              <RotateCcw aria-hidden />
              {t.appearance.revert}
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await publish({ preset, tokens });
                setSaving(false);
                setDirty(false);
                setJustPublished(true);
              }}
            >
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : justPublished ? (
                <Check aria-hidden />
              ) : (
                <Send aria-hidden />
              )}
              {t.appearance.publish}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_1fr]">
        {/* ------------------------------------------------------- controls */}
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">{t.appearance.presets}</h3>
            <ul className="flex flex-col gap-2">
              {THEME_PRESETS.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setPreset(item.key);
                      setTokens(item.tokens);
                      setDirty(true);
                      setJustPublished(false);
                    }}
                    aria-pressed={preset === item.key}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      preset === item.key
                        ? 'border-accent bg-accent-soft/50'
                        : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <span className="mt-0.5 flex shrink-0 overflow-hidden rounded-md border border-line">
                      {[item.tokens.canvas, item.tokens.surface, item.tokens.ink, item.tokens.accent].map(
                        (color) => (
                          <span key={color} className="size-5" style={{ backgroundColor: color }} />
                        ),
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{b(item.name)}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-subtle">
                        {b(item.description)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <Separator />

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">{t.appearance.colors}</h3>
            <ul className="flex flex-col gap-2.5">
              {COLOR_TOKENS.map((token) => {
                const value = tokens[token.key] as string;
                const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
                return (
                  <li key={token.key} className="flex items-center gap-2.5">
                    <Label htmlFor={`token-${token.key}`} className="min-w-0 flex-1 text-xs">
                      {token.label(t)}
                    </Label>
                    {isHex ? (
                      <input
                        id={`token-${token.key}`}
                        type="color"
                        value={value}
                        onChange={(e) => apply({ [token.key]: e.target.value } as Partial<ThemeTokens>)}
                        className="size-9 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1"
                      />
                    ) : null}
                    <Input
                      aria-label={token.label(t)}
                      dir="ltr"
                      value={value}
                      onChange={(e) => apply({ [token.key]: e.target.value } as Partial<ThemeTokens>)}
                      className="h-9 w-32 font-mono text-xs"
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          <Separator />

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">{t.appearance.shape}</h3>
            <Label htmlFor="radius" className="text-xs">
              {t.appearance.radius}: <span className="tnum">{tokens.radius}px</span>
            </Label>
            <input
              id="radius"
              type="range"
              min={0}
              max={28}
              value={tokens.radius}
              onChange={(e) => apply({ radius: Number(e.target.value) })}
              className="mt-2 w-full accent-[color:var(--c-accent)]"
            />
          </section>

          <p className="rounded-md border border-line bg-surface-muted/60 p-3 text-xs leading-relaxed text-ink-muted">
            {t.appearance.persistNote}
          </p>
          {published ? (
            <p className="text-xs text-ink-subtle">
              {t.appearance.publishedAt}: {fmtDateTime(published.updated_at)}
            </p>
          ) : null}
        </div>

        {/* -------------------------------------------------------- preview */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-ink">{t.appearance.preview}</h3>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.appearance.previewHeading}</CardTitle>
                <CardDescription>{b(activePreset?.name)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-ink-muted">{t.appearance.previewBody}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">{t.appearance.previewButton}</Button>
                  <Button size="sm" variant="secondary">
                    {t.appearance.previewSecondary}
                  </Button>
                  <Button size="sm" variant="ghost">
                    {t.common.cancel}
                  </Button>
                  <Button size="sm" variant="danger">
                    {t.common.delete}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="accent">{t.common.published}</Badge>
                  <Badge tone="success">{t.results.reviewed}</Badge>
                  <Badge tone="warning">{t.common.draft}</Badge>
                  <Badge tone="danger">{t.common.delete}</Badge>
                  <Badge tone="info">{t.forms.conditional}</Badge>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-ink-subtle">{t.teams.readiness}</p>
                  <Progress value={68} />
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn('size-5', n <= 4 ? 'fill-accent text-accent' : 'text-line-strong')}
                      aria-hidden
                    />
                  ))}
                </div>
                <Input placeholder={t.teams.searchPlaceholder} aria-label={t.common.search} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: t.dashboard.kpiTeams, value: '20' },
                { label: t.dashboard.kpiForms, value: '3' },
                { label: t.dashboard.kpiRate, value: '72%' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-line bg-surface p-5 shadow-card">
                  <p className="text-sm font-medium text-ink-muted">{item.label}</p>
                  <p className="tnum mt-2 text-2xl font-semibold text-ink">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
