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
        'bg-alt': '#f6f7f9',
        border: '#e5e7eb',
        accent: { DEFAULT: '#1d4e89', dark: '#143a66' },
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
        DEFAULT: '10px',
      },
      maxWidth: {
        prose: '760px',
        wide: '1100px',
      },
    },
  },
  plugins: [typography],
};
