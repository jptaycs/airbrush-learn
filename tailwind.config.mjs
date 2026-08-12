import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#16181d',
        body: '#333844',
        muted: '#6b7280',
        bg: '#ffffff',
        'bg-alt': '#f5f5f7',
        border: '#e5e7eb',
        accent: { DEFAULT: '#e2571f', dark: '#c9451a' },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        DEFAULT: '18px',
      },
      maxWidth: {
        prose: '760px',
        wide: '1100px',
      },
    },
  },
  plugins: [typography],
};
