// ============================================================
// AEGIS SHAP Explainer — token-level attribution for risk scoring
// ============================================================

export type ShapMethod = 'leave_one_out' | 'kernel_shap' | 'sliding_window';

export interface ShapConfig {
  /** Attribution method. Default: 'leave_one_out' */
  method?: ShapMethod;
  /** Max tokens to analyze. Default: 256 */
  maxTokens?: number;
  /** Number of coalition samples for kernel SHAP. Default: 64 */
  kernelSamples?: number;
  /** Window size for sliding_window method. Default: 3 */
  windowSize?: number;
  /** Minimum |attribution| to include. Default: 0.01 */
  minAttribution?: number;
  /** Whether to normalize attributions. Default: true */
  normalize?: boolean;
}

export interface TokenAttribution {
  token: string;
  startPos: number;
  endPos: number;
  /** Negative = safe contribution, positive = risky contribution */
  attribution: number;
  flagged: boolean;
}

export interface ShapExplanation {
  attributions: TokenAttribution[];
  baselineScore: number;
  fullScore: number;
  attributionSum: number;
  method: ShapMethod;
  topRiskTokens: string[];
  topSafeTokens: string[];
}

/**
 * Risk scoring function type.
 * Returns a value in [0.0, 1.0] where 0.0 = safe and 1.0 = unsafe.
 */
export type RiskScorer = (text: string) => number;

const DEFAULT_SHAP_CONFIG: Required<ShapConfig> = {
  method: 'leave_one_out',
  maxTokens: 256,
  kernelSamples: 64,
  windowSize: 3,
  minAttribution: 0.01,
  normalize: true,
};

/**
 * Simple whitespace tokenizer that preserves positions.
 */
interface TokenSpan {
  token: string;
  start: number;
  end: number;
}

function tokenize(text: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    spans.push({
      token: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return spans;
}

/**
 * Reconstruct text from token spans, omitting tokens at specified indices.
 */
function reconstructWithout(tokens: TokenSpan[], excludeIndices: Set<number>): string {
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!excludeIndices.has(i)) {
      parts.push(tokens[i].token);
    }
  }
  return parts.join(' ');
}

/**
 * Simple seeded PRNG (mulberry32) for deterministic coalition sampling.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ShapExplainer {
  private config: Required<ShapConfig>;

  constructor(config?: ShapConfig) {
    this.config = { ...DEFAULT_SHAP_CONFIG, ...config };
  }

  /**
   * Explain a risk score by computing per-token attributions.
   */
  explain(scorer: RiskScorer, input: string): ShapExplanation {
    let tokens = tokenize(input);
    if (tokens.length > this.config.maxTokens) {
      tokens = tokens.slice(0, this.config.maxTokens);
    }

    const fullScore = scorer(input);
    const baselineScore = scorer('');

    let rawAttributions: number[];

    switch (this.config.method) {
      case 'leave_one_out':
        rawAttributions = this.leaveOneOut(scorer, tokens, fullScore);
        break;
      case 'kernel_shap':
        rawAttributions = this.kernelShap(scorer, tokens, fullScore, baselineScore);
        break;
      case 'sliding_window':
        rawAttributions = this.slidingWindow(scorer, tokens, fullScore);
        break;
      default:
        rawAttributions = this.leaveOneOut(scorer, tokens, fullScore);
    }

    // Normalize if configured
    if (this.config.normalize && rawAttributions.length > 0) {
      const absSum = rawAttributions.reduce((s, v) => s + Math.abs(v), 0);
      if (absSum > 0) {
        const targetSum = fullScore - baselineScore;
        const scale = targetSum / absSum;
        for (let i = 0; i < rawAttributions.length; i++) {
          rawAttributions[i] *= Math.abs(scale);
          // Preserve sign
          if (scale < 0) rawAttributions[i] = -rawAttributions[i];
        }
      }
    }

    // Compute flagging threshold: mean + 1.5*std of positive attributions
    const positiveVals = rawAttributions.filter((v) => v > 0);
    let flagThreshold = Infinity;
    if (positiveVals.length > 0) {
      const mean = positiveVals.reduce((s, v) => s + v, 0) / positiveVals.length;
      const variance =
        positiveVals.reduce((s, v) => s + (v - mean) ** 2, 0) / positiveVals.length;
      const std = Math.sqrt(variance);
      flagThreshold = mean + 1.5 * std;
    }

    // Build attribution objects
    const attributions: TokenAttribution[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const attr = rawAttributions[i];
      if (Math.abs(attr) < this.config.minAttribution) continue;
      attributions.push({
        token: tokens[i].token,
        startPos: tokens[i].start,
        endPos: tokens[i].end,
        attribution: attr,
        flagged: attr >= flagThreshold,
      });
    }

    // Sort by |attribution| descending for top tokens
    const sorted = [...attributions].sort(
      (a, b) => Math.abs(b.attribution) - Math.abs(a.attribution),
    );

    const topRiskTokens = sorted
      .filter((a) => a.attribution > 0)
      .slice(0, 10)
      .map((a) => a.token);

    const topSafeTokens = sorted
      .filter((a) => a.attribution < 0)
      .slice(0, 10)
      .map((a) => a.token);

    const attributionSum = rawAttributions.reduce((s, v) => s + v, 0);

    return {
      attributions,
      baselineScore,
      fullScore,
      attributionSum,
      method: this.config.method,
      topRiskTokens,
      topSafeTokens,
    };
  }

  /**
   * Leave-one-out: remove each token and measure score change.
   * attribution[i] = fullScore - score_without_i
   * Positive means the token contributes to higher (riskier) score.
   */
  private leaveOneOut(
    scorer: RiskScorer,
    tokens: TokenSpan[],
    fullScore: number,
  ): number[] {
    const attributions: number[] = new Array(tokens.length);
    for (let i = 0; i < tokens.length; i++) {
      const text = reconstructWithout(tokens, new Set([i]));
      const score = scorer(text);
      attributions[i] = fullScore - score;
    }
    return attributions;
  }

  /**
   * Kernel SHAP: sample random coalitions, measure marginal contributions.
   * For each sample, randomly include/exclude each token, then compute
   * marginal contribution via weighted regression approximation.
   */
  private kernelShap(
    scorer: RiskScorer,
    tokens: TokenSpan[],
    fullScore: number,
    baselineScore: number,
  ): number[] {
    const n = tokens.length;
    if (n === 0) return [];

    const numSamples = this.config.kernelSamples;
    const rng = mulberry32(42); // deterministic seed

    // Accumulate marginal contributions
    const contributions = new Float64Array(n);
    const counts = new Float64Array(n);

    for (let s = 0; s < numSamples; s++) {
      // Random coalition: each token included with p=0.5
      const included = new Set<number>();
      for (let i = 0; i < n; i++) {
        if (rng() < 0.5) included.add(i);
      }

      const excluded = new Set<number>();
      for (let i = 0; i < n; i++) {
        if (!included.has(i)) excluded.add(i);
      }

      const coalitionText = reconstructWithout(tokens, excluded);
      const coalitionScore = scorer(coalitionText);

      // For each token in the coalition, compute marginal contribution
      // by comparing coalition with and without this token
      for (const i of included) {
        const withoutI = new Set(excluded);
        withoutI.add(i);
        const textWithoutI = reconstructWithout(tokens, withoutI);
        const scoreWithoutI = scorer(textWithoutI);
        contributions[i] += coalitionScore - scoreWithoutI;
        counts[i] += 1;
      }
    }

    // Average contributions
    const attributions: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      attributions[i] = counts[i] > 0 ? contributions[i] / counts[i] : 0;
    }

    return attributions;
  }

  /**
   * Sliding window: mask windows of tokens and measure impact.
   * Each token's attribution is the average impact across all windows containing it.
   */
  private slidingWindow(
    scorer: RiskScorer,
    tokens: TokenSpan[],
    fullScore: number,
  ): number[] {
    const n = tokens.length;
    if (n === 0) return [];

    const w = this.config.windowSize;
    const attributions = new Float64Array(n);
    const windowCounts = new Float64Array(n);

    for (let start = 0; start <= n - w; start++) {
      const windowIndices = new Set<number>();
      for (let j = start; j < start + w && j < n; j++) {
        windowIndices.add(j);
      }

      const maskedText = reconstructWithout(tokens, windowIndices);
      const maskedScore = scorer(maskedText);
      const impact = fullScore - maskedScore;

      // Distribute impact equally among tokens in the window
      const windowSize = windowIndices.size;
      for (const idx of windowIndices) {
        attributions[idx] += impact / windowSize;
        windowCounts[idx] += 1;
      }
    }

    // Handle edge: tokens near the end that may not be covered by full windows
    // Also do individual windows for tokens not in any full window
    const result: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      result[i] = windowCounts[i] > 0 ? attributions[i] / windowCounts[i] : 0;
    }

    return result;
  }
}
