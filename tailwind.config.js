/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nacht: '#0B0E14', // App-Hintergrund
        flaeche: '#131722', // Karten/Panels (TradingView-artig)
        rand: '#1F2733',
        schrift: '#D6DCE5',
        gedimmt: '#8B95A5',
        long: '#22C55E',
        short: '#EF4444',
        akzent: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
