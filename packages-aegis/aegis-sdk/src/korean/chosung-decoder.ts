/**
 * AEGIS Korean Defense — Chosung (초성) Encoding Detection
 *
 * Detects sequences of choseong-only characters (ㄱ‑ㅎ) used to encode
 * harmful words, e.g. ㅍㅌ → 폭탄 (bomb).
 */

// ── Types ───────────────────────────────────────────────────────────

export type ChosungCategory =
  | 'weapons'
  | 'drugs'
  | 'violence'
  | 'cybercrime'
  | 'illegal'
  | 'self_harm'
  | 'hate';

export interface ChosungEntry {
  word: string;
  category: ChosungCategory;
  confidence: number;
}

export interface ChosungMatch {
  /** The chosung sequence found in the input */
  sequence: string;
  /** Decoded word(s) */
  decoded: ChosungEntry[];
  /** Start index in the original string */
  startIndex: number;
  /** End index (exclusive) */
  endIndex: number;
}

export interface ChosungResult {
  matches: ChosungMatch[];
  riskScore: number;
  hasMatch: boolean;
}

// ── Dictionary (50+ entries) ────────────────────────────────────────

const CHOSUNG_DICT: Map<string, ChosungEntry[]> = new Map([
  // ── Weapons ──
  ['ㅍㅌ',       [{ word: '폭탄', category: 'weapons', confidence: 0.9 }]],
  ['ㅍㅂㅁ',     [{ word: '폭발물', category: 'weapons', confidence: 0.9 }]],
  ['ㅊㄱ',       [{ word: '총기', category: 'weapons', confidence: 0.85 }]],
  ['ㅁㄱ',       [{ word: '무기', category: 'weapons', confidence: 0.85 }]],
  ['ㅎㅁㄱ',     [{ word: '화학무기', category: 'weapons', confidence: 0.95 }]],
  ['ㅅㄹㅌ',     [{ word: '수류탄', category: 'weapons', confidence: 0.85 }]],
  ['ㅎㅇㅁㄱ',   [{ word: '핵무기', category: 'weapons', confidence: 0.95 }]],
  ['ㅅㅁㅁㄱ',   [{ word: '생물무기', category: 'weapons', confidence: 0.95 }]],
  ['ㅎㅇ',       [{ word: '화약', category: 'weapons', confidence: 0.7 }]],
  ['ㄱㅊ',       [{ word: '권총', category: 'weapons', confidence: 0.85 }]],
  ['ㅅㅊ',       [{ word: '소총', category: 'weapons', confidence: 0.8 }]],
  ['ㅈㄹ',       [{ word: '지뢰', category: 'weapons', confidence: 0.85 }]],
  ['ㅎㅌ',       [{ word: '핵탄', category: 'weapons', confidence: 0.9 }]],
  ['ㅌㅇ',       [{ word: '탄약', category: 'weapons', confidence: 0.8 }]],

  // ── Drugs ──
  ['ㅁㅇㅎㄴ',   [{ word: '마리화나', category: 'drugs', confidence: 0.9 }]],
  ['ㅁㅇ',       [{ word: '마약', category: 'drugs', confidence: 0.85 },
                   { word: '멀웨어', category: 'cybercrime', confidence: 0.7 }]],
  ['ㄷㅁ',       [{ word: '대마', category: 'drugs', confidence: 0.85 }]],
  ['ㅍㄹㅍ',     [{ word: '필로폰', category: 'drugs', confidence: 0.9 }]],
  ['ㅎㄹㅇ',     [{ word: '헤로인', category: 'drugs', confidence: 0.9 }]],
  ['ㅋㅋㅇ',     [{ word: '코카인', category: 'drugs', confidence: 0.9 }]],
  ['ㅁㅅ',       [{ word: '메스', category: 'drugs', confidence: 0.7 },
                   { word: '밀수', category: 'illegal', confidence: 0.7 }]],
  ['ㅂㄴ',       [{ word: '본드', category: 'drugs', confidence: 0.6 }]],
  ['ㄱㅅㅈ',     [{ word: '각성제', category: 'drugs', confidence: 0.85 }]],
  ['ㅇㅍ',       [{ word: '아편', category: 'drugs', confidence: 0.85 }]],
  ['ㄷㅇ',       [{ word: '독약', category: 'drugs', confidence: 0.8 }]],

  // ── Violence ──
  ['ㅅㅇ',       [{ word: '살인', category: 'violence', confidence: 0.85 }]],
  ['ㅅㅎ',       [{ word: '살해', category: 'violence', confidence: 0.85 }]],
  ['ㅍㅎ',       [{ word: '폭행', category: 'violence', confidence: 0.85 }]],
  ['ㄴㅊ',       [{ word: '납치', category: 'violence', confidence: 0.85 }]],
  ['ㄱㅁ',       [{ word: '고문', category: 'violence', confidence: 0.85 }]],
  ['ㅂㅎ',       [{ word: '방화', category: 'violence', confidence: 0.85 }]],
  ['ㅇㄱ',       [{ word: '유괴', category: 'violence', confidence: 0.8 }]],
  ['ㄱㄱ',       [{ word: '감금', category: 'violence', confidence: 0.8 }]],
  ['ㅍㄹ',       [{ word: '폭력', category: 'violence', confidence: 0.8 }]],
  ['ㅎㄷ',       [{ word: '학대', category: 'violence', confidence: 0.85 }]],

  // ── Cybercrime ──
  ['ㅎㅋ',       [{ word: '해킹', category: 'cybercrime', confidence: 0.85 }]],
  ['ㅍㅅ',       [{ word: '피싱', category: 'cybercrime', confidence: 0.8 }]],
  ['ㄹㅅㅇ',     [{ word: '랜섬웨어', category: 'cybercrime', confidence: 0.85 }]],
  ['ㄷㄷㅅ',     [{ word: '디도스', category: 'cybercrime', confidence: 0.85 }]],
  ['ㅂㄱㅎㅊ',   [{ word: '불법해킹', category: 'cybercrime', confidence: 0.9 }]],
  ['ㅇㅅㅋㄷ',   [{ word: '악성코드', category: 'cybercrime', confidence: 0.85 }]],

  // ── Illegal ──
  ['ㅅㄱ',       [{ word: '사기', category: 'illegal', confidence: 0.7 }]],
  ['ㄷㅅ',       [{ word: '도세탁', category: 'illegal', confidence: 0.6 }]],
  ['ㅎㄱㅈ',     [{ word: '횡령죄', category: 'illegal', confidence: 0.8 }]],
  ['ㅂㅂㅁㅁ',   [{ word: '불법매매', category: 'illegal', confidence: 0.85 }]],
  ['ㅇㅈ',       [{ word: '위조', category: 'illegal', confidence: 0.75 }]],
  ['ㅁㅁ',       [{ word: '밀매', category: 'illegal', confidence: 0.8 }]],
  ['ㅁㅊ',       [{ word: '매춘', category: 'illegal', confidence: 0.8 }]],

  // ── Self-harm ──
  ['ㅈㅅ',       [{ word: '자살', category: 'self_harm', confidence: 0.85 }]],
  ['ㅈㅎ',       [{ word: '자해', category: 'self_harm', confidence: 0.85 }]],
  ['ㅈㅅㅂㅂ',   [{ word: '자살방법', category: 'self_harm', confidence: 0.95 }]],

  // ── Hate ──
  ['ㅂㅅ',       [{ word: '비속어', category: 'hate', confidence: 0.6 }]],
  ['ㅅㅂ',       [{ word: '욕설', category: 'hate', confidence: 0.7 }]],

  // ── Terrorism ──
  ['ㅌㄹ',       [{ word: '테러', category: 'violence', confidence: 0.85 }]],
  ['ㅌㅈㄱ',     [{ word: '탄저균', category: 'weapons', confidence: 0.9 }]],
  ['ㅂㅅㄴ',     [{ word: '방사능', category: 'weapons', confidence: 0.85 }]],
  ['ㅌㄹㄹㅈ',   [{ word: '테러리즘', category: 'violence', confidence: 0.9 }]],
  ['ㅅㅎㅎ',     [{ word: '생화학', category: 'weapons', confidence: 0.9 }]],

  // ── Additional weapons ──
  ['ㄷㄱ',       [{ word: '단검', category: 'weapons', confidence: 0.8 }]],
  ['ㅎㅇ',       [{ word: '화염병', category: 'weapons', confidence: 0.85 }]],
  ['ㅍㅇ',       [{ word: '폭약', category: 'weapons', confidence: 0.9 }]],

  // ── Additional drugs ──
  ['ㅁㅊㅈ',     [{ word: '마취제', category: 'drugs', confidence: 0.75 }]],
  ['ㅎㄹㅂ',     [{ word: '히로뽕', category: 'drugs', confidence: 0.95 }]],

  // ── Additional cybercrime ──
  ['ㅋㄹㅋ',     [{ word: '크래킹', category: 'cybercrime', confidence: 0.9 }]],
  ['ㅅㅁㅅ',     [{ word: '스미싱', category: 'cybercrime', confidence: 0.85 }]],
  ['ㅂㅇㅅㅍㅅ', [{ word: '보이스피싱', category: 'cybercrime', confidence: 0.95 }]],

  // ── Additional violence ──
  ['ㄱㄱ',       [{ word: '강간', category: 'violence', confidence: 0.9 }]],
  ['ㄷㅂ',       [{ word: '도박', category: 'illegal', confidence: 0.7 }]],
  ['ㅎㅍ',       [{ word: '학폭', category: 'violence', confidence: 0.85 }]],
]);

// ── Helper ──────────────────────────────────────────────────────────

function isChoseongChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  // Compatibility Jamo consonants ㄱ(0x3131)‑ㅎ(0x314E)
  return code >= 0x3131 && code <= 0x314e;
}

// ── Decoder class ───────────────────────────────────────────────────

export class ChosungDecoder {
  private dict: Map<string, ChosungEntry[]>;

  constructor(extraEntries?: Map<string, ChosungEntry[]>) {
    this.dict = new Map(CHOSUNG_DICT);
    if (extraEntries) {
      for (const [k, v] of extraEntries) {
        this.dict.set(k, v);
      }
    }
  }

  /**
   * Scan `text` for consecutive choseong-only runs (length ≥ 2) and
   * look them up in the dictionary.
   */
  decode(text: string): ChosungResult {
    const matches: ChosungMatch[] = [];
    const chars = [...text];
    let i = 0;

    while (i < chars.length) {
      if (isChoseongChar(chars[i])) {
        // Collect the full run of choseong chars
        let runStart = i;
        let run = '';
        while (i < chars.length && isChoseongChar(chars[i])) {
          run += chars[i];
          i++;
        }

        if (run.length >= 2) {
          // Try all sub-windows (longest match first)
          for (let len = run.length; len >= 2; len--) {
            for (let s = 0; s <= run.length - len; s++) {
              const sub = run.slice(s, s + len);
              const entries = this.dict.get(sub);
              if (entries) {
                // Avoid duplicate matches at the same position
                const absStart = runStart + s;
                const absEnd = absStart + len;
                const alreadyMatched = matches.some(
                  m => m.startIndex === absStart && m.endIndex === absEnd && m.sequence === sub,
                );
                if (!alreadyMatched) {
                  matches.push({
                    sequence: sub,
                    decoded: entries,
                    startIndex: absStart,
                    endIndex: absEnd,
                  });
                }
              }
            }
          }
        }
      } else {
        i++;
      }
    }

    const riskScore = matches.length === 0
      ? 0
      : Math.min(1, matches.reduce((max, m) =>
          Math.max(max, ...m.decoded.map(e => e.confidence)), 0));

    return {
      matches,
      riskScore,
      hasMatch: matches.length > 0,
    };
  }
}
