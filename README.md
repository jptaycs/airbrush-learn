# Airbrush Learn — Static Site

Plain static site (Astro) that renders articles from `src/data/articles.json`. No CMS, no WordPress admin, no build-time network dependency — a separate n8n content pipeline commits finished articles directly into this repo, and every push to `main` deploys automatically.

## Why Astro

- Ships zero JavaScript by default — this is a content site, not an app, so there's nothing to hydrate.
- Built-in SEO tooling: automatic sitemap, easy meta tags, clean per-page canonical URLs.
- `.astro` components are just HTML + minimal frontmatter — easiest to read/maintain for someone newer to the framework ecosystem.
- `getStaticPaths()` maps directly onto "one page per article," which is exactly this project's shape.

## How a build works

1. A separate n8n workflow generates an article (title, excerpt, HTML body, hero image) and, as its last two steps, commits the updated `src/data/articles.json` and the new `public/images/<slug>.png` straight to this repo's `main` branch via the GitHub API.
2. That push triggers Netlify's normal auto-deploy.
3. `astro build` reads `src/data/articles.json` to generate the homepage and one page per article at `/posts/<slug>`. No fetch, no webhook call, no environment variable needed at build time.

## Local development

```bash
npm install
npm run dev
```

That's it — `src/data/articles.json` is a normal committed file, so `npm run dev` immediately reflects whatever's currently in the repo (real content once the pipeline has run at least once, or the sample rows below before that).

## The n8n side: how articles get here

The pipeline runs elsewhere (in n8n) and isn't part of this repo. At a high level, its last stage:

1. Builds the article's final JSON shape — `slug`, `title`, `excerpt`, `content_html`, `image_prompt`, `source_topic`, `published_date`, `category` (mapped to one of this site's 9 fixed category slugs — see `src/data/categories.js`).
2. Fetches the current `src/data/articles.json` from GitHub (`GET /repos/<owner>/<repo>/contents/src/data/articles.json`), merges the new article in (replacing any existing entry with the same slug, so re-runs are idempotent), and commits it back (`PUT` to the same endpoint, using the `sha` from the GET to avoid clobbering concurrent edits).
3. Commits the generated hero image to `public/images/<slug>.png` the same way.

This means the GitHub token n8n uses needs **Contents: Read and write** access to this specific repository, and nothing else. If new articles stop appearing on the site, check that workflow's execution history in n8n before assuming this codebase is broken — specifically the nodes that call the GitHub API.

## Deploying (Netlify, auto-deploy on git push)

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project** → pick this repo.
3. Build settings (already set in `netlify.toml`, Netlify should pick them up automatically):
   - Build command: `astro build`
   - Publish directory: `dist`
4. No environment variables are required for the build.
5. Deploy. Every push to `main` — whether from n8n's automated commits or a manual commit — triggers a new deploy.
6. Point `airbrush.gallery`'s DNS at the Netlify site once you've verified a build looks right on the `*.netlify.app` preview URL. Keep WordPress running until this is confirmed working, then cut over.

## Project structure

```
airbrush-learn-site/
├── src/
│   ├── data/articles.json       # real content, committed directly by n8n via the GitHub API
│   ├── data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
│   ├── data/gallery.json        # curated gallery pieces (slug/title/category/image/credit) — not from n8n
│   ├── data/galleryCategories.js # fixed gallery discipline taxonomy (slug/label) — separate from article categories.js
│   ├── lib/readTime.js          # estimateReadMinutes(html) — computed from content_html word count
│   ├── layouts/BaseLayout.astro # shared <head>, header, footer, SEO/OG meta
│   ├── components/              # Header, Footer, ArticleCard, ArticleCarousel, ArticleSchema (JSON-LD), GalleryGrid, PageInteractions
│   ├── pages/
│   │   ├── index.astro          # homepage / article grid + per-category carousels + gallery preview
│   │   ├── posts/[slug].astro   # one page per article
│   │   ├── category/[slug].astro # one page per category, getStaticPaths() over categories.js
│   │   ├── gallery/index.astro  # gallery landing page — all pieces, filterable by discipline
│   │   ├── gallery/[category].astro # one page per gallery discipline, getStaticPaths() over galleryCategories.js
│   │   ├── terms-of-use.astro
│   │   └── privacy-policy.astro
│   └── styles/global.css        # @tailwind directives + global resets; design tokens live in tailwind.config.mjs
├── tailwind.config.mjs          # design tokens (colors, spacing, radius, fonts) — the palette lives here, not in global.css
├── netlify.toml                 # build command + publish dir for Netlify
└── public/                      # logo, favicon, robots.txt, /images/<slug>.png, /images/gallery/*.jpg
```

## Notes / next steps

- Terms of Use and Privacy Policy pages are real (unlike before) but are placeholder copy — swap in reviewed legal text before launch.
- There's no review/staging gate before an article goes live — n8n commits straight to `main` and Netlify deploys it immediately. Recover a bad article with `git revert` on the offending commit(s).
- No image optimization pipeline yet — hero images are committed as-is from the pipeline's generated PNG.
