# Design: Homepage editorial redesign (follow airbrush.gallery WordPress reference)

**Date:** 2026-08-12
**Status:** Approved, not yet implemented

## Context

The user provided the current live WordPress site (`airbrush.gallery`) homepage as a
new design reference — screenshots plus a full text transcript of every section, in
order: an announcement bar, a dark hero with a featured-article card, a full-bleed
category carousel, a "Latest Articles" grid, a "Start Here" onboarding block, stacked
"Airbrush Reviews" / "How-to & Tutorials" preview lists, a "Stay Sharp" newsletter
signup, a "Community Gallery" section, a "Ready to Level Up" SprayGunner CTA band, and
a three-column dark footer.

This **supersedes** the "modern, clean, Apple-style all-white" art direction from
`docs/design-prompt-content-taxonomy-mockup.md` and
`docs/superpowers/specs/2026-08-12-v3-site-redesign-design.md` (the `.dc` prototype
rebuild just merged to `main`). That prior work's data plumbing — the `category` field,
`src/data/categories.js`, `/category/<slug>` archive pages, `ArticleCard`'s category
prop — all carries forward and is reused here. What changes is the visual language
(dark sections, serif display type, a second accent color) and the homepage's content
structure (several sections here don't exist in the prior design at all).

Decisions made with the user before this spec was written:

- **Newsletter signup and Community Gallery are visual-only.** Neither has a real data
  source or backing service in this codebase. Build them as static markup matching the
  reference's look — the newsletter form has no `<form action>` and submits nowhere;
  the gallery uses placeholder tiles and hardcoded stat text, clearly non-live, same
  precedent as this repo's already-placeholder legal pages.
- **No sliders/carousels.** The reference's full-bleed category carousel and the
  "Latest Articles" prev/next arrows both become static grids — zero client-side JS,
  per this site's standing convention.
- **Full art-direction pivot**, not a blend — dark sections, serif display headings,
  and a teal secondary accent replace the prior all-white minimal direction.
- **Header keeps its shipped structure** (Home / Categories mega-menu / Shop
  SprayGunner via native `<details>/<summary>`, zero JS) — only restyled visually
  (two-tone wordmark). The reference's literal nav items (Learn/Reviews/Guides/How-to)
  and search icon are not adopted — the mega-menu already covers full category
  discovery, and a non-functional search icon would misleadingly imply real search
  exists.
- **Serif font is a Google Fonts webfont** (Playfair Display), not a system stack.
- **Serif heading treatment extends site-wide** — post-page, category-page, and
  legal-page `<h1>`s switch to serif for one consistent editorial feel, not just new
  homepage sections.
- **About/Contact/Showcase footer links are omitted** — those pages don't exist in
  this site and won't be created as part of this pass.

## New tokens (`tailwind.config.mjs`)

```js
theme: {
  extend: {
    colors: {
      // unchanged: ink, body, muted, bg, border, accent { DEFAULT: '#e2571f', dark: '#c9451a' }
      'bg-alt': '#f7f2ea',       // was '#f5f5f7' — now a warm cream, reused as the
                                  // "alternate section" background (Latest Articles,
                                  // Reviews/How-to lists, Community Gallery)
      'surface-dark': '#17140f', // NEW — near-black warm tone: hero, Start Here,
                                  // SprayGunner CTA band, footer
      teal: '#2f7d6c',           // NEW — Airbrush Reviews section underline only,
                                  // no other usage
    },
    fontFamily: {
      // unchanged: sans (existing stack)
      serif: ['"Playfair Display"', 'Georgia', '"Times New Roman"', 'serif'], // NEW
    },
    // unchanged: borderRadius.DEFAULT (18px), maxWidth.prose/wide
  },
}
```

`BaseLayout.astro`'s `<head>` gains the Google Fonts `<link>` tags for Playfair
Display (weights 400, 600, 700, plus italic — the design uses italic for small
eyebrow labels like "Start Here" and "Stay Sharp").

Secondary/body text on the new dark sections (hero subtext, Start Here subtext,
CTA-band subtext, footer body copy) uses Tailwind's built-in neutral gray scale
(e.g. `text-gray-400`) rather than a new custom token — it's a light-on-dark utility
role, not a brand color, so no token is added for it.

## Serif applies site-wide

`font-serif` is added to: every new homepage section heading, the post page's
`<h1>` (`src/pages/posts/[slug].astro`), the category page's `<h1>`
(`src/pages/category/[slug].astro`), and both legal pages' `<h1>`
(`terms-of-use.astro`, `privacy-policy.astro`). Body copy, nav links, card meta
(dates, read time), and buttons stay on the existing sans stack — only display
headings switch.

## Read-time: a new computed value

None of the reference's "X min read" values exist in the data contract. Add one
small shared helper, `src/lib/readTime.js`, exporting `estimateReadMinutes(html)`,
that strips tags and estimates minutes from `content_html`'s word count at ~200
words/minute, rounded up to a minimum of 1. This is computed from real content
length, not fabricated. It's imported in two places: `src/pages/index.astro` (for
the hero's featured-article card, which is bespoke markup, not an `ArticleCard`
instance) and `src/components/ArticleCard.astro` (for the Latest Articles / category
grids).

## Header (`src/components/Header.astro`)

Structure and interaction are **unchanged** from what shipped (sticky, translucent,
`<details>/<summary>` mega-menu over `categories.js`, zero JS). Visual-only change:
the wordmark becomes two-tone — "Airbrush" in `text-ink`, "Learn" in `text-accent`
— matching the reference's logo treatment. The reference's search icon and its
`Learn/Reviews/Guides/How-to` top-nav are **not** adopted (see Context).

## Hero (`src/pages/index.astro`)

Full-bleed `bg-surface-dark` section, two-column on desktop (stacks on mobile,
`max-[640px]:`). Left column: small uppercase eyebrow "The Airbrush Learning Hub" in
`text-accent`, a large `font-serif text-white` `<h1>` ("Master Your Airbrush. Create
Without Limits." — existing copy, kept), light-gray subtext, two CTAs: solid accent
"Start Learning" → `/category/beginner`, white-outlined "Browse Reviews" →
`/category/reviews`. Right column: a **featured-article card** — the single newest
article across all categories (first item of the existing `sorted` array), rendered
as a bordered white card with a slight rotation (`rotate-2` or similar, CSS only), a
"FEATURED" pill, the article's category badge, serif title, and "date · X min read".
Links to that post.

## Category showcase (replaces the reference's carousel)

Static grid — **not** a slider — of all 9 categories from `categories.js`, same data
source and per-category counts as the shipped "Nine ways in" section, but restyled
larger/richer to match the new visual language: `surface-dark`-tinted or
`bg-alt`-tinted cards (no per-category photography exists, so no background images —
text-forward cards, not a literal recreation of the reference's photo slides).

## Latest Articles (`src/pages/index.astro` + `ArticleCard.astro`)

Cream (`bg-alt`) section, serif "Latest Articles" heading, static grid (no
prev/next arrows). `ArticleCard` is restyled to match the reference:

- Category badge moves from beside the date to **overlaid on the image**, top-left,
  as a solid dark pill (matching the reference's black badge-on-photo look).
- A visible **"Read →"** text label at the bottom of the card (in addition to the
  whole-card link), matching the reference.
- Read time added next to the date: "Jun 23, 2026 · 2 min read".
- Title switches to `font-serif`.

This changes `ArticleCard` everywhere it's used — the homepage grid and every
`/category/<slug>` archive page get the same restyled card, keeping one component
instead of a homepage-only variant.

## Start Here (`src/pages/index.astro`)

`surface-dark` section. Italic accent eyebrow "Start Here", serif white "New to
Airbrushing?", subtext, three numbered cards (01/02/03) derived from the latest 3
`beginner`-category articles — same derivation logic already shipped, restyled onto
a dark background with bordered/translucent card panels. Each card gets one small
hand-authored inline `<svg>` icon (search/sliders/wrench-style, matching the
reference's step icons) — no icon library, no external asset, just inline markup.

**Dropping the "Troubleshooting" column** that was paired with Start Here in the
prior design — the reference doesn't pair them, and Troubleshooting is already
represented in the category showcase grid like every other category.

## Reviews / How-to columns (replaces the shipped "reviews strip")

A new `bg-alt` (cream) section immediately below Latest Articles, containing two
full-width stacked sub-sections:

1. **"Airbrush Reviews"** — serif heading, a `border-teal` (or `bg-teal`)
   underline bar, "View all →" → `/category/reviews`, up to 3 latest `reviews`
   articles as horizontal image-left/text-right cards. Omitted entirely if there are
   currently zero `reviews` articles (same conditional-omission pattern already
   shipped).
2. **"How-to & Tutorials"** — identical treatment, `border-accent` underline,
   "View all →" → `/category/how-to`, latest 3 `how-to` articles. Omitted if empty.

This section **replaces** the shipped reviews-strip — there is only one
reviews-focused section on the homepage after this change, not two.

## Newsletter — "Stay Sharp" (visual only)

Solid `bg-accent` band. Italic white "Stay Sharp" eyebrow, serif white heading
("Get airbrush tips, gear reviews & tutorials in your inbox."), a plain `<input
type="email">` + `<button>` "Subscribe" with **no wrapping `<form action>`** — visually
complete, does nothing on click, no JS, no submission target. Small "No spam.
Unsubscribe anytime." disclaimer beneath.

## Community Gallery (visual only, placeholder)

Cream section. Italic accent "Community Gallery" eyebrow, serif "Airbrush Art
Gallery" heading, subtext, a "See Full Gallery" pill rendered as a **styled
non-interactive element** (no `href` — no gallery page exists to link to). Below:
an asymmetric grid of 7 placeholder tiles using the same diagonal-stripe
"image not available" pattern already used elsewhere in this codebase for missing
imagery, each labeled with one of the reference's discipline names — Automotive,
Fine Art, Miniatures, Cosplay, Fabric, Scale Models, Body Art. This is a
**separate, gallery-specific taxonomy**, unrelated to the 9 site categories in
`categories.js` — hardcoded directly in this section, not sourced from anywhere.
Below the grid: a solid-accent "Browse All Artwork" non-interactive pill (same
reasoning as "See Full Gallery") and the reference's stat line, hardcoded as visible
placeholder text: "2,400+ works · 840 artists" — same precedent as this repo's
already-placeholder legal-page copy (per `CLAUDE.md`'s documented known gaps).

## SprayGunner CTA band — "Ready to Level Up"

`surface-dark` section. Italic accent eyebrow, serif white "Shop the gear that pros
trust.", subtext, solid-accent pill "Shop the Gear at SprayGunner" linking to
`https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=cta` (same UTM
convention already used by the header's Shop SprayGunner link).

## Footer redesign (`src/components/Footer.astro`) — site-wide component

`surface-dark` background (shared token with the hero/CTA-band, not a separate dark
value). Two-tone wordmark + one-line tagline. Three link columns:

- **READ:** How-to & Tutorials, Airbrush Reviews, Buying Guides, Troubleshooting,
  **Beginner** (added — the reference's footer omits it, but it's a real category
  in this site and should be discoverable; every other category link in this column
  goes to its `/category/<slug>` page).
- **TOPICS:** Automotive, Miniatures, Cosplay & Body Art, Paints & Colors — same
  `/category/<slug>` links.
- **ELSEWHERE:** SprayGunner Store only (external, same UTM convention). About,
  Contact, and Showcase are omitted — those pages don't exist in this site.

Bottom row (copyright + Privacy Policy / Terms of Use links) is unchanged from what
already ships, restyled for the dark background (light-gray text instead of the
current `text-muted` which is tuned for light backgrounds).

## What does NOT change

- The `category` data contract, `categories.js`, `/category/<slug>` archive pages,
  and the mega-menu's underlying interaction — all carried forward unchanged from
  the prior redesign.
- No new client-side JavaScript anywhere in this pass.
- No real newsletter service, no real gallery data source, no About/Contact/Showcase
  pages — explicitly out of scope, flagged above as future, separately-scoped work.
- The announcement bar at the very top of the reference ("+ Airbrush.Gallery Your #1
  Airbrush Learning Hub...") is **not** part of this design — it reads as a
  dismissible promo banner requiring state (even if just CSS `:target`/checkbox-hack
  dismissal), and wasn't discussed with the user. Treating it as out of scope rather
  than guessing; flag for a follow-up decision if wanted later.

## Testing / verification

No automated test suite exists in this repo; verification is manual, consistent with
existing project practice:

1. The two sample articles committed in `src/data/articles.json` are `buying-guides`
   and `how-to`. Against that data: the How-to column and the hero's featured card
   (newest article overall) should render with real content; the Reviews column and
   the Start Here section (no `reviews`/`beginner` sample articles) should correctly
   omit themselves — the same conditional-omission pattern already verified in the
   prior redesign. Optionally add a `reviews`- and a `beginner`-category sample
   article temporarily to also preview those sections populated, then revert.
2. `npx astro dev` — visually check the homepage top to bottom against the
   reference: hero (featured card, both CTAs), category showcase grid, Latest
   Articles (badge-on-image, read time, "Read →"), How-to column (Reviews omitted
   per current sample data), newsletter band (form does nothing), Community Gallery
   (placeholder tiles + stat line), SprayGunner CTA band, footer (three columns,
   correct links, Beginner present in READ).
3. Confirm serif renders correctly on: homepage headings, a post page `<h1>`, a
   category page `<h1>`, both legal pages' `<h1>`.
4. `npm run build` — completes (ignoring the known pre-existing `@astrojs/sitemap`
   crash), zero new client-side JS files in `dist/_astro/`.
5. Confirm the newsletter input/button and the two Community Gallery CTAs do
   nothing on click/submit (no navigation, no console errors from a missing form
   target).
