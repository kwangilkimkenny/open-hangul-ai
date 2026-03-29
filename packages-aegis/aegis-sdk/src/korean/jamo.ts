/**
 * AEGIS Korean Defense — Core Hangul Jamo Operations
 *
 * Provides decomposition, composition, similarity scoring, and
 * utility predicates for Hangul syllables and Jamo characters.
 */

// ── Unicode Hangul constants ────────────────────────────────────────
export const HANGUL_BASE = 0xac00;
export const HANGUL_END = 0xd7a3;
export const CHOSEONG_COUNT = 19;
export const JUNGSEONG_COUNT = 21;
export const JONGSEONG_COUNT = 28;

/** 19 Choseong (초성) in index order */
export const CHOSEONG: readonly string[] = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
  'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];

/** 21 Jungseong (중성) in index order */
export const JUNGSEONG: readonly string[] = [
  'ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ',
  'ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ',
];

/** 28 Jongseong (종성) — index 0 = no final consonant */
export const JONGSEONG: readonly string[] = [
  '','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ',
  'ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ',
  'ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];

// ── Interfaces ──────────────────────────────────────────────────────

export interface JamoDecomposition {
  cho: number;
  jung: number;
  jong: number;
}

// ── Predicates ──────────────────────────────────────────────────────

/** Returns true when `ch` is a precomposed Hangul syllable (U+AC00‑U+D7A3). */
export function isHangulSyllable(ch: string): boolean {
  if (ch.length === 0) return false;
  const code = ch.charCodeAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_END;
}

/** Returns true when `ch` is a Hangul Jamo character.
 *  Covers Compatibility Jamo (U+3131‑U+3163) and Conjoining Jamo (U+1100‑U+11FF). */
export function isJamo(ch: string): boolean {
  if (ch.length === 0) return false;
  const code = ch.charCodeAt(0);
  return (code >= 0x3131 && code <= 0x3163) ||
         (code >= 0x1100 && code <= 0x11ff);
}

/** Returns true when `ch` is a Compatibility Jamo consonant (ㄱ‑ㅎ, U+3131‑U+314E). */
export function isCompatConsonant(ch: string): boolean {
  if (ch.length === 0) return false;
  const code = ch.charCodeAt(0);
  return code >= 0x3131 && code <= 0x314e;
}

/** Returns true when `ch` is a Compatibility Jamo vowel (ㅏ‑ㅣ, U+314F‑U+3163). */
export function isCompatVowel(ch: string): boolean {
  if (ch.length === 0) return false;
  const code = ch.charCodeAt(0);
  return code >= 0x314f && code <= 0x3163;
}

// ── Decomposition / Composition ─────────────────────────────────────

/**
 * Decompose a precomposed Hangul syllable into choseong / jungseong / jongseong indices.
 * Returns `null` for non-Hangul-syllable input.
 */
export function decompose(ch: string): JamoDecomposition | null {
  if (!isHangulSyllable(ch)) return null;
  const code = ch.charCodeAt(0) - HANGUL_BASE;
  const cho = Math.floor(code / (JUNGSEONG_COUNT * JONGSEONG_COUNT));
  const jung = Math.floor((code % (JUNGSEONG_COUNT * JONGSEONG_COUNT)) / JONGSEONG_COUNT);
  const jong = code % JONGSEONG_COUNT;
  return { cho, jung, jong };
}

/**
 * Compose a Hangul syllable from choseong / jungseong / jongseong indices.
 * `jong` defaults to 0 (no final consonant).
 */
export function compose(cho: number, jung: number, jong: number = 0): string {
  return String.fromCharCode(
    HANGUL_BASE + (cho * JUNGSEONG_COUNT + jung) * JONGSEONG_COUNT + jong,
  );
}

// ── Choseong extraction ─────────────────────────────────────────────

/**
 * Extract the choseong (initial consonant) character from a Hangul syllable string.
 * Non-syllable characters are passed through unchanged.
 */
export function extractChoseong(text: string): string {
  let result = '';
  for (const ch of text) {
    const d = decompose(ch);
    if (d) {
      result += CHOSEONG[d.cho];
    } else {
      result += ch;
    }
  }
  return result;
}

// ── Similarity ──────────────────────────────────────────────────────

/**
 * Compute a weighted Jamo similarity between two Hangul syllables.
 *
 * Weights: choseong = 0.4, jungseong = 0.35, jongseong = 0.25
 *
 * Returns 0 for non-syllable input.
 */
export function jamoSimilarity(a: string, b: string): number {
  const da = decompose(a);
  const db = decompose(b);
  if (!da || !db) return 0;

  let score = 0;
  if (da.cho === db.cho) score += 0.4;
  if (da.jung === db.jung) score += 0.35;
  if (da.jong === db.jong) score += 0.25;
  return score;
}

// ── Helpers for other modules ───────────────────────────────────────

/** Map a Compatibility Jamo consonant to its CHOSEONG index, or -1. */
export function consonantToChoseongIndex(ch: string): number {
  return CHOSEONG.indexOf(ch);
}

/** Map a Compatibility Jamo vowel to its JUNGSEONG index, or -1. */
export function vowelToJungseongIndex(ch: string): number {
  return JUNGSEONG.indexOf(ch);
}

/** Map a Compatibility Jamo consonant to its JONGSEONG index, or -1. */
export function consonantToJongseongIndex(ch: string): number {
  return JONGSEONG.indexOf(ch);
}

/**
 * Try to recompose a sequence of Compatibility Jamo characters into
 * Hangul syllables. Returns the recomposed string.
 *
 * The algorithm is a simple left-to-right state machine:
 *   - Waiting for choseong (consonant)
 *   - Got choseong, waiting for jungseong (vowel)
 *   - Got cho+jung, optionally consume jongseong (consonant) if next char is NOT a vowel
 */
export function recomposeJamo(jamo: string): string {
  let result = '';
  let i = 0;
  const chars = [...jamo];

  while (i < chars.length) {
    const ch = chars[i];
    const choIdx = consonantToChoseongIndex(ch);

    if (choIdx >= 0 && i + 1 < chars.length) {
      const jungIdx = vowelToJungseongIndex(chars[i + 1]);
      if (jungIdx >= 0) {
        // We have cho + jung — check for optional jongseong
        let jongIdx = 0;
        let consumed = 2;

        if (i + 2 < chars.length) {
          const possibleJong = consonantToJongseongIndex(chars[i + 2]);
          if (possibleJong > 0) {
            // Only consume as jongseong if the NEXT char is NOT a vowel
            // (otherwise it's the choseong of the next syllable)
            if (i + 3 < chars.length && vowelToJungseongIndex(chars[i + 3]) >= 0) {
              // next char is a vowel → don't consume as jongseong
              jongIdx = 0;
            } else {
              jongIdx = possibleJong;
              consumed = 3;
            }
          }
        }

        result += compose(choIdx, jungIdx, jongIdx);
        i += consumed;
        continue;
      }
    }

    // If the char is a vowel standing alone, try to see if it can combine
    // with a previous incomplete state — otherwise emit as-is.
    result += ch;
    i++;
  }

  return result;
}
