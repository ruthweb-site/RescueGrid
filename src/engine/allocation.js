/**
 * RescueGrid Resource Allocation Engine
 * Computes scenario-scaled community demand and greedy rank-order supply distribution.
 */

export const RESOURCE_TYPES = [
  { key: 'food', label: 'Food Packets', unit: 'packets' },
  { key: 'water', label: 'Drinking Water', unit: 'units' },
  { key: 'medical', label: 'Medical Kits', unit: 'kits' }
];

/**
 * Calculate scaled resource demand for a community based on scenario exposure.
 * Formula: baseline * max(0.25, exposure / 40)
 */
export function calculateCommunityDemand(community, scenarioId) {
  const exposure = community.scenarioExposure?.[scenarioId] ?? 20;
  const severityMultiplier = Math.max(0.25, exposure / 40);

  const baselineFood = Math.round(community.population * 0.45);
  const baselineWater = Math.round(community.population * 0.80);
  const baselineMedical = Math.max(10, Math.round(community.vulnerable * 0.25));

  return {
    food: Math.max(10, Math.round(baselineFood * severityMultiplier)),
    water: Math.max(20, Math.round(baselineWater * severityMultiplier)),
    medical: Math.max(5, Math.round(baselineMedical * severityMultiplier))
  };
}

/**
 * Allocate stock for a single resource type across ranked communities.
 */
function allocateSingleResource(rankedCommunities, availableStock, resourceKey) {
  let remaining = Math.max(0, availableStock);
  const rows = [];
  let totalNeeded = 0;
  let totalAllocated = 0;

  for (const community of rankedCommunities) {
    const needed = community.demands[resourceKey] || 0;
    totalNeeded += needed;

    let allocated = 0;
    let status = 'unmet_need';
    let statusLabel = 'Unmet Need';
    let statusIcon = '✖';
    let statusColor = '#ef4444';

    if (remaining >= needed) {
      allocated = needed;
      remaining -= needed;
      status = 'fully_allocated';
      statusLabel = 'Fully Allocated';
      statusIcon = '✓';
      statusColor = '#10b981';
    } else if (remaining > 0) {
      allocated = remaining;
      remaining = 0;
      status = 'partial';
      statusLabel = 'Partial';
      statusIcon = '▲';
      statusColor = '#f59e0b';
    } else {
      allocated = 0;
      status = 'unmet_need';
      statusLabel = 'Unmet Need';
      statusIcon = '✖';
      statusColor = '#ef4444';
    }

    totalAllocated += allocated;
    const gap = needed - allocated;

    rows.push({
      communityId: community.communityId,
      name: community.name,
      rank: community.rank,
      resourceKey,
      needed,
      allocated,
      gap,
      status,
      statusLabel,
      statusIcon,
      statusColor
    });
  }

  const shortfall = Math.max(0, totalNeeded - totalAllocated);

  return {
    resourceKey,
    availableStock,
    totalNeeded,
    totalAllocated,
    shortfall,
    remainingUnallocated: remaining,
    rows
  };
}

/**
 * Run greedy resource allocation across all 3 resource types.
 */
export function allocateResources(rankedCommunities, scenarioId, stockLevels) {
  // 1. Attach scaled demands to each ranked community
  const enriched = rankedCommunities.map(c => ({
    ...c,
    demands: calculateCommunityDemand(c, scenarioId)
  }));

  // 2. Perform greedy allocation for each resource type
  const allocations = {
    food: allocateSingleResource(enriched, stockLevels.food ?? 0, 'food'),
    water: allocateSingleResource(enriched, stockLevels.water ?? 0, 'water'),
    medical: allocateSingleResource(enriched, stockLevels.medical ?? 0, 'medical')
  };

  // 3. Assemble composite allocation matrix grouped by community
  const communityAllocations = enriched.map(c => {
    const foodRow = allocations.food.rows.find(r => r.communityId === c.communityId);
    const waterRow = allocations.water.rows.find(r => r.communityId === c.communityId);
    const medicalRow = allocations.medical.rows.find(r => r.communityId === c.communityId);

    const hasUnmet = foodRow.status === 'unmet_need' || waterRow.status === 'unmet_need' || medicalRow.status === 'unmet_need';
    const hasPartial = foodRow.status === 'partial' || waterRow.status === 'partial' || medicalRow.status === 'partial';

    let overallStatus = 'fully_allocated';
    let overallBadge = { label: 'Fully Allocated', icon: '✓', color: '#10b981' };

    if (hasUnmet) {
      overallStatus = (foodRow.allocated === 0 && waterRow.allocated === 0 && medicalRow.allocated === 0)
        ? 'unmet_need'
        : 'partial';
      overallBadge = overallStatus === 'unmet_need'
        ? { label: 'Unmet Need', icon: '✖', color: '#ef4444' }
        : { label: 'Partial Deficit', icon: '▲', color: '#f59e0b' };
    } else if (hasPartial) {
      overallStatus = 'partial';
      overallBadge = { label: 'Partial Deficit', icon: '▲', color: '#f59e0b' };
    }

    return {
      communityId: c.communityId,
      name: c.name,
      rank: c.rank,
      riskTier: c.riskTier,
      riskLabel: c.riskLabel,
      riskIcon: c.riskIcon,
      riskColor: c.riskColor,
      resources: {
        food: foodRow,
        water: waterRow,
        medical: medicalRow
      },
      overallStatus,
      overallBadge
    };
  });

  return {
    summary: {
      food: {
        label: 'Food Packets',
        allocated: allocations.food.totalAllocated,
        needed: allocations.food.totalNeeded,
        shortfall: allocations.food.shortfall
      },
      water: {
        label: 'Drinking Water',
        allocated: allocations.water.totalAllocated,
        needed: allocations.water.totalNeeded,
        shortfall: allocations.water.shortfall
      },
      medical: {
        label: 'Medical Kits',
        allocated: allocations.medical.totalAllocated,
        needed: allocations.medical.totalNeeded,
        shortfall: allocations.medical.shortfall
      }
    },
    byResource: allocations,
    byCommunity: communityAllocations
  };
}
