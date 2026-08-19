'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

/**
 * A floating label for controls that lose their text — the collapsed sidebar
 * rail, mainly. A bare `title` attribute is not enough there: it is invisible
 * to keyboard focus and unstyleable.
 *
 * The provider is local to each tooltip so callers do not have to remember to
 * mount one at the root.
 */
export function Tooltip({
  label,
  side = 'right',
  children,
  delay = 250,
}: {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delay} skipDelayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            className={cn(
              'z-50 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-lift',
              'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
              'duration-150 motion-reduce:animate-none',
            )}
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
