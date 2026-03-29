/**
 * AEGIS Korean Defense — Dubeolsik Keyboard Mapping
 *
 * Detects ASCII text that was intended to be typed in Korean (Dubeolsik layout)
 * but was entered with the English IME active.
 *
 * Example: "gksrmf" → ㅎㅏㄴㄱㅡㄹ → "한글"
 */

import {
  isCompatConsonant,
  isCompatVowel,
  consonantToChoseongIndex,
  vowelToJungseongIndex,
  consonantToJongseongIndex,
  compose,
} from './jamo';
import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export interface KeyboardMappingResult {
  /** Converted Korean text */
  convertedText: string;
  /** Whether the input appeared to be an English-typed Korean sequence */
  detected: boolean;
  /** Harmful words found in the converted text */
  harmfulWordsFound: string[];
  riskScore: number;
}

// ── Dubeolsik layout ────────────────────────────────────────────────

const LOWER_MAP: Record<string, string> = {
  q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ',
  y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ',
  a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ',
  h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
  z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ',
  b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
};

const UPPER_MAP: Record<string, string> = {
  Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ',
  O: 'ㅒ', P: 'ㅖ',
};

/** Combined map */
const KEY_MAP: Record<string, string> = { ...LOWER_MAP, ...UPPER_MAP };

// ── Composite vowels (두벌식 조합 모음) ─────────────────────────────

const COMPOSITE_VOWELS: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
  'ㅡㅣ': 'ㅢ',
};

// ── Composite jongseong ─────────────────────────────────────────────

const COMPOSITE_JONG: Record<string, { jamo: string; jongIdx: number }> = {
  'ㄱㅅ': { jamo: 'ㄳ', jongIdx: 3 },
  'ㄴㅈ': { jamo: 'ㄵ', jongIdx: 5 },
  'ㄴㅎ': { jamo: 'ㄶ', jongIdx: 6 },
  'ㄹㄱ': { jamo: 'ㄺ', jongIdx: 9 },
  'ㄹㅁ': { jamo: 'ㄻ', jongIdx: 10 },
  'ㄹㅂ': { jamo: 'ㄼ', jongIdx: 11 },
  'ㄹㅅ': { jamo: 'ㄽ', jongIdx: 12 },
  'ㄹㅌ': { jamo: 'ㄾ', jongIdx: 13 },
  'ㄹㅍ': { jamo: 'ㄿ', jongIdx: 14 },
  'ㄹㅎ': { jamo: 'ㅀ', jongIdx: 15 },
  'ㅂㅅ': { jamo: 'ㅄ', jongIdx: 18 },
};

// ── Helpers ─────────────────────────────────────────────────────────

function isDubeolsikChar(ch: string): boolean {
  return ch in KEY_MAP;
}

function isAsciiAlpha(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

/**
 * Convert a string of ASCII characters through the Dubeolsik keyboard map
 * to produce Jamo, then recompose into Hangul syllables.
 */
function convertThroughKeyboard(ascii: string): string {
  // Step 1: Map ASCII → Jamo
  const jamo: string[] = [];
  for (const ch of ascii) {
    const mapped = KEY_MAP[ch];
    if (mapped) {
      jamo.push(mapped);
    } else {
      jamo.push(ch);
    }
  }

  // Step 2: Recompose Jamo into syllables using a state machine
  return recompose(jamo);
}

/**
 * State-machine recomposition of Jamo array into Hangul syllables.
 * States: EMPTY → CHO → CHO_JUNG → CHO_JUNG_JONG
 */
function recompose(jamo: string[]): string {
  let result = '';
  let i = 0;

  while (i < jamo.length) {
    const ch = jamo[i];

    // If it's a consonant, try to start a syllable
    if (isCompatConsonant(ch)) {
      const choIdx = consonantToChoseongIndex(ch);
      if (choIdx < 0) {
        result += ch;
        i++;
        continue;
      }

      // Look for a following vowel
      if (i + 1 < jamo.length && isCompatVowel(jamo[i + 1])) {
        let vowel = jamo[i + 1];
        let consumed = 2;

        // Check for composite vowel
        if (i + 2 < jamo.length && isCompatVowel(jamo[i + 2])) {
          const composite = COMPOSITE_VOWELS[vowel + jamo[i + 2]];
          if (composite) {
            vowel = composite;
            consumed = 3;
          }
        }

        const jungIdx = vowelToJungseongIndex(vowel);
        if (jungIdx < 0) {
          result += ch;
          i++;
          continue;
        }

        // Look for optional jongseong
        let jongIdx = 0;
        const nextIdx = i + consumed;

        if (nextIdx < jamo.length && isCompatConsonant(jamo[nextIdx])) {
          const possibleJong = consonantToJongseongIndex(jamo[nextIdx]);

          if (possibleJong > 0) {
            // Check if next-next is a vowel → this consonant starts next syllable
            if (nextIdx + 1 < jamo.length && isCompatVowel(jamo[nextIdx + 1])) {
              // Don't consume as jongseong
              jongIdx = 0;
            } else if (
              nextIdx + 1 < jamo.length &&
              isCompatConsonant(jamo[nextIdx + 1])
            ) {
              // Check for composite jongseong
              const compositeKey = jamo[nextIdx] + jamo[nextIdx + 1];
              const composite = COMPOSITE_JONG[compositeKey];

              if (composite) {
                // Check if after composite, next char is vowel
                if (nextIdx + 2 < jamo.length && isCompatVowel(jamo[nextIdx + 2])) {
                  // Only take first consonant as jong, second starts next syllable
                  jongIdx = possibleJong;
                  consumed += 1;
                } else {
                  jongIdx = composite.jongIdx;
                  consumed += 2;
                }
              } else {
                jongIdx = possibleJong;
                consumed += 1;
              }
            } else {
              jongIdx = possibleJong;
              consumed += 1;
            }
          }
        }

        result += compose(choIdx, jungIdx, jongIdx);
        i += consumed;
      } else {
        // Consonant with no following vowel
        result += ch;
        i++;
      }
    } else if (isCompatVowel(ch)) {
      // Standalone vowel — emit as-is
      result += ch;
      i++;
    } else {
      // Non-Jamo character
      result += ch;
      i++;
    }
  }

  return result;
}

// ── KeyboardMapper ──────────────────────────────────────────────────

export class KeyboardMapper {
  private harmfulWords: readonly string[];

  constructor(harmfulWords?: readonly string[]) {
    this.harmfulWords = harmfulWords ?? HARMFUL_WORDS;
  }

  detect(text: string): KeyboardMappingResult {
    // Only process if text contains ASCII alpha characters
    let hasAscii = false;
    for (const ch of text) {
      if (isAsciiAlpha(ch) && isDubeolsikChar(ch)) {
        hasAscii = true;
        break;
      }
    }

    if (!hasAscii) {
      return {
        convertedText: text,
        detected: false,
        harmfulWordsFound: [],
        riskScore: 0,
      };
    }

    // Extract ASCII-only segments and convert them
    const converted = this.convertSegments(text);

    // Check for harmful words
    const harmfulWordsFound: string[] = [];
    for (const word of this.harmfulWords) {
      if (converted.includes(word)) {
        harmfulWordsFound.push(word);
      }
    }

    const detected = converted !== text;
    let riskScore = 0;
    if (harmfulWordsFound.length > 0) {
      riskScore = Math.min(1.0, 0.7 + harmfulWordsFound.length * 0.1);
    }

    return {
      convertedText: converted,
      detected,
      harmfulWordsFound,
      riskScore,
    };
  }

  private convertSegments(text: string): string {
    let result = '';
    let asciiRun = '';

    for (const ch of text) {
      if (isDubeolsikChar(ch)) {
        asciiRun += ch;
      } else {
        if (asciiRun.length > 0) {
          result += convertThroughKeyboard(asciiRun);
          asciiRun = '';
        }
        result += ch;
      }
    }
    if (asciiRun.length > 0) {
      result += convertThroughKeyboard(asciiRun);
    }

    return result;
  }
}
