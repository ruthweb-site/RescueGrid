/**
 * RescueGrid Community Triage Table Component
 * Displays ranked community list with dual-coded risk badges and expandable "Why this ranking?" factor breakdown.
 */

export class TriageTableComponent {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.rankedCommunities = options.rankedCommunities || [];
    this.selectedId = options.selectedId || null;
    this.expandedId = options.selectedId || null;
    this.onSelect = options.onSelect || (() => {});

    this.render();
  }

  update(rankedCommunities, selectedId) {
    this.rankedCommunities = rankedCommunities;
    this.selectedId = selectedId;
    if (selectedId) {
      this.expandedId = selectedId;
    }
    this.render();
  }

  setSelected(selectedId) {
    this.selectedId = selectedId;
    if (selectedId) {
      this.expandedId = selectedId;
    }
    this.render();
  }

  render() {
    if (!this.rankedCommunities.length) {
      this.container.innerHTML = '<div style="padding: 1rem; color: #94a3b8;">No community data available.</div>';
      return;
    }

    let itemsHtml = '';
    for (const c of this.rankedCommunities) {
      const isSelected = c.communityId === this.selectedId;
      const isExpanded = c.communityId === this.expandedId;
      const f = c.factors;

      itemsHtml += `
        <div class="triage-item ${isSelected ? 'selected' : ''}" data-id="${c.communityId}">
          <div class="triage-row-header">
            <div class="triage-rank-name">
              <span class="rank-badge">#${c.rank}</span>
              <div>
                <span style="color: #fff; font-size: 0.85rem;">${c.name}</span>
                <span style="font-size: 0.7rem; color: #94a3b8; margin-left: 0.35rem;">(${c.population.toLocaleString()} pop)</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="num" style="color: #38bdf8; font-weight: 700; font-size: 0.85rem;">${c.totalScore.toFixed(1)}</span>
              <span class="risk-tag ${c.riskTier}">
                <span>${c.riskIcon}</span>
                <span>${c.riskLabel}</span>
              </span>
              <span class="expander-arrow" style="font-size: 0.65rem; color: #64748b; cursor: pointer; padding: 0.2rem;">
                ${isExpanded ? '▲' : '▼'}
              </span>
            </div>
          </div>

          <!-- Expandable Factor Breakdown Drawer -->
          <div class="triage-expander-body" style="display: ${isExpanded ? 'flex' : 'none'};">
            <div style="font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; font-family: monospace;">
              Score Breakdown (Sum: ${c.totalScore.toFixed(1)} / 100)
            </div>

            <table class="factors-mini-table">
              <tbody>
                <tr>
                  <td class="factor-name">${f.exposure.name} (severity: ${f.exposure.rawValue}/40)</td>
                  <td class="factor-pts">+${f.exposure.points.toFixed(1)} pts</td>
                </tr>
                <tr>
                  <td class="factor-name">${f.vulnerability.name} (${f.vulnerability.rawValue} residents)</td>
                  <td class="factor-pts">+${f.vulnerability.points.toFixed(1)} pts</td>
                </tr>
                <tr>
                  <td class="factor-name">${f.roadAccess.name} (${f.roadAccess.rawValue})</td>
                  <td class="factor-pts">+${f.roadAccess.points.toFixed(1)} pts</td>
                </tr>
                <tr>
                  <td class="factor-name">${f.depotDistance.name} (${f.depotDistance.rawValue})</td>
                  <td class="factor-pts">+${f.depotDistance.points.toFixed(1)} pts</td>
                </tr>
              </tbody>
            </table>

            <div class="template-summary-line">
              ${c.summaryLine}
            </div>
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="triage-list">
        ${itemsHtml}
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.triage-item').forEach(el => {
      const cid = el.getAttribute('data-id');

      // Click row header selects and toggles expander
      const header = el.querySelector('.triage-row-header');
      if (header) {
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.expandedId === cid && this.selectedId === cid) {
            this.expandedId = null;
            this.onSelect(null);
          } else {
            this.expandedId = cid;
            this.onSelect(cid);
          }
        });
      }
    });
  }
}
