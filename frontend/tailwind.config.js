/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#020617',
        card: '#0f172a',
        border: '#1e293b',
        teal: { DEFAULT: '#14b8a6', dark: '#0d9488' },
        accent: {
          blue: '#3b82f6',
          amber: '#f59e0b',
          purple: '#a855f7',
          red: '#ef4444',
          teal: '#14b8a6',
        },
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'fade-up': 'fade-up 0.4s ease-out forwards',
        'slide-in': 'slide-in 0.3s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'dot-bounce': 'dot-bounce 1.4s ease-in-out infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.05)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'glow': {
          from: { boxShadow: '0 0 8px rgba(20,184,166,0.3)' },
          to: { boxShadow: '0 0 24px rgba(20,184,166,0.7)' },
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      boxShadow: {
        'teal-glow': '0 0 20px rgba(20,184,166,0.25)',
        'blue-glow': '0 0 20px rgba(59,130,246,0.25)',
        'amber-glow': '0 0 20px rgba(245,158,11,0.25)',
      },
    },
  },
  plugins: [],
}
