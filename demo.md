# Airbrush Learn — Demo Script

Live site: **beginnerairbrush.com**
(`airbrush.gallery` still points at the old WordPress site — don't demo that domain, and don't promise a cutover date; that's still up in the air with Artem.)

---

## Before you start

- [ ] Make sure you're on the **live site** (beginnerairbrush.com), not localhost — nothing to spin up, it just auto-deploys from `main` every time something's pushed.
- [ ] Pop open a private/incognito window so nothing looks logged-in or weirdly cached.
- [ ] Have the `/admin` password ready (from your password manager / `.env` — don't say it out loud on a recording).
- [ ] Glance at `git log --oneline -10` right before the call so you can namecheck whatever shipped most recently if someone asks "what's new?"
- [ ] Keep the numbers handy so you're not caught flat-footed: **38 published articles, 9 drafts waiting on review, 29 curated SprayGunner products** feeding the Gear Advisor quiz.
- [ ] If you're also showing the automation (Part 2), get the n8n workflow (`SEO Content Creation - Multi-Agent Pipeline`) open in another tab beforehand — don't fumble around looking for it live.

---

## Intro script

Say this before you touch anything — it sets up everything that follows:

> "Hey, so what I'm going to show you today is Airbrush Learn — it's an airbrushing blog, but the twist is nobody on our end is actually writing the articles. There's an AI pipeline that researches a topic, writes the article, fact-checks it, generates a hero image, and publishes it — all on its own, twice a day. I'll show you two things: first the actual site, so you can see what a visitor sees, and then I'll pop open the automation itself so you can see how the sausage gets made. Sound good?"

Then, right as you land on the homepage:

> "So this is the live site — nothing here was hand-built page by page. It's basically a template that generates itself from a handful of data files. Let me walk you through it."

---

## Part 1 — The site, page by page

### 1. Homepage (`/`)
- Point out the article grid pulls **newest-first automatically** — nobody's dragging cards around to curate this.
- Say: "This just reflects whatever's been published most recently — there's no manual step here at all."

### 2. An article page (`/posts/<slug>`)
- Open any published article.
- Show off the hero image, the read-time estimate (it's just counting words, not typed in by hand), and the **References/footnotes** section down at the bottom.
- Say: "That references list isn't written by anyone — it's built on the fly from whatever links are already in the article. Every article just gets one automatically."

### 3. A category page (`/category/<slug>`)
- Click into something like **Buying Guides** from the header.
- Say: "There's a fixed set of 10 categories across the whole site, so this page and the menu counts up top always match reality — nothing gets out of sync."

### 4. Gear Advisor quiz (`/gear-advisor`)
- Run through the quiz live, answer a few questions honestly.
- Land on the recommendation — click the product link and show it's a **real spraygunner.com URL**, not a dead link or a placeholder.
- Say: "This isn't just generic advice — it's actually scored against a real list of 29 curated SprayGunner products."

### 5. Admin panel (`/admin`)
Log in with the password, then walk both tabs:

**Articles tab**
- Show the list, filter down to drafts, pop open one draft's edit panel.
- Point out the live prose preview pane.
- **Regenerate Image** button — say this lets you fix one bad hero image without re-running the entire pipeline, handy when the AI generates something a little off.
- Publish/unpublish toggle — this is the human "okay, go" step.

**Topics tab**
- Show the topic queue — say it's basically the planned SEO keyword list the pipeline chews through automatically, with a status column (Not started / Published / Blocked).
- Say: "This is the proof it's not just making stuff up — it's working off a real content plan, one topic at a time."

Heads up: there's no Gallery Submissions tab to show — the community gallery feature is paused site-wide behind a feature flag since 2026-08-19 (out of scope for this deliverable, per Artem). Don't bring it up unless someone asks.

### 6. Terms of Use (`/terms-of-use`) and Privacy Policy (`/privacy-policy`)
- Only pull these up if asked, or if you've got time to spare — not worth spending demo time on unprompted.
- If it comes up, say: "These match what the code actually does — just not attorney-reviewed yet, so don't treat them as final legal copy."

---

## Part 2 — The automation, group by group

Transition line before opening n8n:

> "Okay, that's the site — now let me show you the part that actually makes this interesting."

Open the n8n canvas and say:

> "Every article on this site gets written, fact-checked, and published automatically by an AI pipeline — nobody on our end is writing these by hand. I'll walk you across the canvas left to right, it basically reads like a flowchart."

There are around 40 nodes on here, but they break down into six easy chunks, in the order they actually run. Go group by group — no need to read out individual node names unless someone asks.

### Group 1 — Trigger & Topic Selection
**Nodes:** `Schedule Trigger` → `Fetch Topics from API` → `Split Topics` → `Flatten Topic` → `Filter - Unpublished Only` → `Limit to 1 Topic` → `Fetch Products from API`

- Say: "Twice a day, this just fires on its own. It grabs our whole topic queue — a planned list of SEO keywords, not random ideas — filters out anything already published or blocked, and picks one topic for this run. It also grabs our real product catalog at the same time, so the writer's got actual SprayGunner products to reference later."
- Why it matters: **this is what keeps the output planned instead of random.**

### Group 2 — The Orchestrator & six specialist AI agents
**Nodes:** `Set Content Brief Input` → `Orchestrator Agent` (with `Research_Agent`, `SERP_Analysis_Agent`, `Outline_Agent`, `Writer_Agent`, `SEO_Optimizer_Agent`, `Editor_FactCheck_Agent` attached as tools, each with its own model)

This is the group worth slowing down for — it's the actual "AI writes the article" part.
- Say: "This one Orchestrator doesn't write anything itself — think of it as a project manager. It calls six specialist agents in a fixed order, each with one job, passing each one's output to the next:"
  1. **Research Agent** — does keyword and search-intent research, checks it against live web search.
  2. **SERP Analysis Agent** — sees what's already ranking, finds gaps to fill.
  3. **Outline Agent** — builds the article structure, plans out reference links.
  4. **Writer Agent** — writes the full thing to that outline, in our brand voice.
  5. **SEO Optimizer Agent** — handles the meta title, description, slug, alt text.
  6. **Editor & Fact-Check Agent** — proofreads, checks flagged claims with real search, cleans up links.
- Say: "Each one only runs once — there's a hard rule against looping back or re-calling an agent to 'improve' its own answer, so this can't spiral into some expensive retry loop."
- Mention `Publish Guard` right after: if any agent fails, the whole run just gets blocked and reported — nothing half-finished ever goes out. (Good spot to segue into Group 4 if someone asks "what happens if it fails?")

### Group 3 — Image generation
**Nodes:** `Generate Featured Image` → `Image to Base64`

- Say: "While the writing's happening, the pipeline also builds a custom photo-realistic prompt straight from the article's actual title — not some generic stock scene — and generates a real hero image with OpenAI's image model."
- Only bring this up if asked: this got rebuilt earlier this year to fix images that looked disconnected or off-topic — it's stable now.

### Group 4 — Safety & content guardrails
**Nodes:** `parse content` → `Competitor Link Guard`, plus `Publish Guard (block fallback)` → `Blocked - Not Published` from Group 2

- Say: "Before anything hits GitHub, two automatic checks run. One turns the AI's markdown into clean HTML. The other's a deterministic filter — not another AI call — that scans every link in the article and strips out anything pointing to a competitor's site, so we never accidentally promote a competitor on our own blog."
- Good little trust-and-safety beat for non-technical folks — keep it to a sentence unless they want more.

### Group 5 — Publishing to the live site
**Nodes:** `Build Article Entry` → `Get Current articles.json` → `Merge & Encode articles.json` → `Commit articles.json` + `Commit Hero Image` → `Wait for GitHub Commits`

- Say: "Here's the part that makes it safe — instead of hitting some fragile publishing API, it just commits the finished article and image straight into our website's actual GitHub repo, as a **draft**, not live. That commit is what kicks off the site rebuilding itself."
- Say: "Because it's a normal git commit, everything's fully reversible — a bad article is just a one-command revert, same as any code change."

### Group 6 — Reporting back
**Nodes:** `Report Published to Topics API` (success path) / `Report Blocked to Topics API` (failure path)

- Say: "Last step — it reports back to that topic queue from earlier, marks the topic as done so it never gets picked twice."
- Keep it short — closing the loop back to Group 1 usually just clicks for people without needing more explanation.

### Solo nodes worth a one-liner if someone points at them
- **Schedule Trigger** — the only entry point, fires twice a day, no manual "generate now" button exists yet.
- **Simple Memory** — short-term memory for a single run only, so the Orchestrator can track what it's already delegated within one article; doesn't carry over between articles.

---

## Close on trust/safety guardrails (only if asked, or if there's time)
Don't over-explain unless someone asks — these are backstop details, not the headline:
- Competitor links (Iwata, Badger, etc.) get stripped automatically before anything publishes.
- Every git commit is a checkpoint — a bad article or image is a revert away, no sweat.
- Drafts are `noindex`'d so nothing half-baked hurts SEO before a human signs off.
- New articles always land as drafts first — a person flips them to published in `/admin`.

---

## Key words to say during the demo

Lead with these — they're the phrases that land with a non-technical audience:

- **"Fully automated content pipeline"** — not "we wrote a script," say the site *generates and publishes its own content*.
- **"Human-in-the-loop review"** — drafts always land for approval first, nothing goes live unchecked.
- **"Every deploy is instant and reversible"** — it's all git-based, nothing's ever truly lost or stuck.
- **"Real product recommendations, not filler"** — the Gear Advisor and in-article links point to actual SprayGunner inventory, not generic text.
- **"SEO-driven, not random"** — content comes off a planned keyword/topic queue, not ad-libbed.
- **"Zero server, zero CMS"** — it's a static site, so it's fast and cheap with basically no hosting headache.
- **"Six specialists, one project manager"** — for the n8n walkthrough specifically, this is the line that makes the orchestrator setup click instantly.

## Words/claims to avoid

- Don't say the domain cutover ("airbrush.gallery") is scheduled or decided — it's not.
- Don't promise Facebook/X auto-posting exists yet — still just an open idea, nothing's built.
- Don't call the Terms of Use / Privacy Policy pages "legally reviewed" — they're accurate to the code, but no attorney's signed off.
- Don't imply every article's been human-fact-checked — only the published ones have had a review pass; drafts are straight off the pipeline.
- Don't claim the topic-status reporting is bulletproof if someone pushes on reliability — there's a known edge case (a status update can silently fail to record under rare timing) that's tracked internally but not fixed yet. Don't bring it up unprompted, but don't deny it either if a technical person asks directly.
