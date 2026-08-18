import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // All colours resolve through CSS custom properties so the Appearance
        // studio can retint the whole product at runtime.
        canvas: 'var(--c-canvas)',
        surface: 'var(--c-surface)',
        'surface-muted': 'var(--c-surface-muted)',
        line: 'var(--c-line)',
        'line-strong': 'var(--c-line-strong)',
        ink: 'var(--c-ink)',
        'ink-muted': 'var(--c-ink-muted)',
        'ink-subtle': 'var(--c-ink-subtle)',
        accent: 'var(--c-accent)',
        'accent-hover': 'var(--c-accent-hover)',
        'accent-soft': 'var(--c-accent-soft)',
        'accent-ink': 'var(--c-accent-ink)',
        success: 'var(--c-success)',
        warning: 'var(--c-warning)',
        danger: 'var(--c-danger)',
        info: 'var(--c-info)',
      },
      borderRadius: {
        sm: 'calc(var(--r-base) - 6px)',
        md: 'calc(var(--r-base) - 3px)',
        lg: 'var(--r-base)',
        xl: 'calc(var(--r-base) + 6px)',
        '2xl': 'calc(var(--r-base) + 12px)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
