# Community Gallery Submissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors submit their own airbrush work to the gallery through a public form, holding it in Netlify Blobs for review, with a new tab on the existing `/admin` panel to approve (commit to `gallery.json` + git) or reject each submission.

**Architecture:** A public page (`/gallery/submit`) posts to a new unauthenticated Netlify Function that validates and stores the submission (metadata + image bytes) in Netlify Blobs — no git write at this stage. Two new password-gated functions mirror the exact GitHub-commit pattern `admin-save.js` already established: one lists pending submissions for review, one approves (committing the image and appending to `gallery.json` via the GitHub Contents API with `sha`-based optimistic concurrency), one rejects (deletes from Blobs, no git write). The existing `/admin` page gains a second tab reusing its already-built login/session.

**Tech Stack:** Astro 4, Tailwind CSS, vanilla JS (page-scoped `<script>` tags), Netlify Functions (Web-standard `Request`/`Response`), `@netlify/blobs` (new dependency), Netlify CLI for local testing.

**Spec:** `docs/superpowers/specs/2026-08-18-gallery-submissions-design.md`

## Global Constraints

- `@netlify/blobs` is a genuinely new npm dependency for this plan — install it via `npm install @netlify/blobs`, do not hand-pick a version. (Unlike the earlier admin panel work, "no new npm dependencies" does NOT hold here — Blobs storage itself needs no separate credential at runtime, but its client library is a real package.)
- Tailwind utility classes only, matching this site's established conventions: rounded-xl bordered cards, pill-shaped buttons (`rounded-full`), focus rings (`focus:ring-2 focus:ring-accent/40 focus:border-accent`) on form inputs.
- This repo has no automated test suite and no lint step. "Testing" per task means `npm run build` plus manual verification via `npx netlify-cli dev` and browser/curl checks — the same approach used for every other Netlify Function feature in this repo.
- `GITHUB_PAT` must never reach client-side code. `src/pages/gallery/submit.astro` and its script never call GitHub or reference `GITHUB_PAT` in any way — only `gallery-approve.js` touches GitHub's API.
- Every git write to `gallery.json` must check the GitHub GET response's `.ok` before reading its `sha` (a real bug was found and fixed in `admin-save.js` earlier this session — don't reintroduce it in `gallery-approve.js`).
- A missing/empty required form field, wrong file type, or oversized file must be rejected server-side in `gallery-submit.js`, not just client-side (client-side checks are for UX only, never trusted alone).

---

## Task 1: Public submission flow

**Files:**
- Modify: `package.json` (add `@netlify/blobs` dependency)
- Create: `src/pages/gallery/submit.astro`
- Create: `netlify/functions/gallery-submit.js`
- Modify: `src/pages/gallery/index.astro`

**Interfaces:**
- Consumes: `galleryCategories` array (`{ slug, label }[]`) from `src/data/galleryCategories.js`; `BaseLayout` component (props: `title`, `description`, `canonicalPath`).
- Produces: a Netlify Blobs store named `gallery-pending` with this shape, consumed by Task 2's functions:
  - Key `index` — JSON array of submission ID strings (e.g. `["a1b2c3d4-...", "e5f6..."]`)
  - Key `${id}/meta` — JSON object: `{ id, title, artistName, discipline, email, submittedAt, contentType }`
  - Key `${id}/image` — raw image bytes (stored as an `ArrayBuffer`)

- [ ] **Step 1: Install the Netlify Blobs client library**

Run: `npm install @netlify/blobs`
Expected: `package.json`'s `dependencies` gains a `@netlify/blobs` entry, `package-lock.json` updates.

- [ ] **Step 2: Create the public submission page**

Create `src/pages/gallery/submit.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { galleryCategories } from '../../data/galleryCategories.js';
---
<BaseLayout
  title="Submit Your Work — Airbrush Learn"
  description="Share your airbrush art with the community gallery."
  canonicalPath="/gallery/submit"
>
  <section class="mx-auto max-w-wide px-5 py-12">
    <div class="text-[0.78rem] text-muted mb-4">
      <a href="/" class="text-muted hover:text-accent-dark">Home</a> / <a href="/gallery" class="text-muted hover:text-accent-dark">Gallery</a> / <span class="text-body">Submit</span>
    </div>
    <div class="max-w-xl mx-auto">
      <h1 class="font-serif text-ink text-[2rem] mb-2 text-center">Submit Your Work</h1>
      <p class="text-muted text-[0.95rem] mb-8 text-center">Share a piece with the community gallery. Every submission is reviewed before it goes live.</p>

      <form data-submit-form class="grid gap-5 bg-bg border border-border rounded-xl p-6 sm:p-8 relative">
        <label class="block">
          <span class="block text-[0.8rem] font-semibold text-ink mb-1.5">Title</span>
          <input type="text" name="title" required class="w-full rounded-lg border border-border px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-shadow" />
        </label>
        <label class="block">
          <span class="block text-[0.8rem] font-semibold text-ink mb-1.5">Your name</span>
          <input type="text" name="artistName" required class="w-full rounded-lg border border-border px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-shadow" />
        </label>
        <label class="block">
          <span class="block text-[0.8rem] font-semibold text-ink mb-1.5">Discipline</span>
          <select name="discipline" required class="w-full rounded-lg border border-border px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-shadow">
            <option value="" disabled selected>Select one</option>
            {galleryCategories.map((c) => <option value={c.slug}>{c.label}</option>)}
          </select>
        </label>
        <label class="block">
          <span class="block text-[0.8rem] font-semibold text-ink mb-1.5">Email</span>
          <input type="email" name="email" required class="w-full rounded-lg border border-border px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-shadow" />
          <span class="block text-[0.75rem] text-muted mt-1">Never shown publicly — only for follow-up if needed.</span>
        </label>
        <label class="block">
          <span class="block text-[0.8rem] font-semibold text-ink mb-1.5">Image</span>
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required class="w-full rounded-lg border border-border px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-shadow" />
          <span class="block text-[0.75rem] text-muted mt-1">JPEG, PNG, or WebP. Max 8MB.</span>
        </label>
        <label class="flex items-start gap-2.5 text-[0.85rem]">
          <input type="checkbox" name="rights" required class="mt-0.5" />
          <span>I made this piece myself and have the right to share it here.</span>
        </label>

        <div class="absolute -left-[9999px]" aria-hidden="true">
          <label for="submit-website">Website</label>
          <input type="text" id="submit-website" name="website" tabindex="-1" autocomplete="off" />
        </div>

        <button type="submit" data-submit-btn class="rounded-full bg-accent text-white px-5 py-3 font-semibold hover:opacity-90 transition-opacity">Submit for Review</button>
        <p data-submit-message class="hidden text-[0.85rem]"></p>
      </form>
    </div>
  </section>
</BaseLayout>

<script>
  const form = document.querySelector('[data-submit-form]');
  const submitBtn = document.querySelector('[data-submit-btn]');
  const message = document.querySelector('[data-submit-message]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    message.classList.add('hidden');

    const formData = new FormData(form);
    try {
      const res = await fetch('/.netlify/functions/gallery-submit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.textContent = data.error || 'Something went wrong. Please try again.';
        message.className = 'text-red-600 text-[0.85rem]';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit for Review';
        return;
      }
      form.reset();
      message.textContent = data.message || 'Thanks — your submission is under review.';
      message.className = 'text-accent-dark text-[0.85rem] font-semibold';
      submitBtn.textContent = 'Submitted';
    } catch (err) {
      message.textContent = 'Network error. Please try again.';
      message.className = 'text-red-600 text-[0.85rem]';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit for Review';
    }
    message.classList.remove('hidden');
  });
</script>
```

- [ ] **Step 3: Create the submission Netlify Function**

Create `netlify/functions/gallery-submit.js`:

```js
import { getStore } from '@netlify/blobs';

const VALID_DISCIPLINES = [
  'automotive', 'fine-art', 'miniatures', 'cosplay', 'fabric', 'scale-models',
  'body-art', 'guitars', 'murals', 'nail-art', 'helmets', 'skateboards',
  'diecast-cars', 'toy-soldiers', 'wooden-toys', 'nesting-dolls', 'carousel-figures',
];
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024;

const okResponse = () =>
  new Response(JSON.stringify({ ok: true, message: 'Thanks — your submission is under review.' }), {
    headers: { 'content-type': 'application/json' },
  });

const errorResponse = (error, status) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  let formData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse('Invalid form submission', 400);
  }

  // Honeypot: if filled, pretend success but store nothing.
  const honeypot = formData.get('website');
  if (honeypot) {
    return okResponse();
  }

  const title = formData.get('title');
  const artistName = formData.get('artistName');
  const discipline = formData.get('discipline');
  const email = formData.get('email');
  const rights = formData.get('rights');
  const image = formData.get('image');

  if (!title || !artistName || !discipline || !email || !rights || !image) {
    return errorResponse('All fields are required.', 400);
  }
  if (!VALID_DISCIPLINES.includes(discipline)) {
    return errorResponse('Invalid discipline.', 400);
  }
  if (!(image instanceof File) || !VALID_TYPES.includes(image.type)) {
    return errorResponse('Image must be JPEG, PNG, or WebP.', 400);
  }
  if (image.size > MAX_SIZE) {
    return errorResponse('Image must be 8MB or smaller.', 400);
  }

  const id = crypto.randomUUID();
  const store = getStore('gallery-pending');
  const imageBuffer = await image.arrayBuffer();

  await store.set(`${id}/image`, imageBuffer);
  await store.setJSON(`${id}/meta`, {
    id,
    title: String(title),
    artistName: String(artistName),
    discipline: String(discipline),
    email: String(email),
    submittedAt: new Date().toISOString(),
    contentType: image.type,
  });

  const index = (await store.get('index', { type: 'json' })) || [];
  index.push(id);
  await store.setJSON('index', index);

  return okResponse();
};
```

- [ ] **Step 4: Link to the submission page from the gallery index**

In `src/pages/gallery/index.astro`, add a "Submit Your Work" link. Replace:

```astro
      <p class="mt-3 text-muted text-[1.05rem] max-w-[520px] mx-auto">{pieceCount} piece{pieceCount === 1 ? '' : 's'} across {categoryCount} discipline{categoryCount === 1 ? '' : 's'}.</p>
    </div>
  </section>
```

with:

```astro
      <p class="mt-3 text-muted text-[1.05rem] max-w-[520px] mx-auto">{pieceCount} piece{pieceCount === 1 ? '' : 's'} across {categoryCount} discipline{categoryCount === 1 ? '' : 's'}.</p>
      <a href="/gallery/submit" class="inline-block mt-5 rounded-full bg-accent text-white px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90">Submit Your Work &rarr;</a>
    </div>
  </section>
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: succeeds with no errors, `dist/gallery/submit/index.html` exists.

- [ ] **Step 6: Manual local verification (no real credentials needed)**

Start the local dev server:

```bash
npx netlify-cli dev
```

Expected: prints a local URL (e.g. `http://localhost:8888`). Netlify Blobs are automatically emulated locally by the CLI — no `GITHUB_PAT` or `ADMIN_PASSWORD` needed for this task's testing.

Using the Playwright MCP tools, navigate to `http://localhost:8888/gallery/submit` and:
1. Fill in the form (a real title, name, pick a discipline, an email, check the rights box, attach any small real JPEG/PNG file) and submit. Confirm the success message "Thanks — your submission is under review." appears and the form resets.
2. Confirm the submission actually landed in Blobs by making a follow-up request. Since there's no read endpoint yet (Task 2 builds that), verify indirectly: repeat the same submission a second time with a different title, then once Task 2's `gallery-pending-list` exists you can list them — for now, it's acceptable to defer full end-to-end confirmation of storage to Task 2's testing, but confirm at minimum that the function returned a 200 with the expected success JSON body (check via the Network tab or an equivalent curl call) rather than an error.
3. Test the honeypot: make a direct request bypassing the UI —
   ```bash
   curl -s -X POST http://localhost:8888/.netlify/functions/gallery-submit \
     -F "title=Bot Test" -F "artistName=Bot" -F "discipline=murals" \
     -F "email=bot@example.com" -F "rights=on" -F "website=http://spam.example" \
     -F "image=@/path/to/any/small/test-image.jpg;type=image/jpeg"
   ```
   Expected: `{"ok":true,"message":"Thanks — your submission is under review."}` — same as a real success, confirming the honeypot path doesn't reveal itself.
4. Test rejection of a disallowed file type by submitting with `-F "image=@somefile.txt;type=text/plain"` (adjust the curl call above). Expected: HTTP 400 with `{"error":"Image must be JPEG, PNG, or WebP."}`.
5. Test rejection of a missing required field (omit `-F "email=..."` from the curl call). Expected: HTTP 400 with `{"error":"All fields are required."}`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/pages/gallery/submit.astro netlify/functions/gallery-submit.js src/pages/gallery/index.astro
git commit -m "$(cat <<'EOF'
Add public gallery submission form and storage function

Visitors can submit their own work via /gallery/submit. Submissions
are validated (required fields, known discipline, image type/size)
and stored in Netlify Blobs pending review — no git write happens at
submission time. A honeypot field silently discards bot submissions
without revealing the check.
EOF
)"
```

---

## Task 2: Moderation functions

**Files:**
- Create: `netlify/functions/gallery-pending-list.js`
- Create: `netlify/functions/gallery-approve.js`
- Create: `netlify/functions/gallery-reject.js`

**Interfaces:**
- Consumes: the `gallery-pending` Blobs store shape from Task 1 (`index`, `${id}/meta`, `${id}/image` keys); `process.env.ADMIN_PASSWORD` and `process.env.GITHUB_PAT` (both already configured in Netlify from the earlier admin panel work; for local testing, the same gitignored `.env` file used for `admin-*` functions, or a fresh one with the same variable names).
- Produces (consumed by Task 3's admin UI):
  - `GET /.netlify/functions/gallery-pending-list` — header `x-admin-password`. 200 body: `{ "submissions": [{ id, title, artistName, discipline, email, submittedAt, imageDataUrl }, ...] }`. 401 if the password header doesn't match.
  - `POST /.netlify/functions/gallery-approve` — header `x-admin-password`, JSON body `{ "id": "<string>" }`. 200 body `{ "ok": true, "slug": "<string>" }` on success. 401 wrong password, 400 missing `id`, 404 if the submission no longer exists in Blobs, 502 if a GitHub API call fails.
  - `POST /.netlify/functions/gallery-reject` — header `x-admin-password`, JSON body `{ "id": "<string>" }`. 200 body `{ "ok": true }` on success. 401 wrong password, 400 missing `id`.

- [ ] **Step 1: Create the pending-list function**

Create `netlify/functions/gallery-pending-list.js`:

```js
import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const store = getStore('gallery-pending');
  const index = (await store.get('index', { type: 'json' })) || [];

  const submissions = [];
  for (const id of index) {
    const meta = await store.get(`${id}/meta`, { type: 'json' });
    if (!meta) continue;
    const imageBuffer = await store.get(`${id}/image`, { type: 'arrayBuffer' });
    if (!imageBuffer) continue;
    const base64 = Buffer.from(imageBuffer).toString('base64');
    submissions.push({
      ...meta,
      imageDataUrl: `data:${meta.contentType};base64,${base64}`,
    });
  }

  return new Response(JSON.stringify({ submissions }), {
    headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 2: Create the approve function**

Create `netlify/functions/gallery-approve.js`:

```js
import { getStore } from '@netlify/blobs';

const REPO = 'jptaycs/airbrush-learn';
const GALLERY_PATH = 'src/data/gallery.json';

const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const extFor = (contentType) => {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
};

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const store = getStore('gallery-pending');
  const meta = await store.get(`${id}/meta`, { type: 'json' });
  const imageBuffer = await store.get(`${id}/image`, { type: 'arrayBuffer' });
  if (!meta || !imageBuffer) {
    return new Response('Submission not found', { status: 404 });
  }

  const ext = extFor(meta.contentType);
  const slug = `${slugify(meta.title)}-${id.slice(0, 8)}`;
  const imagePath = `public/images/gallery/${slug}.${ext}`;
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');

  const imagePutRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${imagePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Gallery: add image for ${slug}`,
      content: imageBase64,
    }),
  });
  if (!imagePutRes.ok) {
    const err = await imagePutRes.text();
    return new Response(`Failed to commit image: ${err}`, { status: 502 });
  }

  const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${GALLERY_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!getRes.ok) {
    return new Response('Failed to fetch current gallery.json from GitHub', { status: 502 });
  }
  const getData = await getRes.json();
  const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));

  current.push({
    slug,
    title: meta.title,
    category: meta.discipline,
    image: `${slug}.${ext}`,
    credit: meta.artistName,
  });

  const newContent = Buffer.from(JSON.stringify(current, null, 2) + '\n', 'utf-8').toString('base64');
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${GALLERY_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Gallery: approve submission ${slug}`,
      content: newContent,
      sha: getData.sha,
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    return new Response(`Failed to save gallery.json: ${err}`, { status: 502 });
  }

  await store.delete(`${id}/meta`);
  await store.delete(`${id}/image`);
  const index = (await store.get('index', { type: 'json' })) || [];
  await store.setJSON('index', index.filter((x) => x !== id));

  return new Response(JSON.stringify({ ok: true, slug }), {
    headers: { 'content-type': 'application/json' },
  });
};
```

Note: the image commit has no `sha` in its request body because it's always a brand-new file path (the slug includes part of the submission's unique ID), so GitHub's Contents API doesn't require one for a create. The `gallery.json` update does use the `sha`-based conflict guard, matching `admin-save.js`. If the image commit succeeds but the `gallery.json` update fails (e.g. a conflict), the submission's Blobs are deliberately left intact (not deleted) so the admin can retry — this can leave one orphaned image file in `public/images/gallery/` from the failed attempt, which is accepted as harmless (mirroring the same accepted trade-off already made for `admin-delete.js` leaving orphaned article images behind).

- [ ] **Step 3: Create the reject function**

Create `netlify/functions/gallery-reject.js`:

```js
import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const store = getStore('gallery-pending');
  await store.delete(`${id}/meta`);
  await store.delete(`${id}/image`);
  const index = (await store.get('index', { type: 'json' })) || [];
  await store.setJSON('index', index.filter((x) => x !== id));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 5: Manual local verification of gallery-pending-list and gallery-reject (no real GITHUB_PAT needed)**

Ensure a local `.env` file exists at the repo root with at least `ADMIN_PASSWORD=test-local-password` (reuse the same file/value from earlier admin panel testing if it still exists; `GITHUB_PAT` can be a dummy value for this step since these two functions never call GitHub).

Start (or reuse) `npx netlify-cli dev`, then:

1. Submit a real test image via `/gallery/submit` (same as Task 1's Step 6).
2. List pending submissions:
   ```bash
   curl -s -H "x-admin-password: test-local-password" http://localhost:8888/.netlify/functions/gallery-pending-list | head -c 300
   ```
   Expected: a JSON object starting with `{"submissions":[{"id":...` containing the submission just made, including a populated `imageDataUrl` field starting with `data:image/`.
3. Test wrong password: `curl -s -o /dev/null -w "%{http_code}\n" -H "x-admin-password: wrong" http://localhost:8888/.netlify/functions/gallery-pending-list` — expected `401`.
4. Reject it:
   ```bash
   curl -s -X POST -H "x-admin-password: test-local-password" -H "content-type: application/json" \
     -d '{"id":"<the id from step 2>"}' \
     http://localhost:8888/.netlify/functions/gallery-reject
   ```
   Expected: `{"ok":true}`. Re-run `gallery-pending-list` and confirm the submission is gone.

- [ ] **Step 6: Manual verification of gallery-approve — real credentials required**

If a real `GITHUB_PAT` with write access to a test or the real repo is available: submit a fresh test image, then:

```bash
curl -s -X POST -H "x-admin-password: test-local-password" -H "content-type: application/json" \
  -d '{"id":"<the id>"}' \
  http://localhost:8888/.netlify/functions/gallery-approve
```

Expected: `{"ok":true,"slug":"..."}`. Confirm on GitHub that both a new image file under `public/images/gallery/` and an updated `gallery.json` (with the new entry) were committed, and confirm via `gallery-pending-list` that the submission is no longer pending.

Then test the conflict guard: submit a second fresh test image, and *before* approving it, make an unrelated direct commit to `gallery.json` on GitHub (e.g. via the GitHub web UI, adding then removing a trivial whitespace change — anything that changes the file's `sha`). Now approve the pending submission. Since `gallery-approve.js` fetches `gallery.json`'s current `sha` fresh immediately before its own write (not a stale client-supplied one), this specific race is hard to trigger deliberately in the normal flow — the more reliable way to exercise the 409 path is to call the function twice in rapid succession for two different pending submissions (e.g. via two parallel `curl` calls backgrounded with `&`) and confirm at least one of them either succeeds cleanly or surfaces a clear 502/409-style error rather than corrupting `gallery.json` — inspect the final committed `gallery.json` afterward and confirm it's valid JSON containing both approved entries (not truncated or malformed), which is the property that actually matters here.

**If no real `GITHUB_PAT` is available:** do not skip verification silently. Instead, perform a careful line-by-line self-review of `gallery-approve.js` against `admin-save.js`'s already-reviewed pattern (same `sha` check, same `getRes.ok` guard, same request/response shapes), and confirm via `netlify dev` that at minimum the 401 (wrong password) and 400 (missing id) and 404 (unknown id, using the wrong/random id) paths return the correct status codes — none of these require a real GitHub call to verify, since they return before the first `fetch` to GitHub's API. Report this task as DONE_WITH_CONCERNS, stating explicitly that the live GitHub commit round-trip for `gallery-approve` was not verified, matching how the equivalent gap was handled for `admin-save.js`/`admin-delete.js` earlier in this project.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/gallery-pending-list.js netlify/functions/gallery-approve.js netlify/functions/gallery-reject.js
git commit -m "$(cat <<'EOF'
Add gallery submission moderation functions

gallery-pending-list surfaces queued submissions (image included as
a data URI) for admin review. gallery-approve commits the image and
appends to gallery.json via GitHub's API with the same sha-based
conflict guard admin-save.js uses, then clears the submission from
Blobs. gallery-reject just clears it — no git write.
EOF
)"
```

---

## Task 3: Admin UI — Gallery Submissions tab

**Files:**
- Modify: `src/pages/admin.astro`

**Interfaces:**
- Consumes: `GET /.netlify/functions/gallery-pending-list`, `POST /.netlify/functions/gallery-approve`, `POST /.netlify/functions/gallery-reject` (exact shapes defined in Task 2's Interfaces block); the existing `api()` helper function, `escapeHtml()` helper, and `getPassword()`/session-handling already defined in `admin.astro`'s script — reuse them, do not redefine.
- Produces: nothing consumed by other tasks — this is the final task in the plan.

- [ ] **Step 1: Add the tab toggle and Gallery Submissions panel markup**

In `src/pages/admin.astro`, the current logged-in view starts with:

```astro
    <div data-admin-panel class="hidden">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 class="font-serif text-ink text-[1.8rem]">Article Admin</h1>
          <p data-status-msg class="text-muted text-[0.85rem] mt-1"></p>
        </div>
        <button type="button" data-refresh-btn class="inline-flex items-center gap-1.5 rounded-full border border-border text-ink px-4 py-2 text-[0.85rem] font-semibold hover:bg-bg-alt transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          Refresh
        </button>
      </div>
      <div class="rounded-xl border border-border overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[0.88rem] border-collapse">
            <thead>
              <tr class="bg-bg-alt text-muted text-[0.72rem] uppercase tracking-wide">
                <th class="py-3 px-4 font-semibold">Title</th>
                <th class="py-3 px-4 font-semibold">Status</th>
                <th class="py-3 px-4 font-semibold">Category</th>
                <th class="py-3 px-4 font-semibold">Date</th>
                <th class="py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody data-article-rows></tbody>
          </table>
        </div>
      </div>
    </div>
```

Replace it with (adds a tab bar above, wraps the existing article table in a `data-tab-articles` panel, and adds a new `data-tab-gallery` panel):

```astro
    <div data-admin-panel class="hidden">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-serif text-ink text-[1.8rem]">Admin</h1>
          <p data-status-msg class="text-muted text-[0.85rem] mt-1"></p>
        </div>
        <button type="button" data-refresh-btn class="inline-flex items-center gap-1.5 rounded-full border border-border text-ink px-4 py-2 text-[0.85rem] font-semibold hover:bg-bg-alt transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          Refresh
        </button>
      </div>

      <div class="flex gap-2 mb-6 border-b border-border">
        <button type="button" data-tab-btn="articles" class="px-4 py-2.5 text-[0.9rem] font-semibold border-b-2 border-accent text-accent-dark">Articles</button>
        <button type="button" data-tab-btn="gallery" class="px-4 py-2.5 text-[0.9rem] font-semibold border-b-2 border-transparent text-muted hover:text-ink">Gallery Submissions</button>
      </div>

      <div data-tab-panel="articles">
        <div class="rounded-xl border border-border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-[0.88rem] border-collapse">
              <thead>
                <tr class="bg-bg-alt text-muted text-[0.72rem] uppercase tracking-wide">
                  <th class="py-3 px-4 font-semibold">Title</th>
                  <th class="py-3 px-4 font-semibold">Status</th>
                  <th class="py-3 px-4 font-semibold">Category</th>
                  <th class="py-3 px-4 font-semibold">Date</th>
                  <th class="py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody data-article-rows></tbody>
            </table>
          </div>
        </div>
      </div>

      <div data-tab-panel="gallery" class="hidden">
        <div data-gallery-rows class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5"></div>
      </div>
    </div>
```

- [ ] **Step 2: Add the tab-switching and gallery-rendering script**

In `src/pages/admin.astro`'s `<script>` block, the current selector-declaration section starts with:

```js
  const PASSWORD_KEY = 'admin_password';
  const loginPanel = document.querySelector('[data-login-panel]');
```

Add these new selectors right after the existing `cancelEditBtn` declaration (i.e., after the line `const cancelEditBtn = document.querySelector('[data-cancel-edit]');` and before `let currentSha = null;`):

```js
  const tabButtons = document.querySelectorAll('[data-tab-btn]');
  const tabPanels = document.querySelectorAll('[data-tab-panel]');
  const galleryRows = document.querySelector('[data-gallery-rows]');
```

Then, after the existing `escapeHtml` function definition (right before the existing `const renderRows = () => {` line), add the gallery-rendering logic and tab-switching:

```js
  let pendingSubmissions = [];

  const renderGalleryRows = () => {
    if (pendingSubmissions.length === 0) {
      galleryRows.innerHTML = `<p class="col-span-full py-12 text-center text-muted">No pending submissions.</p>`;
      return;
    }
    galleryRows.innerHTML = pendingSubmissions
      .map(
        (s) => `
        <div class="rounded-xl border border-border overflow-hidden">
          <img src="${s.imageDataUrl}" alt="${escapeHtml(s.title)}" class="w-full aspect-[4/3] object-cover" />
          <div class="p-4">
            <h3 class="font-serif text-ink text-[1rem] truncate" title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</h3>
            <p class="text-muted text-[0.8rem] mt-1">${escapeHtml(s.artistName)} &middot; ${escapeHtml(s.discipline)}</p>
            <p class="text-muted text-[0.75rem] mt-0.5">${escapeHtml(s.submittedAt || '')}</p>
            <div class="flex gap-2 mt-3">
              <button type="button" data-approve="${escapeHtml(s.id)}" class="rounded-full bg-accent text-white px-3 py-1.5 text-[0.78rem] font-semibold hover:opacity-90 transition-opacity">Approve</button>
              <button type="button" data-reject="${escapeHtml(s.id)}" class="rounded-full border border-red-200 text-red-600 px-3 py-1.5 text-[0.78rem] font-semibold hover:bg-red-50 transition-colors">Reject</button>
            </div>
          </div>
        </div>
      `
      )
      .join('');
  };

  const loadPendingSubmissions = async () => {
    const res = await api('gallery-pending-list');
    if (!res.ok) {
      galleryRows.innerHTML = `<p class="col-span-full py-12 text-center text-muted">Failed to load submissions.</p>`;
      return;
    }
    const data = await res.json();
    pendingSubmissions = data.submissions;
    renderGalleryRows();
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tabBtn;
      tabButtons.forEach((b) => {
        const active = b.dataset.tabBtn === tab;
        b.classList.toggle('border-accent', active);
        b.classList.toggle('text-accent-dark', active);
        b.classList.toggle('border-transparent', !active);
        b.classList.toggle('text-muted', !active);
      });
      tabPanels.forEach((p) => {
        p.classList.toggle('hidden', p.dataset.tabPanel !== tab);
      });
      if (tab === 'gallery') loadPendingSubmissions();
    });
  });

  galleryRows.addEventListener('click', async (e) => {
    const approveId = e.target.closest('[data-approve]')?.dataset.approve;
    const rejectId = e.target.closest('[data-reject]')?.dataset.reject;

    if (approveId) {
      const res = await api('gallery-approve', { method: 'POST', body: JSON.stringify({ id: approveId }) });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      await loadPendingSubmissions();
      return;
    }

    if (rejectId) {
      if (!confirm('Reject this submission? It will be deleted and cannot be recovered from here.')) return;
      const res = await api('gallery-reject', { method: 'POST', body: JSON.stringify({ id: rejectId }) });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      await loadPendingSubmissions();
    }
  });

```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds with no errors, `dist/admin/index.html` still exists.

- [ ] **Step 4: Manual verification with mocked fetch responses**

Using the Playwright MCP tools' `browser_run_code_unsafe` capability (or equivalent), same technique used earlier this session to verify `admin.astro`'s article UI logic without live credentials:

1. Start `npx netlify-cli dev` (or plain `npm run dev` is NOT sufficient here since it won't serve the functions at all — but for this step, intercepting `fetch` at the browser level means the actual function implementation doesn't need to run; either dev server works as long as the page itself loads).
2. Navigate to `/admin`, log in (mock or real `admin-list`/`ADMIN_PASSWORD` response as needed, matching the technique already used for the articles tab).
3. Intercept `**/.netlify/functions/gallery-pending-list` to return a canned response, e.g.:
   ```json
   {
     "submissions": [
       { "id": "test-1", "title": "Sunset Mural", "artistName": "Jane Doe", "discipline": "murals", "submittedAt": "2026-08-18T00:00:00.000Z", "imageDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" }
     ]
   }
   ```
4. Click the "Gallery Submissions" tab. Confirm the tab visually switches active state, the Articles table hides, and the mocked submission renders as a card with its (tiny placeholder) image, title, artist name, discipline, and Approve/Reject buttons.
5. Intercept `**/.netlify/functions/gallery-approve` to return `{ "ok": true, "slug": "sunset-mural-test1" }` with status 200, click "Approve", confirm `loadPendingSubmissions` re-fires (the list reloads).
6. Intercept `**/.netlify/functions/gallery-reject` similarly, click "Reject", confirm the `confirm()` dialog appears (accept it), and confirm the reload fires.
7. Switch back to the "Articles" tab and confirm the existing article table still works exactly as before (this task must not regress Task 3 of the earlier admin panel plan).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin.astro
git commit -m "$(cat <<'EOF'
Add Gallery Submissions tab to the admin panel

Reuses the existing /admin login and api() helper. Lists pending
gallery submissions as image cards with Approve/Reject actions,
calling the new gallery-pending-list/gallery-approve/gallery-reject
functions.
EOF
)"
```
