import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The approved brand assets, used as supplied. `-light` variants are the
 * knock-out versions for dark grounds.
 *
 * `unoptimized`: these are vector logos served straight from /public — there
 * is no raster to optimize, and Next's image-optimization proxy sniffs SVG
 * buffers unreliably (some of these files 400 through it even though they
 * are valid SVG served directly). Skipping the proxy is the standard fix.
 */

export function FbaLockup({
  variant = 'dark',
  className,
}: {
  variant?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <Image
      src={variant === 'light' ? '/brand/fba-lockup-light.svg' : '/brand/fba-lockup.svg'}
      alt="Film Business Accelerator"
      width={220}
      height={64}
      priority
      unoptimized
      className={cn('h-10 w-auto', className)}
    />
  );
}

export function FbaMark({
  variant = 'dark',
  className,
}: {
  variant?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <Image
      src={variant === 'light' ? '/brand/fba-mark-light.svg' : '/brand/fba-mark.svg'}
      alt=""
      aria-hidden
      width={32}
      height={38}
      unoptimized
      className={cn('h-7 w-auto', className)}
    />
  );
}

export function FilmCommissionMark({
  variant = 'dark',
  className,
}: {
  variant?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <Image
      src={variant === 'light' ? '/brand/film-commission-light.svg' : '/brand/film-commission.svg'}
      alt="Film Commission"
      width={140}
      height={40}
      unoptimized
      className={cn('h-7 w-auto', className)}
    />
  );
}
