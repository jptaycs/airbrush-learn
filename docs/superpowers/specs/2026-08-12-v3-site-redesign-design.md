# Design: Rebuild the site to match the v3 prototype (categories + homepage redesign)

**Date:** 2026-08-12
**Status:** Approved, not yet implemented

## Context

`Airbrush Learn Site v3.dc.html` (repo root) is an interactive prototype — built in a
design tool's own `.dc` component format (`{{ }}` bindings, `sc-if`/`sc-for`,
`onClick` handlers, live component `state`) — that the user has designated as the
reference design to build into the real site: sticky glass header with a "Categories"
mega-menu, a hero with two CTAs, a "latest articles" grid with category badges, a
reviews strip, a "Start Here" / "Troubleshooting" two-column block, a "Nine ways in"
category grid, category archive pages, and an updated post-detail page.

This is not a drop-in port. Two things in the current codebase constrain how it has to
be rebuilt:

1. **No `category` field exists anywhere in the data contract today.** `CLAUDE.md`'s
   field table and `src/data/articles.json` have no such column — v3's entire premise
   (mega-menu, badges, archive pages, filter chips) depends on a taxonomy that isn't
   in the n8n pipeline yet. This is the same gap `docs/design-prompt-content-taxonomy-mockup.md`
   left unresolved.
2. **v3's interactivity is live client-side JS state** (search-as-you-type, filter
   chips, sort toggles, hover-driven menu) — this site's explicit convention
   (`CLAUDE.md`) is "no client-side JS unless there's a real reason," a static build
   with effectively zero JS. Those behaviors need to become real static pages/links,
   not ported as-is.

Decisions resolving both, made with the user before this spec was written:

- Add `category` to the pipeline now (not deferred, not hardcoded-only) — full scope.
- Replace live filter chips/search with real navigation to `/category/<slug>` pages;
  drop the live homepage search box and filter chips entirely.
- Drop the newest/oldest sort toggle on category pages (newest-first only).
- "Start Here" and "Troubleshooting" are derived from category (latest N in
  `beginner` / `troubleshooting`), not hand-picked slugs — no manual upkeep as the
  n8n pipeline's output changes.
- Adopt v3's orange accent (`#e2571f`) as a full palette update, not just layout.
- Ship as one combined spec/plan, not split into separate foundation/visuals phases.

## Decision: category taxonomy lives partly in n8n, partly in this repo

An article row gets tagged with a **raw category slug** (one of 9 fixed values) by
the n8n pipeline. The **human-facing metadata** for each category — label,
description, the short blurb shown in the mega-menu — is editorial/design copy, not
pipeline output, so it's defined once in this repo as the source of truth:

```js
// src/data/categories.js
export const categories = [
  { slug: 'how-to', label: 'How-to', description: 'Tutorials that walk you through every pass, from setup to cleanup.' },
  { slug: 'reviews', label: 'Reviews', description: 'Honest gear reviews from real studio time.' },
  { slug: 'buying-guides', label: 'Buying Guides', description: 'Compare specs that actually matter before you spend a dollar.' },
  { slug: 'troubleshooting', label: 'Troubleshooting', description: 'Diagnose the problem fast and get back to painting.' },
  { slug: 'paints-colors', label: 'Paints & Colors', description: "Understand what's actually in the bottle before it goes through your gun." },
  { slug: 'automotive', label: 'Automotive', description: 'Flake, candy fades & custom paneling.' },
  { slug: 'miniatures', label: 'Miniatures', description: 'NMM, OSL & 28mm tabletop finishes.' },
  { slug: 'cosplay-body-art', label: 'Cosplay & Body Art', description: 'Convention-ready finishes that hold up under stage lights.' },
  { slug: 'beginner', label: 'Beginner', description: 'Everything you need to make your first project a success.' },
];
```

This list is **fixed and independent of what's currently in `articles.json`** — every
category always gets a nav entry and an archive page, including an empty-state one,
rather than the category list being derived from whichever categories happen to have
articles right now. (This mirrors the `.dc` prototype's own `cats` array and matches
`docs/design-prompt-content-taxonomy-mockup.md`'s requirement to mock an empty
category state.)

Per-category article counts are computed at build time from `articles.json` — not
stored in `categories.js`.

## Data contract change

Add a `category` column to the n8n `articles` Data Table, values restricted to the 9
slugs above. This requires a change on the n8n side (outside this repo, per
`CLAUDE.md`'s note that the Articles API workflow lives in n8n) — this spec covers
only this repo's three required update points:

1. **`README.md`** — add `"category": "beginner"` to the expected webhook JSON shape
   example.
2. **`scripts/fetch-articles.mjs`** — pass the field through: `category: row.category
   || ''`. If a row has no category or one that doesn't match a known slug, the
   article still builds normally and still appears in the homepage latest grid — it
   just renders with no badge and is excluded from every category archive page's
   filter. Log `console.warn` for that case (visible in build output, not a build
   failure). This graceful fallback also means deploying this repo's code doesn't
   depend on the n8n column existing yet — real articles simply have no badge until
   the n8n side is updated.
3. **`CLAUDE.md`** — add a `category` row to the field table ("used for": category
   badge, `/category/<slug>` archive page membership, mega-menu counts).

The two sample rows committed in `src/data/articles.json` (for local preview without
a webhook) get a `category` value each, e.g. `"buying-guides"` and `"how-to"`.

## Palette / token changes (`tailwind.config.mjs`)

| token | current | new |
|---|---|---|
| `accent.DEFAULT` | `#1d4e89` | `#e2571f` |
| `accent.dark` | `#143a66` | `#c9451a` |
| `bg-alt` | `#f6f7f9` | `#f5f5f7` |
| `borderRadius.DEFAULT` | `10px` | `18px` |

`ink`, `body`, `muted`, `border`, and `fontFamily.sans` are unchanged — they already
match v3's values closely enough not to warrant a change. The `borderRadius` bump is
called out specifically because it's a single shared token: it affects `ArticleCard`,
the mega-menu panel, the homepage panel blocks, *and* the legal pages, sitewide, not
just the new category surfaces.

## Header + mega-menu (`src/components/Header.astro`)

Restyle to v3's sticky, translucent/blurred header (`backdrop-blur`, semi-transparent
white background, hairline bottom border), orange accent on link hover.

Add a "Categories" item between "Home" and "Shop SprayGunner". **Deliberate deviation
from the prototype:** v3 opens its panel on `:hover`, which doesn't work on touch and
is awkward for keyboard users. This rebuild uses a native `<details><summary>`
element instead — zero JS, works with click/tap/keyboard by default, degrades to a
plain expandable list if styling fails to load. The panel lists all 9 categories from
`categories.js` (label, build-time count, short description), each linking to
`/category/<slug>`, styled per the doc's tokens (`bg-bg`, `border-border`, `rounded`,
the card-hover shadow).

## Homepage (`src/pages/index.astro`)

Sections, top to bottom:

1. **Hero** — existing heading/subtext copy, restyled. Add two CTAs: "Start
   learning" → `/category/beginner`, "Browse reviews" → `/category/reviews`.
2. **Latest articles grid** — existing grid/logic unchanged, `ArticleCard` gains a
   category badge (pill, links to `/category/<slug>`) next to the date — only
   rendered when the article has a recognized category.
3. **Reviews strip** — latest 3 articles with `category === 'reviews'`, compact
   horizontal cards, "View all reviews" → `/category/reviews`. **Omit this entire
   section** if there are currently zero `reviews`-category articles.
4. **Start Here / Troubleshooting** — two-column panel block. Left: latest 3
   `beginner`-category articles, numbered 01/02/03. Right: latest 3
   `troubleshooting`-category articles, each showing its category label. Each
   column (or the whole section, if both are empty) is omitted when its category has
   zero articles.
5. **"Nine ways in"** — grid of all 9 categories from `categories.js`, each showing
   label, description, and build-time count (count may legitimately be 0), linking to
   `/category/<slug>`.

## Category archive pages (new: `src/pages/category/[slug].astro`)

`getStaticPaths()` iterates the **fixed 9-entry `categories.js` list** (not the
categories currently present in `articles.json`), so every category has a real page
from day one, including ones with no articles yet.

Per page: breadcrumb (`Home / <Label>`), `<h1>` = label, description beneath, then
the same `ArticleCard` grid component used on the homepage, filtered to
`article.category === slug`, sorted newest-first (no sort control, per the earlier
decision). Empty state reuses the existing homepage empty-state markup/copy ("New
articles are on the way — check back soon.") with a "Browse all articles" link back
to `/`.

## Post page (`src/pages/posts/[slug].astro`)

Add the same category badge near the existing published-date line, linking to
`/category/<slug>`. Rendered only when `article.category` matches a known slug in
`categories.js`; omitted otherwise (no layout gap, badge simply doesn't render).

## Out of scope

- Live client-side search, live filter chips, and the sort-toggle control from the
  `.dc` prototype — replaced by real page navigation per the decisions above; not
  ported in any form.
- Any n8n-side workflow change — this spec covers only this repo's three data-contract
  touch points (`README.md`, `fetch-articles.mjs`, `CLAUDE.md`); actually adding the
  `category` column in n8n is the user's action outside this repo.
- A `/category` index page listing all categories in one place — not part of v3 and
  not requested; the "Nine ways in" homepage section and the mega-menu already cover
  category discovery.
- Any change to `terms-of-use.astro` / `privacy-policy.astro` beyond what the shared
  `accent`/`borderRadius` token changes apply automatically — no content or
  structural change to those pages.
- Re-evaluating Astro/n8n/Cloudflare Pages, or any other architecture decision already
  settled in `CLAUDE.md` and the prior Tailwind-migration design.

## Testing / verification

No automated test suite exists in this repo; verification is manual, consistent with
existing project practice:

1. Add `category` values to the two sample rows in `src/data/articles.json`, then
   `npx astro dev` (skips the fetch step, uses committed sample data).
2. Homepage: confirm hero CTAs link correctly, latest grid shows badges, and the
   reviews-strip / start-here / troubleshooting sections each render or correctly
   omit themselves based on the sample data's categories.
3. Visit a category page for a category the sample data covers (populated state) and
   one it doesn't (empty state) — confirm both render correctly, including the
   breadcrumb and description.
4. Mega-menu: open/close via mouse click and via keyboard (Tab to the trigger, Enter
   to toggle), at both desktop width and the 640px breakpoint.
5. Post page: confirm the category badge renders and links to the right archive page.
6. `npm run build` completes cleanly (using sample data, no webhook configured
   locally) with no new client-side JS beyond what Tailwind's build already produces.
