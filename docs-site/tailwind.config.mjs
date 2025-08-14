/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Luq brand colors - deep purple and teal accent
        luq: {
          purple: {
            50: '#F5F3FF',
            100: '#EDE9FE',
            200: '#DDD6FE',
            300: '#C4B5FD',
            400: '#A78BFA',
            500: '#8B5CF6',
            600: '#7C3AED',
            700: '#6B46C1', // Main brand color
            800: '#553C9A',
            900: '#44337A',
            950: '#2E1065',
          },
          teal: {
            50: '#F0FDFA',
            100: '#CCFBF1',
            200: '#99F6E4',
            300: '#5EEAD4',
            400: '#2DD4BF',
            500: '#14B8A6', // Accent color
            600: '#0D9488',
            700: '#0F766E',
            800: '#115E59',
            900: '#134E4A',
            950: '#042F2E',
          },
          neutral: {
            50: '#FAFAFA',
            100: '#F5F5F5',
            200: '#E5E5E5',
            300: '#D4D4D4',
            400: '#A3A3A3',
            500: '#737373',
            600: '#525252',
            700: '#404040',
            800: '#262626',
            900: '#171717',
            950: '#0A0A0A',
          }
        },
        // Semantic colors
        accent: 'var(--accent)',
        'accent-light': 'var(--accent-light)',
        'accent-dark': 'var(--accent-dark)',
      },
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'Consolas', 'Monaco', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'luq-gradient': 'linear-gradient(135deg, #6B46C1 0%, #14B8A6 100%)',
        'luq-gradient-subtle': 'linear-gradient(135deg, #6B46C1 0%, #7C3AED 50%, #14B8A6 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'particle-1': 'particle1 1.5s ease-out forwards',
        'particle-2': 'particle2 1.5s ease-out 0.2s forwards',
        'particle-3': 'particle3 1.5s ease-out 0.4s forwards',
        'particle-4': 'particle4 1.5s ease-out 0.6s forwards',
      },
      keyframes: {
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
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
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
      boxShadow: {
        'luq': '0 4px 14px 0 rgba(107, 70, 193, 0.15)',
        'luq-hover': '0 8px 24px 0 rgba(107, 70, 193, 0.25)',
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.luq.neutral.700'),
            a: {
              color: theme('colors.luq.purple.600'),
              '&:hover': {
                color: theme('colors.luq.purple.700'),
              },
            },
            code: {
              color: theme('colors.luq.purple.700'),
              backgroundColor: theme('colors.luq.purple.50'),
              padding: '0.2rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: theme('colors.luq.neutral.900'),
              color: theme('colors.luq.neutral.100'),
            },
            h1: {
              color: theme('colors.luq.neutral.900'),
            },
            h2: {
              color: theme('colors.luq.neutral.800'),
            },
            h3: {
              color: theme('colors.luq.neutral.800'),
            },
            h4: {
              color: theme('colors.luq.neutral.700'),
            },
            strong: {
              color: theme('colors.luq.neutral.900'),
            },
            blockquote: {
              borderLeftColor: theme('colors.luq.purple.500'),
              color: theme('colors.luq.neutral.700'),
            },
          },
        },
        dark: {
          css: {
            color: theme('colors.luq.neutral.200'),
            a: {
              color: theme('colors.luq.teal.400'),
              '&:hover': {
                color: theme('colors.luq.teal.300'),
              },
            },
            code: {
              color: theme('colors.luq.teal.300'),
              backgroundColor: theme('colors.luq.neutral.800'),
            },
            pre: {
              backgroundColor: theme('colors.luq.neutral.950'),
              color: theme('colors.luq.neutral.100'),
            },
            h1: {
              color: theme('colors.luq.neutral.100'),
            },
            h2: {
              color: theme('colors.luq.neutral.200'),
            },
            h3: {
              color: theme('colors.luq.neutral.200'),
            },
            h4: {
              color: theme('colors.luq.neutral.300'),
            },
            strong: {
              color: theme('colors.luq.neutral.100'),
            },
            blockquote: {
              borderLeftColor: theme('colors.luq.purple.400'),
              color: theme('colors.luq.neutral.300'),
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}