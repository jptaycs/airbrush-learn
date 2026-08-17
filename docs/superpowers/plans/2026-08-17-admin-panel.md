# Article Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a password-gated `/admin` page where the site owner can list, edit, publish/unpublish, and delete articles, backed by a real `status: "draft" | "published"` field and a set of Netlify Functions that keep the GitHub write credential server-side.

**Architecture:** A `status` field is added to the article data model (missing = published, so existing content is unaffected); three pages (`index.astro`, `category/[slug].astro`, `posts/[slug].astro`) and the sitemap filter are updated to respect it. Three Netlify Functions (`admin-list`, `admin-save`, `admin-delete`) hold the GitHub PAT as a server-side environment variable and are the only thing that ever talks to GitHub's Contents API for writes — they each independently check a shared password header before doing anything. A new `src/pages/admin.astro` page provides the UI: login, article table, and an edit form, all driven by a page-scoped `<script>` calling those three functions.

**Tech Stack:** Astro 4 (static output), Tailwind CSS, vanilla JS, Netlify Functions (v2, Web-standard `Request`/`Response`, zero new npm dependencies), Netlify CLI (`npx netlify-cli`, not a project dependency) for local testing.

**Spec:** `docs/superpowers/specs/2026-08-17-admin-panel-design.md`

## Global Constraints

- No new npm dependencies — Netlify Functions v2 need nothing beyond Node's built-ins; Netlify CLI runs via `npx`, never added to `package.json`.
- Styling is Tailwind utility classes only — no new CSS in `global.css`, no inline `<style>` blocks.
- This repo has no automated test suite and no lint step. "Testing" per task means `npm run build` and/or manual verification via `npx netlify-cli dev` plus `curl`/browser checks — the same approach used for every other feature built in this repo.
- The GitHub PAT (`GITHUB_PAT` env var) must never be sent to, or appear in, any client-side code. The browser only ever calls this site's own `/.netlify/functions/*` endpoints.
- A missing `status` field on an article is treated as `"published"` everywhere it's read — existing articles need no migration.
- Every write to `src/data/articles.json` goes through GitHub's Contents API using the current file's `sha` as an optimistic-concurrency check, exactly like n8n's own commits already do.

---

## Task 1: Draft/published data model and filtering

**Files:**
- Modify: `src/pages/index.astro:10-12`
- Modify: `src/pages/category/[slug].astro:15-17`
- Modify: `src/pages/posts/[slug].astro:42-47`
- Modify: `astro.config.mjs`

**Interfaces:**
- Consumes: nothing new — reads the existing `status` field on article objects (added by later tasks' writes, or manually for testing this task).
- Produces: the convention `status !== 'draft'` as "visible to the public" — Task 2 and Task 3 write this exact field name and these exact two string values (`"draft"`, `"published"`).

- [ ] **Step 1: Filter drafts out of the homepage**

In `src/pages/index.astro`, replace:

```js
const sorted = [...articles].sort((a, b) =>
  a.published_date < b.published_date ? 1 : -1
);
```

with:

```js
const published = articles.filter((a) => a.status !== 'draft');
const sorted = [...published].sort((a, b) =>
  a.published_date < b.published_date ? 1 : -1
);
```

Everything downstream in this file (`featured`, `latestArticles`, `byCategory`, `categoryCounts`) already derives from `sorted`, so no further changes are needed in this file.

- [ ] **Step 2: Filter drafts out of category pages**

In `src/pages/category/[slug].astro`, replace:

```js
const inCategory = articles
  .filter((a) => a.category === cat.slug)
  .sort((a, b) => (a.published_date < b.published_date ? 1 : -1));
```

with:

```js
const inCategory = articles
  .filter((a) => a.category === cat.slug && a.status !== 'draft')
  .sort((a, b) => (a.published_date < b.published_date ? 1 : -1));
```

- [ ] **Step 3: Mark draft article pages noindex**

In `src/pages/posts/[slug].astro`, the `getStaticPaths()` function stays exactly as-is — every article, including drafts, still gets a real `/posts/<slug>` page so it's previewable. Only the `<BaseLayout>` call changes. Replace:

```astro
<BaseLayout
  title={article.title}
  description={article.excerpt}
  canonicalPath={`/posts/${article.slug}`}
  ogImage={`/images/${article.slug}.png`}
>
```

with:

```astro
<BaseLayout
  title={article.title}
  description={article.excerpt}
  canonicalPath={`/posts/${article.slug}`}
  ogImage={`/images/${article.slug}.png`}
  noindex={article.status === 'draft'}
>
```

- [ ] **Step 4: Exclude drafts and empty categories from the sitemap**

Replace the full contents of `astro.config.mjs` with:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const articles = JSON.parse(
  readFileSync(fileURLToPath(new URL('./src/data/articles.json', import.meta.url)), 'utf-8')
);
const categorySlugsWithPublishedArticles = new Set(
  articles.filter((a) => a.status !== 'draft').map((a) => a.category)
);

export default defineConfig({
  site: 'https://airbrush.gallery',
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;

        const postMatch = path.match(/^\/posts\/([^/]+)\/?$/);
        if (postMatch) {
          const article = articles.find((a) => a.slug === postMatch[1]);
          if (article?.status === 'draft') return false;
        }

        const catMatch = path.match(/^\/category\/([^/]+)\/?$/);
        if (catMatch && !categorySlugsWithPublishedArticles.has(catMatch[1])) {
          return false;
        }

        return true;
      },
    }),
    tailwind({ applyBaseStyles: false }),
  ],
  output: 'static',
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});
```

This reads `articles.json` via `node:fs` rather than a normal `import` statement, because `astro.config.mjs` is loaded directly by Node before Vite starts, so it doesn't get Vite's automatic JSON-import handling.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: succeeds with no errors, same page count as before this task (no articles currently have `status: "draft"`, so nothing should visibly change yet).

- [ ] **Step 6: Manual verification of the draft filtering — temporarily**

This step edits `src/data/articles.json` to test the filtering, then reverts the edit. **Do not commit the temporary change.**

1. Open `src/data/articles.json` and add `"status": "draft"` to any one existing article object.
2. Run `npm run build`.
3. Open `dist/index.html` and confirm that article's title no longer appears (it was previously in "Latest Articles").
4. Open `dist/category/<that article's category>/index.html` and confirm it's not listed there either.
5. Open `dist/posts/<that article's slug>/index.html` and confirm the page still exists and contains `<meta name="robots" content="noindex">`.
6. Open `dist/sitemap-0.xml` (or the relevant sitemap file `@astrojs/sitemap` generated) and confirm that post's URL is absent.
7. Revert the `"status": "draft"` edit in `src/data/articles.json` so the file matches what's actually committed — check with `git diff src/data/articles.json` and confirm it shows no changes before moving on.

- [ ] **Step 7: Commit**

```bash
git add src/pages/index.astro src/pages/category/\[slug\].astro src/pages/posts/\[slug\].astro astro.config.mjs
git commit -m "$(cat <<'EOF'
Add draft/published filtering for articles

A missing status field is treated as published, so existing content
is unaffected. Draft articles are excluded from the homepage,
category pages, and sitemap, but still get a noindex'd /posts/<slug>
page so they're previewable before publishing.
EOF
)"
```

---

## Task 2: Netlify Functions for listing, saving, and deleting articles

**Files:**
- Create: `netlify/functions/admin-list.js`
- Create: `netlify/functions/admin-save.js`
- Create: `netlify/functions/admin-delete.js`
- Modify: `netlify.toml`

**Interfaces:**
- Consumes: `process.env.ADMIN_PASSWORD`, `process.env.GITHUB_PAT` (both set as Netlify environment variables — for local testing, in a gitignored `.env` file at the repo root, which `netlify dev` loads automatically).
- Produces (consumed by Task 3's client-side code):
  - `GET /.netlify/functions/admin-list` — header `x-admin-password`. 200 response body `{"articles": [...], "sha": "<string>"}`. 401 if the password header doesn't match.
  - `POST /.netlify/functions/admin-save` — header `x-admin-password`, JSON body `{"article": {...full article object, must include "slug"...}, "sha": "<string>"}`. 200 body `{"ok": true}` on success. 401 wrong password, 400 missing `article.slug`, 409 (plain text body) if the provided `sha` doesn't match the file's current `sha`, 502 (plain text body) if the GitHub API write itself fails.
  - `POST /.netlify/functions/admin-delete` — header `x-admin-password`, JSON body `{"slug": "<string>", "sha": "<string>"}`. Same response shapes as `admin-save` (200/401/400/409/502).

- [ ] **Step 1: Create the list function**

Create `netlify/functions/admin-list.js`:

```js
const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/articles.json';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    return new Response('Failed to fetch articles.json from GitHub', { status: 502 });
  }

  const data = await res.json();
  const articles = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));

  return new Response(JSON.stringify({ articles, sha: data.sha }), {
    headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 2: Create the save function**

Create `netlify/functions/admin-save.js`:

```js
const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/articles.json';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { article, sha } = await req.json();
  if (!article?.slug) {
    return new Response('Missing article.slug', { status: 400 });
  }

  const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });
  const getData = await getRes.json();

  if (getData.sha !== sha) {
    return new Response('This file changed since you loaded it — refresh and try again.', { status: 409 });
  }

  const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));
  const idx = current.findIndex((a) => a.slug === article.slug);
  if (idx === -1) {
    current.push(article);
  } else {
    current[idx] = article;
  }

  const newContent = Buffer.from(JSON.stringify(current, null, 2) + '\n', 'utf-8').toString('base64');
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Admin: update article ${article.slug}`,
      content: newContent,
      sha: getData.sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return new Response(`Failed to save: ${err}`, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 3: Create the delete function**

Create `netlify/functions/admin-delete.js`:

```js
const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/articles.json';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { slug, sha } = await req.json();
  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });
  const getData = await getRes.json();

  if (getData.sha !== sha) {
    return new Response('This file changed since you loaded it — refresh and try again.', { status: 409 });
  }

  const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));
  const next = current.filter((a) => a.slug !== slug);

  const newContent = Buffer.from(JSON.stringify(next, null, 2) + '\n', 'utf-8').toString('base64');
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Admin: delete article ${slug}`,
      content: newContent,
      sha: getData.sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return new Response(`Failed to delete: ${err}`, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 4: Declare the functions directory in netlify.toml**

In `netlify.toml`, add a `[functions]` block. The full file should read:

```toml
[build]
  command = "astro build"
  publish = "dist"

[functions]
  directory = "netlify/functions"

# There is no prebuild fetch step. The n8n content pipeline commits finished
# articles (src/data/articles.json) and their hero images (public/images/) directly
# to this repo via the GitHub API as its last step, so by the time a build runs,
# the content is already sitting in the repo. Every push to `main` — whether from
# n8n or a manual commit — triggers this build automatically.
```

- [ ] **Step 5: Note the production setup this plan cannot do for you**

Local testing in the steps below uses a `.env` file, but that only covers your machine. For `/admin` to work once this is deployed on the real site, two environment variables need to be set in Netlify's dashboard for this site (Site settings → Environment variables) — this is a manual step outside this repo that the site owner needs to do, not something any of these tasks can do automatically:

- `GITHUB_PAT` — a GitHub Personal Access Token with write access (`contents: write`) to `jptaycs/airbrush-learn`.
- `ADMIN_PASSWORD` — a strong shared password. This is the real protection boundary for the write path (see the spec's "Security model" section), so it should be a real password, not something guessable.

- [ ] **Step 6: Set up local test credentials**

Create a `.env` file at the repo root (already gitignored — confirm with `git check-ignore .env`, expect it to print `.env`):

```
GITHUB_PAT=<a real GitHub Personal Access Token with contents:write on jptaycs/airbrush-learn>
ADMIN_PASSWORD=test-local-password
```

If you don't have a token to test with yet, use one scoped to a disposable test repo instead of pushing test writes to the real `airbrush-learn` repo — swap `REPO` in all three functions temporarily for this local test only, and swap it back before committing.

- [ ] **Step 7: Start the Netlify dev server and test admin-list**

Run: `npx netlify-cli dev`
Expected: starts a local server (prints a local URL, typically `http://localhost:8888`).

In a separate terminal:

```bash
curl -s -H "x-admin-password: test-local-password" http://localhost:8888/.netlify/functions/admin-list | head -c 300
```

Expected: a JSON object starting with `{"articles":[...` — confirms the function can reach GitHub and returns real data.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "x-admin-password: wrong" http://localhost:8888/.netlify/functions/admin-list
```

Expected: `401`.

- [ ] **Step 8: Test admin-save and admin-delete against the test repo**

Pick a slug from the `admin-list` response above (call it `<slug>`), then:

```bash
SHA=$(curl -s -H "x-admin-password: test-local-password" http://localhost:8888/.netlify/functions/admin-list | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).sha))")
curl -s -X POST -H "x-admin-password: test-local-password" -H "content-type: application/json" \
  -d "{\"article\":{\"slug\":\"<slug>\",\"title\":\"Test Save\",\"status\":\"draft\"},\"sha\":\"$SHA\"}" \
  http://localhost:8888/.netlify/functions/admin-save
```

Expected: `{"ok":true}`. Confirm on GitHub (or via `admin-list` again) that the article's `title` is now `"Test Save"` and `status` is `"draft"`.

Then test the conflict guard by reusing the same (now stale) `$SHA` a second time:

```bash
curl -s -w "\n%{http_code}\n" -X POST -H "x-admin-password: test-local-password" -H "content-type: application/json" \
  -d "{\"article\":{\"slug\":\"<slug>\",\"title\":\"Should Conflict\"},\"sha\":\"$SHA\"}" \
  http://localhost:8888/.netlify/functions/admin-save
```

Expected: `409` and the "changed since you loaded it" message — the stale `sha` no longer matches.

Repeat a similar `admin-delete` call with a fresh `sha` against a disposable test article if you created one, confirming a `200` response and that the article is gone from a subsequent `admin-list` call.

- [ ] **Step 9: Commit**

```bash
git add netlify/functions/admin-list.js netlify/functions/admin-save.js netlify/functions/admin-delete.js netlify.toml
git commit -m "$(cat <<'EOF'
Add Netlify Functions for listing, saving, and deleting articles

Each function checks a shared password header before doing anything,
and holds the GitHub write token as a server-side environment
variable so it never reaches the browser. Writes use the file's
current sha as an optimistic-concurrency check against n8n's own
commits to the same file.
EOF
)"
```

---

## Task 3: The admin page

**Files:**
- Create: `src/pages/admin.astro`

**Interfaces:**
- Consumes: `GET /.netlify/functions/admin-list`, `POST /.netlify/functions/admin-save`, `POST /.netlify/functions/admin-delete` (exact request/response shapes defined in Task 2's Interfaces block); `categories` array (`{slug, label, description}[]`) from `src/data/categories.js`; `BaseLayout` component (props: `title`, `description`, `canonicalPath`, `noindex`).
- Produces: nothing consumed by other tasks — this is the final task in the plan.

- [ ] **Step 1: Create the admin page**

Create `src/pages/admin.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { categories } from '../data/categories.js';
---
<BaseLayout
  title="Admin — Airbrush Learn"
  description="Article management"
  canonicalPath="/admin"
  noindex={true}
>
  <section class="mx-auto max-w-wide px-5 py-12">
    <h1 class="font-serif text-ink text-[1.8rem] mb-8">Article Admin</h1>

    <div data-login-panel>
      <label class="block text-[0.85rem] text-muted mb-2" for="admin-password">Password</label>
      <div class="flex gap-2 max-w-sm">
        <input id="admin-password" type="password" class="flex-1 rounded border border-border px-3 py-2" />
        <button type="button" data-login-btn class="rounded bg-accent text-white px-4 py-2 font-semibold hover:opacity-90">Log in</button>
      </div>
      <p data-login-error class="hidden text-red-600 text-[0.85rem] mt-2"></p>
    </div>

    <div data-admin-panel class="hidden">
      <div class="flex items-center justify-between mb-6">
        <p data-status-msg class="text-[0.85rem] text-muted"></p>
        <button type="button" data-refresh-btn class="text-[0.85rem] text-accent-dark font-semibold hover:underline">Refresh</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-[0.9rem] border-collapse">
          <thead>
            <tr class="border-b border-border text-muted text-[0.75rem] uppercase tracking-wide">
              <th class="py-2 pr-4">Title</th>
              <th class="py-2 pr-4">Status</th>
              <th class="py-2 pr-4">Category</th>
              <th class="py-2 pr-4">Date</th>
              <th class="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody data-article-rows></tbody>
        </table>
      </div>
    </div>

    <div data-edit-panel class="hidden mt-10 border-t border-border pt-8">
      <h2 class="font-serif text-ink text-[1.3rem] mb-4">Edit article</h2>
      <form data-edit-form class="grid gap-4 max-w-2xl">
        <input type="hidden" data-field="slug" />
        <label class="block">
          <span class="block text-[0.8rem] text-muted mb-1">Title</span>
          <input type="text" data-field="title" class="w-full rounded border border-border px-3 py-2" required />
        </label>
        <label class="block">
          <span class="block text-[0.8rem] text-muted mb-1">Excerpt</span>
          <textarea data-field="excerpt" rows="2" class="w-full rounded border border-border px-3 py-2"></textarea>
        </label>
        <label class="block">
          <span class="block text-[0.8rem] text-muted mb-1">Published date</span>
          <input type="date" data-field="published_date" class="w-full rounded border border-border px-3 py-2" />
        </label>
        <label class="block">
          <span class="block text-[0.8rem] text-muted mb-1">Category</span>
          <select data-field="category" class="w-full rounded border border-border px-3 py-2">
            {categories.map((c) => <option value={c.slug}>{c.label}</option>)}
          </select>
        </label>
        <label class="block">
          <span class="block text-[0.8rem] text-muted mb-1">Status</span>
          <select data-field="status" class="w-full rounded border border-border px-3 py-2">
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label class="block">
          <span class="block text-[0.8rem] text-muted mb-1">Body (raw HTML)</span>
          <textarea data-field="content_html" rows="14" class="w-full rounded border border-border px-3 py-2 font-mono text-[0.8rem]"></textarea>
        </label>
        <div class="flex gap-3">
          <button type="submit" class="rounded bg-accent text-white px-5 py-2.5 font-semibold hover:opacity-90">Save</button>
          <button type="button" data-cancel-edit class="rounded border border-border px-5 py-2.5 font-semibold hover:bg-bg-alt">Cancel</button>
        </div>
        <p data-edit-error class="hidden text-red-600 text-[0.85rem]"></p>
      </form>
    </div>
  </section>
</BaseLayout>

<script>
  const PASSWORD_KEY = 'admin_password';
  const loginPanel = document.querySelector('[data-login-panel]');
  const adminPanel = document.querySelector('[data-admin-panel]');
  const editPanel = document.querySelector('[data-edit-panel]');
  const passwordInput = document.getElementById('admin-password');
  const loginBtn = document.querySelector('[data-login-btn]');
  const loginError = document.querySelector('[data-login-error]');
  const statusMsg = document.querySelector('[data-status-msg]');
  const refreshBtn = document.querySelector('[data-refresh-btn]');
  const rowsBody = document.querySelector('[data-article-rows]');
  const editForm = document.querySelector('[data-edit-form]');
  const editError = document.querySelector('[data-edit-error]');
  const cancelEditBtn = document.querySelector('[data-cancel-edit]');

  let currentSha = null;
  let currentArticles = [];

  const getPassword = () => sessionStorage.getItem(PASSWORD_KEY) || '';

  const api = async (path, options = {}) => {
    return fetch(`/.netlify/functions/${path}`, {
      ...options,
      headers: {
        'x-admin-password': getPassword(),
        'content-type': 'application/json',
        ...(options.headers || {}),
      },
    });
  };

  const renderRows = () => {
    rowsBody.innerHTML = currentArticles
      .map(
        (a) => `
        <tr class="border-b border-border/60">
          <td class="py-2 pr-4">${a.title}</td>
          <td class="py-2 pr-4">
            <span class="text-[0.7rem] font-semibold uppercase px-2 py-0.5 rounded-full ${a.status === 'draft' ? 'bg-bg-alt text-muted' : 'bg-accent/10 text-accent-dark'}">${a.status === 'draft' ? 'Draft' : 'Published'}</span>
          </td>
          <td class="py-2 pr-4">${a.category || ''}</td>
          <td class="py-2 pr-4">${a.published_date || ''}</td>
          <td class="py-2 pr-4 whitespace-nowrap">
            <button type="button" data-edit="${a.slug}" class="text-accent-dark font-semibold hover:underline mr-3">Edit</button>
            <button type="button" data-toggle="${a.slug}" class="text-accent-dark font-semibold hover:underline mr-3">${a.status === 'draft' ? 'Publish' : 'Unpublish'}</button>
            <button type="button" data-delete="${a.slug}" class="text-red-600 font-semibold hover:underline">Delete</button>
            <a href="/posts/${a.slug}" target="_blank" class="text-muted hover:underline ml-3">Preview</a>
          </td>
        </tr>
      `
      )
      .join('');
  };

  const loadArticles = async () => {
    statusMsg.textContent = 'Loading…';
    const res = await api('admin-list');
    if (!res.ok) {
      statusMsg.textContent = 'Failed to load articles.';
      return;
    }
    const data = await res.json();
    currentArticles = data.articles;
    currentSha = data.sha;
    statusMsg.textContent = `${currentArticles.length} article(s)`;
    renderRows();
  };

  loginBtn.addEventListener('click', async () => {
    sessionStorage.setItem(PASSWORD_KEY, passwordInput.value);
    const res = await api('admin-list');
    if (!res.ok) {
      loginError.textContent = 'Wrong password.';
      loginError.classList.remove('hidden');
      sessionStorage.removeItem(PASSWORD_KEY);
      return;
    }
    const data = await res.json();
    currentArticles = data.articles;
    currentSha = data.sha;
    loginError.classList.add('hidden');
    loginPanel.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    statusMsg.textContent = `${currentArticles.length} article(s)`;
    renderRows();
  });

  refreshBtn.addEventListener('click', loadArticles);

  const openEdit = (slug) => {
    const article = currentArticles.find((a) => a.slug === slug);
    if (!article) return;
    editForm.querySelector('[data-field="slug"]').value = article.slug;
    editForm.querySelector('[data-field="title"]').value = article.title || '';
    editForm.querySelector('[data-field="excerpt"]').value = article.excerpt || '';
    editForm.querySelector('[data-field="published_date"]').value = article.published_date || '';
    editForm.querySelector('[data-field="category"]').value = article.category || '';
    editForm.querySelector('[data-field="status"]').value = article.status === 'draft' ? 'draft' : 'published';
    editForm.querySelector('[data-field="content_html"]').value = article.content_html || '';
    editError.classList.add('hidden');
    editPanel.classList.remove('hidden');
    editPanel.scrollIntoView({ behavior: 'smooth' });
  };

  cancelEditBtn.addEventListener('click', () => {
    editPanel.classList.add('hidden');
  });

  rowsBody.addEventListener('click', async (e) => {
    const editSlug = e.target.closest('[data-edit]')?.dataset.edit;
    const toggleSlug = e.target.closest('[data-toggle]')?.dataset.toggle;
    const deleteSlug = e.target.closest('[data-delete]')?.dataset.delete;

    if (editSlug) {
      openEdit(editSlug);
      return;
    }

    if (toggleSlug) {
      const article = currentArticles.find((a) => a.slug === toggleSlug);
      if (!article) return;
      const updated = { ...article, status: article.status === 'draft' ? 'published' : 'draft' };
      statusMsg.textContent = 'Saving…';
      const res = await api('admin-save', { method: 'POST', body: JSON.stringify({ article: updated, sha: currentSha }) });
      if (!res.ok) {
        statusMsg.textContent = await res.text();
        return;
      }
      await loadArticles();
      return;
    }

    if (deleteSlug) {
      if (!confirm(`Delete "${deleteSlug}"? This cannot be undone from here (use git revert to recover).`)) return;
      statusMsg.textContent = 'Deleting…';
      const res = await api('admin-delete', { method: 'POST', body: JSON.stringify({ slug: deleteSlug, sha: currentSha }) });
      if (!res.ok) {
        statusMsg.textContent = await res.text();
        return;
      }
      await loadArticles();
    }
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const article = {
      slug: editForm.querySelector('[data-field="slug"]').value,
      title: editForm.querySelector('[data-field="title"]').value,
      excerpt: editForm.querySelector('[data-field="excerpt"]').value,
      published_date: editForm.querySelector('[data-field="published_date"]').value,
      category: editForm.querySelector('[data-field="category"]').value,
      status: editForm.querySelector('[data-field="status"]').value,
      content_html: editForm.querySelector('[data-field="content_html"]').value,
    };
    const original = currentArticles.find((a) => a.slug === article.slug) || {};
    const merged = { ...original, ...article };

    const res = await api('admin-save', { method: 'POST', body: JSON.stringify({ article: merged, sha: currentSha }) });
    if (!res.ok) {
      editError.textContent = await res.text();
      editError.classList.remove('hidden');
      return;
    }
    editPanel.classList.add('hidden');
    await loadArticles();
  });

  if (getPassword()) {
    loadArticles().then(() => {
      loginPanel.classList.add('hidden');
      adminPanel.classList.remove('hidden');
    });
  }
</script>
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: succeeds with no errors, `dist/admin/index.html` exists.

- [ ] **Step 3: Manual end-to-end verification**

With `.env` still populated from Task 2 (or update `ADMIN_PASSWORD` to whatever you'll actually use), run `npx netlify-cli dev` and open the printed local URL at `/admin` in a browser (use the Playwright MCP tools to drive this):

1. Type the wrong password, click "Log in" — confirm the "Wrong password." error appears and the table stays hidden.
2. Type the correct password, click "Log in" — confirm the article table appears with real data.
3. Click "Edit" on any article — confirm the edit form fills in with that article's current values. Change the title, click "Save" — confirm the table refreshes and shows the new title.
4. Click "Publish"/"Unpublish" on an article — confirm its status badge flips immediately after the refresh.
5. Click "Preview" on an article — confirm it opens `/posts/<slug>` in a new tab.
6. Click "Delete" on a disposable test article (not a real one), confirm the browser's native confirm dialog, accept it — confirm the article disappears from the table.
7. Close the tab and reopen `/admin` — confirm you're prompted to log in again (the password was only cached in `sessionStorage` for that tab's session — well, `sessionStorage` persists across page loads within the same tab but not across a fully closed tab/new session, so reopening a fresh tab should re-prompt).

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin.astro
git commit -m "$(cat <<'EOF'
Add the article admin page

Password-gated UI at /admin for listing, editing, publishing/
unpublishing, and deleting articles, calling the three Netlify
Functions added in the previous task.
EOF
)"
```
