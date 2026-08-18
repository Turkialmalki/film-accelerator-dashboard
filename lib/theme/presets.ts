import type { Bilingual, ThemePresetKey, ThemeTokens } from '@/lib/data/types';

/**
 * Design tokens. Every one of these is emitted as a CSS custom property on
 * <html>, and Tailwind's colour scale reads those properties — so changing a
 * token here retints the entire product with no rebuild.
 *
 * The default palette is derived from the official Film Business Accelerator
 * brand: navy #0F2837 as ink, slate #4B5E69 as the structural mid-tone and
 * amber #FBAE40 as the single accent (see legacy/assets/css/brand.css).
 */

export interface ThemePreset {
  key: ThemePresetKey;
  name: Bilingual;
  description: Bilingual;
  tokens: ThemeTokens;
}

export const CINEMA_WHITE: ThemeTokens = {
  canvas: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F1EC',
  line: '#E8E3DB',
  lineStrong: '#D6CEC2',
  ink: '#0F2837',
  inkMuted: '#4B5E69',
  inkSubtle: '#87939B',
  accent: '#C8791B',
  accentHover: '#A96313',
  accentSoft: '#FDF1DF',
  accentInk: '#FFFFFF',
  success: '#2F7D62',
  warning: '#B4741A',
  danger: '#B03A31',
  info: '#3C6E8F',
  radius: 16,
  shadowCard: '0 1px 2px rgba(15, 40, 55, 0.04), 0 8px 24px -12px rgba(15, 40, 55, 0.12)',
  shadowLift: '0 2px 4px rgba(15, 40, 55, 0.05), 0 16px 40px -16px rgba(15, 40, 55, 0.18)',
  shadowPop: '0 24px 64px -24px rgba(15, 40, 55, 0.30)',
};

export const MIDNIGHT_SCREENING: ThemeTokens = {
  canvas: '#071119',
  surface: '#0F2837',
  surfaceMuted: '#16394C',
  line: 'rgba(255, 255, 255, 0.10)',
  lineStrong: 'rgba(255, 255, 255, 0.20)',
  ink: '#F4F7F9',
  inkMuted: '#B4C2CC',
  inkSubtle: '#7C8D99',
  accent: '#FBAE40',
  accentHover: '#F89C49',
  accentSoft: 'rgba(251, 174, 64, 0.16)',
  accentInk: '#071119',
  success: '#76B6B7',
  warning: '#FABD96',
  danger: '#F05B4E',
  info: '#8FB8D4',
  radius: 18,
  shadowCard: '0 1px 2px rgba(0, 0, 0, 0.30), 0 12px 32px -16px rgba(0, 0, 0, 0.55)',
  shadowLift: '0 2px 6px rgba(0, 0, 0, 0.35), 0 22px 56px -20px rgba(0, 0, 0, 0.65)',
  shadowPop: '0 28px 72px -28px rgba(0, 0, 0, 0.75)',
};

export const SAND_INK: ThemeTokens = {
  canvas: '#F3EDE3',
  surface: '#FBF8F3',
  surfaceMuted: '#EBE3D6',
  line: '#DED3C2',
  lineStrong: '#C6B79F',
  ink: '#221C14',
  inkMuted: '#5A4E3E',
  inkSubtle: '#8C7E6B',
  accent: '#8A4B2A',
  accentHover: '#6E3A1F',
  accentSoft: '#F0E0D2',
  accentInk: '#FBF8F3',
  success: '#4A6B45',
  warning: '#96661A',
  danger: '#9C3B2E',
  info: '#3F5F73',
  radius: 10,
  shadowCard: '0 1px 2px rgba(34, 28, 20, 0.05), 0 8px 24px -14px rgba(34, 28, 20, 0.20)',
  shadowLift: '0 2px 4px rgba(34, 28, 20, 0.06), 0 18px 44px -18px rgba(34, 28, 20, 0.26)',
  shadowPop: '0 26px 64px -26px rgba(34, 28, 20, 0.34)',
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'cinema_white',
    name: { ar: 'أبيض سينمائي', en: 'Cinema White' },
    description: {
      ar: 'الهوية الافتراضية: عاجي دافئ، أسطح بيضاء، ونبرة كهرمانية واحدة.',
      en: 'The default identity: warm ivory, white surfaces, a single amber note.',
    },
    tokens: CINEMA_WHITE,
  },
  {
    key: 'midnight_screening',
    name: { ar: 'عرض منتصف الليل', en: 'Midnight Screening' },
    description: {
      ar: 'كحلي المسرعة العميق مع الكهرماني الكامل — مناسب للقاعات المظلمة.',
      en: 'The deep programme navy with full amber — built for a dark room.',
    },
    tokens: MIDNIGHT_SCREENING,
  },
  {
    key: 'sand_ink',
    name: { ar: 'رمل وحبر', en: 'Sand & Ink' },
    description: {
      ar: 'ورقي هادئ بزوايا أضيق ونبرة طينية، لطباعة التقارير والعروض.',
      en: 'A calm paper feel with tighter corners and a clay accent, for print-like reports.',
    },
    tokens: SAND_INK,
  },
];

export const PRESET_MAP: Record<ThemePresetKey, ThemePreset> = THEME_PRESETS.reduce(
  (acc, p) => {
    acc[p.key] = p;
    return acc;
  },
  {} as Record<ThemePresetKey, ThemePreset>,
);

/** Maps a token object onto the CSS custom properties the stylesheet reads. */
export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--c-canvas': tokens.canvas,
    '--c-surface': tokens.surface,
    '--c-surface-muted': tokens.surfaceMuted,
    '--c-line': tokens.line,
    '--c-line-strong': tokens.lineStrong,
    '--c-ink': tokens.ink,
    '--c-ink-muted': tokens.inkMuted,
    '--c-ink-subtle': tokens.inkSubtle,
    '--c-accent': tokens.accent,
    '--c-accent-hover': tokens.accentHover,
    '--c-accent-soft': tokens.accentSoft,
    '--c-accent-ink': tokens.accentInk,
    '--c-success': tokens.success,
    '--c-warning': tokens.warning,
    '--c-danger': tokens.danger,
    '--c-info': tokens.info,
    '--r-base': `${tokens.radius}px`,
    '--shadow-card': tokens.shadowCard,
    '--shadow-lift': tokens.shadowLift,
    '--shadow-pop': tokens.shadowPop,
  };
}

export function cssVarsToString(tokens: ThemeTokens): string {
  return Object.entries(tokensToCssVars(tokens))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
