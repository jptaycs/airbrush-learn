# Design: Cursor effect, scroll-reveal animations, and micro-interactions

**Date:** 2026-08-13
**Status:** Approved, not yet implemented

## Context

The user asked for the site to feel more interactive: an airbrush-effect cursor,
animation "anywhere possible," and to feel more "responsive" (confirmed in
conversation to mean lively/reactive, not a separate mobile-layout audit — current
breakpoint handling is unchanged by this spec).

This is a genuine architectural pivot, not a styling tweak. `CLAUDE.md` has stated,
through three consecutive redesigns, that this site ships **zero client-side
JavaScript** by design — a deliberate SEO/content-site choice, verified in every prior
implementation plan's task reviews (`ls dist/_astro/*.js` expected to find nothing). A
real spray-trail cursor effect and broad scroll-triggered reveals cannot be built in
CSS alone (CSS-only scroll-timeline animation isn't reliably supported yet, and a
particle trail needs a persistent draw loop). The user confirmed, explicitly, that
lifting the zero-JS rule for this pass is intentional.

Decisions made with the user before this spec was written:

- **Real JS is in scope.** One small, hand-rolled vanilla-JS script (no new npm
  dependency, no animation library, no framework/hydration) — matches the project's
  existing minimal-dependency ethos as closely as possible while still doing this.
- **Cursor effect is a spray/particle trail**, not just a static custom cursor icon
  or a hover-only paint-reveal mask.
- **Animation scope covers four areas**: scroll-reveal, hover micro-interactions,
  mega-menu/header polish, and page-load hero entrance animation.
- **"More responsive" means "feels reactive,"** not a mobile/tablet layout audit —
  no breakpoint changes in this spec.

## Decision: lifting the zero-JS rule, scoped and documented

The zero-JS rule doesn't get silently abandoned — it gets replaced with an explicit,
narrow exception. `CLAUDE.md`'s Conventions section changes from an unconditional "no
client-side JS" statement to naming the one component that carries JS
(`PageInteractions.astro`) and what it's for, so a future agent doesn't either (a) add
more JS assuming the door is now wide open, or (b) "fix" this component back to
zero-JS assuming it's an accidental violation of an ongoing rule. The site remains
fully static-generated (`output: 'static'`, no hydration, no framework) — this is one
enhancement script, not an architecture change.

## Non-negotiable guardrails

Every piece of this feature is built around three constraints, because getting any of
them wrong makes the site actively worse for someone:

1. **Progressive enhancement.** An early, synchronous inline script in
   `BaseLayout.astro`'s `<head>` (before any content, not deferred) runs:
   ```html
   <script>document.documentElement.classList.add('js');</script>
   ```
   Every CSS rule that starts an element in a hidden/animated-from state is scoped
   `.js [data-reveal] { ... }`. If JS fails to load, is blocked, or errors, `.js`
   never gets added, and `[data-reveal]` elements render exactly as if this feature
   didn't exist — never permanently invisible. This is the load-bearing rule of the
   whole design; every other section depends on it.
2. **`prefers-reduced-motion: reduce` is fully respected.** The cursor trail doesn't
   activate at all, scroll-reveal skips the transition (content appears immediately,
   `.is-visible` still gets added by the observer for consistency but with no visual
   motion), and the hero entrance keyframes are wrapped in
   `@media (prefers-reduced-motion: no-preference)` so they simply don't apply
   otherwise.
3. **Cursor effect is fine-pointer-only.** Gated on
   `window.matchMedia('(pointer: fine)').matches` — on touch devices, none of the
   cursor-canvas code runs (no canvas element sized/drawn, no mousemove listener
   attached), so there's no wasted work and no risk of a lingering canvas element
   interfering with tap targets.

## New component: `src/components/PageInteractions.astro`

A single component, included once by `BaseLayout.astro`, right before `</body>`:

```astro
<canvas id="cursor-canvas" class="pointer-events-none fixed inset-0 z-[999] hidden" aria-hidden="true"></canvas>
<script>
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // --- Scroll-reveal (runs regardless of pointer type / reduced-motion state) ---
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

  // --- Mega-menu open/close animation (progressive enhancement over native <details>) ---
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
    // Delay actually closing <details> so the fade-out CSS transition can play.
    menuDetails.querySelector('summary')?.addEventListener('click', (e) => {
      if (menuDetails.open && !reduceMotion) {
        e.preventDefault();
        panel?.classList.add('menu-panel-closing');
        panel?.classList.remove('menu-panel-open');
        setTimeout(() => { menuDetails.open = false; }, 150);
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
    const resize = () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#e2571f', '#c9451a', '#2f7d6c'];
    let particles = [];
    let mouseX = -100, mouseY = -100;

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

(Exact code above is the intent, not necessarily final byte-for-byte — the
implementation plan will pin the final version. The shape — one script, four
independent, defensively-guarded features — is the important part.)

## CSS additions (`src/styles/global.css`)

```css
html.cursor-none, html.cursor-none * {
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

header.is-scrolled {
  /* tighter padding / stronger shadow — exact values decided in the plan */
}

.menu-panel-open { animation: fadeInUp 180ms ease both; }
.menu-panel-closing { animation: fadeInUp 150ms ease reverse both; }
```

## Scroll-reveal targets (`data-reveal`)

Homepage: hero content block, hero featured card, each category-showcase tile
(grouped under one `data-reveal-group` for staggering), each Latest Articles card
(grouped), Start Here cards (grouped), Reviews column items, How-to column items,
each gallery tile (grouped), SprayGunner CTA content block. Category archive pages
(`category/[slug].astro`): each `ArticleCard` in the grid (grouped). Post/legal pages
are not touched — the reveal treatment is for browsing surfaces (grids, showcases),
not reading surfaces, where an animation on the article body itself would be
distracting.

## Hover micro-interactions (CSS-only, no JS, no `data-reveal` involvement)

- `ArticleCard`: image gets `group-hover:scale-105` (parent link needs `group` and
  `overflow-hidden` already present on the card).
- All pill/CTA buttons: `active:scale-95` press feedback added; primary CTAs also
  get a touch more hover lift.
- Gallery placeholder tiles: `hover:scale-[1.03]`.
- "View all →" links and footer links: a `::after` underline that scales in from 0
  to 1 width on hover (`@layer components` utility class, e.g. `.link-underline`).
- Mega-menu category items: add `hover:translate-x-1`.
- Category badges (on cards and post pages): `hover:scale-105`.

## Header / mega-menu polish

`header.is-scrolled` (toggled by the shared script) tightens vertical padding and
increases the existing blur/shadow slightly — exact values are a plan-time detail,
not a spec-level decision. The mega-menu's open/close keeps `<details>/<summary>` as
the actual toggle (accessibility and no-JS fallback both preserved — without JS, or
under reduced motion, it opens/closes instantly with no animation, which is exactly
today's shipped behavior) and gains a fade+scale transition purely as a JS-driven
class toggle on top.

## Hero entrance animation

`data-hero-in` attribute (with per-element `animation-delay` via inline style or
nth-child, staggering eyebrow → heading → subtext → CTAs → featured card) on the
homepage hero's children. Pure CSS `@keyframes`, gated only by
`prefers-reduced-motion: no-preference` — no JS involvement, runs on every page load
since it's above the fold and not scroll-dependent.

## What does NOT change

- Still `output: 'static'`, no framework, no hydration, no new npm dependency.
- No breakpoint/mobile-layout changes — "more responsive" was confirmed to mean
  "feels reactive," not a layout audit.
- No content or data-logic changes — this is a presentation-layer pass only.
- All page content remains present in server-rendered HTML from first paint;
  nothing is JS-rendered or JS-gated for content visibility (only for *animation
  timing*, and even that degrades to "just show it" per the guardrails above).
- The announcement bar, real newsletter/gallery backends, and any other item already
  marked out of scope in the two prior redesign specs remain out of scope here too.

## Testing / verification

No automated test suite exists in this repo; verification is manual, consistent with
existing project practice:

1. `npx astro build` — completes (ignoring the known pre-existing `@astrojs/sitemap`
   crash). This time, **`dist/_astro/*.js` is expected to contain a file** — confirm
   it exists and is reasonably small (a few KB), which is the intended, approved
   change from every prior build check in this project.
2. `npx astro dev`, human-with-a-browser pass (subagents must not run this — same
   rule as prior redesigns): confirm the cursor trail appears and follows the mouse
   on desktop, confirm it's absent on a touch/mobile emulation, confirm scroll-reveal
   fires once per element without re-triggering on scroll-up, confirm the mega-menu
   opens/closes with the new animation, confirm the hero entrance animation plays on
   load, confirm hover states on cards/buttons/links/tiles.
3. In DevTools, enable "prefers-reduced-motion: reduce" (Rendering tab) and reload:
   confirm the cursor trail never appears, scroll-reveal content is visible
   immediately with no motion, and the hero entrance animation doesn't play.
4. View page source (not the DevTools-rendered DOM) on the homepage with JavaScript
   disabled in the browser: confirm every section is visible immediately (proves the
   `.js`-scoped progressive-enhancement rule works) and the mega-menu still
   opens/closes via native `<details>` behavior.
