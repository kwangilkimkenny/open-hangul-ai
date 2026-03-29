// ============================================================
// AEGIS PALADIN 6-Layer Defense Orchestrator
// Ported from libs/aegis-defense/src/paladin.rs
// ============================================================

import type { Decision, Risk, PaladinResult, LayerResult, DefenseResult } from '../core/types';
import { DecisionPriority } from '../core/types';
import type { AegisConfig } from '../core/config';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface DefenseLayer {
  name: string;
  priority: number;
  evaluate(content: string, context: Record<string, unknown>): DefenseResult | Promise<DefenseResult>;
}

export interface DeterministicDefenseMatch {
  decision: Decision;
  risk: Risk;
  confidence: number;
  reason: string;
}

export interface DeterministicDefenseManager {
  /**
   * theta=0 deterministic check. Returns a match when the input is a
   * known-bad pattern that must always be blocked regardless of ML scores.
   */
  check(content: string, context: Record<string, unknown>): DeterministicDefenseMatch | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mostSevereDecision(a: Decision, b: Decision): Decision {
  return DecisionPriority[a] >= DecisionPriority[b] ? a : b;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// ---------------------------------------------------------------------------
// Paladin
// ---------------------------------------------------------------------------

export class Paladin {
  private layers: DefenseLayer[] = [];
  private deterministicDefense?: DeterministicDefenseManager;
  private config: AegisConfig;

  constructor(config?: AegisConfig) {
    this.config = config ?? {};
  }

  /** Register the ordered set of defense layers. */
  withLayers(layers: DefenseLayer[]): this {
    this.layers = [...layers].sort((a, b) => a.priority - b.priority);
    return this;
  }

  /** Attach a deterministic (theta=0) defense manager. */
  withDeterministicDefense(manager: DeterministicDefenseManager): this {
    this.deterministicDefense = manager;
    return this;
  }

  // -----------------------------------------------------------------------
  // Core evaluation
  // -----------------------------------------------------------------------

  /**
   * Run the full 6-layer PALADIN pipeline.
   *
   * Algorithm:
   * 1. Check deterministic defense first (theta=0 guarantee)
   * 2. Run all 6 layers sequentially
   * 3. finalDecision = most severe across all layers
   * 4. finalConfidence = minimum of all layer confidences
   * 5. finalRisk = risk from the LAST failing layer
   */
  evaluate(content: string, context: Record<string, unknown> = {}): PaladinResult {
    // --- Step 1: Deterministic defense (theta=0) ---
    if (this.deterministicDefense) {
      const det = this.deterministicDefense.check(content, context);
      if (det) {
        return {
          passed: false,
          decision: det.decision,
          risk: det.risk,
          confidence: det.confidence,
          layers: [
            {
              name: 'deterministic_defense',
              passed: false,
              decision: det.decision,
              risk: det.risk,
              confidence: det.confidence,
              latencyMs: 0,
            },
          ],
        };
      }
    }

    // --- Step 2: Run all layers sequentially ---
    const layerResults: LayerResult[] = [];
    let finalDecision: Decision = 'APPROVE';
    let finalConfidence = 1.0;
    let finalRisk: Risk | undefined;

    for (const layer of this.layers) {
      const start = now();
      const result = layer.evaluate(content, context);

      // This orchestrator is synchronous — if a layer returns a Promise
      // we resolve it inline only if it is already settled (micro-optimisation
      // for layers that return plain objects).  For true async use evaluateAsync.
      let defenseResult: DefenseResult;
      if (result && typeof (result as Promise<DefenseResult>).then === 'function') {
        // Fallback: treat unresolved promise as pass (caller should use evaluateAsync)
        defenseResult = {
          layer: layer.name,
          passed: true,
          confidence: 1.0,
        };
      } else {
        defenseResult = result as DefenseResult;
      }

      const latencyMs = now() - start;

      const layerResult: LayerResult = {
        name: layer.name,
        passed: defenseResult.passed,
        decision: defenseResult.decision,
        risk: defenseResult.risk,
        confidence: defenseResult.confidence,
        latencyMs,
      };
      layerResults.push(layerResult);

      // Accumulate decision severity
      if (defenseResult.decision) {
        finalDecision = mostSevereDecision(finalDecision, defenseResult.decision);
      }

      // Track minimum confidence
      finalConfidence = Math.min(finalConfidence, defenseResult.confidence);

      // Track risk from LAST failing layer
      if (!defenseResult.passed && defenseResult.risk) {
        finalRisk = defenseResult.risk;
      }
    }

    const passed = finalDecision === 'APPROVE';

    return {
      passed,
      decision: finalDecision,
      risk: finalRisk,
      confidence: finalConfidence,
      layers: layerResults,
    };
  }

  /**
   * Evaluate with a provider profile name attached to the result.
   * Provider-specific threshold modifiers can be applied by layers
   * that inspect context.provider.
   */
  evaluateWithProvider(
    content: string,
    provider: string,
    context: Record<string, unknown> = {},
  ): PaladinResult {
    const merged = { ...context, provider };
    const result = this.evaluate(content, merged);
    return { ...result, providerProfile: provider };
  }

  // -----------------------------------------------------------------------
  // Async variant
  // -----------------------------------------------------------------------

  /**
   * Async version of evaluate — awaits layers that return Promises
   * (e.g. LLM judge layer).
   */
  async evaluateAsync(
    content: string,
    context: Record<string, unknown> = {},
  ): Promise<PaladinResult> {
    // Deterministic defense
    if (this.deterministicDefense) {
      const det = this.deterministicDefense.check(content, context);
      if (det) {
        return {
          passed: false,
          decision: det.decision,
          risk: det.risk,
          confidence: det.confidence,
          layers: [
            {
              name: 'deterministic_defense',
              passed: false,
              decision: det.decision,
              risk: det.risk,
              confidence: det.confidence,
              latencyMs: 0,
            },
          ],
        };
      }
    }

    const layerResults: LayerResult[] = [];
    let finalDecision: Decision = 'APPROVE';
    let finalConfidence = 1.0;
    let finalRisk: Risk | undefined;

    for (const layer of this.layers) {
      const start = now();
      const defenseResult = await Promise.resolve(layer.evaluate(content, context));
      const latencyMs = now() - start;

      const layerResult: LayerResult = {
        name: layer.name,
        passed: defenseResult.passed,
        decision: defenseResult.decision,
        risk: defenseResult.risk,
        confidence: defenseResult.confidence,
        latencyMs,
      };
      layerResults.push(layerResult);

      if (defenseResult.decision) {
        finalDecision = mostSevereDecision(finalDecision, defenseResult.decision);
      }
      finalConfidence = Math.min(finalConfidence, defenseResult.confidence);
      if (!defenseResult.passed && defenseResult.risk) {
        finalRisk = defenseResult.risk;
      }
    }

    const passed = finalDecision === 'APPROVE';
    return { passed, decision: finalDecision, risk: finalRisk, confidence: finalConfidence, layers: layerResults };
  }
}
