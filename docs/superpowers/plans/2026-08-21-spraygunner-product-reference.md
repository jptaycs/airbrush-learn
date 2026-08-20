# SprayGunner Product Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder gear-advisor data with a real, curated SprayGunner product list, and wire that same list into the n8n content pipeline so articles link to specific real products instead of the generic `spraygunner.com` root.

**Architecture:** Rename `src/data/gearAdvisor.json` → `src/data/products.json` (same schema, real data). Add a read-only Netlify function `products-list.js` (mirrors the existing `topics-list.js` pattern). In the n8n workflow export, add one HTTP Request node that fetches this list early in the run, thread it through `Set Content Brief Input` → `Orchestrator Agent` → `Writer_Agent`/`Editor_FactCheck_Agent` as a new `product_reference` field, and upgrade those two agents' existing SprayGunner-link instructions to prefer a real product URL over the site root.

**Tech Stack:** Astro (static site), Netlify Functions (plain JS, no framework), n8n workflow JSON export, Shopify's public `products.json` collection feed for sourcing real data.

**Spec:** `docs/superpowers/specs/2026-08-21-spraygunner-product-reference-design.md`

## Global Constraints

- No new npm dependencies — this project has none beyond Astro/Tailwind and isn't adding a fetch/HTTP library; Netlify Functions and n8n's HTTP Request node both have `fetch` built in.
- No test suite exists in this repo (per `CLAUDE.md`) — verification steps below are `npm run build`, JSON validity checks, and manual spot-checks, not automated tests.
- `src/data/products.json` schema is fixed by the spec — do not add fields beyond `name`, `type`, `price`, `budgetTier`, `subjects`, `experience`, `blurb`, `url`.
- `type` values already in use by `GearAdvisor.astro`'s scoring logic: `airbrush`, `compressor`, `kit`, `accessory` — do not repurpose these. A new `paint` value is fine to add (confirmed: the scoring script only explicitly queries the four types above, via `src/components/GearAdvisor.astro:157,168,184,190` — items of any other `type` are simply never selected, never break scoring).
- `subjects` values must be slugs from `src/data/galleryCategories.js`: `automotive`, `fine-art`, `miniatures`, `cosplay`, `fabric`, `scale-models`, `body-art`, `guitars`, `murals`, `nail-art`, `helmets`, `skateboards`, `diecast-cars`, `toy-soldiers`, `wooden-toys`, `nesting-dolls`, `carousel-figures`.
- `budgetTier` boundaries (from `GearAdvisor.astro`'s existing `budgetOptions`): `budget` = under $100, `mid` = $100–300, `pro` = $300+.
- No `/admin` UI for this data (spec non-goal) — `src/data/products.json` is a plain file, hand-edited and committed like `articles.json`/`gallery.json`.
- The n8n workflow lives outside this repo — all n8n changes are made to the downloaded export at `/Users/jptaycs/Downloads/SEO Content Creation - Multi-Agent Pipeline (v4 - Jerome) (2).json`, the same file already edited earlier this session for the image-realism and competitor-links fixes. Changing this file does not affect the live n8n workflow until it's re-imported — flag this to the user at the end.
- `Fetch Topics from API`'s pattern is the template for `Fetch Products from API`: `n8n-nodes-base.httpRequest`, `authentication: genericCredentialType`, `genericAuthType: httpHeaderAuth`, credential `{ "id": "pm0Ln3li5HW9Ohfw", "name": "Header Auth account" }` (the same credential already configured for `x-admin-password`), `typeVersion: 4.5`.

---

### Task 1: Rename the data file and repoint the Astro import

**Files:**
- Rename: `src/data/gearAdvisor.json` → `src/data/products.json`
- Modify: `src/components/GearAdvisor.astro:3`

**Interfaces:**
- Produces: `src/data/products.json` — same array-of-objects shape `gearAdvisor.json` already had (still placeholder content after this task; Task 2 replaces the content).

- [ ] **Step 1: Rename the file with git, so history is preserved**

```bash
git mv src/data/gearAdvisor.json src/data/products.json
```

- [ ] **Step 2: Update the import in `GearAdvisor.astro`**

In `src/components/GearAdvisor.astro`, change:

```js
import gearItems from '../data/gearAdvisor.json';
```

to:

```js
import gearItems from '../data/products.json';
```

- [ ] **Step 3: Verify the build still succeeds**

Run: `npm run build`
Expected: build completes with no errors, `/gear-advisor/index.html` still generated (check the build log for `src/pages/gear-advisor.astro`).

- [ ] **Step 4: Commit**

```bash
git add src/data/products.json src/components/GearAdvisor.astro
git commit -m "Rename gearAdvisor.json to products.json"
```

---

### Task 2: Curate real SprayGunner product data

**Files:**
- Modify: `src/data/products.json`

**Interfaces:**
- Consumes: nothing from Task 1 beyond the renamed file existing.
- Produces: the real product array both `GearAdvisor.astro` (Task 1, already wired) and `products-list.js` (Task 3) will serve.

spraygunner.com is a Shopify store — every collection exposes a public, unauthenticated `products.json` feed. The six collection URLs below are already verified live (fetched 2026-08-21):

| Collection URL | Use for `type` |
|---|---|
| `https://spraygunner.com/collections/single-action-airbrush-collection/products.json` | `airbrush` |
| `https://spraygunner.com/collections/double-action-airbrush/products.json` | `airbrush` |
| `https://spraygunner.com/collections/compressor/products.json` | `compressor` |
| `https://spraygunner.com/collections/airbrush-cleaning-kit/products.json` | `accessory` |
| `https://spraygunner.com/collections/paints-for-airbrush/products.json` | `paint` |
| `https://spraygunner.com/collections/airbrush-for-beginners/products.json` | `airbrush` or `kit` (judge per item — a bundle with a compressor is `kit`, a single airbrush is `airbrush`) |

- [ ] **Step 1: Fetch each collection and inspect the results**

For each URL in the table, run:

```bash
curl -s "https://spraygunner.com/collections/<handle>/products.json?limit=10" | python3 -m json.tool
```

For each product returned, note: `title`, `handle`, `product_type`, `tags`, `variants[0].price`, and enough of `body_html` to write a one-sentence blurb.

- [ ] **Step 2: Pick 4-6 representative products per collection**

Spread picks across price points within each collection so `budgetTier` isn't all one value (e.g. for airbrushes, include at least one under $100 and one $100+). Skip near-duplicate items (same product in different nozzle sizes, etc.) — one representative per distinct product line is enough.

- [ ] **Step 3: Map each picked product into the schema**

For each product:
- `name` ← `title`, cleaned up if it has redundant boilerplate (e.g. drop a trailing SKU code).
- `type` ← from the table above, adjusted per-item as noted for the beginners collection.
- `price` ← `Math.round(variants[0].price)` (feed gives a string like `"79.00"` — use the numeric dollar amount, no cents).
- `budgetTier` ← `budget` under $100 / `mid` $100–300 / `pro` $300+ (per the Global Constraints boundaries).
- `subjects` ← only for `type: "airbrush"` or `type: "kit"` items — 1-3 slugs from the `galleryCategories.js` list above that plausibly fit (e.g. a beginner single-action airbrush → `["miniatures", "scale-models"]`). Omit entirely for `compressor`/`accessory`/`paint` items (matches `gearAdvisor.json`'s existing convention of omitting `subjects` when it doesn't apply).
- `experience` ← 1-3 of `beginner`/`intermediate`/`advanced`, judged from the product's positioning in its `body_html` (e.g. "compact," "easy" → beginner-friendly; "professional," "precision" → intermediate/advanced).
- `blurb` ← one sentence, written from the real `body_html`/features — do not invent specs not present in the feed data.
- `url` ← `https://spraygunner.com/products/<handle>?utm_source=airbrushlearn&utm_medium=content-pipeline`.

- [ ] **Step 4: Replace the placeholder array in `src/data/products.json`**

Write the full curated array (should land around 24-36 items across the six collections) as the file's JSON content, formatted with 2-space indentation matching the file's current style.

- [ ] **Step 5: Validate the JSON and re-run the build**

```bash
python3 -c "
import json
with open('src/data/products.json') as f:
    products = json.load(f)
print('valid JSON, count:', len(products))
assert all(set(p.keys()) <= {'name','type','price','budgetTier','subjects','experience','blurb','url'} for p in products)
for t in ('airbrush','compressor','kit','accessory'):
    print(t, 'count:', sum(1 for p in products if p['type'] == t))
"
npm run build
```

Expected: valid JSON, no unexpected keys, at least one item each for `airbrush`, `compressor`, and `accessory` (the three types `GearAdvisor.astro`'s scoring logic actively selects from — a zero count in any of these would make that result slot always fall back/empty), and the build still succeeds.

- [ ] **Step 6: Manually verify the gear-advisor quiz against real data**

Run `npm run dev`, open `/gear-advisor`, and step through the quiz for a discipline covered by the curated `subjects` (e.g. "Miniatures") and one that isn't (e.g. "Nesting Dolls" or another discipline you didn't tag). Confirm:
- The covered discipline returns a specific airbrush match (not the generic fallback note).
- The uncovered discipline still shows the "airbrushes are versatile" fallback note instead of a blank slot (per the existing spec's fallback behavior — this task doesn't change that logic, just needs to confirm it still works with real data density).
- Both "I already have one" and "I need the full setup" compressor answers behave as before.

- [ ] **Step 7: Commit**

```bash
git add src/data/products.json
git commit -m "Curate real SprayGunner product data from live collection feeds"
```

---

### Task 3: Add the `products-list` Netlify function

**Files:**
- Create: `netlify/functions/products-list.js`

**Interfaces:**
- Consumes: `src/data/products.json` (Task 2's output) via GitHub's Contents API — same pattern as `netlify/functions/topics-list.js`.
- Produces: `GET /.netlify/functions/products-list` → `{ products: [...], sha: "<git blob sha>" }` on success; `401` if `x-admin-password` header is missing/wrong; `502` if the GitHub fetch fails or the file is too large to return inline.

- [ ] **Step 1: Write the function, mirroring `topics-list.js` exactly**

```js
const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/products.json';

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
    return new Response('Failed to fetch products.json from GitHub', { status: 502 });
  }

  const data = await res.json();
  // GitHub's Contents API omits `content` (sends `download_url` instead)
  // once a file crosses ~1MB — without this check, Buffer.from(undefined,
  // ...) throws and the function 500s with no actionable message.
  if (!data.content) {
    return new Response('products.json is too large for the GitHub Contents API to return inline', { status: 502 });
  }
  const products = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));

  return new Response(JSON.stringify({ products, sha: data.sha }), {
    headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 2: Syntax-check the function**

Run: `node --check netlify/functions/products-list.js`
Expected: no output (success).

- [ ] **Step 3: If a `.env` with `GITHUB_PAT`/`ADMIN_PASSWORD` is available locally, verify a real round-trip**

```bash
npx netlify-cli dev &
sleep 3
curl -s -H "x-admin-password: $(grep ADMIN_PASSWORD .env | cut -d= -f2)" http://localhost:8888/.netlify/functions/products-list | python3 -m json.tool | head -20
```

Expected: a real JSON response with the curated products and a `sha`. Stop the `netlify-cli dev` background process afterward. If no `.env` is available in the execution environment, skip this step and note it as unverified (matching how `admin-*.js` round-trips were left unverified elsewhere in this repo's To Do list until credentials were available).

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/products-list.js
git commit -m "Add products-list Netlify function for the n8n pipeline to read"
```

---

### Task 4: Wire the product reference into the n8n workflow export

**Files:**
- Modify: `/Users/jptaycs/Downloads/SEO Content Creation - Multi-Agent Pipeline (v4 - Jerome) (2).json`

**Interfaces:**
- Consumes: `products-list.js` (Task 3) as the URL the new HTTP Request node calls.
- Produces: a `product_reference` field flowing `Set Content Brief Input` → `Orchestrator Agent`'s prompt → (relayed by the Orchestrator) into `Writer_Agent` and `Editor_FactCheck_Agent`'s inputs.

This task edits five things in the workflow JSON: adds one node, rewires two connections, and edits three existing nodes' text/prompts (`Set Content Brief Input`, `Orchestrator Agent`, `Writer_Agent`, `Editor_FactCheck_Agent` — four node edits total). Do this as one Python script, the same technique used earlier this session on this same file, to avoid hand-editing a single-line JSON blob.

- [ ] **Step 1: Write and run the edit script**

```bash
python3 << 'EOF'
import json

path = '/Users/jptaycs/Downloads/SEO Content Creation - Multi-Agent Pipeline (v4 - Jerome) (2).json'
with open(path) as f:
    data = json.load(f)

nodes = data['nodes']
conns = data['connections']

# --- 1. Add the "Fetch Products from API" node ---
new_node = {
    "parameters": {
        "url": "https://airbrush-learn.netlify.app/.netlify/functions/products-list",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
    },
    "id": "b6f1b9b1-6b7e-4f0a-9a1d-2f6c6b3f9a01",
    "name": "Fetch Products from API",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.5,
    "position": [-1040, -1040],
    "credentials": {
        "httpHeaderAuth": {
            "id": "pm0Ln3li5HW9Ohfw",
            "name": "Header Auth account"
        }
    }
}
assert not any(n['name'] == 'Fetch Products from API' for n in nodes), "node already exists"
nodes.append(new_node)

# --- 2. Rewire: Limit to 1 Topic -> Fetch Products from API -> Set Content Brief Input ---
assert conns['Limit to 1 Topic'] == {'main': [[{'node': 'Set Content Brief Input', 'type': 'main', 'index': 0}]]}
conns['Limit to 1 Topic'] = {'main': [[{'node': 'Fetch Products from API', 'type': 'main', 'index': 0}]]}
conns['Fetch Products from API'] = {'main': [[{'node': 'Set Content Brief Input', 'type': 'main', 'index': 0}]]}

# --- 3. Set Content Brief Input: read topic from the named node (since its
#     direct input is now the product fetch, not the topic item), and add
#     product_reference from the product fetch's direct output ---
for n in nodes:
    if n['name'] == 'Set Content Brief Input':
        assigns = n['parameters']['assignments']['assignments']
        for a in assigns:
            if a['name'] == 'topic':
                assert a['value'] == "={{ $json.article_title }}"
                a['value'] = "={{ $('Limit to 1 Topic').item.json.article_title }}"
        assert not any(a['name'] == 'product_reference' for a in assigns)
        assigns.append({
            "id": "f4",
            "name": "product_reference",
            "type": "string",
            "value": "={{ JSON.stringify($json.products) }}"
        })

# --- 4. Orchestrator Agent: add PRODUCT REFERENCE + relay instructions ---
for n in nodes:
    if n['name'] == 'Orchestrator Agent':
        old = "TARGET WORD COUNT: {{ $json.target_word_count }}\n\nCall each specialist sub-agent EXACTLY ONCE"
        new = (
            "TARGET WORD COUNT: {{ $json.target_word_count }}\n"
            "PRODUCT REFERENCE: {{ $json.product_reference }}\n\n"
            "The PRODUCT REFERENCE above is a JSON list of real SprayGunner products "
            "(name, type, price, blurb, url) available to link to. When you call Writer "
            "Agent, include the full PRODUCT REFERENCE JSON as part of what you send it, "
            "labeled \"PRODUCT REFERENCE:\", so it can pick specific real products to link "
            "instead of the site root. When you call Editor & Fact-Check Agent, include the "
            "same PRODUCT REFERENCE JSON as part of what you send it, labeled the same way, "
            "so it can verify or upgrade SprayGunner links against real products.\n\n"
            "Call each specialist sub-agent EXACTLY ONCE"
        )
        assert old in n['parameters']['text']
        n['parameters']['text'] = n['parameters']['text'].replace(old, new)

# --- 5. Writer_Agent: prefer a real product URL over the site root ---
for n in nodes:
    if n['name'] == 'Writer_Agent':
        old = (
            'SPRAYGUNNER LINKS: When the article discusses a specific product, brand, or '
            'technique SprayGunner sells, link the relevant phrase to https://www.spraygunner.com/ '
            'with anchor text naming what\'s being discussed (e.g. "SprayGunner\'s dual-action '
            'airbrushes") — use the site root since you don\'t have a verified deep product URL to link to.'
        )
        new = (
            'SPRAYGUNNER LINKS: You will be given a PRODUCT REFERENCE list (real SprayGunner '
            'products with name, type, price, blurb, and url) as part of your input. When the '
            'article discusses a specific product, brand, or technique SprayGunner sells, check '
            'PRODUCT REFERENCE first for a matching item and link the relevant phrase directly to '
            'its real url, with anchor text naming the specific product. Only fall back to linking '
            'https://spraygunner.com/ (the site root) if nothing in PRODUCT REFERENCE fits what\'s '
            'being discussed — never invent a deeper URL yourself.'
        )
        sysmsg = n['parameters']['options']['systemMessage']
        assert old in sysmsg
        n['parameters']['options']['systemMessage'] = sysmsg.replace(old, new)

# --- 6. Editor_FactCheck_Agent: verify/upgrade against the real product list ---
for n in nodes:
    if n['name'] == 'Editor_FactCheck_Agent':
        old = (
            'SPRAYGUNNER LINK: Confirm the article links to https://www.spraygunner.com/ at '
            'least once, on a phrase naming the specific SprayGunner product/category/technique '
            'being discussed. If missing, add one at a natural point in the article.'
        )
        new = (
            'SPRAYGUNNER LINK: You will be given the same PRODUCT REFERENCE list the Writer used. '
            'Confirm the article links to at least one specific PRODUCT REFERENCE item\'s url where '
            'a matching product/brand/technique is discussed — if a link instead points at the bare '
            'site root (https://spraygunner.com/) and a matching PRODUCT REFERENCE item exists, '
            'upgrade it to that item\'s specific url. If no SprayGunner link is present at all, add '
            'one at a natural point: a specific PRODUCT REFERENCE item\'s url if one fits, otherwise '
            'the site root.'
        )
        sysmsg = n['parameters']['options']['systemMessage']
        assert old in sysmsg
        n['parameters']['options']['systemMessage'] = sysmsg.replace(old, new)

with open(path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')

print("Done. Node count:", len(nodes))
EOF
```

Expected output: `Done. Node count: 39` (38 existing + the 1 new node), with no `AssertionError`.

- [ ] **Step 2: Verify the file is still valid and every edit landed**

```bash
python3 -c "
import json
path = '/Users/jptaycs/Downloads/SEO Content Creation - Multi-Agent Pipeline (v4 - Jerome) (2).json'
with open(path) as f:
    data = json.load(f)
print('valid JSON, nodes:', len(data['nodes']))
names = [n['name'] for n in data['nodes']]
assert 'Fetch Products from API' in names
assert data['connections']['Fetch Products from API'] == {'main': [[{'node': 'Set Content Brief Input', 'type': 'main', 'index': 0}]]}
for n in data['nodes']:
    if n['name'] == 'Set Content Brief Input':
        assert any(a['name'] == 'product_reference' for a in n['parameters']['assignments']['assignments'])
    if n['name'] == 'Orchestrator Agent':
        assert 'PRODUCT REFERENCE:' in n['parameters']['text']
    if n['name'] == 'Writer_Agent':
        assert 'PRODUCT REFERENCE first' in n['parameters']['options']['systemMessage']
    if n['name'] == 'Editor_FactCheck_Agent':
        assert 'PRODUCT REFERENCE item' in n['parameters']['options']['systemMessage']
print('all edits verified')
"
```

Expected: `valid JSON, nodes: 39` and `all edits verified` with no assertion errors.

- [ ] **Step 3: No commit for this task**

The n8n export lives in `/Users/jptaycs/Downloads/`, outside this git repository — there is nothing to commit here. Flag to the user (in the final summary) that this file needs to be re-imported into their live n8n instance for the change to take effect, same caveat as the earlier image-realism and competitor-links fixes made to this same file.

---

### Task 5: Update CLAUDE.md and commit

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing structurally — this task only updates documentation to reflect Tasks 1-4.

- [ ] **Step 1: Add a `products.json` line to the Project Structure section**

In `CLAUDE.md`, find this block (around line 64-68):

```
src/data/articles.json       # real content, committed directly by n8n via the GitHub API
src/data/categories.js       # fixed 10-category taxonomy (label/description) — not from n8n
src/data/gallery.json        # curated gallery pieces (slug/title/category/image/credit) — not from n8n
src/data/galleryCategories.js # fixed gallery discipline taxonomy (slug/label) — separate from article categories.js
src/data/topics.json         # n8n's topic queue/status tracker, replacing Google Sheets — managed via /admin's Topics tab
```

Add one line after the `topics.json` line:

```
src/data/products.json       # curated real SprayGunner product list (renamed from gearAdvisor.json 2026-08-21) — serves both the /gear-advisor quiz and the n8n content pipeline's product linking, via netlify/functions/products-list.js
```

- [ ] **Step 2: Add `products-list.js` to the `netlify/functions/` line**

Find this line (around line 85):

```
netlify/functions/           # admin-{list,save,delete}.js (articles), gallery-{submit,pending-list,approve,reject}.js (gallery submissions), topics-{list,save,delete}.js (n8n's topic queue) — admin-{list,save,delete}.js, gallery-approve.js, and topics-{list,save,delete}.js all hold the GitHub write token; gallery-submit.js and gallery-pending-list.js only touch Netlify Blobs, never GitHub; see Deployment below
```

Replace it with:

```
netlify/functions/           # admin-{list,save,delete}.js (articles), gallery-{submit,pending-list,approve,reject}.js (gallery submissions), topics-{list,save,delete}.js (n8n's topic queue), products-list.js (read-only product reference for the n8n pipeline) — admin-{list,save,delete}.js, gallery-approve.js, and topics-{list,save,delete}.js all hold the GitHub write token; products-list.js holds it too but only ever reads, never writes; gallery-submit.js and gallery-pending-list.js only touch Netlify Blobs, never GitHub; see Deployment below
```

- [ ] **Step 3: Replace the "Swap in real Gear Advisor data" To Do item**

Find this line:

```
- [ ] **Swap in real Gear Advisor data.** `src/data/gearAdvisor.json` currently ships 3 clearly-labeled placeholder items (Iwata Eclipse HP-CS, Compact Studio Compressor, Airbrush Cleaning Kit) so the `/gear-advisor` quiz has something to score against. Replace them with the real ~15-20 item SprayGunner list per the schema in `docs/superpowers/specs/2026-08-15-gear-advisor-design.md`: `name`, `type` (`airbrush`/`compressor`/`kit`/`accessory`), `price`, `budgetTier` (`budget`/`mid`/`pro`), `subjects` (slugs from `src/data/galleryCategories.js` — **not** `categories.js`), `experience`, `blurb`, `url`.
```

Replace it with:

```
- [x] ~~Swap in real Gear Advisor data.~~ Folded into the unified SprayGunner product reference effort and done 2026-08-21 — see `docs/superpowers/specs/2026-08-21-spraygunner-product-reference-design.md`. `gearAdvisor.json` was renamed to `src/data/products.json` (same schema) and populated with real products curated from spraygunner.com's live Shopify collection feeds, replacing the 3 placeholder items.
```

- [ ] **Step 4: Replace the "Build a SprayGunner product reference" To Do item**

Find this line:

```
- [ ] **Build a SprayGunner product reference for the content pipeline.** Artem's catalog is ~16,000 products (sprayGunner.com); he asked whether there's a curated list (e.g. a sheet) the pipeline can pull relevant products from when writing/linking articles. No such list exists yet — needs scoping (likely a smaller curated subset relevant to blog topics, not the full catalog) and a place to live (`src/data/`, similar to `gearAdvisor.json`, or feeding directly into the n8n linking step).
```

Replace it with:

```
- [x] ~~Build a SprayGunner product reference for the content pipeline.~~ Done 2026-08-21 — see `docs/superpowers/specs/2026-08-21-spraygunner-product-reference-design.md`. `src/data/products.json` (unified with the gear-advisor list above) is now read by a new `netlify/functions/products-list.js`, which a new HTTP Request node in the n8n workflow calls early in each run; the result flows through `Set Content Brief Input` → `Orchestrator Agent`'s prompt → `Writer_Agent`/`Editor_FactCheck_Agent`, which now prefer linking a real product URL from this list over the generic `spraygunner.com` root. **Not yet done:** this change, like the earlier image-realism and competitor-links fixes, only exists in the downloaded n8n export (`/Users/jptaycs/Downloads/SEO Content Creation - Multi-Agent Pipeline (v4 - Jerome) (2).json`) until it's re-imported into the live n8n workflow — and a real end-to-end pipeline run hasn't yet been used to confirm an article actually links to a specific curated product.
```

- [ ] **Step 5: Verify the build one final time**

Run: `npm run build`
Expected: succeeds, same page count as after Task 2.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the unified SprayGunner product reference"
```

---

## Final summary to give the user after all tasks complete

- `src/data/products.json` now holds real curated SprayGunner data (Tasks 1-2), serving both `/gear-advisor` and the content pipeline.
- `netlify/functions/products-list.js` exposes it read-only to n8n (Task 3).
- The n8n export JSON in Downloads has the wiring and prompt upgrades to actually use it (Task 4) — **remind the user this needs to be re-imported into their live n8n instance**, same as the earlier image/link fixes to this same file.
- CLAUDE.md reflects all of the above (Task 5).
- **Manual follow-up, outside this plan's scope:** the spec's testing section calls for running one real n8n pipeline execution end-to-end and confirming the resulting article links to a specific `products.json` URL. No task above does this — it requires triggering the live n8n workflow, which isn't reachable from this repo/session. Tell the user this is the one remaining unverified step once they've re-imported the updated workflow.
