/**
 * AEGIS Korean Defense — Unicode Homoglyph Detection (Korean-specific)
 *
 * Normalises visually-similar Unicode characters back to their standard
 * forms so that downstream keyword detection can operate on canonical text.
 *
 * Covers:
 *   - Fullwidth ASCII → ASCII
 *   - Hangul Jamo variants (U+1100‑U+11FF) → Compatibility Jamo (U+3131‑U+3163)
 *   - Halfwidth Hangul (U+FFA0‑U+FFDC) → Standard Compatibility Jamo
 *   - Cyrillic lookalikes → ASCII
 *   - Katakana lookalikes → Hangul Jamo
 *   - Enclosed / Parenthesized Hangul (U+3200‑U+327F) → base Jamo
 *   - Circled Hangul (U+3260‑U+326D) → base Jamo
 */

import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export interface HomoglyphMatch {
  original: string;
  normalized: string;
  position: number;
  mapType: string;
}

export interface HomoglyphResult {
  normalizedText: string;
  matches: HomoglyphMatch[];
  riskScore: number;
  detected: boolean;
  harmfulWordsFound: string[];
}

// ── Mapping tables ──────────────────────────────────────────────────

/**
 * Conjoining Jamo Choseong (U+1100‑U+1112) → Compatibility Jamo
 */
const CONJOINING_CHO: Record<number, string> = {
  0x1100: 'ㄱ', 0x1101: 'ㄲ', 0x1102: 'ㄴ', 0x1103: 'ㄷ', 0x1104: 'ㄸ',
  0x1105: 'ㄹ', 0x1106: 'ㅁ', 0x1107: 'ㅂ', 0x1108: 'ㅃ', 0x1109: 'ㅅ',
  0x110a: 'ㅆ', 0x110b: 'ㅇ', 0x110c: 'ㅈ', 0x110d: 'ㅉ', 0x110e: 'ㅊ',
  0x110f: 'ㅋ', 0x1110: 'ㅌ', 0x1111: 'ㅍ', 0x1112: 'ㅎ',
};

/**
 * Conjoining Jamo Jungseong (U+1161‑U+1175) → Compatibility Jamo
 */
const CONJOINING_JUNG: Record<number, string> = {
  0x1161: 'ㅏ', 0x1162: 'ㅐ', 0x1163: 'ㅑ', 0x1164: 'ㅒ', 0x1165: 'ㅓ',
  0x1166: 'ㅔ', 0x1167: 'ㅕ', 0x1168: 'ㅖ', 0x1169: 'ㅗ', 0x116a: 'ㅘ',
  0x116b: 'ㅙ', 0x116c: 'ㅚ', 0x116d: 'ㅛ', 0x116e: 'ㅜ', 0x116f: 'ㅝ',
  0x1170: 'ㅞ', 0x1171: 'ㅟ', 0x1172: 'ㅠ', 0x1173: 'ㅡ', 0x1174: 'ㅢ',
  0x1175: 'ㅣ',
};

/**
 * Conjoining Jamo Jongseong (U+11A8‑U+11C2) → Compatibility Jamo
 */
const CONJOINING_JONG: Record<number, string> = {
  0x11a8: 'ㄱ', 0x11a9: 'ㄲ', 0x11aa: 'ㄳ', 0x11ab: 'ㄴ', 0x11ac: 'ㄵ',
  0x11ad: 'ㄶ', 0x11ae: 'ㄷ', 0x11af: 'ㄹ', 0x11b0: 'ㄺ', 0x11b1: 'ㄻ',
  0x11b2: 'ㄼ', 0x11b3: 'ㄽ', 0x11b4: 'ㄾ', 0x11b5: 'ㄿ', 0x11b6: 'ㅀ',
  0x11b7: 'ㅁ', 0x11b8: 'ㅂ', 0x11b9: 'ㅄ', 0x11ba: 'ㅅ', 0x11bb: 'ㅆ',
  0x11bc: 'ㅇ', 0x11bd: 'ㅈ', 0x11be: 'ㅊ', 0x11bf: 'ㅋ', 0x11c0: 'ㅌ',
  0x11c1: 'ㅍ', 0x11c2: 'ㅎ',
};

/**
 * Halfwidth Hangul Compatibility Jamo (U+FFA0‑U+FFDC) → standard Compatibility Jamo.
 * U+FFA0 = Halfwidth Hangul Filler, U+FFA1‑FFBE = consonants, U+FFC2‑FFCF = vowels, etc.
 */
const HALFWIDTH_HANGUL: Record<number, string> = {
  0xffa1: 'ㄱ', 0xffa2: 'ㄲ', 0xffa3: 'ㄳ', 0xffa4: 'ㄴ', 0xffa5: 'ㄵ',
  0xffa6: 'ㄶ', 0xffa7: 'ㄷ', 0xffa8: 'ㄸ', 0xffa9: 'ㄹ', 0xffaa: 'ㄺ',
  0xffab: 'ㄻ', 0xffac: 'ㄼ', 0xffad: 'ㄽ', 0xffae: 'ㄾ', 0xffaf: 'ㄿ',
  0xffb0: 'ㅀ', 0xffb1: 'ㅁ', 0xffb2: 'ㅂ', 0xffb3: 'ㅃ', 0xffb4: 'ㅄ',
  0xffb5: 'ㅅ', 0xffb6: 'ㅆ', 0xffb7: 'ㅇ', 0xffb8: 'ㅈ', 0xffb9: 'ㅉ',
  0xffba: 'ㅊ', 0xffbb: 'ㅋ', 0xffbc: 'ㅌ', 0xffbd: 'ㅍ', 0xffbe: 'ㅎ',
  // vowels
  0xffc2: 'ㅏ', 0xffc3: 'ㅐ', 0xffc4: 'ㅑ', 0xffc5: 'ㅒ', 0xffc6: 'ㅓ',
  0xffc7: 'ㅔ', 0xffca: 'ㅕ', 0xffcb: 'ㅖ', 0xffcc: 'ㅗ', 0xffcd: 'ㅘ',
  0xffce: 'ㅙ', 0xffcf: 'ㅚ', 0xffd2: 'ㅛ', 0xffd3: 'ㅜ', 0xffd4: 'ㅝ',
  0xffd5: 'ㅞ', 0xffd6: 'ㅟ', 0xffd7: 'ㅠ', 0xffda: 'ㅡ', 0xffdb: 'ㅢ',
  0xffdc: 'ㅣ',
};

/**
 * Cyrillic → ASCII lookalikes
 */
const CYRILLIC_MAP: Record<number, string> = {
  0x0410: 'A', 0x0430: 'a', // А/а
  0x0412: 'B', 0x0432: 'b', // В/в → B/b (visual)
  0x0421: 'C', 0x0441: 'c', // С/с
  0x0415: 'E', 0x0435: 'e', // Е/е
  0x041d: 'H', 0x043d: 'h', // Н/н → H (visual)
  0x041a: 'K', 0x043a: 'k', // К/к
  0x041c: 'M', 0x043c: 'm', // М/м
  0x041e: 'O', 0x043e: 'o', // О/о
  0x0420: 'P', 0x0440: 'p', // Р/р → P/p
  0x0422: 'T', 0x0442: 't', // Т/т
  0x0425: 'X', 0x0445: 'x', // Х/х
  0x0423: 'Y', 0x0443: 'y', // У/у → Y/y (loose)
};

/**
 * Katakana → Hangul Jamo visual lookalikes
 */
const KATAKANA_TO_JAMO: Record<string, string> = {
  'ト': 'ㅌ',
  'ス': 'ㅈ',
  'ロ': 'ㅁ',
  'ノ': 'ㅅ',
};

/**
 * Parenthesized Hangul (U+3200‑U+320D) → Compatibility Jamo consonants
 * ㈀‑㈍ → ㄱ‑ㅎ (the 14 basic consonants)
 */
const PARENTHESIZED_CONSONANTS = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';

/**
 * Circled Hangul (U+3260‑U+326D) → Compatibility Jamo consonants
 * ㉠‑㉭ → ㄱ‑ㅎ
 */
const CIRCLED_CONSONANTS = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';

// ── Normalisation logic ─────────────────────────────────────────────

function normalizeChar(ch: string, pos: number, matches: HomoglyphMatch[]): string {
  const code = ch.charCodeAt(0);

  // Fullwidth ASCII letters (U+FF21‑FF3A uppercase, U+FF41‑FF5A lowercase)
  if (code >= 0xff21 && code <= 0xff3a) {
    const n = String.fromCharCode(code - 0xff21 + 0x41);
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'fullwidth_upper' });
    return n;
  }
  if (code >= 0xff41 && code <= 0xff5a) {
    const n = String.fromCharCode(code - 0xff41 + 0x61);
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'fullwidth_lower' });
    return n;
  }
  // Fullwidth digits (U+FF10‑FF19)
  if (code >= 0xff10 && code <= 0xff19) {
    const n = String.fromCharCode(code - 0xff10 + 0x30);
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'fullwidth_digit' });
    return n;
  }

  // Conjoining Jamo → Compatibility Jamo
  if (CONJOINING_CHO[code]) {
    const n = CONJOINING_CHO[code];
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'conjoining_cho' });
    return n;
  }
  if (CONJOINING_JUNG[code]) {
    const n = CONJOINING_JUNG[code];
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'conjoining_jung' });
    return n;
  }
  if (CONJOINING_JONG[code]) {
    const n = CONJOINING_JONG[code];
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'conjoining_jong' });
    return n;
  }

  // Halfwidth Hangul
  if (HALFWIDTH_HANGUL[code]) {
    const n = HALFWIDTH_HANGUL[code];
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'halfwidth_hangul' });
    return n;
  }

  // Cyrillic lookalikes
  if (CYRILLIC_MAP[code]) {
    const n = CYRILLIC_MAP[code];
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'cyrillic' });
    return n;
  }

  // Katakana lookalikes
  if (KATAKANA_TO_JAMO[ch]) {
    const n = KATAKANA_TO_JAMO[ch];
    matches.push({ original: ch, normalized: n, position: pos, mapType: 'katakana' });
    return n;
  }

  // Parenthesized Hangul consonants (U+3200‑U+320D)
  if (code >= 0x3200 && code <= 0x320d) {
    const idx = code - 0x3200;
    if (idx < PARENTHESIZED_CONSONANTS.length) {
      const n = PARENTHESIZED_CONSONANTS[idx];
      matches.push({ original: ch, normalized: n, position: pos, mapType: 'parenthesized' });
      return n;
    }
  }

  // Circled Hangul consonants (U+3260‑U+326D)
  if (code >= 0x3260 && code <= 0x326d) {
    const idx = code - 0x3260;
    if (idx < CIRCLED_CONSONANTS.length) {
      const n = CIRCLED_CONSONANTS[idx];
      matches.push({ original: ch, normalized: n, position: pos, mapType: 'circled' });
      return n;
    }
  }

  return ch;
}

// ── HomoglyphDetector ───────────────────────────────────────────────

export class HomoglyphDetector {
  private harmfulWords: readonly string[];

  constructor(harmfulWords?: readonly string[]) {
    this.harmfulWords = harmfulWords ?? HARMFUL_WORDS;
  }

  detect(text: string): HomoglyphResult {
    const matches: HomoglyphMatch[] = [];
    let normalized = '';
    const chars = [...text];

    for (let i = 0; i < chars.length; i++) {
      normalized += normalizeChar(chars[i], i, matches);
    }

    // Check for harmful words in normalised text
    const harmfulWordsFound: string[] = [];
    for (const word of this.harmfulWords) {
      if (normalized.includes(word)) {
        harmfulWordsFound.push(word);
      }
    }

    let riskScore = 0;
    if (matches.length > 0) {
      riskScore = 0.3; // baseline for any homoglyph
      if (harmfulWordsFound.length > 0) {
        riskScore = Math.min(1.0, 0.7 + harmfulWordsFound.length * 0.1);
      }
    }

    return {
      normalizedText: normalized,
      matches,
      riskScore,
      detected: matches.length > 0,
      harmfulWordsFound,
    };
  }
}
