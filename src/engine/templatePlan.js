/**
 * RescueGrid Template Emergency Plan Engine
 * Generates verified, mathematically consistent fallback action plans without LLM dependency.
 */

export function generateTemplatePlan(rankedCommunities, allocationResult, roads, scenarioName, reason = 'unavailable') {
  const badgeText = reason === 'validation_failed'
    ? 'Standard plan (AI output failed validation)'
    : 'Standard plan (AI unavailable)';

  // 1. Immediate Deployment Priorities (Top 3 ranked communities)
  const topCommunities = rankedCommunities.slice(0, 3);
  const immediate = topCommunities.map(c => {
    const alloc = allocationResult.byCommunity.find(item => item.communityId === c.communityId);
    const food = alloc?.resources.food.allocated || 0;
    const water = alloc?.resources.water.allocated || 0;
    const med = alloc?.resources.medical.allocated || 0;

    let routeNote = '';
    if (c.roadStatus === 'cut') {
      routeNote = ` Access road ${c.roadName} is CUT — deploy via specialized all-terrain or watercraft transport.`;
    } else if (c.roadStatus === 'at_risk') {
      routeNote = ` Caution: Access road ${c.roadName} is AT RISK of imminent failure.`;
    }

    return {
      communityId: c.communityId,
      rank: c.rank,
      communityName: c.name,
      action: `Priority #${c.rank}: Dispatch initial convoy with ${food} food packets, ${water} water units, and ${med} medical kits to support ${c.vulnerable} vulnerable residents.${routeNote}`
    };
  });

  // 2. Route Alerts & Hazardous Corridors
  const routeAlerts = [];
  const hazardousRoads = roads.filter(r => r.status?.[scenarioName.toLowerCase()] === 'cut' || r.status?.[scenarioName.toLowerCase()] === 'at_risk');

  for (const road of hazardousRoads) {
    const status = road.status[scenarioName.toLowerCase()];
    if (status === 'cut') {
      routeAlerts.push({
        roadId: road.id,
        roadName: road.name,
        status: 'CUT',
        statusColor: '#ef4444',
        advice: `Corridor ${road.name} is severed. Suspend conventional vehicle movement; establish alternative transshipment depot.`
      });
    } else if (status === 'at_risk') {
      routeAlerts.push({
        roadId: road.id,
        roadName: road.name,
        status: 'AT RISK',
        statusColor: '#f59e0b',
        advice: `Corridor ${road.name} under threat of inundation/blockage. Expedite priority relief dispatches before route failure.`
      });
    }
  }

  // 3. Strategic Watchpoints (Shortfalls and unsupplied communities)
  const watchpoints = [];
  const summary = allocationResult.summary;

  if (summary.food.shortfall > 0) {
    watchpoints.push(`Food supply deficit: District requires ${summary.food.needed} packets; current stock leaves a shortfall of ${summary.food.shortfall} packets.`);
  }
  if (summary.water.shortfall > 0) {
    watchpoints.push(`Potable water deficit: ${summary.water.shortfall} units short of district minimum requirements (${summary.water.needed} needed).`);
  }
  if (summary.medical.shortfall > 0) {
    watchpoints.push(`Critical medical triage gap: ${summary.medical.shortfall} kits needed for isolated clinics in lower-priority tiers.`);
  }

  const unsupplied = allocationResult.byCommunity.filter(c => c.overallStatus === 'unmet_need');
  if (unsupplied.length > 0) {
    const names = unsupplied.map(c => `${c.name} (Rank #${c.rank})`).join(', ');
    watchpoints.push(`Zero-allocation communities: ${names} receive 0 supplies under current slider stock. Prepare second-wave mutual aid escalation.`);
  }

  return {
    source: 'template_fallback',
    badge: {
      text: badgeText,
      type: 'fallback',
      color: '#f59e0b'
    },
    scenarioName,
    immediate,
    routeAlerts,
    watchpoints
  };
}
