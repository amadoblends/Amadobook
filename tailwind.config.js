/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['attribute', '[data-theme="dark"]'],
  theme: {
    extend: {
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
      },

      // ── Brand colors ────────────────────────────────────────────────
      colors: {
        // Orange accent — same in both themes
        accent: {
          DEFAULT: '#FF6B1A',
          50:  '#FFF3EC',
          100: '#FFE4D0',
          200: '#FFCAAA',
          300: '#FFA876',
          400: '#FF8543',
          500: '#FF6B1A',
          600: '#E85500',
          700: '#C24700',
          800: '#9B3A00',
          900: '#7A2E00',
        },
        // Neutral scale — used for light mode cards, borders, text
        neutral: {
          0:   '#FFFFFF',
          50:  '#F9F9F7',
          100: '#F2F2EF',
          150: '#EBEBЕ8',
          200: '#E4E4E1',
          300: '#D1D1CE',
          400: '#9E9E9B',
          500: '#6E6E6B',
          600: '#4B4B48',
          700: '#333331',
          800: '#1F1F1E',
          900: '#111110',
        },
        // Status colors
        green: {
          DEFAULT: '#16A34A',
          light:   '#DCFCE7',
          dark:    '#22C55E',
        },
        red: {
          DEFAULT: '#DC2626',
          light:   '#FEE2E2',
          dark:    '#EF4444',
        },
        amber: {
          DEFAULT: '#D97706',
          light:   '#FEF3C7',
        },
        purple: {
          DEFAULT: '#7C3AED',
          light:   '#EDE9FE',
        },
      },

      // ── Typography ──────────────────────────────────────────────────
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', '"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Syne', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        'xs':  ['11px', { lineHeight: '16px' }],
        'sm':  ['13px', { lineHeight: '18px' }],
        'base':['14px', { lineHeight: '20px' }],
        'md':  ['15px', { lineHeight: '22px' }],
        'lg':  ['17px', { lineHeight: '24px' }],
        'xl':  ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
      },
      fontWeight: {
        normal:   '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
        extrabold:'800',
        black:    '900',
      },

      // ── Spacing ─────────────────────────────────────────────────────
      spacing: {
        '4.5': '18px',
        '5.5': '22px',
        '13':  '52px',
        '15':  '60px',
        '18':  '72px',
        '22':  '88px',
      },

      // ── Border radius ───────────────────────────────────────────────
      borderRadius: {
        'sm':  '6px',
        DEFAULT:'8px',
        'md':  '10px',
        'lg':  '12px',
        'xl':  '14px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
        '5xl': '32px',
        'full':'9999px',
      },

      // ── Shadows — key for the light mode card feel ──────────────────
      boxShadow: {
        // Light mode — visible card shadows
        'card':   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md':'0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        'card-lg':'0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
        // Accent glow
        'accent':    '0 4px 14px rgba(255,107,26,0.35)',
        'accent-sm': '0 2px 8px rgba(255,107,26,0.25)',
        'accent-lg': '0 8px 28px rgba(255,107,26,0.45)',
        // Dark mode
        'dark-card': '0 1px 3px rgba(0,0,0,0.3)',
        // Inner
        'inner-sm':  'inset 0 1px 2px rgba(0,0,0,0.06)',
      },

      // ── Max widths ──────────────────────────────────────────────────
      maxWidth: {
        content: '520px',
        barber:  '720px',
        modal:   '400px',
      },

      // ── Z-index ─────────────────────────────────────────────────────
      zIndex: {
        'nav':    '40',
        'fab':    '45',
        'header': '50',
        'drawer': '70',
        'modal':  '80',
        'toast':  '90',
      },

      // ── Animation ───────────────────────────────────────────────────
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)'  },
          '100%': { opacity: '1', transform: 'translateY(0)'     },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)'      },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(100%)'  },
          '100%': { opacity: '1', transform: 'translateX(0)'      },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)'  },
          '100%': { opacity: '1', transform: 'translateY(0)'      },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.85)'       },
          '60%':  {               transform: 'scale(1.04)'        },
          '100%': { opacity: '1', transform: 'scale(1)'           },
        },
        spin: {
          '100%': { transform: 'rotate(360deg)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1'   },
          '50%':      { opacity: '0.3' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
      animation: {
        'fade-up':        'fadeUp 0.22s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':        'fadeIn 0.18s ease both',
        'slide-in-left':  'slideInLeft 0.26s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-right': 'slideInRight 0.26s cubic-bezier(0.22,1,0.36,1) both',
        'slide-up':       'slideUp 0.22s cubic-bezier(0.22,1,0.36,1) both',
        'pop-in':         'popIn 0.28s cubic-bezier(0.22,1,0.36,1) both',
        'spin':           'spin 0.65s linear infinite',
        'pulse':          'pulse 2s ease infinite',
        'shimmer':        'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
