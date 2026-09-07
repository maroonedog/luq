/**
 * Tailwind is wired to the Material Design 3 token layer in src/styles/.
 *
 * Colour utilities resolve to `rgb(var(--md-sys-color-<role>-rgb) / <alpha-value>)`,
 * so `bg-primary`, `text-on-surface-variant` and opacity modifiers such as
 * `bg-on-surface/8` (an MD3 state layer) all work and both schemes follow the
 * `.dark` class without a single `dark:` variant.
 *
 * The legacy `luq.*` scales are kept only so pages that have not been migrated
 * still compile — their hex values are now real tones of the generated MD3
 * palettes (src/styles/md3-palette.json), not a second hand-kept palette.
 *
 * @type {import('tailwindcss').Config}
 */

const md3Palette = require('./src/styles/md3-palette.json');

/** MD3 system colour role -> Tailwind colour value. */
const role = (name) => `rgb(var(--md-sys-color-${name}-rgb) / <alpha-value>)`;

/** Tailwind's 50..950 ramp expressed as MD3 tones (light -> dark). */
const brandRamp = { 50: 95, 100: 90, 200: 80, 300: 70, 400: 60, 500: 50, 600: 40, 700: 30, 800: 20, 900: 12, 950: 6 };
const neutralRamp = { 50: 96, 100: 94, 200: 90, 300: 80, 400: 70, 500: 50, 600: 40, 700: 30, 800: 22, 900: 12, 950: 6 };

const rampFrom = (paletteName, ramp) =>
  Object.fromEntries(
    Object.entries(ramp).map(([step, tone]) => [step, md3Palette.tones[paletteName][tone]])
  );

/** MD3 type scale: [size, { lineHeight, letterSpacing, fontWeight }]. */
const typeScale = {
  'display-large': ['57px', { lineHeight: '64px', letterSpacing: '-0.25px', fontWeight: '400' }],
  'display-medium': ['45px', { lineHeight: '52px', letterSpacing: '0px', fontWeight: '400' }],
  'display-small': ['36px', { lineHeight: '44px', letterSpacing: '0px', fontWeight: '400' }],
  'headline-large': ['32px', { lineHeight: '40px', letterSpacing: '0px', fontWeight: '400' }],
  'headline-medium': ['28px', { lineHeight: '36px', letterSpacing: '0px', fontWeight: '400' }],
  'headline-small': ['24px', { lineHeight: '32px', letterSpacing: '0px', fontWeight: '400' }],
  'title-large': ['22px', { lineHeight: '28px', letterSpacing: '0px', fontWeight: '400' }],
  'title-medium': ['16px', { lineHeight: '24px', letterSpacing: '0.15px', fontWeight: '500' }],
  'title-small': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
  'body-large': ['16px', { lineHeight: '24px', letterSpacing: '0.5px', fontWeight: '400' }],
  'body-medium': ['14px', { lineHeight: '20px', letterSpacing: '0.25px', fontWeight: '400' }],
  'body-small': ['12px', { lineHeight: '16px', letterSpacing: '0.4px', fontWeight: '400' }],
  'label-large': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
  'label-medium': ['12px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
  'label-small': ['11px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
};

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: role('primary'),
        'on-primary': role('on-primary'),
        'primary-container': role('primary-container'),
        'on-primary-container': role('on-primary-container'),
        'inverse-primary': role('inverse-primary'),

        secondary: role('secondary'),
        'on-secondary': role('on-secondary'),
        'secondary-container': role('secondary-container'),
        'on-secondary-container': role('on-secondary-container'),

        tertiary: role('tertiary'),
        'on-tertiary': role('on-tertiary'),
        'tertiary-container': role('tertiary-container'),
        'on-tertiary-container': role('on-tertiary-container'),

        error: role('error'),
        'on-error': role('on-error'),
        'error-container': role('error-container'),
        'on-error-container': role('on-error-container'),

        background: role('background'),
        'on-background': role('on-background'),
        surface: role('surface'),
        'on-surface': role('on-surface'),
        'surface-variant': role('surface-variant'),
        'on-surface-variant': role('on-surface-variant'),
        'surface-dim': role('surface-dim'),
        'surface-bright': role('surface-bright'),
        'surface-container-lowest': role('surface-container-lowest'),
        'surface-container-low': role('surface-container-low'),
        'surface-container': role('surface-container'),
        'surface-container-high': role('surface-container-high'),
        'surface-container-highest': role('surface-container-highest'),

        outline: role('outline'),
        'outline-variant': role('outline-variant'),
        'inverse-surface': role('inverse-surface'),
        'inverse-on-surface': role('inverse-on-surface'),
        scrim: role('scrim'),
        shadow: role('shadow'),

        // Code blocks keep a dark surface in both schemes; see md3-tokens.css.
        'code-surface': 'var(--md-code-surface)',
        'code-outline': 'var(--md-code-outline)',
        'on-code-surface': 'var(--md-code-on-surface)',

        // Legacy — migrate to the roles above. Values are MD3 palette tones.
        luq: {
          purple: rampFrom('primary', brandRamp),
          teal: rampFrom('tertiary', brandRamp),
          neutral: rampFrom('neutral', neutralRamp),
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'],
      },
      fontSize: typeScale,
      borderRadius: {
        'shape-none': 'var(--md-sys-shape-corner-none)',
        'shape-xs': 'var(--md-sys-shape-corner-extra-small)',
        'shape-sm': 'var(--md-sys-shape-corner-small)',
        'shape-md': 'var(--md-sys-shape-corner-medium)',
        'shape-lg': 'var(--md-sys-shape-corner-large)',
        'shape-xl': 'var(--md-sys-shape-corner-extra-large)',
        'shape-full': 'var(--md-sys-shape-corner-full)',
      },
      boxShadow: {
        'elevation-0': 'var(--md-sys-elevation-level0)',
        'elevation-1': 'var(--md-sys-elevation-level1)',
        'elevation-2': 'var(--md-sys-elevation-level2)',
        'elevation-3': 'var(--md-sys-elevation-level3)',
        'elevation-4': 'var(--md-sys-elevation-level4)',
        'elevation-5': 'var(--md-sys-elevation-level5)',
      },
      opacity: {
        'state-hover': '0.08',
        'state-focus': '0.10',
        'state-pressed': '0.10',
        'state-dragged': '0.16',
      },
      transitionTimingFunction: {
        standard: 'var(--md-sys-motion-easing-standard)',
        'standard-accelerate': 'var(--md-sys-motion-easing-standard-accelerate)',
        'standard-decelerate': 'var(--md-sys-motion-easing-standard-decelerate)',
        emphasized: 'var(--md-sys-motion-easing-emphasized)',
        'emphasized-accelerate': 'var(--md-sys-motion-easing-emphasized-accelerate)',
        'emphasized-decelerate': 'var(--md-sys-motion-easing-emphasized-decelerate)',
      },
      transitionDuration: {
        'short-1': '50ms',
        'short-2': '100ms',
        'short-3': '150ms',
        'short-4': '200ms',
        'medium-1': '250ms',
        'medium-2': '300ms',
        'medium-3': '350ms',
        'medium-4': '400ms',
        'long-1': '450ms',
        'long-2': '500ms',
        'long-3': '550ms',
        'long-4': '600ms',
      },
      keyframes: {
        'md-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'md-slide-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // Legacy keyframes referenced by not-yet-migrated pages.
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        particle1: {
          '0%': { opacity: '0', transform: 'translate(-50%, 0) scale(0)' },
          '50%': { opacity: '1', transform: 'translate(-50%, -30px) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -60px) scale(0)' },
        },
        particle2: {
          '0%': { opacity: '0', transform: 'translate(0, -50%) scale(0)' },
          '50%': { opacity: '1', transform: 'translate(30px, -50%) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(60px, -50%) scale(0)' },
        },
        particle3: {
          '0%': { opacity: '0', transform: 'translate(-50%, 0) scale(0)' },
          '50%': { opacity: '1', transform: 'translate(-50%, 30px) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, 60px) scale(0)' },
        },
        particle4: {
          '0%': { opacity: '0', transform: 'translate(0, -50%) scale(0)' },
          '50%': { opacity: '1', transform: 'translate(-30px, -50%) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-60px, -50%) scale(0)' },
        },
      },
      animation: {
        'md-fade-in':
          'md-fade-in var(--md-sys-motion-duration-medium-2) var(--md-sys-motion-easing-emphasized-decelerate) both',
        'md-slide-up':
          'md-slide-up var(--md-sys-motion-duration-medium-4) var(--md-sys-motion-easing-emphasized-decelerate) both',
        float: 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'particle-1': 'particle1 1.5s ease-out forwards',
        'particle-2': 'particle2 1.5s ease-out 0.2s forwards',
        'particle-3': 'particle3 1.5s ease-out 0.4s forwards',
        'particle-4': 'particle4 1.5s ease-out 0.6s forwards',
      },
      backgroundImage: {
        // Legacy: the 1.x brand gradient, now spanning MD3 primary -> tertiary.
        'luq-gradient':
          'linear-gradient(135deg, var(--md-sys-color-primary) 0%, var(--md-sys-color-tertiary) 100%)',
      },
      typography: () => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--md-sys-color-on-surface-variant)',
            '--tw-prose-headings': 'var(--md-sys-color-on-surface)',
            '--tw-prose-lead': 'var(--md-sys-color-on-surface-variant)',
            '--tw-prose-links': 'var(--md-sys-color-primary)',
            '--tw-prose-bold': 'var(--md-sys-color-on-surface)',
            '--tw-prose-counters': 'var(--md-sys-color-on-surface-variant)',
            '--tw-prose-bullets': 'var(--md-sys-color-outline)',
            '--tw-prose-hr': 'var(--md-sys-color-outline-variant)',
            '--tw-prose-quotes': 'var(--md-sys-color-on-surface)',
            '--tw-prose-quote-borders': 'var(--md-sys-color-primary)',
            '--tw-prose-captions': 'var(--md-sys-color-on-surface-variant)',
            '--tw-prose-code': 'var(--md-sys-color-on-surface)',
            '--tw-prose-pre-code': 'var(--md-code-on-surface)',
            '--tw-prose-pre-bg': 'var(--md-code-surface)',
            '--tw-prose-th-borders': 'var(--md-sys-color-outline)',
            '--tw-prose-td-borders': 'var(--md-sys-color-outline-variant)',
            // The typography plugin ships its own scale (h2 at 1.5em/700, body
            // at 1em of a 16-20px root) and it is NOT the MD3 scale. Measured
            // before this block: the five pages wrapping their body in `.prose`
            // rendered h2 at 30px/700 and paragraphs at 18px, while the eight
            // pages that do not rendered h2 at 24px/400 and paragraphs at 16px.
            // Two type systems on one site. The colours were already mapped to
            // MD3 roles above; these map the metrics, so `.prose` keeps the
            // plugin's spacing and inherits the site's type.
            fontSize: 'var(--md-sys-typescale-body-large-size)',
            lineHeight: 'var(--md-sys-typescale-body-large-line-height)',
            letterSpacing: 'var(--md-sys-typescale-body-large-tracking)',
            p: {
              fontSize: 'var(--md-sys-typescale-body-large-size)',
              lineHeight: 'var(--md-sys-typescale-body-large-line-height)',
              letterSpacing: 'var(--md-sys-typescale-body-large-tracking)',
              fontWeight: 'var(--md-sys-typescale-body-large-weight)',
            },
            'li, td, th': {
              fontSize: 'var(--md-sys-typescale-body-large-size)',
              lineHeight: 'var(--md-sys-typescale-body-large-line-height)',
              letterSpacing: 'var(--md-sys-typescale-body-large-tracking)',
            },
            h1: {
              fontSize: 'var(--md-sys-typescale-headline-large-size)',
              lineHeight: 'var(--md-sys-typescale-headline-large-line-height)',
              fontWeight: 'var(--md-sys-typescale-headline-large-weight)',
              letterSpacing: 'var(--md-sys-typescale-headline-large-tracking)',
            },
            h2: {
              fontSize: 'var(--md-sys-typescale-headline-small-size)',
              lineHeight: 'var(--md-sys-typescale-headline-small-line-height)',
              fontWeight: 'var(--md-sys-typescale-headline-small-weight)',
              letterSpacing: 'var(--md-sys-typescale-headline-small-tracking)',
            },
            h3: {
              fontSize: 'var(--md-sys-typescale-title-large-size)',
              lineHeight: 'var(--md-sys-typescale-title-large-line-height)',
              fontWeight: 'var(--md-sys-typescale-title-large-weight)',
              letterSpacing: 'var(--md-sys-typescale-title-large-tracking)',
            },
            h4: {
              fontSize: 'var(--md-sys-typescale-title-medium-size)',
              lineHeight: 'var(--md-sys-typescale-title-medium-line-height)',
              fontWeight: 'var(--md-sys-typescale-title-medium-weight)',
              letterSpacing: 'var(--md-sys-typescale-title-medium-tracking)',
            },
            code: {
              backgroundColor: 'var(--md-sys-color-surface-container-highest)',
              borderRadius: 'var(--md-sys-shape-corner-extra-small)',
              padding: '0.15em 0.35em',
              fontWeight: '500',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
