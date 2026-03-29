// ============================================================
// Watermark Engine — Green/Red Token Partitioning
// Ported from libs/aegis-defense/src/watermark/
// ============================================================

export interface WatermarkConfig {
  hashKey: string;
  greenListRatio: number;
  windowSize: number;
}

export interface WatermarkDetectionResult {
  isWatermarked: boolean;
  zScore: number;
  greenCount: number;
  totalTokens: number;
  greenRatio: number;
  pValue: number;
  confidence: number;
}

const DEFAULT_CONFIG: WatermarkConfig = {
  hashKey: 'aegis-watermark-default-key',
  greenListRatio: 0.5,
  windowSize: 1,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const TextEncoder: { new(): { encode(s: string): Uint8Array } };
declare const crypto: { subtle?: { digest(algo: string, data: Uint8Array): Promise<ArrayBuffer> } } | undefined;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Simple SHA-256 hash using Web Crypto or fallback.
 * Returns a Uint8Array of 32 bytes.
 */
async function sha256(input: string): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }
  // Fallback: simple deterministic hash (not cryptographically secure)
  return fallbackHash(input);
}

function sha256Sync(input: string): Uint8Array {
  return fallbackHash(input);
}

/**
 * Fallback hash for environments without Web Crypto.
 * Produces 32 bytes of deterministic output.
 */
function fallbackHash(input: string): Uint8Array {
  const result = new Uint8Array(32);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h0 = (h0 ^ c) * 0x01000193;
    h1 = (h1 ^ (c >> 1)) * 0x01000193;
    h2 = (h2 ^ (c << 1)) * 0x01000193;
    h3 = (h3 ^ (c + i)) * 0x01000193;
    h4 = (h4 + c) ^ (h4 >>> 13);
    h5 = (h5 ^ c) + (h5 << 7);
    h6 = (h6 + c * 31) ^ (h6 >>> 17);
    h7 = (h7 ^ (c + i * 37)) + (h7 << 5);
  }

  const view = new DataView(result.buffer);
  view.setUint32(0, h0 >>> 0);
  view.setUint32(4, h1 >>> 0);
  view.setUint32(8, h2 >>> 0);
  view.setUint32(12, h3 >>> 0);
  view.setUint32(16, h4 >>> 0);
  view.setUint32(20, h5 >>> 0);
  view.setUint32(24, h6 >>> 0);
  view.setUint32(28, h7 >>> 0);
  return result;
}

/**
 * Convert hash bytes to a number in [0, 1).
 */
function hashToFraction(hash: Uint8Array): number {
  // Use first 4 bytes as uint32
  const val = (hash[0] << 24 | hash[1] << 16 | hash[2] << 8 | hash[3]) >>> 0;
  return val / 0x100000000;
}

/**
 * Compute error function (erf) for p-value calculation.
 * Uses Horner form of the rational approximation.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

/**
 * Compute p-value from z-score (one-sided upper tail).
 */
function pValueFromZ(z: number): number {
  return 0.5 * (1 - erf(z / Math.SQRT2));
}

export class WatermarkEngine {
  private config: WatermarkConfig;

  constructor(config?: Partial<WatermarkConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Determine if a token is in the green list given context tokens.
   * Hash: SHA256(key + context + token), green if hash fraction < greenListRatio.
   */
  isGreenTokenSync(token: string, context: string[]): boolean {
    const contextStr = context.slice(-this.config.windowSize).join('|');
    const input = `${this.config.hashKey}|${contextStr}|${token}`;
    const hash = sha256Sync(input);
    return hashToFraction(hash) < this.config.greenListRatio;
  }

  /**
   * Async version using Web Crypto when available.
   */
  async isGreenToken(token: string, context: string[]): Promise<boolean> {
    const contextStr = context.slice(-this.config.windowSize).join('|');
    const input = `${this.config.hashKey}|${contextStr}|${token}`;
    const hash = await sha256(input);
    return hashToFraction(hash) < this.config.greenListRatio;
  }

  /**
   * Score a sequence of tokens for watermark presence.
   * Tokens are checked against green/red partition based on their preceding context.
   */
  detectSync(tokens: string[]): WatermarkDetectionResult {
    if (tokens.length === 0) {
      return {
        isWatermarked: false,
        zScore: 0,
        greenCount: 0,
        totalTokens: 0,
        greenRatio: 0,
        pValue: 1,
        confidence: 0,
      };
    }

    let greenCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      const context = tokens.slice(Math.max(0, i - this.config.windowSize), i);
      if (this.isGreenTokenSync(tokens[i], context)) {
        greenCount++;
      }
    }

    const n = tokens.length;
    const greenRatio = greenCount / n;
    const expected = this.config.greenListRatio;

    // Z-score: z = (greenRatio - expected) / sqrt(expected * (1-expected) / N)
    const stdErr = Math.sqrt((expected * (1 - expected)) / n);
    const zScore = stdErr > 0 ? (greenRatio - expected) / stdErr : 0;

    const pValue = pValueFromZ(zScore);
    const isWatermarked = zScore > 4.0; // significance threshold
    const confidence = isWatermarked
      ? Math.min(1, 1 - pValue)
      : Math.max(0, zScore / 4.0);

    return {
      isWatermarked,
      zScore,
      greenCount,
      totalTokens: n,
      greenRatio,
      pValue,
      confidence,
    };
  }

  /**
   * Async detection using Web Crypto.
   */
  async detect(tokens: string[]): Promise<WatermarkDetectionResult> {
    if (tokens.length === 0) {
      return {
        isWatermarked: false,
        zScore: 0,
        greenCount: 0,
        totalTokens: 0,
        greenRatio: 0,
        pValue: 1,
        confidence: 0,
      };
    }

    let greenCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      const context = tokens.slice(Math.max(0, i - this.config.windowSize), i);
      if (await this.isGreenToken(tokens[i], context)) {
        greenCount++;
      }
    }

    const n = tokens.length;
    const greenRatio = greenCount / n;
    const expected = this.config.greenListRatio;
    const stdErr = Math.sqrt((expected * (1 - expected)) / n);
    const zScore = stdErr > 0 ? (greenRatio - expected) / stdErr : 0;
    const pValue = pValueFromZ(zScore);
    const isWatermarked = zScore > 4.0;
    const confidence = isWatermarked
      ? Math.min(1, 1 - pValue)
      : Math.max(0, zScore / 4.0);

    return {
      isWatermarked,
      zScore,
      greenCount,
      totalTokens: n,
      greenRatio,
      pValue,
      confidence,
    };
  }

  /**
   * Bias token selection toward green list during generation.
   * Returns a score boost for the given token (positive = green, negative = red).
   */
  biasScore(token: string, context: string[], biasStrength: number = 2.0): number {
    return this.isGreenTokenSync(token, context) ? biasStrength : 0;
  }
}
