/**
 * RescueGrid Scenario & Stock Controls Component
 */

export class ControlsComponent {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.scenarios = options.scenarios || {};
    this.activeScenarioId = options.activeScenarioId || 'flood';
    this.currentStock = { ...options.stock };
    this.committedStock = { ...options.stock };
    this.committedScenarioId = this.activeScenarioId;
    this.isDirty = false;

    this.onRun = options.onRun || (() => {});
    this.onDirtyChange = options.onDirtyChange || (() => {});

    this.render();
  }

  setDirty(dirty) {
    if (this.isDirty !== dirty) {
      this.isDirty = dirty;
      this.onDirtyChange(dirty);
      const runBtn = this.container.querySelector('#run-sim-btn');
      if (runBtn) {
        if (dirty) {
          runBtn.classList.add('highlight');
        } else {
          runBtn.classList.remove('highlight');
        }
      }
    }
  }

  checkDirty() {
    const isScenarioChanged = this.activeScenarioId !== this.committedScenarioId;
    const isStockChanged =
      this.currentStock.food !== this.committedStock.food ||
      this.currentStock.water !== this.committedStock.water ||
      this.currentStock.medical !== this.committedStock.medical;

    this.setDirty(isScenarioChanged || isStockChanged);
  }

  setScenario(scenarioId) {
    if (this.scenarios[scenarioId]) {
      this.activeScenarioId = scenarioId;
      // Load scenario default stock if switching
      const defaults = this.scenarios[scenarioId].defaultStock;
      if (defaults) {
        this.currentStock = { ...defaults };
      }
      this.render();
      this.checkDirty();
    }
  }

  render() {
    const scenario = this.scenarios[this.activeScenarioId] || {};

    this.container.innerHTML = `
      <div class="controls-container">
        <!-- Scenario Switcher -->
        <div>
          <div class="control-group-title">Disaster Hazard Scenario</div>
          <div class="scenario-buttons">
            <button class="scenario-btn ${this.activeScenarioId === 'flood' ? 'active' : ''}" data-scenario="flood">
              <span>🌊 RIVER FLOOD</span>
              <span style="font-size: 0.65rem; color: #94a3b8;">Monsoon Surge</span>
            </button>
            <button class="scenario-btn ${this.activeScenarioId === 'cyclone' ? 'active' : ''}" data-scenario="cyclone">
              <span>🌀 CYCLONE</span>
              <span style="font-size: 0.65rem; color: #94a3b8;">Cat-3 Landfall</span>
            </button>
          </div>
          <div class="scenario-desc-box" style="margin-top: 0.5rem;">
            ${scenario.summary || 'Selected simulated disaster event.'}
          </div>
        </div>

        <!-- Relief Supply Sliders -->
        <div>
          <div class="control-group-title">Available Relief Depots Stock</div>
          <div class="slider-group">
            
            <div class="slider-item">
              <div class="slider-header">
                <span class="slider-label">🍱 Food Packets</span>
                <span class="slider-value" id="val-food">${this.currentStock.food}</span>
              </div>
              <input type="range" id="slider-food" min="0" max="2000" step="25" value="${this.currentStock.food}">
            </div>

            <div class="slider-item">
              <div class="slider-header">
                <span class="slider-label">💧 Drinking Water Units</span>
                <span class="slider-value" id="val-water">${this.currentStock.water}</span>
              </div>
              <input type="range" id="slider-water" min="0" max="3000" step="50" value="${this.currentStock.water}">
            </div>

            <div class="slider-item">
              <div class="slider-header">
                <span class="slider-label">🩹 Medical Triage Kits</span>
                <span class="slider-value" id="val-medical">${this.currentStock.medical}</span>
              </div>
              <input type="range" id="slider-medical" min="0" max="500" step="10" value="${this.currentStock.medical}">
            </div>

          </div>
        </div>

        <!-- Action Button -->
        <div class="action-btn-container">
          <button id="run-sim-btn" class="run-simulation-btn ${this.isDirty ? 'highlight' : ''}">
            <span>▶ RUN SIMULATION</span>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Scenario buttons
    this.container.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sid = e.currentTarget.getAttribute('data-scenario');
        if (sid !== this.activeScenarioId) {
          this.setScenario(sid);
        }
      });
    });

    // Sliders
    const setupSlider = (id, key) => {
      const slider = this.container.querySelector(`#slider-${id}`);
      const valDisplay = this.container.querySelector(`#val-${id}`);
      if (slider && valDisplay) {
        slider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          this.currentStock[key] = val;
          valDisplay.textContent = val;
          this.checkDirty();
        });
      }
    };

    setupSlider('food', 'food');
    setupSlider('water', 'water');
    setupSlider('medical', 'medical');

    // Run Simulation button
    const runBtn = this.container.querySelector('#run-sim-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        this.committedScenarioId = this.activeScenarioId;
        this.committedStock = { ...this.currentStock };
        this.setDirty(false);
        this.onRun({
          scenarioId: this.activeScenarioId,
          stock: { ...this.currentStock }
        });
      });
    }
  }
}
