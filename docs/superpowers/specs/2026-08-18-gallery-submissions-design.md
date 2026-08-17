# Community Gallery Submissions — Design

## Goal

Let visitors submit their own airbrush work to the gallery, reviewed and approved by the site owner before appearing publicly. Approved submissions become ordinary entries in `src/data/gallery.json`, indistinguishable from curated pieces once live.

## Relationship to the existing gallery design

The gallery's original design (`docs/superpowers/specs/2026-08-14-airbrush-art-gallery-design.md`) explicitly listed "no user/community submission form, no moderation, no accounts" as a non-goal, on the reasoning that the site was fully static with no backend. This spec is a deliberate reversal of that decision, confirmed with the site owner — not an oversight. It's made possible by infrastructure that didn't exist when the original gallery was built: the admin panel (`docs/superpowers/specs/2026-08-17-admin-panel-design.md`) already established a password-gated write path via Netlify Functions holding a `GITHUB_PAT` server-side, committing to this repo through GitHub's Contents API. This feature extends that same pattern rather than inventing a new one, and adds Netlify Blobs (built into the Netlify Functions runtime, no extra credential needed) as a holding area for content that hasn't been approved yet.

## Data model

`src/data/gallery.json`'s shape is unchanged. An approved submission becomes exactly the same shape as a curated piece:

```json
{
  "slug": "sunset-mural-by-jane",
  "title": "Sunset Mural",
  "category": "murals",
  "image": "sunset-mural-by-jane.jpg",
  "credit": "Jane Doe"
}
```

`category` must be one of the 17 slugs in `src/data/galleryCategories.js` — the submission form's discipline field is a `<select>` populated from that same list, so this is guaranteed by construction, not validated after the fact.

### Pending submissions (Netlify Blobs, not git)

Nothing about an unapproved submission touches the repository. Three kinds of Blob keys:

- `pending/index.json` — a JSON array of pending submission IDs. The one thing the admin tab reads first to know what exists.
- `pending/<id>/meta` — JSON: `{ id, title, artistName, discipline, email, submittedAt }`
- `pending/<id>/image` — the raw uploaded image bytes

`id` is a generated unique identifier (e.g. `crypto.randomUUID()`), not derived from the title — slugs are only generated at approval time, when the piece is about to become a permanent, public, git-committed artifact.

## Public submission flow

### `src/pages/gallery/submit.astro`

A new page, linked via a "Submit Your Work" button on the existing `/gallery` index page. Unlike `/admin`, this page is meant to be discovered — no `noindex`.

Form fields:
- **Title** — text, required
- **Artist name** — text, required. Becomes the public `credit` field on approval.
- **Discipline** — `<select>`, required, options from `galleryCategories.js`
- **Email** — text, required. Never displayed publicly; stored only for the site owner's own follow-up (a copyright question, or informing the submitter of a rejection).
- **Rights confirmation** — a required checkbox: "I made this piece myself and have the right to share it here." Doesn't prevent someone from lying, but establishes the site asked and puts responsibility on the submitter if it turns out false.
- **Image** — file input, required
- **Honeypot field** — a text input, visually hidden via CSS positioning (not `display: none`, since some bots specifically skip hidden inputs) rather than removed from the DOM, labeled something plausible like "Website" that a real visitor never sees or fills in. Used only server-side (see below); never mentioned in any visible copy on the page.

Client-side: basic required-field and file-type/size checks for immediate feedback, but every one of these checks is re-enforced server-side, since client-side validation is trivially bypassable.

### `netlify/functions/gallery-submit.js` (public — no password required)

1. If the honeypot field is non-empty, respond with the same success message as a real submission would get, but store nothing. (Responding identically avoids teaching a bot to detect and route around the check.)
2. Validate the image's content type is one of `image/jpeg`, `image/png`, `image/webp`, and that its size is at most 8MB. Reject with a clear error otherwise.
3. Validate all required text fields are present and non-empty, and that `discipline` is one of the 17 known slugs.
4. Generate a submission ID, write `pending/<id>/meta` and `pending/<id>/image` to Blobs, and append the ID to `pending/index.json`.
5. Respond with a simple confirmation message: "Thanks — your submission is under review." No confirmation email is sent; this site has no email-sending service, and adding one is out of scope here.

## Moderation flow (admin side)

### `/admin` gains a second tab

The existing `src/pages/admin.astro` page (already password-gated, already handling articles) gets a simple tab toggle near the top of the logged-in view: **Articles** and **Gallery Submissions**. Both tabs are shown/hidden via plain `classList` toggling — no routing, no separate page, no second password. This is the same login session already established for the articles admin.

The **Gallery Submissions** tab shows each pending item as a card: the image, title, artist name, discipline, and submission date, with **Approve** and **Reject** buttons. Reject is guarded by the same native `confirm()` prompt the articles tab's Delete button already uses, since it's also irreversible (the submission's data is gone — though low-stakes, since the submitter still has their own copy of the image and can resubmit).

### `netlify/functions/gallery-pending-list.js` (password-gated)

Checks `x-admin-password` first, exactly like `admin-list`. Reads `pending/index.json`, then each submission's `meta` blob, and returns an array of `{ id, title, artistName, discipline, email, submittedAt, imageDataUrl }` — the image is embedded as a base64 data URI directly in the response. For the small number of submissions realistically pending at once on a site this size, this is simpler than building and securing a second "fetch me one image" endpoint, and avoids the complication of authenticating a plain `<img src>` request (which can't carry the custom `x-admin-password` header a fetch-based call can).

### `netlify/functions/gallery-approve.js` (password-gated, POST, body `{ id }`)

1. Password check first, same as every other admin function.
2. Reads the submission's `meta` and `image` blobs.
3. Generates a slug from the title: lowercase, non-alphanumeric characters replaced with hyphens, collapsed and trimmed — a small self-contained slugify implementation local to this function. (Note: this repo has no existing slugify code of its own to reuse — the n8n content pipeline has one, but it lives entirely outside this repo, in the external n8n workflow.)
4. Commits the image to `public/images/gallery/<slug>.jpg` via GitHub's Contents API, and separately fetches, updates, and commits `src/data/gallery.json` with the new entry appended — both using the same `sha`-based optimistic-concurrency check `admin-save` already uses (fetch current `sha`, verify it hasn't changed, write; on mismatch return a 409 rather than risking an overwrite). This mirrors how n8n already commits an article and its hero image as two separate steps.
5. On success, deletes the submission's Blob keys (`meta`, `image`, and its entry in `pending/index.json`).

### `netlify/functions/gallery-reject.js` (password-gated, POST, body `{ id }`)

Password check first. Deletes the submission's Blob keys. No git write of any kind.

## Testing

- `npm run build` succeeds with no errors, and existing gallery pages are unaffected (this feature adds files, it doesn't modify `gallery.json` directly).
- Unlike the articles admin panel — which was almost entirely blocked on a real `GITHUB_PAT` during development — most of this feature can be fully tested locally via `netlify dev`, since Netlify Blobs are emulated locally with no external credential required. `gallery-submit`, `gallery-pending-list`, and `gallery-reject` never touch GitHub at all. Only `gallery-approve` needs a real `GITHUB_PAT` to fully verify against the live API; everything else about it (password check, Blob reads, slug generation, the request/response shape) can be verified without one.
- Submit a test image through the form; confirm it appears in the admin's Gallery Submissions tab with correct metadata and a visible image preview.
- Submit with the honeypot field filled (via direct API call, since it's invisible in the real form); confirm nothing is stored, but the response looks identical to a normal success.
- Submit an oversized file and a disallowed file type; confirm both are rejected with clear errors.
- Approve a pending submission; confirm it appears on the live `/gallery` and the correct `/gallery/<discipline>` page after the next build, with the right title/credit/category, and that it's removed from the pending list.
- Reject a pending submission; confirm it disappears from the pending list and nothing was committed to git.
- Simulate a concurrent conflict on approval (edit `gallery.json` via a separate commit between loading the pending list and approving) and confirm `gallery-approve` reports a conflict rather than silently overwriting.

## Non-goals (explicitly out of scope for this version)

- No confirmation email to submitters — this site has no email-sending service.
- No image resizing or optimization of uploaded images — matches the site's existing known gap for hero images (`CLAUDE.md`'s "Known gaps" section).
- No editing a submission's fields before approving — if something's slightly off, reject it and ask the submitter to resubmit.
- No public status page for a submitter to check on their own submission.
- No rejected-submission archive or audit log — a rejected submission is deleted, not retained.
- No CAPTCHA or third-party bot-detection service — a honeypot field plus the approval-required moderation queue is the agreed-on level of protection for this site's scale.
- No duplicate-submission detection — a human reviewer catches an obvious duplicate during approval.
