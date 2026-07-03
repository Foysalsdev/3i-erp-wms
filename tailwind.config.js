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
          50: '#fff8e6', 100: '#fdebbf', 200: '#fadb8f', 300: '#f6c654',
          400: '#f4b72a', 500: '#f2a900', 600: '#d08f00', 700: '#a66f00',
          800: '#7c5300', 900: '#5a3c00', 950: '#3a2700'
        },
        coal: {
          50: '#f6f6f6', 100: '#e9e9e9', 200: '#cfcfcf', 300: '#a8a8a8',
          400: '#6f6f6f', 500: '#4a4a4a', 600: '#333333', 700: '#262626',
          800: '#1b1b1b', 900: '#121212', 950: '#0a0a0a'
        },
        accent: { 50: '#fff8e6', 100: '#fdebbf', 200: '#fadb8f', 300: '#f6c654', 400: '#f4b72a', 500: '#f2a900', 600: '#d08f00', 700: '#a66f00' },
        ink: { DEFAULT: v('--ink'), soft: v('--ink-soft'), faint: v('--ink-faint') },
        surface: { DEFAULT: v('--surface'), sunken: v('--bg-sunken'), line: v('--line') },
        sidebar: { DEFAULT: v('--sidebar'), fg: v('--sidebar-fg'), muted: v('--sidebar-muted'), active: v('--sidebar-active'), activefg: v('--sidebar-active-fg') },
        ok: '#16a34a', warn: '#ea7a0c', bad: '#dc2626', info: '#d08f00',
        horizon: { bg: v('--bg-sunken'), surface: v('--surface'), line: v('--line'), text: v('--ink'),
          muted: v('--ink-soft'), accent: '#d08f00', positive: '#16a34a', critical: '#ea7a0c', negative: '#dc2626', info: '#d08f00' }
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
        glow: '0 4px 14px -4px rgba(242,169,0,0.4)',
        fiori: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.08)',
        'fiori-lg': '0 4px 10px -2px rgba(0,0,0,0.08), 0 16px 32px -12px rgba(0,0,0,0.22)'
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg, #f4b72a 0%, #f2a900 55%, #d08f00 100%)',
        'accent-grad': 'linear-gradient(135deg, #f2a900 0%, #f6c654 100%)'
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'pulse-ring': { '0%, 100%': { boxShadow: '0 0 0 0 rgba(242,169,0,0.45)' }, '50%': { boxShadow: '0 0 0 6px rgba(242,169,0,0)' } }
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.2,.7,.3,1) both',
        'pulse-ring': 'pulse-ring 1.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
