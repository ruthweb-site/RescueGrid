---
doc: scope
status: approved
---

# RescueGrid

A simulated disaster response decision-support dashboard that combines deterministic risk scoring and supply allocation with AI-generated emergency action plans.

## The Unique Kernel
The deterministic, auditable boundary between math and AI: risk scoring and resource allocation are computed strictly via transparent, rule-based algorithms, while the AI only synthesizes, explains, and drafts human-readable emergency directives. The AI's narrative plan is validated against the computed numbers so it cannot hallucinate or invent inventory.

## Who It's For
A district disaster management official or NGO response coordinator preparing relief operations before or during a severe weather event. Today, they scramble across spreadsheets, fragmented communications, and manual triage notes with little time to explain prioritization decisions to leadership or field teams.

## The Core Loop
The official opens the dashboard $\rightarrow$ selects a disaster scenario (River Flood or Cyclone Landfall) $\rightarrow$ adjusts available relief supply stocks via sliders $\rightarrow$ clicks "Run Simulation" $\rightarrow$ inspects the risk-colored district map, factor breakdown ("Why this ranking?"), and allocated supply table $\rightarrow$ reviews the AI-generated emergency action plan detailing deployment order, compromised access routes, and watchpoints.

They rerun or tweak supply levels to see immediate, cascading updates across the map, allocation, and action plan.

## Inspiration & Identity
- Feel: Emergency Operations Center (EOC) Command Console. High contrast, mission-critical, crisp data density, trustworthy, zero clutter.
- Tone: Calm, authoritative, operational, objective.
- Prominent banner: Clear notice indicating "Simulated Data — For Demonstration and Training Only".

## Design Direction
- **Look and feel**: Clean, serious, high-contrast dashboard. Think emergency operations center, not a startup landing page.
- **Palette**: Deep navy and slate for the base, teal for primary actions, and a calibrated risk scale of green, amber, orange, and red for map zones and scores. Use red strictly for critical status so it maintains high signal value.
- **Accessibility**: Risk levels must be accompanied by explicit text labels and distinct icons/shapes alongside color coding, ensuring full accessibility for color-blind operators and high-stress scanning.
- **Typography**: Clean sans-serif (Inter or IBM Plex Sans) with tabular numerals for data and allocation tables.
- **Layout**: Scenario controls on the left, interactive map in the center, ranked communities and allocation on the right, and the AI action plan panel below. Includes a visible "Simulated Data" banner and a clear "Why this ranking?" expander.
- **Polish**: Smooth transitions when scenarios shift, crisp loading states for AI synthesis, and a graceful fallback plan if the AI call fails. Polish is concentrated in interface quality, not feature bloat.

## Why This Matters to the Learner
To build a working, end-to-end proof of concept with rock-solid planning docs (`scope.md`, `prd.md`, `spec.md`), and to practice maintaining rigorous agent consistency across a multi-stage build without losing state or repeating mistakes.

## What "Working" Looks Like
A browser app running locally where changing the scenario or sliding supply levels immediately updates:
1. An interactive custom SVG district map of 8 communities with risk-coded markers, icons, and route status.
2. A prioritized community ranking list with a clear "Why this ranking?" factor breakdown.
3. A transparent resource allocation table showing distribution of food packets, drinking water, and medical kits.
4. An AI-generated plain-language action plan with deployment priorities, road warnings, and rationale—verifiably grounded in the computed simulation numbers.
5. A deterministic template-based fallback plan that activates automatically if the AI call fails or fails numerical validation.
The "wow" moment: cutting supplies in half or flipping from Flood to Cyclone and watching the map, triage table, and AI brief re-align instantly and explain why priority shifted.

## The POC Boundary (In)
- Two predefined scenarios: River Flood and Cyclone Landfall.
- Fictional district with 8 diverse communities (population, scenario exposure, vulnerable demographic count, road status, depot distance, map coordinates).
- Three supply resources: food packets, drinking water units, medical kits.
- In-memory static JSON dataset.
- Rule-based multi-factor risk scoring formula.
- Greedy priority supply allocation algorithm.
- Custom SVG map of the fictional district (100% offline, zero external tile dependencies, zero rate limits, instantaneous rendering, zero network demo failure risk).
- AI-generated emergency action plan and ranking rationale with strict numerical validation against computed quantities.
- Template-based fallback plan: If the AI call fails or validation detects any quantity mismatch against computed allocation numbers, the app seamlessly displays a deterministic template plan instead of an error. The app must never display an AI plan that contradicts the allocation table.
- Accessible indicator design: Multi-factor risk indicators use dual encoding (color + text badge/icon) for color-blind usability.
- Prominent "Simulated Data" banner.

## Later
- Real external data feeds (IMD weather forecasts, state flood telemetry).
- Multi-district coverage.
- PDF export of official emergency action briefs.
- Custom scenario builder / editor.

## Explicitly Cut
- Live external APIs and shapefile GIS ingest: Unnecessary complexity for a 2–4 hour PoC.
- Authentication & user management: Single-operator local PoC.
- Database / persistence: In-memory state and local JSON are sufficient.
- Multi-user collaboration & real-time websockets: Overkill for demonstrating the core loop.
- Mobile layout: Desktop command console layout prioritized for dense operational view.
