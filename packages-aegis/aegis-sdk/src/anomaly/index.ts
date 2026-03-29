// ============================================================
// Anomaly Detection Engine — Z-Score, Moving Average, IQR,
// simplified Isolation Forest
// ============================================================

export type AnomalyAlgorithm = 'z_score' | 'moving_average' | 'iqr' | 'isolation_forest';
export type MetricType = 'block_rate' | 'latency' | 'risk_score' | 'request_count' | 'error_rate' | 'confidence';

export interface AnomalyResult {
  timestamp: number;
  value: number;
  isAnomaly: boolean;
  anomalyScore: number;
  confidence: number;
}

export interface AnomalyStats {
  totalPoints: number;
  anomalyCount: number;
  anomalyRate: number;
  meanScore: number;
  maxScore: number;
}

export interface DetectorConfig {
  algorithm: AnomalyAlgorithm;
  windowSize?: number;
  threshold?: number;
  contamination?: number;
}

// --- Internal helpers ---

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sumSq = arr.reduce((a, b) => a + (b - m) ** 2, 0);
  return Math.sqrt(sumSq / (arr.length - 1));
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

/**
 * Z-Score detection: z = |value - mean| / std
 * Anomaly if z > threshold (default 3.0).
 */
function detectZScore(
  value: number,
  history: number[],
  threshold: number,
): { score: number; isAnomaly: boolean; confidence: number } {
  if (history.length < 2) {
    return { score: 0, isAnomaly: false, confidence: 0 };
  }
  const m = mean(history);
  const s = stddev(history);
  if (s === 0) {
    const isAnomaly = value !== m;
    return { score: isAnomaly ? threshold + 1 : 0, isAnomaly, confidence: isAnomaly ? 1.0 : 0 };
  }
  const z = Math.abs(value - m) / s;
  const isAnomaly = z > threshold;
  // Confidence: how far past the threshold we are, clamped to [0,1]
  const confidence = isAnomaly ? Math.min(1, (z - threshold) / threshold + 0.5) : Math.max(0, z / threshold * 0.5);
  return { score: z, isAnomaly, confidence };
}

/**
 * Moving Average detection: deviation from rolling window mean.
 * Anomaly if |value - windowMean| > threshold * windowStd.
 */
function detectMovingAverage(
  value: number,
  history: number[],
  windowSize: number,
  threshold: number,
): { score: number; isAnomaly: boolean; confidence: number } {
  const window = history.slice(-windowSize);
  if (window.length < 2) {
    return { score: 0, isAnomaly: false, confidence: 0 };
  }
  const m = mean(window);
  const s = stddev(window);
  if (s === 0) {
    const isAnomaly = value !== m;
    return { score: isAnomaly ? threshold + 1 : 0, isAnomaly, confidence: isAnomaly ? 1.0 : 0 };
  }
  const deviation = Math.abs(value - m) / s;
  const isAnomaly = deviation > threshold;
  const confidence = isAnomaly ? Math.min(1, (deviation - threshold) / threshold + 0.5) : Math.max(0, deviation / threshold * 0.5);
  return { score: deviation, isAnomaly, confidence };
}

/**
 * IQR detection: 1.5 * IQR beyond Q1/Q3.
 * Score is the distance past the fence, normalized.
 */
function detectIqr(
  value: number,
  history: number[],
  threshold: number,
): { score: number; isAnomaly: boolean; confidence: number } {
  if (history.length < 4) {
    return { score: 0, isAnomaly: false, confidence: 0 };
  }
  const sorted = [...history].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;

  if (iqr === 0) {
    const isAnomaly = value < q1 || value > q3;
    return { score: isAnomaly ? 1 : 0, isAnomaly, confidence: isAnomaly ? 0.8 : 0 };
  }

  const multiplier = threshold; // default 1.5
  const lowerFence = q1 - multiplier * iqr;
  const upperFence = q3 + multiplier * iqr;
  const isAnomaly = value < lowerFence || value > upperFence;

  let score = 0;
  if (value < lowerFence) {
    score = (lowerFence - value) / iqr;
  } else if (value > upperFence) {
    score = (value - upperFence) / iqr;
  }

  const confidence = isAnomaly ? Math.min(1, 0.5 + score * 0.25) : Math.max(0, 0.5 - score * 0.1);
  return { score, isAnomaly, confidence };
}

/**
 * Simplified Isolation Forest scoring.
 * For each "tree", randomly pick a split dimension (here we have 1D)
 * and measure how quickly the value gets isolated.
 * Average path length is inversely proportional to anomaly score.
 */
function detectIsolationForest(
  value: number,
  history: number[],
  contamination: number,
): { score: number; isAnomaly: boolean; confidence: number } {
  if (history.length < 4) {
    return { score: 0, isAnomaly: false, confidence: 0 };
  }

  const numTrees = 100;
  const sampleSize = Math.min(history.length, 256);

  // Expected path length for a BST of n nodes
  const harmonicNumber = (n: number): number => {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  };

  const expectedPathLength = harmonicNumber(sampleSize);
  let totalPath = 0;

  // Seeded PRNG for deterministic results given same inputs
  let seed = history.reduce((s, v) => ((s * 31 + Math.round(v * 1000)) | 0), 42);
  const nextRand = (): number => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 0xffffffff;
  };

  for (let t = 0; t < numTrees; t++) {
    // Sample subset
    const sample: number[] = [];
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor(nextRand() * history.length);
      sample.push(history[idx]);
    }

    // Simulate isolation path length for `value`
    let pathLength = 0;
    let remaining = [...sample];
    const maxDepth = Math.ceil(Math.log2(sampleSize));

    while (remaining.length > 1 && pathLength < maxDepth) {
      const min = Math.min(...remaining);
      const max = Math.max(...remaining);
      if (min === max) break;

      const splitPoint = min + nextRand() * (max - min);
      if (value <= splitPoint) {
        remaining = remaining.filter((v) => v <= splitPoint);
      } else {
        remaining = remaining.filter((v) => v > splitPoint);
      }
      pathLength++;
    }

    totalPath += pathLength;
  }

  const avgPath = totalPath / numTrees;
  // Anomaly score: 2^(-avgPath / expectedPathLength)
  const anomalyScore = expectedPathLength > 0
    ? Math.pow(2, -avgPath / expectedPathLength)
    : 0;

  // Determine threshold from contamination rate
  // Higher contamination -> lower threshold -> more anomalies detected
  const scoreThreshold = 1 - contamination;
  const isAnomaly = anomalyScore > scoreThreshold;
  const confidence = isAnomaly ? Math.min(1, anomalyScore) : Math.max(0, anomalyScore * 0.8);

  return { score: anomalyScore, isAnomaly, confidence };
}

export class AnomalyEngine {
  private config: Required<DetectorConfig>;
  private results: AnomalyResult[] = [];

  constructor(config?: DetectorConfig) {
    this.config = {
      algorithm: config?.algorithm ?? 'z_score',
      windowSize: config?.windowSize ?? 50,
      threshold: config?.threshold ?? (config?.algorithm === 'iqr' ? 1.5 : 3.0),
      contamination: config?.contamination ?? 0.1,
    };
  }

  /**
   * Detect whether a single value is anomalous given its history.
   */
  detect(value: number, history: number[], timestamp?: number): AnomalyResult {
    const ts = timestamp ?? Date.now();
    let detection: { score: number; isAnomaly: boolean; confidence: number };

    switch (this.config.algorithm) {
      case 'z_score':
        detection = detectZScore(value, history, this.config.threshold);
        break;
      case 'moving_average':
        detection = detectMovingAverage(value, history, this.config.windowSize, this.config.threshold);
        break;
      case 'iqr':
        detection = detectIqr(value, history, this.config.threshold);
        break;
      case 'isolation_forest':
        detection = detectIsolationForest(value, history, this.config.contamination);
        break;
      default:
        detection = detectZScore(value, history, this.config.threshold);
    }

    const result: AnomalyResult = {
      timestamp: ts,
      value,
      isAnomaly: detection.isAnomaly,
      anomalyScore: detection.score,
      confidence: detection.confidence,
    };

    this.results.push(result);
    return result;
  }

  /**
   * Detect anomalies across a time series.
   * Uses a growing window: for each point, prior points serve as history.
   */
  detectBatch(series: Array<{ value: number; timestamp: number }>): AnomalyResult[] {
    const results: AnomalyResult[] = [];
    const values: number[] = [];

    for (const point of series) {
      const result = this.detect(point.value, [...values], point.timestamp);
      results.push(result);
      values.push(point.value);
    }

    return results;
  }

  /**
   * Return aggregate statistics for all detections performed so far.
   */
  stats(): AnomalyStats {
    const total = this.results.length;
    if (total === 0) {
      return { totalPoints: 0, anomalyCount: 0, anomalyRate: 0, meanScore: 0, maxScore: 0 };
    }

    const anomalies = this.results.filter((r) => r.isAnomaly).length;
    const scores = this.results.map((r) => r.anomalyScore);
    const meanScore = scores.reduce((a, b) => a + b, 0) / total;
    const maxScore = Math.max(...scores);

    return {
      totalPoints: total,
      anomalyCount: anomalies,
      anomalyRate: anomalies / total,
      meanScore,
      maxScore,
    };
  }

  /**
   * Reset internal state.
   */
  reset(): void {
    this.results = [];
  }
}
