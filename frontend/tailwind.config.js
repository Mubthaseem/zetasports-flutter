/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zeta: {
          dark: '#070b13',
          card: '#0c121e',
          cardHover: '#131b2c',
          border: '#1b273d',
          blue: '#00e5ff',
          neon: '#0070f3',
          live: '#ff2d55',
          gold: '#f5a623',
          green: '#00e676',
          muted: '#8091a7'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        'glow-blue': '0 0 20px -3px rgba(0, 229, 255, 0.3)',
        'glow-neon': '0 0 25px -4px rgba(0, 112, 243, 0.35)',
        'glow-live': '0 0 15px 0 rgba(255, 45, 85, 0.4)'
      }
    },
  },
  plugins: [],
}
