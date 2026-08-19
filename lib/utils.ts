import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Bilingual, Locale } from '@/lib/data/types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Reads a bilingual value, falling back to the other language if empty. */
export function bi(value: Bilingual | undefined | null, locale: Locale): string {
  if (!value) return '';
  const primary = locale === 'ar' ? value.ar : value.en;
  const fallback = locale === 'ar' ? value.en : value.ar;
  return primary || fallback || '';
}

export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB').format(value);
}

export function formatPercent(value: number, locale: Locale): string {
  return `${formatNumber(Math.round(value), locale)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? '').join('') || '؟';
}

/**
 * Client-side id for entities the builder creates before they're saved
 * (new fields, sections, rules, audiences). Must be a real UUID, not a
 * readable `prefix_xxxxxx` string: `saveFields`/`saveSections`/`saveRules`
 * and the audience insert all write this value straight into a Postgres
 * `uuid primary key` column in Supabase mode, and a non-UUID string is
 * rejected outright — which is exactly what silently broke "use this
 * template" and every other real-DB write, since nothing here ever
 * exercised that codepath against a live database before tonight.
 *
 * `prefix` is accepted for call-site compatibility but no longer used —
 * demo mode never depended on the string being readable, only unique.
 */
export function uid(_prefix?: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for an environment without a native UUID generator (should not
  // happen in a browser or modern Node, but fail into something rather than
  // throwing): RFC 4122 v4-shaped, good enough as a primary key value.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
