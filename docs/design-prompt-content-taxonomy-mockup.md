# Design Prompt: Content Taxonomy Mockup — Airbrush Learn

Hand this whole document to a design tool (Claude, another AI design assistant, or a
human designer) to produce mockups. It contains everything needed to design **on
brand, in context** — no separate reference material required.

---

## 1. Project context

**Airbrush Learn** (`airbrush.gallery`) is a static content site — tutorials, gear
reviews, and buying guides for airbrush artists — owned by SprayGunner. It replaces a
previous WordPress site of the same purpose (see §7 for what that looked like).

- **Stack:** Astro, statically generated, styled with **Tailwind CSS** (`tailwind.config.mjs`
  holds every design token; `@tailwindcss/typography`'s `prose`/`prose-site` classes style
  the raw article HTML). No CMS, no server-side runtime, effectively zero client-side
  JavaScript — Tailwind is a build-time-only compiler, it doesn't change that.
- **Content source:** articles are written by a separate n8n pipeline and pulled in at
  build time — this design work does not touch that pipeline, only how the site
  presents what it receives.
- **Current state:** the live site today is intentionally bare — a hero banner and a
  single flat grid of article cards, no categorization at all. This design introduces
  a **content taxonomy** (9 fixed categories) and the three views needed to surface it.
- **Tone:** editorial and reference-like — closer to a well-organized wiki/knowledge
  base than a marketing site. Confident, unfussy, written by people who actually use
  the gear.

---

## 2. Brand system (use these exact values — do not invent new ones)

These are Tailwind theme tokens, defined in `tailwind.config.mjs` — use the utility
class names directly (`text-ink`, `bg-bg`, `border-border`, etc.), not raw hex, so a
mockup drops straight into the real components.

### 2.1 Color tokens

```js
colors: {
  ink:    '#16181d',  // text-ink    — headings, primary text
  body:   '#333844',  // text-body   — paragraph/body text
  muted:  '#6b7280',  // text-muted  — secondary text, dates, meta
  bg:     '#ffffff',  // bg-bg       — page background
  'bg-alt': '#f6f7f9', // bg-bg-alt  — section/footer background
  border: '#e5e7eb',  // border-border — hairline borders, card outlines
  accent: {
    DEFAULT: '#1d4e89', // text-accent / bg-accent — links, primary CTA, badges
    dark:    '#143a66', // accent-dark — hover/active state of accent
  },
}
```

No dark mode exists on this site today — design for light theme only.

### 2.2 Typography

```js
fontFamily: {
  sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
}
```

This is the only font stack registered in the Tailwind config (no serif token exists
in the live config — ignore any earlier mention of one). It's the default `sans`
family, so it applies automatically via Tailwind's Preflight reset — no `font-sans`
class needed anywhere. Body text: `text-body`, `bg-bg`, `antialiased` (applied on
`<body>` in `BaseLayout.astro`); line-height is the browser default (Tailwind
Preflight doesn't set one), roughly `1.5`.

Established heading sizes (from the live components — reuse this scale rather than
introducing new sizes; sizes with no matching Tailwind default use arbitrary-value
syntax, e.g. `text-[2.4rem]`):

| element | Tailwind classes | notes |
|---|---|---|
| Homepage `<h1>` (hero) | `text-[2.4rem] max-[640px]:text-[1.8rem] text-ink` | centered |
| Article/legal-page prose `<h1>` | `max-[640px]:text-[1.7rem]` (desktop size comes free from the `prose` plugin's default `2.25rem` — no extra class needed) | inside `.prose` wrapper |
| Prose `<h2>`/`<h3>` | handled automatically by the `prose`/`prose-site` classes (§2.5) | don't hand-style these |
| Card `<h2>` (title) | `text-[1.1rem] text-ink mb-2` | |
| Card excerpt `<p>` | `text-muted text-[0.92rem] mb-3` | |
| Card date | `text-[0.8rem] text-muted uppercase tracking-[0.04em]` | |
| Nav links | `text-body font-medium text-[0.95rem] hover:text-accent hover:no-underline` | |

Links: a sitewide base rule in `global.css` gives every `<a>` `text-accent
no-underline` by default and `underline` on hover — this exists specifically so
n8n's raw, unclassed article HTML still gets correct link styling. Only override it
(as the nav links above do) when a link needs different hover behavior.

### 2.3 Layout tokens

```js
borderRadius: { DEFAULT: '10px' },   // `rounded` — cards, images, all rounded corners
maxWidth: {
  prose: '760px',   // `max-w-prose` — narrow single-column content (article body, legal pages)
  wide:  '1100px',  // `max-w-wide`  — header, footer, homepage grid container
}
```

Page content sits inside `mx-auto max-w-wide px-5` (1100px, centered, 20px
horizontal padding) for wide sections, or nested inside an outer `max-w-wide px-5`
wrapper with an inner `max-w-prose mx-auto` for narrow prose content (this exact
nesting is how the article page and both legal pages get a consistent 760px reading
column — see §2.5).

### 2.4 Art direction

Push the composition toward a **modern, clean, Apple-style white aesthetic**, using
the tokens in §2.1–2.3 as the palette, not as a ceiling:

- **Generous whitespace.** More breathing room than the current implementation —
  larger section padding, more gap between grid items, let content sit rather than
  pack tight.
- **Restrained color.** `accent` used sparingly, as a precise highlight (an active
  state, a badge, a link) — never as a large fill or background block. The page
  should read as almost entirely white/near-white with ink-colored text and one
  accent color used with intention.
- **Refined, quiet borders and shadows.** Thin `1px` hairlines over heavy outlines;
  soft, diffuse shadows (like the existing card hover shadow) over hard drop shadows.
  Nothing should look boxed-in.
- **Confident typographic hierarchy.** Large, clear headings with tight line-height,
  generous size contrast between a heading and its supporting text — the existing
  scale in §2.2 is the floor, not a hard ceiling, if a larger hero size reads better.
- **Smooth micro-interactions.** Hover/focus states should feel considered — gentle
  transitions (opacity, subtle scale/translate, `200–300ms` ease), not instant
  snaps and not flashy animation.
- **Uncluttered.** When in doubt, remove an element rather than add one. Every view
  should feel calm, not busy — this is the opposite direction from the old
  WordPress site's denser, more marketing-heavy layout (§7).

### 2.5 Existing component patterns (match these, don't redesign them)

These are the actual current component markups (post-Tailwind-migration) — extend
them, don't replace their structure or class vocabulary with something new.

**Header** (`src/components/Header.astro`) — sticky, white background, bottom
border, logo + wordmark left, nav right:

```html
<header class="sticky top-0 z-20 border-b border-border bg-bg">
  <div class="mx-auto max-w-wide px-5 flex items-center justify-between py-3.5">
    <a href="/" class="flex items-center gap-2.5 font-bold text-[1.15rem] text-ink">
      <img src="/logo.png" alt="Airbrush Learn" class="h-[34px] w-auto" />
      <span>Airbrush Learn</span>
    </a>
    <nav>
      <ul class="flex gap-6 max-[640px]:gap-3.5 list-none m-0 p-0">
        <li><a href="/" class="text-body font-medium text-[0.95rem] hover:text-accent hover:no-underline">Home</a></li>
        <!-- more nav items follow this same class pattern -->
      </ul>
    </nav>
  </div>
</header>
```

**Article card** (`src/components/ArticleCard.astro`) — bordered box, `rounded`,
white background, `3:2` image, lifts + shadows on hover:

```html
<article class="border border-border rounded overflow-hidden bg-bg flex flex-col transition-[box-shadow,transform] duration-150 ease-[ease] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
  <a class="text-inherit no-underline hover:no-underline flex flex-col h-full" href="/posts/<slug>">
    <img src="/images/<slug>.png" alt="<title>" class="aspect-[3/2] object-cover w-full" />
    <div class="pt-4 px-[18px] pb-5 flex flex-col flex-1">
      <span class="text-[0.8rem] text-muted uppercase tracking-[0.04em]">Aug 1, 2026</span>
      <h2 class="text-[1.1rem] text-ink mb-2"><title></h2>
      <p class="text-muted text-[0.92rem] mb-3 flex-1"><excerpt></p>
    </div>
  </a>
</article>
```

**Homepage grid** — `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7`.

**Empty state** — `text-center py-16 px-5 text-muted`, currently reads: *"New
articles are on the way — check back soon."*

**Prose content** (article body, legal pages — `src/styles/global.css`'s
`.prose-site` class, layered on top of `@tailwindcss/typography`'s `prose` class):
handles all heading/paragraph/link/blockquote/code styling for raw HTML content
automatically (this is how n8n's unclassed `content_html` gets styled). A category
archive page's article grid should look identical to the homepage grid — same
`ArticleCard` component, just filtered — but the archive page's own header text (if
mocking §5's View B) is plain `text-ink`/`text-muted`, not wrapped in `prose`.

**Footer** — `border-t border-border bg-bg-alt mt-16 py-9 text-muted text-[0.9rem]`,
flex row spread between copyright and links. **Not in scope for this mockup — leave
as-is.**

**Mobile breakpoint:** `640px` (Tailwind's arbitrary `max-[640px]:` variant) is the
only breakpoint currently used in the codebase. Design mobile behavior around that
single breakpoint, not a multi-tier system.

---

## 3. Content taxonomy (new for this design)

Every article belongs to **exactly one** of these 9 fixed categories (no
multi-category, no free-form tags):

| slug | label | one-line description (for archive page headers) |
|---|---|---|
| `how-to` | How-to | Tutorials that walk you through every pass, from setup to cleanup. |
| `reviews` | Reviews | Honest gear reviews from real studio time. |
| `buying-guides` | Buying Guides | Compare specs that actually matter before you spend a dollar. |
| `troubleshooting` | Troubleshooting | Diagnose the problem fast and get back to painting. |
| `paints-colors` | Paints & Colors | Understand what's actually in the bottle before it goes through your gun. |
| `automotive` | Automotive | Flake, candy fades & custom paneling. |
| `miniatures` | Miniatures | NMM, OSL & 28mm tabletop finishes. |
| `cosplay-body-art` | Cosplay & Body Art | Convention-ready finishes that hold up under stage lights. |
| `beginner` | Beginner | Everything you need to make your first project a success. |

Category archive pages live at `/category/<slug>` (e.g. `/category/reviews`). All 9
pages exist permanently, even for categories with zero published articles yet.

---

## 4. Sample content to use in the mockups

Use this sample data so the mockups look populated and realistic rather than showing
lorem ipsum. Feel free to invent 1–2 more per category if a grid needs filling out,
following the same voice.

| title | category | excerpt | date |
|---|---|---|---|
| Single-Action vs Dual-Action Airbrush: Which Should You Buy? | `buying-guides` | A clear, no-fluff breakdown of single-action and dual-action airbrushes so first-time buyers pick the right one. | Aug 1, 2026 |
| How to Clean an Airbrush: Ultimate Guide | `how-to` | Step-by-step cleaning routine to prevent clogging and extend the life of your airbrush. | Jul 20, 2026 |
| Iwata vs Harder & Steenbeck Airbrush Comparison | `reviews` | Two shop favorites, tested side by side under the same paint and pressure. | Jun 23, 2026 |
| Prevent Airbrush Clogging: Ultimate Guide | `troubleshooting` | The most common causes of clogging and how to fix each one fast. | Jun 23, 2026 |
| Ultimate Airbrush PSI Guide: Master Your Pressure Settings | `how-to` | Dial in the right pressure for every paint type and technique. | Jun 23, 2026 |
| NMM Basics: Painting Metal That Isn't Metallic | `miniatures` | Non-metallic metal fundamentals for 28mm tabletop miniatures. | Jun 10, 2026 |
| Getting Started: Your First Airbrush Project | `beginner` | A realistic first project and what to expect the first time you pull the trigger. | Jun 1, 2026 |
| Candy Fades on a Car Panel, Step by Step | `automotive` | Layering candy color over base and flake for a real automotive fade. | May 28, 2026 |

Leave `/category/cosplay-body-art` and `/category/paints-colors` with **zero**
articles in the mockup, to show the empty-state design.

---

## 5. Deliverable: 3 views + shared components

Deliver these as **one clickable, interactive prototype**, not static flat images —
see §8 for the exact file format. A viewer should be able to open it and actually
click from the homepage into a category archive page, and into the nav dropdown,
the way they would on a real site.

### View A — Homepage

- Keep the existing hero block as-is (centered `<h1>` + subtext, no CTA buttons —
  none exist in the current design and adding them is out of scope here).
- Below the hero: the existing flat "latest articles" grid, **but every card now
  shows a category badge** (see §5.1).
- No per-category preview rows, no "Start Here" onboarding block, no featured/hero
  article treatment — those are explicitly a separate, not-yet-scoped project (see
  §7). Do not add them.

### View B — Category archive page (`/category/reviews` as the example)

- Small header area above the grid: category label as an `<h1>` (reuse the
  `2.25rem`/`1.7rem`-mobile prose `<h1>` scale — see §2.2 — `text-ink`), the
  category's one-line description beneath it in `text-muted`.
- Below that: the same `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-7`
  of `ArticleCard`s, filtered to that category, in the same visual style as the
  homepage grid — this should feel like the *same site*, not a different template.
- Also mock the **empty state** version of this page (use `/category/cosplay-body-art`
  or `/category/paints-colors`): header renders identically, grid area replaced by the
  existing centered empty-state message.

### View C — Header with categories nav

- Same sticky header as today, logo + wordmark unchanged.
- Add a "Categories" nav item that reveals **all 9 categories** on hover/focus (CSS
  only — no JavaScript dependency, this must degrade to a plain link list if CSS
  hover isn't available). Style the disclosure panel using existing tokens: `bg-bg`,
  `border-border` outline, `rounded` corners, subtle shadow consistent with the
  card hover shadow (`shadow-[0_8px_24px_rgba(0,0,0,0.08)]`).
- Keep "Home" and the external "Shop SprayGunner" link exactly where they are today.
- Show both the closed state and the open/hovered state of the Categories dropdown.

### 5.1 — Shared component: category badge

New small element added to `ArticleCard`, positioned above the title (between the
image and the `<h2>`, replacing/joining the existing date line). Suggested treatment:
a small pill/label, `text-accent` text or an `accent`-tinted background, uppercase or
sentence-case (designer's call), linking to that category's archive page. Must not
overpower the title — it's a secondary/eyebrow element, same visual weight class as
the existing `text-[0.8rem] text-muted uppercase tracking-[0.04em]` date span.

Also apply this same badge to the article detail page (`/posts/<slug>`), positioned
near the published-date line, linking back to the category archive.

---

## 6. Constraints & non-goals

- **No JavaScript-dependent interactions *in the eventual production build*.** This is
  a static content site by design (`CLAUDE.md`: "No client-side JS unless there's a
  real reason"), so the nav dropdown must be achievable in pure CSS when it's actually
  implemented in Astro. **This constraint is about the production site, not this
  mockup** — see §8: the mockup deliverable itself is an interactive prototype and is
  explicitly allowed to use JavaScript to power click-through navigation between
  views.
- **Light theme only** — no dark mode exists anywhere in this codebase today.
- **Desktop-first mockup, but note mobile behavior** at the single existing `640px`
  breakpoint — doesn't need a full responsive mockup, but call out how the nav
  dropdown and card grid should reflow.
- **Do not design:** the footer, a featured/hero article treatment, per-category
  homepage preview rows, a "Start Here" onboarding block, a newsletter signup, or a
  community gallery. These are real ideas from the old site but are separate,
  not-yet-scoped projects — keep this mockup strictly to the 3 views in §5.
- **Reuse, don't reinvent.** Every color, size, radius, and shadow used should trace
  back to a token or pattern already listed in §2. If something genuinely needs a new
  value (e.g. the badge's exact color treatment), flag it explicitly as new rather
  than quietly introducing it.

---

## 7. Reference: the site being replaced (tone contrast, not a style guide)

The old WordPress site (same content, same owner) used a dark hero section with an
orange accent CTA button and a tilted/rotated featured-article photo card, a
"Master Your Airbrush. Create Without Limits." headline, per-category preview rows
("Airbrush Reviews", "How-to & Tutorials", ...) with "View all →" links, a 3-step
"New to Airbrushing?" onboarding block, a newsletter signup ("Stay Sharp"), and a
community art gallery section, with a footer sitemap organized into READ / TOPICS /
ELSEWHERE columns.

That gives useful signal about what content types and categories matter to this
audience — which is why the taxonomy in §3 mirrors its categories — but the **visual
direction should not be copied**. The new site is intentionally simpler and lighter
(white background, thin borders, no dark sections, no marketing-style CTAs) — treat
the old site as market/content research, not a design reference.

---

## 8. Output format

- **Single file: `index.html`.** All 3 views (plus the empty-state variant of View B)
  live in this one file — all CSS and JS inlined (`<style>`/`<script>` in the
  `<head>`/before `</body>`), no external stylesheets, fonts, or scripts, no build
  step. It must open directly in a browser with nothing but a double-click.
- **Actually clickable, not just labeled.** Structure it as a tiny single-page app:
  each "page" is a container (e.g. one `<section data-view="home">` /
  `<section data-view="category-reviews">` per view, hidden/shown via a few lines of
  vanilla JS), and every link that would navigate somewhere on the real site — the
  logo, nav items, the Categories dropdown entries, article cards, category badges —
  actually navigates to the corresponding view inside the file when clicked. No page
  reload, no external routing needed.
- Include **at least**: the homepage, one populated category archive page (Reviews),
  one empty-state category archive page (Cosplay & Body Art or Paints & Colors), and
  the header's Categories dropdown in both closed and open state.
- Desktop-width canvas, ~1200–1400px, but make it reasonably responsive down to
  mobile using the existing `640px` breakpoint — this is a browser-opened prototype,
  not a flat image, so it should hold up if the window is resized.
- Apply the **art direction in §2.4** throughout — modern, clean, Apple-style white
  aesthetic — while keeping every color/type/spacing value traceable back to a token
  in §2.1–2.3 (or explicitly flagged as new, per §6).
- Hover/focus states and transitions should actually work in the browser (real CSS
  `:hover`/transitions), not just be described.
