---
doc: prd
status: approved
---

# RescueGrid — Product Requirements

A single-screen, high-density disaster response command console for district officials and NGO coordinators that computes deterministic multi-factor community risk, prioritizes scarce relief supply allocation, and provides auditable, verified emergency action plans.
Source: `scope.md > The Unique Kernel` and `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop` and `scope.md > What "Working" Looks Like`.

1. **Arrival & Initial Load**: The operator opens RescueGrid. The console immediately loads fully populated with the default scenario ("River Flood") and baseline relief stocks already simulated and rendered—no empty screen.
2. **Review Initial Operational Posture**: The operator inspects the interactive SVG district map, viewing 8 fictional communities with risk levels dual-encoded with colors and accessibility icons, along with labeled connecting roads.
3. **Scenario & Supply Adjustment**: The operator toggles the scenario (e.g., from River Flood to Cyclone Landfall) or adjusts relief supply sliders (Food packets, Drinking water units, Medical kits). The control panel displays a clear visual cue indicating unapplied modifications.
4. **Run Simulation**: The operator clicks "Run Simulation". Instantly, the deterministic core computes new risk scores, re-orders the community triage ranking, updates the map markers and road statuses, and calculates resource allocations with shortfall badges.
5. **AI Synthesis & Validation**: While the map and triage tables update immediately, the Action Plan panel enters a skeleton loading state ("Drafting action plan..."). The AI drafts a natural language operational brief detailing deployment priority order, hazardous routes, and watchpoints.
6. **Guardrail Check & Display**: The system verifies every figure in the narrative plan against the computed allocation table. If valid, the plan displays with an `"AI-drafted, validated against computed figures"` badge. If the call fails or figures mismatch, a template plan displays with `"Standard plan (AI unavailable)"` or `"Standard plan (AI output failed validation)"`.
7. **Spatial & Factor Inspection**: The operator clicks a community on the map or in the table. The cross-panel synchronization immediately highlights the community across both surfaces, reveals its mathematical factor breakdown ("Why this ranking?"), and highlights its allocated supplies and unmet deficits.

## Screens and Layout
Source: `scope.md > Design Direction`.

RescueGrid operates as a unified single-surface desktop command console arranged into four synchronized functional zones:

```
+---------------------------------------------------------------------------------------+
|  TOP BANNER: RescueGrid EOC | Scenario Name | Status | "SIMULATED DATA - TRAINING ONLY" |
+------------------+----------------------------------+---------------------------------+
| LEFT PANEL       | CENTER PANEL                     | RIGHT PANEL                     |
|                  |                                  |                                 |
| Scenario Select: | Interactive District SVG Map     | Community Triage Ranking        |
| - River Flood    | - 8 Community Nodes              | - Rank, Name, Score, Risk Badge |
| - Cyclone        |   (Color + Icon Dual-coded)      | - "Why this ranking?" Expander  |
|                  | - Road Network Links             |   (Factor points + Summary)     |
| Stock Sliders:   |   (Open / At Risk / Cut)         |                                 |
| - Food Packets   | - Depot Location Marker          | Resource Allocation Table       |
| - Water Units    | - Map Legend & Controls          | - Shortfall Summary Strip       |
| - Medical Kits   |                                  | - Need vs Allocated vs Gap      |
|                  |                                  | - Partial / Unmet Need Badges   |
| [Run Simulation] |                                  |                                 |
+------------------+----------------------------------+---------------------------------+
| BOTTOM PANEL                                                                          |
| Emergency Action Plan                                                                 |
| - Validation Status Badge (AI Validated vs Template Fallback)                         |
| - Priority Dispatch Order | Road & Access Directives | Strategic Watchpoints          |
+---------------------------------------------------------------------------------------+
```

## Look and Feel
Source: `scope.md > Design Direction` and `scope.md > Inspiration & Identity`.

- **Style**: Emergency Operations Center (EOC) Command Console. Serious, functional, high-contrast, uncluttered.
- **Palette**:
  - Base Surfaces: Deep navy (`#0a0f1d`), dark slate (`#111827`, `#1f2937`), and subtle borders (`#374151`).
  - Primary Accents: Deep teal (`#0d9488`) and cyan (`#06b6d4`) for controls, highlights, and active elements.
  - Risk Scale: Green (`#10b981`, Low), Amber (`#f59e0b`, Moderate), Orange (`#f97316`, High), Red (`#ef4444`, Critical). Red is strictly reserved for critical status and severe unmet needs.
- **Accessibility**: Dual-encoding across all statuses. Colors are accompanied by explicit text labels and distinct geometric symbols/icons (`[✓] Low`, `[▲] Med`, `[!] High`, `[✖] Crit`).
- **Typography**: Clean system/sans-serif font (Inter / IBM Plex Sans) with monospace tabular numerals for tables and allocations to prevent layout jitter.
- **Micro-interactions**: Crisp SVG transitions when markers update; skeleton shimmer for loading action plans; instantaneous cross-panel highlight synchronization.

## Features and Behavior

### 1. Scenario Selection & Resource Controls
Source: `scope.md > The Core Loop`.
- **Behavior**: The operator can select between two predefined scenarios ("River Flood", "Cyclone Landfall") and drag 3 resource sliders: Food packets (0–2000), Drinking water units (0–3000), Medical kits (0–500).
- **Unapplied Changes Cue**: When a slider or scenario is altered, the "Run Simulation" button highlights and an amber indicator states "Unapplied configuration changes".
- **Acceptance Criteria**:
  - [ ] Toggling between scenarios updates the default preset values and road hazard profiles.
  - [ ] Moving sliders dynamically updates the displayed numeric capacity in tabular figures.
  - [ ] Clicking "Run Simulation" clears the unapplied badge and updates all dashboard panels.

### 2. Interactive SVG District Map
Source: `scope.md > The POC Boundary (In)`.
- **Behavior**: Displays an embedded SVG map representing the fictional district with 8 distinct community nodes, 1 central supply depot, and inter-connecting road segments.
- **Node Dual-Coding**: Each node displays an icon and color corresponding to its computed risk tier.
- **Road Links**: Road lines are styled based on status (Solid Green = Open; Dashed Amber = At Risk; Dotted Red = Cut).
- **Interactions**:
  - Hovering a node displays a tooltip with community name, population, risk tier, and rank.
  - Hovering a road displays its status and the communities connected.
  - Clicking a node selects it: highlights the node, synchronizes selection to the matching triage table row, and scrolls/expands its factor breakdown.
  - Clicking empty canvas deselects the active community.
- **Acceptance Criteria**:
  - [ ] 100% vector SVG rendering with zero external tile server or internet dependencies.
  - [ ] Road styling matches scenario hazards (e.g. coastal routes cut during Cyclone, low-lying river routes cut during Flood).
  - [ ] Clicking a node highlights its corresponding row in both the triage and allocation tables.

### 3. Risk Scoring & "Why This Ranking?" Factor Breakdown
Source: `scope.md > The Unique Kernel`.
- **Behavior**: Communities are scored deterministically using 4 factors:
  1. *Scenario Exposure* (0–40 pts): Weather impact based on geographic zone and hazard type.
  2. *Vulnerable Population* (0–30 pts): Number of elderly and children requiring urgent assistance.
  3. *Road Access Penalty* (0–20 pts): Route impedance (Open = 0 pts; At Risk = 10 pts; Cut = 20 pts).
  4. *Depot Distance Penalty* (0–10 pts): Logistics transit difficulty.
- **Factor Breakdown Expander**: Each row in the ranked list has an expander showing:
  - Exact points contributed by each factor, summing identically to the displayed total score.
  - A deterministic template summary line (e.g., *"Ranked #2: high flood exposure and 340 vulnerable residents, with the access road at risk."*).
- **Acceptance Criteria**:
  - [ ] Triage table lists all 8 communities sorted strictly in descending order of total risk score.
  - [ ] Expanding "Why this ranking?" displays the exact point breakdown where component points equal the total score.
  - [ ] Plain-language summary sentence matches the factor values deterministically.

### 4. Priority Resource Allocation & Shortfall Tracking
Source: `scope.md > The POC Boundary (In)`.
- **Behavior**: Allocation engine uses a greedy priority algorithm: stock is distributed to communities in strict rank order based on their baseline population demand until supplies are exhausted.
- **Shortfall Summary Strip**: Banner directly above the allocation table shows total district deficit per resource (e.g., *"Medical kits: 120 of 300 needed (180 short)"*).
- **Table Data**: Each row lists Community Name, Resource Type, Needed Units, Allocated Units, and Gap.
- **Status Badges**:
  - `[✓] Fully Allocated` (Green badge) if Gap = 0.
  - `[▲] Partial` (Amber badge) if 0 < Allocated < Needed.
  - `[✖] Unmet Need` (Red badge) if Allocated = 0 and Needed > 0.
- **Acceptance Criteria**:
  - [ ] If available stock is less than total needed, higher-ranked communities receive inventory before lower-ranked communities.
  - [ ] Total allocated across all rows never exceeds the slider capacity.
  - [ ] Unsupplied communities explicitly show the red `[✖] Unmet Need` badge and the exact numeric gap.

### 5. AI Emergency Action Plan & Fallback Guardrail
Source: `scope.md > The Unique Kernel` and `scope.md > The POC Boundary (In)`.
- **Behavior**: Action plan panel generates a 3-part operational directive:
  1. *Immediate Deployment Priorities*: Specific communities to dispatch to first and why.
  2. *Route Alerts & Hazardous Corridors*: Warnings on cut or threatened roads and secondary routing.
  3. *Critical Watchpoints*: Identified shortfalls and high-risk populations.
- **Validation Guardrail**: Every numerical quantity mentioned in the AI response is validated against the computed allocation table.
- **Fallback Engine**:
  - If the AI request times out/fails, or if numerical validation fails, the UI immediately displays a pre-computed deterministic template plan.
  - If valid AI: displays badge `[AI-drafted, validated against computed figures]`.
  - If fallback due to API: displays badge `[Standard plan (AI unavailable)]`.
  - If fallback due to validation failure: displays badge `[Standard plan (AI output failed validation)]`.
- **Acceptance Criteria**:
  - [ ] Skeleton loading state displays while AI generation is pending, without freezing other panels.
  - [ ] An AI response mentioning incorrect numbers is rejected and replaced with the validated template plan.
  - [ ] The app never displays an unvalidated plan or raw API error message to the operator.

## States and Boundaries

- **First Load / Default State**: Console opens with "River Flood" scenario active, baseline stocks set, and full simulation already rendered across map, tables, and action plan.
- **Unapplied Changes State**: Sliders/scenario changed; controls indicate pending simulation; existing dashboard remains visible until "Run Simulation" is clicked.
- **Simulation Re-computing State**: Map and tables update instantaneously (<50ms). Action plan panel displays skeleton loader with "Drafting action plan...".
- **Selected Entity State**: Clicking node or table row sets active state; draws glowing border on map node, highlights corresponding rows in triage and allocation tables, and auto-expands "Why this ranking?".
- **Grounding Failure / Fallback State**: Deterministic template plan renders with amber notification badge explaining why fallback was activated.
- **Zero-Stock Extreme State**: If an operator sets all sliders to 0, allocation shows 100% unmet need with red badges; action plan advises immediate evacuation and emergency stock escalation.

## Product Decisions

- **Single Desktop Surface vs Tabs**: Kept all 4 core components on a single viewport layout to give EOC operators instant situational awareness without tab switching.
- **Deterministic Factor Summary vs AI Factor Summary**: The single-line summary inside "Why this ranking?" is generated via deterministic template logic rather than AI, guaranteeing instantaneous response and 100% mathematical consistency.
- **Custom SVG vs Mapbox/Leaflet**: Adopted custom SVG to eliminate external API tokens, map tile network requests, and rate limit risks during demonstrations.
- **Template Fallback vs Error Modal**: Replaced error messages with a deterministic fallback plan, ensuring the operator always has an actionable brief even during offline or LLM failure conditions.

## What We're Building
- Single-page application with four synchronized panels.
- 2 simulated scenarios (River Flood, Cyclone Landfall) with 8 fictional communities and 1 central depot.
- Rule-based risk scoring formula (Exposure, Vulnerability, Road Status, Distance).
- Greedy supply allocation engine (Food, Water, Medical kits) with shortfall calculation.
- Offline custom SVG map with interactive node selection, dual-coded pins, and road statuses.
- AI emergency action plan with strict numerical grounding validation.
- Template-based plan fallback engine.
- Color-blind accessible indicators with text labels and geometric icons.
- Simulated data banner.

## Deferred From the POC
- Custom scenario editor: Users cannot edit community baseline populations or add new roads.
- Multi-district comparison: Console models one 8-community district.
- PDF / Print export: Operators inspect and copy the plan directly on-screen.

## Possible Later Enhancements
- Historical incident replay to compare simulated outcomes against real disaster reports.
- Real-time weather telemetry ingest from IMD or state hydrological departments.
- Automated SMS/radio broadcast formatting for field teams.

## Non-Goals
- Real GIS / shapefile ingest: Fictional coordinates in SVG provide total control and zero dependencies.
- User accounts and authentication: Unnecessary for a local single-operator demonstration.
- Live database persistence: State is managed in memory and resets cleanly on reload.
- Mobile phone layout: Designed specifically for desktop command console viewports.

## Open Questions
None blocking technical specification. All core product journeys, layout zones, mathematical formulas, and fallback behaviors are defined.
