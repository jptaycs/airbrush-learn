# CLAUDE.md

Guidance for Claude Code (or any AI agent) working in this repo.

## What this project is

A plain static site for **Airbrush Learn** (airbrush.gallery) — an SEO blog about airbrushing (buying guides, techniques, comparisons, maintenance), owned by SprayGunner. It replaces a previous WordPress setup. No CMS, no server-side runtime — every deploy is a static build that auto-publishes on git push (Netlify).

Article content itself is **not written here**. It's produced by a separate n8n multi-agent pipeline, which — as its last step — commits the finished article and its hero image directly into this repo via the GitHub Contents API. This repo only turns whatever's already committed into pages; it never fetches anything from n8n itself.

## Commands

```bash
npm install
npm run dev      # astro dev — reads whatever's already in src/data/articles.json
npm run build    # astro build -> dist/
```

There is no test suite. There is no lint step configured yet.

## How a build actually works (read this before changing the pipeline)

1. n8n's content pipeline generates an article, then — as its last two steps — commits `src/data/articles.json` (with the new article merged in) and `public/images/<slug>.png` (the hero image) straight to this repo's `main` branch via the GitHub API.
2. That commit triggers Netlify's normal git-push auto-deploy. There is no prebuild fetch step and no build-time network dependency on n8n — by the time a build runs, the content is already sitting in the repo.
3. Astro builds normally. `src/pages/index.astro` and `src/pages/posts/[slug].astro` both `import articles from '../data/articles.json'` — they never fetch anything themselves.

**Why it's built this way:** committing content directly means a build never depends on a live external service being reachable — if n8n or its webhook is down, existing content still builds and deploys fine. It also means every article change has full git history and is trivially revertible (`git revert`) if something publishes wrong.

`src/data/articles.json` is a normal tracked file, not generated at build time — n8n's commits are the only thing that update it in production. Don't manually edit it and expect it to survive the next n8n run without conflict; treat n8n as its source of truth going forward.

## Data contract

Each article object in `src/data/articles.json` has these fields:

| field | used for |
|---|---|
| `slug` | URL path (`/posts/<slug>`) and image filename (`/images/<slug>.png`) |
| `title` | `<title>`, `<h1>`, OG/Twitter meta, card heading |
| `excerpt` | meta description, OG description, card blurb |
| `content_html` | article body — inserted via `set:html` in `[slug].astro`. **This is the field the templates actually render.** |
| `image_prompt` | the prompt used to generate the hero image; carried through for reference, not rendered anywhere |
| `source_topic` | the target SEO keyword from the content brief; carried through for reference, not rendered anywhere |
| `published_date` | sort order (newest first) and displayed date |
| `category` | category badge, `/category/<slug>` archive-page membership, mega-menu counts — one of 9 fixed slugs (see `src/data/categories.js`); missing/unrecognized values are treated as uncategorized |
| `status` | `"draft"` or `"published"`. A missing/absent field is treated as `"published"` — no migration was needed when this field was introduced. Drafts are filtered out of the homepage, category pages, and the sitemap, but still get a `noindex`'d `/posts/<slug>` page so they're directly previewable. See `/admin` below. |

The n8n workflow's `Publish Guard (block fallback)` node is what decides whether an article reaches the commit step at all; nothing here re-checks that. The n8n workflow does **not** currently set `status: "draft"` on new entries (see To Do below) — until it does, every article it commits is immediately live, same as before `status` existed.

If you add a new field, update it in two places: the n8n workflow's "Build Article Entry" node (where the JSON object is constructed) and wherever it should be consumed in `src/pages/`.

## Project structure

```
src/data/articles.json       # real content, committed directly by n8n via the GitHub API
src/data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
src/data/gallery.json        # curated gallery pieces (slug/title/category/image/credit) — not from n8n
src/data/galleryCategories.js # fixed gallery discipline taxonomy (slug/label) — separate from article categories.js
src/lib/readTime.js          # estimateReadMinutes(html) — computed from content_html word count
src/layouts/BaseLayout.astro # <head>, SEO/OG meta, header, footer — every page uses this
src/components/              # Header, Footer, ArticleCard, ArticleSchema (JSON-LD), GalleryGrid
src/pages/
  index.astro                # homepage / article grid + gallery preview
  posts/[slug].astro         # one page per article, getStaticPaths() over articles.json
  category/[slug].astro      # one page per category, getStaticPaths() over categories.js
  gallery/index.astro        # gallery landing page — all pieces, filterable by discipline
  gallery/[category].astro   # one page per gallery discipline, getStaticPaths() over galleryCategories.js
  terms-of-use.astro
  privacy-policy.astro       # both real pages with placeholder copy — not stubs, but not final legal text either
  admin.astro                # password-gated article admin (list/edit/publish/delete) — noindex'd, calls netlify/functions/admin-*
src/styles/global.css        # @tailwind directives + global resets; design tokens live in tailwind.config.mjs
tailwind.config.mjs          # design tokens (colors, spacing, radius, fonts) — the palette lives here, not in global.css
netlify/functions/           # admin-list.js, admin-save.js, admin-delete.js — the only code that holds the GitHub write token; see Deployment below
public/                      # logo.png, favicon.ico, apple-touch-icon.png, robots.txt, generated /images/, /images/gallery/*.jpg
```

## Conventions

- **Styling is Tailwind CSS.** Design tokens (colors, spacing, radius, fonts) live in `tailwind.config.mjs`, mapped from the original brand values — change the palette there, not by hunting through components. `global.css` only holds the three `@tailwind` directives plus genuinely global element resets (`html`, `img`, `body` font smoothing, and a base `a`/`a:hover` rule for anchors — like n8n's raw `content_html` — that can't carry utility classes directly). Article body content (`content_html`, rendered via `set:html`) is styled through the `@tailwindcss/typography` plugin's `prose` classes, not hand-written CSS.
- **Client-side JS is scoped to one file.** `src/components/PageInteractions.astro` carries the site's only client-side script — a cursor spray-trail effect, scroll-reveal animations, and header/mega-menu polish, included once via `BaseLayout.astro`. It's a deliberate, narrow exception to this site's static-first default: progressive enhancement (see its `.js`-scoped CSS in `global.css`), `prefers-reduced-motion` support, and fine-pointer-only gating are all load-bearing, not optional polish. This isn't a green light for JS generally — don't add more of it elsewhere without the same rigor.
- Astro components: frontmatter (`---`) does data/props only, no business logic beyond simple mapping.
- Slugs are sanitized (`slugify()` inside the n8n workflow's "Build Article Entry" Code node, mirroring the same rules the old fetch script used) — don't assume a title-derived slug is already URL-safe without checking that node.

## Deployment

Netlify, connected to this repo. Build command `astro build`, output directory `dist` (see `netlify.toml`). No environment variables are required for the build itself. Every push to `main` — from n8n's automated commits or a manual commit — triggers a deploy; there is no manual "export" step. Domain: `airbrush.gallery` (currently WordPress; cut over only after verifying a build on the Netlify preview URL).

**Runtime environment variables (required for `/admin` to work, not for the build):** set in Netlify's site settings, not this repo.
- `GITHUB_PAT` — a GitHub Personal Access Token with write access to this repo, used only inside `netlify/functions/admin-*.js` to commit article changes via the Contents API. Never exposed client-side.
- `ADMIN_PASSWORD` — the shared password gating `/admin`. This is the actual write-access boundary (there's no per-user auth), so it should be long and random, not memorable — treat it like the GitHub token itself, not a login password.

Local testing of the functions needs a gitignored `.env` with the same two variables plus `npx netlify-cli dev` (`npm run dev` only serves the static site, not the functions).

## Known gaps / things not to assume are done

- Terms of Use / Privacy Policy pages exist and are real Astro pages (not 404s), but the copy is placeholder — don't ship without a real review.
- No image optimization pipeline yet (hero images are committed as-is from the pipeline's generated PNG). If page weight becomes an issue, add `astro:assets` or `sharp` resizing — there's no single fetch script anymore, so this would need to happen either in the n8n workflow before it commits, or as an Astro build-time transform.
- No pagination on the homepage — fine at low article counts, will need addressing once the archive grows.
- No review/staging gate before an article goes live — n8n commits straight to `main` on its weekly schedule, and Netlify deploys it immediately. A bad article is only caught after the fact; recover with `git revert` on the offending commit(s), then push.
- The n8n workflow this site's content depends on lives in n8n, not this repo. If new articles stop appearing, check that workflow's execution history first (specifically the `Publish Guard`, `Get Current articles.json`, `Commit articles.json`, and `Commit Hero Image` nodes) before assuming this codebase is broken.

## To Do

- [ ] **Fix `Blocked - Not Published` never updating the topics sheet.** Root-caused on 2026-08-17 by tracing the actual node connections in the exported workflow ("SEO Content Creation - Multi-Agent Pipeline (v3 - Jerome)"): `Filter - Unpublished Only` keeps any topic where `Status != "Published"`. If any of the Orchestrator Agent's six sub-agents fails, it returns `PIPELINE_FAILED` per its own system prompt, `Publish Guard` correctly detects this and routes to `Blocked - Not Published` — but that node **has no outgoing connection at all**. It sets an in-memory status/reason and dead-ends; nothing is ever written back to the sheet. Since the sheet's `Status` never changes, the same topic gets handed back on every subsequent run forever, with no visible failure signal anywhere except n8n's own execution history. This is what caused the "How to Airbrush Freehand" topic to be reprocessed/overwritten multiple times (duplicates from an earlier occurrence cleaned up in commit `d114f41`) and what caused an August 2026 run to produce nothing at all, anywhere. The earlier theory that the `Update row in sheet` node's row-matching (`" #"` column) was the culprit was a red herring — that node is only reached on the *success* path (after a real WordPress post is created) and looks correctly configured. **The actual fix:** give `Blocked - Not Published` an outgoing connection that writes the block status + reason back to the sheet row (and ideally alerts someone), so failed topics stop looping silently. See the `n8n-pipeline-architecture` and `n8n-topics-sheet` memory files for the full node-by-node trace and the sheet's URL/columns.

- [ ] **Swap in real Gear Advisor data.** `src/data/gearAdvisor.json` currently ships 3 clearly-labeled placeholder items (Iwata Eclipse HP-CS, Compact Studio Compressor, Airbrush Cleaning Kit) so the `/gear-advisor` quiz has something to score against. Replace them with the real ~15-20 item SprayGunner list per the schema in `docs/superpowers/specs/2026-08-15-gear-advisor-design.md`: `name`, `type` (`airbrush`/`compressor`/`kit`/`accessory`), `price`, `budgetTier` (`budget`/`mid`/`pro`), `subjects` (slugs from `src/data/galleryCategories.js` — **not** `categories.js`), `experience`, `blurb`, `url`.

- [ ] **Fix the date-sort comparator bug.** `(a, b) => a.published_date < b.published_date ? 1 : -1`, used in both `src/pages/index.astro` and `src/pages/category/[slug].astro`, returns `-1` for equal dates instead of `0`, which violates the comparator contract. Only bites once multiple articles share a `published_date`, but should be fixed — and ideally shared instead of duplicated across both files — before that happens.

- [ ] **Sitemap filter still doesn't cover gallery pages.** `astro.config.mjs`'s `sitemap()` integration now has a `filter` (added alongside the admin panel work) that excludes draft posts, empty categories, and `/admin` — but it doesn't know about `src/pages/gallery/[category].astro`, so the 7 gallery discipline pages currently marked `noindex` (zero pieces) still get listed in `sitemap.xml`. Extend the same filter to also check gallery category page paths against piece counts from `gallery.json`.

- [ ] **Make the cursor spray-trail idle when the mouse stops.** The `requestAnimationFrame` loop in `PageInteractions.astro` (the fine-pointer cursor particle effect) runs indefinitely at ~60fps even once the pointer stops moving, burning CPU/battery on an idle tab.

- [ ] **Write real Terms of Use / Privacy Policy copy.** Both pages exist and render (not 404s), but the copy is still placeholder, per this file's own "Known gaps" note above — needs real legal review before either page is the actual system of record.

- [ ] **Cut over the live domain.** `airbrush.gallery` currently still points at the old WordPress site. Cut over to this Netlify-hosted site only after verifying a build on the Netlify preview URL (see "Deployment" above).

- [ ] **Get a decision on Facebook/X auto-posting.** Proposed adding a step to the end of the n8n publish pipeline to auto-post each new article to Facebook and/or X. Facebook just needs a Page + long-lived access token; X now requires a paid API tier to post (the free tier is read-only), so that half has a real ongoing cost. Awaiting a yes/no from ownership before building either side.

- [ ] **Make the n8n workflow set `status: "draft"` on new articles.** The `/admin` panel (merged 2026-08-17, see `docs/superpowers/specs/2026-08-17-admin-panel-design.md`) added a real `status: "draft" | "published"` field to `src/data/articles.json` (a missing `status` is treated as `"published"`, so existing articles were unaffected). For the panel to actually let you review an article before it goes live, the n8n workflow's "Build Article Entry" node needs to set `status: "draft"` when it commits a new entry — without that change, new articles keep auto-publishing immediately, same as before this panel existed, and the panel is only useful for editing/unpublishing/deleting after the fact.

- [ ] **Verify `/admin` against a real GitHub API round-trip before relying on it.** The panel's Netlify Functions (`netlify/functions/admin-*.js`) were built and reviewed without a real `GITHUB_PAT` available in the dev environment — build success, HTTP status codes (401/400/409/502), and client-side UI logic were all verified, but a real `admin-list` fetch of live repo data, a real `admin-save`/`admin-delete` commit landing on GitHub, and a genuine stale-`sha` 409 conflict were not. Once `GITHUB_PAT`/`ADMIN_PASSWORD` are set in Netlify, test all of this against a deploy preview before trusting it in production.

- [ ] **`/admin`'s password has no rate limiting.** The shared password is the sole gate on repo write access (arbitrary commits to `main`, which auto-deploy), and nothing currently throttles guesses. Mitigated for now by using a long random password (see Deployment above), but real rate limiting (Netlify's own, or a short delay on failed attempts) would close this properly.