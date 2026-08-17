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

### `src/data/gallery.json`

Unlike articles, gallery pieces come from two sources now: curated entries committed directly (as before), and community submissions approved via `/admin`'s "Gallery Submissions" tab. Both produce the identical shape: `{ slug, title, category, image, credit }` — `category` is a `src/data/galleryCategories.js` slug (not `categories.js`), `image` is a bare filename resolved against `public/images/gallery/`, and `credit` is the submitter's name for approved submissions or the existing attribution string for curated pieces. There's no field distinguishing a piece's origin — once approved, a submission is indistinguishable from a curated entry.

### `src/data/topics.json`

The n8n content pipeline's topic queue and publish-status tracker — added 2026-08-18 to replace a Google Sheet that turned out to be structurally unreliable for this (see the `n8n-pipeline-architecture` memory file for the full history of why). This repo is now the source of truth for what topics exist and their status, managed via `/admin`'s "Topics" tab (`netlify/functions/topics-{list,save,delete}.js`, same GitHub-Contents-API pattern as the article/gallery admin functions) and by n8n itself, which is expected to call `topics-list` to find the next eligible topic and `topics-save` to report its outcome, instead of talking to Google Sheets directly. Each entry: `{ id, category, search_intent, article_title, target_keyword, priority, status, publish_date, notes }` — field names and `id` values were migrated 1:1 from the old sheet's `" #"` column so nothing was renumbered. `status` is free text, not a strict enum, but n8n's filtering logic expects exactly `"Not started"`, `"Published"`, or `"Blocked"` (case-sensitive) — same convention the sheet used. `category` is a free-text label (e.g. `"Buying Guides"`), not a `categories.js` slug — it's mapped to a slug later, inside the "Build Article Entry" node's `categoryMap`, same as before.

**As of 2026-08-18, n8n's workflow has not yet been updated to use this** — it still points at the old Google Sheet. Wiring it up means replacing `Get row(s) in sheet` with an HTTP Request node calling `topics-list` (with an `x-admin-password` header, same secret as everything else in `/admin`), and replacing `Update row in sheet` with an HTTP Request node calling `topics-save` with the topic's updated `status`/`publish_date`. The WordPress-posting branch (`Upload Featured Media to WordPress` → `Create WordPress Draft Post`) was intentionally left untouched during this migration — it's known dead weight (see Known gaps below) but wiring topics.json in didn't require touching it.

## Project structure

```
src/data/articles.json       # real content, committed directly by n8n via the GitHub API
src/data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
src/data/gallery.json        # curated gallery pieces (slug/title/category/image/credit) — not from n8n
src/data/galleryCategories.js # fixed gallery discipline taxonomy (slug/label) — separate from article categories.js
src/data/topics.json         # n8n's topic queue/status tracker, replacing Google Sheets — managed via /admin's Topics tab
src/lib/readTime.js          # estimateReadMinutes(html) — computed from content_html word count
src/lib/sortArticles.js      # sortArticlesNewestFirst(articles) — shared newest-first sort; same-date ties break by array position (later = newer), since published_date has no time component
src/layouts/BaseLayout.astro # <head>, SEO/OG meta, header, footer — every page uses this
src/components/              # Header, Footer, ArticleCard, ArticleSchema (JSON-LD), GalleryGrid
src/pages/
  index.astro                # homepage / article grid + gallery preview
  posts/[slug].astro         # one page per article, getStaticPaths() over articles.json
  category/[slug].astro      # one page per category, getStaticPaths() over categories.js
  gallery/index.astro        # gallery landing page — all pieces, filterable by discipline
  gallery/[category].astro   # one page per gallery discipline, getStaticPaths() over galleryCategories.js
  gallery/submit.astro       # public community-submission form — posts to netlify/functions/gallery-submit
  terms-of-use.astro
  privacy-policy.astro       # both real pages with placeholder copy — not stubs, but not final legal text either
  admin.astro                # password-gated admin (articles: list/edit/publish/delete, with a live prose preview pane; gallery: review/approve/reject pending submissions; topics: n8n's topic queue, add/edit/delete) — noindex'd, calls netlify/functions/admin-*, gallery-*, and topics-*
src/styles/global.css        # @tailwind directives + global resets; design tokens live in tailwind.config.mjs
tailwind.config.mjs          # design tokens (colors, spacing, radius, fonts) — the palette lives here, not in global.css
netlify/functions/           # admin-{list,save,delete}.js (articles), gallery-{submit,pending-list,approve,reject}.js (gallery submissions), topics-{list,save,delete}.js (n8n's topic queue) — admin-{list,save,delete}.js, gallery-approve.js, and topics-{list,save,delete}.js all hold the GitHub write token; gallery-submit.js and gallery-pending-list.js only touch Netlify Blobs, never GitHub; see Deployment below
public/                      # logo.png, favicon.ico, apple-touch-icon.png, robots.txt, generated /images/, /images/gallery/*.jpg
```

## Conventions

- **Styling is Tailwind CSS.** Design tokens (colors, spacing, radius, fonts) live in `tailwind.config.mjs`, mapped from the original brand values — change the palette there, not by hunting through components. `global.css` only holds the three `@tailwind` directives plus genuinely global element resets (`html`, `img`, `body` font smoothing, and a base `a`/`a:hover` rule for anchors — like n8n's raw `content_html` — that can't carry utility classes directly). Article body content (`content_html`, rendered via `set:html`) is styled through the `@tailwindcss/typography` plugin's `prose` classes, not hand-written CSS.
- **Client-side JS is scoped to one file.** `src/components/PageInteractions.astro` carries the site's only client-side script — a cursor spray-trail effect, scroll-reveal animations, and header/mega-menu polish, included once via `BaseLayout.astro`. It's a deliberate, narrow exception to this site's static-first default: progressive enhancement (see its `.js`-scoped CSS in `global.css`), `prefers-reduced-motion` support, and fine-pointer-only gating are all load-bearing, not optional polish. This isn't a green light for JS generally — don't add more of it elsewhere without the same rigor.
- Astro components: frontmatter (`---`) does data/props only, no business logic beyond simple mapping.
- Slugs are sanitized (`slugify()` inside the n8n workflow's "Build Article Entry" Code node, mirroring the same rules the old fetch script used) — don't assume a title-derived slug is already URL-safe without checking that node.

## Deployment

Netlify, connected to this repo. Build command `astro build`, output directory `dist` (see `netlify.toml`). No environment variables are required for the build itself. Every push to `main` — from n8n's automated commits or a manual commit — triggers a deploy; there is no manual "export" step. Domain: `airbrush.gallery` (currently WordPress; cut over only after verifying a build on the Netlify preview URL).

**Runtime environment variables (required for `/admin` and gallery submissions to work, not for the build):** set in Netlify's site settings, not this repo.
- `GITHUB_PAT` — a GitHub Personal Access Token with write access to this repo, used inside `netlify/functions/admin-*.js` and `gallery-approve.js` to commit changes via the Contents API. Never exposed client-side.
- `ADMIN_PASSWORD` — the shared password gating `/admin` (its Articles, Gallery Submissions, and Topics tabs), and also the credential n8n is expected to send as `x-admin-password` when it calls `topics-list`/`topics-save`. This is the actual write-access boundary (there's no per-user auth), so it should be long and random, not memorable — treat it like the GitHub token itself, not a login password.

Pending gallery submissions (`gallery-submit.js`, `gallery-pending-list.js`) are stored in Netlify Blobs (`@netlify/blobs`), not git — this needs no separate credential or environment variable; it's automatically available to Netlify Functions on this site, and emulated locally with zero setup by `netlify-cli dev`.

Local testing of the functions needs a gitignored `.env` with the two variables above plus `npx netlify-cli dev` (`npm run dev` only serves the static site, not the functions).

## Known gaps / things not to assume are done

- Terms of Use / Privacy Policy pages exist and are real Astro pages (not 404s), but the copy is placeholder — don't ship without a real review.
- No image optimization pipeline yet (hero images are committed as-is from the pipeline's generated PNG). If page weight becomes an issue, add `astro:assets` or `sharp` resizing — there's no single fetch script anymore, so this would need to happen either in the n8n workflow before it commits, or as an Astro build-time transform.
- No pagination on the homepage — fine at low article counts, will need addressing once the archive grows.
- No review/staging gate before an article goes live — n8n commits straight to `main` on its weekly schedule, and Netlify deploys it immediately. A bad article is only caught after the fact; recover with `git revert` on the offending commit(s), then push.
- The n8n workflow this site's content depends on lives in n8n, not this repo. If new articles stop appearing, check that workflow's execution history first (specifically the `Publish Guard`, `Get Current articles.json`, `Commit articles.json`, and `Commit Hero Image` nodes) before assuming this codebase is broken.

## To Do

- [ ] **Wire the n8n workflow to `src/data/topics.json` instead of Google Sheets, then the two sheet bugs below become moot.** The sheet's `Update row in sheet` node turned out to be structurally unable to match rows on any run (confirmed 2026-08-18 by tracing a fresh export — see the `n8n-pipeline-architecture` memory file), and `Blocked - Not Published` was a separate dead end on failed runs (confirmed 2026-08-17). Rather than fix both inside Google Sheets, this repo now has its own topic queue (`src/data/topics.json`, `/admin`'s "Topics" tab, `netlify/functions/topics-{list,save,delete}.js`) as of 2026-08-18 — see the `src/data/topics.json` section above. **What's left:** in n8n, replace `Get row(s) in sheet` with an HTTP Request node calling `topics-list` (GET-equivalent, `x-admin-password` header) to find the next eligible topic, and replace `Update row in sheet` with an HTTP Request node calling `topics-save` (POST, same header) with the topic's `id`/`status`/`publish_date` after a run — both success and blocked-failure paths should call it, which finally gives `Blocked - Not Published` somewhere to report to instead of dead-ending. The WordPress-posting branch (`Upload Featured Media to WordPress` → `Create WordPress Draft Post`) was deliberately left alone during this migration — still pointless (see below), but out of scope for this change.

- [ ] **Swap in real Gear Advisor data.** `src/data/gearAdvisor.json` currently ships 3 clearly-labeled placeholder items (Iwata Eclipse HP-CS, Compact Studio Compressor, Airbrush Cleaning Kit) so the `/gear-advisor` quiz has something to score against. Replace them with the real ~15-20 item SprayGunner list per the schema in `docs/superpowers/specs/2026-08-15-gear-advisor-design.md`: `name`, `type` (`airbrush`/`compressor`/`kit`/`accessory`), `price`, `budgetTier` (`budget`/`mid`/`pro`), `subjects` (slugs from `src/data/galleryCategories.js` — **not** `categories.js`), `experience`, `blurb`, `url`.

- [ ] **Make the cursor spray-trail idle when the mouse stops.** The `requestAnimationFrame` loop in `PageInteractions.astro` (the fine-pointer cursor particle effect) runs indefinitely at ~60fps even once the pointer stops moving, burning CPU/battery on an idle tab.

- [ ] **Write real Terms of Use / Privacy Policy copy.** Both pages exist and render (not 404s), but the copy is still placeholder, per this file's own "Known gaps" note above — needs real legal review before either page is the actual system of record. This is now more urgent than before: `/gallery/submit` (merged 2026-08-18) collects a submitter's name, email, and uploaded artwork from the public with no accounts, and links to both pages — but the placeholder copy doesn't actually cover what's collected, why, or how long it's kept, and doesn't address what license a submitter grants when their work is published.

- [x] ~~Verify `/gallery/submit` → `gallery-approve` against a real GitHub API round-trip before relying on it.~~ Done 2026-08-18: ran the full flow locally against `netlify-cli dev` with a real `GITHUB_PAT`/`ADMIN_PASSWORD` — submitted a test piece, approved it via the pending-list/approve functions, confirmed two real commits landed on `main` (image + `gallery.json` append), confirmed the pending queue cleared, and confirmed the piece rendered on both `/gallery` and its discipline page after a build. Reverted both test commits afterward (`81ba312`, `567a584`) so nothing test-only stayed live. The flow works as designed end to end.

- [ ] **Cut over the live domain.** `airbrush.gallery` currently still points at the old WordPress site. Cut over to this Netlify-hosted site only after verifying a build on the Netlify preview URL (see "Deployment" above).

- [ ] **Get a decision on Facebook/X auto-posting.** Proposed adding a step to the end of the n8n publish pipeline to auto-post each new article to Facebook and/or X. Facebook just needs a Page + long-lived access token; X now requires a paid API tier to post (the free tier is read-only), so that half has a real ongoing cost. Awaiting a yes/no from ownership before building either side.

- [ ] **Make the n8n workflow set `status: "draft"` on new articles.** The `/admin` panel (merged 2026-08-17, see `docs/superpowers/specs/2026-08-17-admin-panel-design.md`) added a real `status: "draft" | "published"` field to `src/data/articles.json` (a missing `status` is treated as `"published"`, so existing articles were unaffected). For the panel to actually let you review an article before it goes live, the n8n workflow's "Build Article Entry" node needs to set `status: "draft"` when it commits a new entry — without that change, new articles keep auto-publishing immediately, same as before this panel existed, and the panel is only useful for editing/unpublishing/deleting after the fact.

- [ ] **Verify `/admin` against a real GitHub API round-trip before relying on it.** The panel's Netlify Functions (`netlify/functions/admin-*.js`) were built and reviewed without a real `GITHUB_PAT` available in the dev environment — build success, HTTP status codes (401/400/409/502), and client-side UI logic were all verified, but a real `admin-list` fetch of live repo data, a real `admin-save`/`admin-delete` commit landing on GitHub, and a genuine stale-`sha` 409 conflict were not. Once `GITHUB_PAT`/`ADMIN_PASSWORD` are set in Netlify, test all of this against a deploy preview before trusting it in production.

- [ ] **`/admin`'s password has no rate limiting.** The shared password is the sole gate on repo write access (arbitrary commits to `main`, which auto-deploy), and nothing currently throttles guesses. Mitigated for now by using a long random password (see Deployment above), but real rate limiting (Netlify's own, or a short delay on failed attempts) would close this properly.

- [ ] **Drop the dead WordPress-posting branch from the n8n workflow.** `Upload Featured Media to WordPress` → `Create WordPress Draft Post` still silently creates a real draft post on `airbrush.gallery`'s still-live WordPress install on every pipeline run — but that's not how content actually publishes anymore (GitHub commits → Netlify are). It was left in place during the 2026-08-18 topics.json migration (see the To Do above) since removing it wasn't required to fix the sheet bugs, but it's pointless work the pipeline is still doing every run. Low priority — no user-facing impact, just wasted API calls and orphaned WordPress drafts piling up.

- [x] ~~`/admin`'s Topics tab needs a real-GitHub-round-trip verification.~~ Done 2026-08-18: ran `topics-list` → `topics-save` (add) → confirmed a real commit landed on GitHub → `topics-delete` → confirmed it was removed cleanly. All three functions work correctly against live GitHub.