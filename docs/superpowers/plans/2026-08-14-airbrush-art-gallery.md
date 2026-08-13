# Airbrush Art Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's decorative, dead-end "Community Gallery" section with a real, browsable Airbrush Art Gallery: a `/gallery` index page and one `/gallery/<category>` page per discipline, backed by curated (not user-submitted) artwork data.

**Architecture:** A committed data file (`src/data/gallery.json`) plus a 17-discipline taxonomy (`src/data/galleryCategories.js`) drive two static Astro routes built on a single shared `GalleryGrid.astro` component. The homepage's existing 17 tiles and CTA buttons become real links into this system instead of static decoration.

**Tech Stack:** Astro (existing project conventions — `.astro` components, `getStaticPaths()`, Tailwind utility classes). No new dependencies.

## Global Constraints

- No CMS, no server-side runtime, no client-side JS for this feature — pure static generation (see `CLAUDE.md`: "Client-side JS is scoped to one file," and this feature adds none).
- No per-piece detail pages — a grid card (image, title, category badge, credit) is the full presentation. Confirmed non-goal in the spec.
- No user/community submission form, no moderation, no accounts.
- No pagination.
- This project has no test suite (`CLAUDE.md`: "There is no test suite"). Verification throughout this plan means: `npm run build` succeeds, plus explicit content/data checks, plus browser verification — matching how every other feature in this codebase has been verified. Do not introduce a test framework.
- Follow existing visual patterns exactly: the category badge pill style from `ArticleCard.astro` (`bg-black/75 rounded-full px-2.5 py-1`), the breadcrumb style from `src/pages/category/[slug].astro`, and the tile card treatment from the current homepage gallery section.

## Scope note on content sourcing

Of the 17 gallery disciplines, only 10 currently have real, topically-accurate photography already downloaded (`guitars`, `murals`, `nail-art`, `helmets`, `skateboards`, `diecast-cars`, `toy-soldiers`, `wooden-toys`, `nesting-dolls`, `carousel-figures` — all genuine Wikimedia Commons photos verified earlier this session). The other 7 (`automotive`, `fine-art`, `miniatures`, `cosplay`, `fabric`, `scale-models`, `body-art`) currently only have generic, topically-*inaccurate* stock photos (early-session Picsum placeholders used purely as homepage decoration) — presenting these as titled gallery pieces would be misleading, so **this plan seeds `gallery.json` with only the 10 verified-accurate pieces**. The other 7 categories correctly render the empty state until real photos are sourced. Sourcing 2-3 more pieces per existing category plus real photography for the remaining 7 is explicit follow-up content work, not part of this plan (see spec's "Content sourcing" section) — it doesn't decompose into testable engineering tasks the way the rest of this plan does.

---

### Task 1: Gallery data model

**Files:**
- Create: `src/data/galleryCategories.js`
- Create: `src/data/gallery.json`

**Interfaces:**
- Produces: `galleryCategories` — array of `{ slug: string, label: string }`, one entry per discipline, imported by later tasks as `import { galleryCategories } from '../data/galleryCategories.js'`.
- Produces: `gallery.json` default export — array of `{ slug: string, title: string, category: string, image: string, credit: string }`, imported by later tasks as `import gallery from '../data/gallery.json'`. `category` values must match a `galleryCategories` slug. `image` is a filename only (no path), resolved by consumers as `/images/gallery/<image>`.

- [ ] **Step 1: Create the taxonomy file**

```js
// src/data/galleryCategories.js
export const galleryCategories = [
  { slug: 'automotive', label: 'Automotive' },
  { slug: 'fine-art', label: 'Fine Art' },
  { slug: 'miniatures', label: 'Miniatures' },
  { slug: 'cosplay', label: 'Cosplay' },
  { slug: 'fabric', label: 'Fabric' },
  { slug: 'scale-models', label: 'Scale Models' },
  { slug: 'body-art', label: 'Body Art' },
  { slug: 'guitars', label: 'Guitars' },
  { slug: 'murals', label: 'Murals' },
  { slug: 'nail-art', label: 'Nail Art' },
  { slug: 'helmets', label: 'Helmets' },
  { slug: 'skateboards', label: 'Skateboards' },
  { slug: 'diecast-cars', label: 'Diecast Cars' },
  { slug: 'toy-soldiers', label: 'Toy Soldiers' },
  { slug: 'wooden-toys', label: 'Wooden Toys' },
  { slug: 'nesting-dolls', label: 'Nesting Dolls' },
  { slug: 'carousel-figures', label: 'Carousel Figures' },
];
```

- [ ] **Step 2: Create the seed gallery data**

```json
[
  {
    "slug": "custom-painted-gibson-j200-guitar",
    "title": "Custom Painted Gibson J-200 Guitar",
    "category": "guitars",
    "image": "guitars.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "airbrush-street-art-mural",
    "title": "Airbrush Street Art Mural",
    "category": "murals",
    "image": "murals.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "airbrush-nail-art-design",
    "title": "Airbrush Nail Art Design",
    "category": "nail-art",
    "image": "nail-art.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "custom-racing-helmet-graphics",
    "title": "Custom Racing Helmet Graphics",
    "category": "helmets",
    "image": "helmets.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "custom-skateboard-deck-art",
    "title": "Custom Skateboard Deck Art",
    "category": "skateboards",
    "image": "skateboards.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "custom-painted-diecast-muscle-cars",
    "title": "Custom Painted Diecast Muscle Cars",
    "category": "diecast-cars",
    "image": "diecast-cars.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "hand-painted-toy-soldier",
    "title": "Hand-Painted Toy Soldier",
    "category": "toy-soldiers",
    "image": "toy-soldiers.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "hand-painted-sawantwadi-wooden-toys",
    "title": "Hand-Painted Sawantwadi Wooden Toys",
    "category": "wooden-toys",
    "image": "wooden-toys.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "hand-painted-matryoshka-nesting-dolls",
    "title": "Hand-Painted Matryoshka Nesting Dolls",
    "category": "nesting-dolls",
    "image": "nesting-dolls.jpg",
    "credit": "Photo via Wikimedia Commons"
  },
  {
    "slug": "hand-painted-carousel-figure",
    "title": "Hand-Painted Carousel Figure",
    "category": "carousel-figures",
    "image": "carousel-figures.jpg",
    "credit": "Photo via Wikimedia Commons"
  }
]
```

- [ ] **Step 3: Verify the data is internally consistent**

Run this from the repo root (the project's `package.json` has `"type": "module"`, so relative imports resolve as ESM):

```bash
node --input-type=module -e "
import { galleryCategories } from './src/data/galleryCategories.js';
import { readFileSync, existsSync } from 'node:fs';
const gallery = JSON.parse(readFileSync('./src/data/gallery.json', 'utf-8'));
const slugs = new Set(galleryCategories.map((c) => c.slug));
let ok = true;
if (galleryCategories.length !== 17) { console.error('expected 17 categories, got', galleryCategories.length); ok = false; }
for (const piece of gallery) {
  if (!slugs.has(piece.category)) { console.error('bad category:', piece.category); ok = false; }
  if (!existsSync('./public/images/gallery/' + piece.image)) { console.error('missing image:', piece.image); ok = false; }
}
console.log(ok ? 'OK: ' + gallery.length + ' pieces, all valid' : 'FAILED');
process.exit(ok ? 0 : 1);
"
```

Expected: `OK: 10 pieces, all valid`

- [ ] **Step 4: Commit**

```bash
git add src/data/galleryCategories.js src/data/gallery.json
git commit -m "Add gallery data model: 17-discipline taxonomy + 10 seed pieces"
```

---

### Task 2: Gallery grid component and index page

**Files:**
- Create: `src/components/GalleryGrid.astro`
- Create: `src/pages/gallery/index.astro`

**Interfaces:**
- Consumes: `galleryCategories` and `gallery.json` shapes from Task 1.
- Produces: `GalleryGrid` component with props `{ pieces: GalleryPiece[], activeCategorySlug?: string | null }`, where `GalleryPiece = { slug: string, title: string, category: string, image: string, credit: string }`. Task 3 imports and reuses this component — its prop shape must not change without updating Task 3's usage.

- [ ] **Step 1: Create the shared grid component**

```astro
---
// src/components/GalleryGrid.astro
import { galleryCategories } from '../data/galleryCategories.js';

interface Props {
  pieces: Array<{
    slug: string;
    title: string;
    category: string;
    image: string;
    credit: string;
  }>;
  activeCategorySlug?: string | null;
}

const { pieces, activeCategorySlug = null } = Astro.props;

const categoryLabel = (slug: string) =>
  galleryCategories.find((c) => c.slug === slug)?.label ?? slug;
---
<div>
  <div class="flex flex-wrap gap-2.5 mb-8">
    <a
      href="/gallery"
      class={`inline-block rounded-full px-4 py-2 text-[0.85rem] font-semibold transition-colors hover:no-underline ${
        activeCategorySlug === null
          ? 'bg-accent text-white'
          : 'border border-border text-ink hover:bg-bg-alt'
      }`}
    >
      All
    </a>
    {galleryCategories.map((cat) => (
      <a
        href={`/gallery/${cat.slug}`}
        class={`inline-block rounded-full px-4 py-2 text-[0.85rem] font-semibold transition-colors hover:no-underline ${
          activeCategorySlug === cat.slug
            ? 'bg-accent text-white'
            : 'border border-border text-ink hover:bg-bg-alt'
        }`}
      >
        {cat.label}
      </a>
    ))}
  </div>

  {pieces.length === 0 ? (
    <div class="text-center py-16 px-5 text-muted">
      <p>New pieces are on the way — check back soon.</p>
      <a href="/gallery" class="inline-block mt-5 rounded-full bg-bg-alt text-ink px-5 py-2.5 text-[0.9rem] font-semibold hover:no-underline hover:bg-border">Browse full gallery</a>
    </div>
  ) : (
    <div data-reveal-group class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
      {pieces.map((piece) => (
        <div data-reveal class="relative rounded-xl overflow-hidden bg-bg flex flex-col justify-end aspect-[4/3] p-4 transition-transform duration-300 hover:scale-[1.03]">
          <img src={`/images/gallery/${piece.image}`} alt={piece.title} loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
          <span class="absolute top-3 left-3 text-[0.65rem] text-white uppercase tracking-[0.05em] font-bold bg-black/75 rounded-full px-2.5 py-1">
            {categoryLabel(piece.category)}
          </span>
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
          <span class="relative text-[0.9rem] font-semibold text-white leading-snug">{piece.title}</span>
          <span class="relative text-[0.68rem] text-white/70 mt-1">{piece.credit}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 2: Create the gallery index page**

```astro
---
// src/pages/gallery/index.astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import GalleryGrid from '../../components/GalleryGrid.astro';
import gallery from '../../data/gallery.json';

const pieceCount = gallery.length;
const categoryCount = new Set(gallery.map((p) => p.category)).size;
---
<BaseLayout
  title="Airbrush Art Gallery — Airbrush Learn"
  description="Browse curated airbrush artwork across automotive, miniatures, cosplay, toys and more."
  canonicalPath="/gallery"
>
  <section class="pt-14 pb-4 text-center">
    <div class="mx-auto max-w-wide px-5">
      <div class="text-[0.78rem] text-muted mb-4">
        <a href="/" class="text-muted hover:text-accent-dark">Home</a> / <span class="text-body">Gallery</span>
      </div>
      <h1 class="font-serif max-[640px]:text-[1.7rem] text-ink text-[2.25rem]">Airbrush Art Gallery</h1>
      <p class="mt-3 text-muted text-[1.05rem] max-w-[520px] mx-auto">{pieceCount} piece{pieceCount === 1 ? '' : 's'} across {categoryCount} discipline{categoryCount === 1 ? '' : 's'}.</p>
    </div>
  </section>

  <section class="mx-auto max-w-wide px-5 pt-8 pb-16">
    <GalleryGrid pieces={gallery} activeCategorySlug={null} />
  </section>
</BaseLayout>
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: build succeeds, output includes `dist/gallery/index.html`. Confirm with:

```bash
ls dist/gallery/index.html
grep -c "Wikimedia Commons" dist/gallery/index.html
```

Expected: file exists; grep count is `10` (one credit line per seed piece).

- [ ] **Step 4: Browser-verify**

Start a preview server (`npx astro preview --port 4400` after the build above), navigate to `http://localhost:4400/gallery`, and confirm: the "All" tab is visually active, all 17 category tabs render, the 10 seed pieces show with correct images/titles/credits, and clicking a category tab (e.g. "Guitars") navigates correctly. Stop the preview server when done.

- [ ] **Step 5: Commit**

```bash
git add src/components/GalleryGrid.astro src/pages/gallery/index.astro
git commit -m "Add gallery index page with shared GalleryGrid component"
```

---

### Task 3: Gallery category pages

**Files:**
- Create: `src/pages/gallery/[category].astro`

**Interfaces:**
- Consumes: `GalleryGrid` component from Task 2 (exact same props shape), `galleryCategories` and `gallery.json` from Task 1.

- [ ] **Step 1: Create the category page**

```astro
---
// src/pages/gallery/[category].astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import GalleryGrid from '../../components/GalleryGrid.astro';
import { galleryCategories } from '../../data/galleryCategories.js';
import gallery from '../../data/gallery.json';

export async function getStaticPaths() {
  return galleryCategories.map((cat) => ({
    params: { category: cat.slug },
    props: { cat },
  }));
}

const { cat } = Astro.props;
const inCategory = gallery.filter((p) => p.category === cat.slug);
---
<BaseLayout
  title={`${cat.label} — Airbrush Art Gallery`}
  description={`Curated ${cat.label.toLowerCase()} airbrush artwork.`}
  canonicalPath={`/gallery/${cat.slug}`}
  noindex={inCategory.length === 0}
>
  <section class="pt-14 pb-4 text-center">
    <div class="mx-auto max-w-wide px-5">
      <div class="text-[0.78rem] text-muted mb-4">
        <a href="/" class="text-muted hover:text-accent-dark">Home</a> / <a href="/gallery" class="text-muted hover:text-accent-dark">Gallery</a> / <span class="text-body">{cat.label}</span>
      </div>
      <h1 class="font-serif max-[640px]:text-[1.7rem] text-ink text-[2.25rem]">{cat.label}</h1>
      <p class="mt-3 text-muted text-[1.05rem] max-w-[520px] mx-auto">{inCategory.length} piece{inCategory.length === 1 ? '' : 's'} in this discipline.</p>
    </div>
  </section>

  <section class="mx-auto max-w-wide px-5 pt-8 pb-16">
    <GalleryGrid pieces={inCategory} activeCategorySlug={cat.slug} />
  </section>
</BaseLayout>
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
ls dist/gallery/guitars/index.html dist/gallery/automotive/index.html
```

Expected: both files exist. `guitars` has a seeded piece; `automotive` currently has zero (empty-state path).

```bash
find dist/gallery -maxdepth 1 -type d | wc -l
```

Expected: `18` (17 category directories + the `gallery` dir itself, i.e. 17 categories represented as subdirectories plus the index — adjust expectation to whatever `find` reports, but confirm all 17 category slugs are present as directories under `dist/gallery/`).

- [ ] **Step 3: Browser-verify both states**

With the preview server running (`npx astro preview --port 4400`), navigate to `http://localhost:4400/gallery/guitars` — confirm the "Guitars" tab shows active, breadcrumb reads "Home / Gallery / Guitars", and the one seeded piece renders. Then navigate to `http://localhost:4400/gallery/automotive` — confirm the empty-state message renders ("New pieces are on the way...") instead of a blank or broken grid.

- [ ] **Step 4: Commit**

```bash
git add src/pages/gallery/[category].astro
git commit -m "Add per-category gallery pages"
```

---

### Task 4: Homepage integration

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `gallery.json` from Task 1 (for the real piece-count stat).

- [ ] **Step 1: Import gallery data and compute the real stat**

In the frontmatter, near the other data imports (after the existing `import articles from '../data/articles.json';` line), add:

```js
import gallery from '../data/gallery.json';
```

Near the other computed consts (e.g. near `categoryCounts`), add:

```js
const galleryPieceCount = gallery.length;
const galleryCategoryCount = new Set(gallery.map((p) => p.category)).size;
```

- [ ] **Step 2: Turn "See Full Gallery" into a real link**

Find this line in the Community Gallery section:

```astro
        <span class="inline-block rounded-full border border-border text-ink px-5 py-2.5 text-[0.9rem] font-semibold">See Full Gallery &rarr;</span>
```

Replace it with:

```astro
        <a href="/gallery" class="inline-block rounded-full border border-border text-ink px-5 py-2.5 text-[0.9rem] font-semibold hover:no-underline hover:bg-bg-alt">See Full Gallery &rarr;</a>
```

- [ ] **Step 3: Turn each gallery tile into a real link**

Find this block:

```astro
        {galleryTiles.map((tile) => (
          <div data-reveal class={`relative rounded-xl overflow-hidden bg-bg flex items-end p-4 transition-transform duration-300 hover:scale-[1.03] ${tile.tall ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}>
            <img src={`/images/gallery/${tile.slug}.jpg`} alt={tile.label} loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent"></div>
            <span class="relative text-[0.85rem] font-semibold text-white">{tile.label}</span>
          </div>
        ))}
```

Replace it with (the `<div>` becomes an `<a>`, everything else unchanged):

```astro
        {galleryTiles.map((tile) => (
          <a href={`/gallery/${tile.slug}`} data-reveal class={`relative rounded-xl overflow-hidden bg-bg flex items-end p-4 transition-transform duration-300 hover:scale-[1.03] hover:no-underline ${tile.tall ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}>
            <img src={`/images/gallery/${tile.slug}.jpg`} alt={tile.label} loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent"></div>
            <span class="relative text-[0.85rem] font-semibold text-white">{tile.label}</span>
          </a>
        ))}
```

- [ ] **Step 4: Turn "Browse All Artwork" into a real link and fix the fake stat**

Find this block:

```astro
      <div class="flex flex-wrap items-center gap-4 mt-8">
        <span class="inline-block rounded-full bg-accent text-white px-6 py-3 text-[0.95rem] font-semibold">Browse All Artwork &rarr;</span>
        <span class="text-muted text-[0.85rem]">2,400+ works · 840 artists</span>
      </div>
```

Replace it with:

```astro
      <div class="flex flex-wrap items-center gap-4 mt-8">
        <a href="/gallery" class="inline-block rounded-full bg-accent text-white px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90">Browse All Artwork &rarr;</a>
        <span class="text-muted text-[0.85rem]">{galleryPieceCount} piece{galleryPieceCount === 1 ? '' : 's'} across {galleryCategoryCount} discipline{galleryCategoryCount === 1 ? '' : 's'}</span>
      </div>
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
grep -o 'href="/gallery[^"]*"' dist/index.html | sort -u
```

Expected: 18 distinct hrefs — `/gallery` (appearing for the two CTA links, deduped by `sort -u` to one line) plus `/gallery/<slug>` for each of the 17 tiles. Confirm all 17 tile slugs appear (`automotive`, `fine-art`, `miniatures`, `cosplay`, `fabric`, `scale-models`, `body-art`, `guitars`, `murals`, `nail-art`, `helmets`, `skateboards`, `diecast-cars`, `toy-soldiers`, `wooden-toys`, `nesting-dolls`, `carousel-figures`).

```bash
grep -o '[0-9]* pieces\? across [0-9]* discipline' dist/index.html
```

Expected: `10 pieces across 10 disciplines` (matching the current 10-piece seed data — this number will grow as more content is added later).

- [ ] **Step 6: Browser-verify end to end**

With the preview server running, load the homepage, scroll to the Community Gallery section, click the "Guitars" tile — confirm it lands on `/gallery/guitars` with the seeded piece visible. Go back, click "See Full Gallery" — confirm it lands on `/gallery` with all 10 pieces and all 17 tabs. Click "Browse All Artwork" — confirm it also lands on `/gallery`.

- [ ] **Step 7: Clean up and commit**

```bash
rm -rf dist
git add src/pages/index.astro
git commit -m "Link homepage gallery tiles and CTAs to real /gallery pages"
```

---

## Final verification (after all tasks)

- [ ] `npm run build` succeeds with zero errors, 0 warnings related to gallery pages.
- [ ] `/gallery`, `/gallery/guitars` (has content), and `/gallery/automotive` (empty state) all render correctly in a browser with no console errors.
- [ ] Every homepage gallery tile links to its matching `/gallery/<slug>` page.
- [ ] The homepage stat line shows a real, non-fake number.
- [ ] No new client-side JavaScript was introduced (confirm `src/components/PageInteractions.astro` is unchanged — it remains the site's only client-script file).
