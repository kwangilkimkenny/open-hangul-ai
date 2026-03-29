/**
 * AEGIS Korean Defense — Archaic Hangul Normalization
 *
 * Maps 60+ archaic/obsolete Hangul characters to their modern equivalents
 * to defeat evasion attacks that use pre-modern Korean script.
 *
 * Covers:
 *   - Arae-a (아래아, U+119E / U+318D) → ㅏ
 *   - Old consonants (ㆁ, ㆆ, ㅿ, ㅸ, etc.)
 *   - Jamo Extended-A (U+A960‑U+A97C) — archaic choseong
 *   - Jamo Extended-B Jungseong (U+D7B0‑U+D7C6)
 *   - Jamo Extended-B Jongseong (U+D7CB‑U+D7E9)
 */

import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export interface ArchaicMatch {
  original: string;
  modern: string;
  position: number;
  codePoint: number;
}

export interface ArchaicHangulResult {
  normalizedText: string;
  matches: ArchaicMatch[];
  riskScore: number;
  detected: boolean;
  harmfulWordsFound: string[];
}

// ── Mapping tables ──────────────────────────────────────────────────

/**
 * Individual archaic character → modern equivalent.
 * Keyed by code point.
 */
const ARCHAIC_MAP: ReadonlyMap<number, string> = new Map([
  // ── Arae-a (아래아) ──
  [0x119e, 'ㅏ'],  // HANGUL JUNGSEONG ARAEA
  [0x318d, 'ㅏ'],  // HANGUL LETTER ARAEAE (Compat)

  // ── Old consonants (Compatibility Jamo area) ──
  [0x3181, 'ㅇ'],  // ㆁ YESIEUNG → ㅇ
  [0x3186, 'ㅎ'],  // ㆆ YEORINHIEUH → ㅎ
  [0x317f, 'ㅅ'],  // ㅿ PANSIOS → ㅅ
  [0x3178, 'ㅂ'],  // ㅸ KAPYEOUNPIEUP → ㅂ
  [0x3179, 'ㅂ'],  // ㅹ SSANGPIEUP-SIOS (rare) → ㅂ
  [0x317a, 'ㅅ'],  // ㅺ SIOS-KIYEOK → ㅅ
  [0x317b, 'ㅅ'],  // ㅻ SIOS-NIEUN → ㅅ
  [0x317c, 'ㅅ'],  // ㅼ SIOS-TIKEUT → ㅅ
  [0x317d, 'ㅅ'],  // ㅽ SIOS-PIEUP → ㅅ
  [0x317e, 'ㅅ'],  // ㅾ SIOS-CIEUC → ㅅ
  [0x3180, 'ㅇ'],  // ㆀ SSANGYESIEUNG → ㅇ
  [0x3182, 'ㅇ'],  // ㆂ YESIEUNG-SIOS → ㅇ
  [0x3183, 'ㅇ'],  // ㆃ YESIEUNG-PANSIOS → ㅇ
  [0x3184, 'ㅇ'],  // ㆄ KAPYEOUNPHIEUPH → ㅍ
  [0x3185, 'ㅎ'],  // ㆅ SSANGHIEUH → ㅎ
  [0x3187, 'ㅛ'],  // ㆇ YO-YA → ㅛ
  [0x3188, 'ㅛ'],  // ㆈ YO-YAE → ㅛ
  [0x3189, 'ㅛ'],  // ㆉ YO-I → ㅛ
  [0x318a, 'ㅠ'],  // ㆊ YU-YEO → ㅠ
  [0x318b, 'ㅠ'],  // ㆋ YU-YE → ㅠ
  [0x318c, 'ㅠ'],  // ㆌ YU-I → ㅠ

  // ── Conjoining Jamo archaic choseong (U+1100 block, beyond modern) ──
  [0x1113, 'ㄴ'],  // NIEUN-KIYEOK → ㄴ
  [0x1114, 'ㄴ'],  // SSANGNIEUN → ㄴ
  [0x1115, 'ㄴ'],  // NIEUN-TIKEUT → ㄴ
  [0x1116, 'ㄴ'],  // NIEUN-PIEUP → ㄴ
  [0x1117, 'ㄷ'],  // TIKEUT-KIYEOK → ㄷ
  [0x1118, 'ㄹ'],  // RIEUL-NIEUN → ㄹ
  [0x1119, 'ㄹ'],  // SSANGRIEUL → ㄹ
  [0x111a, 'ㄹ'],  // RIEUL-HIEUH → ㄹ
  [0x111b, 'ㅁ'],  // KAPYEOUNMIEUM → ㅁ
  [0x111c, 'ㅂ'],  // PIEUP-KIYEOK → ㅂ
  [0x111d, 'ㅂ'],  // PIEUP-NIEUN → ㅂ
  [0x111e, 'ㅂ'],  // PIEUP-TIKEUT → ㅂ
  [0x111f, 'ㅂ'],  // PIEUP-SIOS → ㅂ
  [0x1120, 'ㅂ'],  // PIEUP-SIOS-KIYEOK → ㅂ
  [0x1121, 'ㅂ'],  // PIEUP-SIOS-TIKEUT → ㅂ
  [0x1122, 'ㅂ'],  // PIEUP-SIOS-PIEUP → ㅂ
  [0x1123, 'ㅂ'],  // PIEUP-SIOS-CIEUC → ㅂ
  [0x1124, 'ㅂ'],  // PIEUP-CIEUC → ㅂ
  [0x1125, 'ㅂ'],  // PIEUP-CHIEUCH → ㅂ
  [0x1126, 'ㅂ'],  // PIEUP-THIEUTH → ㅂ
  [0x1127, 'ㅂ'],  // PIEUP-PHIEUPH → ㅂ
  [0x1128, 'ㅂ'],  // KAPYEOUNPIEUP → ㅂ
  [0x1129, 'ㅂ'],  // KAPYEOUNSSANGPIEUP → ㅂ
  [0x112a, 'ㅅ'],  // SIOS-KIYEOK → ㅅ
  [0x112b, 'ㅅ'],  // SIOS-NIEUN → ㅅ
  [0x112c, 'ㅅ'],  // SIOS-TIKEUT → ㅅ
  [0x112d, 'ㅅ'],  // SIOS-RIEUL → ㅅ
  [0x112e, 'ㅅ'],  // SIOS-MIEUM → ㅅ
  [0x112f, 'ㅅ'],  // SIOS-PIEUP → ㅅ

  // ── Jamo Extended-A: archaic choseong (U+A960‑U+A97C) ──
  [0xa960, 'ㄷ'],  // TIKEUT-MIEUM → ㄷ
  [0xa961, 'ㄷ'],  // TIKEUT-PIEUP → ㄷ
  [0xa962, 'ㄷ'],  // TIKEUT-SIOS → ㄷ
  [0xa963, 'ㄷ'],  // TIKEUT-CIEUC → ㄷ
  [0xa964, 'ㄹ'],  // RIEUL-KIYEOK → ㄹ
  [0xa965, 'ㄹ'],  // RIEUL-SSANGKIYEOK → ㄹ
  [0xa966, 'ㄹ'],  // RIEUL-TIKEUT → ㄹ
  [0xa967, 'ㄹ'],  // RIEUL-SSANGTIKEUT → ㄹ
  [0xa968, 'ㄹ'],  // RIEUL-MIEUM → ㄹ
  [0xa969, 'ㄹ'],  // RIEUL-PIEUP → ㄹ
  [0xa96a, 'ㄹ'],  // RIEUL-SSANGPIEUP → ㄹ
  [0xa96b, 'ㄹ'],  // RIEUL-KAPYEOUNPIEUP → ㄹ
  [0xa96c, 'ㄹ'],  // RIEUL-SIOS → ㄹ
  [0xa96d, 'ㄹ'],  // RIEUL-CIEUC → ㄹ
  [0xa96e, 'ㄹ'],  // RIEUL-KHIEUKH → ㄹ
  [0xa96f, 'ㅁ'],  // MIEUM-KIYEOK → ㅁ
  [0xa970, 'ㅁ'],  // MIEUM-TIKEUT → ㅁ
  [0xa971, 'ㅁ'],  // MIEUM-SIOS → ㅁ
  [0xa972, 'ㅂ'],  // PIEUP-SIOS-THIEUTH → ㅂ
  [0xa973, 'ㅂ'],  // PIEUP-KHIEUKH → ㅂ
  [0xa974, 'ㅂ'],  // PIEUP-HIEUH → ㅂ
  [0xa975, 'ㅅ'],  // SSANGSIOS-PIEUP → ㅅ
  [0xa976, 'ㅇ'],  // IEUNG-RIEUL → ㅇ
  [0xa977, 'ㅇ'],  // IEUNG-HIEUH → ㅇ
  [0xa978, 'ㅈ'],  // SSANGCIEUC-HIEUH → ㅈ
  [0xa979, 'ㅊ'],  // SSANGCHIEUCH → ㅊ
  [0xa97a, 'ㅍ'],  // PHIEUPH-SIOS → ㅍ
  [0xa97b, 'ㅍ'],  // PHIEUPH-THIEUTH → ㅍ
  [0xa97c, 'ㅎ'],  // HIEUH-SIOS → ㅎ

  // ── Jamo Extended-B: archaic jungseong (U+D7B0‑U+D7C6) ──
  [0xd7b0, 'ㅗ'],  // O-YEO → ㅗ
  [0xd7b1, 'ㅗ'],  // O-O-I → ㅗ
  [0xd7b2, 'ㅛ'],  // YO-A → ㅛ
  [0xd7b3, 'ㅛ'],  // YO-AE → ㅛ
  [0xd7b4, 'ㅛ'],  // YO-EO → ㅛ
  [0xd7b5, 'ㅜ'],  // U-YEO → ㅜ
  [0xd7b6, 'ㅜ'],  // U-I-I → ㅜ
  [0xd7b7, 'ㅠ'],  // YU-AE → ㅠ
  [0xd7b8, 'ㅠ'],  // YU-O → ㅠ
  [0xd7b9, 'ㅡ'],  // EU-A → ㅡ
  [0xd7ba, 'ㅡ'],  // EU-EO → ㅡ
  [0xd7bb, 'ㅡ'],  // EU-E → ㅡ
  [0xd7bc, 'ㅡ'],  // EU-O → ㅡ
  [0xd7bd, 'ㅣ'],  // I-YA-O → ㅣ
  [0xd7be, 'ㅣ'],  // I-YAE → ㅣ
  [0xd7bf, 'ㅣ'],  // I-YEO → ㅣ
  [0xd7c0, 'ㅣ'],  // I-YE → ㅣ
  [0xd7c1, 'ㅣ'],  // I-O-I → ㅣ
  [0xd7c2, 'ㅣ'],  // I-YO → ㅣ
  [0xd7c3, 'ㅣ'],  // I-YU → ㅣ
  [0xd7c4, 'ㅣ'],  // I-I → ㅣ
  [0xd7c5, 'ㅏ'],  // ARAEA-A → ㅏ
  [0xd7c6, 'ㅡ'],  // ARAEA-E → ㅡ

  // ── Jamo Extended-B: archaic jongseong (U+D7CB‑U+D7E9) ──
  [0xd7cb, 'ㄴ'],  // NIEUN-RIEUL → ㄴ
  [0xd7cc, 'ㄴ'],  // NIEUN-CHIEUCH → ㄴ
  [0xd7cd, 'ㄷ'],  // SSANGTIKEUT → ㄷ
  [0xd7ce, 'ㄷ'],  // TIKEUT-PIEUP → ㄷ
  [0xd7cf, 'ㄷ'],  // TIKEUT-SIOS → ㄷ
  [0xd7d0, 'ㄷ'],  // TIKEUT-SIOS-KIYEOK → ㄷ
  [0xd7d1, 'ㄷ'],  // TIKEUT-CIEUC → ㄷ
  [0xd7d2, 'ㄷ'],  // TIKEUT-CHIEUCH → ㄷ
  [0xd7d3, 'ㄷ'],  // TIKEUT-THIEUTH → ㄷ
  [0xd7d4, 'ㄹ'],  // RIEUL-SSANGKIYEOK → ㄹ
  [0xd7d5, 'ㄹ'],  // RIEUL-KIYEOK-SIOS → ㄹ
  [0xd7d6, 'ㄹ'],  // RIEUL-TIKEUT → ㄹ
  [0xd7d7, 'ㄹ'],  // RIEUL-SSANGTIKEUT → ㄹ
  [0xd7d8, 'ㅁ'],  // MIEUM-KIYEOK → ㅁ
  [0xd7d9, 'ㅁ'],  // MIEUM-RIEUL → ㅁ
  [0xd7da, 'ㅁ'],  // MIEUM-PIEUP → ㅁ
  [0xd7db, 'ㅁ'],  // MIEUM-SIOS → ㅁ
  [0xd7dc, 'ㅁ'],  // MIEUM-SSANGSIOS → ㅁ
  [0xd7dd, 'ㅁ'],  // MIEUM-PANSIOS → ㅁ
  [0xd7de, 'ㅁ'],  // MIEUM-CHIEUCH → ㅁ
  [0xd7df, 'ㅁ'],  // MIEUM-HIEUH → ㅁ
  [0xd7e0, 'ㅂ'],  // KAPYEOUNPIEUP → ㅂ
  [0xd7e1, 'ㅂ'],  // PIEUP-TIKEUT → ㅂ
  [0xd7e2, 'ㅂ'],  // PIEUP-RIEUL-PHIEUPH → ㅂ
  [0xd7e3, 'ㅂ'],  // PIEUP-MIEUM → ㅂ
  [0xd7e4, 'ㅅ'],  // SIOS-KIYEOK → ㅅ
  [0xd7e5, 'ㅅ'],  // SIOS-TIKEUT → ㅅ
  [0xd7e6, 'ㅇ'],  // YESIEUNG → ㅇ
  [0xd7e7, 'ㅇ'],  // YESIEUNG-SIOS → ㅇ
  [0xd7e8, 'ㅇ'],  // YESIEUNG-PANSIOS → ㅇ
  [0xd7e9, 'ㅍ'],  // PHIEUPH-PIEUP → ㅍ
]);

// ── ArchaicHangulNormalizer ─────────────────────────────────────────

export class ArchaicHangulNormalizer {
  private harmfulWords: readonly string[];

  constructor(harmfulWords?: readonly string[]) {
    this.harmfulWords = harmfulWords ?? HARMFUL_WORDS;
  }

  normalize(text: string): ArchaicHangulResult {
    const matches: ArchaicMatch[] = [];
    let normalized = '';
    const chars = [...text];

    for (let i = 0; i < chars.length; i++) {
      const code = chars[i].codePointAt(0)!;
      const modern = ARCHAIC_MAP.get(code);
      if (modern) {
        matches.push({
          original: chars[i],
          modern,
          position: i,
          codePoint: code,
        });
        normalized += modern;
      } else {
        normalized += chars[i];
      }
    }

    const harmfulWordsFound: string[] = [];
    for (const word of this.harmfulWords) {
      if (normalized.includes(word)) {
        harmfulWordsFound.push(word);
      }
    }

    let riskScore = 0;
    if (matches.length > 0) {
      riskScore = 0.3;
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
