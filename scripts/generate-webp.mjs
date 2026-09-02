#!/usr/bin/env node
// Generates a WebP sibling next to every hero image (public/images/*.png)
// and gallery image (public/images/gallery/*.{jpg,jpeg,png}), so pages can
// serve the much smaller WebP via <picture> (see src/lib/optimizedImage.js)
// while the original file stays the source of truth for OG/Twitter meta tags
// and the documented `/images/<slug>.png` data contract — nothing about the
// stored data or n8n's commit shape changes.
//
// Added 2026-09-03 to cut Netlify bandwidth-credit cost: hero images are
// committed as-is from gpt-image-2 (1536x1024 photorealistic PNGs, ~2-2.5MB
// each — public/images/ was ~113MB across 56 heroes at the time this was
// written), and bandwidth is billed at 20 credits/GB. A WebP re-encode of a
// photorealistic PNG is typically 80-90% smaller at visually equivalent
// quality, which is real credit savings that scales with traffic — unlike
// batching pushes, which only caps the *build* side of the credit bill.
//
// Runs before `astro build` (see netlify.toml and this file's package.json
// "build" script). Deliberately never fails the build: any error here just
// means that one image ships without a WebP sibling and pages fall back to
// the original PNG/JPG automatically (see optimizedImage.js's webpSrcFor) —
// a bug in this script can only cost bandwidth savings, never break a
// deploy. NOT YET VERIFIED against a real build (no Node.js was available in
// the session that wrote this) — run this locally or via `netlify-cli dev`
// and confirm `public/images/*.webp` files actually appear before relying on
// it in production.
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOTS = [
  { dir: path.join('public', 'images'), exts: ['.png'] },
  { dir: path.join('public', 'images', 'gallery'), exts: ['.jpg', '.jpeg', '.png'] },
];

async function run() {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch (err) {
    console.warn('[generate-webp] sharp not installed, skipping image optimization:', err.message);
    return;
  }

  let generated = 0;
  let upToDate = 0;
  let failed = 0;

  for (const { dir, exts } of ROOTS) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // directory doesn't exist yet (e.g. no gallery images committed) — nothing to do
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!exts.includes(ext)) continue;

      const srcPath = path.join(dir, entry.name);
      const webpPath = srcPath.slice(0, -ext.length) + '.webp';

      try {
        const srcStat = await stat(srcPath);
        try {
          const webpStat = await stat(webpPath);
          if (webpStat.mtimeMs >= srcStat.mtimeMs) {
            upToDate++;
            continue;
          }
        } catch {
          // no existing webp for this file — fall through and generate one
        }
        await sharp(srcPath).webp({ quality: 82 }).toFile(webpPath);
        generated++;
      } catch (err) {
        failed++;
        console.warn(`[generate-webp] skipped ${srcPath}:`, err.message);
      }
    }
  }

  console.log(`[generate-webp] ${generated} generated, ${upToDate} up to date, ${failed} skipped`);
}

run().catch((err) => {
  // Never fail the build over image optimization — worst case, this run's
  // images just ship without WebP siblings.
  console.warn('[generate-webp] unexpected error, continuing without it:', err);
});
