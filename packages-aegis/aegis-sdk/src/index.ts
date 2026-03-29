// ============================================================
// @anthropic-aegis/sdk — AEGIS AI Security SDK v5.2.0
// Complete offline/online defense engine for LLM applications
// ============================================================

// --- Core Types & Config ---
export * from './core/types';
export * from './core/error';
export * from './core/config';

// --- Client SDK (Online Mode) ---
export { AegisClient } from './client/aegis-client';
export type { JudgeRequest, JudgeResponse } from './client/aegis-client';
export { aegisMiddleware, checkInputMiddleware, checkOutputMiddleware } from './client/middleware';
export type { AegisMiddlewareOptions } from './client/middleware';
export { withRetry } from './client/retry';
export type { RetryConfig } from './client/retry';

// --- Defense Engine (Offline Mode) ---
export { Paladin } from './defense/paladin';
export type { DefenseLayer } from './defense/paladin';
export { TrustBoundaryLayer } from './defense/layers/trust-boundary';
export { IntentVerificationLayer } from './defense/layers/intent-verification';
export { CircuitBreakerLayer } from './defense/layers/circuit-breaker';
export { BehavioralAnalysisLayer } from './defense/layers/behavioral-analysis';
export { OutputFilter } from './defense/output-filter';
export { OutputGuard } from './defense/output-guard';
export { StreamingFilter } from './defense/streaming-filter';
export { SessionTracker } from './defense/session-tracker';

// --- Patterns ---
export { ALL_PATTERNS, checkPatterns, CATEGORY_SEVERITY } from './defense/patterns/index';
export type { PatternEntry } from './defense/patterns/index';
export { CREDENTIAL_PATTERNS } from './defense/patterns/credentials';
export { containsHomoglyphs, normalizeHomoglyphs, homoglyphRatio } from './defense/patterns/homoglyphs';

// --- Privacy ---
export { PiiScanner } from './privacy/pii-scanner';
export { PiiProxyEngine } from './privacy/pii-proxy';
export type { PiiProxyConfig } from './privacy/pii-proxy';
export { DlpGateway } from './privacy/dlp';

// --- Korean/CJK Defense ---
export { KoreanDefenseAnalyzer, HARMFUL_WORDS } from './korean/index';

// --- SABER Statistical Modeling ---
export { SaberEstimator } from './saber/beta-model';
export { DeterministicDefenseManager } from './saber/deterministic';
export type { SaberReport, BetaVulnerabilityModel, QueryTrials, HardRefusalResult } from './saber/types';

// --- Anomaly Detection ---
export { AnomalyEngine } from './anomaly/index';

// --- Watermarking ---
export { WatermarkEngine } from './watermark/watermark-engine';
export { ZeroWidthEncoder } from './watermark/zero-width';

// --- Canary Tokens ---
export { CanaryRegistry } from './canary/canary-registry';

// --- Steganography Detection ---
export { StegoScanner } from './steganography/stego-scanner';

// --- Leakage Detection ---
export { LeakageDetector } from './leakage/leakage-detector';

// --- Taint Tracking ---
export { TaintTracker } from './taint/taint-tracker';

// --- Session Fingerprinting ---
export { SessionFingerprinter } from './session/session-fingerprint';

// --- Provenance Chain ---
export { ProvenanceChain } from './provenance/provenance-chain';

// --- Adaptive Defense ---
export { AdaptiveDefenseManager } from './adaptive/adaptive-defense';

// --- ML Abstractions ---
export { EmbeddingService, cosineSimilarity, dotProduct, euclideanDistance, l2Normalize } from './ml/embedding';
export { HeuristicClassifier } from './ml/classifier';
export { VectorStore } from './ml/vector-store';
export { ShapExplainer } from './ml/shap';
export type { ShapExplanation, RiskScorer } from './ml/shap';

// --- Provider Profiles ---
export { PROVIDER_PROFILES, getProviderProfile, getProfileForModel } from './provider/profiles';

// ============================================================
// Convenience: AEGIS All-in-One Engine
// ============================================================

import { Paladin } from './defense/paladin';
import { PiiScanner } from './privacy/pii-scanner';
import { PiiProxyEngine } from './privacy/pii-proxy';
import { KoreanDefenseAnalyzer } from './korean/index';
import { OutputFilter } from './defense/output-filter';
import { OutputGuard } from './defense/output-guard';
import { AegisClient } from './client/aegis-client';
import { DEFAULT_CONFIG, mergeConfig } from './core/config';
import type { AegisConfig } from './core/config';
import type { Decision, ScanResult, PiiMatch, RiskLevel } from './core/types';
import { DecisionPriority } from './core/types';

/**
 * AEGIS — All-in-one defense engine.
 *
 * Supports both offline (local pattern/rule-based) and online (remote API) modes.
 *
 * Usage:
 * ```ts
 * const aegis = new Aegis({ offline: true, blockThreshold: 60 });
 * const result = aegis.scan('user prompt text');
 * if (result.blocked) { // reject }
 * ```
 */
export class Aegis {
  private config: AegisConfig;
  private paladin: Paladin;
  private piiScanner: PiiScanner;
  private piiProxy: PiiProxyEngine;
  private koreanAnalyzer: KoreanDefenseAnalyzer;
  private outputFilter: OutputFilter;
  private outputGuard: OutputGuard;
  private client?: AegisClient;

  constructor(config?: Partial<AegisConfig>) {
    this.config = mergeConfig(DEFAULT_CONFIG, config || {});
    this.paladin = new Paladin(this.config);
    this.piiScanner = new PiiScanner(this.config.pii);
    this.piiProxy = new PiiProxyEngine();
    this.koreanAnalyzer = new KoreanDefenseAnalyzer();
    this.outputFilter = new OutputFilter(this.config.output);
    this.outputGuard = new OutputGuard();

    if (this.config.serverUrl && this.config.apiKey) {
      this.client = new AegisClient(this.config);
    }
  }

  /**
   * Scan input text for threats (offline mode).
   * Returns a comprehensive ScanResult with decision, risk level, and PII matches.
   */
  scan(input: string, context?: Record<string, unknown>): ScanResult {
    const startTime = Date.now();

    // 1. PALADIN defense layers
    const paladinResult = this.paladin.evaluate(input, context);

    // 2. Korean defense analysis
    const koreanResult = this.koreanAnalyzer.analyze(input);

    // 3. PII scanning
    const piiMatches = this.piiScanner.scan(input);

    // 4. Calculate combined score
    const koreanScore = koreanResult.maxRiskScore * 100;
    const piiScore = Math.min(piiMatches.length * 15, 30);
    const layerScore = paladinResult.passed ? 0 : 50;
    const rawScore = Math.min(layerScore + koreanScore + piiScore, 100);
    const score = Math.min(rawScore * (this.config.sensitivity || 1.0), 100);

    // 5. Determine risk level and decision
    const level = this.scoreToLevel(score);
    const blocked = score >= (this.config.blockThreshold || 60);

    // 6. Aggregate decisions
    let decision: Decision = paladinResult.decision;
    if (blocked && decision === 'APPROVE') {
      decision = 'BLOCK';
    }

    // 7. Collect categories
    const categories: string[] = [];
    if (koreanResult.detected) categories.push('korean_evasion');
    if (piiMatches.length > 0) categories.push('pii_exposure');
    if (!paladinResult.passed) {
      const risk = paladinResult.risk;
      if (risk) categories.push(risk.label);
    }

    const totalLatencyMs = Date.now() - startTime;

    return {
      id: crypto.randomUUID?.() || `scan-${Date.now()}`,
      timestamp: Date.now(),
      input,
      score,
      level,
      categories: [...new Set(categories)],
      explanation: this.buildExplanation(paladinResult, { detected: koreanResult.detected, riskScore: koreanResult.maxRiskScore }, piiMatches),
      blocked,
      layers: paladinResult.layers.map((l, i) => ({
        id: i,
        name: l.name,
        score: l.passed ? 0 : (l.confidence * 100),
        maxScore: 100,
        detected: !l.passed,
        categories: l.risk ? [l.risk.label] : [],
        latencyMs: l.latencyMs,
      })),
      totalLatencyMs,
      piiDetected: piiMatches,
      decision,
    };
  }

  /**
   * Scan LLM output for credential leaks, PII, harmful content.
   */
  scanOutput(output: string): { safe: boolean; filtered: string; detections: string[] } {
    const filterResult = this.outputFilter.filter(output);
    const guardResult = this.outputGuard.analyze(output);

    return {
      safe: guardResult.decision === 'ALLOW' && filterResult.detections.length === 0,
      filtered: filterResult.filteredContent,
      detections: [
        ...filterResult.detections.map(d => `${d.type}: ${d.matchedText}`),
        ...(guardResult.decision !== 'ALLOW' ? [`output_guard: ${guardResult.details.join('; ')}`] : []),
      ],
    };
  }

  /**
   * Pseudonymize PII in text (format-preserving).
   */
  pseudonymize(text: string, sessionId?: string) {
    return this.piiProxy.pseudonymize(text, {
      enabled: true,
      mode: this.config.pii?.proxyMode || 'auto',
    }, sessionId);
  }

  /**
   * Restore pseudonymized PII back to originals.
   */
  restore(text: string, sessionId: string): string {
    return this.piiProxy.restore(text, sessionId);
  }

  /**
   * Online mode: call remote AEGIS server for judgment.
   */
  async judge(prompt: string, options?: { scenario?: string; enablePiiScan?: boolean }) {
    if (!this.client) {
      throw new Error('Online mode requires serverUrl and apiKey in config');
    }
    return this.client.judge({ prompt, options });
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score >= 60) return 'critical';
    if (score >= 40) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  private buildExplanation(
    paladin: { passed: boolean; risk?: { label: string; description: string } | null },
    korean: { detected: boolean; riskScore: number },
    pii: PiiMatch[],
  ): string {
    const parts: string[] = [];
    if (!paladin.passed && paladin.risk) {
      parts.push(`Defense: ${paladin.risk.description}`);
    }
    if (korean.detected) {
      parts.push(`Korean evasion detected (risk: ${(korean.riskScore * 100).toFixed(0)}%)`);
    }
    if (pii.length > 0) {
      parts.push(`PII detected: ${pii.map(p => p.type).join(', ')}`);
    }
    return parts.length > 0 ? parts.join('; ') : 'No threats detected';
  }
}
