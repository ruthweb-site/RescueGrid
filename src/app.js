/**
 * RescueGrid Application State Coordinator
 * Orchestrates unidirectional data flow between controls, engines, map, and data tables.
 */

import { scoreAndRankCommunities } from './engine/scoring.js';
import { allocateResources } from './engine/allocation.js';
import { generateTemplatePlan } from './engine/templatePlan.js';
import { ControlsComponent } from './components/controls.js';
import { MapComponent } from './components/map.js';
import { TriageTableComponent } from './components/triageTable.js';
import { AllocationTableComponent } from './components/allocationTable.js';
import { ActionPlanComponent } from './components/actionPlan.js';

class RescueGridApp {
  constructor() {
    this.districtData = null;
    this.activeScenarioId = 'flood';
    this.currentStock = { food: 850, water: 1400, medical: 180 };
    this.selectedCommunityId = null;

    // Computed state
    this.rankedCommunities = [];
    this.allocationResult = null;
    this.actionPlan = null;

    // Component references
    this.controls = null;
    this.map = null;
    this.triageTable = null;
    this.allocationTable = null;
    this.actionPlanComponent = null;

    this.activeTab = 'triage';
  }

  async init() {
    try {
      // 1. Fetch district static dataset
      const res = await fetch('./src/data/district.json');
      if (!res.ok) throw new Error(`HTTP ${res.status} loading district data`);
      this.districtData = await res.json();

      // Set default stock for initial flood scenario
      const scenario = this.districtData.scenarios[this.activeScenarioId];
      if (scenario?.defaultStock) {
        this.currentStock = { ...scenario.defaultStock };
      }

      // 2. Run initial deterministic core calculation
      this.computeSimulation();

      // 3. Initialize components
      this.initHeader();
      this.initTabs();
      this.initComponents();

      console.log('RescueGrid EOC Console initialized successfully with full interactive tables and map.');
    } catch (err) {
      console.error('Fatal initialization error:', err);
      document.body.innerHTML = `<div style="padding: 2rem; color: #ef4444; font-family: monospace;">Failed to initialize RescueGrid: ${err.message}</div>`;
    }
  }

  computeSimulation() {
    const { communities, roads } = this.districtData;

    // Step A: Multi-factor Scoring and Ranking
    this.rankedCommunities = scoreAndRankCommunities(communities, roads, this.activeScenarioId);

    // Step B: Greedy Resource Allocation
    this.allocationResult = allocateResources(this.rankedCommunities, this.activeScenarioId, this.currentStock);

    // Step C: Fallback template plan (initial baseline)
    this.actionPlan = generateTemplatePlan(
      this.rankedCommunities,
      this.allocationResult,
      roads,
      this.activeScenarioId,
      'unavailable'
    );
  }

  initHeader() {
    // Clock
    const clockEl = document.getElementById('system-clock');
    if (clockEl) {
      const updateClock = () => {
        const now = new Date();
        clockEl.textContent = now.toTimeString().split(' ')[0] + ' UTC';
      };
      updateClock();
      setInterval(updateClock, 1000);
    }

    this.updateHeaderScenario();
  }

  updateHeaderScenario() {
    const nameEl = document.getElementById('active-scenario-name');
    if (nameEl && this.districtData) {
      const scenario = this.districtData.scenarios[this.activeScenarioId];
      nameEl.textContent = scenario?.name || this.activeScenarioId;
    }
  }

  initTabs() {
    const tabTriage = document.getElementById('tab-triage');
    const tabAlloc = document.getElementById('tab-allocation');
    const surfTriage = document.getElementById('triage-table-container');
    const surfAlloc = document.getElementById('allocation-table-container');

    if (tabTriage && tabAlloc && surfTriage && surfAlloc) {
      tabTriage.addEventListener('click', () => {
        this.activeTab = 'triage';
        tabTriage.classList.add('active');
        tabAlloc.classList.remove('active');
        surfTriage.classList.remove('hidden');
        surfTriage.classList.add('active');
        surfAlloc.classList.add('hidden');
        surfAlloc.classList.remove('active');
      });

      tabAlloc.addEventListener('click', () => {
        this.activeTab = 'allocation';
        tabAlloc.classList.add('active');
        tabTriage.classList.remove('active');
        surfAlloc.classList.remove('hidden');
        surfAlloc.classList.add('active');
        surfTriage.classList.add('hidden');
        surfTriage.classList.remove('active');
      });
    }
  }

  initComponents() {
    // 1. Controls Component
    const controlsContainer = document.getElementById('controls-container');
    if (controlsContainer) {
      this.controls = new ControlsComponent(controlsContainer, {
        scenarios: this.districtData.scenarios,
        activeScenarioId: this.activeScenarioId,
        stock: this.currentStock,
        onRun: ({ scenarioId, stock }) => this.handleRunSimulation(scenarioId, stock),
        onDirtyChange: (isDirty) => this.handleDirtyChange(isDirty)
      });
    }

    // 2. Map Component
    const mapContainer = document.getElementById('map-container');
    const tooltipEl = document.getElementById('map-tooltip');
    if (mapContainer) {
      this.map = new MapComponent(mapContainer, tooltipEl, {
        roads: this.districtData.roads,
        communities: this.rankedCommunities,
        depot: this.districtData.depot,
        activeScenarioId: this.activeScenarioId,
        selectedId: this.selectedCommunityId,
        onSelect: (id) => this.selectCommunity(id)
      });
    }

    // 3. Triage Table Component
    const triageContainer = document.getElementById('triage-table-container');
    if (triageContainer) {
      this.triageTable = new TriageTableComponent(triageContainer, {
        rankedCommunities: this.rankedCommunities,
        selectedId: this.selectedCommunityId,
        onSelect: (id) => this.selectCommunity(id)
      });
    }

    // 4. Allocation Table Component
    const allocContainer = document.getElementById('allocation-table-container');
    if (allocContainer) {
      this.allocationTable = new AllocationTableComponent(allocContainer, {
        allocationResult: this.allocationResult,
        selectedId: this.selectedCommunityId,
        onSelect: (id) => this.selectCommunity(id)
      });
    }

    // 5. Action Plan Component
    const actionPlanContainer = document.getElementById('action-plan-container');
    const badgeEl = document.getElementById('action-plan-badge');
    if (actionPlanContainer && badgeEl) {
      this.actionPlanComponent = new ActionPlanComponent(actionPlanContainer, badgeEl, {
        roads: this.districtData.roads
      });
      // Request initial briefing
      this.actionPlanComponent.requestBriefing(this.activeScenarioId, this.rankedCommunities, this.allocationResult);
    }
  }

  renderInitialActionPlan() {
    const container = document.getElementById('action-plan-container');
    const badgeEl = document.getElementById('action-plan-badge');
    if (!container || !badgeEl) return;

    badgeEl.innerHTML = `
      <span class="plan-status-badge fallback-badge">
        <span>⚠</span> ${this.actionPlan.badge.text}
      </span>
    `;

    let immHtml = '';
    for (const item of this.actionPlan.immediate) {
      immHtml += `
        <div class="plan-item-card">
          <div style="font-weight: 700; color: #38bdf8; margin-bottom: 0.2rem;">#${item.rank} ${item.communityName}</div>
          <div>${item.action}</div>
        </div>
      `;
    }

    let routeHtml = '';
    for (const alert of this.actionPlan.routeAlerts) {
      const isCut = alert.status === 'CUT';
      routeHtml += `
        <div class="plan-item-card ${isCut ? 'cut-warning' : 'at-risk-warning'}">
          <div style="font-weight: 700; color: ${alert.statusColor}; margin-bottom: 0.2rem;">${alert.status}: ${alert.roadName}</div>
          <div>${alert.advice}</div>
        </div>
      `;
    }

    let watchHtml = '';
    for (const wp of this.actionPlan.watchpoints) {
      watchHtml += `
        <div class="plan-item-card" style="border-left-color: #f59e0b;">
          <div>${wp}</div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="action-grid">
        <div class="action-column">
          <div class="col-header">
            <span>🚀</span> Priority Dispatch Sequence
          </div>
          <div class="action-card-list">
            ${immHtml}
          </div>
        </div>

        <div class="action-column">
          <div class="col-header">
            <span>⚠️</span> Road Network Advisories
          </div>
          <div class="action-card-list">
            ${routeHtml || '<div style="color: #64748b; font-size: 0.75rem;">All corridors operating normally.</div>'}
          </div>
        </div>

        <div class="action-column">
          <div class="col-header">
            <span>👁</span> Critical Supply Shortfalls
          </div>
          <div class="action-card-list">
            ${watchHtml || '<div style="color: #64748b; font-size: 0.75rem;">100% of demand satisfied.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  handleDirtyChange(isDirty) {
    const dirtyBadge = document.getElementById('dirty-state-badge');
    if (dirtyBadge) {
      if (isDirty) {
        dirtyBadge.classList.remove('hidden');
      } else {
        dirtyBadge.classList.add('hidden');
      }
    }
  }

  handleRunSimulation(scenarioId, stock) {
    this.activeScenarioId = scenarioId;
    this.currentStock = stock;

    this.computeSimulation();
    this.updateHeaderScenario();

    // Re-render map and tables
    if (this.map) {
      this.map.update(this.rankedCommunities, this.activeScenarioId, this.selectedCommunityId);
    }
    if (this.triageTable) {
      this.triageTable.update(this.rankedCommunities, this.selectedCommunityId);
    }
    if (this.allocationTable) {
      this.allocationTable.update(this.allocationResult, this.selectedCommunityId);
    }

    // Re-render action plan
    if (this.actionPlanComponent?.requestBriefing) {
      this.actionPlanComponent.requestBriefing(this.activeScenarioId, this.rankedCommunities, this.allocationResult);
    } else {
      this.renderInitialActionPlan();
    }
  }

  selectCommunity(communityId) {
    this.selectedCommunityId = communityId;

    if (this.map) {
      this.map.setSelected(communityId);
    }
    if (this.triageTable) {
      this.triageTable.setSelected(communityId);
    }
    if (this.allocationTable) {
      this.allocationTable.setSelected(communityId);
    }
  }
}

// Global bootstrap
const app = new RescueGridApp();
window.rescueGridApp = app;

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
