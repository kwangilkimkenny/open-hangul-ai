/**
 * AEGIS Korean Defense — Hanja Bypass Detection
 *
 * Detects attempts to evade Korean keyword filters by substituting
 * Hangul with semantically-equivalent Hanja (漢字) characters.
 *
 * Covers 40+ compound Hanja→Korean mappings and 19 single-char readings.
 */

import { HARMFUL_WORDS } from './index';

// ── Types ───────────────────────────────────────────────────────────

export interface HanjaMatch {
  /** Hanja text that was detected */
  hanja: string;
  /** Korean translation */
  korean: string;
  /** Position in the input */
  position: number;
}

export interface HanjaResult {
  normalizedText: string;
  matches: HanjaMatch[];
  riskScore: number;
  detected: boolean;
  harmfulWordsFound: string[];
}

// ── CJK range helpers ───────────────────────────────────────────────

function isCjkIdeograph(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||   // CJK Unified Ideographs
    (code >= 0xf900 && code <= 0xfaff) ||   // CJK Compatibility Ideographs
    (code >= 0x3400 && code <= 0x4dbf)      // CJK Unified Ideographs Extension A
  );
}

// ── Compound Hanja→Korean mappings ──────────────────────────────────

const COMPOUND_HANJA: ReadonlyMap<string, string> = new Map([
  // Weapons
  ['爆彈', '폭탄'],
  ['爆發物', '폭발물'],
  ['爆藥', '폭약'],
  ['手榴彈', '수류탄'],
  ['火藥', '화약'],
  ['武器', '무기'],
  ['銃器', '총기'],
  ['拳銃', '권총'],
  ['小銃', '소총'],
  ['地雷', '지뢰'],
  ['核彈', '핵탄'],
  ['彈藥', '탄약'],

  // Drugs
  ['麻藥', '마약'],
  ['大麻', '대마'],
  ['覺醒劑', '각성제'],
  ['阿片', '아편'],
  ['毒藥', '독약'],

  // Violence
  ['殺人', '살인'],
  ['殺害', '살해'],
  ['暴行', '폭행'],
  ['誘拐', '유괴'],
  ['拉致', '납치'],
  ['監禁', '감금'],
  ['暴力', '폭력'],
  ['虐待', '학대'],

  // Illegal
  ['僞造', '위조'],
  ['詐欺', '사기'],
  ['密輸', '밀수'],
  ['賣春', '매춘'],
  ['密賣', '밀매'],

  // Self-harm
  ['自殺', '자살'],
  ['自害', '자해'],

  // Terrorism
  ['恐怖主義', '테러리즘'],
  ['炭疽菌', '탄저균'],
  ['放射能', '방사능'],

  // Additional
  ['毒物', '독물'],
  ['爆破', '폭파'],
  ['殺傷', '살상'],
  ['殘忍', '잔인'],
  ['脅迫', '협박'],
  ['人質', '인질'],
]);

// ── Single-character Hanja readings ─────────────────────────────────

const SINGLE_HANJA: ReadonlyMap<string, string> = new Map([
  ['爆', '폭'], ['彈', '탄'], ['藥', '약'], ['殺', '살'], ['人', '인'],
  ['銃', '총'], ['劍', '검'], ['毒', '독'], ['死', '사'], ['火', '화'],
  ['武', '무'], ['器', '기'], ['害', '해'], ['暴', '폭'], ['刀', '도'],
  ['麻', '마'], ['密', '밀'], ['僞', '위'], ['造', '조'],
]);

// Sort compound keys longest-first for greedy matching
const SORTED_COMPOUNDS = [...COMPOUND_HANJA.entries()]
  .sort((a, b) => b[0].length - a[0].length);

// ── HanjaDetector ───────────────────────────────────────────────────

export class HanjaDetector {
  private harmfulWords: readonly string[];

  constructor(harmfulWords?: readonly string[]) {
    this.harmfulWords = harmfulWords ?? HARMFUL_WORDS;
  }

  detect(text: string): HanjaResult {
    // Check if text contains any CJK ideographs
    let hasCjk = false;
    for (const ch of text) {
      if (isCjkIdeograph(ch)) {
        hasCjk = true;
        break;
      }
    }

    if (!hasCjk) {
      return {
        normalizedText: text,
        matches: [],
        riskScore: 0,
        detected: false,
        harmfulWordsFound: [],
      };
    }

    const matches: HanjaMatch[] = [];
    let normalized = text;

    // Pass 1: Replace compound Hanja (longest first)
    for (const [hanja, korean] of SORTED_COMPOUNDS) {
      let idx = normalized.indexOf(hanja);
      while (idx >= 0) {
        matches.push({ hanja, korean, position: idx });
        normalized = normalized.slice(0, idx) + korean + normalized.slice(idx + [...hanja].length);
        idx = normalized.indexOf(hanja, idx + korean.length);
      }
    }

    // Pass 2: Replace remaining single Hanja characters
    let result = '';
    const chars = [...normalized];
    for (let i = 0; i < chars.length; i++) {
      if (isCjkIdeograph(chars[i])) {
        const korean = SINGLE_HANJA.get(chars[i]);
        if (korean) {
          matches.push({ hanja: chars[i], korean, position: i });
          result += korean;
        } else {
          result += chars[i];
        }
      } else {
        result += chars[i];
      }
    }
    normalized = result;

    // Check for harmful words
    const harmfulWordsFound: string[] = [];
    for (const word of this.harmfulWords) {
      if (normalized.includes(word)) {
        harmfulWordsFound.push(word);
      }
    }

    let riskScore = 0;
    if (matches.length > 0) {
      riskScore = 0.4; // baseline for Hanja substitution
      if (harmfulWordsFound.length > 0) {
        riskScore = Math.min(1.0, 0.75 + harmfulWordsFound.length * 0.1);
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
