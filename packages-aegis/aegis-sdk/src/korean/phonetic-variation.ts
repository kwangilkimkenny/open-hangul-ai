/**
 * AEGIS Korean Defense — Phonetic Variation Detection
 *
 * Detects harmful words with phonetic substitutions:
 *   - Vowel close pairs: (ㅏ,ㅓ), (ㅏ,ㅗ), (ㅓ,ㅗ), (ㅜ,ㅡ), (ㅐ,ㅔ), (ㅗ,ㅜ)
 *   - Tensification: (ㄱ,ㄲ), (ㄷ,ㄸ), (ㅂ,ㅃ), (ㅅ,ㅆ), (ㅈ,ㅉ)
 *
 * Example: "폭턴" (ㅏ→ㅓ in 탄→턴) still matches "폭탄"
 */

import {
  decompose,
  CHOSEONG,
  JUNGSEONG,
  JONGSEONG,
  isHangulSyllable,
} from './jamo';
import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export interface PhoneticMatch {
  /** The variant form found in the input */
  variant: string;
  /** The original harmful word */
  original: string;
  /** Similarity score 0‑1 */
  similarity: number;
  /** Position in the input */
  position: number;
}

export interface PhoneticVariationResult {
  matches: PhoneticMatch[];
  riskScore: number;
  detected: boolean;
}

// ── Phonetic similarity tables ──────────────────────────────────────

/** Vowel close pairs (bidirectional). Value = similarity boost. */
const VOWEL_PAIRS: ReadonlyMap<string, Set<string>> = (() => {
  const pairs: Array<[string, string]> = [
    ['ㅏ', 'ㅓ'], ['ㅏ', 'ㅗ'], ['ㅓ', 'ㅗ'],
    ['ㅜ', 'ㅡ'], ['ㅐ', 'ㅔ'], ['ㅗ', 'ㅜ'],
  ];
  const map = new Map<string, Set<string>>();
  for (const [a, b] of pairs) {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  }
  return map;
})();

/** Tensification pairs (bidirectional). */
const TENSIFICATION_PAIRS: ReadonlyMap<string, Set<string>> = (() => {
  const pairs: Array<[string, string]> = [
    ['ㄱ', 'ㄲ'], ['ㄷ', 'ㄸ'], ['ㅂ', 'ㅃ'], ['ㅅ', 'ㅆ'], ['ㅈ', 'ㅉ'],
  ];
  const map = new Map<string, Set<string>>();
  for (const [a, b] of pairs) {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  }
  return map;
})();

// ── Helpers ─────────────────────────────────────────────────────────

function areSimilarVowels(a: string, b: string): boolean {
  if (a === b) return true;
  return VOWEL_PAIRS.get(a)?.has(b) ?? false;
}

function areSimilarConsonants(a: string, b: string): boolean {
  if (a === b) return true;
  return TENSIFICATION_PAIRS.get(a)?.has(b) ?? false;
}

/**
 * Compare two Hangul syllables and return a similarity score (0‑1).
 *
 * Weights: cho=0.4, jung=0.35, jong=0.25
 * For close phonetic pairs, partial credit is given.
 */
function syllableSimilarity(a: string, b: string): number {
  const da = decompose(a);
  const db = decompose(b);
  if (!da || !db) return a === b ? 1 : 0;

  let score = 0;

  // Choseong
  const choA = CHOSEONG[da.cho];
  const choB = CHOSEONG[db.cho];
  if (choA === choB) {
    score += 0.4;
  } else if (areSimilarConsonants(choA, choB)) {
    score += 0.3; // partial credit for tensification
  }

  // Jungseong
  const jungA = JUNGSEONG[da.jung];
  const jungB = JUNGSEONG[db.jung];
  if (jungA === jungB) {
    score += 0.35;
  } else if (areSimilarVowels(jungA, jungB)) {
    score += 0.25; // partial credit for close vowels
  }

  // Jongseong
  const jongA = JONGSEONG[da.jong];
  const jongB = JONGSEONG[db.jong];
  if (jongA === jongB) {
    score += 0.25;
  } else if (jongA !== '' && jongB !== '' && areSimilarConsonants(jongA, jongB)) {
    score += 0.15;
  } else if ((jongA === '' && jongB === '') || jongA === jongB) {
    score += 0.25;
  }

  return score;
}

/**
 * Compare a candidate string against a target word.
 * Returns average per-syllable similarity.
 */
function wordSimilarity(candidate: string, target: string): number {
  const cSyllables = [...candidate];
  const tSyllables = [...target];
  if (cSyllables.length !== tSyllables.length) return 0;

  let totalScore = 0;
  for (let i = 0; i < cSyllables.length; i++) {
    totalScore += syllableSimilarity(cSyllables[i], tSyllables[i]);
  }
  return totalScore / cSyllables.length;
}

// ── PhoneticVariationDetector ───────────────────────────────────────

export class PhoneticVariationDetector {
  private harmfulWords: readonly string[];
  private threshold: number;

  constructor(harmfulWords?: readonly string[], threshold = 0.75) {
    this.harmfulWords = harmfulWords ?? HARMFUL_WORDS;
    this.threshold = threshold;
  }

  detect(text: string): PhoneticVariationResult {
    const matches: PhoneticMatch[] = [];
    const chars = [...text];

    // For each harmful word, check all windows of the same syllable length
    for (const word of this.harmfulWords) {
      const wordChars = [...word];
      const wLen = wordChars.length;
      if (wLen < 2) continue;

      // Extract Hangul-only chars with positions
      const hangulPositions: Array<{ ch: string; pos: number }> = [];
      for (let i = 0; i < chars.length; i++) {
        if (isHangulSyllable(chars[i])) {
          hangulPositions.push({ ch: chars[i], pos: i });
        }
      }

      for (let i = 0; i <= hangulPositions.length - wLen; i++) {
        const candidate = hangulPositions.slice(i, i + wLen).map(h => h.ch).join('');

        // Skip exact matches (those are caught by other modules)
        if (candidate === word) continue;

        // Skip if the candidate is a sub-span of a longer word (no word boundary).
        // A match should start at a word boundary (beginning of text, after space/punctuation,
        // or after a non-Hangul character) AND end at a word boundary.
        const startPos = hangulPositions[i].pos;
        const endPos = hangulPositions[i + wLen - 1].pos;
        const prevChar = startPos > 0 ? chars[startPos - 1] : ' ';
        const nextChar = endPos < chars.length - 1 ? chars[endPos + 1] : ' ';
        const prevIsHangul = isHangulSyllable(prevChar);
        const nextIsHangul = isHangulSyllable(nextChar);

        // If both sides have Hangul neighbors, it's inside a longer word — skip
        if (prevIsHangul && nextIsHangul) continue;
        // If one side has a Hangul neighbor, require higher similarity to reduce false positives
        const effectiveThreshold = (prevIsHangul || nextIsHangul)
          ? Math.max(this.threshold, 0.9)
          : this.threshold;

        const sim = wordSimilarity(candidate, word);
        if (sim >= effectiveThreshold) {
          matches.push({
            variant: candidate,
            original: word,
            similarity: sim,
            position: hangulPositions[i].pos,
          });
        }
      }
    }

    // Deduplicate: prefer highest similarity for same position + original
    const bestMap = new Map<string, PhoneticMatch>();
    for (const m of matches) {
      const key = `${m.position}:${m.original}`;
      const existing = bestMap.get(key);
      if (!existing || m.similarity > existing.similarity) {
        bestMap.set(key, m);
      }
    }
    const deduped = [...bestMap.values()];

    const riskScore = deduped.length === 0
      ? 0
      : Math.min(1.0, deduped.reduce((max, m) => Math.max(max, m.similarity), 0));

    return {
      matches: deduped,
      riskScore,
      detected: deduped.length > 0,
    };
  }
}
