// Runs before every build (see package.json "prebuild").
// 1. Calls the n8n "Articles API" webhook.
// 2. Filters to status === "ready".
// 3. Decodes each article's base64 hero image and writes it to public/images/<slug>.png.
// 4. Writes the article metadata (without the base64 blob) to src/data/articles.json
//    so the Astro pages can read it locally at build time without re-fetching.
//
// This keeps the network call in ONE place, so if something's wrong with the
// n8n side, you'll see a clear error here instead of a confusing Astro build
// failure three layers deep.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'articles.json');

const WEBHOOK_URL = process.env.N8N_ARTICLES_WEBHOOK_URL;

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  if (!WEBHOOK_URL) {
    console.error(
      '\n[fetch-articles] Missing N8N_ARTICLES_WEBHOOK_URL.\n' +
      'Set it in .env (local dev) or in your hosting provider\'s environment ' +
      'variables (Cloudflare Pages / Netlify / Vercel project settings).\n'
    );
    process.exit(1);
  }

  console.log(`[fetch-articles] Fetching articles from ${WEBHOOK_URL} ...`);
  const res = await fetch(WEBHOOK_URL);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[fetch-articles] Webhook responded ${res.status}: ${body.slice(0, 500)}`);
    process.exit(1);
  }

  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : payload.articles ?? [];

  const ready = rows.filter((row) => (row.status ?? '').toLowerCase() === 'ready');
  console.log(`[fetch-articles] Got ${rows.length} row(s), ${ready.length} with status "ready".`);

  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(path.dirname(DATA_FILE), { recursive: true });

  const cleaned = [];
  const seenSlugs = new Set();

  for (const row of ready) {
    const slug = slugify(row.slug || row.title || '');
    if (!slug) {
      console.warn('[fetch-articles] Skipping a row with no usable slug/title.');
      continue;
    }
    if (seenSlugs.has(slug)) {
      console.warn(`[fetch-articles] Duplicate slug "${slug}" — keeping the first one, skipping this one.`);
      continue;
    }
    seenSlugs.add(slug);

    // Decode and write the hero image, if present.
    if (row.image_base64) {
      try {
        const buffer = Buffer.from(row.image_base64, 'base64');
        await writeFile(path.join(IMAGES_DIR, `${slug}.png`), buffer);
      } catch (err) {
        console.warn(`[fetch-articles] Failed to write image for "${slug}": ${err.message}`);
      }
    } else {
      console.warn(`[fetch-articles] "${slug}" has no image_base64 — the page will render without a hero image.`);
    }

    cleaned.push({
      slug,
      title: row.title || 'Untitled',
      excerpt: row.excerpt || '',
      content_html: row.content_html || '',
      page_html: row.page_html || '',
      image_prompt: row.image_prompt || '',
      source_topic: row.source_topic || '',
      published_date: row.published_date || new Date().toISOString().slice(0, 10),
    });
  }

  // Newest first.
  cleaned.sort((a, b) => (a.published_date < b.published_date ? 1 : -1));

  await writeFile(DATA_FILE, JSON.stringify(cleaned, null, 2));
  console.log(`[fetch-articles] Wrote ${cleaned.length} article(s) to ${path.relative(ROOT, DATA_FILE)}`);
  console.log(`[fetch-articles] Wrote hero images to ${path.relative(ROOT, IMAGES_DIR)}`);
}

main().catch((err) => {
  console.error('[fetch-articles] Unexpected error:', err);
  process.exit(1);
});
