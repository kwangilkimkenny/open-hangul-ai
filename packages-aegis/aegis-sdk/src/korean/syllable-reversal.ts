/**
 * AEGIS Korean Defense — Syllable Reversal Detection
 *
 * Detects harmful words whose syllables have been reversed to evade filters.
 * Examples: 탄폭 → 폭탄, 인살 → 살인
 *
 * Also detects interleaved spacing: "탄 폭" → 폭탄
 */

import { isHangulSyllable } from './jamo';
import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export interface ReversalMatch {
  /** The reversed form found in the input */
  reversed: string;
  /** The original harmful word */
  original: string;
  /** Position in the input string */
  position: number;
}

export interface SyllableReversalResult {
  matches: ReversalMatch[];
  riskScore: number;
  detected: boolean;
}

// ── SyllableReversalDetector ────────────────────────────────────────

export class SyllableReversalDetector {
  /** Map from reversed syllable string → original word */
  private reversedMap: Map<string, string>;

  constructor(harmfulWords?: readonly string[]) {
    const words = harmfulWords ?? HARMFUL_WORDS;
    this.reversedMap = new Map();

    for (const word of words) {
      const syllables = [...word];
      if (syllables.length >= 2 && syllables.length <= 6) {
        const reversed = syllables.reverse().join('');
        // Don't add if reversed === original (palindromes)
        if (reversed !== word) {
          this.reversedMap.set(reversed, word);
        }
      }
    }
  }

  detect(text: string): SyllableReversalResult {
    const matches: ReversalMatch[] = [];

    // Extract Hangul syllables (ignoring spaces for interleaved check)
    const hangulOnly = [...text].filter(ch => isHangulSyllable(ch)).join('');

    // Check contiguous windows of 2‑6 syllables
    this.scanWindows(hangulOnly, matches);

    // Also check original text (with spaces stripped between Hangul)
    if (hangulOnly !== text) {
      // Try with the original text for position tracking
      this.scanOriginalText(text, matches);
    }

    // Deduplicate by reversed + position
    const seen = new Set<string>();
    const deduped = matches.filter(m => {
      const key = `${m.reversed}@${m.position}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let riskScore = 0;
    if (deduped.length > 0) {
      riskScore = Math.min(1.0, 0.8 + (deduped.length - 1) * 0.05);
    }

    return {
      matches: deduped,
      riskScore,
      detected: deduped.length > 0,
    };
  }

  private scanWindows(text: string, matches: ReversalMatch[]): void {
    const chars = [...text];
    for (let windowSize = 2; windowSize <= Math.min(6, chars.length); windowSize++) {
      for (let i = 0; i <= chars.length - windowSize; i++) {
        const window = chars.slice(i, i + windowSize).join('');
        const original = this.reversedMap.get(window);
        if (original) {
          matches.push({
            reversed: window,
            original,
            position: i,
          });
        }
      }
    }
  }

  private scanOriginalText(text: string, matches: ReversalMatch[]): void {
    // Extract Hangul syllables with their original positions
    const syllables: Array<{ ch: string; pos: number }> = [];
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      if (isHangulSyllable(chars[i])) {
        syllables.push({ ch: chars[i], pos: i });
      }
    }

    for (let windowSize = 2; windowSize <= Math.min(6, syllables.length); windowSize++) {
      for (let i = 0; i <= syllables.length - windowSize; i++) {
        const window = syllables.slice(i, i + windowSize).map(s => s.ch).join('');
        const original = this.reversedMap.get(window);
        if (original) {
          matches.push({
            reversed: window,
            original,
            position: syllables[i].pos,
          });
        }
      }
    }
  }
}
