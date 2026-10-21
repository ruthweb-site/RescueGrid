/**
 * RescueGrid AI Action Briefing Service & Guardrail Validator
 * Enforces strict schema, triage rank order, and digit allow-list checks, then hydrates variable placeholders.
 */

/**
 * Validates model JSON against strict RescueGrid safety invariants.
 * @param {object} parsed - Parsed JSON object from model
 * @param {Array} rankedCommunities - Currently computed community triage ranking
 * @param {Array} roads - District roads
 * @param {object} allocationResult - Computed resource allocation matrix
 * @returns {object} { valid: boolean, reason?: string, hydrated?: object }
 */
export function validateAndHydrateBriefing(parsed, rankedCommunities, roads, allocationResult) {
  // 1. Basic Schema Validation
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, reason: 'Invalid JSON root object' };
  }
  if (!Array.isArray(parsed.immediate) || parsed.immediate.length === 0) {
    return { valid: false, reason: 'Missing or empty "immediate" array' };
  }
  if (!Array.isArray(parsed.routeAlerts)) {
    return { valid: false, reason: 'Missing "routeAlerts" array' };
  }
  if (!Array.isArray(parsed.watchpoints)) {
    return { valid: false, reason: 'Missing "watchpoints" array' };
  }

  const validCommunityIds = new Set(rankedCommunities.map(c => c.communityId));
  const validRoadIds = new Set(roads.map(r => r.id));
  const communityRankMap = new Map(rankedCommunities.map(c => [c.communityId, c.rank]));

  // 2. Immediate Sequence Rank Order & ID Validation
  let lastRank = 0;
  for (const item of parsed.immediate) {
    if (!item.communityId || !validCommunityIds.has(item.communityId)) {
      return { valid: false, reason: `Invalid or unknown communityId: ${item.communityId}` };
    }
    if (typeof item.action !== 'string' || !item.action.trim()) {
      return { valid: false, reason: `Empty action string for community: ${item.communityId}` };
    }

    const currentRank = communityRankMap.get(item.communityId);
    if (currentRank < lastRank) {
      return { valid: false, reason: `Rank order violation: community ${item.communityId} (rank #${currentRank}) appeared after rank #${lastRank}` };
    }
    lastRank = currentRank;
  }

  // 3. Route Alerts Validation
  for (const alert of parsed.routeAlerts) {
    if (!alert.roadId || !validRoadIds.has(alert.roadId)) {
      return { valid: false, reason: `Invalid or unknown roadId: ${alert.roadId}` };
    }
    if (typeof alert.advice !== 'string' || !alert.advice.trim()) {
      return { valid: false, reason: `Empty advice for road: ${alert.roadId}` };
    }
  }

  // 4. Build hydration dictionary from computed allocations
  // Dictionary format: { 'c1.food': 120, 'c1.water': 240, 'c1.medical': 30, 'c1.vulnerable': 420 }
  const computedValues = new Map();
  for (const comm of allocationResult.byCommunity) {
    const cid = comm.communityId;
    computedValues.set(`${cid}.food`, comm.resources.food.allocated);
    computedValues.set(`${cid}.water`, comm.resources.water.allocated);
    computedValues.set(`${cid}.medical`, comm.resources.medical.allocated);
    computedValues.set(`${cid}.food_need`, comm.resources.food.needed);
    computedValues.set(`${cid}.water_need`, comm.resources.water.needed);
    computedValues.set(`${cid}.medical_need`, comm.resources.medical.needed);
  }
  for (const c of rankedCommunities) {
    computedValues.set(`${c.communityId}.vulnerable`, c.vulnerable);
    computedValues.set(`${c.communityId}.population`, c.population);
  }

  // Helper to hydrate placeholders and check for unvetted digits
  const hydrateText = (rawText) => {
    // Check all placeholders of form {{key}}
    const placeholderRegex = /\{\{([a-zA-Z0-9_.-]+)\}\}/g;
    let hasInvalidPlaceholder = false;

    const hydrated = rawText.replace(placeholderRegex, (match, key) => {
      if (computedValues.has(key)) {
        return computedValues.get(key).toString();
      }
      hasInvalidPlaceholder = true;
      return match;
    });

    if (hasInvalidPlaceholder) {
      return { error: 'Unknown placeholder in text' };
    }

    // Guardrail: Digit allow-list check
    // Allowable digits: community ranks (1..8) or digits that were legitimately injected from computedValues.
    // To verify, we strip out allowlisted numbers and check if any arbitrary multi-digit numbers remain.
    const remainingDigits = hydrated
      .replace(/\b#?[1-8]\b/g, '') // allow single digit ranks 1-8
      .replace(new RegExp(`\\b(${Array.from(computedValues.values()).join('|')})\\b`, 'g'), '') // allow computed values
      .replace(/\b(19|20)\d{2}\b/g, ''); // allow years if any

    // If an arbitrary number like "9999" or "500" was invented by the LLM in free text
    const inventedDigitMatch = remainingDigits.match(/\b\d{2,}\b/);
    if (inventedDigitMatch) {
      return { error: `Unallowlisted raw digit found in text: "${inventedDigitMatch[0]}"` };
    }

    return { text: hydrated };
  };

  // 5. Hydrate Immediate Action Items
  const hydratedImmediate = [];
  for (const item of parsed.immediate) {
    const res = hydrateText(item.action);
    if (res.error) {
      return { valid: false, reason: `Validation error in immediate action: ${res.error}` };
    }
    const comm = rankedCommunities.find(c => c.communityId === item.communityId);
    hydratedImmediate.push({
      communityId: item.communityId,
      rank: communityRankMap.get(item.communityId),
      communityName: comm?.name || item.communityId,
      action: res.text
    });
  }

  // 6. Hydrate Route Alerts
  const hydratedRouteAlerts = [];
  for (const alert of parsed.routeAlerts) {
    const res = hydrateText(alert.advice);
    if (res.error) {
      return { valid: false, reason: `Validation error in route advice: ${res.error}` };
    }
    const road = roads.find(r => r.id === alert.roadId);
    hydratedRouteAlerts.push({
      roadId: alert.roadId,
      roadName: road?.name || alert.roadId,
      status: 'ADVISORY',
      statusColor: '#38bdf8',
      advice: res.text
    });
  }

  // 7. Hydrate Watchpoints
  const hydratedWatchpoints = [];
  for (const wp of parsed.watchpoints) {
    if (typeof wp !== 'string' || !wp.trim()) continue;
    const res = hydrateText(wp);
    if (res.error) {
      return { valid: false, reason: `Validation error in watchpoint: ${res.error}` };
    }
    hydratedWatchpoints.push(res.text);
  }

  return {
    valid: true,
    hydrated: {
      source: 'ai_validated',
      badge: {
        text: 'AI-drafted, validated against computed figures',
        type: 'ai_valid',
        color: '#34d399'
      },
      immediate: hydratedImmediate,
      routeAlerts: hydratedRouteAlerts,
      watchpoints: hydratedWatchpoints
    }
  };
}

/**
 * Request briefing from proxy server.
 * Inspects URL query params for ?ai=off or ?ai=bad testing hooks.
 */
export async function fetchAIBriefing(scenarioId, rankedCommunities, roads, allocationResult) {
  // Check URL hooks
  const urlParams = new URLSearchParams(window.location.search);
  const testHook = urlParams.get('ai'); // 'off' or 'bad'

  const payload = {
    scenarioId,
    testHook,
    communities: rankedCommunities.map(c => ({
      id: c.communityId,
      name: c.name,
      rank: c.rank,
      population: c.population,
      vulnerable: c.vulnerable,
      totalScore: c.totalScore,
      roadStatus: c.roadStatus,
      allocated: {
        food: allocationResult.byCommunity.find(x => x.communityId === c.communityId)?.resources.food.allocated || 0,
        water: allocationResult.byCommunity.find(x => x.communityId === c.communityId)?.resources.water.allocated || 0,
        medical: allocationResult.byCommunity.find(x => x.communityId === c.communityId)?.resources.medical.allocated || 0
      }
    })),
    roads: roads.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status?.[scenarioId] || 'open'
    }))
  };

  const response = await fetch('/api/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from briefing proxy`);
  }

  return await response.json();
}
