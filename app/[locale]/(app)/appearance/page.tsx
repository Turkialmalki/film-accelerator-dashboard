'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, ExternalLink, Loader2, Star } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { THEME_PRESETS } from '@/lib/theme/presets';
import type { ThemePresetKey } from '@/lib/data/types';
import { ThemeMockup } from '@/components/appearance/theme-mockup';
import { cn } from '@/lib/utils';

const FILM_COMMISSION_URL = 'https://film.moc.gov.sa/en/Initiatives/Film_Accelerator';

/**
 * Appearance, reduced to the one decision an admin actually needs to make:
 * which of the three approved looks. No colour pickers, no radius slider,
 * no separate "publish" step — picking a preset paints the whole app (via
 * `preview`) and persists it (via `publish`) in the same motion, same as
 * everything else in this product that just saves when you act on it.
 */
export default function AppearancePage() {
  const { t, b, fmtDateTime } = useI18n();
  const { published, preview, publish } = useTheme();

  const [applying, setApplying] = useState<ThemePresetKey | null>(null);
  const activeKey = published?.preset ?? 'cinema_white';
  const activePreset = useMemo(
    () => THEME_PRESETS.find((p) => p.key === activeKey) ?? THEME_PRESETS[0],
    [activeKey],
  );

  // Leaving the page should never leave a stray preview painted over the
  // real published theme.
  useEffect(() => () => preview(null), [preview]);

  async function select(key: ThemePresetKey) {
    if (key === activeKey || applying) return;
    const item = THEME_PRESETS.find((p) => p.key === key);
    if (!item) return;
    setApplying(key);
    preview(item.tokens);
    try {
      await publish({ preset: item.key, tokens: item.tokens });
    } finally {
      setApplying(null);
      preview(null); // `published` now matches; painting from it is enough.
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.appearance.title} subtitle={t.appearance.subtitle} />

      {/* Where the palette comes from — not an abstract design decision. */}
      <div className="mb-6 grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-line shadow-card sm:grid-cols-[1fr_1.3fr]">
        <div className="relative min-h-[180px] sm:min-h-full">
          <Image
            src="/brand/campaign-fba.jpg"
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 40vw"
            className="object-cover object-[50%_20%]"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(15,40,55,0.55), rgba(15,40,55,0.05))' }}
          />
        </div>
        <div className="flex flex-col justify-center gap-2 bg-surface p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-ink">{t.appearance.inspirationTitle}</h3>
          <p className="text-sm leading-relaxed text-ink-muted">{t.appearance.inspirationBody}</p>
          <a
            href={FILM_COMMISSION_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            {t.appearance.inspirationCta}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>

      {/* The three presets — each thumbnail is a real miniature render of
          the app's own chrome in that preset's tokens, not a static image. */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-ink">{t.appearance.presets}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {THEME_PRESETS.map((item) => {
            const isActive = item.key === activeKey;
            const isApplying = applying === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => select(item.key)}
                disabled={applying !== null}
                aria-pressed={isActive}
                className={cn(
                  'group flex flex-col overflow-hidden rounded-xl border text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default',
                  isActive
                    ? 'border-accent shadow-lift ring-1 ring-accent/40'
                    : 'border-line bg-surface hover:border-line-strong hover:shadow-card',
                )}
              >
                <ThemeMockup tokens={item.tokens} className="m-3 mb-0 aspect-[16/10]" />
                <div className="flex items-start justify-between gap-2 p-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{b(item.name)}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-subtle">{b(item.description)}</p>
                  </div>
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                    {isApplying ? (
                      <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
                    ) : isActive ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-ink">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                </div>
                {isActive ? (
                  <div className="border-t border-line px-3.5 py-2 text-xs font-medium text-accent">
                    {t.appearance.active}
                  </div>
                ) : (
                  <div className="border-t border-line px-3.5 py-2 text-xs text-ink-subtle transition-colors group-hover:text-ink-muted">
                    {isApplying ? t.appearance.saving : t.appearance.selectToApply}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {published ? (
          <p className="mt-3 text-xs text-ink-subtle">
            {t.appearance.publishedAt}: {fmtDateTime(published.updated_at)}
          </p>
        ) : null}
      </section>

      {/* Live preview of the currently-applied theme — these are the real
          Button/Badge/Card/Progress components, so this is exactly what the
          rest of the product looks like right now, not a mockup of it. */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">{t.appearance.preview}</h3>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.appearance.previewHeading}</CardTitle>
              <CardDescription>{b(activePreset.name)}</CardDescription>
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
  );
}
