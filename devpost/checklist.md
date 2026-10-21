---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Deterministic Calculation Engines and Unit Tests**
  Becomes usable: Core scoring, greedy allocation, and template plan functions run locally and pass automated tests verifying mathematical invariants.
  Why now: The unique kernel is the deterministic boundary. Proving the math, tie-breaking, and shortfall logic with tests first eliminates downstream UI debugging.
  PRD ref: `prd.md > Risk Scoring & "Why This Ranking?" Factor Breakdown` and `prd.md > Priority Resource Allocation & Shortfall Tracking`
  Spec ref: `spec.md > Deterministic Calculation Engines` and `spec.md > Data Model`
  Build: Create `package.json`, `.env.example`, `src/data/district.json` (8 communities, roads with status, depot), `src/engine/scoring.js` (rounding to 1 decimal place before sum), `src/engine/allocation.js` (scaled demand + greedy allocation), and `src/engine/templatePlan.js`. Implement `tests/engine.test.js`.
  Verify (mechanical): Run `node --test tests/engine.test.js` and confirm all scoring, tie-breaking, and allocation tests pass.
  Learner check: Run `npm test` in terminal and inspect test output verifying factor sums match total score.
  Commit: `Implement core scoring, allocation engine, and tests`

- [x] **2. EOC Command Console Shell, Controls, and Interactive SVG Map**
  Becomes usable: A running local web app displaying the full EOC theme (navy/slate/teal, risk scale with icons/labels, tabular numerals, simulated data banner), controls, and custom SVG district map with road hazard styling and tooltips.
  Why now: Establishes the complete visual styling and local HTTP server up front so every later slice renders directly onto the finished look and feel.
  PRD ref: `prd.md > Scenario Selection & Resource Controls`, `prd.md > Interactive SVG District Map`, and `prd.md > Look and Feel`
  Spec ref: `spec.md > Server & AI Proxy`, `spec.md > Scenario & Stock Controls`, and `spec.md > Interactive SVG District Map`
  Build: Create zero-dependency `server.js`, `index.html` with EOC layout, `styles/main.css` (full design tokens, tabular numerals, responsive grid), `src/app.js`, `src/components/controls.js` (with unapplied changes cue), and `src/components/map.js` (SVG nodes, dual-coding icons/colors, road statuses, hover tooltips).
  Verify (mechanical): Start `node server.js`, fetch `http://localhost:3000` via curl/http request, verify HTTP 200, valid HTML/CSS/JS delivery, and SVG rendering.
  Learner check: Open `http://localhost:3000`, switch scenarios between River Flood and Cyclone, and verify the SVG map updates road statuses and risk colors.
  Commit: `Add server, EOC dashboard layout, controls, and interactive SVG map`

- [x] **3. Triage Ranking, "Why This Ranking?" Expander, and Allocation Shortfall Table**
  Becomes usable: Live data tables showing ranked communities with factor point breakdowns and resource allocations with shortfall badges, synchronized bidirectionally with the SVG map.
  Why now: Completes the full deterministic operator loop. Clicking a map node or table row highlights across panels and reveals the exact mathematical justification.
  PRD ref: `prd.md > Risk Scoring & "Why This Ranking?" Factor Breakdown`, `prd.md > Priority Resource Allocation & Shortfall Tracking`, and `prd.md > Features and Behavior (Cross-Panel Synchronization)`
  Spec ref: `spec.md > Community Triage Table & Ranking Expander` and `spec.md > Resource Allocation & Shortfall View`
  Build: Implement `src/components/triageTable.js` (score badges, factor drawer, template summary) and `src/components/allocationTable.js` (shortfall summary strip, needed vs allocated vs gap, status badges). Wire bidirectional selection in `src/app.js`.
  Verify (mechanical): Run headless verification asserting clicking a community node activates selection state and matching table rows highlight.
  Learner check: Open browser, click a community node on the map, verify its triage row highlights, expand "Why this ranking?", and inspect the shortfall table.
  Commit: `Add triage ranking table, factor expander, and allocation shortfall view`

- [x] **4. AI Action Briefing Proxy, Variable Hydration, Failure Test Hooks, and Fallback Engine**
  Becomes usable: The emergency action plan panel generates an AI operational brief strictly validated and hydrated with computed numbers, with test hooks (`?ai=off`, `?ai=bad`) for demoing fallbacks, unit tests for validation guardrails, and project README.
  Why now: Connects LLM synthesis to the deterministic data while guaranteeing zero hallucinated quantities and enabling foolproof demonstration of guardrails.
  PRD ref: `prd.md > AI Emergency Action Plan & Fallback Guardrail`
  Spec ref: `spec.md > Server & AI Proxy`, `spec.md > AI Action Brief & Fallback Engine`, and `spec.md > External Services and Dependencies`
  Build: Implement `POST /api/brief` proxy in `server.js`, failure test hooks (`?ai=off`, `?ai=bad`), `src/services/aiBriefing.js` (schema validator, digit allow-list, placeholder hydrator), `src/components/actionPlan.js` (skeleton loader, action brief renderer, audit badges), unit tests in `tests/guardrail.test.js` (testing rejected invented numbers and wrong rank order), and root `README.md`.
  Verify (mechanical): Run unit tests for guardrail validator; test `?ai=off` and `?ai=bad` to confirm fallback badges activate; verify end-to-end plan rendering.
  Learner check: Test live app with and without test hooks, verify action plan displays with verified numbers and audit badge.
  Commit: `Add AI action briefing proxy, placeholder hydration, test hooks, and fallback engine`

## Hands-on Checkpoints

- [x] Early usable behavior explored — Slice 3 (Full deterministic console with interactive map and triage tables) — **STOP FOR LEARNER**
- [x] Final kick-the-tires exploration and feedback completed — Slice 4 (Complete app with AI briefing, guardrail demo hooks, and README)

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [x] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Architecture map and data flow diagram generated in devpost/app-map.html; deterministic scoring & allocation engines verified with automated unit tests (npm test) and live browser test.
Route and stops: src/engine/scoring.js (calculateCommunityRisk) -> src/engine/allocation.js (allocateResources) -> server.js (/api/brief) & src/services/aiBriefing.js.
Edit outcome: Handled Gemini 503 high-demand errors by implementing retry backoff logic and switching to gemini-3.1-flash-lite in server.js.
Reflection: Reusable practice: decoupling deterministic calculation engines from LLM natural language synthesis.
Activity mode: reference route and standalone app-map.

## Revisions

None. All 4 slices built and verified.
