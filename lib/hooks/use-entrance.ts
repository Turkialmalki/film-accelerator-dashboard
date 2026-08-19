'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A one-shot entrance gate, built on the same guard `useCountUp` uses.
 *
 * It is `true` only for the first `duration` ms after the component's first
 * render, and `false` for the rest of the component's life. That matters for
 * Recharts: `isAnimationActive` re-runs the draw-in every time the series is
 * re-created, so leaving it permanently `true` makes the chart replay its
 * entrance on a hover, a data refresh, or a theme change. Flipping it back to
 * `false` once the entrance has played pins the chart in its final state.
 *
 * Under `prefers-reduced-motion` it never turns on at all.
 */
export function useEntranceOnce(duration = 700): { animate: boolean; duration: number } {
  const [animate, setAnimate] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    setAnimate(true);
    const id = window.setTimeout(() => setAnimate(false), duration + 150);
    return () => window.clearTimeout(id);
  }, [duration]);

  return { animate, duration };
}
