/**
 * RescueGrid Interactive Custom SVG District Map
 * Offline vector map rendering roads with hazard styles and communities with dual-coded risk markers.
 */

export class MapComponent {
  constructor(containerEl, tooltipEl, options = {}) {
    this.container = containerEl;
    this.tooltip = tooltipEl;
    this.roads = options.roads || [];
    this.communities = options.communities || [];
    this.depot = options.depot || { id: 'depot-main', name: 'Depot', coords: [400, 260] };
    this.activeScenarioId = options.activeScenarioId || 'flood';
    this.selectedId = options.selectedId || null;
    this.onSelect = options.onSelect || (() => {});

    this.render();
  }

  update(rankedCommunities, scenarioId, selectedId) {
    this.communities = rankedCommunities;
    this.activeScenarioId = scenarioId;
    this.selectedId = selectedId;
    this.render();
  }

  setSelected(selectedId) {
    this.selectedId = selectedId;
    const svg = this.container.querySelector('svg');
    if (!svg) return;

    svg.querySelectorAll('.community-node').forEach(node => {
      const cid = node.getAttribute('data-id');
      if (cid === selectedId) {
        node.classList.add('selected');
      } else {
        node.classList.remove('selected');
      }
    });
  }

  showTooltip(html, x, y) {
    if (!this.tooltip) return;
    this.tooltip.innerHTML = html;
    this.tooltip.classList.remove('hidden');

    const containerRect = this.container.getBoundingClientRect();
    const tooltipWidth = 220;
    const tooltipHeight = 90;

    let posX = x + 15;
    let posY = y + 15;

    if (posX + tooltipWidth > containerRect.width) {
      posX = x - tooltipWidth - 10;
    }
    if (posY + tooltipHeight > containerRect.height) {
      posY = y - tooltipHeight - 10;
    }

    this.tooltip.style.left = `${Math.max(10, posX)}px`;
    this.tooltip.style.top = `${Math.max(10, posY)}px`;
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.classList.add('hidden');
    }
  }

  render() {
    // Map coordinate dictionary
    const nodeCoords = new Map();
    nodeCoords.set(this.depot.id, this.depot.coords);
    for (const c of this.communities) {
      nodeCoords.set(c.communityId || c.id, c.coords);
    }

    // SVG elements: Roads
    let roadsSvg = '';
    for (const road of this.roads) {
      const fromPt = nodeCoords.get(road.from);
      const toPt = nodeCoords.get(road.to);
      if (fromPt && toPt) {
        const status = road.status?.[this.activeScenarioId] || 'open';
        roadsSvg += `
          <line
            class="road-line ${status}"
            x1="${fromPt[0]}" y1="${fromPt[1]}"
            x2="${toPt[0]}" y2="${toPt[1]}"
            data-road-id="${road.id}"
            data-road-name="${road.name}"
            data-status="${status}"
          />
        `;
      }
    }

    // SVG elements: Central Depot Marker
    const depotSvg = `
      <g class="depot-marker" transform="translate(${this.depot.coords[0]}, ${this.depot.coords[1]})">
        <!-- Depot pulse radar -->
        <circle r="22" fill="rgba(6, 182, 212, 0.08)" stroke="rgba(6, 182, 212, 0.3)" stroke-width="1.5" stroke-dasharray="3 3"/>
        <rect x="-12" y="-12" width="24" height="24" rx="4" fill="#0f172a" stroke="#06b6d4" stroke-width="2.5"/>
        <text x="0" y="4" text-anchor="middle" font-size="12" fill="#38bdf8">📦</text>
        <text x="0" y="24" text-anchor="middle" font-size="9" font-weight="bold" fill="#67e8f9" font-family="monospace">CENTRAL DEPOT</text>
      </g>
    `;

    // SVG elements: Community Nodes
    let communitiesSvg = '';
    for (const c of this.communities) {
      const id = c.communityId || c.id;
      const isSelected = id === this.selectedId;
      const color = c.riskColor || '#10b981';
      const icon = c.riskIcon || '✓';
      const rank = c.rank || 1;

      communitiesSvg += `
        <g class="community-node ${isSelected ? 'selected' : ''}" data-id="${id}" transform="translate(${c.coords[0]}, ${c.coords[1]})">
          <!-- Selection highlight ring -->
          <circle class="node-ring" r="21" fill="none" stroke="${isSelected ? '#ffffff' : 'transparent'}" stroke-width="3"/>
          
          <!-- Outer circle coded with risk color -->
          <circle r="16" fill="${color}" stroke="#070b14" stroke-width="2.5" />

          <!-- Dual-coded geometric symbol inside node -->
          <text x="0" y="4.5" text-anchor="middle" font-size="11" font-weight="900" fill="#000" font-family="monospace">${icon}</text>

          <!-- Rank Pill Badge -->
          <rect x="8" y="-18" width="18" height="13" rx="3" fill="#0b1122" stroke="${color}" stroke-width="1.5"/>
          <text x="17" y="-8.5" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#fff" font-family="monospace">#${rank}</text>

          <!-- Community Name Label -->
          <text class="node-label" x="0" y="30" text-anchor="middle">${c.name}</text>
        </g>
      `;
    }

    this.container.innerHTML = `
      <svg class="district-map-svg" viewBox="0 0 840 500" xmlns="http://www.w3.org/2000/svg">
        <!-- Subtle tactical grid lines -->
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#111827" stroke-width="0.8"/>
          </pattern>
        </defs>
        <rect width="840" height="500" fill="url(#grid)" />
        
        <!-- District boundaries / water body styling simulation -->
        <path d="M 500 0 Q 560 120 540 240 T 600 500" fill="none" stroke="rgba(14, 116, 144, 0.25)" stroke-width="45" stroke-linecap="round"/>
        <text x="560" y="30" fill="rgba(6, 182, 212, 0.3)" font-size="10" font-family="monospace">KAVERIDELTA RIVER SYSTEM</text>

        <!-- Road Network Layer -->
        <g id="roads-layer">${roadsSvg}</g>

        <!-- Central Depot Layer -->
        <g id="depot-layer">${depotSvg}</g>

        <!-- Community Nodes Layer -->
        <g id="communities-layer">${communitiesSvg}</g>
      </svg>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const svg = this.container.querySelector('svg');
    if (!svg) return;

    // Deselect on empty canvas click
    svg.addEventListener('click', (e) => {
      if (e.target.tagName === 'rect' && e.target.getAttribute('fill') === 'url(#grid)') {
        this.onSelect(null);
      }
    });

    // Community node click and hover
    svg.querySelectorAll('.community-node').forEach(node => {
      const cid = node.getAttribute('data-id');
      const comm = this.communities.find(c => (c.communityId || c.id) === cid);

      node.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelect(this.selectedId === cid ? null : cid);
      });

      node.addEventListener('mouseenter', (e) => {
        if (!comm) return;
        const rect = this.container.getBoundingClientRect();
        const tooltipHtml = `
          <div style="font-weight: 700; color: #fff; font-size: 0.85rem; margin-bottom: 0.25rem;">${comm.name}</div>
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.35rem;">
            <span style="background: ${comm.riskColor}; color: #000; font-weight: bold; padding: 0.1rem 0.35rem; border-radius: 2px; font-size: 0.7rem;">
              ${comm.riskIcon} ${comm.riskLabel} (Score: ${comm.totalScore})
            </span>
            <span style="color: #94a3b8; font-family: monospace;">Rank #${comm.rank}</span>
          </div>
          <div style="color: #cbd5e1; font-size: 0.7rem; line-height: 1.4;">
            Population: <strong>${comm.population.toLocaleString()}</strong><br>
            Vulnerable: <strong>${comm.vulnerable}</strong> residents<br>
            Access Road: <strong style="color: ${comm.roadStatus === 'cut' ? '#ef4444' : comm.roadStatus === 'at_risk' ? '#f59e0b' : '#10b981'};">${comm.roadStatus.toUpperCase()}</strong> (${comm.depotDistanceKm} km)
          </div>
        `;
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        this.showTooltip(tooltipHtml, clientX, clientY);
      });

      node.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    });

    // Road hover tooltips
    svg.querySelectorAll('.road-line').forEach(line => {
      const roadName = line.getAttribute('data-road-name');
      const status = line.getAttribute('data-status');

      line.addEventListener('mouseenter', (e) => {
        const rect = this.container.getBoundingClientRect();
        const statusColor = status === 'cut' ? '#ef4444' : status === 'at_risk' ? '#f59e0b' : '#10b981';
        const tooltipHtml = `
          <div style="font-weight: 700; color: #38bdf8; font-size: 0.8rem;">🛣 ${roadName}</div>
          <div style="font-size: 0.75rem; margin-top: 0.25rem;">
            Status: <strong style="color: ${statusColor};">${status.replace('_', ' ').toUpperCase()}</strong>
          </div>
        `;
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        this.showTooltip(tooltipHtml, clientX, clientY);
      });

      line.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    });
  }
}
