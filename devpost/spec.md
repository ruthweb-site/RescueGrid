---
doc: spec
status: approved
---

# RescueGrid — Technical Spec

A lightweight, high-performance, single-operator disaster response console built with zero-dependency Node.js on the backend, modular vanilla ES modules in the browser, an offline-first custom SVG map, deterministic scoring and allocation engines, and a placeholder-hydrated LLM briefing service with automated template fallbacks.

## How This Works, In Plain Language
RescueGrid operates in two clean halves:
1. **The Deterministic Core (Math & Spatial)**: Runs locally in the browser. When the operator adjusts a scenario or resource sliders, pure JavaScript mathematical functions compute risk scores for 8 fictional communities and allocate scarce supplies (food, water, medical kits) in strict triage order. The results immediately render on an interactive SVG vector map and in structured allocation tables.
2. **The Operational Briefing Engine (AI & Fallback)**: The browser sends a compact snapshot of all 8 communities and their allocation status to a local Node.js proxy server (`server.js`). The server requests a structured operational brief from a fast LLM. To guarantee the AI never hallucinates or invents inventory quantities, the model returns JSON containing action directives and road advice using variable placeholders (e.g. `{{c1.food}}`). The client validates the schema, ensures all IDs exist, verifies that the deployment sequence matches triage rank, checks that no unvetted digits appear, and hydrates the placeholders with exact computed numbers. If the AI call fails or validation fails, an instant deterministic template plan renders with a clear audit badge.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Launch**: Operator runs `npm start` (or `node server.js`) and opens `http://localhost:3000`. The server delivers static files (`index.html`, `styles/`, `src/`).
2. **Boot**: `src/app.js` fetches `src/data/district.json` into memory and initializes state with scenario `"flood"` and baseline stock (~55% of total demand).
3. **Compute Core**: `src/engine/scoring.js` calculates risk scores for all 8 communities. `src/engine/allocation.js` computes greedy resource distribution and shortfalls.
4. **Render UI**:
   - `src/components/controls.js` displays active scenario and sliders.
   - `src/components/map.js` draws district SVG nodes, roads, and depot.
   - `src/components/triageTable.js` populates the ranked list and "Why this ranking?" factor points and template summary.
   - `src/components/allocationTable.js` renders the allocation rows and deficit badges.
5. **Briefing Request**: `src/services/aiBriefing.js` sends `POST /api/brief` with compact district status.
6. **Guardrail & Hydration**: Client receives JSON, validates against schema and rank constraints, verifies placeholders, and hydrates computed numbers into `src/components/actionPlan.js`. If validation fails, `src/engine/templatePlan.js` renders immediately.
7. **Operator Interaction**: Clicking an SVG community node or table row triggers `app.selectCommunity(id)`, highlighting the entity synchronously across the map and tables.

## Stack
- **Runtime & Backend**: Node.js (v18+ or v20+). Built-in HTTP server (`server.js`), zero external npm dependencies.
  - *Rationale*: Eliminates complex framework setup and dependency drift while securely shielding the LLM API key inside `.env`.
- **Frontend Architecture**: Vanilla ES Modules (`<script type="module">`), modern Vanilla CSS with CSS custom properties.
  - *Rationale*: Zero build step, instant reloads, 100% standard web platform capabilities.
- **Testing**: Node.js built-in test runner (`node --test`).
  - *Rationale*: Fast, zero-dependency unit testing for mathematical scoring, tie-breaking, and greedy allocation algorithms.
- **AI Service**: Google Gemini API (`gemini-1.5-flash` or compatible via standard REST), proxied through `POST /api/brief`.
  - [Google AI API Documentation](https://ai.google.dev/docs)
- **Environment**: Dotenv handling via Node's native `--env-file=.env` or minimal inline parser.

## Where It Runs and How Someone Tries It
- **Prerequisites**: Node.js v18 or higher installed. Optional: AI API key in `.env` (a `.env.example` is committed).
- **Start Command**:
  ```bash
  npm start
  # or: node --env-file=.env server.js (or node server.js)
  ```
- **Access**: Open `http://localhost:3000` in any modern web browser (Chrome, Edge, Firefox).
- **Run Tests**:
  ```bash
  npm test
  # runs: node --test tests/engine.test.js
  ```
- **Recording / Demo**: App runs entirely locally with zero external network tile requests. If no API key is provided, the app demonstrates full deterministic operation with template fallback badges seamlessly.

## Look and Feel
Carried forward from `prd.md > Look and Feel` and `scope.md > Design Direction`.
- **Theme**: Emergency Operations Center (EOC) Command Console.
- **Palette**: Deep navy (`#0a0f1d`), dark slate panels (`#111827`, `#1f2937`), cyan/teal accents (`#0d9488`, `#06b6d4`).
- **Risk Colors & Dual-Coding**:
  - Low: `#10b981` with label `[✓] Low`
  - Moderate: `#f59e0b` with label `[▲] Med`
  - High: `#f97316` with label `[!] High`
  - Critical: `#ef4444` with label `[✖] Crit`
- **Typography**: Clean sans-serif (Inter / system) with monospace tabular numbers (`font-variant-numeric: tabular-nums`) for tables.

## Components

### Server & AI Proxy (`server.js`)
Implements `prd.md > AI Emergency Action Plan & Fallback Guardrail`.
- Serves static assets (`index.html`, `styles/*`, `src/*`) with correct MIME types.
- Exposes `POST /api/brief`. Reads API key from `.env`.
- Forwards compact scenario payload to LLM with a 10-second timeout.
- Returns model JSON response to client. If server encounters any error or missing key, returns `{ error: true, fallback: true }`.

### Scenario & Stock Controls (`src/components/controls.js`)
Implements `prd.md > Scenario Selection & Resource Controls`.
- Renders scenario selector (River Flood vs Cyclone Landfall) and 3 resource sliders:
  - Food Packets (0–2000, step 25)
  - Drinking Water Units (0–3000, step 50)
  - Medical Kits (0–500, step 10)
- Detects unapplied configuration changes and toggles the "Unapplied changes" badge.
- Dispatches simulation run events to `app.js`.

### Interactive SVG District Map (`src/components/map.js`)
Implements `prd.md > Interactive SVG District Map`.
- Renders a pure vector SVG map of the fictional district.
- Draws road network polylines linking communities to each other and to the central depot, styled by derived status (Solid Green = Open; Dashed Amber = At Risk; Dotted Red = Cut).
- Renders community nodes as dual-coded circle badges displaying community rank, risk color, and geometric symbol.
- Coordinates hover tooltips and selection clicks (`app.selectCommunity(id)`).

### Community Triage Table & Ranking Expander (`src/components/triageTable.js`)
Implements `prd.md > Risk Scoring & "Why This Ranking?" Factor Breakdown`.
- Renders prioritized list of communities in descending risk score order.
- Each row contains Rank, Name, Risk Score, and Dual-coded Risk Badge.
- Includes expandable "Why this ranking?" drawer showing:
  - Factor points: Exposure (0–40), Vulnerable Population (0–30), Road Penalty (0–20), Distance (0–10).
  - Deterministic template-generated summary sentence.
  - Guarantee: Component points sum exactly to total score.

### Resource Allocation & Shortfall View (`src/components/allocationTable.js`)
Implements `prd.md > Priority Resource Allocation & Shortfall Tracking`.
- Displays top summary strip with total district shortfall per resource.
- Displays table with columns: Community, Resource Type, Needed, Allocated, Deficit.
- Renders explicit status badges: `[✓] Fully Allocated`, `[▲] Partial`, `[✖] Unmet Need`.
- Highlights corresponding rows when a community is selected.

### AI Action Brief & Fallback Engine (`src/components/actionPlan.js` & `src/services/aiBriefing.js`)
Implements `prd.md > AI Emergency Action Plan & Fallback Guardrail`.
- Displays skeleton shimmer while brief generation is pending.
- Validates LLM JSON output against strict guardrails:
  1. Valid JSON matching schema: `{ immediate: [{ communityId, action }], routeAlerts: [{ roadId, advice }], watchpoints: [string] }`.
  2. All `communityId` and `roadId` tokens exist in the dataset.
  3. `immediate` list follows triage rank order.
  4. Placeholders (e.g. `{{c1.food}}`, `{{c1.water}}`, `{{c1.medical}}`, `{{c1.deficit}}`) are valid and hydrated with computed values.
  5. No unvetted raw numerical digits in free text advice.
- If validation succeeds: renders formatted action brief with badge `[AI-drafted, validated against computed figures]`.
- If validation fails or call times out: invokes `src/engine/templatePlan.js` and renders standard plan with badge `[Standard plan (AI unavailable)]` or `[Standard plan (AI output failed validation)]`.

### Deterministic Calculation Engines (`src/engine/scoring.js`, `src/engine/allocation.js`, `src/engine/templatePlan.js`)
- `scoring.js`: Pure functions computing factor points rounded to 1 decimal place, summed to total score, with deterministic tie-breaking.
- `allocation.js`: Computes scaled demand: $\text{demand} = \text{round}(\text{baseline} \times \max(0.25, \text{exposure} / 40))$, allocates stock greedy-by-rank, and tracks residual deficits.
- `templatePlan.js`: Generates guaranteed mathematically consistent emergency action plans from fixed rule-based sentence patterns.

### Application Coordinator (`src/app.js`)
Implements `prd.md > The Core Journey`.
- Manages application state: active scenario, slider values, simulation results, selected community ID, and AI briefing status.
- Orchestrates unidirectional data flow: Event $\rightarrow$ Compute $\rightarrow$ Sync Components.

## Data Model
Stored in `src/data/district.json`:

```json
{
  "districtName": "Kaveri Delta District (Simulated)",
  "scenarios": {
    "flood": {
      "id": "flood",
      "name": "River Flood Level-4",
      "summary": "Severe monsoon surge causing northern river embankment breach, cutting river valley access roads.",
      "defaultStock": { "food": 850, "water": 1400, "medical": 180 }
    },
    "cyclone": {
      "id": "cyclone",
      "name": "Cyclone Vardah Landfall",
      "summary": "Category 3 coastal cyclone with 130 km/h wind gusts inundating eastern coastal communities.",
      "defaultStock": { "food": 900, "water": 1500, "medical": 210 }
    }
  },
  "depot": {
    "id": "depot-main",
    "name": "Central District Relief Depot",
    "coords": [400, 260]
  },
  "roads": [
    { "id": "r1", "name": "Northern Valley Highway", "from": "depot-main", "to": "c1", "status": { "flood": "cut", "cyclone": "open" } },
    { "id": "r2", "name": "East Coast Expressway", "from": "depot-main", "to": "c2", "status": { "flood": "open", "cyclone": "cut" } },
    { "id": "r3", "name": "Central Ridge Arterial", "from": "depot-main", "to": "c3", "status": { "flood": "open", "cyclone": "open" } },
    { "id": "r4", "name": "Delta Marsh Link Road", "from": "c3", "to": "c4", "status": { "flood": "cut", "cyclone": "at_risk" } },
    { "id": "r5", "name": "Southern Bypass", "from": "depot-main", "to": "c5", "status": { "flood": "at_risk", "cyclone": "open" } },
    { "id": "r6", "name": "Western Hill Corridor", "from": "depot-main", "to": "c6", "status": { "flood": "open", "cyclone": "open" } },
    { "id": "r7", "name": "Fisheries Wharf Route", "from": "c2", "to": "c7", "status": { "flood": "at_risk", "cyclone": "cut" } },
    { "id": "r8", "name": "Upland Forest Track", "from": "c6", "to": "c8", "status": { "flood": "open", "cyclone": "at_risk" } }
  ],
  "communities": [
    {
      "id": "c1",
      "name": "Alathur Basin",
      "coords": [360, 90],
      "population": 1400,
      "vulnerable": 420,
      "accessRoadId": "r1",
      "depotDistanceKm": 18,
      "scenarioExposure": { "flood": 39, "cyclone": 12 }
    },
    {
      "id": "c2",
      "name": "Nagore Coastal Hamlet",
      "coords": [680, 220],
      "population": 2100,
      "vulnerable": 580,
      "accessRoadId": "r2",
      "depotDistanceKm": 28,
      "scenarioExposure": { "flood": 14, "cyclone": 38 }
    },
    {
      "id": "c3",
      "name": "Melur Township",
      "coords": [420, 210],
      "population": 3200,
      "vulnerable": 650,
      "accessRoadId": "r3",
      "depotDistanceKm": 6,
      "scenarioExposure": { "flood": 22, "cyclone": 20 }
    },
    {
      "id": "c4",
      "name": "Kollidam Delta Colony",
      "coords": [540, 160],
      "population": 950,
      "vulnerable": 310,
      "accessRoadId": "r4",
      "depotDistanceKm": 22,
      "scenarioExposure": { "flood": 37, "cyclone": 26 }
    },
    {
      "id": "c5",
      "name": "Perambur South",
      "coords": [390, 420],
      "population": 1800,
      "vulnerable": 390,
      "accessRoadId": "r5",
      "depotDistanceKm": 16,
      "scenarioExposure": { "flood": 28, "cyclone": 18 }
    },
    {
      "id": "c6",
      "name": "Thiruvallur West",
      "coords": [180, 270],
      "population": 1650,
      "vulnerable": 340,
      "accessRoadId": "r6",
      "depotDistanceKm": 24,
      "scenarioExposure": { "flood": 16, "cyclone": 15 }
    },
    {
      "id": "c7",
      "name": "Karaikal Port Enclave",
      "coords": [720, 360],
      "population": 1250,
      "vulnerable": 360,
      "accessRoadId": "r7",
      "depotDistanceKm": 34,
      "scenarioExposure": { "flood": 18, "cyclone": 36 }
    },
    {
      "id": "c8",
      "name": "Sirumalai Foothills",
      "coords": [120, 140],
      "population": 800,
      "vulnerable": 190,
      "accessRoadId": "r8",
      "depotDistanceKm": 31,
      "scenarioExposure": { "flood": 10, "cyclone": 14 }
    }
  ]
}
```

## File Structure

```
RescueGrid/
├── .env.example              # Template with GEMINI_API_KEY= placeholder
├── .gitignore                # Ignores .env and devpost/learner-profile.md
├── package.json              # Scripts: "start": "node server.js", "test": "node --test tests/engine.test.js"
├── server.js                 # Zero-dependency static server + POST /api/brief proxy
├── index.html                # EOC Command Console layout & containers
├── styles/
│   └── main.css              # Dark EOC theme, grid architecture, dual-coded status badges
├── src/
│   ├── app.js                # State coordinator & event hub
│   ├── data/
│   │   └── district.json     # 8 communities, roads, depot, 2 scenarios
│   ├── engine/
│   │   ├── scoring.js        # Deterministic multi-factor scoring formula & tie-breaker
│   │   ├── allocation.js     # Scaled demand & greedy supply allocation
│   │   └── templatePlan.js   # Deterministic fallback emergency action plan generator
│   ├── components/
│   │   ├── controls.js       # Scenario switcher & supply sliders with unapplied cue
│   │   ├── map.js            # Custom interactive SVG map with road hazard paths
│   │   ├── triageTable.js    # Ranked community list & "Why this ranking?" expander
│   │   ├── allocationTable.js# Resource distribution table & shortfall summary strip
│   │   └── actionPlan.js     # Action brief display, skeleton loader & badge renderer
│   └── services/
│       └── aiBriefing.js     # API client, placeholder hydration & strict validation guardrail
├── tests/
│   └── engine.test.js        # Node unit tests for scoring sum, ties, and allocation limits
└── devpost/                  # Devpost Learn artifacts
    ├── learner-profile.md
    ├── scope.md
    ├── scope.html
    ├── prd.md
    ├── prd.html
    ├── spec.md
    └── spec.html
```

## External Services and Dependencies
- **Server Dependencies**: Zero external npm dependencies. Uses standard Node.js libraries: `http`, `fs`, `path`, `url`.
- **External AI Model**: Google Gemini 1.5 Flash (or compatible endpoint).
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=...`
  - Auth: API key provided via `process.env.GEMINI_API_KEY` on the Node proxy server.
  - Rate Limits & Cost: Free tier supported (15 RPM / 1M TPM), negligible cost for local testing.
  - Timeout: 10 seconds client abort controller.

## Important Failure Modes
1. **Missing or Invalid AI API Key**:
   - *Failure*: No key set in `.env` or network disconnected.
   - *Behavior*: Server immediately signals fallback. `src/components/actionPlan.js` renders the deterministic template plan with badge `[Standard plan (AI unavailable)]`.
2. **Model Hallucinates Numbers or Invalid JSON**:
   - *Failure*: LLM output includes invalid schema, unmapped IDs, or raw unhydrated digits.
   - *Behavior*: Guardrail validator rejects response. Template fallback plan displays with badge `[Standard plan (AI output failed validation)]`.
3. **Severe Supply Deficit (Zero Stock)**:
   - *Failure*: Operator sets sliders to 0.
   - *Behavior*: Allocation engine assigns 0 to all communities, flags 100% unmet need with red badges, and action plan emphasizes evacuation and emergency mutual aid escalation.

## What Was Simplified and Why
- **Vanilla ES Modules over React/Vite**: Removed npm dependency installation, build tooling, and node_modules bloat. Keeps local testing immediate and demo recordings 100% stable.
- **Custom SVG over Leaflet/Mapbox Tiles**: Avoided third-party tile server latency, offline failure risks, and API key restrictions.
- **Placeholder Hydration over Free-text Fact Checking**: By having the LLM generate placeholders (`{{c1.food}}`) instead of numbers, we eliminate hallucinated resource counts by design.
- **Node Built-in Test Runner over Jest/Vitest**: Uses native `node --test` for zero setup and instant test execution.

## Decisions and Open Issues
- **Learner-Selected Stack**: Node.js zero-dependency static server + Vanilla ES modules frontend + Node test runner.
- **Learner-Selected AI Contract**: Structured JSON with variable placeholders; strict client-side hydration and digit allow-list validator.
- **Learner-Selected Demand Scaling**: `demand = baseline * (exposure / 40)` with a 25% floor so changing scenarios meaningfully shifts volumetric supply demand.
- **Uncertainties / Open Issues**: None. All mathematical formulas, schemas, guardrail rules, and failure modes are explicitly specified.
