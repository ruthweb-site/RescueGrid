/**
 * RescueGrid Action Plan Component
 * Manages briefing generation lifecycle, skeleton loading, guardrail hydration, and template fallback rendering.
 */

import { fetchAIBriefing, validateAndHydrateBriefing } from '../services/aiBriefing.js';
import { generateTemplatePlan } from '../engine/templatePlan.js';

export class ActionPlanComponent {
  constructor(containerEl, badgeEl, options = {}) {
    this.container = containerEl;
    this.badgeEl = badgeEl;
    this.roads = options.roads || [];
    this.isLoading = false;
    this.currentPlan = null;
  }

  setLoading(loading) {
    this.isLoading = loading;
    if (loading) {
      this.badgeEl.innerHTML = `
        <span class="plan-status-badge" style="background: rgba(6, 182, 212, 0.15); color: #38bdf8; border: 1px solid rgba(6, 182, 212, 0.3);">
          <span class="spinner" style="width: 12px; height: 12px; border-width: 1.5px; display: inline-block;"></span>
          Synthesizing operational brief...
        </span>
      `;

      this.container.innerHTML = `
        <div class="action-grid" style="opacity: 0.75;">
          <div class="action-column">
            <div class="col-header"><span>🚀</span> Priority Dispatch Sequence</div>
            <div class="skeleton-box" style="height: 48px;"></div>
            <div class="skeleton-box" style="height: 48px;"></div>
            <div class="skeleton-box" style="height: 48px;"></div>
          </div>
          <div class="action-column">
            <div class="col-header"><span>⚠️</span> Road Network Advisories</div>
            <div class="skeleton-box" style="height: 42px;"></div>
            <div class="skeleton-box" style="height: 42px;"></div>
          </div>
          <div class="action-column">
            <div class="col-header"><span>👁</span> Critical Supply Shortfalls</div>
            <div class="skeleton-box" style="height: 38px;"></div>
            <div class="skeleton-box" style="height: 38px;"></div>
          </div>
        </div>
      `;
    }
  }

  renderPlan(plan) {
    this.currentPlan = plan;
    const isAi = plan.source === 'ai_validated';

    // 1. Status Badge
    const badgeClass = isAi ? 'plan-status-badge ai-valid' : 'plan-status-badge fallback-badge';
    const badgeIcon = isAi ? '✓' : '⚠';
    this.badgeEl.innerHTML = `
      <span class="${badgeClass}">
        <span>${badgeIcon}</span> ${plan.badge.text}
      </span>
    `;

    // 2. Immediate Deployment Cards
    let immHtml = '';
    for (const item of plan.immediate) {
      immHtml += `
        <div class="plan-item-card">
          <div style="font-weight: 700; color: #38bdf8; margin-bottom: 0.2rem;">
            #${item.rank} ${item.communityName}
          </div>
          <div>${item.action}</div>
        </div>
      `;
    }

    // 3. Road Alerts
    let routeHtml = '';
    for (const alert of plan.routeAlerts) {
      const isCut = alert.status === 'CUT';
      routeHtml += `
        <div class="plan-item-card ${isCut ? 'cut-warning' : 'at-risk-warning'}">
          <div style="font-weight: 700; color: ${alert.statusColor || '#fbbf24'}; margin-bottom: 0.2rem;">
            ${alert.status}: ${alert.roadName}
          </div>
          <div>${alert.advice}</div>
        </div>
      `;
    }

    // 4. Watchpoints
    let watchHtml = '';
    for (const wp of plan.watchpoints) {
      watchHtml += `
        <div class="plan-item-card" style="border-left-color: #f59e0b;">
          <div>${wp}</div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="action-grid">
        <div class="action-column">
          <div class="col-header">
            <span>🚀</span> Priority Dispatch Sequence
          </div>
          <div class="action-card-list">
            ${immHtml || '<div style="color: #64748b; font-size: 0.75rem;">No dispatches scheduled.</div>'}
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
            ${watchHtml || '<div style="color: #64748b; font-size: 0.75rem;">All community needs satisfied.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  async requestBriefing(scenarioId, rankedCommunities, allocationResult) {
    this.setLoading(true);

    try {
      const res = await fetchAIBriefing(scenarioId, rankedCommunities, this.roads, allocationResult);
      console.log('[ActionPlan] Server response:', JSON.stringify(res, null, 2));

      if (res?.fallback) {
        // AI unavailable (no key, timeout, or ?ai=off hook)
        console.warn('[ActionPlan] Fallback triggered, reason:', res.reason);
        const fallbackPlan = generateTemplatePlan(rankedCommunities, allocationResult, this.roads, scenarioId, 'unavailable');
        this.renderPlan(fallbackPlan);
        return;
      }

      if (res?.success && res.data) {
        console.log('[ActionPlan] AI data received, running guardrail validation...');
        console.log('[ActionPlan] Raw AI data:', JSON.stringify(res.data, null, 2));
        // Validate against strict guardrails & hydrate placeholders
        const validation = validateAndHydrateBriefing(res.data, rankedCommunities, this.roads, allocationResult);

        if (validation.valid && validation.hydrated) {
          // Success! Render validated AI action plan
          console.log('[ActionPlan] Guardrail PASSED — rendering AI plan.');
          this.renderPlan(validation.hydrated);
          return;
        } else {
          console.warn('[ActionPlan] Guardrail REJECTED. Reason:', validation.reason);
          console.log('[ActionPlan] Ranked community IDs:', rankedCommunities.map(c => `${c.communityId}(rank${c.rank})`));
          // AI output failed validation: trigger explicit validation failed fallback
          const fallbackPlan = generateTemplatePlan(rankedCommunities, allocationResult, this.roads, scenarioId, 'validation_failed');
          this.renderPlan(fallbackPlan);
          return;
        }
      }

      console.warn('[ActionPlan] Unexpected response shape:', res);

      // Default fallback
      const fallbackPlan = generateTemplatePlan(rankedCommunities, allocationResult, this.roads, scenarioId, 'unavailable');
      this.renderPlan(fallbackPlan);
    } catch (err) {
      console.warn('Action plan briefing error:', err.message);
      const fallbackPlan = generateTemplatePlan(rankedCommunities, allocationResult, this.roads, scenarioId, 'unavailable');
      this.renderPlan(fallbackPlan);
    } finally {
      this.isLoading = false;
    }
  }
}
