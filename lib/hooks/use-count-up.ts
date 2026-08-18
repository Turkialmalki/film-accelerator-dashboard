'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts from 0 to `value` exactly once, the first time a real value arrives.
 * Subsequent changes snap, so a data refresh does not replay the animation.
 * Honours prefers-reduced-motion by skipping straight to the value.
 */
export function useCountUp(value: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const hasRun = useRef(false);
  const frame = useRef<number>();

  useEffect(() => {
    if (hasRun.current) {
      setDisplay(value);
      return;
    }
    if (value === 0) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      hasRun.current = true;
      setDisplay(value);
      return;
    }

    hasRun.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return display;
}
