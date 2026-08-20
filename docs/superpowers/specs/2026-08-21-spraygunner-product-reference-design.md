# SprayGunner Product Reference — Design

## Goal

Give the n8n content pipeline real, verified SprayGunner product URLs to link to when an article discusses a specific product, brand, or technique — replacing the generic `https://spraygunner.com/` root-domain link the pipeline currently falls back to (see the 2026-08-21 outbound-links fix in `CLAUDE.md`'s To Do). Unify this with the existing (currently placeholder) Gear Advisor data source, since both need the same underlying thing: a small, curated, real list of SprayGunner products.

## Content model

One list serves both consumers. `src/data/gearAdvisor.json` is renamed to **`src/data/products.json`** — same schema, no new fields:

```json
{
  "name": "GSI Creos Mr. Airbrush Procon Boy PS-268A",
  "type": "airbrush",
  "price": 79,
  "budgetTier": "budget",
  "subjects": ["miniatures", "scale-models"],
  "experience": ["beginner"],
  "blurb": "Compact single-action gravity-feed airbrush, ultra-light at 73g.",
  "url": "https://spraygunner.com/products/gsi-creos-mr-airbrush-procon-boy-ps268a-0-4-single-action?utm_source=airbrushlearn&utm_medium=content-pipeline"
}
```

Field definitions are unchanged from the current `gearAdvisor.json` (see `docs/superpowers/specs/2026-08-15-gear-advisor-design.md`'s Content Model section) — `type`, `budgetTier`, `subjects`, `experience` still drive the gear-advisor quiz's scoring exactly as today; `name`, `type`, `blurb`, `url` are what the content pipeline needs to match a product to what an article is about.

### Sourcing (replaces the placeholder data)

spraygunner.com is a Shopify store, and every collection page exposes a public, unauthenticated JSON feed at `<collection-url>/products.json` — confirmed live 2026-08-21 against `https://spraygunner.com/collections/single-action-airbrush-collection/products.json`. This returns real, structured product data (title, price, handle, vendor, product_type, tags) with no scraping or guessing required.

Curation process for the initial ~30-40 item list:
1. Identify relevant collection handles spanning the categories this site's articles actually cover — single-action and double-action airbrushes, compressors, cleaning kits/supplies, paint (the existing article catalog includes buying guides, technique posts, and paint-brand comparisons, not just airbrush hardware).
2. Fetch each collection's `products.json`, and hand-pick 2-5 representative products per collection spanning budget tiers where relevant.
3. Map each into the schema above — `name`/`price`/`url` (built from the product `handle`) come straight from the feed; `type`/`budgetTier`/`subjects`/`experience`/`blurb` are curator judgment based on the real product data (title, `body_html`, `product_type`, `tags`).

This is a one-time hand-curated snapshot, not a live sync — **prices and availability will drift out of date over time**, same tradeoff as any hand-edited JSON file in this repo (`articles.json`, `gallery.json`). The sourcing method above is repeatable, so refreshing the list later is a rerun of the same process, not a redesign. No automatic refresh mechanism is being built now (see Non-goals).

## Consumers

### `/gear-advisor.astro` + `GearAdvisor.astro`

Mechanical change only: import `products.json` instead of `gearAdvisor.json`. Scoring logic, quiz flow, and result slots are unaffected — see the existing gear-advisor spec for that behavior, which doesn't change here.

### n8n content pipeline

**New Netlify function `netlify/functions/products-list.js`** — read-only GET, same auth (`x-admin-password`) and GitHub-Contents-API-read pattern as `topics-list.js`. Returns the full `products.json` array as JSON. Gated the same way as the rest of `/admin`'s endpoints for consistency, even though the data itself isn't sensitive.

**Workflow change:** one new HTTP Request node, added early in the workflow (after the topic is picked, before the Orchestrator Agent runs), calling `products-list` and making the result available as `product_reference` alongside the existing `topic`/`brand_voice`/`target_word_count` fields that already flow into the Orchestrator's prompt (`Set Content Brief Input` node).

**Prompt changes**, building on the 2026-08-21 competitor-links fix already made to these same three nodes:
- **Orchestrator Agent** — instructed to include the full `product_reference` list when it calls `Writer_Agent` and `Editor_FactCheck_Agent`, so both sub-agents have it available (each is a stateless tool call today; the data has to be passed through explicitly).
- **Writer_Agent** — the existing "SPRAYGUNNER LINKS" instruction (currently: link to the site root when a product/brand/technique SprayGunner sells comes up) is upgraded to: check `product_reference` first for a specific matching product and link to its real `url`; only fall back to the site root if nothing in the reference list fits.
- **Editor_FactCheck_Agent** — its existing "SPRAYGUNNER LINK" QA check is upgraded the same way: prefer confirming/adding a specific product link from `product_reference` over a root-domain link.

## Testing

- `npm run build` succeeds with the renamed `products.json` import.
- Gear-advisor quiz: re-run the existing test plan from `2026-08-15-gear-advisor-design.md` (all 4 steps, fallback note, compressor logic) against the real curated data instead of placeholders — confirm no discipline produces an empty result and each `type`/`budgetTier` combination used in scoring still has at least one item.
- `products-list.js`: verify a real round-trip locally against `netlify-cli dev` (same verification style already done for `topics-list`/`topics-save`/`topics-delete` per `CLAUDE.md`'s To Do).
- n8n: run one real pipeline execution end-to-end and confirm the resulting article links to a specific `products.json` URL (not the site root) for at least one product/brand/technique it discusses.

## Non-goals (explicitly out of scope for this pass)

- No live SprayGunner catalog API integration for the pipeline at runtime — it consumes the same curated snapshot the gear-advisor quiz uses, not a live product search.
- No automatic refresh/sync of `products.json` from Shopify's feed — hand-curated and hand-updated, same as `articles.json`/`gallery.json`.
- No `/admin` UI for editing this list (mirrors the gear-advisor spec's same decision) — plain JSON file, edited and committed directly.
- No changes to the gear-advisor quiz's scoring logic, UI, or test plan beyond the import rename.
