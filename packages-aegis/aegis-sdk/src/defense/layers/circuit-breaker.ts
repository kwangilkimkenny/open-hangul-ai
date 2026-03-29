// ============================================================
// AEGIS Layer 4: Circuit Breaker — Rate Limiting & Anomaly Detection
// Ported from libs/aegis-defense/src/layers/circuit_breaker.rs
// ============================================================

import type { DefenseResult, Risk } from '../../core/types';
import type { DefenseLayer } from '../paladin';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CircuitBreakerConfig {
  /** Number of failures before circuit opens */
  failureThreshold: number;
  /** Number of successes in half-open before circuit closes */
  successThreshold: number;
  /** Duration in ms the circuit stays open before moving to half-open */
  openDurationMs: number;
  /** Sliding window in ms for counting failures */
  failureWindowMs: number;
  /** Maximum requests per second */
  maxRps: number;
  /** Z-score threshold for anomaly detection */
  anomalyThreshold: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  openDurationMs: 30_000,
  failureWindowMs: 60_000,
  maxRps: 1_000,
  anomalyThreshold: 3.0,
};

// ---------------------------------------------------------------------------
// Circuit state machine
// ---------------------------------------------------------------------------

export type CircuitState = 'closed' | 'open' | 'half_open';

interface FailureRecord {
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Anomaly detector (z-score)
// ---------------------------------------------------------------------------

class AnomalyDetector {
  private values: number[] = [];
  private readonly threshold: number;
  private readonly minDataPoints = 10;

  constructor(threshold: number) {
    this.threshold = threshold;
  }

  /** Record a new data point and return whether it is anomalous. */
  push(value: number): boolean {
    this.values.push(value);
    // Keep a reasonable rolling window
    if (this.values.length > 1000) {
      this.values = this.values.slice(-500);
    }
    return this.isAnomaly(value);
  }

  isAnomaly(value: number): boolean {
    if (this.values.length < this.minDataPoints) return false;
    const mean = this.mean();
    const std = this.stdDev(mean);
    if (std === 0) return value !== mean;
    const zScore = Math.abs(value - mean) / std;
    return zScore > this.threshold;
  }

  private mean(): number {
    let sum = 0;
    for (const v of this.values) sum += v;
    return sum / this.values.length;
  }

  private stdDev(mean: number): number {
    let sumSq = 0;
    for (const v of this.values) {
      const diff = v - mean;
      sumSq += diff * diff;
    }
    return Math.sqrt(sumSq / this.values.length);
  }

  getStats(): { mean: number; stdDev: number; count: number } {
    const m = this.mean();
    return { mean: m, stdDev: this.stdDev(m), count: this.values.length };
  }
}

// ---------------------------------------------------------------------------
// Rate limiter (token-bucket style per-second counter)
// ---------------------------------------------------------------------------

class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRps: number;

  constructor(maxRps: number) {
    this.maxRps = maxRps;
  }

  /** Returns true if the request is within rate limits. */
  allow(now: number): boolean {
    // Purge timestamps older than 1 second
    const cutoff = now - 1000;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    if (this.timestamps.length >= this.maxRps) return false;
    this.timestamps.push(now);
    return true;
  }

  getCurrentRps(): number {
    const cutoff = Date.now() - 1000;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    return this.timestamps.length;
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker Layer
// ---------------------------------------------------------------------------

export class CircuitBreakerLayer implements DefenseLayer {
  readonly name = 'circuit_breaker';
  readonly priority = 4;
  private cfg: CircuitBreakerConfig;

  private state: CircuitState = 'closed';
  private failures: FailureRecord[] = [];
  private halfOpenSuccesses = 0;
  private openedAt = 0;

  private rateLimiter: RateLimiter;
  private anomalyDetector: AnomalyDetector;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.rateLimiter = new RateLimiter(this.cfg.maxRps);
    this.anomalyDetector = new AnomalyDetector(this.cfg.anomalyThreshold);
  }

  /** Get the current circuit state. */
  getState(): CircuitState {
    this.maybeTransition();
    return this.state;
  }

  /** Manually record a success (for external callers). */
  recordSuccess(): void {
    this.onSuccess();
  }

  /** Manually record a failure (for external callers). */
  recordFailure(): void {
    this.onFailure();
  }

  /** Reset the circuit to closed. */
  reset(): void {
    this.state = 'closed';
    this.failures = [];
    this.halfOpenSuccesses = 0;
    this.openedAt = 0;
  }

  // -----------------------------------------------------------------------
  // DefenseLayer implementation
  // -----------------------------------------------------------------------

  evaluate(content: string, context: Record<string, unknown>): DefenseResult {
    const now = Date.now();
    const details: Record<string, unknown> = {};

    // --- State transition check ---
    this.maybeTransition();
    details['circuitState'] = this.state;

    // --- Rate limiting ---
    if (!this.rateLimiter.allow(now)) {
      details['rateLimited'] = true;
      details['currentRps'] = this.rateLimiter.getCurrentRps();
      return this.throttle('Rate limit exceeded', details);
    }

    // --- Circuit open? ---
    if (this.state === 'open') {
      details['openedAt'] = this.openedAt;
      details['remainingMs'] = Math.max(0, (this.openedAt + this.cfg.openDurationMs) - now);
      return this.block('Circuit breaker is open — too many recent failures', details);
    }

    // --- Anomaly detection on content length ---
    const contentLength = content.length;
    const isAnomaly = this.anomalyDetector.push(contentLength);
    details['contentLengthAnomaly'] = isAnomaly;
    if (isAnomaly) {
      const stats = this.anomalyDetector.getStats();
      details['anomalyStats'] = stats;
    }

    // --- Anomaly detection on request frequency (from context) ---
    const requestScore = (context['requestScore'] as number | undefined) ?? 0;
    if (requestScore > 0) {
      const riskAnomaly = this.anomalyDetector.push(requestScore);
      details['riskScoreAnomaly'] = riskAnomaly;
    }

    // --- Half-open: allow but watch closely ---
    if (this.state === 'half_open') {
      details['halfOpenSuccesses'] = this.halfOpenSuccesses;
      details['halfOpenRequired'] = this.cfg.successThreshold;
    }

    // If anomaly detected in content length, escalate
    if (isAnomaly) {
      this.onFailure();
      return {
        layer: this.name,
        passed: false,
        decision: 'ESCALATE',
        risk: {
          label: 'anomaly_detected',
          severity: 'medium',
          description: 'Statistical anomaly detected in request pattern',
          score: 0.7,
          categories: [{ name: 'anomaly', confidence: 0.7 }],
        },
        confidence: 0.7,
        details,
      };
    }

    // Record success
    this.onSuccess();

    return {
      layer: this.name,
      passed: true,
      confidence: 1.0,
      details,
    };
  }

  // -----------------------------------------------------------------------
  // State machine
  // -----------------------------------------------------------------------

  private maybeTransition(): void {
    const now = Date.now();
    if (this.state === 'open') {
      if (now - this.openedAt >= this.cfg.openDurationMs) {
        this.state = 'half_open';
        this.halfOpenSuccesses = 0;
      }
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.failures.push({ timestamp: now });

    // Purge old failures outside window
    const cutoff = now - this.cfg.failureWindowMs;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);

    if (this.state === 'half_open') {
      // Any failure in half-open goes back to open
      this.state = 'open';
      this.openedAt = now;
      this.halfOpenSuccesses = 0;
      return;
    }

    if (this.state === 'closed' && this.failures.length >= this.cfg.failureThreshold) {
      this.state = 'open';
      this.openedAt = now;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.cfg.successThreshold) {
        this.state = 'closed';
        this.failures = [];
        this.halfOpenSuccesses = 0;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Result builders
  // -----------------------------------------------------------------------

  private block(description: string, details: Record<string, unknown>): DefenseResult {
    const risk: Risk = {
      label: 'circuit_breaker_open',
      severity: 'high',
      description,
      score: 0.95,
      categories: [{ name: 'rate_limiting', confidence: 0.95 }],
    };
    return {
      layer: this.name,
      passed: false,
      decision: 'BLOCK',
      risk,
      confidence: 0.95,
      details,
    };
  }

  private throttle(description: string, details: Record<string, unknown>): DefenseResult {
    const risk: Risk = {
      label: 'rate_limit_exceeded',
      severity: 'medium',
      description,
      score: 0.8,
      categories: [{ name: 'rate_limiting', confidence: 0.9 }],
    };
    return {
      layer: this.name,
      passed: false,
      decision: 'THROTTLE',
      risk,
      confidence: 0.9,
      details,
    };
  }
}
