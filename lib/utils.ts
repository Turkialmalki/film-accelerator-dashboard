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

/** Stable, dependency-free id for client-side entity creation. */
export function uid(prefix: string): string {
  const rand =
    typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Replaces `{key}` placeholders in a dictionary string with the given values. */
export function fmtTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
