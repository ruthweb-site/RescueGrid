/**
 * RescueGrid Resource Allocation Table Component
 * Displays shortfall summary strip and community supply matrix with explicit deficit badges.
 */

export class AllocationTableComponent {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.allocationResult = options.allocationResult || null;
    this.selectedId = options.selectedId || null;
    this.onSelect = options.onSelect || (() => {});

    this.render();
  }

  update(allocationResult, selectedId) {
    this.allocationResult = allocationResult;
    this.selectedId = selectedId;
    this.render();
  }

  setSelected(selectedId) {
    this.selectedId = selectedId;
    this.render();
  }

  render() {
    if (!this.allocationResult) {
      this.container.innerHTML = '<div style="padding: 1rem; color: #94a3b8;">No allocation calculated.</div>';
      return;
    }

    const { summary, byCommunity } = this.allocationResult;

    // 1. Shortfall Summary Strip
    const stripHtml = `
      <div class="shortfall-summary-strip">
        <div class="strip-item">
          <span class="strip-title">🍱 Food Packets</span>
          <span class="strip-stat">
            ${summary.food.allocated} / ${summary.food.needed}
          </span>
          <span style="font-size: 0.65rem; color: ${summary.food.shortfall > 0 ? '#f59e0b' : '#10b981'}; font-weight: bold;">
            ${summary.food.shortfall > 0 ? `${summary.food.shortfall} Shortfall` : '100% Met'}
          </span>
        </div>

        <div class="strip-item">
          <span class="strip-title">💧 Drinking Water</span>
          <span class="strip-stat">
            ${summary.water.allocated} / ${summary.water.needed}
          </span>
          <span style="font-size: 0.65rem; color: ${summary.water.shortfall > 0 ? '#f59e0b' : '#10b981'}; font-weight: bold;">
            ${summary.water.shortfall > 0 ? `${summary.water.shortfall} Shortfall` : '100% Met'}
          </span>
        </div>

        <div class="strip-item">
          <span class="strip-title">🩹 Medical Kits</span>
          <span class="strip-stat">
            ${summary.medical.allocated} / ${summary.medical.needed}
          </span>
          <span style="font-size: 0.65rem; color: ${summary.medical.shortfall > 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">
            ${summary.medical.shortfall > 0 ? `${summary.medical.shortfall} Shortfall` : '100% Met'}
          </span>
        </div>
      </div>
    `;

    // 2. Table Rows
    let rowsHtml = '';
    for (const c of byCommunity) {
      const isSelected = c.communityId === this.selectedId;
      const res = c.resources;

      const formatCell = (item) => {
        const isShort = item.gap > 0;
        return `
          <div style="font-size: 0.725rem;">
            <span class="num" style="font-weight: 700; color: ${item.allocated === 0 ? '#ef4444' : item.allocated < item.needed ? '#f59e0b' : '#34d399'};">
              ${item.allocated}
            </span>
            <span style="color: #64748b;"> / ${item.needed}</span>
            ${isShort ? `<div style="font-size: 0.65rem; color: #ef4444; font-weight: bold;">-${item.gap}</div>` : ''}
          </div>
        `;
      };

      const b = c.overallBadge;
      const badgeStyle = `background: ${c.overallStatus === 'unmet_need' ? 'rgba(239, 68, 68, 0.15)' : c.overallStatus === 'partial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${b.color}; border: 1px solid ${b.color};`;

      rowsHtml += `
        <tr class="${isSelected ? 'selected' : ''}" data-id="${c.communityId}" style="cursor: pointer;">
          <td>
            <div style="font-weight: 600; color: #fff; font-size: 0.75rem;">
              <span class="rank-badge" style="margin-right: 0.25rem;">#${c.rank}</span>
              ${c.name}
            </div>
          </td>
          <td>${formatCell(res.food)}</td>
          <td>${formatCell(res.water)}</td>
          <td>${formatCell(res.medical)}</td>
          <td>
            <span style="font-size: 0.65rem; font-family: monospace; font-weight: bold; padding: 0.15rem 0.4rem; border-radius: 3px; display: inline-flex; align-items: center; gap: 0.25rem; ${badgeStyle}">
              <span>${b.icon}</span>
              <span>${b.label}</span>
            </span>
          </td>
        </tr>
      `;
    }

    this.container.innerHTML = `
      <div>
        ${stripHtml}
        <table class="allocation-table">
          <thead>
            <tr>
              <th>Community</th>
              <th>Food</th>
              <th>Water</th>
              <th>Meds</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', (e) => {
        const cid = row.getAttribute('data-id');
        this.onSelect(this.selectedId === cid ? null : cid);
      });
    });
  }
}
