# Homepage Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage (and extend a few shared components) to match the airbrush.gallery WordPress reference's editorial visual language — dark hero, serif display type, a richer category showcase, Start Here, Reviews/How-to columns, a visual-only newsletter and community gallery, a SprayGunner CTA band, and a redesigned dark footer — while keeping the category data plumbing from the prior redesign untouched and adding zero client-side JavaScript.

**Architecture:** New design tokens (`surface-dark`, `teal`, cream `bg-alt`, a `serif` font family) live in `tailwind.config.mjs`; Playfair Display loads via a Google Fonts `<link>` in `BaseLayout`. A new shared helper, `src/lib/readTime.js`, computes "X min read" from `content_html`'s word count — real content, not fabricated — reused by `ArticleCard` and the homepage's featured-article card. `ArticleCard` is restyled once and that change propagates to every page that uses it (homepage, all 9 category pages). `index.astro` is rewritten in one pass since its sections share frontmatter data derivations. `Footer.astro` is redesigned as a shared component (affects every page). Post/category/legal-page `<h1>`s pick up the new serif font for a consistent site-wide feel.

**Design doc:** `docs/superpowers/specs/2026-08-12-homepage-editorial-redesign-design.md`

## Global Constraints

- Newsletter and Community Gallery sections are **visual-only** — no `<form action>`, no real submission target, no gallery page to link to. Buttons/links with nothing to point at render as non-interactive `<span>`s, not `<a href="#">`.
- **No sliders/carousels, no client-side JavaScript anywhere in this plan.** The reference's category carousel and "Latest Articles" arrows both become static grids.
- The 640px breakpoint (`max-[640px]:`) is the only fixed breakpoint in this codebase; any layout that needs to collapse for narrower viewports uses the self-responsive `grid-cols-[repeat(auto-fit,minmax(Npx,1fr))]` pattern already used throughout — never introduce Tailwind's default `sm:`/`md:`/`lg:` breakpoints.
- Brand tokens after this work: `bg-alt` changes from `#f5f5f7` to `#f7f2ea` (warm cream); two new tokens, `surface-dark: '#17140f'` and `teal: '#2f7d6c'`; new `fontFamily.serif` (Playfair Display). `ink`, `body`, `muted`, `border`, `accent`/`accent-dark`, `borderRadius.DEFAULT`, `maxWidth`, and `fontFamily.sans` are unchanged.
- Serif (`font-serif`) applies to: every new homepage section heading, the post-page `<h1>`, the category-page `<h1>`, and both legal pages' `<h1>`. Body copy, nav, card meta (dates/read-time), and buttons stay on the sans stack.
- **No automated test suite exists in this repo.** Verification throughout is manual: `npx astro build`/`npx astro dev` against the committed sample data, then `grep`/`find` on `dist/`.
- **Always build with `npx astro build` / `npx astro dev`, never `npm run build` / `npm run dev`** — no live n8n webhook exists in this workspace; the bare `npx astro` commands build directly against the committed sample `src/data/articles.json`.
- **Never run `npx astro dev` inside a subagent dispatch.** It starts a long-running dev server that never exits on its own — this stalled two implementer runs in the prior redesign. Any interactive/visual-check step is for a human with a browser, done separately; subagents verify via `npx astro build` + `grep`/`find` on `dist/` only.
- **`grep -c` undercounts occurrences on this project's build output.** Astro emits each page as one minified line, so `grep -c 'pattern' file` returns `1` (matching *lines*) regardless of how many times `pattern` actually appears. Always use `grep -o 'pattern' file | wc -l` to count occurrences — this exact mistake caused stalls in the prior redesign.
- **Known pre-existing bug, out of scope:** `npx astro build` crashes at the very end with `Cannot read properties of undefined (reading 'reduce')` inside `@astrojs/sitemap`'s `astro:build:done` hook, AFTER all pages are already written to `dist/`. Expect it, don't fix it; verify actual output with `find`/`grep` on `dist/`, not the process's exit code.
- Every task must leave the site in a working, visually-correct state.

---

### Task 1: Design tokens, Google Font, and the read-time helper

**Files:**
- Modify: `tailwind.config.mjs`
- Modify: `src/layouts/BaseLayout.astro`
- Create: `src/lib/readTime.js`

**Interfaces:**
- Produces: Tailwind tokens `bg-alt` (new value `#f7f2ea`), `surface-dark` (`#17140f`), `teal` (`#2f7d6c`), `fontFamily.serif` — every later task's utility classes reference these by name.
- Produces: `estimateReadMinutes(html: string): number`, a named export from `src/lib/readTime.js` — imported by Task 3 (`ArticleCard.astro`) and Task 4 (`index.astro`'s featured-article card).

- [ ] **Step 1: Update `tailwind.config.mjs`**

Change:
```js
        'bg-alt': '#f5f5f7',
        border: '#e5e7eb',
        accent: { DEFAULT: '#e2571f', dark: '#c9451a' },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
```
to:
```js
        'bg-alt': '#f7f2ea',
        border: '#e5e7eb',
        accent: { DEFAULT: '#e2571f', dark: '#c9451a' },
        'surface-dark': '#17140f',
        teal: '#2f7d6c',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        serif: ['"Playfair Display"', 'Georgia', '"Times New Roman"', 'serif'],
      },
```

- [ ] **Step 2: Add the Google Fonts link to `BaseLayout.astro`**

Change:
```astro
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
```
to:
```astro
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet" />
  <title>{title}</title>
```

- [ ] **Step 3: Create `src/lib/readTime.js`**

```js
export function estimateReadMinutes(html) {
  const text = String(html || '').replace(/<[^>]*>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
```

- [ ] **Step 4: Verify the token/font config**

Run: `grep -n "surface-dark\|teal:" tailwind.config.mjs`
Expected: both lines present with the values from Step 1.

Run: `grep -n "fonts.googleapis.com" src/layouts/BaseLayout.astro`
Expected: 3 matches (the two `preconnect` links and the stylesheet link).

Run: `npx astro build`
Expected: completes (ignore the known pre-existing sitemap crash — see Global Constraints).

Run: `grep -l "f7f2ea" dist/_astro/*.css`
Expected: at least one match — `bg-alt` is already used by existing components (e.g. the mega-menu hover state), so its new value compiles even before this plan's other tasks run.

- [ ] **Step 5: Verify the read-time helper**

Run: `node -e "import('./src/lib/readTime.js').then(m => console.log(m.estimateReadMinutes('<p>' + 'word '.repeat(400) + '</p>')))"`
Expected: `2` (400 words / 200 wpm = 2).

Run: `node -e "import('./src/lib/readTime.js').then(m => console.log(m.estimateReadMinutes('')))"`
Expected: `1` (minimum floor, no crash on empty input).

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.mjs src/layouts/BaseLayout.astro src/lib/readTime.js
git commit -m "Add editorial redesign tokens, serif Google Font, and read-time helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Two-tone header wordmark

**Files:**
- Modify: `src/components/Header.astro`

**Interfaces:**
- No new interface — purely visual, no props/exports change.

- [ ] **Step 1: Update the wordmark markup**

Change:
```astro
    <a href="/" class="flex items-center gap-2.5 font-bold text-[1.15rem] text-ink hover:no-underline">
      <img src="/logo.png" alt="Airbrush Learn" class="h-[34px] w-auto" />
      <span>Airbrush Learn</span>
    </a>
```
to:
```astro
    <a href="/" class="flex items-center gap-2.5 font-bold text-[1.15rem] hover:no-underline">
      <img src="/logo.png" alt="Airbrush Learn" class="h-[34px] w-auto" />
      <span class="text-ink">Airbrush <span class="text-accent">Learn</span></span>
    </a>
```

- [ ] **Step 2: Verify**

Run: `npx astro build`
Expected: completes.

Run: `grep -o '<span class="text-accent">Learn</span>' dist/index.html`
Expected: match found.

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.astro
git commit -m "Restyle header wordmark two-tone (Airbrush ink, Learn accent)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Restyle `ArticleCard`

**Files:**
- Modify: `src/components/ArticleCard.astro`
- Modify: `src/pages/category/[slug].astro`

**Interfaces:**
- Consumes: `estimateReadMinutes` from `src/lib/readTime.js` (Task 1).
- Produces: `ArticleCard`'s `Props` gains `content_html?: string` (used to compute read time). Every caller must now pass it — `category/[slug].astro` is updated in this task; `index.astro`'s call sites are written fresh in Task 4 and will already include it.

Implementation note: the category badge moves onto the image as a non-interactive
overlay (`<span>`, not a link) — it sits inside the image's own `<a>` wrapper, and a
nested `<a>` inside that anchor would be invalid HTML. This matches the WordPress
reference, where the Latest Articles badges aren't independently clickable either
(only the image/title area is).

- [ ] **Step 1: Replace `ArticleCard.astro`**

```astro
---
import { categories } from '../data/categories.js';
import { estimateReadMinutes } from '../lib/readTime.js';

interface Props {
  slug: string;
  title: string;
  excerpt: string;
  published_date: string;
  category?: string;
  content_html?: string;
}
const { slug, title, excerpt, published_date, category, content_html } = Astro.props;
const cat = categories.find((c) => c.slug === category);
const readMinutes = estimateReadMinutes(content_html);
---
<article class="border border-border rounded overflow-hidden bg-bg flex flex-col transition-[box-shadow,transform] duration-150 ease-[ease] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
  <a href={`/posts/${slug}`} class="relative block hover:no-underline">
    <img src={`/images/${slug}.png`} alt={title} loading="lazy" width="600" height="400" class="aspect-[3/2] object-cover w-full" />
    {cat && (
      <span class="absolute top-3 left-3 text-[0.65rem] text-white uppercase tracking-[0.05em] font-bold bg-black/75 rounded-full px-2.5 py-1">
        {cat.label}
      </span>
    )}
  </a>
  <div class="pt-4 px-[18px] pb-5 flex flex-col flex-1">
    <span class="text-[0.8rem] text-muted uppercase tracking-[0.04em] mb-2">{published_date} · {readMinutes} min read</span>
    <a href={`/posts/${slug}`} class="text-inherit no-underline hover:no-underline flex flex-col flex-1">
      <h2 class="font-serif text-[1.15rem] text-ink mb-2">{title}</h2>
      <p class="text-muted text-[0.92rem] mb-3 flex-1">{excerpt}</p>
      <span class="text-accent-dark font-semibold text-[0.85rem]">Read &rarr;</span>
    </a>
  </div>
</article>
```

- [ ] **Step 2: Pass `content_html` from `category/[slug].astro`**

Change:
```astro
          <ArticleCard
            slug={article.slug}
            title={article.title}
            excerpt={article.excerpt}
            published_date={article.published_date}
            category={article.category}
          />
```
to:
```astro
          <ArticleCard
            slug={article.slug}
            title={article.title}
            excerpt={article.excerpt}
            published_date={article.published_date}
            category={article.category}
            content_html={article.content_html}
          />
```

- [ ] **Step 3: Verify**

Run: `npx astro build`
Expected: completes.

Run: `grep -o 'bg-black/75' dist/category/buying-guides/index.html`
Expected: match found (badge-on-image styling present on the populated category page).

Run: `grep -o 'min read' dist/category/buying-guides/index.html`
Expected: match found.

Run: `grep -o 'min read' dist/index.html`
Expected: match found (homepage's own Latest Articles grid, still passing the old props at this point — Task 4 hasn't run yet, so this checks against whatever `index.astro` currently renders; if this doesn't match yet because `index.astro` hasn't been updated to pass `content_html`, that's expected and fine — Task 4 handles it. Don't treat a missing match here as a failure; only the `category/buying-guides` checks above are required to pass in this task.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ArticleCard.astro "src/pages/category/[slug].astro"
git commit -m "Restyle ArticleCard: badge-on-image, read time, serif title

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Rebuild the homepage

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `categories` (Task, prior redesign), `estimateReadMinutes` (Task 1), `ArticleCard` with its `content_html` prop (Task 3).
- Produces: links to `/category/beginner`, `/category/reviews`, `/category/how-to`, and all 9 `/category/<slug>` routes — all already exist from the prior redesign.

- [ ] **Step 1: Replace `src/pages/index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ArticleCard from '../components/ArticleCard.astro';
import { categories } from '../data/categories.js';
import { estimateReadMinutes } from '../lib/readTime.js';
import articles from '../data/articles.json';

const sorted = [...articles].sort((a, b) =>
  a.published_date < b.published_date ? 1 : -1
);

const featured = sorted[0];
const featuredCat = featured ? categories.find((c) => c.slug === featured.category) : null;
const featuredReadMinutes = featured ? estimateReadMinutes(featured.content_html) : 0;

const byCategory = (slug) => sorted.filter((a) => a.category === slug);

const reviewArticles = byCategory('reviews').slice(0, 3);
const howToArticles = byCategory('how-to').slice(0, 3);
const beginnerArticles = byCategory('beginner').slice(0, 3);

const categoryCounts = categories.map((cat) => ({
  ...cat,
  count: sorted.filter((a) => a.category === cat.slug).length,
}));

const stepIcons = [
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="7" cy="18" r="2"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 1 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>',
];

const galleryTiles = [
  { label: 'Automotive', tall: true },
  { label: 'Fine Art', tall: false },
  { label: 'Miniatures', tall: false },
  { label: 'Cosplay', tall: false },
  { label: 'Fabric', tall: true },
  { label: 'Scale Models', tall: false },
  { label: 'Body Art', tall: false },
];
---
<BaseLayout
  title="Airbrush Learn — Tutorials, Reviews & Buying Guides for Airbrush Artists"
  description="Free airbrush tutorials, honest gear reviews, and buying guides written for painters who spray every day."
  canonicalPath="/"
>
  <section class="bg-surface-dark py-20 max-[640px]:py-14">
    <div class="mx-auto max-w-wide px-5 grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-12 items-center">
      <div>
        <span class="text-accent text-[0.9rem] font-semibold uppercase tracking-[0.04em]">The Airbrush Learning Hub</span>
        <h1 class="font-serif text-white text-[3.2rem] leading-[1.05] mt-4 max-[640px]:text-[2.1rem]">Master Your Airbrush. Create Without Limits.</h1>
        <p class="text-gray-400 text-[1.1rem] mt-5 max-w-[480px]">Tutorials, gear reviews and troubleshooting guides written by painters who spray every day.</p>
        <div class="flex flex-wrap gap-3 mt-8">
          <a href="/category/beginner" class="inline-block rounded-full bg-accent text-white px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90">Start Learning</a>
          <a href="/category/reviews" class="inline-block rounded-full border border-white/30 text-white px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:bg-white/10">Browse Reviews</a>
        </div>
      </div>
      {featured && (
        <a href={`/posts/${featured.slug}`} class="block hover:no-underline">
          <div class="rotate-2 bg-white p-3 pb-5 rounded shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
            <div class="relative">
              <span class="absolute top-3 left-3 text-[0.65rem] text-white uppercase tracking-[0.05em] font-bold bg-accent rounded-full px-2.5 py-1">Featured</span>
              <img src={`/images/${featured.slug}.png`} alt={featured.title} width="600" height="400" class="aspect-[3/2] object-cover w-full rounded-sm" />
            </div>
            <div class="pt-4 px-1">
              {featuredCat && <span class="block text-[0.7rem] text-muted uppercase tracking-[0.05em] font-bold mb-1.5">{featuredCat.label}</span>}
              <h2 class="font-serif text-ink text-[1.15rem] leading-snug">{featured.title}</h2>
              <span class="block mt-2 text-[0.78rem] text-muted">{featured.published_date} · {featuredReadMinutes} min read</span>
            </div>
          </div>
        </a>
      )}
    </div>
  </section>

  <section class="py-16">
    <div class="mx-auto max-w-wide px-5">
      <div class="text-center mb-10">
        <h2 class="font-serif text-ink text-[2rem]">Nine ways in.</h2>
        <p class="mt-2 text-muted text-[1rem] max-w-[480px] mx-auto">Every article lives in exactly one category, so you always know where to look next.</p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
        {categoryCounts.map((cat) => (
          <a href={`/category/${cat.slug}`} class="block p-7 rounded-xl bg-surface-dark hover:no-underline hover:opacity-90">
            <span class="block font-serif text-white text-[1.2rem]">{cat.label}</span>
            <span class="block mt-2 text-gray-400 text-[0.9rem]">{cat.description}</span>
            <span class="block mt-4 font-mono text-[0.7rem] text-accent font-semibold">{cat.count} article{cat.count === 1 ? '' : 's'}</span>
          </a>
        ))}
      </div>
    </div>
  </section>

  <section class="bg-bg-alt py-16">
    <div class="mx-auto max-w-wide px-5">
      <h2 class="font-serif text-ink text-[2rem] mb-8">Latest Articles</h2>
      {sorted.length === 0 ? (
        <div class="text-center py-16 px-5 text-muted">
          <p>New articles are on the way — check back soon.</p>
        </div>
      ) : (
        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7">
          {sorted.map((article) => (
            <ArticleCard
              slug={article.slug}
              title={article.title}
              excerpt={article.excerpt}
              published_date={article.published_date}
              category={article.category}
              content_html={article.content_html}
            />
          ))}
        </div>
      )}
    </div>
  </section>

  {beginnerArticles.length > 0 && (
    <section class="bg-surface-dark py-16">
      <div class="mx-auto max-w-wide px-5 text-center">
        <span class="text-accent text-[0.9rem] font-semibold italic">Start Here</span>
        <h2 class="font-serif text-white text-[2rem] mt-2">New to Airbrushing?</h2>
        <p class="text-gray-400 text-[1.05rem] mt-3 max-w-[480px] mx-auto">Follow these steps and you'll be painting like a pro.</p>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mt-10 text-left">
          {beginnerArticles.map((article, i) => (
            <a href={`/posts/${article.slug}`} class="block p-7 rounded-xl border border-white/10 bg-white/5 hover:no-underline hover:bg-white/10">
              <div class="flex items-start justify-between">
                <span class="block font-mono text-[1.6rem] font-bold text-accent">0{i + 1}</span>
                <span class="text-accent" set:html={stepIcons[i]} />
              </div>
              <span class="block mt-3 font-serif text-white text-[1.05rem] leading-snug">{article.title}</span>
              <span class="block mt-3 text-accent-dark font-semibold text-[0.85rem]">Read &rarr;</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )}

  {(reviewArticles.length > 0 || howToArticles.length > 0) && (
    <section class="bg-bg-alt pb-16">
      <div class="mx-auto max-w-wide px-5">
        {reviewArticles.length > 0 && (
          <div class="mb-14">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h2 class="font-serif text-ink text-[1.7rem]">Airbrush Reviews</h2>
              <a href="/category/reviews" class="text-accent-dark font-semibold text-[0.9rem] hover:no-underline">View all &rarr;</a>
            </div>
            <div class="h-[3px] bg-teal w-16 mb-7"></div>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              {reviewArticles.map((article) => (
                <a href={`/posts/${article.slug}`} class="flex gap-4 hover:no-underline">
                  <img src={`/images/${article.slug}.png`} alt={article.title} loading="lazy" width="200" height="140" class="w-28 aspect-[3/2] object-cover rounded flex-none" />
                  <span class="block">
                    <span class="block font-serif text-ink text-[1rem] leading-snug">{article.title}</span>
                    <span class="block mt-2 text-muted text-[0.78rem]">{article.published_date}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
        {howToArticles.length > 0 && (
          <div>
            <div class="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h2 class="font-serif text-ink text-[1.7rem]">How-to & Tutorials</h2>
              <a href="/category/how-to" class="text-accent-dark font-semibold text-[0.9rem] hover:no-underline">View all &rarr;</a>
            </div>
            <div class="h-[3px] bg-accent w-16 mb-7"></div>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              {howToArticles.map((article) => (
                <a href={`/posts/${article.slug}`} class="flex gap-4 hover:no-underline">
                  <img src={`/images/${article.slug}.png`} alt={article.title} loading="lazy" width="200" height="140" class="w-28 aspect-[3/2] object-cover rounded flex-none" />
                  <span class="block">
                    <span class="block font-serif text-ink text-[1rem] leading-snug">{article.title}</span>
                    <span class="block mt-2 text-muted text-[0.78rem]">{article.published_date}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )}

  <section class="bg-accent py-16">
    <div class="mx-auto max-w-wide px-5 text-center">
      <span class="text-white/90 italic text-[0.9rem] font-semibold">Stay Sharp</span>
      <h2 class="font-serif text-white text-[2rem] mt-2 max-w-[560px] mx-auto">Get airbrush tips, gear reviews &amp; tutorials in your inbox.</h2>
      <div class="flex flex-wrap justify-center gap-2 mt-7 max-w-[440px] mx-auto">
        <input type="email" placeholder="Enter your email address" class="flex-1 min-w-[220px] rounded-full px-5 py-3 text-[0.95rem] border-0" />
        <button type="button" class="rounded-full bg-ink text-white px-6 py-3 text-[0.95rem] font-semibold">Subscribe</button>
      </div>
      <p class="text-white/70 text-[0.78rem] mt-3">No spam. Unsubscribe anytime.</p>
    </div>
  </section>

  <section class="bg-bg-alt py-16">
    <div class="mx-auto max-w-wide px-5">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <span class="text-accent italic text-[0.9rem] font-semibold">Community Gallery</span>
          <h2 class="font-serif text-ink text-[2rem] mt-2">Airbrush Art Gallery</h2>
          <p class="text-muted text-[1rem] mt-2 max-w-[480px]">Real work from real airbrush artists — automotive, miniatures, cosplay &amp; more.</p>
        </div>
        <span class="inline-block rounded-full border border-border text-ink px-5 py-2.5 text-[0.9rem] font-semibold">See Full Gallery &rarr;</span>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        {galleryTiles.map((tile) => (
          <div class={`rounded-xl overflow-hidden bg-bg flex items-end p-4 ${tile.tall ? 'aspect-[3/4]' : 'aspect-[4/3]'}`} style="background-image:repeating-linear-gradient(135deg,rgba(23,20,15,0.08) 0 1px,transparent 1px 10px)">
            <span class="text-[0.85rem] font-semibold text-ink">{tile.label}</span>
          </div>
        ))}
      </div>
      <div class="flex flex-wrap items-center gap-4 mt-8">
        <span class="inline-block rounded-full bg-accent text-white px-6 py-3 text-[0.95rem] font-semibold">Browse All Artwork &rarr;</span>
        <span class="text-muted text-[0.85rem]">2,400+ works · 840 artists</span>
      </div>
    </div>
  </section>

  <section class="bg-surface-dark py-20">
    <div class="mx-auto max-w-wide px-5 text-center">
      <span class="text-accent italic text-[0.9rem] font-semibold">Ready to Level Up?</span>
      <h2 class="font-serif text-white text-[2.2rem] mt-2">Shop the gear that pros trust.</h2>
      <p class="text-gray-400 text-[1.05rem] mt-3 max-w-[480px] mx-auto">Airbrushes, compressors, paints &amp; accessories — everything you need in one place.</p>
      <a href="https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=cta" target="_blank" rel="noopener" class="inline-block mt-7 rounded-full bg-accent text-white px-7 py-3.5 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90">Shop the Gear at SprayGunner &rarr;</a>
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 2: Verify the always-on sections**

Run: `npx astro build`
Expected: completes.

Run: `grep -o "Master Your Airbrush" dist/index.html`
Expected: match found.

Run: `grep -o "Nine ways in" dist/index.html`
Expected: match found.

Run: `grep -o "Latest Articles" dist/index.html`
Expected: match found.

Run: `grep -o "Stay Sharp" dist/index.html`
Expected: match found.

Run: `grep -o "Airbrush Art Gallery" dist/index.html`
Expected: match found.

Run: `grep -o "Shop the Gear at SprayGunner" dist/index.html`
Expected: match found.

Run: `grep -o "FEATURED\|Featured" dist/index.html`
Expected: match found (the sample data's newest article, `single-vs-dual-action-airbrush`, becomes the featured card since it has the most recent `published_date`).

- [ ] **Step 3: Verify conditional sections against the current sample data**

The two committed sample articles are `buying-guides` and `how-to` — neither is
`reviews` nor `beginner`.

Run: `grep -q "Start Here" dist/index.html; echo "exit: $?"`
Expected: `exit: 1` (not found — no `beginner` sample article).

Run: `grep -q "Airbrush Reviews" dist/index.html; echo "exit: $?"`
Expected: `exit: 1` (not found — no `reviews` sample article).

Run: `grep -o "Tutorials" dist/index.html`
Expected: match found (the `how-to` sample article populates the "How-to & Tutorials" column — grepping just "Tutorials" avoids any ambiguity over how the template's literal `&` character gets encoded in the compiled HTML).

- [ ] **Step 4: Verify no client-side JS was introduced**

Run: `ls dist/_astro/*.js 2>/dev/null; echo "exit: $?"`
Expected: `exit: 1` (no JS files).

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "Rebuild homepage: dark hero, category showcase, Start Here, Reviews/How-to columns, newsletter, community gallery, SprayGunner CTA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Redesign the footer

**Files:**
- Modify: `src/components/Footer.astro`

**Interfaces:**
- No new interface — `Footer` takes no props, unchanged.

- [ ] **Step 1: Replace `Footer.astro`**

```astro
---
const year = new Date().getFullYear();
const readLinks = [
  { label: 'How-to & Tutorials', href: '/category/how-to' },
  { label: 'Airbrush Reviews', href: '/category/reviews' },
  { label: 'Buying Guides', href: '/category/buying-guides' },
  { label: 'Troubleshooting', href: '/category/troubleshooting' },
  { label: 'Beginner', href: '/category/beginner' },
];
const topicLinks = [
  { label: 'Automotive', href: '/category/automotive' },
  { label: 'Miniatures', href: '/category/miniatures' },
  { label: 'Cosplay & Body Art', href: '/category/cosplay-body-art' },
  { label: 'Paints & Colors', href: '/category/paints-colors' },
];
---
<footer class="bg-surface-dark pt-16 pb-8">
  <div class="mx-auto max-w-wide px-5">
    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-10 pb-12 border-b border-white/10">
      <div class="max-w-[320px]">
        <span class="font-bold text-[1.15rem]"><span class="text-white">Airbrush</span> <span class="text-accent">Learn</span></span>
        <p class="text-gray-400 text-[0.85rem] mt-3">The definitive resource for airbrush artists at every level — from first-timers to competition painters.</p>
      </div>
      <div>
        <span class="block text-gray-500 text-[0.72rem] font-semibold uppercase tracking-[0.06em] mb-4">Read</span>
        <ul class="list-none m-0 p-0 grid gap-2.5">
          {readLinks.map((l) => (
            <li><a href={l.href} class="text-gray-300 hover:text-accent">{l.label}</a></li>
          ))}
        </ul>
      </div>
      <div>
        <span class="block text-gray-500 text-[0.72rem] font-semibold uppercase tracking-[0.06em] mb-4">Topics</span>
        <ul class="list-none m-0 p-0 grid gap-2.5">
          {topicLinks.map((l) => (
            <li><a href={l.href} class="text-gray-300 hover:text-accent">{l.label}</a></li>
          ))}
        </ul>
      </div>
      <div>
        <span class="block text-gray-500 text-[0.72rem] font-semibold uppercase tracking-[0.06em] mb-4">Elsewhere</span>
        <ul class="list-none m-0 p-0 grid gap-2.5">
          <li><a href="https://spraygunner.com/" target="_blank" rel="noopener" class="text-gray-300 hover:text-accent">SprayGunner Store</a></li>
        </ul>
      </div>
    </div>
    <div class="pt-6 flex flex-wrap gap-3 items-center justify-between text-gray-500 text-[0.82rem]">
      <span>&copy; {year} SprayGunner. All rights reserved.</span>
      <span>
        <a href="/privacy-policy" class="text-gray-400 hover:text-accent">Privacy Policy</a>
        &nbsp;&middot;&nbsp;
        <a href="/terms-of-use" class="text-gray-400 hover:text-accent">Terms of Use</a>
      </span>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Verify**

Run: `npx astro build`
Expected: completes.

Run: `grep -c 'href="/category/' dist/index.html`
Expected: this uses `grep -c`, which counts matching *lines*, not occurrences — on this project's minified single-line HTML output it will report `1` even though the footer alone adds 9 more category links (see Global Constraints). Use the corrected form instead:

Run: `grep -o 'href="/category/' dist/index.html | wc -l`
Expected: a number noticeably higher than before this task (footer's 9 category links added on top of whatever the homepage body already contributes).

Run: `grep -o "Beginner" dist/index.html`
Expected: match found (footer's READ column includes it, per Global Constraints/design doc — this category was missing from the WordPress reference's own footer but is intentionally added here).

Run: `grep -q "About\|Contact\|Showcase" dist/index.html; echo "exit: $?"`
Expected: `exit: 1` (not found — these pages don't exist and are intentionally omitted).

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.astro
git commit -m "Redesign footer: dark background, three-column link layout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Serif headings on post, category, and legal pages

**Files:**
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/pages/category/[slug].astro`
- Modify: `src/pages/privacy-policy.astro`
- Modify: `src/pages/terms-of-use.astro`

**Interfaces:**
- No new interface — purely visual, adds one class to one element per file.

- [ ] **Step 1: `posts/[slug].astro`**

Change:
```astro
      <h1 class="max-[640px]:text-[1.7rem]">{article.title}</h1>
```
to:
```astro
      <h1 class="font-serif max-[640px]:text-[1.7rem]">{article.title}</h1>
```

- [ ] **Step 2: `category/[slug].astro`**

Change:
```astro
      <h1 class="max-[640px]:text-[1.7rem] text-ink text-[2.25rem]">{cat.label}</h1>
```
to:
```astro
      <h1 class="font-serif max-[640px]:text-[1.7rem] text-ink text-[2.25rem]">{cat.label}</h1>
```

- [ ] **Step 3: `privacy-policy.astro`**

Change:
```astro
      <h1 class="max-[640px]:text-[1.7rem]">Privacy Policy</h1>
```
to:
```astro
      <h1 class="font-serif max-[640px]:text-[1.7rem]">Privacy Policy</h1>
```

- [ ] **Step 4: `terms-of-use.astro`**

Change:
```astro
      <h1 class="max-[640px]:text-[1.7rem]">Terms of Use</h1>
```
to:
```astro
      <h1 class="font-serif max-[640px]:text-[1.7rem]">Terms of Use</h1>
```

- [ ] **Step 5: Verify**

Run: `npx astro build`
Expected: completes.

Run: `grep -l 'font-serif' dist/posts/single-vs-dual-action-airbrush/index.html dist/category/buying-guides/index.html dist/privacy-policy/index.html dist/terms-of-use/index.html`
Expected: all 4 file paths printed, one per line — `grep -l` (not `-o`) lists only files containing at least one match, so all 4 must appear or one was missed.

- [ ] **Step 6: Commit**

```bash
git add "src/pages/posts/[slug].astro" "src/pages/category/[slug].astro" src/pages/privacy-policy.astro src/pages/terms-of-use.astro
git commit -m "Apply serif heading treatment to post, category, and legal pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Update project-structure docs, full verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete finished feature from Tasks 1–6 — this task only documents and verifies.

- [ ] **Step 1: Update `CLAUDE.md`'s project structure tree**

Change:
```
scripts/fetch-articles.mjs   # the only place that talks to n8n
src/data/articles.json       # generated; sample data committed for local preview
src/data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
src/layouts/BaseLayout.astro # <head>, SEO/OG meta, header, footer — every page uses this
```
to:
```
scripts/fetch-articles.mjs   # the only place that talks to n8n
src/data/articles.json       # generated; sample data committed for local preview
src/data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
src/lib/readTime.js          # estimateReadMinutes(html) — computed from content_html word count
src/layouts/BaseLayout.astro # <head>, SEO/OG meta, header, footer — every page uses this
```

- [ ] **Step 2: Update `README.md`'s project structure tree**

Change:
```
│   ├── data/articles.json       # generated at build time (gitignored) — sample data committed for local preview
│   ├── data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
│   ├── layouts/BaseLayout.astro # shared <head>, header, footer, SEO/OG meta
```
to:
```
│   ├── data/articles.json       # generated at build time (gitignored) — sample data committed for local preview
│   ├── data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
│   ├── lib/readTime.js          # estimateReadMinutes(html) — computed from content_html word count
│   ├── layouts/BaseLayout.astro # shared <head>, header, footer, SEO/OG meta
```

- [ ] **Step 3: Full build verification**

Run: `npx astro build`
Expected: completes (ignore the known pre-existing sitemap crash).

Run: `find dist -name 'index.html' | sort | wc -l`
Expected: `14` — unchanged page count from the prior redesign (this plan restyles existing pages, adds no new routes).

Run: `ls dist/_astro/*.js 2>/dev/null; echo "exit: $?"`
Expected: `exit: 1` — zero client-side JavaScript in the entire finished build.

- [ ] **Step 4: Full visual verification (human, with a browser — not a subagent step)**

Run `npx astro dev` and check every page: `/`, `/posts/single-vs-dual-action-airbrush`,
`/posts/how-to-clean-an-airbrush`, `/privacy-policy`, `/terms-of-use`, and at least
`/category/buying-guides` (populated) and `/category/reviews` (empty). Confirm: serif
headings render correctly (Playfair Display loaded), the homepage's dark sections
have adequate contrast, the featured-article card in the hero looks right at both
desktop and the 640px breakpoint, the newsletter input/button do nothing on
click/submit, and the mega-menu (from the prior redesign) still opens/closes
correctly on the new header styling.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Document read-time helper in project structure docs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
