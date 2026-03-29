// ============================================================
// AEGIS Layer 0: Trust Boundary — Input Validation & Normalization
// Ported from libs/aegis-defense/src/layers/trust_boundary.rs
// ============================================================

import type { DefenseResult, Risk } from '../../core/types';
import {
  HOMOGLYPH_MAP,
  containsHomoglyphs,
  normalizeHomoglyphs,
  countHomoglyphs,
} from '../patterns/homoglyphs';
import type { DefenseLayer } from '../paladin';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TrustBoundaryConfig {
  maxContentLength: number;
  minContentLength: number;
  enableNormalization: boolean;
}

const DEFAULT_CONFIG: TrustBoundaryConfig = {
  maxContentLength: 100_000,
  minContentLength: 1,
  enableNormalization: true,
};

// ---------------------------------------------------------------------------
// Zero-width characters
// ---------------------------------------------------------------------------

const ZERO_WIDTH_CHARS = new Set([
  '\u200B', // Zero Width Space
  '\u200C', // Zero Width Non-Joiner
  '\u200D', // Zero Width Joiner
  '\uFEFF', // BOM / Zero Width No-Break Space
  '\u2060', // Word Joiner
  '\u2061', // Function Application
  '\u2062', // Invisible Times
  '\u2063', // Invisible Separator
  '\u2064', // Invisible Plus
  '\u180E', // Mongolian Vowel Separator
  '\u200E', // Left-to-Right Mark
  '\u200F', // Right-to-Left Mark
  '\u202A', // Left-to-Right Embedding
  '\u202C', // Pop Directional Formatting
]);

// ---------------------------------------------------------------------------
// Confusable character map (95+ entries)
// Re-exported from homoglyphs.ts so consumers can also use it standalone.
// ---------------------------------------------------------------------------

export { HOMOGLYPH_MAP, containsHomoglyphs, normalizeHomoglyphs, countHomoglyphs };

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Returns true if the character is a zero-width / invisible character. */
export function isZeroWidth(ch: string): boolean {
  return ZERO_WIDTH_CHARS.has(ch);
}

/** Count confusable (homoglyph) characters in text. */
export function countConfusables(text: string): number {
  return countHomoglyphs(text);
}

/**
 * Full Unicode normalization pipeline:
 * 1. NFC normalization
 * 2. Strip zero-width characters
 * 3. Replace confusable characters with ASCII equivalents
 */
export function unicodeNormalization(text: string): string {
  // Step 1: NFC
  let normalized = text.normalize('NFC');

  // Step 2: Strip zero-width characters
  let cleaned = '';
  for (const ch of normalized) {
    if (!ZERO_WIDTH_CHARS.has(ch)) {
      cleaned += ch;
    }
  }
  normalized = cleaned;

  // Step 3: Confusable normalization
  normalized = normalizeHomoglyphs(normalized);

  return normalized;
}

// ---------------------------------------------------------------------------
// Trust Boundary Defense Layer
// ---------------------------------------------------------------------------

export class TrustBoundaryLayer implements DefenseLayer {
  readonly name = 'trust_boundary';
  readonly priority = 0;
  private cfg: TrustBoundaryConfig;

  constructor(config?: Partial<TrustBoundaryConfig>) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(content: string, context: Record<string, unknown>): DefenseResult {
    const details: Record<string, unknown> = {};

    // --- Length validation ---
    if (content.length < this.cfg.minContentLength) {
      return this.block('Content below minimum length', 'input_too_short', details);
    }
    if (content.length > this.cfg.maxContentLength) {
      return this.block('Content exceeds maximum length', 'input_too_long', details);
    }

    // --- Zero-width character detection ---
    let zeroWidthCount = 0;
    for (const ch of content) {
      if (ZERO_WIDTH_CHARS.has(ch)) zeroWidthCount++;
    }
    details['zeroWidthCount'] = zeroWidthCount;

    if (zeroWidthCount > 0) {
      const ratio = zeroWidthCount / content.length;
      details['zeroWidthRatio'] = ratio;
      // High ratio of invisible characters is suspicious
      if (ratio > 0.1) {
        return this.block(
          `High zero-width character ratio: ${(ratio * 100).toFixed(1)}%`,
          'zero_width_abuse',
          details,
        );
      }
    }

    // --- Confusable character detection ---
    const confusableCount = countHomoglyphs(content);
    details['confusableCount'] = confusableCount;

    if (confusableCount > 0) {
      const ratio = confusableCount / content.length;
      details['confusableRatio'] = ratio;
      // High ratio indicates likely homoglyph attack
      if (ratio > 0.15) {
        return this.block(
          `High confusable character ratio: ${(ratio * 100).toFixed(1)}%`,
          'homoglyph_attack',
          details,
        );
      }
    }

    // --- Normalization ---
    if (this.cfg.enableNormalization) {
      const normalized = unicodeNormalization(content);
      details['normalized'] = normalized !== content;
      if (normalized !== content) {
        details['normalizedContent'] = normalized;
        // Store for downstream layers
        context['__normalizedContent'] = normalized;
      }
    }

    // --- Null byte detection ---
    if (content.includes('\0')) {
      return this.block('Null byte detected in content', 'null_byte_injection', details);
    }

    // Confidence is inversely related to suspicious character count
    const suspiciousTotal = zeroWidthCount + confusableCount;
    const confidence = suspiciousTotal === 0
      ? 1.0
      : Math.max(0.5, 1.0 - (suspiciousTotal / content.length) * 2);

    return {
      layer: this.name,
      passed: true,
      confidence,
      details,
    };
  }

  // -----------------------------------------------------------------------

  private block(description: string, label: string, details: Record<string, unknown>): DefenseResult {
    const risk: Risk = {
      label,
      severity: 'high',
      description,
      score: 0.9,
      categories: [{ name: 'trust_boundary_violation', confidence: 0.95 }],
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
}
