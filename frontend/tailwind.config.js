/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zeta: {
          bg: '#f8fafc',
          card: '#ffffff',
          cardHover: '#f8fafc',
          border: '#e2e8f0',
          blue: '#2563eb',
          neon: '#0284c7',
          live: '#ef4444',
          gold: '#d97706',
          green: '#16a34a',
          muted: '#64748b',
          dark: '#ffffff'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        'glow-blue': '0 4px 14px 0 rgba(37, 99, 235, 0.15)',
        'glow-neon': '0 4px 14px 0 rgba(2, 132, 199, 0.15)',
        'glow-live': '0 2px 10px 0 rgba(239, 68, 68, 0.25)'
      }
    },
  },
  plugins: [],
}
