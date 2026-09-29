/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#081c30',
          900: '#0c2946',
          800: '#12365c',
        },
        cream: '#effaf6',
        mint: '#d1f0e5',
        coral: '#10b981',
        grape: '#0d9488',
      },
      boxShadow: {
        sticker: '4px 4px 0 0 rgba(8,28,48,0.9)',
        'sticker-sm': '2.5px 2.5px 0 0 rgba(8,28,48,0.9)',
        'sticker-light': '4px 4px 0 0 rgba(8,28,48,0.12)',
        card: '6px 6px 0 0 rgba(8,28,48,0.08)',
      },
    },
  },
  plugins: [],
};
