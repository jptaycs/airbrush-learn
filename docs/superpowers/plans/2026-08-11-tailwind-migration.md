# Tailwind CSS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `airbrush-learn`'s hand-written CSS (`src/styles/global.css`) with Tailwind CSS, with zero visual regression and zero added runtime JavaScript.

**Architecture:** Add `@astrojs/tailwind` to the existing Astro static build. Port every design token (colors, radius, max-widths, font stack) 1:1 into `tailwind.config.mjs`. Migrate component markup to utility classes one area at a time while the old CSS rules stay in place (so the site never visually breaks mid-migration), then delete the now-dead CSS in the final task.

**Tech Stack:** Astro 4.15 (static, `output: 'static'`), Tailwind CSS 3.x, `@astrojs/tailwind`, `@tailwindcss/typography` (for the n8n-sourced `content_html` that can't carry utility classes).

**Design doc:** `docs/superpowers/specs/2026-08-11-tailwind-migration-design.md`

## Global Constraints

- Brand colors are carried over **unchanged** — `ink #16181d`, `body #333844`, `muted #6b7280`, `bg #ffffff`, `bg-alt #f6f7f9`, `border #e5e7eb`, `accent #1d4e89`, `accent-dark #143a66`.
- Zero added runtime JavaScript — Tailwind is a build-time-only CSS compiler. Verify this explicitly in the final task.
- Full cutover, not incremental — every component listed in the design doc is migrated in this plan, none deferred.
- `package.json` has `"type": "module"` — `tailwind.config.mjs` must use ESM `import`/`export default`, not CommonJS `require`/`module.exports`.
- **No automated test suite exists in this repo** (`CLAUDE.md`: "There is no test suite"). Per the approved design doc's Testing section, verification is manual: `npm run build` succeeding, `npx astro dev` visual comparison against current rendering, and `grep` checks confirming old class names are gone / new Tailwind markers are present. Each task's "verify" step is the substitute for an automated test — run it and read its output before moving to the next step, same as you would a test command.
- Every task must leave the site **visually rendering correctly** — old CSS rules in `global.css` are deleted only in the final task (Task 6), after every component has been migrated off them.

---

### Task 1: Install and configure Tailwind CSS

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `astro.config.mjs`
- Create: `tailwind.config.mjs`
- Modify: `src/styles/global.css` (prepend only — existing rules stay for now)

**Interfaces:**
- Produces: the Tailwind theme tokens (`ink`, `body`, `muted`, `bg`, `bg-alt`, `border`, `accent`/`accent-dark`, `font-sans`, `rounded` default `10px`, `max-w-prose` `760px`, `max-w-wide` `1100px`) that every later task's utility classes reference by name.
- Produces: a global `a` / `a:hover` base rule (accent color, no underline, underline on hover) that Tasks 2–5 rely on for any anchor that doesn't set its own color/decoration explicitly.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D tailwindcss@^3.4.0 @astrojs/tailwind@^5.1.0 @tailwindcss/typography@^0.5.15
```

- [ ] **Step 2: Verify install**

Run: `cat package.json`
Expected: `devDependencies` now lists `tailwindcss`, `@astrojs/tailwind`, `@tailwindcss/typography`.

- [ ] **Step 3: Wire the Astro integration**

Edit `astro.config.mjs` to:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://airbrush.gallery',
  integrations: [sitemap(), tailwind()],
  output: 'static',
});
```

- [ ] **Step 4: Create the Tailwind config**

Create `tailwind.config.mjs`:

```js
import typography from '@tailwindcss/typography';

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
      borderRadius: {
        DEFAULT: '10px',
      },
      maxWidth: {
        prose: '760px',
        wide: '1100px',
      },
    },
  },
  plugins: [typography],
};
```

- [ ] **Step 5: Add Tailwind directives + global anchor reset to `global.css`**

At the very top of `src/styles/global.css`, before the existing `:root { ... }` block, insert:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

a {
  @apply text-accent no-underline;
}

a:hover {
  @apply underline;
}
```

Leave every existing rule below this untouched for now (they still style the site — components haven't been migrated yet). Note: this new plain `a`/`a:hover` rule and the existing generic `a { color: var(--color-accent); ... }` rule near the top of the file will both be present temporarily — that's fine, they set the same values, and the old one gets deleted in Task 6.

- [ ] **Step 6: Verify the build picks up Tailwind**

Run: `npm run build`
Expected: exits 0, no PostCSS/Tailwind errors in the output.

Run: `grep -rl -- "--tw-" dist/_astro/*.css`
Expected: at least one matching file printed. (Tailwind's Preflight reset sets `--tw-*` custom properties on every element regardless of which utilities are used — its presence confirms Tailwind actually compiled into the build, not just that the build didn't error.)

- [ ] **Step 7: Visual sanity check**

Run: `npx astro dev` and open the homepage in a browser.
Expected: renders identically to before this task (hero, article grid, header, footer all still styled) — nothing should look different yet, since the old CSS rules are still active.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tailwind.config.mjs src/styles/global.css
git commit -m "Add Tailwind CSS alongside existing styles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Migrate site chrome (BaseLayout, Header, Footer)

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`

**Interfaces:**
- Consumes: Tailwind theme tokens from Task 1 (`bg`, `text-body`, `border-border`, `text-ink`, `text-muted`, `text-accent`, `rounded`, `max-w-wide`).
- Produces: no other task depends on this task's internals — Header/Footer render on every page but expose no shared class names other tasks need to know about.

- [ ] **Step 1: Add body-level utilities in `BaseLayout.astro`**

Change:
```astro
<body>
```
to:
```astro
<body class="bg-bg text-body leading-[1.6]">
```
(Color, background, and line-height move here since they're expressible as a single class; `-webkit-font-smoothing: antialiased` stays in `global.css` per the design doc — it's still active from the untouched rule below.)

- [ ] **Step 2: Migrate `Header.astro`**

Replace the full file with:

```astro
---
---
<header class="sticky top-0 z-20 border-b border-border bg-bg">
  <div class="mx-auto max-w-wide px-5 flex items-center justify-between py-3.5">
    <a href="/" class="flex items-center gap-2.5 font-bold text-[1.15rem] text-ink">
      <img src="/logo.png" alt="Airbrush Learn" class="h-[34px] w-auto" />
      <span>Airbrush Learn</span>
    </a>
    <nav>
      <ul class="flex gap-6 max-[640px]:gap-3.5 list-none m-0 p-0">
        <li><a href="/" class="text-body font-medium text-[0.95rem] hover:text-accent hover:no-underline">Home</a></li>
        <li><a href="/#latest" class="text-body font-medium text-[0.95rem] hover:text-accent hover:no-underline">Latest Articles</a></li>
        <li><a href="https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=nav" target="_blank" rel="noopener" class="text-body font-medium text-[0.95rem] hover:text-accent hover:no-underline">Shop SprayGunner</a></li>
      </ul>
    </nav>
  </div>
</header>
```

(Explicit `hover:text-accent hover:no-underline` on nav links overrides the global `a:hover{underline}` from Task 1, matching the original `.nav-links a:hover` rule exactly.)

- [ ] **Step 3: Migrate `Footer.astro`**

Replace the full file with:

```astro
---
const year = new Date().getFullYear();
---
<footer class="border-t border-border bg-bg-alt mt-16 py-9 text-muted text-[0.9rem]">
  <div class="mx-auto max-w-wide px-5 flex flex-wrap gap-3 items-center justify-between">
    <span>&copy; {year} SprayGunner. All rights reserved.</span>
    <span>
      <a href="/privacy-policy" class="text-muted">Privacy Policy</a>
      &nbsp;&middot;&nbsp;
      <a href="/terms-of-use" class="text-muted">Terms of Use</a>
      &nbsp;&middot;&nbsp;
      <a href="https://spraygunner.com/" target="_blank" rel="noopener" class="text-muted">SprayGunner Store</a>
    </span>
  </div>
</footer>
```

(No `hover:` override here — footer links only overrode color originally, not decoration, so they keep the global `a:hover{underline}` behavior from Task 1 by default. This matches the original CSS exactly.)

- [ ] **Step 4: Verify**

Run: `npx astro dev`, open the homepage.
Expected: header is sticky, shows logo + 3 nav links with correct spacing; footer shows copyright + 3 links; both visually match pre-migration screenshots (compare against the site as it looked after Task 1's Step 7 check).

Run: `grep -n "site-header\|site-footer\|\bbrand\b\|nav-links" src/components/Header.astro src/components/Footer.astro src/layouts/BaseLayout.astro`
Expected: no matches — old class names are gone from these three files.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/Header.astro src/components/Footer.astro
git commit -m "Migrate site chrome to Tailwind utilities

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Migrate homepage (index.astro, ArticleCard.astro)

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/components/ArticleCard.astro`

**Interfaces:**
- Consumes: Tailwind theme tokens from Task 1.
- Produces: no shared interface consumed elsewhere — `ArticleCard` keeps its existing `Props` (`slug`, `title`, `excerpt`, `published_date`), unchanged from before this task.

- [ ] **Step 1: Migrate the hero + grid wrapper in `index.astro`**

Replace the `<section class="hero">` and `<section id="latest" class="container">` blocks with:

```astro
  <section class="text-center pt-14 pb-8">
    <div class="mx-auto max-w-wide px-5">
      <h1 class="text-[2.4rem] max-[640px]:text-[1.8rem] text-ink mb-3">Master Your Airbrush. Create Without Limits.</h1>
      <p class="text-muted text-[1.1rem] max-w-[640px] mx-auto">Tutorials, gear reviews and troubleshooting guides written by painters who spray every day.</p>
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
          />
        ))}
      </div>
    )}
  </section>
```

- [ ] **Step 2: Migrate `ArticleCard.astro`**

Replace the full file with:

```astro
---
interface Props {
  slug: string;
  title: string;
  excerpt: string;
  published_date: string;
}
const { slug, title, excerpt, published_date } = Astro.props;
---
<article class="border border-border rounded overflow-hidden bg-bg flex flex-col transition-[box-shadow,transform] duration-150 ease-[ease] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
  <a class="text-inherit no-underline flex flex-col h-full" href={`/posts/${slug}`}>
    <img src={`/images/${slug}.png`} alt={title} loading="lazy" width="600" height="400" class="aspect-[3/2] object-cover w-full" />
    <div class="p-4 px-[18px] pb-5 flex flex-col flex-1">
      <span class="text-[0.8rem] text-muted uppercase tracking-[0.04em]">{published_date}</span>
      <h2 class="text-[1.1rem] text-ink mb-2">{title}</h2>
      <p class="text-muted text-[0.92rem] mb-3 flex-1">{excerpt}</p>
    </div>
  </a>
</article>
```

(No `hover:no-underline` override on the card link — the original `.card-link` didn't override hover decoration either, so it inherits the global `a:hover{underline}` from Task 1, matching original behavior exactly.)

- [ ] **Step 3: Verify**

Run: `npx astro dev`, open the homepage.
Expected: hero centered with heading + subtext; article cards in a responsive grid, each showing date, title, excerpt, with hover lift + shadow; empty-state message never shows (sample data has 2 articles) — temporarily confirm it by clearing `src/data/articles.json` to `[]`, checking the empty-state text renders centered, then restoring the file with `git checkout src/data/articles.json`.

Run: `grep -n "article-card\|article-grid\|\bhero\b\|empty-state\|card-date" src/pages/index.astro src/components/ArticleCard.astro`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/components/ArticleCard.astro
git commit -m "Migrate homepage and article card to Tailwind utilities

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Migrate article page (`posts/[slug].astro`)

**Files:**
- Modify: `src/pages/posts/[slug].astro`

**Interfaces:**
- Consumes: Tailwind theme tokens from Task 1, plus the `@tailwindcss/typography` plugin registered in Task 1's `tailwind.config.mjs` (via the `prose` class and its `prose-*` modifiers).

- [ ] **Step 1: Migrate the article body markup**

Replace:
```astro
  <article class="post-body container">
    <div class="prose">
      <p class="post-meta">{article.published_date}</p>
      <h1>{article.title}</h1>
      <img
        class="post-hero-image"
        src={`/images/${article.slug}.png`}
        alt={article.title}
        width="1536"
        height="1024"
      />
      <div set:html={article.content_html} />
    </div>
  </article>
```
with:
```astro
  <article class="pt-6 pb-16 mx-auto max-w-wide px-5">
    <div class="prose prose-neutral max-w-prose mx-auto
      prose-headings:text-ink prose-p:text-body
      prose-a:text-accent prose-a:no-underline prose-a:font-normal
      prose-blockquote:border-accent prose-blockquote:text-muted">
      <p class="text-muted text-[0.9rem] mb-2">{article.published_date}</p>
      <h1 class="max-[640px]:text-[1.7rem]">{article.title}</h1>
      <img
        class="w-full max-h-[420px] object-cover rounded mt-6 mb-2"
        src={`/images/${article.slug}.png`}
        alt={article.title}
        width="1536"
        height="1024"
      />
      <div set:html={article.content_html} />
    </div>
  </article>
```

(`<h1>` gets one direct utility, `max-[640px]:text-[1.7rem]`, to reproduce the original mobile size override — `@tailwindcss/typography`'s default `prose` h1 size is `2.25em` against a `1rem` base, i.e. exactly `2.25rem` at desktop widths, matching the original desktop size with no extra class needed.)

- [ ] **Step 2: Verify**

Run: `npx astro dev`, open `/posts/single-vs-dual-action-airbrush` (from the committed sample data).
Expected: date above the title, title styled as a large heading, hero image below title at max height 420px with rounded corners, body content (from `content_html`) with styled headings/paragraphs/links matching the site's ink/body/accent colors.

Resize the browser under 640px width.
Expected: the article `<h1>` shrinks to the mobile size.

Run: `grep -n "post-body\|post-meta\|post-hero-image" src/pages/posts/\[slug\].astro`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add "src/pages/posts/[slug].astro"
git commit -m "Migrate article page to Tailwind utilities and typography plugin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Migrate legal pages (privacy-policy.astro, terms-of-use.astro)

**Files:**
- Modify: `src/pages/privacy-policy.astro`
- Modify: `src/pages/terms-of-use.astro`

**Interfaces:**
- Consumes: same `prose`/Tailwind tokens as Task 4 — same treatment, applied to a single non-nested wrapper div instead of a nested one.

- [ ] **Step 1: Migrate `privacy-policy.astro`**

Replace:
```astro
  <div class="container prose" style="padding: 40px 0 64px;">
```
with:
```astro
  <div class="max-w-prose mx-auto px-5 pt-10 pb-16 prose prose-neutral
    prose-headings:text-ink prose-p:text-body
    prose-a:text-accent prose-a:no-underline prose-a:font-normal
    prose-blockquote:border-accent prose-blockquote:text-muted">
```
and add `max-[640px]:text-[1.7rem]` directly to the `<h1>Privacy Policy</h1>` element, same as Task 4.

(Note: `max-w-prose`, not `max-w-wide` — in the original CSS, `.prose { max-width: 760px }` is declared *after* `.container { max-width: 1100px }` in the file, so on an element carrying both classes, `.prose`'s 760px wins by source order. This change reproduces that effective width directly instead of relying on cascade order.)

- [ ] **Step 2: Migrate `terms-of-use.astro`**

Apply the identical change to its `<div class="container prose" style="padding: 40px 0 64px;">` and its `<h1>Terms of Use</h1>`.

- [ ] **Step 3: Verify**

Run: `npx astro dev`, open `/privacy-policy` and `/terms-of-use`.
Expected: both render a centered, ~760px-wide column of text with the same heading/paragraph/link styling as the article page.

Run: `grep -n "container prose\|style=\"padding" src/pages/privacy-policy.astro src/pages/terms-of-use.astro`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add src/pages/privacy-policy.astro src/pages/terms-of-use.astro
git commit -m "Migrate legal pages to Tailwind utilities

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Delete dead CSS, update docs, final verification

**Files:**
- Modify: `src/styles/global.css`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the fact that every component (Tasks 2–5) no longer references any pre-migration class name — verified in Step 1 below before deleting anything.

- [ ] **Step 1: Confirm nothing still depends on the old CSS**

Run:
```bash
grep -rn "site-header\|site-footer\|\bcontainer\b\|\bhero\b\|article-grid\|article-card\|card-date\|card-link\|card-body\|empty-state\|post-hero-image\|post-meta\|post-body\|\bbrand\b\|nav-links" src/components src/layouts src/pages
```
Expected: **no matches** anywhere in `src/`. If anything matches, stop and migrate that file first — do not delete its supporting CSS yet.

- [ ] **Step 2: Replace `global.css` with the final minimal version**

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

a {
  @apply text-accent no-underline;
}

a:hover {
  @apply underline;
}
```

This removes the `:root` custom-property block and every component rule (`.container`, `.prose`, `.site-header`, `.article-card`, `.article-grid`, `.hero`, `.empty-state`, `.site-footer`, `.post-hero-image`, `.post-meta`, `.post-body`, the `@media (max-width: 640px)` block) — all now expressed as Tailwind utilities in the components themselves.

- [ ] **Step 3: Update `CLAUDE.md`**

Find this paragraph in the Conventions section:
```markdown
- **No CSS framework.** `global.css` uses CSS custom properties (`--color-accent`, etc.) at the top — change the palette there, not by hunting through components.
```
Replace it with:
```markdown
- **Styling is Tailwind CSS.** Design tokens (colors, spacing, radius, fonts) live in `tailwind.config.mjs`, mapped from the original brand values — change the palette there, not by hunting through components. `global.css` only holds the three `@tailwind` directives plus genuinely global element resets (`html`, `img`, `body` font smoothing, and a base `a`/`a:hover` rule for anchors — like n8n's raw `content_html` — that can't carry utility classes directly). Article body content (`content_html`, rendered via `set:html`) is styled through the `@tailwindcss/typography` plugin's `prose` classes, not hand-written CSS.
```

- [ ] **Step 4: Full build verification**

Run: `npm run build`
Expected: exits 0.

Run: `ls dist/_astro/*.js 2>/dev/null; echo "exit: $?"`
Expected: `exit: 1` (no match) — confirms zero JavaScript files in the build output, i.e. Tailwind added no runtime JS. If this ever prints a match, something introduced client-side JS and needs investigating before proceeding.

Run: `wc -c dist/_astro/*.css`
Expected: a reasonable CSS bundle size (a few KB to a few tens of KB) — Tailwind's production build purges unused utilities via the `content` glob in `tailwind.config.mjs`, so this should not be bloated compared to the pre-migration `global.css`.

- [ ] **Step 5: Full visual verification**

Run: `npx astro dev` and check every page: `/`, `/posts/single-vs-dual-action-airbrush`, `/posts/how-to-clean-an-airbrush`, `/privacy-policy`, `/terms-of-use`.
Expected: all render with no visual regression compared to the pre-migration site — same layout, spacing, colors, hover states.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css CLAUDE.md
git commit -m "Remove dead CSS after Tailwind migration, update docs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
