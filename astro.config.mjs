import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://airbrush.gallery',
  integrations: [sitemap()],
  output: 'static',
});
