# LoanLab — Educational Home Loan Calculator

**Status:** Phase 1 complete (engine + tests + core screen). This document is the single source of truth for product intent, architecture, and roadmap. It is written so that an engineer (or an AI model) with zero prior context can continue the project.

---

## 1. Product Requirements Document (PRD)

### 1.1 Vision

Most first-time home buyers in India misunderstand the single largest financial commitment of their lives. They believe 8% means simple interest, that EMIs mostly reduce principal, that a lower EMI is always better, and that bank approval implies affordability. LoanLab exists to destroy those four myths — not with a textbook, but by showing users the truth **in their own numbers**, instantly.

**North star:** time-to-first-insight under 10 seconds, with zero typing (sensible defaults pre-loaded).

### 1.2 Target users

| Persona | Situation | What they need |
|---|---|---|
| Curious browser | "Someday" buyer, no numbers yet | The Aha moments from defaults alone |
| Serious buyer | Shortlisted a property, comparing banks | Their real numbers + what-if scenarios |
| Anxious buyer | Bank approved more than feels safe | An honest affordability answer with the rule shown |

India-first. Extensible by design (see §4 config isolation), but no non-India UI is built until product-market fit in India.

### 1.3 Core product thesis — three Aha moments

The product is not eight features; it is three realizations, each killing one myth:

1. **"The bank owns your first five years."** ₹50L @ 8.5%/20yr: EMI ₹43,391, total repayment ₹1.04 Cr. First EMI is 81.6% interest. After 5 years, ₹26L paid but only ₹5.9L of principal cleared. *(Kills: "8% is simple interest", "EMI mostly reduces principal".)*
2. **"₹5,000 extra per month is a superpower — but only early."** Extra ₹5k/mo from day one: finishes 4.5 years early, saves ₹13.9L. Corollary: reducing **tenure** beats reducing **EMI** by ₹7.8L for the same prepayments — and banks default to the worse option. *(Kills: "lower EMI is always better".)*
3. **"Approved ≠ affordable."** Banks lend to ~50–55% FOIR because their risk is collateralized. Comfortable is ≤35% FOIR with 6+ months of buffer. Output is a band (comfortable / stretch / danger) with the rule stated openly — never a binary verdict. *(Kills: "approval = affordability".)*

All verified golden numbers live in §12 and in `tests/loan.test.ts`.

### 1.4 Design principles (revised from original brief)

- **Calculate first, teach in context.** Education is the interpretation layer on top of the user's own result — never a gate before it. (Original "explain before calculating" was inverted deliberately; see Risks §8.)
- **No separate "Educational Mode".** Micro-explanations are embedded: insight cards, tappable terms, a "why?" on every number. Analogies appear inline at the moment of confusion.
- **Show the rule, not just the verdict.** Every recommendation states its threshold ("we flag risk above 45% FOIR"). Transparency is both the pedagogy and the legal seatbelt (§8.1).
- **Visualize, never tabulate.** The year scrubber replaces the 240-row amortization table.
- **Mobile-first, no submit buttons.** Every input change recomputes live.
- **Privacy as a feature.** All computation is client-side. State the fact in the UI: "Everything runs on your device."
- **Screenshot-shareable insight cards** are the viral loop.

### 1.5 Feature list by phase

**Phase 1 (SHIPPED):** EMI calculator (property price, down payment, rate, tenure), the reveal (total cost + stacked composition chart), year scrubber, prepayment what-if (extra monthly, reduce-tenure vs reduce-EMI toggle), balance comparison chart, always-on insight cards.

**Phase 2:** Affordability tab (engine already shipped in `affordability.ts`), insight engine wired to UI generically, annual lumpsum what-if chip, "use this amount" back-fill from affordability into the calculator.

**Phase 3:** True-cost tab (stamp duty, registration, GST, processing fee → "cash needed on day zero"), rate-shock stress test chip (engine already supports rate changes), loan-insurance trap explainer, shareable image cards, PWA install prompt, URL-encoded scenarios (`?s=base64`).

**Phase 4 (needs server, see §5–6):** saved scenarios + accounts, live bank rate comparison, regional stamp-duty tables.

### 1.6 Non-goals (v1)

Rent-vs-buy comparison (separate product), tax benefit calculator (new regime makes 80C/24(b) marginal; future toggle), salary-growth/inflation simulators (replaced by the single insight "your EMI is fixed in rupees; at 7% raises it falls from 40% to ~20% of income by year 10"), bank lead-gen or affiliate links (destroys trust positioning), login of any kind.

### 1.7 Success metrics

Time-to-first-insight < 10s; scrubber interaction rate > 40%; what-if chip engagement > 25%; share/screenshot events; return visits. No accounts, so metrics are anonymous client events (Plausible/Umami, cookieless).

---

## 2. UX wireframes

One scrolling screen, three acts, plus two sibling tabs (Phase 2/3).

```
┌──────────────────────────────┐
│ Your EMI          You'll repay│  ← sticky header, always visible
│ ₹43,391/mo        ₹1.04 Cr   │
├──────────────────────────────┤
│ ACT 1 · INPUTS               │
│ Property price   ₹62.5L  ──o─│
│ Down payment  ₹12.5L (20%) o─│
│ Rate 8.5% ─o─   Tenure 20 ─o─│
│ 🔒 runs on your device        │
├──────────────────────────────┤
│ ACT 2 · THE REVEAL           │
│ "Your ₹50L loan will really  │
│  cost ₹1.04 Cr"              │
│ ▓▓▓▓ stacked area chart ▓▓▓▓ │  ← amber=interest, green=principal
│ ▓▓▓▓ (per-year EMI split)▓▓▓ │
│ Drag to year [──o───────] 5  │
│ ┌──────────────────────────┐ │
│ │ Paid ₹26L · cleared ₹5.9L│ │  ← scrubber card = the table, humanized
│ │ ₹20.1L was interest      │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ ACT 3 · WHAT IF              │
│ (Nothing)(+₹2k)(+₹5k)(+₹10k) │  ← chips
│ [Shorten tenure ✓][Lower EMI]│  ← the teaching toggle
│ ┌ 💡 Saves ₹13.9L, 4.5 yrs ┐ │
│ └──────────────────────────┘ │
│ ── balance curves chart ──   │
├──────────────────────────────┤
│ 3 insight cards (always on)  │
├──────────────────────────────┤
│ [Loan] [Afford?] [True cost] │  ← tab bar; tabs 2–3 are Phase 2/3
└──────────────────────────────┘
```

Affordability tab (Phase 2): income / existing EMIs / expenses / emergency savings sliders → FOIR gauge (comfortable ≤35 / stretch ≤45 / danger) → notes list from `computeAffordability` → "Use ₹X as your loan" button back-fills the Loan tab. The gauge shows the thresholds on its scale.

User flows: **A (browser)** land → defaults → scrub → Aha#1, no typing. **B (buyer)** real numbers → chips → screenshot cards. **C (anxious)** afford tab → band + rules → back-fill loan tab.

---

## 3. Technical architecture

```
┌─────────────────────────────────────────────┐
│ Layer 3 · UI (React + Recharts + Tailwind)  │  dumb components,
│   useLoanScenario() hook = single state src │  re-render on every tick
├─────────────────────────────────────────────┤
│ Layer 2 · Insight engine (insights.ts)      │  Rule[] → Insight[]
│   pure rules over engine output; UI renders │  add insights w/o UI changes
│   Insight[] generically                     │
├─────────────────────────────────────────────┤
│ Layer 1 · Calculation engine (loan.ts,      │  pure functions, zero deps,
│   affordability.ts, money.ts, types.ts)     │  integer paise, no I/O,
│                                             │  no clocks, no locale
├─────────────────────────────────────────────┤
│ config/in.ts — ALL India-specific values    │  engine never imports config
└─────────────────────────────────────────────┘
```

**Key decisions and why:**

- **Client-side only, no backend (v1–v3).** All math runs <1ms on a phone. Consequences: zero latency (charts update per slider tick with no debouncing), zero infra cost, zero PII liability (a trust feature we state in the UI), offline PWA for free. The engine is pure, so it lifts unchanged into a Node API route when Phase 4 needs a server.
- **Money as integer paise.** Eliminates float drift; invariant tests assert exact equality (principal components sum to the loan to the paise).
- **EMI rounded to the whole rupee** (bank convention). Consequence: a tiny residual final payment can spill into month n+1 — tests document this as intended, matching real bank behavior.
- **Strict dependency direction.** Engine imports nothing. Insights import engine. UI imports both. Config is composed by UI only. Multi-country = new config file, zero engine changes.
- **`negativeAmortization` flag + `MAX_MONTHS=600` cap.** A rate shock where EMI < monthly interest must never loop forever or render as a normal result.
- **Explicit `.ts` import extensions** + `moduleResolution: bundler`. Works under Vite, Vitest, and plain Node ≥22.18 type-stripping (`npm run verify` needs no dependencies at all — useful in locked-down environments; it was how this repo was validated).
- **Vite, not Next.js.** Nothing to server-render; a static PWA keeps the mental model honest.

**Repo map:**

```
loan-lab/
├── PROJECT.md              ← you are here
├── package.json            (scripts: dev/build/test/verify/typecheck)
├── tsconfig.json
├── src/
│   ├── engine/
│   │   ├── types.ts        domain types (all money = paise)
│   │   ├── money.ts        rupee/lakh/paise + en-IN formatting
│   │   ├── loan.ts         computeEmi, computeSchedule, principalForEmi
│   │   ├── affordability.ts computeAffordability, safeLoanAmount, thresholds
│   │   └── insights.ts     baseInsights, prepayment/tenureVsEmi/rateShock
│   ├── config/in.ts        India defaults, slider ranges, upfront costs, facts
│   ├── ui/
│   │   ├── App.tsx           full application UI (imports engine; no math)
│   │   ├── components.tsx    NumField, Slider, InsightCard, Expander
│   │   ├── useLoanScenario.ts single state owner + memoized engine calls
│   │   └── scenario.ts       rampToRateChanges (ramp → rateChanges[]), lastFullEmi
│   ├── main.tsx / index.css  Vite entry + Tailwind
├── tests/                  Vitest: goldens, invariants, edge cases
│   ├── loan.test.ts
│   ├── affordability.test.ts
│   ├── scenario.test.ts    M2 port-equivalence goldens + ramp mapping
│   └── ui.smoke.test.tsx   RTL smoke (jsdom; runs in CI)
└── scripts/verify.ts       framework-free harness: `node scripts/verify.ts`
```

**M2 porting note:** `App.artifact.jsx` inlines a JS copy of the engine so it runs as a single-file demo. First task of M2 is deleting that inline copy and importing from `src/engine/` — the TypeScript engine is the only source of truth. A CI check (grep for `function computeEmi` outside `src/engine/`) should enforce this after the port.

---

## 4. Database schema

**v1–v3: no database.** Persistence is (a) `localStorage` under key `loanlab.scenario.v1` and (b) the shareable URL `?s=<base64url(json)>`. The stored object is versioned:

```jsonc
{
  "v": 1,                      // schema_version — bump on breaking change
  "loan": { "priceL": 62.5, "dpPct": 20, "rate": 8.5, "tenureYr": 20 },
  "prepay": { "extra": 5000, "lumpsum": 0, "mode": "reduce_tenure" },
  "afford": { "income": 120000, "emis": 8000, "expenses": 45000, "savings": 400000 }
}
```

A `migrateScenario(v_any) -> v_latest` function must accompany every version bump (the version gate lives in `src/ui/urlState.ts:decodeScenario`; unknown versions return null rather than being silently accepted). True-cost inputs (stamp %, processing fee, insurance premium) are deliberately NOT in the URL scenario — they're location-specific one-offs, not part of the core scenario people compare.

**Phase 4 (accounts + saved scenarios), Postgres:**

```sql
create table users (
  id          uuid primary key default gen_random_uuid(),
  auth_sub    text unique not null,          -- from auth provider; no PII beyond this
  created_at  timestamptz not null default now()
);

create table scenarios (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  name           text not null default 'My scenario',
  schema_version int  not null,
  params         jsonb not null,             -- same object as localStorage
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on scenarios (user_id, updated_at desc);

create table rate_snapshots (                -- only if live bank rates ship
  id           bigserial primary key,
  bank         text not null,
  product      text not null,                -- e.g. 'home_floating_eblr'
  annual_rate  numeric(5,2) not null,
  captured_at  timestamptz not null,
  unique (bank, product, captured_at)
);
```

`params` is deliberately schemaless jsonb: the scenario shape will evolve faster than migrations should. Computation stays client-side even in Phase 4 — the server stores scenarios, it does not calculate.

---

## 5. API contracts (Phase 4 — do not build earlier)

REST, JSON, versioned path. Auth via bearer token from the auth provider.

```
GET    /api/v1/scenarios              → 200 [{id, name, schema_version, params, updated_at}]
POST   /api/v1/scenarios              body {name, schema_version, params} → 201 {id}
PUT    /api/v1/scenarios/:id          body {name?, schema_version, params} → 200
DELETE /api/v1/scenarios/:id          → 204
GET    /api/v1/rates?product=home_floating_eblr → 200 [{bank, annual_rate, captured_at}]
```

Errors: `{ "error": { "code": "scenario_not_found", "message": "…" } }` with proper status codes. No calculation endpoints — the engine ships to the client. If a server-side calc is ever needed (e.g., WhatsApp bot), expose `POST /api/v1/calc/schedule` that imports the same `src/engine` — this is why the engine has zero DOM/browser dependencies.

---

## 6. Milestone-based implementation plan

| # | Milestone | Contents | Definition of done |
|---|---|---|---|
| M0 ✅ | Engine + core screen | `src/engine/*`, tests, verify harness, Phase-1 UI | `npm run verify` passes; goldens match bank calculators; demo usable |
| M1 | Repo bootstrap | `npm create vite@latest` scaffolding, Tailwind, Vitest wired, CI (typecheck + test) | `npm test` green in CI |
| M2 ✅ | Port UI into repo | UI ported to `src/ui/` (App.tsx, components.tsx, useLoanScenario.ts, scenario.ts) importing `src/engine`; inline engine copy deleted; Vite/Tailwind/CI scaffolded; `check:engine-dup` guard green; port equivalence proven by `tests/scenario.test.ts` goldens (458/294/241/216-month scenarios + final EMI ₹48,282) | grep-check passes; feature parity with artifact |
| M3 ⚙️ | Affordability tab (demo UI shipped in artifact; repo port pends M2) | UI over `computeAffordability` + FOIR gauge + back-fill button; annual-lumpsum chip | Flow C works end-to-end |
| M4 ⚙️ | Insight engine wiring | Rate-shock stress test shipped in demo (0.25%-step ramp, custom start year/spread, rate falls, collapsed by default). Generic `Insight[]` rendering pends the M2 port. Note: a ramp needs **no engine change** — express it as a generated `rateChanges[]` list. | New insight = zero UI diff |
| M5 ✅ | True cost + share | Shipped: TrueCost expander (day-zero cash: stamp/registration/GST/processing fee, editable %), insurance-trap calculator (financed premium × loan multiple), URL scenarios (`?s=` base64url, versioned, clamped, synced via replaceState), Share button (Web Share API + clipboard fallback), PWA (vite-plugin-pwa, manifest, generated icons). **Deferred by decision: PNG share-image cards** — the interactive URL is the share mechanism; a static image adds code without adding value. Revisit only if user testing shows demand. | Lighthouse PWA pass; shared URL restores state |
| M6 | Launch hardening | Analytics (cookieless), a11y pass (focus, reduced motion, contrast), en-IN copy review, deploy | §9 checklist complete |

Each milestone ships something usable. Never merge a milestone that breaks `npm run verify`.

---

## 7. Risks and tradeoffs

1. **Financial-advice liability (highest).** Personalized advice can brush SEBI RIA territory. Mitigation: band + transparent rule, never "take this loan"; permanent "educational tool, not financial advice" footer; no bank recommendations or lead-gen. Any future monetization must be re-reviewed against this.
2. **Accuracy vs. bank reality.** Real EMIs differ by a few rupees (disbursal date, day-count, pre-EMI interest on under-construction). We state this in the footer. Tradeoff accepted: teaching clarity > paisa-perfect replication. Do **not** add day-count complexity without a user-visible reason.
3. **"Explain before calculating" inversion.** We deliberately inverted the founding brief (calculate → teach in context). Risk: education becomes skippable. Mitigation: insights are always-on below the fold, and the scrubber makes the lesson interactive rather than optional reading.
4. **RESOLVED (M2): inline engine duplication.** The repo now has one engine (`src/engine`); `npm run check:engine-dup` fails CI if math is ever redefined outside it. The chat demo file (LoanCalculator.jsx) remains a separate self-contained convenience copy for artifact previews only — it is downstream of the repo, and parity is enforced by the golden scenarios in `tests/scenario.test.ts`. When repo behaviour changes, regenerate the demo.
5. **Client-side = no server-side validation of shared URLs.** A crafted `?s=` could contain absurd numbers. Mitigation: clamp all inputs to slider ranges on load.
6. **Rounding conventions.** EMI rounds to the rupee → possible month n+1 residual (documented in tests). If a bank rounds differently, goldens may drift by ₹1 — tolerance is intentional in `principalForEmi` round-trip only.
7. **Recharts bundle size** (~100KB gz). Acceptable for v1; if PWA perf budget breaks, swap to uPlot behind the same data props.
8. **FOIR thresholds are opinions** (35/45/6-month buffer). They're exported constants shown in the UI. Changing them is a product decision, not a code tweak — record rationale here when changed.
9. **Rate-ramp realism.** The stress test applies 0.25% steps at even intervals; real cycles cluster (several hikes in a quarter, then pauses). Even-interval is the deliberate choice: conservative, explainable, and clearly a stress test rather than a forecast. The upgrade path is historical repo replay (§8) — never add rate forecasting.

---

## 8. Future features (beyond Phase 4)

Rent-vs-buy explorer; tax-regime toggle (old regime 24(b)/80C); balance-transfer comparator ("is switching banks worth it after fees?"); step-up EMI education (and its risks); pre-EMI vs full-EMI for under-construction; historical repo-rate replay (feed actual RBI rate history through the same `rateChanges[]` hook as the stress test); Hindi/Tamil localization; second country config (likely AE or SG corridors for NRI buyers); WhatsApp share-bot using the engine server-side.

---

## 9. Production deployment guide

Target: static PWA on Cloudflare Pages (or Vercel — equivalent).

1. `npm ci && npm run typecheck && npm test && npm run build` → `dist/`.
2. Cloudflare Pages: framework preset Vite, build command `npm run build`, output `dist`. Set `NODE_VERSION=22`.
3. Headers (`_headers` file): `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`; `no-cache` for `index.html`; `Content-Security-Policy: default-src 'self'` (no third-party origins — we load nothing external); `X-Content-Type-Options: nosniff`.
4. PWA (M5): `vite-plugin-pwa` with `registerType: 'autoUpdate'`; verify offline load and install prompt on Android Chrome.
5. Analytics: Plausible/Umami script only after M6 sign-off; cookieless; events: `scrub`, `chip_extra`, `mode_toggle`, `afford_backfill`, `share`.
6. Rollback = redeploy previous commit (static site; no migrations until Phase 4).
7. Custom domain + automatic HTTPS via the host. No servers, no secrets, nothing to rotate.

CI (GitHub Actions): on PR → `typecheck`, `test`, `verify`, `build`; on main → deploy. Block merge on any red.

---

## 10. AI prompts for continuing development

Paste the relevant prompt plus this file into any capable model.

**Context preamble (always include):**
> You are continuing LoanLab, an educational home-loan calculator for first-time Indian buyers. Read PROJECT.md fully before writing code. Non-negotiables: (1) all money is integer paise; (2) `src/engine` stays pure — no imports from config/UI, no I/O, no Date.now; (3) every recommendation shows its rule, never a binary verdict; (4) no backend before Phase 4; (5) never merge with `npm run verify` failing; (6) education is embedded in results, never a separate mode; (7) insight copy always uses the user's own numbers.

**M2 prompt:** "Port `src/ui/App.artifact.jsx` into the Vite app as `src/ui/App.tsx` + components (`Slider`, `InsightCard`, `RevealChart`, `WhatIfPanel`). Delete the inline JS engine and import from `src/engine/*.ts`. Create a `useLoanScenario` hook owning all state and memoized schedules. Add a CI grep check failing if `computeEmi` is defined outside `src/engine`. Keep exact feature parity; add React Testing Library smoke tests for the header EMI and scrubber card."

**M3 prompt:** "Build the affordability tab over `computeAffordability` and `safeLoanAmount` from `src/engine/affordability.ts`. UI: four sliders (net income, existing EMIs, expenses, emergency savings), a FOIR gauge that visibly marks the exported 35/45 thresholds, the `notes[]` rendered as cards, and a 'Use {safeLoanAmount} as your loan' button that back-fills the loan tab via `useLoanScenario`. Never render Eligible/Not-eligible. Add tests for the back-fill state transition."

**M5 prompt:** "Implement URL scenario sharing: serialize the scenario object (schema in PROJECT.md §4) to base64url in `?s=`, restore on load, clamping every value to `config/in.ts` sliderRanges. Write `migrateScenario` with tests for v1. Then add share-image cards: render the active insight card to a PNG via a canvas, using the Web Share API with clipboard fallback."

**Bug-fix prompt:** "A user reports {bug}. First write a failing Vitest test in `tests/` reproducing it, then fix the engine, then run the full suite plus `node scripts/verify.ts`. If the fix changes any golden number, update goldens only after cross-checking against two public bank calculators and record the discrepancy analysis in PROJECT.md §7."

---

## 11. Verified golden numbers (engine output, cross-checked)

Base loan ₹50,00,000 @ 8.5% p.a., 240 months:

| Quantity | Value |
|---|---|
| EMI | ₹43,391 |
| Total repayment | ₹1.0414 Cr |
| Total interest | ₹54.14L |
| First EMI split | ₹35,417 interest / ₹7,974 principal (81.6%) |
| After 5 years | paid ₹26.0L, principal cleared ₹5.9L, interest ₹20.1L |
| +₹5k/mo (reduce tenure) | 187 months, saves ₹13.9L, 4.5 years early |
| Same, reduce-EMI mode | ₹7.8L worse than reduce-tenure |
| ₹1L annual lumpsum | 168 months, saves ₹18.6L |
| Rate +2% at month 25, EMI constant | tenure 240 → 414 months, ₹75.2L extra interest |
| Affordability: ₹1.2L income, ₹8k EMIs, ₹45k expenses, ₹4L savings, EMI ₹43,391 | FOIR 42.8%, band **stretch**, comfortable EMI ₹34,000, buffer 4.1 months |

Any engine change that moves these numbers is a correctness event: stop, cross-check, document.
