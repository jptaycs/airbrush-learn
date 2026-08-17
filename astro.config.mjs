import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const articles = JSON.parse(
  readFileSync(fileURLToPath(new URL('./src/data/articles.json', import.meta.url)), 'utf-8')
);
const categorySlugsWithPublishedArticles = new Set(
  articles.filter((a) => a.status !== 'draft').map((a) => a.category)
);

const gallery = JSON.parse(
  readFileSync(fileURLToPath(new URL('./src/data/gallery.json', import.meta.url)), 'utf-8')
);
const gallerySlugsWithPieces = new Set(gallery.map((p) => p.category));

export default defineConfig({
  site: 'https://airbrush.gallery',
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;

        if (path === '/admin' || path === '/admin/') return false;

        const postMatch = path.match(/^\/posts\/([^/]+)\/?$/);
        if (postMatch) {
          const article = articles.find((a) => a.slug === postMatch[1]);
          if (article?.status === 'draft') return false;
        }

        const catMatch = path.match(/^\/category\/([^/]+)\/?$/);
        if (catMatch && !categorySlugsWithPublishedArticles.has(catMatch[1])) {
          return false;
        }

        const galleryCatMatch = path.match(/^\/gallery\/([^/]+)\/?$/);
        if (galleryCatMatch && !gallerySlugsWithPieces.has(galleryCatMatch[1])) {
          return false;
        }

        return true;
      },
    }),
    tailwind({ applyBaseStyles: false }),
  ],
  output: 'static',
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});
