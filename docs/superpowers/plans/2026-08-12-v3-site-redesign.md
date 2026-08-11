# v3 Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `airbrush-learn` to match the `Airbrush Learn Site v3.dc.html` prototype: a `category` taxonomy end to end, a restyled header with a categories mega-menu, a redesigned homepage, new `/category/<slug>` archive pages, and category badges on cards and the post page — with zero added client-side JavaScript and zero automated test suite (none exists in this repo).

**Architecture:** Add `category` as a passthrough field in `scripts/fetch-articles.mjs`, backed by a fixed, repo-local taxonomy (`src/data/categories.js`) that supplies the human-facing label/description n8n doesn't provide. Every category always gets a real static page (`src/pages/category/[slug].astro`), generated from the fixed taxonomy list, not from whatever categories happen to be present in the data — so empty categories render an empty state instead of a 404. The header's "Categories" menu uses native `<details>/<summary>` (zero JS, works with click/tap/keyboard). Homepage sections that depend on category data (reviews strip, Start Here, Troubleshooting) render conditionally and disappear cleanly when that category currently has no articles.

**Tech Stack:** Astro (static, `output: 'static'`), Tailwind CSS 3.x + `@tailwindcss/typography` (already installed per the prior Tailwind migration).

**Design doc:** `docs/superpowers/specs/2026-08-12-v3-site-redesign-design.md`

## Global Constraints

- Category slugs are exactly these 9, fixed, verbatim — never invent, rename, or add to this list: `how-to`, `reviews`, `buying-guides`, `troubleshooting`, `paints-colors`, `automotive`, `miniatures`, `cosplay-body-art`, `beginner`.
- An article with a missing or unrecognized `category` must still build successfully — no badge, excluded from every category-archive filter, a `console.warn` only, never a build failure.
- Zero client-side JavaScript added anywhere in this feature — the header's Categories menu uses native `<details>/<summary>`, not JS.
- No sort-toggle control anywhere — category archive pages are always newest-first.
- No live search box and no live filter chips on the homepage — every "filter" is a real `<a>` link to a real `/category/<slug>` page, not client-side state.
- Brand tokens after this work: `accent.DEFAULT #e2571f`, `accent.dark #c9451a`, `bg-alt #f5f5f7`, `borderRadius.DEFAULT 18px`. `ink`, `body`, `muted`, `border`, and `fontFamily.sans` are unchanged.
- `640px` (`max-[640px]:...`) is the only breakpoint in this codebase; for multi-column layouts that need to collapse on mobile, use the self-responsive `grid-cols-[repeat(auto-fit,minmax(Npx,1fr))]` pattern already used elsewhere in the codebase — never introduce Tailwind's default `sm:`/`md:`/`lg:` breakpoints.
- **No automated test suite exists in this repo.** Verification throughout is manual: inspecting `dist/` build output with `grep`/`find`, plus a browser check via `npx astro dev`. Each task's verify step is the substitute for an automated test — run it and read the output before moving on.
- **Always build with `npx astro build` / `npx astro dev`, never `npm run build` / `npm run dev`.** The `prebuild` npm script calls a live n8n webhook (`N8N_ARTICLES_WEBHOOK_URL`) not available in this workspace; the bare `npx astro` commands build directly against the committed sample `src/data/articles.json`, per `README.md`'s "Local development" section.
- **Known pre-existing bug, out of scope:** `npx astro build` crashes at the very end with `Cannot read properties of undefined (reading 'reduce')` inside `@astrojs/sitemap`'s `astro:build:done` hook — an existing version-mismatch bug, unrelated to this work, that fires *after* all pages are already written to `dist/`. Expect it, don't try to fix it; verify actual output with `find`/`grep` on `dist/`, not the process's exit code.
- Every task must leave the site in a working, visually-correct state.

---

### Task 1: Category data contract + local taxonomy config

**Files:**
- Modify: `scripts/fetch-articles.mjs`
- Modify: `README.md`
- Modify: `CLAUDE.md` (data contract field table only — project structure tree is updated in Task 8)
- Modify: `src/data/articles.json` (sample data)
- Create: `src/data/categories.js`

**Interfaces:**
- Produces: a `category` field (string) on every object in `src/data/articles.json` — one of the 9 valid slugs, or `''` if the source row had none/an unrecognized one.
- Produces: `categories`, a named export from `src/data/categories.js` — `{ slug: string, label: string, description: string }[]`, fixed 9 entries in this exact order (`how-to`, `reviews`, `buying-guides`, `troubleshooting`, `paints-colors`, `automotive`, `miniatures`, `cosplay-body-art`, `beginner`). Every later task imports this array by this name from this path.

- [ ] **Step 1: Add category validation + passthrough to `fetch-articles.mjs`**

Near the top of `scripts/fetch-articles.mjs`, after the `slugify` function, add:

```js
const VALID_CATEGORIES = new Set([
  'how-to',
  'reviews',
  'buying-guides',
  'troubleshooting',
  'paints-colors',
  'automotive',
  'miniatures',
  'cosplay-body-art',
  'beginner',
]);
```

Inside the `for (const row of ready)` loop, immediately before the existing `cleaned.push({...})` call, add:

```js
    const category = VALID_CATEGORIES.has(row.category) ? row.category : '';
    if (row.category && !category) {
      console.warn(`[fetch-articles] "${slug}" has an unrecognized category "${row.category}" — building it without a category badge.`);
    }
```

Then add `category,` as a new property inside the existing `cleaned.push({ ... })` object (alongside `slug`, `title`, etc.).

- [ ] **Step 2: Verify the script is still valid JS**

There's no live webhook in this workspace, so the script can't be run end-to-end here — check it parses correctly instead:

Run: `node --check scripts/fetch-articles.mjs`
Expected: no output, exit code 0.

- [ ] **Step 3: Document the new field in `README.md`**

In the "Expected response shape" JSON example, add `"category": "beginner",` as a new line inside the sample article object (after `"status": "ready",` is fine).

- [ ] **Step 4: Document the new field in `CLAUDE.md`**

In the "Data contract" table, add a new row:

```markdown
| `category` | category badge, `/category/<slug>` archive-page membership, mega-menu counts — one of 9 fixed slugs (see `src/data/categories.js`); missing/unrecognized values are treated as uncategorized |
```

- [ ] **Step 5: Create `src/data/categories.js`**

```js
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

- [ ] **Step 6: Verify `categories.js` loads and has the right shape**

Run: `node -e "import('./src/data/categories.js').then(m => console.log(m.categories.length, m.categories.map(c => c.slug).join(',')))"`
Expected: `9 how-to,reviews,buying-guides,troubleshooting,paints-colors,automotive,miniatures,cosplay-body-art,beginner`

- [ ] **Step 7: Add `category` to the two sample articles**

Edit `src/data/articles.json`: add `"category": "buying-guides"` to the `single-vs-dual-action-airbrush` article, and `"category": "how-to"` to the `how-to-clean-an-airbrush` article (add each as a new key anywhere in that object — valid JSON either way).

- [ ] **Step 8: Verify the sample data**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('src/data/articles.json','utf8')).map(a => a.category))"`
Expected: `[ 'buying-guides', 'how-to' ]`

- [ ] **Step 9: Commit**

```bash
git add scripts/fetch-articles.mjs README.md CLAUDE.md src/data/articles.json src/data/categories.js
git commit -m "Add category field to the data contract and local taxonomy config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Palette token updates

**Files:**
- Modify: `tailwind.config.mjs`

**Interfaces:**
- Produces: the updated `accent`, `bg-alt`, and `borderRadius.DEFAULT` values every later visual task's utility classes rely on.

- [ ] **Step 1: Update the theme tokens**

In `tailwind.config.mjs`, change:

```js
        'bg-alt': '#f6f7f9',
```
to:
```js
        'bg-alt': '#f5f5f7',
```

Change:
```js
        accent: { DEFAULT: '#1d4e89', dark: '#143a66' },
```
to:
```js
        accent: { DEFAULT: '#e2571f', dark: '#c9451a' },
```

Change:
```js
      borderRadius: {
        DEFAULT: '10px',
      },
```
to:
```js
      borderRadius: {
        DEFAULT: '18px',
      },
```

- [ ] **Step 2: Verify the new tokens compiled in**

Run: `npx astro build`
Expected: build completes and writes pages (ignore the known pre-existing `@astrojs/sitemap` crash at the very end — see Global Constraints).

Run: `grep -l "e2571f" dist/_astro/*.css`
Expected: at least one file printed.

Run: `grep -l "1d4e89" dist/_astro/*.css; echo "exit: $?"`
Expected: `exit: 1` — the old accent color is fully gone from the compiled CSS.

- [ ] **Step 3: Visual sanity check**

Run: `npx astro dev`, open the homepage.
Expected: nav link hover states and article links are now orange instead of blue; card corners and the (unmodified-so-far) footer/header corners are visibly more rounded than before.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.mjs
git commit -m "Update brand tokens to v3 palette (orange accent, larger radius)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `ArticleCard` category badge

**Files:**
- Modify: `src/components/ArticleCard.astro`

**Interfaces:**
- Consumes: `categories` from `src/data/categories.js` (Task 1); `accent`/`bg-alt`/`rounded` tokens from Task 2.
- Produces: `ArticleCard`'s `Props` gains an optional `category?: string`. Every caller (Task 4's homepage, Task 5's category pages) passes `category={article.category}`.

Implementation note: the existing card wraps its *entire* body (image + text) in one `<a>`. A badge that links to `/category/<slug>` can't be nested inside that same anchor (invalid HTML — no nested interactive content), so the card is restructured slightly: the image is its own link, and the title/excerpt block is its own link, with the date/badge row sitting between them as a non-nested sibling. The clickable area for "read the article" (image, title, excerpt) is unchanged in practice.

- [ ] **Step 1: Replace `ArticleCard.astro`**

```astro
---
import { categories } from '../data/categories.js';

interface Props {
  slug: string;
  title: string;
  excerpt: string;
  published_date: string;
  category?: string;
}
const { slug, title, excerpt, published_date, category } = Astro.props;
const cat = categories.find((c) => c.slug === category);
---
<article class="border border-border rounded overflow-hidden bg-bg flex flex-col transition-[box-shadow,transform] duration-150 ease-[ease] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
  <a href={`/posts/${slug}`} class="block hover:no-underline">
    <img src={`/images/${slug}.png`} alt={title} loading="lazy" width="600" height="400" class="aspect-[3/2] object-cover w-full" />
  </a>
  <div class="pt-4 px-[18px] pb-5 flex flex-col flex-1">
    <div class="flex items-center gap-2.5 mb-2">
      {cat && (
        <a href={`/category/${cat.slug}`} class="text-[0.7rem] text-accent uppercase tracking-[0.05em] font-bold bg-accent/10 rounded-full px-2.5 py-1 hover:no-underline">
          {cat.label}
        </a>
      )}
      <span class="text-[0.8rem] text-muted uppercase tracking-[0.04em]">{published_date}</span>
    </div>
    <a href={`/posts/${slug}`} class="text-inherit no-underline hover:no-underline flex flex-col flex-1">
      <h2 class="text-[1.1rem] text-ink mb-2">{title}</h2>
      <p class="text-muted text-[0.92rem] mb-3 flex-1">{excerpt}</p>
    </a>
  </div>
</article>
```

- [ ] **Step 2: Verify**

Run: `npx astro build`
Expected: build completes.

Run: `grep -o "Buying Guides" dist/index.html`
Expected: match found (the sample `single-vs-dual-action-airbrush` article's `buying-guides` category badge is now rendered).

Run: `grep -o 'href="/category/buying-guides"' dist/index.html`
Expected: match found — badge links to the right category.

Run: `npx astro dev`, open the homepage in a browser.
Expected: both sample cards show a small orange pill badge (labels "Buying Guides" and "How-to") next to the date; clicking the badge would navigate to `/category/<slug>` (the page doesn't exist until Task 5 — a 404 here right now is expected and fine); clicking the image/title/excerpt still navigates to the post.

- [ ] **Step 3: Commit**

```bash
git add src/components/ArticleCard.astro
git commit -m "Add category badge to ArticleCard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Homepage redesign

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `categories` from `src/data/categories.js` (Task 1); `ArticleCard`'s `category` prop (Task 3).
- Produces: links to `/category/beginner`, `/category/reviews`, and `/category/<slug>` for all 9 categories — Task 5 must produce real pages at those routes for these links to resolve (Astro does not validate `href`s at build time, so this task's own build succeeds independently of Task 5's existence).

- [ ] **Step 1: Replace `src/pages/index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ArticleCard from '../components/ArticleCard.astro';
import { categories } from '../data/categories.js';
import articles from '../data/articles.json';

const sorted = [...articles].sort((a, b) =>
  a.published_date < b.published_date ? 1 : -1
);

const byCategory = (slug) => sorted.filter((a) => a.category === slug);

const reviewArticles = byCategory('reviews').slice(0, 3);
const beginnerArticles = byCategory('beginner').slice(0, 3);
const troubleshootingArticles = byCategory('troubleshooting').slice(0, 3);

const categoryCounts = categories.map((cat) => ({
  ...cat,
  count: sorted.filter((a) => a.category === cat.slug).length,
}));
---
<BaseLayout
  title="Airbrush Learn — Tutorials, Reviews & Buying Guides for Airbrush Artists"
  description="Free airbrush tutorials, honest gear reviews, and buying guides written for painters who spray every day."
  canonicalPath="/"
>
  <section class="text-center pt-14 pb-8">
    <div class="mx-auto max-w-wide px-5">
      <h1 class="text-[2.4rem] max-[640px]:text-[1.8rem] text-ink mb-3">Master Your Airbrush. Create Without Limits.</h1>
      <p class="text-muted text-[1.1rem] max-w-[640px] mx-auto">Tutorials, gear reviews and troubleshooting guides written by painters who spray every day.</p>
      <div class="flex justify-center gap-3 mt-8">
        <a href="/category/beginner" class="inline-block rounded-full bg-accent text-white px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90">Start learning</a>
        <a href="/category/reviews" class="inline-block rounded-full bg-bg-alt text-ink px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:bg-border">Browse reviews</a>
      </div>
    </div>
  </section>

  <section id="latest" class="mx-auto max-w-wide px-5">
    {sorted.length === 0 ? (
      <div class="text-center py-16 px-5 text-muted">
        <p>New articles are on the way — check back soon.</p>
      </div>
    ) : (
      <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7 pt-8 pb-16">
        {sorted.map((article) => (
          <ArticleCard
            slug={article.slug}
            title={article.title}
            excerpt={article.excerpt}
            published_date={article.published_date}
            category={article.category}
          />
        ))}
      </div>
    )}
  </section>

  {reviewArticles.length > 0 && (
    <section class="bg-bg-alt py-16">
      <div class="mx-auto max-w-wide px-5">
        <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
          <h2 class="text-[1.8rem] text-ink">Reviews from real studio time.</h2>
          <a href="/category/reviews" class="text-accent font-semibold text-[0.9rem] hover:no-underline">View all reviews &rarr;</a>
        </div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
          {reviewArticles.map((article) => (
            <a href={`/posts/${article.slug}`} class="flex gap-4 p-4 rounded-xl bg-bg hover:no-underline hover:bg-border">
              <span class="flex-none w-24 aspect-[3/2] rounded-xl bg-bg-alt bg-cover bg-center" style={`background-image:url(/images/${article.slug}.png)`}></span>
              <span class="block">
                <span class="block text-[0.7rem] text-accent uppercase tracking-[0.05em] font-bold">Review</span>
                <span class="block mt-1.5 text-[1rem] text-ink font-semibold leading-tight">{article.title}</span>
                <span class="block mt-1.5 text-[0.78rem] text-muted">{article.published_date}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )}

  {(beginnerArticles.length > 0 || troubleshootingArticles.length > 0) && (
    <section class="py-16">
      <div class="mx-auto max-w-wide px-5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3.5">
        {beginnerArticles.length > 0 && (
          <div class="p-9 rounded-xl bg-bg-alt">
            <h2 class="text-[1.5rem] text-ink">New to airbrushing? Start here.</h2>
            <p class="mt-2 text-muted text-[0.95rem]">Start with these before anything else.</p>
            <div class="mt-5 grid gap-0.5">
              {beginnerArticles.map((article, i) => (
                <a href={`/posts/${article.slug}`} class="flex items-baseline gap-4 p-3.5 rounded-xl hover:no-underline hover:bg-bg">
                  <span class="flex-none font-mono text-[0.78rem] font-bold text-accent">0{i + 1}</span>
                  <span class="text-[0.95rem] text-ink">{article.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {troubleshootingArticles.length > 0 && (
          <div class="p-9 rounded-xl bg-bg-alt">
            <h2 class="text-[1.5rem] text-ink">Something going wrong mid-spray?</h2>
            <p class="mt-2 text-muted text-[0.95rem]">The problems people search for most.</p>
            <div class="mt-5 grid gap-0.5">
              {troubleshootingArticles.map((article) => (
                <a href={`/posts/${article.slug}`} class="flex items-baseline justify-between gap-4 p-3.5 rounded-xl hover:no-underline hover:bg-bg">
                  <span class="text-[0.95rem] text-ink">{article.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )}

  <section class="py-16">
    <div class="mx-auto max-w-wide px-5">
      <div class="text-center mb-10">
        <h2 class="text-[1.8rem] text-ink">Nine ways in.</h2>
        <p class="mt-2 text-muted text-[1rem] max-w-[480px] mx-auto">Every article lives in exactly one category, so you always know where to look next.</p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
        {categoryCounts.map((cat) => (
          <a href={`/category/${cat.slug}`} class="flex items-start justify-between gap-4 p-6 rounded-xl bg-bg-alt hover:no-underline hover:bg-border">
            <span class="block">
              <span class="block text-[1.05rem] text-ink font-semibold">{cat.label}</span>
              <span class="block mt-1.5 text-[0.88rem] text-muted">{cat.description}</span>
            </span>
            <span class="flex-none font-mono text-[0.7rem] font-semibold text-accent">{cat.count}</span>
          </a>
        ))}
      </div>
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 2: Verify the always-on sections**

Run: `npx astro build`
Expected: build completes.

Run: `grep -o "Start learning" dist/index.html`
Expected: match found.

Run: `grep -o "Nine ways in" dist/index.html`
Expected: match found.

Run: `grep -c 'href="/category/' dist/index.html`
Expected: a number ≥ 11 (2 hero CTAs + 9 "Nine ways in" links, at minimum).

- [ ] **Step 3: Verify the conditional sections correctly omit themselves**

The two sample articles are `buying-guides` and `how-to` — neither is `reviews`, `beginner`, nor `troubleshooting` — so both conditional sections must be absent:

Run: `grep -q "Reviews from real studio time" dist/index.html; echo "exit: $?"`
Expected: `exit: 1` (not found).

Run: `grep -q "Start here" dist/index.html; echo "exit: $?"`
Expected: `exit: 1` (not found).

- [ ] **Step 4: Visual check**

Run: `npx astro dev`, open the homepage.
Expected: hero with two pill CTAs, latest-articles grid (badges visible), "Nine ways in" grid of 9 categories with counts (2 categories show count 1, the rest show 0) — no reviews strip, no Start Here/Troubleshooting block (matches Step 3). Resize under 640px — hero heading shrinks, grids collapse to single column.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "Redesign homepage: hero CTAs, reviews strip, start-here/troubleshooting, category grid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Category archive pages

**Files:**
- Create: `src/pages/category/[slug].astro`

**Interfaces:**
- Consumes: `categories` from `src/data/categories.js` (Task 1), `ArticleCard` with its `category` prop (Task 3).
- Produces: the `/category/<slug>` routes that Task 4's homepage and Task 6's header link to.

- [ ] **Step 1: Create the page**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ArticleCard from '../../components/ArticleCard.astro';
import { categories } from '../../data/categories.js';
import articles from '../../data/articles.json';

export async function getStaticPaths() {
  return categories.map((cat) => ({
    params: { slug: cat.slug },
    props: { cat },
  }));
}

const { cat } = Astro.props;
const inCategory = articles
  .filter((a) => a.category === cat.slug)
  .sort((a, b) => (a.published_date < b.published_date ? 1 : -1));
---
<BaseLayout
  title={`${cat.label} — Airbrush Learn`}
  description={cat.description}
  canonicalPath={`/category/${cat.slug}`}
>
  <section class="pt-14 pb-4 text-center">
    <div class="mx-auto max-w-wide px-5">
      <div class="text-[0.78rem] text-muted mb-4">
        <a href="/" class="text-muted hover:text-accent">Home</a> / <span class="text-body">{cat.label}</span>
      </div>
      <h1 class="max-[640px]:text-[1.7rem] text-ink text-[2.25rem]">{cat.label}</h1>
      <p class="mt-3 text-muted text-[1.05rem] max-w-[520px] mx-auto">{cat.description}</p>
    </div>
  </section>

  <section class="mx-auto max-w-wide px-5 pt-8 pb-16">
    {inCategory.length === 0 ? (
      <div class="text-center py-16 px-5 text-muted">
        <p>New articles are on the way — check back soon.</p>
        <a href="/" class="inline-block mt-5 rounded-full bg-bg-alt text-ink px-5 py-2.5 text-[0.9rem] font-semibold hover:no-underline hover:bg-border">Browse all articles</a>
      </div>
    ) : (
      <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7">
        {inCategory.map((article) => (
          <ArticleCard
            slug={article.slug}
            title={article.title}
            excerpt={article.excerpt}
            published_date={article.published_date}
            category={article.category}
          />
        ))}
      </div>
    )}
  </section>
</BaseLayout>
```

- [ ] **Step 2: Verify all 9 category pages are generated**

Run: `npx astro build`
Expected: build completes.

Run: `find dist/category -maxdepth 1 -type d | sort`
Expected: 10 lines — `dist/category` itself plus one directory per slug: `automotive`, `beginner`, `buying-guides`, `cosplay-body-art`, `how-to`, `miniatures`, `paints-colors`, `reviews`, `troubleshooting`.

- [ ] **Step 3: Verify a populated category page**

Run: `grep -o "Single-Action" dist/category/buying-guides/index.html`
Expected: match found — the sample `single-vs-dual-action-airbrush` article (title starts with "Single-Action") appears on its category's archive page.

- [ ] **Step 4: Verify an empty category page**

Run: `grep -q "check back soon" dist/category/reviews/index.html && echo "EMPTY_OK"`
Expected: `EMPTY_OK` — no sample article has category `reviews`, so the empty state renders.

- [ ] **Step 5: Visual check**

Run: `npx astro dev`, open `/category/buying-guides` and `/category/reviews`.
Expected: `buying-guides` shows the breadcrumb, heading, description, and one article card; `reviews` shows the same header but the empty-state message and a "Browse all articles" link back to `/`. Click a badge on the homepage — it now resolves to a real page instead of 404.

- [ ] **Step 6: Commit**

```bash
git add "src/pages/category/[slug].astro"
git commit -m "Add category archive pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Header mega-menu

**Files:**
- Modify: `src/components/Header.astro`

**Interfaces:**
- Consumes: `categories` from `src/data/categories.js` (Task 1); the `/category/<slug>` routes from Task 5.

- [ ] **Step 1: Replace `Header.astro`**

```astro
---
import { categories } from '../data/categories.js';
import articles from '../data/articles.json';

const categoryCounts = categories.map((cat) => ({
  ...cat,
  count: articles.filter((a) => a.category === cat.slug).length,
}));
---
<header class="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
  <div class="mx-auto max-w-wide px-5 flex items-center justify-between py-3.5">
    <a href="/" class="flex items-center gap-2.5 font-bold text-[1.15rem] text-ink hover:no-underline">
      <img src="/logo.png" alt="Airbrush Learn" class="h-[34px] w-auto" />
      <span>Airbrush Learn</span>
    </a>
    <nav>
      <ul class="flex items-center gap-6 max-[640px]:gap-3.5 list-none m-0 p-0">
        <li><a href="/" class="text-body font-medium text-[0.95rem] hover:text-accent hover:no-underline">Home</a></li>
        <li class="relative">
          <details class="group">
            <summary class="list-none cursor-pointer flex items-center gap-1.5 text-body font-medium text-[0.95rem] py-3.5 marker:content-none [&::-webkit-details-marker]:hidden hover:text-accent">
              <span>Categories</span>
              <span class="text-[0.6rem] text-muted">&#9662;</span>
            </summary>
            <div class="absolute top-full right-0 w-[min(640px,calc(100vw-40px))] bg-bg border border-border rounded shadow-[0_18px_48px_rgba(0,0,0,0.12)] p-4 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-0.5 z-40">
              {categoryCounts.map((cat) => (
                <a href={`/category/${cat.slug}`} class="block p-3 rounded-xl hover:bg-bg-alt hover:no-underline">
                  <span class="flex items-baseline gap-1.5 text-[0.9rem] font-semibold text-ink">
                    {cat.label}
                    <span class="font-mono text-[0.7rem] font-normal text-muted">{cat.count}</span>
                  </span>
                  <span class="block mt-0.5 text-[0.76rem] text-muted leading-snug">{cat.description}</span>
                </a>
              ))}
            </div>
          </details>
        </li>
        <li><a href="https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=nav" target="_blank" rel="noopener" class="text-body font-medium text-[0.95rem] hover:text-accent hover:no-underline">Shop SprayGunner</a></li>
      </ul>
    </nav>
  </div>
</header>
```

- [ ] **Step 2: Verify**

Run: `npx astro build`
Expected: build completes.

Run: `grep -o "<details" dist/index.html`
Expected: match found.

Run: `grep -o 'href="/category/cosplay-body-art"' dist/index.html`
Expected: match found.

Run: `ls dist/_astro/*.js 2>/dev/null; echo "exit: $?"`
Expected: `exit: 1` (no JS files) — confirms `<details>/<summary>` added zero client-side JavaScript.

- [ ] **Step 3: Manual interaction check**

Run: `npx astro dev`, open any page.
Expected: click "Categories" — panel opens showing all 9 categories with counts and descriptions, each linking to its archive page; click elsewhere or click "Categories" again — panel closes. Using only the keyboard: Tab to "Categories", press Enter/Space to open, Tab into the panel — links are reachable in order. Resize under 640px — header nav items compress correctly (existing behavior, unchanged by this task).

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.astro
git commit -m "Add categories mega-menu to header (native details/summary, no JS)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Post page category badge

**Files:**
- Modify: `src/pages/posts/[slug].astro`

**Interfaces:**
- Consumes: `categories` from `src/data/categories.js` (Task 1).

- [ ] **Step 1: Add the category lookup and badge**

Change the frontmatter from:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ArticleSchema from '../../components/ArticleSchema.astro';
import articles from '../../data/articles.json';

export async function getStaticPaths() {
  return articles.map((article) => ({
    params: { slug: article.slug },
    props: { article },
  }));
}

const { article } = Astro.props;
const siteUrl = Astro.site?.origin ?? 'https://airbrush.gallery';
---
```

to:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ArticleSchema from '../../components/ArticleSchema.astro';
import { categories } from '../../data/categories.js';
import articles from '../../data/articles.json';

export async function getStaticPaths() {
  return articles.map((article) => ({
    params: { slug: article.slug },
    props: { article },
  }));
}

const { article } = Astro.props;
const siteUrl = Astro.site?.origin ?? 'https://airbrush.gallery';
const cat = categories.find((c) => c.slug === article.category);
---
```

Change the body's date line from:

```astro
    <p class="not-prose text-muted text-[0.9rem] mb-2">{article.published_date}</p>
```

to:

```astro
    <div class="not-prose flex items-center gap-2.5 mb-2">
      {cat && (
        <a href={`/category/${cat.slug}`} class="text-[0.7rem] text-accent uppercase tracking-[0.05em] font-bold bg-accent/10 rounded-full px-2.5 py-1 hover:no-underline">
          {cat.label}
        </a>
      )}
      <p class="text-muted text-[0.9rem] m-0">{article.published_date}</p>
    </div>
```

- [ ] **Step 2: Verify**

Run: `npx astro build`
Expected: build completes.

Run: `grep -o "Buying Guides" dist/posts/single-vs-dual-action-airbrush/index.html`
Expected: match found.

Run: `grep -o 'href="/category/buying-guides"' dist/posts/single-vs-dual-action-airbrush/index.html`
Expected: match found.

Run: `npx astro dev`, open `/posts/single-vs-dual-action-airbrush`.
Expected: orange "Buying Guides" badge appears to the left of the published date, above the title; clicking it goes to `/category/buying-guides`.

- [ ] **Step 3: Commit**

```bash
git add "src/pages/posts/[slug].astro"
git commit -m "Add category badge to post page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Update project-structure docs, full verification

**Files:**
- Modify: `CLAUDE.md` (project structure tree)
- Modify: `README.md` (project structure tree)

**Interfaces:**
- Consumes: the complete, finished feature from Tasks 1–7 — this task only documents and verifies, no new application behavior.

- [ ] **Step 1: Update `CLAUDE.md`'s project structure tree**

Add these two lines to the tree (near `src/pages/index.astro` and `src/data/articles.json` respectively):

```
src/data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
```
```
  category/[slug].astro      # one page per category, getStaticPaths() over categories.js
```

- [ ] **Step 2: Update `README.md`'s project structure tree**

Add the same two lines in the equivalent spots in `README.md`'s tree.

- [ ] **Step 3: Full build verification**

Run: `npx astro build`
Expected: build completes (ignore the known pre-existing `@astrojs/sitemap` crash — see Global Constraints).

Run: `find dist -name 'index.html' | sort | wc -l`
Expected: `14` — homepage (1) + 2 posts + privacy-policy + terms-of-use + 9 category pages.

Run: `ls dist/_astro/*.js 2>/dev/null; echo "exit: $?"`
Expected: `exit: 1` — zero client-side JavaScript in the entire finished build.

- [ ] **Step 4: Full visual verification**

Run: `npx astro dev` and check every page: `/`, `/posts/single-vs-dual-action-airbrush`, `/posts/how-to-clean-an-airbrush`, `/privacy-policy`, `/terms-of-use`, and at least `/category/buying-guides` (populated) and `/category/reviews` (empty). Check the header mega-menu on each. Resize each page under 640px width and confirm no layout breakage.
Expected: no visual regressions in the pages untouched by this plan (privacy-policy, terms-of-use — orange accent/larger radius applies automatically via shared tokens, no content change); every new/changed page renders as described in its task's verify step.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Document category taxonomy in project structure docs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
