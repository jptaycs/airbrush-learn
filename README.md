# Airbrush Learn — Static Site

Plain static site (Astro) that renders articles from the n8n `articles` Data Table. No CMS, no WordPress — every build fetches the current articles, writes hero images, and generates HTML.

## Why Astro

- Ships zero JavaScript by default — this is a content site, not an app, so there's nothing to hydrate.
- Built-in SEO tooling: automatic sitemap, easy meta tags, clean per-page canonical URLs.
- `.astro` components are just HTML + minimal frontmatter — easiest to read/maintain for someone newer to the framework ecosystem.
- `getStaticPaths()` maps directly onto "one page per Data Table row," which is exactly this project's shape.

## How a build works

1. `npm run build` first runs `scripts/fetch-articles.mjs` (the `prebuild` step).
2. That script calls the n8n webhook (`N8N_ARTICLES_WEBHOOK_URL`), filters to `status: "ready"`, decodes each `image_base64` to `public/images/<slug>.png`, and writes clean metadata to `src/data/articles.json`.
3. Astro then builds normally, reading `src/data/articles.json` to generate the homepage and one page per article at `/posts/<slug>`.

Everything lives in one script (`fetch-articles.mjs`) on purpose — if something's wrong with the data, you'll get one clear error message there instead of a confusing failure buried in the Astro build.

## Local development

```bash
npm install
cp .env.example .env
# edit .env and set N8N_ARTICLES_WEBHOOK_URL to the real webhook (see below)
npm run dev
```

If you don't have the webhook ready yet, `src/data/articles.json` already has two sample articles committed so you can preview the layout immediately — just run `astro dev` directly (skip `npm run dev`, which would overwrite it via the fetch script).

## The n8n side: "Articles API" webhook

n8n Data Tables don't have a public REST API of their own, so you need a small workflow that exposes the table over a webhook. Give this to the n8n AI Assistant (or build it manually) in the same n8n instance as the content pipeline:

```
Build a new workflow called "Articles API":

1. Webhook node — GET, path "articles", Respond: "Using 'Respond to Webhook' node".
2. Data Table node — "Get row(s)", table "articles" (id 4Ff6A1l01jYG0kaV), no filter
   (return all rows — the build script filters by status itself).
3. Code node "Wrap as array" — collect all items into one JSON object shaped as:
   { "articles": [ <one object per row, with all its columns> ] }
   (Use $input.all().map(item => item.json) to build the array from all incoming items,
   then return a single item: { json: { articles: thatArray } }.)
4. Respond to Webhook node — respond with the JSON from step 3, Content-Type
   application/json.

Set the workflow Active. Give me the production webhook URL once it's built.
```

Expected response shape (this is what `scripts/fetch-articles.mjs` expects):

```json
{
  "articles": [
    {
      "slug": "single-vs-dual-action-airbrush",
      "title": "...",
      "excerpt": "...",
      "content_html": "<p>...</p>",
      "page_html": "<!DOCTYPE html>...",
      "image_base64": "iVBORw0KG...",
      "image_prompt": "...",
      "status": "ready",
      "category": "beginner",
      "source_topic": "...",
      "published_date": "2026-08-01"
    }
  ]
}
```

Only rows with `status: "ready"` get built into pages — draft/blocked rows in the table are simply skipped.

## Deploying (Cloudflare Pages, auto-deploy on git push)

Cloudflare Pages is the recommendation here: generous free tier, fast global CDN, and git-push deploys out of the box — but Netlify or Vercel work identically since this is a plain static build.

1. Push this repo to GitHub/GitLab.
2. In Cloudflare Pages: **Create a project → Connect to Git** → pick this repo.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Add an environment variable in the Pages project settings: `N8N_ARTICLES_WEBHOOK_URL` = the production webhook URL from above.
5. Deploy. Every push to `main` re-runs the build, which re-fetches whatever's currently in the Data Table — so a new "ready" article shows up on the live site on the next deploy, no manual export step needed.
6. Point `airbrush.gallery`'s DNS at the Cloudflare Pages project once you've verified the build looks right on the `*.pages.dev` preview URL. Keep WordPress running until this is confirmed working, then cut over.

## Project structure

```
airbrush-learn-site/
├── scripts/fetch-articles.mjs   # prebuild: fetch + decode images + write local JSON
├── src/
│   ├── data/articles.json       # generated at build time (gitignored) — sample data committed for local preview
│   ├── data/categories.js       # fixed 9-category taxonomy (label/description) — not from n8n
│   ├── lib/readTime.js          # estimateReadMinutes(html) — computed from content_html word count
│   ├── layouts/BaseLayout.astro # shared <head>, header, footer, SEO/OG meta
│   ├── components/              # Header, Footer, ArticleCard, ArticleSchema (JSON-LD)
│   ├── pages/
│   │   ├── index.astro          # homepage / article grid
│   │   ├── posts/[slug].astro   # one page per article
│   │   ├── category/[slug].astro # one page per category, getStaticPaths() over categories.js
│   │   ├── terms-of-use.astro
│   │   └── privacy-policy.astro
│   └── styles/global.css        # @tailwind directives + global resets; design tokens live in tailwind.config.mjs
├── tailwind.config.mjs          # design tokens (colors, spacing, radius, fonts) — the palette lives here, not in global.css
└── public/                      # logo, favicon, robots.txt, generated /images/<slug>.png
```

## Notes / next steps

- `page_html` (the standalone pre-baked page from the pipeline) is intentionally unused by the templates — kept in the Data Table as a fallback/reference only, per the brief.
- Terms of Use and Privacy Policy pages are real (unlike before) but are placeholder copy — swap in reviewed legal text before launch.
- Consider adding a `Filter` step to the "Articles API" webhook workflow if the table grows large, so it doesn't return already-superseded rows unnecessarily.
