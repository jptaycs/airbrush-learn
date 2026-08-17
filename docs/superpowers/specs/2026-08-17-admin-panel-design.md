# Article Admin Panel — Design

## Goal

Add a password-gated `/admin` page where the site owner can list, edit, publish/unpublish, and delete articles — without hand-editing `src/data/articles.json` via git. Writes go through a small server-side layer so the GitHub write credential never reaches the browser, while the page-access gate itself is a deliberately lightweight deterrent, not enterprise auth (see "Security model" below for why that split is intentional, not a shortcut).

## Why now / what this depends on

`articles.json` is currently written only by the n8n content pipeline, which commits directly to `main` with no review step — every entry it produces is instantly live. This panel adds a real `status` field so articles *can* be reviewed before publishing, but the panel alone doesn't make that happen automatically: n8n's own "Build Article Entry" node needs to be updated to set `status: "draft"` on new entries, which is a change on the n8n side, outside this repo. That's tracked as its own item in `CLAUDE.md`'s To Do list. Without it, new n8n articles keep auto-publishing exactly as they do today, and this panel is still useful (edit/unpublish/delete after the fact) but doesn't gate anything before it goes live.

## Data model change

Add `status: "draft" | "published"` to each article object in `src/data/articles.json`. **A missing `status` is treated as `"published"`** everywhere it's read — so the articles already live today need no migration.

```json
{
  "slug": "...",
  "title": "...",
  "status": "draft",
  "...": "... (all existing fields unchanged)"
}
```

## Security model

Two different things need two different levels of protection, and conflating them would either over-build or under-protect:

- **Who can open `/admin` and see the article list/editor.** This is a low-stakes gate — casual visitors, not a determined attacker. A password checked against a value cached in `sessionStorage` (cleared when the tab closes) is enough. The page's HTML/JS shell itself is not secret (this is a static site — anyone can view-source it), and that's fine.
- **Who can actually write to the repo.** This is not low-stakes — it's the same GitHub write access n8n itself uses. That credential must never reach the browser. Every write (and the list fetch, for consistency) goes through a Netlify Function that holds the token as a server-side environment variable, and independently re-checks the shared password itself before doing anything — so even someone who bypasses the page's UI entirely and calls the function directly still needs the password to make it do anything.

## Netlify Functions (`netlify/functions/`)

All three require an `x-admin-password` request header and reject with 401 before doing anything else if it doesn't match the `ADMIN_PASSWORD` environment variable.

- **`admin-list`** (GET) — fetches `src/data/articles.json` fresh from the GitHub Contents API (not from the static build, so it's never stale) and returns the parsed array.
- **`admin-save`** (POST) — takes a full article object (identified by `slug`), fetches the current file + its `sha`, replaces the matching entry (or appends if the slug is new — not expected in normal use, but harmless), and commits back via the Contents API using the same GitHub PAT mechanism n8n already uses. Publishing/unpublishing is just this same call with `status` flipped — no separate endpoint.
- **`admin-delete`** (POST) — takes a `slug`, fetches current file + `sha`, removes the matching entry, commits back. The hero image file in `public/images/` is deliberately left in place — deleting it too would mean a second GitHub delete-file call per delete, for a cost (an orphaned, harmless image file) not worth the complexity.

**Concurrency:** GitHub's Contents API requires the file's current `sha` to accept a write. If n8n commits to `articles.json` between when the admin page loaded its list and when a save/delete is submitted, the write fails with a conflict rather than silently overwriting or corrupting the file. `admin-save`/`admin-delete` surface this as a clear "this file changed since you loaded it — refresh and try again" error.

## The admin page (`src/pages/admin.astro`)

`noindex: true`. Like `GearAdvisor.astro`, this needs real client-side state (login, list, edit forms, async calls), so it gets its own scoped `<script>` — the same established, narrow exception to this site's usual single-JS-file (`PageInteractions.astro`) convention.

- **Login:** a password field. Submitting caches the password in `sessionStorage` and calls `admin-list`; wrong password shows a clear error, right password reveals the article table.
- **Article table:** title, slug, a status badge, published date, category. Each row has **Edit**, a one-click **Publish/Unpublish** toggle, and **Delete** (behind a native `confirm()` — acceptable for a low-traffic, single-user internal tool).
- **Edit** expands a form: title, excerpt, published date, category (dropdown from the existing 9 categories in `src/data/categories.js`), status, and the body as a plain `<textarea>` of raw HTML — matching how `content_html` is already stored. Not a rich-text editor; out of scope (see Non-goals).
- Every draft article still gets a real `/posts/<slug>` page (see below), so each table row can link straight to a live preview before you decide to publish it.

## Filtering changes (drafts stay invisible to visitors, but previewable)

- **`src/pages/index.astro`, `src/pages/category/[slug].astro`:** filter articles to `status !== 'draft'` before any sorting/featured/carousel/count logic runs. Drafts never appear in the hero, "Latest Articles," category counts, or carousels.
- **`src/pages/posts/[slug].astro`:** `getStaticPaths()` still builds a page for *every* article, drafts included, so the admin table's preview link always works — but a draft's page gets `noindex: true` (the prop `BaseLayout` already supports), so it's reachable by direct link but not search-indexed.
- **Sitemap (`astro.config.mjs`):** the `sitemap()` integration currently has no `filter`, so `noindex`'d pages (already true for some empty category/gallery pages, and now also true for drafts) get listed in `sitemap.xml` anyway. Fixing this was already on `CLAUDE.md`'s To Do list as a standalone nice-to-have; it becomes load-bearing here (a draft leaking into the sitemap defeats the point), so it's fixed as part of this work rather than left pending.

## Setup required outside this repo

Two things only the site owner can do, needed before this works when deployed:

1. Create a GitHub Personal Access Token with write access to this repo (same permission level n8n's own token already has).
2. In Netlify's site settings, add two environment variables: the PAT (e.g. `GITHUB_PAT`) and a strong shared admin password (e.g. `ADMIN_PASSWORD`) — this password is the real protection boundary (see "Security model"), so it should be strong even though the page-access UX around it is deliberately simple.

## Testing

- `npm run build` succeeds with no errors.
- The Netlify Functions don't run under plain `npm run dev` (that only serves the static Astro site) — testing them locally requires the Netlify CLI (`netlify dev`), or testing against a real Netlify deploy preview once the environment variables are set there.
- Wrong password is rejected by both the page and by calling a function directly with a bad password.
- Edit + save updates the article and is reflected on next `admin-list` load.
- Publish/unpublish toggle actually changes homepage/category visibility and the post page's `noindex` state.
- Delete removes the article from the list and from the built site (its image file remains in `public/images/`, unused — expected).
- A draft's `/posts/<slug>` page loads directly (previewable) but does not appear in `sitemap.xml` or anywhere on the homepage/category pages.
- Simulate a concurrent write (edit `articles.json` via a separate commit between loading the list and saving) and confirm `admin-save` reports a conflict instead of silently overwriting it.

## Non-goals (explicitly out of scope for this version)

- No rich-text editor — raw HTML textarea only.
- No multi-user accounts — one shared password, matching "just me" access.
- No hero-image replace/upload UI — swapping an article's image still means replacing the file via git directly.
- No delete-undo UI — recovery is via `git revert`, same as every other content change in this repo.
- No bulk actions (bulk publish, bulk delete, etc.).
