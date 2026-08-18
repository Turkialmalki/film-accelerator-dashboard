import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The approved brand assets, used as supplied. `-light` variants are the
 * knock-out versions for dark grounds.
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
      className={cn('h-7 w-auto', className)}
    />
  );
}
