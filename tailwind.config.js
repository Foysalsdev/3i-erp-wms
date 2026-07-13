/** @type {import('tailwindcss').Config} */
// Whirlpool brand: gold accent + white/charcoal. Theme-aware via CSS variables (light & dark).
const v = (name) => `rgb(var(${name}) / <alpha-value>)`
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fefaf1', 100: '#fcf1d4', 200: '#f9e1a5', 300: '#f5d070',
          400: '#f1bf3c', 500: '#eeb111', 600: '#cd980f', 700: '#a77c0c',
          800: '#816009', 900: '#5a4306', 950: '#3e2e04'
        },
        coal: {
          50: '#f6f6f6', 100: '#e9e9e9', 200: '#cfcfcf', 300: '#a8a8a8',
          400: '#6f6f6f', 500: '#4a4a4a', 600: '#373737', 700: '#262626',
          800: '#1b1b1b', 900: '#121212', 950: '#0a0a0a'
        },
        accent: { 50: '#fefaf1', 100: '#fcf1d4', 200: '#f9e1a5', 300: '#f5d070', 400: '#f1bf3c', 500: '#eeb111', 600: '#cd980f', 700: '#a77c0c' },
        ink: { DEFAULT: v('--ink'), soft: v('--ink-soft'), faint: v('--ink-faint') },
        surface: { DEFAULT: v('--surface'), sunken: v('--bg-sunken'), line: v('--line') },
        sidebar: { DEFAULT: v('--sidebar'), fg: v('--sidebar-fg'), muted: v('--sidebar-muted'), active: v('--sidebar-active'), activefg: v('--sidebar-active-fg') },
        ok: '#16a34a', warn: '#ea7a0c', bad: '#dc2626', info: '#a77c0c',
        horizon: { bg: v('--bg-sunken'), surface: v('--surface'), line: v('--line'), text: v('--ink'),
          muted: v('--ink-soft'), accent: '#a77c0c', positive: '#16a34a', critical: '#ea7a0c', negative: '#dc2626', info: '#a77c0c' }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif']
      },
      // Crisp Linear/Notion-style geometry: tighter radii, quiet layered shadows.
      borderRadius: { xl: '10px', '2xl': '12px', '3xl': '16px', card: '10px' },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.05)',
        card: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.08)',
        pop: '0 4px 10px -2px rgba(0,0,0,0.08), 0 16px 32px -12px rgba(0,0,0,0.22)',
        glow: '0 4px 14px -4px rgba(238,177,17,0.4)',
        fiori: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.08)',
        'fiori-lg': '0 4px 10px -2px rgba(0,0,0,0.08), 0 16px 32px -12px rgba(0,0,0,0.22)'
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg, #f1bf3c 0%, #eeb111 55%, #cd980f 100%)',
        'accent-grad': 'linear-gradient(135deg, #eeb111 0%, #f5d070 100%)'
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'pulse-ring': { '0%, 100%': { boxShadow: '0 0 0 0 rgba(238,177,17,0.45)' }, '50%': { boxShadow: '0 0 0 6px rgba(238,177,17,0)' } }
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.2,.7,.3,1) both',
        'pulse-ring': 'pulse-ring 1.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
