# CLAUDE.md

Guidance for Claude Code (or any AI agent) working in this repo.

## What this project is

A plain static site for **Airbrush Learn** (airbrush.gallery) — an SEO blog about airbrushing (buying guides, techniques, comparisons, maintenance), owned by SprayGunner. It replaces a previous WordPress + n8n setup. No CMS, no server-side runtime — every deploy is a static build that auto-publishes on git push (Cloudflare Pages).

Article content itself is **not written here**. It's produced by a separate n8n multi-agent pipeline and stored in an n8n Data Table called `articles`. This repo only turns that data into pages.

## Commands

```bash
npm install
npm run dev      # runs prebuild (fetch script) then astro dev
npm run build    # runs prebuild then astro build -> dist/
npx astro dev    # skip the fetch step, preview using whatever's already in src/data/articles.json
```

There is no test suite. There is no lint step configured yet.

## How a build actually works (read this before changing the pipeline)

1. `npm run build` / `npm run dev` first run `scripts/fetch-articles.mjs` via the `prebuild` npm script.
2. That script calls the n8n "Articles API" webhook (`N8N_ARTICLES_WEBHOOK_URL` env var), keeps only rows where `status === "ready"`, decodes each row's `image_base64` to `public/images/<slug>.png`, and writes cleaned metadata (no base64 blob) to `src/data/articles.json`.
3. Astro then builds normally. `src/pages/index.astro` and `src/pages/posts/[slug].astro` both `import articles from '../data/articles.json'` — they never fetch anything themselves.

**Why it's split this way:** keeping the network call in one script means a data problem surfaces as one clear error message (`[fetch-articles] ...`) instead of a confusing failure deep inside Astro's build. If you're debugging "why isn't article X showing up," start in `scripts/fetch-articles.mjs`'s console output, not in the page templates.

`src/data/articles.json` is gitignored — it's regenerated on every build. A small sample (2 articles) is committed there anyway so the site can be previewed with `npx astro dev` before any real webhook is wired up. Don't treat that sample data as real content.

## Data contract

Each article row (from n8n) has these fields — see `README.md` for the full JSON shape the webhook must return:

| field | used for |
|---|---|
| `slug` | URL path (`/posts/<slug>`) and image filename (`/images/<slug>.png`) |
| `title` | `<title>`, `<h1>`, OG/Twitter meta, card heading |
| `excerpt` | meta description, OG description, card blurb |
| `content_html` | article body — inserted via `set:html` in `[slug].astro`. **This is the field the templates actually render.** |
| `page_html` | a complete standalone pre-baked page from the pipeline — intentionally **unused** by the templates, kept only as a fallback/reference so every page shares this repo's design instead of the pipeline's unstyled output |
| `image_base64` | decoded to a PNG file at build time, then discarded — never appears in `articles.json` |
| `status` | only `"ready"` rows get built; anything else is silently skipped |
| `published_date` | sort order (newest first) and displayed date |
| `category` | category badge, `/category/<slug>` archive-page membership, mega-menu counts — one of 9 fixed slugs (see `src/data/categories.js`); missing/unrecognized values are treated as uncategorized |

If you add a new field to the Data Table, update it in three places: the webhook workflow's output, `scripts/fetch-articles.mjs`'s `cleaned.push({...})`, and wherever it's consumed in `src/pages/`.

## Project structure

```
scripts/fetch-articles.mjs   # the only place that talks to n8n
src/data/articles.json       # generated; sample data committed for local preview
src/data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
src/layouts/BaseLayout.astro # <head>, SEO/OG meta, header, footer — every page uses this
src/components/              # Header, Footer, ArticleCard, ArticleSchema (JSON-LD)
src/pages/
  index.astro                # homepage / article grid
  posts/[slug].astro         # one page per article, getStaticPaths() over articles.json
  category/[slug].astro      # one page per category, getStaticPaths() over categories.js
  terms-of-use.astro
  privacy-policy.astro       # both real pages with placeholder copy — not stubs, but not final legal text either
src/styles/global.css        # @tailwind directives + global resets; design tokens live in tailwind.config.mjs
tailwind.config.mjs          # design tokens (colors, spacing, radius, fonts) — the palette lives here, not in global.css
public/                      # logo.png, favicon.ico, apple-touch-icon.png, robots.txt, generated /images/
```

## Conventions

- **Styling is Tailwind CSS.** Design tokens (colors, spacing, radius, fonts) live in `tailwind.config.mjs`, mapped from the original brand values — change the palette there, not by hunting through components. `global.css` only holds the three `@tailwind` directives plus genuinely global element resets (`html`, `img`, `body` font smoothing, and a base `a`/`a:hover` rule for anchors — like n8n's raw `content_html` — that can't carry utility classes directly). Article body content (`content_html`, rendered via `set:html`) is styled through the `@tailwindcss/typography` plugin's `prose` classes, not hand-written CSS.
- **No client-side JS unless there's a real reason.** This is a static content site; keep it that way.
- Astro components: frontmatter (`---`) does data/props only, no business logic beyond simple mapping — real logic belongs in `scripts/fetch-articles.mjs`.
- Slugs are sanitized (`slugify()` in the fetch script) — don't assume the Data Table's `slug` column is already URL-safe; the script is the source of truth for what a slug looks like on the live site.

## Deployment

Cloudflare Pages, connected to this repo. Build command `npm run build`, output directory `dist`. Required env var in the Pages project settings: `N8N_ARTICLES_WEBHOOK_URL`. Every push to `main` re-fetches the Data Table and re-deploys — there is no manual "export" step. Domain: `airbrush.gallery` (currently WordPress; cut over only after verifying a build on the `*.pages.dev` preview URL).

## Known gaps / things not to assume are done

- Terms of Use / Privacy Policy pages exist and are real Astro pages (not 404s), but the copy is placeholder — don't ship without a real review.
- No image optimization pipeline yet (hero images are written as-is from the pipeline's base64 PNG). If page weight becomes an issue, add `astro:assets` or `sharp` resizing in `fetch-articles.mjs`.
- No pagination on the homepage — fine at low article counts, will need addressing once the archive grows.
- The n8n "Articles API" webhook workflow (the thing this site's build depends on) lives in n8n, not this repo — see `README.md` for its spec. If builds start failing with a fetch/timeout error, check that workflow's execution history first, not this codebase.