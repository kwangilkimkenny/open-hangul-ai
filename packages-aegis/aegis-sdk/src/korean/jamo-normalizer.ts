/**
 * AEGIS Korean Defense — Jamo Separation Attack Normalization
 *
 * Detects and recomposes scattered Hangul Jamo characters that attackers
 * use to evade keyword filters. Handles 5 attack types:
 *   1. DirectConcat      — ㅎㅏㅋㅣㅇ
 *   2. SpaceSeparated    — ㅎ ㅏ ㅋ ㅣ ㅇ
 *   3. DelimiterSeparated — ㅎ.ㅏ.ㅋ.ㅣ.ㅇ
 *   4. MixedInsertion    — Jamo scattered within normal text
 *   5. ZeroWidthSeparated — Jamo separated by invisible chars
 */

import {
  isJamo,
  isCompatConsonant,
  isCompatVowel,
  recomposeJamo,
} from './jamo';
import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export type JamoAttackType =
  | 'DirectConcat'
  | 'SpaceSeparated'
  | 'DelimiterSeparated'
  | 'MixedInsertion'
  | 'ZeroWidthSeparated';

export interface JamoNormalizerResult {
  /** Normalised text with Jamo recomposed into syllables */
  normalizedText: string;
  /** Detected attack type(s) */
  attackTypes: JamoAttackType[];
  /** Harmful words found after normalisation */
  harmfulWordsFound: string[];
  /** 0‑1 risk score */
  riskScore: number;
  /** Whether any attack pattern was detected */
  detected: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

const ZERO_WIDTH_CHARS = new Set([
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0xfeff, // BYTE ORDER MARK / ZERO WIDTH NO-BREAK SPACE
  0x2060, // WORD JOINER
  0x2061, // FUNCTION APPLICATION
  0x2062, // INVISIBLE TIMES
  0x2063, // INVISIBLE SEPARATOR
  0x2064, // INVISIBLE PLUS
]);

const DELIMITERS = new Set(['.', ',', '-', '_', '/', '\\', '|', '*', '~']);

// ── Helpers ─────────────────────────────────────────────────────────

function isZeroWidth(ch: string): boolean {
  return ZERO_WIDTH_CHARS.has(ch.charCodeAt(0));
}

function isDelimiter(ch: string): boolean {
  return DELIMITERS.has(ch);
}

function stripZeroWidth(text: string): { cleaned: string; hadZW: boolean } {
  let hadZW = false;
  let cleaned = '';
  for (const ch of text) {
    if (isZeroWidth(ch)) {
      hadZW = true;
    } else {
      cleaned += ch;
    }
  }
  return { cleaned, hadZW };
}

/**
 * Extract consecutive jamo sequences (possibly separated by spaces/delimiters)
 * and return them along with the detected attack type.
 */
function extractJamoRuns(
  text: string,
): { jamoRuns: Array<{ jamo: string; start: number; end: number }>; attackTypes: Set<JamoAttackType> } {
  const runs: Array<{ jamo: string; start: number; end: number }> = [];
  const attackTypes = new Set<JamoAttackType>();
  const chars = [...text];

  let i = 0;
  while (i < chars.length) {
    if (isJamo(chars[i])) {
      const start = i;
      let jamo = chars[i];
      let hasSeparator = false;
      let hasDelimiter = false;
      let hasSpace = false;
      i++;

      while (i < chars.length) {
        if (isJamo(chars[i])) {
          jamo += chars[i];
          i++;
        } else if (chars[i] === ' ' && i + 1 < chars.length && isJamo(chars[i + 1])) {
          hasSpace = true;
          hasSeparator = true;
          i++; // skip space
        } else if (isDelimiter(chars[i]) && i + 1 < chars.length && isJamo(chars[i + 1])) {
          hasDelimiter = true;
          hasSeparator = true;
          i++; // skip delimiter
        } else {
          break;
        }
      }

      if (jamo.length >= 3) {
        runs.push({ jamo, start, end: i });
        if (hasSeparator) {
          if (hasDelimiter) attackTypes.add('DelimiterSeparated');
          if (hasSpace) attackTypes.add('SpaceSeparated');
        } else {
          attackTypes.add('DirectConcat');
        }
      }
    } else {
      i++;
    }
  }

  return { jamoRuns: runs, attackTypes };
}

function checkHarmfulWords(text: string, wordList: readonly string[]): string[] {
  const found: string[] = [];
  for (const word of wordList) {
    if (text.includes(word)) {
      found.push(word);
    }
  }
  return found;
}

// ── JamoNormalizer ──────────────────────────────────────────────────

export class JamoNormalizer {
  private harmfulWords: readonly string[];

  constructor(harmfulWords?: readonly string[]) {
    this.harmfulWords = harmfulWords ?? HARMFUL_WORDS;
  }

  normalize(text: string): JamoNormalizerResult {
    const attackTypes = new Set<JamoAttackType>();

    // Step 1: Strip zero-width characters
    const { cleaned, hadZW } = stripZeroWidth(text);
    if (hadZW) {
      attackTypes.add('ZeroWidthSeparated');
    }

    // Step 2: Extract jamo runs (handles space/delimiter separation)
    const { jamoRuns, attackTypes: runTypes } = extractJamoRuns(cleaned);
    for (const t of runTypes) attackTypes.add(t);

    // Step 3: Build normalised text by replacing jamo runs with recomposed syllables
    let normalizedText = cleaned;
    // Process runs in reverse order to preserve indices
    const sortedRuns = [...jamoRuns].sort((a, b) => b.start - a.start);
    for (const run of sortedRuns) {
      const recomposed = recomposeJamo(run.jamo);
      const chars = [...normalizedText];
      const before = chars.slice(0, run.start).join('');
      const after = chars.slice(run.end).join('');
      normalizedText = before + recomposed + after;
    }

    // Step 4: Also try to recompose stripped-delimiter version of full text
    // for MixedInsertion detection
    const jamoCharsInText = [...cleaned].filter(ch => isJamo(ch)).length;
    const totalChars = [...cleaned].filter(ch => ch.trim().length > 0).length;
    if (totalChars > 0 && jamoCharsInText > 0 && jamoRuns.length === 0 && jamoCharsInText >= 3) {
      // Scattered jamo among normal text
      attackTypes.add('MixedInsertion');
      const jamoOnly = [...cleaned].filter(ch => isJamo(ch)).join('');
      const recomposed = recomposeJamo(jamoOnly);
      // Append recomposed to normalized for checking
      normalizedText = normalizedText + ' ' + recomposed;
    }

    // Step 5: Check for harmful words
    const harmfulWordsFound = checkHarmfulWords(normalizedText, this.harmfulWords);

    // Step 6: Compute risk score
    let riskScore = 0;
    if (harmfulWordsFound.length > 0) {
      riskScore = Math.min(1.0, 0.7 + harmfulWordsFound.length * 0.1);
    } else if (jamoRuns.length > 0) {
      // Suspicious jamo runs but no harmful match
      riskScore = 0.3;
    }

    if (attackTypes.size > 1) {
      riskScore = Math.min(1.0, riskScore + 0.05);
    }

    return {
      normalizedText: normalizedText.trim(),
      attackTypes: [...attackTypes],
      harmfulWordsFound,
      riskScore,
      detected: attackTypes.size > 0,
    };
  }
}
