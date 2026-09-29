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
          950: '#131022',
          900: '#1c1830',
          800: '#262142',
        },
        cream: '#f4f1ea',
        mint: '#d7e8d5',
        coral: '#ff8a70',
        grape: '#6c5ce7',
      },
      boxShadow: {
        sticker: '4px 4px 0 0 rgba(19,16,34,0.9)',
        'sticker-sm': '2.5px 2.5px 0 0 rgba(19,16,34,0.9)',
        'sticker-light': '4px 4px 0 0 rgba(19,16,34,0.12)',
        card: '6px 6px 0 0 rgba(19,16,34,0.08)',
      },
    },
  },
  plugins: [],
};
