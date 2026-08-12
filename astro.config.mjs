import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://airbrush.gallery',
  integrations: [sitemap(), tailwind({ applyBaseStyles: false })],
  output: 'static',
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});
