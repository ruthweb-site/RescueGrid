/**
 * RescueGrid Application State Coordinator
 * Orchestrates unidirectional data flow between controls, engines, map, and data tables.
 */

import { scoreAndRankCommunities } from './engine/scoring.js';
import { allocateResources } from './engine/allocation.js';
import { generateTemplatePlan } from './engine/templatePlan.js';
import { ControlsComponent } from './components/controls.js';
import { MapComponent } from './components/map.js';

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
      this.initComponents();

      console.log('RescueGrid EOC Console initialized successfully with initial simulation rendered.');
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

    // Re-render map
    if (this.map) {
      this.map.update(this.rankedCommunities, this.activeScenarioId, this.selectedCommunityId);
    }

    // Notify tables if initialized (Slice 3)
    if (this.triageTable?.update) {
      this.triageTable.update(this.rankedCommunities, this.selectedCommunityId);
    }
    if (this.allocationTable?.update) {
      this.allocationTable.update(this.allocationResult, this.selectedCommunityId);
    }

    // Trigger AI Briefing if wired (Slice 4)
    if (this.actionPlanComponent?.requestBriefing) {
      this.actionPlanComponent.requestBriefing(this.activeScenarioId, this.rankedCommunities, this.allocationResult);
    }
  }

  selectCommunity(communityId) {
    this.selectedCommunityId = communityId;

    if (this.map) {
      this.map.setSelected(communityId);
    }
    if (this.triageTable?.setSelected) {
      this.triageTable.setSelected(communityId);
    }
    if (this.allocationTable?.setSelected) {
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
