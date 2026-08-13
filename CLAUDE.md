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

There's no `status` field and no filtering step — every object present in `articles.json` gets built into a page. The n8n workflow's `Publish Guard (block fallback)` node is what decides whether an article reaches the commit step at all; nothing here re-checks that.

If you add a new field, update it in two places: the n8n workflow's "Build Article Entry" node (where the JSON object is constructed) and wherever it should be consumed in `src/pages/`.

## Project structure

```
src/data/articles.json       # real content, committed directly by n8n via the GitHub API
src/data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
src/lib/readTime.js          # estimateReadMinutes(html) — computed from content_html word count
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
- **Client-side JS is scoped to one file.** `src/components/PageInteractions.astro` carries the site's only client-side script — a cursor spray-trail effect, scroll-reveal animations, and header/mega-menu polish, included once via `BaseLayout.astro`. It's a deliberate, narrow exception to this site's static-first default: progressive enhancement (see its `.js`-scoped CSS in `global.css`), `prefers-reduced-motion` support, and fine-pointer-only gating are all load-bearing, not optional polish. This isn't a green light for JS generally — don't add more of it elsewhere without the same rigor.
- Astro components: frontmatter (`---`) does data/props only, no business logic beyond simple mapping.
- Slugs are sanitized (`slugify()` inside the n8n workflow's "Build Article Entry" Code node, mirroring the same rules the old fetch script used) — don't assume a title-derived slug is already URL-safe without checking that node.

## Deployment

Netlify, connected to this repo. Build command `astro build`, output directory `dist` (see `netlify.toml`). No environment variables are required for the build itself. Every push to `main` — from n8n's automated commits or a manual commit — triggers a deploy; there is no manual "export" step. Domain: `airbrush.gallery` (currently WordPress; cut over only after verifying a build on the Netlify preview URL).

## Known gaps / things not to assume are done

- Terms of Use / Privacy Policy pages exist and are real Astro pages (not 404s), but the copy is placeholder — don't ship without a real review.
- No image optimization pipeline yet (hero images are committed as-is from the pipeline's generated PNG). If page weight becomes an issue, add `astro:assets` or `sharp` resizing — there's no single fetch script anymore, so this would need to happen either in the n8n workflow before it commits, or as an Astro build-time transform.
- No pagination on the homepage — fine at low article counts, will need addressing once the archive grows.
- No review/staging gate before an article goes live — n8n commits straight to `main` on its weekly schedule, and Netlify deploys it immediately. A bad article is only caught after the fact; recover with `git revert` on the offending commit(s), then push.
- The n8n workflow this site's content depends on lives in n8n, not this repo. If new articles stop appearing, check that workflow's execution history first (specifically the `Publish Guard`, `Get Current articles.json`, `Commit articles.json`, and `Commit Hero Image` nodes) before assuming this codebase is broken.