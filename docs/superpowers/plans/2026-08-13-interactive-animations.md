# Interactive Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site an airbrush spray-trail cursor effect, scroll-reveal animations across the homepage and category pages, richer hover micro-interactions, and animated mega-menu/header polish — a deliberate, narrow, documented exception to this site's zero-client-JS convention.

**Architecture:** One new component, `src/components/PageInteractions.astro`, carries the site's entire client-side script (cursor canvas, scroll-reveal `IntersectionObserver`, header-scroll state, mega-menu open/close animation), included once by `BaseLayout.astro`. Everything else — hover states, the hero's load animation, the reveal/hidden CSS states — is plain CSS, driven by attributes (`data-reveal`, `data-reveal-group`, `data-hero-in`) added to existing markup. Progressive enhancement is structural, not incidental: a synchronous inline script adds a `.js` class to `<html>` before first paint, and every "starts hidden" CSS rule is scoped under it, so content is never gated on JS actually running.

**Design doc:** `docs/superpowers/specs/2026-08-13-interactive-animations-design.md`

## Global Constraints

- **This is a scoped, documented exception to the zero-client-JS rule**, not a general lifting of it. All client-side JS lives in exactly one file: `src/components/PageInteractions.astro`. No task in this plan adds a `<script>` anywhere else.
- **No new npm dependencies.** Hand-written vanilla JS only — no animation library, no framework, no bundler config change. `output: 'static'` and zero hydration remain unchanged.
- **Progressive enhancement is load-bearing, not optional.** Every CSS rule that hides an element pending animation must be scoped `.js [data-reveal]` (or equivalent) — verified by checking that disabling JavaScript still shows all content immediately. The `.js` class is added by a synchronous (non-deferred, non-module) inline `<script>` as the first thing in `<head>`.
- **`prefers-reduced-motion: reduce` disables all motion**, not just reduces it: no cursor trail, no reveal transitions (content appears immediately via the same `.is-visible` class, just with no animation), no hero entrance keyframes.
- **The cursor effect only runs on fine-pointer devices** (`matchMedia('(pointer: fine)')`) — no canvas sizing, no mousemove listener, nothing, on touch devices.
- **No automated test suite exists in this repo.** Verification is manual: `npx astro build`/`npx astro dev` against the committed sample data, then `grep`/`find` on `dist/`.
- **Always build with `npx astro build` / `npx astro dev`, never `npm run build` / `npm run dev`** — no live n8n webhook exists in this workspace.
- **Never run `npx astro dev` inside a subagent dispatch.** It starts a long-running dev server that never exits on its own. Any interactive/visual-check step (and this plan has an unusually important one — actually seeing the cursor trail and animations move) is for a human with a browser, done separately.
- **`grep -c` undercounts occurrences on this project's build output** (Astro emits each page as one minified line). Always use `grep -o 'pattern' file | wc -l` to count occurrences.
- **Tailwind compiles hex colors to `rgb(R G B / ...)` in output CSS**, not the literal hex string — don't grep compiled CSS for a raw hex value.
- **Reversal of a prior convention, deliberately:** every previous plan in this project verified `ls dist/_astro/*.js` found **nothing**. Starting with Task 1 of this plan, that check is expected to find exactly one JS file (`PageInteractions.astro`'s bundled script) — this is the intended, approved outcome, not a regression.
- **Known pre-existing bug, out of scope:** `npx astro build` crashes at the very end with `Cannot read properties of undefined (reading 'reduce')` inside `@astrojs/sitemap`'s `astro:build:done` hook, AFTER all pages are already written to `dist/`. Expect it, don't fix it; verify actual output with `find`/`grep` on `dist/`, not the process's exit code.
- Every task must leave the site in a working, visually-correct state.

---

### Task 1: `PageInteractions` component, `BaseLayout` wiring, and CSS foundation

**Files:**
- Create: `src/components/PageInteractions.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: the `.js` bootstrap class on `<html>`, the `[data-reveal]`/`[data-reveal-group]`/`data-hero-in` CSS contract, the `.link-underline` utility class, and the `header.is-scrolled`/`.menu-panel-open`/`.menu-panel-closing` classes that Tasks 2–5 attach to markup. Every later task depends on this CSS/JS contract existing first.

- [ ] **Step 1: Create `src/components/PageInteractions.astro`**

```astro
---
---
<canvas id="cursor-canvas" class="pointer-events-none fixed inset-0 z-[999] hidden" aria-hidden="true"></canvas>
<script>
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // --- Scroll-reveal ---
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (reduceMotion) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  // --- Header scroll state ---
  const header = document.querySelector('header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // --- Mega-menu open/close animation ---
  const menuDetails = document.querySelector('header details');
  if (menuDetails) {
    const panel = menuDetails.querySelector(':scope > div');
    menuDetails.addEventListener('toggle', () => {
      if (menuDetails.open) {
        panel?.classList.remove('menu-panel-closing');
        panel?.classList.add('menu-panel-open');
      } else {
        panel?.classList.remove('menu-panel-open');
      }
    });
    const summary = menuDetails.querySelector('summary');
    summary?.addEventListener('click', (e) => {
      if (menuDetails.open && !reduceMotion) {
        e.preventDefault();
        panel?.classList.add('menu-panel-closing');
        panel?.classList.remove('menu-panel-open');
        setTimeout(() => {
          menuDetails.open = false;
        }, 150);
      }
    });
  }

  // --- Cursor spray-trail (fine pointer + motion allowed only) ---
  if (finePointer && !reduceMotion) {
    const canvas = document.getElementById('cursor-canvas');
    canvas.classList.remove('hidden');
    document.documentElement.classList.add('cursor-none');
    const ctx = canvas.getContext('2d');
    let width, height;
    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#e2571f', '#c9451a', '#2f7d6c'];
    let particles = [];
    let mouseX = -100;
    let mouseY = -100;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      for (let i = 0; i < 2; i++) {
        if (particles.length > 150) particles.shift();
        particles.push({
          x: mouseX + (Math.random() - 0.5) * 10,
          y: mouseY + (Math.random() - 0.5) * 10,
          r: Math.random() * 2 + 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 1,
        });
      }
    });

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      particles = particles.filter((p) => p.life > 0);
      particles.forEach((p) => {
        p.life -= 0.025;
        p.y += 0.3;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (mouseX > 0) {
        ctx.strokeStyle = '#16181d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
</script>
```

- [ ] **Step 2: Wire it into `BaseLayout.astro`**

Add the import, alongside the existing ones:
```astro
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import PageInteractions from '../components/PageInteractions.astro';
import '../styles/global.css';
```

Add the synchronous `.js` bootstrap script as the very first thing after the charset meta tag:
```astro
<head>
  <meta charset="utf-8" />
  <script>document.documentElement.classList.add('js');</script>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
```
(This must stay a plain, non-deferred, non-module `<script>` — it has to run synchronously before first paint. Do not add `defer`, `async`, or `type="module"` to it.)

Include the component right before `</body>`:
```astro
  <Footer />
  <PageInteractions />
</body>
```

- [ ] **Step 3: Add the CSS foundation to `src/styles/global.css`**

Append to the end of the file:
```css

html.cursor-none,
html.cursor-none * {
  cursor: none;
}

.js [data-reveal] {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 500ms ease, transform 500ms ease;
}
.js [data-reveal].is-visible {
  opacity: 1;
  transform: none;
}
[data-reveal-group] > *:nth-child(1) { transition-delay: 0ms; }
[data-reveal-group] > *:nth-child(2) { transition-delay: 60ms; }
[data-reveal-group] > *:nth-child(3) { transition-delay: 120ms; }
[data-reveal-group] > *:nth-child(4) { transition-delay: 180ms; }
[data-reveal-group] > *:nth-child(n+5) { transition-delay: 240ms; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: no-preference) {
  [data-hero-in] { animation: fadeInUp 700ms ease both; }
}

header > div {
  transition: padding 250ms ease, box-shadow 250ms ease;
}
header.is-scrolled {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
header.is-scrolled > div {
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
}

.menu-panel-open {
  animation: fadeInUp 180ms ease both;
}
.menu-panel-closing {
  animation: fadeInUp 150ms ease reverse both;
}

@layer components {
  .link-underline {
    position: relative;
  }
  .link-underline::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 100%;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 250ms ease;
  }
  .link-underline:hover::after {
    transform: scaleX(1);
  }
}
```

(`header > div` targets `Header.astro`'s single direct child — the div that actually carries the `py-3.5` padding Tailwind class. `<header>` itself has no padding of its own.)

- [ ] **Step 4: Verify**

Run: `npx astro build`
Expected: completes (ignore the known pre-existing sitemap crash — see Global Constraints).

Run: `ls dist/_astro/*.js`
Expected: **at least one file listed** — this is the intended reversal of every prior plan's "zero JS" check (see Global Constraints). If this finds nothing, something went wrong with the `<script>` bundling.

Run: `grep -o "add('js')" dist/index.html`
Expected: match found.

Run: `grep -o 'id="cursor-canvas"' dist/index.html`
Expected: match found.

Run: `grep -o "IntersectionObserver" dist/_astro/*.js`
Expected: match found — confirms the script content actually got bundled, not silently dropped.

- [ ] **Step 5: Commit**

```bash
git add src/components/PageInteractions.astro src/layouts/BaseLayout.astro src/styles/global.css
git commit -m "Add PageInteractions component: cursor trail, scroll-reveal, header/menu animation foundation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `ArticleCard` hover zoom and scroll-reveal

**Files:**
- Modify: `src/components/ArticleCard.astro`

**Interfaces:**
- Consumes: the `.js [data-reveal]` CSS contract from Task 1.
- Produces: every `ArticleCard` instance now carries `data-reveal` on its own root element — Tasks 3 and 5 (which render `ArticleCard` inside grids) only need to add `data-reveal-group` to the *grid container*, not to each card individually.

- [ ] **Step 1: Update `ArticleCard.astro`**

Change:
```astro
<article class="border border-border rounded overflow-hidden bg-bg flex flex-col transition-[box-shadow,transform] duration-150 ease-[ease] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
  <a href={`/posts/${slug}`} class="relative block hover:no-underline">
    <img src={`/images/${slug}.png`} alt={title} loading="lazy" width="600" height="400" class="aspect-[3/2] object-cover w-full" />
```
to:
```astro
<article data-reveal class="group border border-border rounded overflow-hidden bg-bg flex flex-col transition-[box-shadow,transform] duration-150 ease-[ease] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
  <a href={`/posts/${slug}`} class="relative block overflow-hidden hover:no-underline">
    <img src={`/images/${slug}.png`} alt={title} loading="lazy" width="600" height="400" class="aspect-[3/2] object-cover w-full transition-transform duration-300 group-hover:scale-105" />
```

- [ ] **Step 2: Verify**

Run: `npx astro build`
Expected: completes.

Run: `grep -o 'data-reveal' dist/index.html | wc -l`
Expected: a number ≥ 2 (the 2 committed sample articles each render one `ArticleCard`, each now carrying `data-reveal`).

Run: `grep -o 'group-hover:scale-105' dist/category/buying-guides/index.html`
Expected: match found.

- [ ] **Step 3: Commit**

```bash
git add src/components/ArticleCard.astro
git commit -m "Add hover image zoom and scroll-reveal to ArticleCard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Homepage — scroll-reveal, hero entrance animation, hover polish

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `data-reveal`/`data-reveal-group`/`data-hero-in`/`.link-underline` from Task 1; `ArticleCard`'s built-in `data-reveal` from Task 2.

This task is a series of small, independent edits to the same file — each finds an exact existing block and replaces it. Apply them in order.

- [ ] **Step 1: Hero — staggered load-in animation**

Change:
```astro
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
```
to:
```astro
      <div>
        <span data-hero-in class="text-accent text-[0.9rem] font-semibold uppercase tracking-[0.04em]">The Airbrush Learning Hub</span>
        <h1 data-hero-in class="[animation-delay:100ms] font-serif text-white text-[3.2rem] leading-[1.05] mt-4 max-[640px]:text-[2.1rem]">Master Your Airbrush. Create Without Limits.</h1>
        <p data-hero-in class="[animation-delay:200ms] text-gray-400 text-[1.1rem] mt-5 max-w-[480px]">Tutorials, gear reviews and troubleshooting guides written by painters who spray every day.</p>
        <div data-hero-in class="[animation-delay:300ms] flex flex-wrap gap-3 mt-8">
          <a href="/category/beginner" class="inline-block rounded-full bg-accent text-white px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90 active:scale-95 transition-transform">Start Learning</a>
          <a href="/category/reviews" class="inline-block rounded-full border border-white/30 text-white px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:bg-white/10 active:scale-95 transition-transform">Browse Reviews</a>
        </div>
      </div>
      {featured && (
        <a href={`/posts/${featured.slug}`} data-hero-in class="[animation-delay:400ms] block hover:no-underline">
```

- [ ] **Step 2: Category showcase — reveal + hover**

Change:
```astro
      <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
        {categoryCounts.map((cat) => (
          <a href={`/category/${cat.slug}`} class="block p-7 rounded-xl bg-surface-dark hover:no-underline hover:opacity-90">
```
to:
```astro
      <div data-reveal-group class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
        {categoryCounts.map((cat) => (
          <a href={`/category/${cat.slug}`} data-reveal class="block p-7 rounded-xl bg-surface-dark hover:no-underline hover:opacity-90 hover:scale-[1.02] transition-transform">
```

- [ ] **Step 3: Latest Articles grid — reveal group wrapper**

Change:
```astro
        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7">
          {sorted.map((article) => (
            <ArticleCard
```
to:
```astro
        <div data-reveal-group class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7">
          {sorted.map((article) => (
            <ArticleCard
```

- [ ] **Step 4: Start Here cards — reveal + hover**

Change:
```astro
        <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mt-10 text-left">
          {beginnerArticles.map((article, i) => (
            <a href={`/posts/${article.slug}`} class="block p-7 rounded-xl border border-white/10 bg-white/5 hover:no-underline hover:bg-white/10">
```
to:
```astro
        <div data-reveal-group class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mt-10 text-left">
          {beginnerArticles.map((article, i) => (
            <a href={`/posts/${article.slug}`} data-reveal class="block p-7 rounded-xl border border-white/10 bg-white/5 hover:no-underline hover:bg-white/10 hover:-translate-y-0.5 transition-transform">
```

- [ ] **Step 5: Reviews column — reveal + underline link**

Change:
```astro
              <h2 class="font-serif text-ink text-[1.7rem]">Airbrush Reviews</h2>
              <a href="/category/reviews" class="text-accent-dark font-semibold text-[0.9rem] hover:no-underline">View all &rarr;</a>
            </div>
            <div class="h-[3px] bg-teal w-16 mb-7"></div>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              {reviewArticles.map((article) => (
                <a href={`/posts/${article.slug}`} class="flex gap-4 hover:no-underline">
```
to:
```astro
              <h2 class="font-serif text-ink text-[1.7rem]">Airbrush Reviews</h2>
              <a href="/category/reviews" class="link-underline text-accent-dark font-semibold text-[0.9rem] hover:no-underline">View all &rarr;</a>
            </div>
            <div class="h-[3px] bg-teal w-16 mb-7"></div>
            <div data-reveal-group class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              {reviewArticles.map((article) => (
                <a href={`/posts/${article.slug}`} data-reveal class="flex gap-4 hover:no-underline">
```

- [ ] **Step 6: How-to column — reveal + underline link**

Change:
```astro
              <h2 class="font-serif text-ink text-[1.7rem]">How-to & Tutorials</h2>
              <a href="/category/how-to" class="text-accent-dark font-semibold text-[0.9rem] hover:no-underline">View all &rarr;</a>
            </div>
            <div class="h-[3px] bg-accent w-16 mb-7"></div>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              {howToArticles.map((article) => (
                <a href={`/posts/${article.slug}`} class="flex gap-4 hover:no-underline">
```
to:
```astro
              <h2 class="font-serif text-ink text-[1.7rem]">How-to & Tutorials</h2>
              <a href="/category/how-to" class="link-underline text-accent-dark font-semibold text-[0.9rem] hover:no-underline">View all &rarr;</a>
            </div>
            <div class="h-[3px] bg-accent w-16 mb-7"></div>
            <div data-reveal-group class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              {howToArticles.map((article) => (
                <a href={`/posts/${article.slug}`} data-reveal class="flex gap-4 hover:no-underline">
```

- [ ] **Step 7: Newsletter button — press feedback**

Change:
```astro
        <button type="button" class="rounded-full bg-ink text-white px-6 py-3 text-[0.95rem] font-semibold">Subscribe</button>
```
to:
```astro
        <button type="button" class="rounded-full bg-ink text-white px-6 py-3 text-[0.95rem] font-semibold active:scale-95 transition-transform">Subscribe</button>
```

- [ ] **Step 8: Community Gallery tiles — reveal + hover**

Change:
```astro
      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        {galleryTiles.map((tile) => (
          <div class={`rounded-xl overflow-hidden bg-bg flex items-end p-4 ${tile.tall ? 'aspect-[3/4]' : 'aspect-[4/3]'}`} style="background-image:repeating-linear-gradient(135deg,rgba(23,20,15,0.08) 0 1px,transparent 1px 10px)">
```
to:
```astro
      <div data-reveal-group class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        {galleryTiles.map((tile) => (
          <div data-reveal class={`rounded-xl overflow-hidden bg-bg flex items-end p-4 transition-transform duration-300 hover:scale-[1.03] ${tile.tall ? 'aspect-[3/4]' : 'aspect-[4/3]'}`} style="background-image:repeating-linear-gradient(135deg,rgba(23,20,15,0.08) 0 1px,transparent 1px 10px)">
```

- [ ] **Step 9: SprayGunner CTA band — reveal + button press feedback**

Change:
```astro
  <section class="bg-surface-dark py-20">
    <div class="mx-auto max-w-wide px-5 text-center">
      <span class="text-accent italic text-[0.9rem] font-semibold">Ready to Level Up?</span>
      <h2 class="font-serif text-white text-[2.2rem] mt-2">Shop the gear that pros trust.</h2>
      <p class="text-gray-400 text-[1.05rem] mt-3 max-w-[480px] mx-auto">Airbrushes, compressors, paints &amp; accessories — everything you need in one place.</p>
      <a href="https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=cta" target="_blank" rel="noopener" class="inline-block mt-7 rounded-full bg-accent text-white px-7 py-3.5 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90">Shop the Gear at SprayGunner &rarr;</a>
    </div>
  </section>
```
to:
```astro
  <section class="bg-surface-dark py-20">
    <div data-reveal class="mx-auto max-w-wide px-5 text-center">
      <span class="text-accent italic text-[0.9rem] font-semibold">Ready to Level Up?</span>
      <h2 class="font-serif text-white text-[2.2rem] mt-2">Shop the gear that pros trust.</h2>
      <p class="text-gray-400 text-[1.05rem] mt-3 max-w-[480px] mx-auto">Airbrushes, compressors, paints &amp; accessories — everything you need in one place.</p>
      <a href="https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=cta" target="_blank" rel="noopener" class="inline-block mt-7 rounded-full bg-accent text-white px-7 py-3.5 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90 active:scale-95 transition-transform">Shop the Gear at SprayGunner &rarr;</a>
    </div>
  </section>
```

- [ ] **Step 10: Verify**

Run: `npx astro build`
Expected: completes.

Run: `grep -o 'data-hero-in' dist/index.html | wc -l`
Expected: `5` (eyebrow, h1, p, CTA div, featured card).

Run: `grep -o 'data-reveal-group' dist/index.html | wc -l`
Expected: a number ≥ 5 (category showcase, latest articles, start-here — only if beginner articles exist in sample data, gallery; reviews/how-to groups only render if their categories have articles). Against the current 2-article sample data (`buying-guides`, `how-to`), expect: category showcase grid, latest articles grid, how-to column grid, and gallery grid = **4** `data-reveal-group` occurrences (Start Here and the Reviews column are correctly absent, matching the same conditional-omission behavior verified in prior redesigns).

Run: `grep -o 'link-underline' dist/index.html | wc -l`
Expected: `1` (only the How-to column's "View all →" renders against current sample data; the Reviews column's is conditionally absent).

- [ ] **Step 11: Commit**

```bash
git add src/pages/index.astro
git commit -m "Add scroll-reveal, hero entrance animation, and hover polish to homepage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Header and footer polish

**Files:**
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`

**Interfaces:**
- Consumes: `header.is-scrolled`/`.menu-panel-open`/`.menu-panel-closing`/`.link-underline` CSS from Task 1, and the JS in `PageInteractions.astro` that selects `document.querySelector('header')` and `document.querySelector('header details')` — both selectors already match this file's existing structure with no HTML restructuring needed.

- [ ] **Step 1: Mega-menu item hover nudge in `Header.astro`**

Change:
```astro
                <a href={`/category/${cat.slug}`} class="block p-3 rounded-xl hover:bg-bg-alt hover:no-underline">
```
to:
```astro
                <a href={`/category/${cat.slug}`} class="block p-3 rounded-xl hover:bg-bg-alt hover:no-underline hover:translate-x-1 transition-transform">
```

- [ ] **Step 2: Underline links in `Footer.astro`**

Change (the two `.map()` calls share this exact class string):
```astro
            <li><a href={l.href} class="text-gray-300 hover:text-accent">{l.label}</a></li>
```
to:
```astro
            <li><a href={l.href} class="link-underline text-gray-300 hover:text-accent">{l.label}</a></li>
```
(This appears twice — once in the `readLinks.map(...)` block, once in the `topicLinks.map(...)` block. Apply to both.)

Change:
```astro
          <li><a href="https://spraygunner.com/" target="_blank" rel="noopener" class="text-gray-300 hover:text-accent">SprayGunner Store</a></li>
```
to:
```astro
          <li><a href="https://spraygunner.com/" target="_blank" rel="noopener" class="link-underline text-gray-300 hover:text-accent">SprayGunner Store</a></li>
```

Change:
```astro
        <a href="/privacy-policy" class="text-gray-400 hover:text-accent">Privacy Policy</a>
        &nbsp;&middot;&nbsp;
        <a href="/terms-of-use" class="text-gray-400 hover:text-accent">Terms of Use</a>
```
to:
```astro
        <a href="/privacy-policy" class="link-underline text-gray-400 hover:text-accent">Privacy Policy</a>
        &nbsp;&middot;&nbsp;
        <a href="/terms-of-use" class="link-underline text-gray-400 hover:text-accent">Terms of Use</a>
```

- [ ] **Step 3: Verify**

Run: `npx astro build`
Expected: completes.

Run: `grep -o 'hover:translate-x-1' dist/index.html`
Expected: match found (mega-menu renders on every page via the shared header).

Run: `grep -o 'link-underline' dist/index.html | wc -l`
Expected: this number is higher than Task 3's own count (`1`, from the How-to "View all →" link) — the footer alone adds 6 more `link-underline` occurrences (5 footer-column links across the sample data's 5 READ + wait, count precisely: 5 READ links + 4 TOPICS links + 1 SprayGunner Store link + 2 legal links = 12 footer occurrences, plus mega-menu is unrelated). Expected total ≥ `13` (1 from Task 3 + 12 from the footer).

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.astro src/components/Footer.astro
git commit -m "Add hover polish to header mega-menu and footer links

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Category pages — scroll-reveal, and documentation update

**Files:**
- Modify: `src/pages/category/[slug].astro`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `ArticleCard`'s built-in `data-reveal` (Task 2), `data-reveal-group` CSS (Task 1).

- [ ] **Step 1: Add reveal-group wrapper to the category page's article grid**

Change:
```astro
      <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7">
        {inCategory.map((article) => (
```
to:
```astro
      <div data-reveal-group class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7">
        {inCategory.map((article) => (
```

- [ ] **Step 2: Update `CLAUDE.md`'s no-JS convention note**

Change:
```markdown
- **No client-side JS unless there's a real reason.** This is a static content site; keep it that way.
```
to:
```markdown
- **Client-side JS is scoped to one file.** `src/components/PageInteractions.astro` carries the site's only client-side script — a cursor spray-trail effect, scroll-reveal animations, and header/mega-menu polish, included once via `BaseLayout.astro`. It's a deliberate, narrow exception to this site's static-first default: progressive enhancement (see its `.js`-scoped CSS in `global.css`), `prefers-reduced-motion` support, and fine-pointer-only gating are all load-bearing, not optional polish. This isn't a green light for JS generally — don't add more of it elsewhere without the same rigor.
```

- [ ] **Step 3: Verify**

Run: `npx astro build`
Expected: completes.

Run: `grep -o 'data-reveal-group' dist/category/buying-guides/index.html`
Expected: match found.

Run: `grep -n "Client-side JS is scoped to one file" CLAUDE.md`
Expected: match found.

- [ ] **Step 4: Commit**

```bash
git add "src/pages/category/[slug].astro" CLAUDE.md
git commit -m "Add scroll-reveal to category pages, document the PageInteractions JS exception

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Full verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: the complete finished feature from Tasks 1–5.

- [ ] **Step 1: Full build verification**

Run: `npx astro build`
Expected: completes (ignore the known pre-existing sitemap crash).

Run: `find dist -name 'index.html' | sort | wc -l`
Expected: `14` — unchanged page count (this plan adds interactivity to existing pages, no new routes).

Run: `ls dist/_astro/*.js`
Expected: at least one file — the intended, approved reversal of the zero-JS check every prior plan used.

Run: `grep -o "cursor: none" dist/_astro/*.css`
Expected: match found (the `html.cursor-none` rule compiled correctly).

- [ ] **Step 2: Full interactive verification (human, with a browser — not a subagent step)**

This plan is unusually dependent on actually seeing it move — a static grep can confirm markup and bundling, but not that the cursor trail looks right, animations are timed well, or the mega-menu's fade feels smooth. Run `npx astro dev` and check:

1. Move the mouse around the homepage on desktop: the native cursor should disappear, replaced by a small circle outline with fading colored particles trailing behind it.
2. Load the homepage fresh: hero content should fade/slide in with a visible stagger (eyebrow → heading → subtext → buttons → featured card).
3. Scroll down: category tiles, article cards, Start Here cards (if sample data includes a `beginner` article), gallery tiles, and the SprayGunner CTA band should each fade+slide into view the first time they cross into the viewport, with a slight cascade across grid items — and should **not** re-trigger when scrolling back up and down again.
4. Open and close the "Categories" mega-menu: it should fade+scale in on open, and fade out over ~150ms on close (not vanish instantly).
5. Scroll the page and confirm the header visually tightens slightly once scrolled.
6. Hover over article card images (zoom), buttons (press them — slight scale down), gallery tiles (scale up), and footer/"View all →" links (underline slides in).
7. In DevTools' Rendering tab, enable "Emulate CSS prefers-reduced-motion: reduce" and reload: confirm the cursor trail never appears, all reveal content is visible immediately with no animation, and the hero shows with no motion.
8. In DevTools, disable JavaScript entirely and reload: confirm every homepage section is visible immediately (this is the progressive-enhancement guarantee from Task 1 — if anything stays invisible, that's a Critical bug, not a Minor one).
9. Use Chrome DevTools' device toolbar to emulate a touch device and reload: confirm no custom cursor appears and the native cursor/pointer behavior is untouched.

- [ ] **Step 3: Report findings**

This step has no commit — it's a checkpoint for a human to confirm the interactive behavior actually looks and feels right before considering the plan done. If anything in Step 2 doesn't match, that's a finding for the review process, not something to silently patch.
