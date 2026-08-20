'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Hand-built dimensional KPI icons.
 *
 * Why these exist: the dashboard's KPI cards used a flat Lucide glyph inside a
 * solid accent chip. Correct, but generic. These replace the chip *and* the
 * glyph with one drawn tile per KPI concept: a soft gradient plate, a glyph
 * with its own vertical light ramp, and a low, tinted drop shadow. Restrained
 * on purpose — no gloss, no bevel, no glassmorphism, no neon.
 *
 * Three rules the whole file obeys:
 *
 * 1. **No hard-coded colour.** Every fill and stroke resolves to a design token
 *    (`--c-accent`, `--c-info`, `--c-success`, `--c-warning`, `--c-danger`,
 *    `--c-surface`), so the Appearance studio's presets — Midnight Screening
 *    included — retint the artwork with no code change. Depth is expressed as
 *    *opacity ramps on the token colour*, never as a literal lighter hex.
 * 2. **Every `<defs>` id is unique per rendered instance.** 17 tiles render on
 *    one dashboard and several share a design; duplicate SVG ids are a real
 *    cross-browser rendering bug, so ids are suffixed from `useId()`.
 * 3. **Legible at 32px.** These draw into a 32×32 viewBox at the size the card
 *    actually renders. Detail that turns to noise at that size (window grids,
 *    hatching, multi-stop bevels) was cut, not shrunk.
 *
 * There is deliberately no entrance animation on the artwork: `KpiCard` already
 * plays a one-shot rise and `useCountUp` already animates the number. A third
 * moving part on the same card would exceed this codebase's motion budget.
 */

type Tint = 'accent' | 'info' | 'success' | 'warning' | 'danger';

const TINT: Record<Tint, string> = {
  accent: 'var(--c-accent)',
  info: 'var(--c-info)',
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
};

/** The card surface. Used for glyph cut-outs (a check, a clock hand, a clasp). */
const CUT = 'var(--c-surface)';

export type KpiIconProps = {
  /** Overrides the design's default token. Semantic, not decorative. */
  tint?: Tint;
  className?: string;
};

type PlateProps = {
  tint: Tint;
  className?: string;
  /** Receives the per-instance paint references. */
  children: (paint: { glyph: string; tint: string }) => React.ReactNode;
};

/**
 * The shared substrate: gradient plate, hairline edge, glyph gradient and the
 * soft tinted shadow the glyph sits on.
 */
function Plate({ tint, className, children }: PlateProps) {
  // useId() emits ':r3:' — colons are not valid in an XML id reference.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = TINT[tint];
  const plateId = `kpiPlate${uid}`;
  const glyphId = `kpiGlyph${uid}`;
  const shadeId = `kpiShade${uid}`;

  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn('size-8 shrink-0', className)}
    >
      <defs>
        {/* The plate: a light-from-above wash of the token, not a solid chip. */}
        <linearGradient id={plateId} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.22" />
          <stop offset="55%" stopColor={c} stopOpacity="0.13" />
          <stop offset="100%" stopColor={c} stopOpacity="0.07" />
        </linearGradient>
        {/* The glyph's own ramp — full strength at the top, receding at the base. */}
        <linearGradient id={glyphId} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="1" />
          <stop offset="58%" stopColor={c} stopOpacity="0.89" />
          <stop offset="100%" stopColor={c} stopOpacity="0.68" />
        </linearGradient>
        <filter id={shadeId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.5" floodColor={c} floodOpacity="0.28" />
        </filter>
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="9"
        fill={`url(#${plateId})`}
        stroke={c}
        strokeOpacity="0.16"
      />
      <g filter={`url(#${shadeId})`}>{children({ glyph: `url(#${glyphId})`, tint: c })}</g>
    </svg>
  );
}

/* ---------------------------------------------------------------- portfolio */

/** Companies — three towers at three depths, the tallest in front. */
export function KpiIconCompanies({ tint = 'accent', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <path
            d="M8.2 23.4v-8.6c0-.6.4-1 1-1h3.4c.5 0 1 .4 1 1v8.6z"
            fill={c}
            fillOpacity="0.42"
          />
          <path d="M19.4 23.4v-6.9c0-.5.4-1 1-1h2.4c.5 0 1 .5 1 1v6.9z" fill={c} fillOpacity="0.6" />
          <path d="M13 23.4V9.7c0-.7.5-1.2 1.2-1.2h4.4c.7 0 1.2.5 1.2 1.2v13.7z" fill={glyph} />
          <rect x="7.4" y="23" width="17.2" height="1.5" rx="0.75" fill={c} fillOpacity="0.3" />
        </>
      )}
    </Plate>
  );
}

/** Readiness / response rate — a filled arc against its own empty track. */
export function KpiIconGauge({ tint = 'accent', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <path
            d="M9.2 20.8a6.8 6.8 0 0 1 13.6 0"
            fill="none"
            stroke={c}
            strokeOpacity="0.28"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M9.2 20.8a6.8 6.8 0 0 1 10.2-5.9"
            fill="none"
            stroke={glyph}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M16 20.8l3.5-4.1"
            fill="none"
            stroke={c}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="16" cy="20.9" r="2" fill={glyph} />
          <circle cx="16" cy="20.9" r="0.75" fill={CUT} fillOpacity="0.85" />
        </>
      )}
    </Plate>
  );
}

/** MVP / direction — a compass ring with a two-tone needle. */
export function KpiIconCompass({ tint = 'info', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <circle cx="16" cy="16" r="7.3" fill={c} fillOpacity="0.16" />
          <circle cx="16" cy="16" r="7.3" fill="none" stroke={glyph} strokeWidth="1.8" />
          <path d="M20.1 11.9l-2.2 5.3-5.3 2.2 2.2-5.3z" fill={glyph} />
          <path d="M20.1 11.9l-2.2 5.3-2-1.1z" fill={CUT} fillOpacity="0.55" />
        </>
      )}
    </Plate>
  );
}

/** Jobs — a case with a raised lid band and a cut-out clasp. */
export function KpiIconJobs({ tint = 'accent', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <path
            d="M12.8 12.2v-1.1c0-1 .8-1.8 1.8-1.8h2.8c1 0 1.8.8 1.8 1.8v1.1"
            fill="none"
            stroke={c}
            strokeOpacity="0.6"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <rect x="7.8" y="12.4" width="16.4" height="11" rx="2.6" fill={glyph} />
          <rect x="7.8" y="16.5" width="16.4" height="1.5" fill={c} fillOpacity="0.26" />
          <rect x="14.5" y="16" width="3" height="2.6" rx="0.9" fill={CUT} fillOpacity="0.8" />
        </>
      )}
    </Plate>
  );
}

/** Revenue-active — three ascending columns, front-most at full strength. */
export function KpiIconGrowth({ tint = 'success', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <rect x="8" y="18" width="4.2" height="5.6" rx="1.4" fill={c} fillOpacity="0.4" />
          <rect x="13.9" y="14.6" width="4.2" height="9" rx="1.4" fill={c} fillOpacity="0.6" />
          <rect x="19.8" y="10.4" width="4.2" height="13.2" rx="1.4" fill={glyph} />
          <path
            d="M9.4 13.4l4.8-3.2 3.2 1.9 4.6-3.5"
            fill="none"
            stroke={c}
            strokeOpacity="0.5"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Plate>
  );
}

const SHIELD = 'M16 8.2l6.2 2.3v5.1c0 3.8-2.5 6.8-6.2 8.1-3.7-1.3-6.2-4.3-6.2-8.1v-5.1z';

/** Investor-ready — a shield with a cut-out check. */
export function KpiIconShieldCheck({ tint = 'success', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <path d={SHIELD} fill={glyph} />
          <path d="M16 8.2l6.2 2.3v5.1c0 .3 0 .5 0 .8H16z" fill={c} fillOpacity="0.18" />
          <path
            d="M12.9 16.1l2.2 2.2 4.1-4.4"
            fill="none"
            stroke={CUT}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Plate>
  );
}

/** Key-person risk — the same shield, warning tint, a cut-out alert mark. */
export function KpiIconShieldAlert({ tint = 'warning', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <path d={SHIELD} fill={glyph} />
          <path d="M16 8.2l6.2 2.3v5.1c0 .3 0 .5 0 .8H16z" fill={c} fillOpacity="0.18" />
          <rect x="15.1" y="12.4" width="1.8" height="5.2" rx="0.9" fill={CUT} />
          <circle cx="16" cy="19.6" r="1.05" fill={CUT} />
        </>
      )}
    </Plate>
  );
}

/* --------------------------------------------------------------- operations */

/** Teams / mentors — two figures, the rear one recessed. */
export function KpiIconPeople({ tint = 'accent', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <circle cx="20.6" cy="13.2" r="2.6" fill={c} fillOpacity="0.42" />
          <path
            d="M15.4 22.6c.3-2.9 2.5-4.9 5.2-4.9s4.9 2 5.2 4.9z"
            fill={c}
            fillOpacity="0.42"
          />
          <circle cx="13.4" cy="12.8" r="3.4" fill={glyph} />
          <path d="M7.2 23.4c0-3.5 2.8-6.1 6.2-6.1s6.2 2.6 6.2 6.1z" fill={glyph} />
        </>
      )}
    </Plate>
  );
}

/** Forms — a sheet with a folded corner and two cut-out rules. */
export function KpiIconForms({ tint = 'info', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <path
            d="M9.6 10.4c0-1.1.9-2 2-2h5.6l5.2 5.2v7.9c0 1.1-.9 2-2 2h-8.8c-1.1 0-2-.9-2-2z"
            fill={glyph}
          />
          <path d="M17.2 8.4l5.2 5.2h-3.8a1.4 1.4 0 0 1-1.4-1.4z" fill={c} fillOpacity="0.5" />
          <rect x="12.2" y="15.6" width="7.6" height="1.5" rx="0.75" fill={CUT} fillOpacity="0.85" />
          <rect x="12.2" y="18.6" width="5.2" height="1.5" rx="0.75" fill={CUT} fillOpacity="0.6" />
        </>
      )}
    </Plate>
  );
}

/** Submissions — a tray, with the front lip cut out of it. */
export function KpiIconInbox({ tint = 'accent', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <path
            d="M8.4 17.2l2.3-5.7c.3-.8 1-1.3 1.9-1.3h6.8c.9 0 1.6.5 1.9 1.3l2.3 5.7v3.8c0 1.3-1 2.3-2.3 2.3H10.7c-1.3 0-2.3-1-2.3-2.3z"
            fill={glyph}
          />
          <path
            d="M8.4 17.2h4.3l1 2h4.6l1-2h4.3"
            fill="none"
            stroke={CUT}
            strokeOpacity="0.88"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10.7 11.5c.3-.8 1-1.3 1.9-1.3h6.8c.9 0 1.6.5 1.9 1.3z" fill={c} fillOpacity="0.2" />
        </>
      )}
    </Plate>
  );
}

/** Pending review — a board with a raised clip and a cut-out check. */
export function KpiIconClipboardCheck({ tint = 'warning', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <rect x="9.2" y="9.8" width="13.6" height="13.8" rx="2.8" fill={glyph} />
          <rect x="9.2" y="9.8" width="13.6" height="3.2" fill={c} fillOpacity="0.22" />
          <rect x="13.1" y="8" width="5.8" height="3.6" rx="1.5" fill={CUT} fillOpacity="0.85" />
          <path
            d="M12.9 17.6l2.2 2.2 4.1-4.4"
            fill="none"
            stroke={CUT}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Plate>
  );
}

/* -------------------------------------------------------------- mentorship */

/** Completed sessions — a calendar plate with a cut-out check. */
export function KpiIconCalendarCheck({ tint = 'success', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <rect x="8.4" y="10.2" width="15.2" height="13.4" rx="2.8" fill={glyph} />
          <rect x="8.4" y="10.2" width="15.2" height="4.2" fill={c} fillOpacity="0.24" />
          <rect x="11.9" y="7.6" width="1.8" height="4.2" rx="0.9" fill={c} fillOpacity="0.7" />
          <rect x="18.3" y="7.6" width="1.8" height="4.2" rx="0.9" fill={c} fillOpacity="0.7" />
          <path
            d="M12.7 18.4l2.3 2.3 4.3-4.6"
            fill="none"
            stroke={CUT}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Plate>
  );
}

/** Mentoring hours — a dial with cut-out hands. */
export function KpiIconClock({ tint = 'info', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <circle cx="16" cy="16" r="7.4" fill={glyph} />
          <path d="M16 8.6a7.4 7.4 0 0 1 7.4 7.4H16z" fill={c} fillOpacity="0.16" />
          <path
            d="M16 11.7V16l3.1 1.9"
            fill="none"
            stroke={CUT}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Plate>
  );
}

/** Canceled sessions — a disc with a cut-out cross. */
export function KpiIconCanceled({ tint = 'danger', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <circle cx="16" cy="16" r="7.4" fill={glyph} />
          <path d="M16 8.6a7.4 7.4 0 0 1 7.4 7.4H16z" fill={c} fillOpacity="0.16" />
          <path
            d="M13.3 13.3l5.4 5.4M18.7 13.3l-5.4 5.4"
            fill="none"
            stroke={CUT}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </>
      )}
    </Plate>
  );
}

/** Rescheduled sessions — an open loop closed by an arrowhead. */
export function KpiIconRescheduled({ tint = 'warning', className }: KpiIconProps) {
  return (
    <Plate tint={tint} className={className}>
      {({ glyph, tint: c }) => (
        <>
          <circle cx="16" cy="16" r="6.6" fill="none" stroke={c} strokeOpacity="0.22" strokeWidth="2.6" />
          <path
            d="M19.3 10.28A6.6 6.6 0 1 1 12.7 10.28"
            fill="none"
            stroke={glyph}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path d="M14.4 9.3l-1 2.5-1.9-3.1z" fill={glyph} />
        </>
      )}
    </Plate>
  );
}
