/**
 * RescueGrid Scoring Engine
 * Deterministic multi-factor community risk scoring, factor breakdown, and tie-breaking.
 */

// Dataset normalization anchors (fixed for stability across scenarios)
export const MAX_VULNERABLE_POPULATION = 650;
export const MAX_DEPOT_DISTANCE_KM = 34;

export const ROAD_PENALTY_SCORES = {
  cut: 20.0,
  at_risk: 10.0,
  open: 0.0
};

/**
 * Round a number to exactly 1 decimal place.
 */
export function round1(num) {
  return Math.round(num * 10) / 10;
}

/**
 * Determine risk level, text label, and color-blind accessible icon.
 */
export function getRiskTier(totalScore) {
  if (totalScore >= 70) {
    return { tier: 'critical', label: 'Critical', icon: '✖', color: '#ef4444' };
  }
  if (totalScore >= 50) {
    return { tier: 'high', label: 'High', icon: '!', color: '#f97316' };
  }
  if (totalScore >= 30) {
    return { tier: 'moderate', label: 'Moderate', icon: '▲', color: '#f59e0b' };
  }
  return { tier: 'low', label: 'Low', icon: '✓', color: '#10b981' };
}

/**
 * Computes deterministic score and factor breakdown for a single community.
 */
export function scoreCommunity(community, scenarioId, roadsMap) {
  // 1. Exposure factor (0 - 40 pts)
  const rawExposure = community.scenarioExposure?.[scenarioId] ?? 0;
  const exposurePoints = round1(Math.min(40, Math.max(0, rawExposure)));

  // 2. Vulnerability factor (0 - 30 pts)
  const vulnRatio = Math.min(1, Math.max(0, community.vulnerable / MAX_VULNERABLE_POPULATION));
  const vulnerabilityPoints = round1(vulnRatio * 30);

  // 3. Road access penalty (0 - 20 pts)
  const road = roadsMap.get(community.accessRoadId);
  const roadStatus = road?.status?.[scenarioId] || 'open';
  const roadPoints = round1(ROAD_PENALTY_SCORES[roadStatus] ?? 0);

  // 4. Depot distance penalty (0 - 10 pts)
  const distRatio = Math.min(1, Math.max(0, community.depotDistanceKm / MAX_DEPOT_DISTANCE_KM));
  const distancePoints = round1(distRatio * 10);

  // Total score: sum of rounded factor points to guarantee exact sum
  const rawTotal = round1(exposurePoints + vulnerabilityPoints + roadPoints + distancePoints);
  const totalScore = round1(Math.min(100, Math.max(0, rawTotal)));

  const riskMeta = getRiskTier(totalScore);

  return {
    communityId: community.id,
    name: community.name,
    coords: community.coords,
    population: community.population,
    vulnerable: community.vulnerable,
    depotDistanceKm: community.depotDistanceKm,
    accessRoadId: community.accessRoadId,
    roadStatus,
    roadName: road?.name || 'Local Route',
    factors: {
      exposure: {
        name: 'Scenario Exposure',
        rawValue: rawExposure,
        weight: '40 pts max',
        points: exposurePoints
      },
      vulnerability: {
        name: 'Vulnerable Population',
        rawValue: community.vulnerable,
        weight: '30 pts max',
        points: vulnerabilityPoints
      },
      roadAccess: {
        name: 'Road Access Penalty',
        rawValue: roadStatus.replace('_', ' ').toUpperCase(),
        weight: '20 pts max',
        points: roadPoints
      },
      depotDistance: {
        name: 'Depot Distance Penalty',
        rawValue: `${community.depotDistanceKm} km`,
        weight: '10 pts max',
        points: distancePoints
      }
    },
    totalScore,
    riskTier: riskMeta.tier,
    riskLabel: riskMeta.label,
    riskIcon: riskMeta.icon,
    riskColor: riskMeta.color
  };
}

/**
 * Generate deterministic template explanation sentence for "Why this ranking?"
 */
export function generateFactorSummary(scored) {
  const roadText = scored.roadStatus === 'cut'
    ? 'cut off'
    : scored.roadStatus === 'at_risk'
      ? 'at severe risk'
      : 'open';

  const expLevel = scored.factors.exposure.points >= 30
    ? 'extreme'
    : scored.factors.exposure.points >= 20
      ? 'high'
      : scored.factors.exposure.points >= 10
        ? 'moderate'
        : 'low';

  return `Ranked #${scored.rank}: ${expLevel} hazard exposure (${scored.factors.exposure.points} pts) and ${scored.vulnerable} vulnerable residents (${scored.factors.vulnerability.points} pts), with access road ${roadText} (+${scored.factors.roadAccess.points} pts).`;
}

/**
 * Score all communities and rank them deterministically with tie-breaking.
 */
export function scoreAndRankCommunities(communities, roads, scenarioId) {
  const roadsMap = new Map(roads.map(r => [r.id, r]));

  const scoredList = communities.map(c => scoreCommunity(c, scenarioId, roadsMap));

  // Sort: totalScore DESC, then vulnerable DESC, then name ASC
  scoredList.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    if (b.vulnerable !== a.vulnerable) {
      return b.vulnerable - a.vulnerable;
    }
    return a.name.localeCompare(b.name);
  });

  // Assign ranks and generate summary sentence
  scoredList.forEach((item, index) => {
    item.rank = index + 1;
    item.summaryLine = generateFactorSummary(item);
  });

  return scoredList;
}
