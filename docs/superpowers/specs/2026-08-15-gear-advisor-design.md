# Airbrush Gear Advisor — Design

## Goal

Add a short client-side quiz that matches a visitor to specific airbrush gear and links them straight to SprayGunner's store to buy it — turning this content site's traffic into a real revenue path for the business that owns it, without adding any backend to an otherwise fully static site.

## Content model

Recommendations are backed by a small, hand-curated gear list — not a live SprayGunner catalog integration (which would require an API this static site doesn't have and is a bigger project of its own). The site owner supplies ~15-20 real gear picks; this repo just renders and scores them, the same pattern `articles.json`/`gallery.json` already use for other content.

### `src/data/gearAdvisor.json`

An array of gear items:

```json
{
  "name": "Iwata Eclipse HP-CS",
  "type": "airbrush",
  "price": 149,
  "budgetTier": "mid",
  "subjects": ["miniatures", "cosplay"],
  "experience": ["beginner", "intermediate"],
  "blurb": "Forgiving trigger control, the go-to first gravity-feed airbrush.",
  "url": "https://spraygunner.com/products/iwata-eclipse-hp-cs?utm_source=airbrushlearn&utm_medium=gear-advisor"
}
```

- `type` — `airbrush` | `compressor` | `kit` | `accessory`.
- `price` — number, USD. Shown on the result card; not used in scoring directly (see `budgetTier`).
- `budgetTier` — `budget` | `mid` | `pro`. Soft-matched against the quiz's budget answer.
- `subjects` — array of slugs from `src/data/galleryCategories.js` (the 17-discipline gallery taxonomy — **not** `categories.js`, the 9 article categories, which is mostly content-type labels like "Buying Guides" and only has 3 usable subject slugs). `compressor` and generic `accessory` items may omit `subjects` entirely, meaning "suits any subject."
- `experience` — array of `beginner` | `intermediate` | `advanced`. Soft-matched.
- `blurb` — one sentence, shown on the result card.
- `url` — full SprayGunner product URL, with `utm_source=airbrushlearn&utm_medium=gear-advisor` query params already appended so click-through is trackable on SprayGunner's side.

**Sourcing:** the user supplies the real list (name, type, price, tier, blurb, subjects, experience, product URL) — this isn't something to fabricate. Implementation will stub 2-3 placeholder items just to prove the quiz/scoring flow works, then swap in the real list once supplied, before this ships live.

## Pages & components

- **`src/pages/gear-advisor.astro`** — thin page wrapper: `BaseLayout` with title/description/canonical, same pattern as every other page in `src/pages/`. Indexed (no `noindex`) — this is a real, useful page worth ranking for.
- **`src/components/GearAdvisor.astro`** — the quiz itself: 4-step flow + results view, imports `gearAdvisor.json`, owns its own scoped `<script>` for step state and scoring. This is a deliberate, narrow exception to the site's "all client JS lives in `PageInteractions.astro`" convention (documented in `CLAUDE.md`) — a multi-step quiz with real state is business logic, not the lightweight polish that file is for, and Astro automatically code-splits component `<script>` tags so it only loads on this one page.
- **Homepage teaser** — a small inline section added directly in `index.astro` (not a separate component, matching how every other homepage section — hero, marquee, newsletter CTA, gallery preview — is inline markup there), linking to `/gear-advisor`.
- **Header nav link** — "Gear Advisor" added to `Header.astro`'s link list, both the desktop nav and the mobile hamburger panel, for discoverability beyond the homepage.

## Quiz flow

Four single-select steps, then a results screen:

1. **What do you want to paint?** — a grid of the 17 gallery disciplines (reusing `galleryCategories.js` labels).
2. **Budget** — Under $100 / $100–300 / $300+.
3. **Experience level** — Beginner / Intermediate / Advanced.
4. **Compressor** — "I already have one" / "I need the full setup."

Each step shows one question at a time (no scrolling through all 4 at once); a back button allows revisiting a previous step. No shareable results URL — results are computed and shown on-screen only, gone on refresh, matching this site's fully static architecture and keeping v1 simple.

## Scoring

Run entirely client-side in `GearAdvisor.astro`'s script, once all 4 answers are collected:

- **Subject match is a hard filter** for `airbrush`/`kit` items: the item's `subjects` must include the chosen discipline, or it's excluded from consideration entirely. Items with no `subjects` field (compressors, generic accessories) skip this filter.
- **Budget tier and experience are soft-scored**: +1 each for a match, no exclusion — with only ~15-20 items, hard-filtering on every dimension risks empty results.
- **Compressor handling**: if "I already have one," every `type: "compressor"` item is excluded outright. If "I need the full setup," compressors stay in play and one is guaranteed to appear in results even though it would rarely out-score an airbrush on subject+budget+experience scoring alone (compressors are picked from their own slot, not the general ranking — see below).

**Results are three slots, not one flat ranked list:**
1. **Your airbrush** — always shown; highest-scoring item among `airbrush`/`kit` types that passed the subject filter.
2. **Your compressor** — only shown if they need one; highest-scoring `compressor` item.
3. **A nice extra** — only shown if a scoring `accessory` item exists; omitted otherwise.

**Fallback for sparse data:** with ~15-20 items spread across 17 possible subjects, many disciplines will have zero direct subject match. If nothing passes the subject filter for "Your airbrush," fall back to the highest-scoring airbrush overall (ignoring the subject filter) and show a note: "Airbrushes are versatile — this pick works well across most subjects." Never show an empty results screen.

## Testing

- `npm run build` succeeds with no errors.
- Browser-verify all 4 quiz steps work, including the back button.
- Verify each result slot renders correctly for a normal case (a well-covered discipline, mid budget).
- Deliberately pick a discipline unlikely to be covered by the ~15-20 seed items (e.g. Nesting Dolls) to confirm the fallback note triggers instead of a blank "Your airbrush" slot.
- Verify compressor logic both ways: "already have one" excludes compressors from results; "need the full setup" always includes one.
- Verify the homepage teaser and header nav link (desktop + mobile) both land on `/gear-advisor`.
- Mobile viewport check of the quiz and results layout.

## Non-goals (explicitly out of scope for v1)

- No live SprayGunner catalog integration — hand-curated data only, matching this site's static, no-backend architecture.
- No shareable/bookmarkable results URL — on-screen only.
- No accounts, saved results, or email capture as part of the quiz flow.
- No admin UI for editing gear data — it's a committed JSON file, edited the same way `articles.json`/`gallery.json` are.
