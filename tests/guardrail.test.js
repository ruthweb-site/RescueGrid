import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { scoreAndRankCommunities } from '../src/engine/scoring.js';
import { allocateResources } from '../src/engine/allocation.js';
import { validateAndHydrateBriefing } from '../src/services/aiBriefing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load district dataset fixture
const districtData = JSON.parse(readFileSync(join(__dirname, '../src/data/district.json'), 'utf8'));
const { communities, roads } = districtData;

describe('RescueGrid AI Action Plan Guardrail Validator', () => {
  const scenarioId = 'flood';
  const stock = { food: 850, water: 1400, medical: 180 };
  const ranked = scoreAndRankCommunities(communities, roads, scenarioId);
  const allocation = allocateResources(ranked, scenarioId, stock);

  // Top communities in flood scenario are c1, c4, c5
  const top1 = ranked[0].communityId;
  const top2 = ranked[1].communityId;
  const top3 = ranked[2].communityId;

  test('Valid structured JSON with placeholders passes validation and hydrates computed numbers', () => {
    const validModelOutput = {
      immediate: [
        { communityId: top1, action: `Priority #1: Dispatch {{${top1}.food}} food packets and {{${top1}.water}} water units to support {{${top1}.vulnerable}} residents.` },
        { communityId: top2, action: `Priority #2: Deploy convoy carrying {{${top2}.medical}} medical kits.` }
      ],
      routeAlerts: [
        { roadId: 'r1', advice: 'Northern Valley Highway is cut. Route relief via air or boat.' }
      ],
      watchpoints: [
        'Watch for rising flood levels along secondary river embankments.'
      ]
    };

    const res = validateAndHydrateBriefing(validModelOutput, ranked, roads, allocation);
    assert.equal(res.valid, true, `Expected valid result but got: ${res.reason}`);
    assert.equal(res.hydrated.source, 'ai_validated');
    assert.equal(res.hydrated.badge.text, 'AI-drafted, validated against computed figures');

    // Confirm placeholders were replaced with actual numbers
    const top1AllocFood = allocation.byCommunity.find(c => c.communityId === top1).resources.food.allocated;
    assert.ok(res.hydrated.immediate[0].action.includes(`${top1AllocFood} food packets`));
    assert.ok(!res.hydrated.immediate[0].action.includes('{{'));
  });

  test('REJECTS model output containing invented / ungrounded numbers in free text', () => {
    const hallucinatedOutput = {
      immediate: [
        { communityId: top1, action: 'Priority #1: Dispatch 99999 invented emergency crates immediately.' }
      ],
      routeAlerts: [],
      watchpoints: []
    };

    const res = validateAndHydrateBriefing(hallucinatedOutput, ranked, roads, allocation);
    assert.equal(res.valid, false, 'Expected guardrail rejection for invented number');
    assert.ok(res.reason.includes('Unallowlisted raw digit'), `Expected digit rejection reason, got: ${res.reason}`);
  });

  test('REJECTS model output with triage rank order violation', () => {
    // Intentionally invert order: place Rank #3 before Rank #1
    const invertedRankOutput = {
      immediate: [
        { communityId: top3, action: `Dispatch {{${top3}.food}} food units.` },
        { communityId: top1, action: `Dispatch {{${top1}.food}} food units.` }
      ],
      routeAlerts: [],
      watchpoints: []
    };

    const res = validateAndHydrateBriefing(invertedRankOutput, ranked, roads, allocation);
    assert.equal(res.valid, false, 'Expected guardrail rejection for rank order violation');
    assert.ok(res.reason.includes('Rank order violation'), `Expected rank order violation reason, got: ${res.reason}`);
  });

  test('REJECTS model output with non-existent community ID', () => {
    const invalidIdOutput = {
      immediate: [
        { communityId: 'c99_unknown', action: 'Dispatch relief supplies.' }
      ],
      routeAlerts: [],
      watchpoints: []
    };

    const res = validateAndHydrateBriefing(invalidIdOutput, ranked, roads, allocation);
    assert.equal(res.valid, false);
    assert.ok(res.reason.includes('Invalid or unknown communityId'));
  });

  test('REJECTS model output with non-existent road ID', () => {
    const invalidRoadOutput = {
      immediate: [
        { communityId: top1, action: `Dispatch {{${top1}.food}} units.` }
      ],
      routeAlerts: [
        { roadId: 'r99_unknown', advice: 'Avoid this road.' }
      ],
      watchpoints: []
    };

    const res = validateAndHydrateBriefing(invalidRoadOutput, ranked, roads, allocation);
    assert.equal(res.valid, false);
    assert.ok(res.reason.includes('Invalid or unknown roadId'));
  });

  test('REJECTS model output with unmapped variable placeholder', () => {
    const invalidPlaceholderOutput = {
      immediate: [
        { communityId: top1, action: 'Dispatch {{c1.gold_bars}} units.' }
      ],
      routeAlerts: [],
      watchpoints: []
    };

    const res = validateAndHydrateBriefing(invalidPlaceholderOutput, ranked, roads, allocation);
    assert.equal(res.valid, false);
    assert.ok(res.reason.includes('Unknown placeholder'));
  });
});
