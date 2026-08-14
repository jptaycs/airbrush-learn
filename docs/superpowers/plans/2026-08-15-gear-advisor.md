# Airbrush Gear Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-question client-side quiz at `/gear-advisor` that matches visitors to specific airbrush gear (from a small hand-curated list) and links them to SprayGunner's store, plus a homepage teaser and nav link pointing to it.

**Architecture:** A new Astro page (`src/pages/gear-advisor.astro`) renders a new self-contained component (`src/components/GearAdvisor.astro`) that owns its own scoped client-side `<script>` for quiz step state and gear scoring — a deliberate, narrow exception to this site's usual "all client JS lives in `PageInteractions.astro`" convention, justified because this is real multi-step business logic, not lightweight polish, and Astro code-splits component scripts automatically so it only loads on this one page. Gear data lives in a new `src/data/gearAdvisor.json`, following the same committed-JSON-file pattern as `articles.json`/`gallery.json`.

**Tech Stack:** Astro (`.astro` components, frontmatter + client `<script>`), Tailwind CSS utility classes only, vanilla JS (no framework, no external libraries) — matches every other component in this repo.

**Spec:** `docs/superpowers/specs/2026-08-15-gear-advisor-design.md`

## Global Constraints

- Styling is Tailwind utility classes only — no new CSS in `global.css`, no inline `<style>` blocks (matches `CLAUDE.md`).
- No new npm dependencies.
- `subjects` values in gear data must be slugs from `src/data/galleryCategories.js` (the 17-discipline gallery taxonomy), never `src/data/categories.js` (the 9 article categories) — this was an explicit correction made during design.
- Gear data in this plan is **placeholder/stub content** (2-3 items), clearly not real SprayGunner products — the user supplies the real ~15-20 item list later; nothing here should be treated as final copy to ship.
- This repo has no test suite and no lint step configured (`CLAUDE.md` is explicit about this). "Testing" in this plan means: `npm run build` succeeds, and manual browser verification via the Playwright MCP tools (`mcp__plugin_playwright_playwright__*`) — the same verification approach used for every other feature built in this repo so far. There is no unit-test framework to write `Task N: write failing test` steps against.
- Every share/product link that leaves the site keeps `target="_blank" rel="noopener"`, matching the existing pattern in `ArticleSchema`/`Header`/`Footer`/homepage CTAs.

---

## Task 1: Gear data, quiz component, and page

**Files:**
- Create: `src/data/gearAdvisor.json`
- Create: `src/components/GearAdvisor.astro`
- Create: `src/pages/gear-advisor.astro`

**Interfaces:**
- Consumes: `galleryCategories` array (`{ slug, label }[]`) from `src/data/galleryCategories.js`; `BaseLayout` component from `src/layouts/BaseLayout.astro` (props: `title`, `description`, `canonicalPath`, optional `ogImage`, optional `noindex`).
- Produces: `GearAdvisor.astro` — a props-less Astro component rendering the full quiz + results UI, importable as `import GearAdvisor from '../components/GearAdvisor.astro'` and used as `<GearAdvisor />`. Reads gear items from `src/data/gearAdvisor.json`, each item shaped `{ name: string, type: 'airbrush'|'compressor'|'kit'|'accessory', price: number, budgetTier: 'budget'|'mid'|'pro', subjects?: string[], experience: string[], blurb: string, url: string }`.

- [ ] **Step 1: Create the placeholder gear data file**

Create `src/data/gearAdvisor.json`:

```json
[
  {
    "name": "Iwata Eclipse HP-CS (placeholder — swap for real SprayGunner pick)",
    "type": "airbrush",
    "price": 149,
    "budgetTier": "mid",
    "subjects": ["miniatures", "cosplay", "nail-art"],
    "experience": ["beginner", "intermediate"],
    "blurb": "Forgiving trigger control, a solid first gravity-feed airbrush.",
    "url": "https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=gear-advisor"
  },
  {
    "name": "Compact Studio Compressor (placeholder — swap for real SprayGunner pick)",
    "type": "compressor",
    "price": 89,
    "budgetTier": "budget",
    "experience": ["beginner", "intermediate", "advanced"],
    "blurb": "Quiet, consistent pressure for a home studio setup.",
    "url": "https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=gear-advisor"
  },
  {
    "name": "Airbrush Cleaning Kit (placeholder — swap for real SprayGunner pick)",
    "type": "accessory",
    "price": 24,
    "budgetTier": "budget",
    "experience": ["beginner", "intermediate", "advanced"],
    "blurb": "Brushes, pot, and solution to keep your airbrush spraying clean.",
    "url": "https://spraygunner.com/?utm_source=airbrushlearn&utm_medium=gear-advisor"
  }
]
```

Note the compressor and accessory items have no `subjects` field — per the data model, that means "suits any subject" and skips the subject filter.

- [ ] **Step 2: Create the GearAdvisor component**

Create `src/components/GearAdvisor.astro`:

```astro
---
import { galleryCategories } from '../data/galleryCategories.js';
import gearItems from '../data/gearAdvisor.json';

const budgetOptions = [
  { value: 'budget', label: 'Under $100' },
  { value: 'mid', label: '$100–300' },
  { value: 'pro', label: '$300+' },
];
const experienceOptions = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];
const compressorOptions = [
  { value: 'have-one', label: 'I already have one' },
  { value: 'need-everything', label: 'I need the full setup' },
];
---
<div class="max-w-3xl mx-auto">
  <p data-step-counter class="text-center text-muted text-[0.85rem] font-semibold uppercase tracking-[0.05em] mb-6">Step 1 of 4</p>

  <div data-quiz-step="1">
    <h2 class="font-serif text-ink text-[1.6rem] text-center mb-6">What do you want to paint?</h2>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
      {galleryCategories.map((d) => (
        <button type="button" data-answer="subject" data-value={d.slug} class="rounded-xl border border-border p-4 text-center font-medium text-ink hover:border-accent hover:bg-bg-alt transition-colors">
          {d.label}
        </button>
      ))}
    </div>
  </div>

  <div data-quiz-step="2" class="hidden">
    <h2 class="font-serif text-ink text-[1.6rem] text-center mb-6">What's your budget?</h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 max-w-xl mx-auto">
      {budgetOptions.map((o) => (
        <button type="button" data-answer="budget" data-value={o.value} class="rounded-xl border border-border p-4 text-center font-medium text-ink hover:border-accent hover:bg-bg-alt transition-colors">
          {o.label}
        </button>
      ))}
    </div>
  </div>

  <div data-quiz-step="3" class="hidden">
    <h2 class="font-serif text-ink text-[1.6rem] text-center mb-6">What's your experience level?</h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 max-w-xl mx-auto">
      {experienceOptions.map((o) => (
        <button type="button" data-answer="experience" data-value={o.value} class="rounded-xl border border-border p-4 text-center font-medium text-ink hover:border-accent hover:bg-bg-alt transition-colors">
          {o.label}
        </button>
      ))}
    </div>
  </div>

  <div data-quiz-step="4" class="hidden">
    <h2 class="font-serif text-ink text-[1.6rem] text-center mb-6">Do you have a compressor?</h2>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 max-w-xl mx-auto">
      {compressorOptions.map((o) => (
        <button type="button" data-answer="compressor" data-value={o.value} class="rounded-xl border border-border p-4 text-center font-medium text-ink hover:border-accent hover:bg-bg-alt transition-colors">
          {o.label}
        </button>
      ))}
    </div>
  </div>

  <div class="text-center mt-8">
    <button type="button" data-quiz-back class="hidden text-muted text-[0.85rem] font-semibold hover:text-accent">&larr; Back</button>
  </div>

  <div data-quiz-results class="hidden">
    <h2 class="font-serif text-ink text-[1.6rem] text-center mb-8">Your gear picks</h2>
    <div data-results-list class="grid gap-5"></div>
    <p data-results-fallback-note class="hidden text-center text-muted text-[0.85rem] mt-2"></p>
    <div class="text-center mt-8">
      <button type="button" data-quiz-restart class="rounded-full border border-border text-ink px-5 py-2.5 text-[0.9rem] font-semibold hover:bg-bg-alt">Start Over</button>
    </div>
  </div>
</div>

<script define:vars={{ gearItems }}>
  const steps = Array.from(document.querySelectorAll('[data-quiz-step]'));
  const stepCounter = document.querySelector('[data-step-counter]');
  const backBtn = document.querySelector('[data-quiz-back]');
  const resultsPanel = document.querySelector('[data-quiz-results]');
  const resultsList = document.querySelector('[data-results-list]');
  const fallbackNote = document.querySelector('[data-results-fallback-note]');
  const restartBtn = document.querySelector('[data-quiz-restart]');

  const answers = {};
  let currentStep = 1;
  const totalSteps = steps.length;

  const showStep = (n) => {
    steps.forEach((el) => {
      el.classList.toggle('hidden', Number(el.dataset.quizStep) !== n);
    });
    resultsPanel.classList.add('hidden');
    stepCounter.classList.remove('hidden');
    stepCounter.textContent = `Step ${n} of ${totalSteps}`;
    backBtn.classList.toggle('hidden', n === 1);
    currentStep = n;
  };

  const scoreGear = () => {
    const isAirbrushOrKit = (item) => item.type === 'airbrush' || item.type === 'kit';
    const passesSubject = (item) => !item.subjects || item.subjects.includes(answers.subject);

    const score = (item) => {
      let s = 0;
      if (item.budgetTier === answers.budget) s += 1;
      if (item.experience?.includes(answers.experience)) s += 1;
      return s;
    };

    const pool = gearItems.filter((item) => {
      if (answers.compressor === 'have-one' && item.type === 'compressor') return false;
      return true;
    });

    let airbrushCandidates = pool.filter((item) => isAirbrushOrKit(item) && passesSubject(item));
    let usedFallback = false;
    if (airbrushCandidates.length === 0) {
      airbrushCandidates = pool.filter(isAirbrushOrKit);
      usedFallback = true;
    }
    airbrushCandidates.sort((a, b) => score(b) - score(a));
    const airbrushPick = airbrushCandidates[0] || null;

    let compressorPick = null;
    if (answers.compressor === 'need-everything') {
      const compressorCandidates = pool
        .filter((item) => item.type === 'compressor')
        .sort((a, b) => score(b) - score(a));
      compressorPick = compressorCandidates[0] || null;
    }

    const accessoryCandidates = pool
      .filter((item) => item.type === 'accessory' && passesSubject(item) && score(item) > 0)
      .sort((a, b) => score(b) - score(a));
    const accessoryPick = accessoryCandidates[0] || null;

    return { airbrushPick, compressorPick, accessoryPick, usedFallback };
  };

  const cardHtml = (label, item) => `
    <div class="rounded-xl border border-border p-5">
      <span class="block text-[0.7rem] text-accent-dark uppercase tracking-[0.05em] font-bold mb-1.5">${label}</span>
      <h3 class="font-serif text-ink text-[1.15rem]">${item.name}</h3>
      <p class="mt-1.5 text-muted text-[0.9rem]">${item.blurb}</p>
      <div class="mt-3 flex items-center justify-between">
        <span class="font-mono text-[0.85rem] text-ink font-semibold">$${item.price}</span>
        <a href="${item.url}" target="_blank" rel="noopener" class="inline-block rounded-full bg-accent text-white px-4 py-2 text-[0.82rem] font-semibold hover:no-underline hover:opacity-90">Shop at SprayGunner &rarr;</a>
      </div>
    </div>
  `;

  const showResults = () => {
    const { airbrushPick, compressorPick, accessoryPick, usedFallback } = scoreGear();
    const cards = [];
    if (airbrushPick) cards.push(cardHtml('Your airbrush', airbrushPick));
    if (compressorPick) cards.push(cardHtml('Your compressor', compressorPick));
    if (accessoryPick) cards.push(cardHtml('A nice extra', accessoryPick));
    resultsList.innerHTML = cards.join('') || '<p class="text-center text-muted">No matches yet — check back as we add more gear.</p>';

    if (usedFallback && airbrushPick) {
      fallbackNote.textContent = 'Airbrushes are versatile — this pick works well across most subjects.';
      fallbackNote.classList.remove('hidden');
    } else {
      fallbackNote.classList.add('hidden');
    }

    steps.forEach((el) => el.classList.add('hidden'));
    stepCounter.classList.add('hidden');
    backBtn.classList.add('hidden');
    resultsPanel.classList.remove('hidden');
  };

  document.querySelectorAll('[data-answer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      answers[btn.dataset.answer] = btn.dataset.value;
      if (currentStep < totalSteps) {
        showStep(currentStep + 1);
      } else {
        showResults();
      }
    });
  });

  backBtn.addEventListener('click', () => {
    if (currentStep > 1) showStep(currentStep - 1);
  });

  restartBtn.addEventListener('click', () => {
    for (const key in answers) delete answers[key];
    showStep(1);
  });

  showStep(1);
</script>
```

- [ ] **Step 3: Create the page wrapper**

Create `src/pages/gear-advisor.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import GearAdvisor from '../components/GearAdvisor.astro';
---
<BaseLayout
  title="Gear Advisor — Find Your Airbrush Setup | Airbrush Learn"
  description="Answer a few quick questions and get matched to the airbrush, compressor, and accessories that fit what you paint, your budget, and your experience level."
  canonicalPath="/gear-advisor"
>
  <section class="pt-14 pb-4 text-center">
    <div class="mx-auto max-w-wide px-5">
      <div class="text-[0.78rem] text-muted mb-4">
        <a href="/" class="text-muted hover:text-accent-dark">Home</a> / <span class="text-body">Gear Advisor</span>
      </div>
      <h1 class="font-serif max-[640px]:text-[1.7rem] text-ink text-[2.25rem]">Find Your Airbrush Setup</h1>
      <p class="mt-3 text-muted text-[1.05rem] max-w-[520px] mx-auto">Answer four quick questions and we'll match you to real gear.</p>
    </div>
  </section>

  <section class="mx-auto max-w-wide px-5 pt-8 pb-20">
    <GearAdvisor />
  </section>
</BaseLayout>
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: completes with no errors, and `dist/gear-advisor/index.html` exists.

- [ ] **Step 5: Manual browser verification — normal path**

Start the dev server in the background and use the Playwright MCP tools to verify:

```bash
npm run dev
```

1. Navigate to `http://localhost:4321/gear-advisor`.
2. Confirm "Step 1 of 4" and the 17 discipline buttons are visible; steps 2-4 and the results panel are not.
3. Click "Miniatures". Confirm it advances to "Step 2 of 4" (budget) and a "Back" button now appears.
4. Click "$100–300". Confirm it advances to "Step 3 of 4" (experience).
5. Click "Beginner". Confirm it advances to "Step 4 of 4" (compressor).
6. Click "I need the full setup". Confirm the results panel appears showing **three** cards, in this order: "Your airbrush" (the placeholder Iwata Eclipse — it's tagged `miniatures`), "Your compressor" (the placeholder compressor), and "A nice extra" (the placeholder cleaning kit). The kit appears because it has no `subjects` (auto-passes the subject filter) and its `experience` list includes `beginner`, which matches the answer given — that's a real score of 1, not a fallback. If the kit does *not* appear here, that's a bug in `scoreGear` to fix before moving on.
7. Click "Start Over". Confirm it returns to Step 1 with no discipline pre-selected.

- [ ] **Step 6: Manual browser verification — edge cases**

1. Restart the quiz. Pick "Nesting Dolls" (a discipline the placeholder data doesn't cover) → any budget → any experience → "I already have one".
   - Confirm the results panel still shows an airbrush pick (the fallback path), and the fallback note "Airbrushes are versatile — this pick works well across most subjects." is visible.
   - Confirm no "Your compressor" card appears (since "I already have one" was selected).
2. Restart the quiz. Pick "Cosplay" → "Under $100" → "Advanced" → "I already have one".
   - Confirm the airbrush card appears (Cosplay is in the placeholder item's `subjects`) and no compressor card appears.
3. Resize the browser to a mobile viewport (e.g. 390×700) and repeat the Step 5 walkthrough once, confirming the layout doesn't break (buttons wrap/stack sensibly, results cards are readable).
4. Stop the dev server when done (`pkill -f "astro dev"` or equivalent) and remove any screenshot files created during verification from the repo root.

- [ ] **Step 7: Commit**

```bash
git add src/data/gearAdvisor.json src/components/GearAdvisor.astro src/pages/gear-advisor.astro
git commit -m "$(cat <<'EOF'
Add Gear Advisor quiz page

New 4-question client-side quiz at /gear-advisor that scores a small
curated gear list (placeholder data for now) against subject, budget,
experience, and compressor answers, and links results to SprayGunner.
EOF
)"
```

---

## Task 2: Homepage teaser and nav links

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/components/Header.astro`

**Interfaces:**
- Consumes: nothing new — both are plain link additions to existing pages.
- Produces: nothing consumed by later tasks (this is the final task in the plan).

- [ ] **Step 1: Add the homepage teaser section**

In `src/pages/index.astro`, insert a new `<section>` between the "New to Airbrushing?" beginner section (ends with `)}` after the closing `</section>` around what is currently line 159) and the "Browse by Category" section (currently starting around line 161). Insert this section:

```astro
  <section class="py-16">
    <div class="mx-auto max-w-wide px-5">
      <div class="rounded-xl bg-bg-alt p-10 max-[640px]:p-6 flex flex-wrap items-center justify-between gap-6">
        <div class="max-w-[480px]">
          <span class="text-accent-dark italic text-[0.9rem] font-semibold">Not sure what to buy?</span>
          <h2 class="font-serif text-ink text-[1.8rem] mt-2">Find your airbrush setup in 60 seconds.</h2>
          <p class="mt-2 text-muted text-[1rem]">Answer a few quick questions and we'll match you to the right airbrush, compressor, and accessories.</p>
        </div>
        <a href="/gear-advisor" class="inline-block rounded-full bg-accent text-white px-6 py-3 text-[0.95rem] font-semibold hover:no-underline hover:opacity-90 active:scale-95 transition-transform">Take the Gear Quiz &rarr;</a>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Add the header nav link**

In `src/components/Header.astro`, the nav `<ul id="mobile-nav" data-mobile-nav ...>` is shared by both the desktop nav (`md:flex`) and the mobile hamburger panel (`max-md:` overrides) — it's the same list, so only one `<li>` needs to be added. Add it directly after the existing `<li><a href="/gallery" ...>Gallery</a></li>` line and before the `<li><details>` (Categories) block:

```astro
        <li><a href="/gear-advisor" class="block max-md:py-2 text-body font-medium text-[0.95rem] hover:text-accent-dark hover:no-underline">Gear Advisor</a></li>
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: completes with no errors.

- [ ] **Step 4: Manual browser verification**

Start the dev server (`npm run dev`) and use the Playwright MCP tools to verify:

1. Navigate to `http://localhost:4321/`. Confirm the new "Find your airbrush setup in 60 seconds." teaser section renders between the beginner steps section and "Browse by Category", and clicking "Take the Gear Quiz" navigates to `/gear-advisor`.
2. At a desktop viewport (e.g. 1280×800), confirm "Gear Advisor" appears in the header nav between "Gallery" and "Categories", and clicking it navigates to `/gear-advisor`.
3. At a mobile viewport (e.g. 390×700), open the hamburger menu and confirm "Gear Advisor" appears in the same position in the mobile panel, and clicking it navigates to `/gear-advisor` and closes the panel.
4. Stop the dev server and remove any screenshot files created during verification from the repo root.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/components/Header.astro
git commit -m "$(cat <<'EOF'
Link the Gear Advisor from the homepage and header nav

Adds a homepage teaser section and a "Gear Advisor" link in both the
desktop and mobile nav, pointing to the new /gear-advisor quiz.
EOF
)"
```
