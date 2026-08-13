# Airbrush Art Gallery — Design

## Goal

Turn the homepage's decorative "Community Gallery" section (17 static tiles, dead-end "See Full Gallery" / "Browse All Artwork" buttons, fake "2,400+ works · 840 artists" stat) into a real, browsable gallery: a `/gallery` index page and one `/gallery/<category>` page per discipline, backed by curated (not user-submitted) artwork data.

## Content model

The gallery is **curated by the site owner**, not community-submitted. There is no upload form, no moderation queue, and no backend — content is a committed data file plus committed images, exactly like `src/data/articles.json` already works for blog posts. This keeps the site's "no CMS, no server-side runtime" architecture intact.

### `src/data/gallery.json`

An array of pieces, ~3-4 per discipline (≈50-65 total across the 17 existing categories):

```json
{
  "slug": "impala-custom-candy-paint",
  "title": "1958 Chevrolet Impala Custom Paint",
  "category": "automotive",
  "image": "impala-custom-candy-paint.jpg",
  "credit": "Photo via Wikimedia Commons"
}
```

- `slug` — a stable identifier (kebab-case, unique). Not used as a URL — there are no per-piece detail pages — but useful as a React/Astro loop key and for future-proofing if detail pages are ever added.
- `title` — the caption shown on the grid card.
- `category` — one of the 17 fixed discipline slugs (see below). Missing/unrecognized values are dropped from category pages but still appear on the "all" `/gallery` index, consistent with how `articles.json` treats unrecognized article categories.
- `image` — filename only, resolved to `/images/gallery/<image>` at render time (matches the existing homepage tile convention).
- `credit` — plain-text attribution string, always Wikimedia Commons-sourced photography for this initial seed. Displayed subtly (small caption text) on each grid card for licensing compliance.

No `content_html`, no body text, no per-piece detail page — see "Non-goals" below.

### `src/data/galleryCategories.js`

Mirrors the shape of `src/data/categories.js` (which drives the 9 article categories), but for the gallery's 17 disciplines:

```js
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

This is a distinct, separate taxonomy from the 9 article categories (`categories.js`) — gallery disciplines and article topics don't need to line up 1:1, and forcing them to share a list would be a false coupling.

## Pages

### `src/pages/gallery/index.astro`

- Every piece from `gallery.json`, rendered as an image grid (reusing the existing tile-card visual treatment from the homepage: image, gradient overlay, label — plus the new `credit` line in small text).
- A row of category filter links/tabs at the top: "All" (this page) plus each of the 17 disciplines, linking to their respective `/gallery/<category>` page. Pure `<a>` links — no client-side JS, no active-filtering logic.
- Page header states a real, computed count (e.g., "58 pieces across 17 disciplines") instead of the old fake stat.

### `src/pages/gallery/[category].astro`

- `getStaticPaths()` over `galleryCategories`, same pattern as the existing `src/pages/category/[slug].astro` for articles.
- Same grid/tab layout as the index, filtered to just that category's pieces, with that category's tab visually marked active.
- If a category has zero pieces (shouldn't happen at launch given the 3-4-per-category seed, but could once new categories are added later), show the same empty-state pattern already used elsewhere on the site (e.g. the homepage's "New articles are on the way" message) rather than a blank grid.

## Homepage changes (`src/pages/index.astro`)

- The existing 17 `galleryTiles` become real links: each tile wraps in `<a href={`/gallery/${tile.slug}`}>` instead of being a static `<div>`.
- "See Full Gallery" and "Browse All Artwork" both become `<a href="/gallery">`.
- The fake "2,400+ works · 840 artists" stat line is replaced with a real computed count derived from `gallery.json` (e.g., "58 pieces across 17 disciplines"). No "artists" claim — these are curated example photos, not individually attributed community submissions.

## Content sourcing

The 17 images already used for the homepage tiles become one piece each. Their original per-image Wikimedia source URLs weren't recorded when they were first sourced, so their `credit` field uses the generic string `"Photo via Wikimedia Commons"` rather than a specific attribution link — acceptable for Commons-licensed work, but worth knowing this is less precise than the credits on newly-sourced pieces. The remaining ~33-48 pieces are sourced fresh using the same methodology already established this session:

1. Search Wikimedia Commons for topically relevant, airbrush/craft-adjacent photography per discipline.
2. Filter out identifiable-person content (blocklist: child, kid, baby, infant, boy, girl, minor, face, portrait, people, woman, man, teen) and manually visually review every candidate before use.
3. Download via `Special:FilePath`, save to `public/images/gallery/<slug>.jpg`.
4. Record the `credit` string and add the entry to `gallery.json`.

This is the bulk of the actual implementation effort and will likely run as a background task given the volume (dozens of searches + reviews).

## Testing

- `npm run build` succeeds with no errors.
- Browser-verify `/gallery` renders all pieces with working images and correct captions/credits.
- Browser-verify at least one `/gallery/<category>` page (e.g. `/gallery/automotive`) shows only that category's pieces, with the category tab visually marked active.
- Click through from a homepage tile to confirm it lands on the correct filtered `/gallery/<category>` page.
- Click "See Full Gallery" and "Browse All Artwork" to confirm both land on `/gallery`.
- Spot-check the empty-state path doesn't need to trigger at launch (every category has ≥1 piece), but exists in the code for future-proofing.

## Non-goals (explicitly out of scope)

- No user/community submission form, no moderation, no accounts — this is curated content only, matching the site's static-first architecture.
- No per-piece detail pages (`/gallery/<category>/<piece-slug>`) — a grid card with title + category + credit is enough for curated example photography with no unique story to tell per piece.
- No client-side filtering, search, or sorting UI — the category "filter" is implemented as separate static pages with tab-styled links, not JavaScript.
- No pagination — at ~58 pieces total (and ~3-4 per filtered category page), a single grid per page is fine. Revisit if the gallery grows substantially.
