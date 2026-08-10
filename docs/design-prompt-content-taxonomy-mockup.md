# Design Prompt: Content Taxonomy Mockup — Airbrush Learn

Hand this whole document to a design tool (Claude, another AI design assistant, or a
human designer) to produce mockups. It contains everything needed to design **on
brand, in context** — no separate reference material required.

---

## 1. Project context

**Airbrush Learn** (`airbrush.gallery`) is a static content site — tutorials, gear
reviews, and buying guides for airbrush artists — owned by SprayGunner. It replaces a
previous WordPress site of the same purpose (see §7 for what that looked like).

- **Stack:** Astro, statically generated. No CMS, no server-side runtime, effectively
  zero client-side JavaScript.
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

### 2.1 Color tokens

```css
--color-ink:          #16181d;  /* headings, primary text */
--color-body:         #333844;  /* paragraph/body text */
--color-muted:        #6b7280;  /* secondary text, dates, meta */
--color-bg:           #ffffff;  /* page background */
--color-bg-alt:       #f6f7f9;  /* section/footer background */
--color-border:       #e5e7eb;  /* hairline borders, card outlines */
--color-accent:       #1d4e89;  /* links, primary CTA, badges */
--color-accent-dark:  #143a66;  /* hover/active state of accent */
```

No dark mode exists on this site today — design for light theme only.

### 2.2 Typography

```css
--font-sans:  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--font-serif: Georgia, "Times New Roman", serif;  /* defined but not currently used anywhere */
```

Body text uses `--font-sans` at `line-height: 1.6`, color `--color-body`, on
`--color-bg`, with `-webkit-font-smoothing: antialiased`.

Established heading sizes (from the article-prose styles — reuse this scale rather
than introducing new sizes):

| element | size | color | notes |
|---|---|---|---|
| Homepage `<h1>` (hero) | `2.4rem` (mobile: `1.8rem` under 640px) | `--color-ink` | centered |
| Article prose `<h1>` | `2.25rem` (mobile: `1.7rem`) | `--color-ink` | |
| Prose `<h2>` | `1.5rem` | `--color-ink` | `margin-top: 2em` |
| Prose `<h3>` | `1.2rem` | `--color-ink` | |
| Card `<h2>` (title) | `1.1rem` | `--color-ink` | |
| Card excerpt `<p>` | `0.92rem` | `--color-muted` | |
| Card date | `0.8rem`, uppercase, `letter-spacing: 0.04em` | `--color-muted` | |
| Nav links | `0.95rem`, weight `500` | `--color-body`, hover `--color-accent` | |

Links: `color: var(--color-accent)`, no underline by default, underline on hover.

### 2.3 Layout tokens

```css
--max-width:      760px;   /* prose / narrow single-column content */
--max-width-wide: 1100px;  /* header, footer, homepage grid container */
--radius:         10px;    /* cards, images, all rounded corners */
```

Page content sits inside `.container` (`max-width: 1100px`, centered, `20px`
horizontal padding).

### 2.5 Art direction

Push the composition toward a **modern, clean, Apple-style white aesthetic**, using
the tokens in §2.1–2.3 as the palette, not as a ceiling:

- **Generous whitespace.** More breathing room than the current implementation —
  larger section padding, more gap between grid items, let content sit rather than
  pack tight.
- **Restrained color.** `--color-accent` used sparingly, as a precise highlight
  (an active state, a badge, a link) — never as a large fill or background block.
  The page should read as almost entirely white/near-white with ink-colored text and
  one accent color used with intention.
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

### 2.6 Existing component patterns (match these, don't redesign them)

**Header** — sticky (`position: sticky; top: 0`), white background, `1px solid
--color-border` bottom edge, `14px` vertical padding. Logo + wordmark on the left
(`34px` tall logo), nav links on the right, flex `justify-content: space-between`.

**Article card** (`.article-card`) — bordered box, `10px` radius, white background,
image at `3:2` aspect ratio (`object-fit: cover`) on top, body padding `16px 18px
20px`. On hover: `box-shadow: 0 8px 24px rgba(0,0,0,0.08)` and lifts `translateY(-2px)`.
Current internal structure (extend, don't replace):

```html
<article class="article-card">
  <a class="card-link" href="/posts/<slug>">
    <img src="/images/<slug>.png" alt="<title>" />
    <div class="card-body">
      <span class="card-date">Aug 1, 2026</span>
      <h2><title></h2>
      <p><excerpt></p>
    </div>
  </a>
</article>
```

**Homepage grid** (`.article-grid`) — CSS grid, `repeat(auto-fill, minmax(280px,
1fr))`, `28px` gap.

**Empty state** (`.empty-state`) — centered text block, `64px 20px` padding,
`--color-muted` color, currently reads: *"New articles are on the way — check back
soon."*

**Footer** — `--color-bg-alt` background, `1px solid --color-border` top edge, `36px`
vertical padding, `0.9rem` `--color-muted` text, flex row spread between copyright and
links. **Not in scope for this mockup — leave as-is.**

**Mobile breakpoint:** `640px` is the only breakpoint currently defined in the
codebase. Design mobile behavior around that single breakpoint, not a multi-tier
system.

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
  shows a category badge** (see §6.1).
- No per-category preview rows, no "Start Here" onboarding block, no featured/hero
  article treatment — those are explicitly a separate, not-yet-scoped project (see
  §7). Do not add them.

### View B — Category archive page (`/category/reviews` as the example)

- Small header area above the grid: category label as an `<h1>` (reuse the
  `2.25rem`/`1.7rem`-mobile prose `<h1>` scale, `--color-ink`), the category's
  one-line description beneath it in `--color-muted`.
- Below that: the same `.article-grid` of cards, filtered to that category, in the
  same visual style as the homepage grid — this should feel like the *same site*, not
  a different template.
- Also mock the **empty state** version of this page (use `/category/cosplay-body-art`
  or `/category/paints-colors`): header renders identically, grid area replaced by the
  existing centered empty-state message.

### View C — Header with categories nav

- Same sticky header as today, logo + wordmark unchanged.
- Add a "Categories" nav item that reveals **all 9 categories** on hover/focus (CSS
  only — no JavaScript dependency, this must degrade to a plain link list if CSS
  hover isn't available). Style the disclosure panel using existing tokens: white
  background, `--color-border` outline, `--radius` corners, subtle shadow consistent
  with the card hover shadow (`0 8px 24px rgba(0,0,0,0.08)`).
- Keep "Home" and the external "Shop SprayGunner" link exactly where they are today.
- Show both the closed state and the open/hovered state of the Categories dropdown.

### 6.1 — Shared component: category badge

New small element added to `ArticleCard`, positioned above the title (between the
image and the `<h2>`, replacing/joining the existing date line). Suggested treatment:
a small pill/label, `--color-accent` text or background-tint, uppercase or
sentence-case (designer's call), linking to that category's archive page. Must not
overpower the title — it's a secondary/eyebrow element, same visual weight class as
the existing `.card-date`.

Also apply this same badge to the article detail page (`/posts/<slug>`), positioned
near `.post-meta`, linking back to the category archive.

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
- Apply the **art direction in §2.5** throughout — modern, clean, Apple-style white
  aesthetic — while keeping every color/type/spacing value traceable back to a token
  in §2.1–2.3 (or explicitly flagged as new, per §6).
- Hover/focus states and transitions should actually work in the browser (real CSS
  `:hover`/transitions), not just be described.
