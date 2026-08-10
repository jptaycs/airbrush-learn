# Design: Migrate styling to Tailwind CSS

**Date:** 2026-08-11
**Status:** Approved, not yet implemented

## Context

`airbrush-learn` is a static Astro site (SSG, zero client JS by default, no server
runtime) that renders articles sourced from an n8n content pipeline. Styling today is
hand-written CSS in a single file, `src/styles/global.css`, using CSS custom
properties as design tokens (`--color-accent`, `--radius`, etc.), per an explicit
"no CSS framework" convention documented in `CLAUDE.md`.

This design revisits that convention as part of a push toward a more deliberate,
modern/clean ("Apple-style") visual direction (see
`docs/design-prompt-content-taxonomy-mockup.md` §2.5 for the art-direction brief this
supports). It was preceded by a stack sanity-check: Astro + n8n + Cloudflare Pages
were confirmed as the right foundation (strong static-site SEO characteristics, no
specific limitation driving the change) — only the styling *authoring* layer is in
scope here.

## Decision: Tailwind CSS

Evaluated three options:

- **A. Hand-rolled CSS design system** — expand `global.css` with a fuller token set,
  no new dependency. Rejected as the primary path: doesn't meet the explicit ask for
  an actual design *framework*, and consistency would still depend on manual
  discipline rather than tooling.
- **B. Tailwind CSS** — **chosen.** Compiles to static CSS at build time, adding
  **zero runtime JavaScript** — fully compatible with the site's zero-JS, static-SEO
  goals. First-class Astro integration (`@astrojs/tailwind`). Design tokens defined
  once in `tailwind.config.mjs`, same spirit as the current CSS-variable approach,
  authored via utility classes instead of hand-written rules.
- **C. A component/UI library requiring a JS framework** (e.g. React + shadcn/ui) —
  rejected outright. Would require Astro islands/hydration for a static content blog
  that has no interactive UI needs today — directly works against the zero-JS goal.

Brand colors carry over **unchanged** — this is a change to how styles are authored,
not a rebrand. All existing components are migrated in **one full cutover** (not
incremental) given the site's small surface area (5 components, 2 layouts, 4 pages).

## Dependencies

```bash
npm install -D tailwindcss @astrojs/tailwind @tailwindcss/typography
```

`astro.config.mjs` adds the integration alongside the existing sitemap one:

```js
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://airbrush.gallery',
  integrations: [sitemap(), tailwind()],
  output: 'static',
});
```

## Design tokens (`tailwind.config.mjs`)

Every existing CSS variable maps 1:1 into the Tailwind theme — same values, new home:

```js
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
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
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
  plugins: [require('@tailwindcss/typography')],
};
```

## `global.css` after migration

Shrinks to the three Tailwind directives plus resets that are genuinely global and
not expressible as component-level utilities:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

body {
  -webkit-font-smoothing: antialiased;
}
```

All other rules currently in `global.css` (`.site-header`, `.article-card`,
`.article-grid`, `.hero`, `.empty-state`, `.card-date`, `.site-footer`, `.prose *`,
`.post-hero-image`, `.post-meta`, `.post-body`, the `640px` media query, etc.) are
**deleted** once ported to utility classes in their respective components.

## Component migration (full cutover — every file touched)

Utility classes replace the deleted rules directly in markup. Representative
mapping (not exhaustive — apply the same translation pattern to every remaining
rule in the current `global.css`):

| current class | Tailwind utilities |
|---|---|
| `.container` | `mx-auto max-w-wide px-5` |
| `.site-header` | `sticky top-0 z-20 border-b border-border bg-bg` |
| `.article-card` | `border border-border rounded overflow-hidden bg-bg flex flex-col transition hover:shadow-lg hover:-translate-y-0.5` |
| `.article-grid` | `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7 py-8 pb-16` |
| `.hero` | `text-center py-14 pb-8` |
| `.hero h1` | `text-[2.4rem] max-[640px]:text-[1.8rem] text-ink mb-3` |
| `.empty-state` | `text-center py-16 px-5 text-muted` |
| `.card-date` | `text-xs uppercase tracking-wide text-muted` |
| `.site-footer` | `border-t border-border bg-bg-alt mt-16 py-9 text-muted text-sm` |
| `.post-hero-image` | `w-full max-h-[420px] object-cover rounded my-6 mb-2` |
| `.post-meta` | `text-muted text-sm mb-2` |
| `.post-body` | `py-6 pb-16` |

**Files touched:** `src/layouts/BaseLayout.astro`, `src/components/Header.astro`,
`src/components/Footer.astro`, `src/components/ArticleCard.astro`,
`src/pages/index.astro`, `src/pages/posts/[slug].astro`. (`ArticleSchema.astro`
outputs only a `<script type="application/ld+json">` tag — no styling, unaffected.)

## Article body content: the `prose` problem

`content_html` (and, unused today, `page_html`) arrives from n8n as plain, un-classed
HTML and is injected via `set:html`. It cannot carry Tailwind utility classes because
this repo doesn't control that markup. `@tailwindcss/typography`'s `prose` wrapper
solves this by auto-styling nested plain elements (`h1`–`h3`, `p`, `ul`/`ol`,
`blockquote`, `strong`) the same way the current hand-written `.prose` CSS block does:

```astro
<div class="prose prose-neutral max-w-prose mx-auto
  prose-headings:text-ink prose-p:text-body
  prose-a:text-accent prose-blockquote:border-accent prose-blockquote:text-muted">
  <Fragment set:html={article.content_html} />
</div>
```

This is a like-for-like port of the existing visual treatment (heading color, link
color, blockquote border/color), not a redesign of article typography.

## Documentation update

`CLAUDE.md`'s Conventions section currently states:

> No CSS framework. `global.css` uses CSS custom properties (`--color-accent`, etc.)
> at the top — change the palette there, not by hunting through components.

Replace with:

> **Styling is Tailwind CSS.** Design tokens (colors, spacing, radius, fonts) live in
> `tailwind.config.mjs`, mapped from the original brand values — change the palette
> there, not by hunting through components. `global.css` only holds the three
> `@tailwind` directives plus genuinely global element resets (`html`, `img`, `body`
> smoothing). Article body content (`content_html`, rendered via `set:html`) is
> styled through the `@tailwindcss/typography` plugin's `prose` classes, not
> hand-written CSS, since that markup isn't ours to add utility classes to.

## Out of scope

- Any change to the brand palette itself (colors are ported unchanged).
- The content-taxonomy work (categories, archive pages, nav dropdown) — a separate,
  independently-scoped project that will be *built on top of* this Tailwind
  foundation once this migration lands, using the utility vocabulary defined here.
- Any new interactive features (newsletter, community gallery) — unrelated to this
  styling-layer change.
- Re-evaluating Astro, n8n, or Cloudflare Pages — explicitly confirmed as the right
  foundation before this design started.

## Testing / verification

No automated test suite exists in this repo; verification is manual, consistent with
existing project practice:

1. `npm install`, then `npx astro dev` (using committed sample data, skipping the
   fetch step) — visually compare every page (homepage, a post, privacy policy, terms
   of use) against current production rendering. No visual regression expected.
2. `npm run build` — must complete cleanly. Spot-check `dist/` output: no new JS
   files should appear beyond what already exists today — confirms Tailwind added
   zero runtime JavaScript, only compiled CSS.
3. Compare final CSS bundle size against the current `global.css` — Tailwind's
   production build purges unused utilities, so output should be comparable to or
   smaller than today, not bloated.
4. Confirm the `prose` wrapper renders headings/links/blockquotes in the two sample
   articles (`src/data/articles.json`) with the same visual treatment as before.
