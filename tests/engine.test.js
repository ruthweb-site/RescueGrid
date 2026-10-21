import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  scoreCommunity,
  scoreAndRankCommunities,
  round1
} from '../src/engine/scoring.js';
import {
  calculateCommunityDemand,
  allocateResources
} from '../src/engine/allocation.js';
import {
  generateTemplatePlan
} from '../src/engine/templatePlan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load static district test fixture
const districtData = JSON.parse(readFileSync(join(__dirname, '../src/data/district.json'), 'utf8'));
const { communities, roads, scenarios } = districtData;

describe('RescueGrid Deterministic Scoring Engine', () => {
  test('Factor points must sum IDENTICALLY to totalScore for every community in flood scenario', () => {
    const roadsMap = new Map(roads.map(r => [r.id, r]));
    for (const c of communities) {
      const scored = scoreCommunity(c, 'flood', roadsMap);
      const factorSum = round1(
        scored.factors.exposure.points +
        scored.factors.vulnerability.points +
        scored.factors.roadAccess.points +
        scored.factors.depotDistance.points
      );
      assert.equal(scored.totalScore, factorSum, `Community ${c.name} total score (${scored.totalScore}) must equal factor points sum (${factorSum})`);
      assert.ok(scored.totalScore >= 0 && scored.totalScore <= 100, `Score out of bounds: ${scored.totalScore}`);
    }
  });

  test('Factor points must sum IDENTICALLY to totalScore for every community in cyclone scenario', () => {
    const roadsMap = new Map(roads.map(r => [r.id, r]));
    for (const c of communities) {
      const scored = scoreCommunity(c, 'cyclone', roadsMap);
      const factorSum = round1(
        scored.factors.exposure.points +
        scored.factors.vulnerability.points +
        scored.factors.roadAccess.points +
        scored.factors.depotDistance.points
      );
      assert.equal(scored.totalScore, factorSum, `Community ${c.name} cyclone score mismatch`);
    }
  });

  test('scoreAndRankCommunities sorts strictly in descending risk score order with deterministic tie-breaking', () => {
    const rankedFlood = scoreAndRankCommunities(communities, roads, 'flood');
    assert.equal(rankedFlood.length, 8);

    for (let i = 0; i < rankedFlood.length - 1; i++) {
      const curr = rankedFlood[i];
      const next = rankedFlood[i + 1];
      assert.ok(curr.totalScore >= next.totalScore, `Rank ${curr.rank} score (${curr.totalScore}) must be >= Rank ${next.rank} score (${next.totalScore})`);
      if (curr.totalScore === next.totalScore) {
        assert.ok(curr.vulnerable >= next.vulnerable, `Tie break by vulnerability count failed between ${curr.name} and ${next.name}`);
      }
    }

    // Verify ranks are 1 through 8
    rankedFlood.forEach((item, idx) => {
      assert.equal(item.rank, idx + 1);
      assert.ok(item.summaryLine.includes(`Ranked #${item.rank}`));
    });
  });

  test('Switching scenario alters community ranks (coastal vs river communities)', () => {
    const floodRanked = scoreAndRankCommunities(communities, roads, 'flood');
    const cycloneRanked = scoreAndRankCommunities(communities, roads, 'cyclone');

    // River basin (c1) should rank higher in flood than in cyclone
    const c1FloodRank = floodRanked.find(c => c.communityId === 'c1').rank;
    const c1CycloneRank = cycloneRanked.find(c => c.communityId === 'c1').rank;
    assert.ok(c1FloodRank < c1CycloneRank, `Alathur Basin should rank higher in flood (rank ${c1FloodRank}) than cyclone (rank ${c1CycloneRank})`);

    // Coastal hamlet (c2) should rank higher in cyclone than in flood
    const c2FloodRank = floodRanked.find(c => c.communityId === 'c2').rank;
    const c2CycloneRank = cycloneRanked.find(c => c.communityId === 'c2').rank;
    assert.ok(c2CycloneRank < c2FloodRank, `Nagore Coastal should rank higher in cyclone (rank ${c2CycloneRank}) than flood (rank ${c2FloodRank})`);
  });
});

describe('RescueGrid Resource Allocation Engine', () => {
  test('Scenario exposure scales demand with minimum floor', () => {
    const c1 = communities.find(c => c.id === 'c1');
    const floodDemand = calculateCommunityDemand(c1, 'flood');
    const cycloneDemand = calculateCommunityDemand(c1, 'cyclone');

    // Flood exposure is 39/40, cyclone exposure is 12/40 for c1
    assert.ok(floodDemand.food > cycloneDemand.food, 'Flood food demand must exceed cyclone food demand for river basin');
    assert.ok(floodDemand.water > cycloneDemand.water, 'Flood water demand must exceed cyclone water demand');
    assert.ok(cycloneDemand.food >= 10, 'Minimum demand floor respected');
  });

  test('Total allocated resources NEVER exceed available stock', () => {
    const ranked = scoreAndRankCommunities(communities, roads, 'flood');
    const testStocks = [
      { food: 0, water: 0, medical: 0 },
      { food: 200, water: 400, medical: 50 },
      { food: 850, water: 1400, medical: 180 },
      { food: 5000, water: 8000, medical: 1000 }
    ];

    for (const stock of testStocks) {
      const result = allocateResources(ranked, 'flood', stock);
      assert.ok(result.summary.food.allocated <= stock.food, `Allocated food (${result.summary.food.allocated}) exceeded stock (${stock.food})`);
      assert.ok(result.summary.water.allocated <= stock.water, `Allocated water (${result.summary.water.allocated}) exceeded stock (${stock.water})`);
      assert.ok(result.summary.medical.allocated <= stock.medical, `Allocated medical (${result.summary.medical.allocated}) exceeded stock (${stock.medical})`);
    }
  });

  test('Allocation distributes greedy-by-rank with correct partial boundary allocation', () => {
    const ranked = scoreAndRankCommunities(communities, roads, 'flood');
    // Set stock just enough to fully supply rank 1 and partially supply rank 2
    const rank1Demand = calculateCommunityDemand(ranked[0], 'flood');
    const rank2Demand = calculateCommunityDemand(ranked[1], 'flood');

    const exactStock = {
      food: rank1Demand.food + Math.floor(rank2Demand.food / 2),
      water: rank1Demand.water + 10,
      medical: rank1Demand.medical
    };

    const result = allocateResources(ranked, 'flood', exactStock);
    const comm1 = result.byCommunity.find(c => c.communityId === ranked[0].communityId);
    const comm2 = result.byCommunity.find(c => c.communityId === ranked[1].communityId);
    const comm3 = result.byCommunity.find(c => c.communityId === ranked[2].communityId);

    // Rank 1 gets full food allocation
    assert.equal(comm1.resources.food.status, 'fully_allocated');
    assert.equal(comm1.resources.food.allocated, rank1Demand.food);
    assert.equal(comm1.resources.food.gap, 0);

    // Rank 2 gets partial food allocation
    assert.equal(comm2.resources.food.status, 'partial');
    assert.equal(comm2.resources.food.allocated, Math.floor(rank2Demand.food / 2));
    assert.equal(comm2.resources.food.gap, rank2Demand.food - Math.floor(rank2Demand.food / 2));

    // Rank 3 gets 0 food
    assert.equal(comm3.resources.food.status, 'unmet_need');
    assert.equal(comm3.resources.food.allocated, 0);
  });

  test('Shortfall calculation equals totalNeeded minus totalAllocated', () => {
    const ranked = scoreAndRankCommunities(communities, roads, 'flood');
    const stock = { food: 500, water: 800, medical: 100 };
    const result = allocateResources(ranked, 'flood', stock);

    for (const key of ['food', 'water', 'medical']) {
      const expectedShortfall = Math.max(0, result.summary[key].needed - result.summary[key].allocated);
      assert.equal(result.summary[key].shortfall, expectedShortfall, `Shortfall calculation mismatch for ${key}`);
    }
  });
});

describe('RescueGrid Template Emergency Plan Engine', () => {
  test('Generates verified template fallback plan with top ranked priorities and shortfall watchpoints', () => {
    const ranked = scoreAndRankCommunities(communities, roads, 'flood');
    const stock = { food: 850, water: 1400, medical: 180 };
    const alloc = allocateResources(ranked, 'flood', stock);

    const plan = generateTemplatePlan(ranked, alloc, roads, 'flood', 'unavailable');

    assert.equal(plan.source, 'template_fallback');
    assert.equal(plan.badge.text, 'Standard plan (AI unavailable)');
    assert.equal(plan.immediate.length, 3, 'Immediate list must cover top 3 ranked communities');
    assert.ok(plan.immediate[0].action.includes(`Priority #${ranked[0].rank}`));
    assert.ok(plan.routeAlerts.length > 0, 'Must include route alerts for cut/at-risk roads');
    assert.ok(plan.watchpoints.length > 0, 'Must include watchpoints for shortfalls');
  });

  test('Applies validation_failed badge when triggered by guardrail failure', () => {
    const ranked = scoreAndRankCommunities(communities, roads, 'flood');
    const alloc = allocateResources(ranked, 'flood', { food: 100, water: 100, medical: 20 });
    const plan = generateTemplatePlan(ranked, alloc, roads, 'flood', 'validation_failed');

    assert.equal(plan.badge.text, 'Standard plan (AI output failed validation)');
  });
});
