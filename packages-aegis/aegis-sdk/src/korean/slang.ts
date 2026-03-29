/**
 * AEGIS Korean Defense — Slang Detector (37+ entries)
 *
 * Detects Korean internet slang, euphemisms, and coded language
 * used to refer to harmful concepts.
 */

import { isHangulSyllable } from './jamo';

// ── Types ───────────────────────────────────────────────────────────

export type SlangCategory =
  | 'self_harm'
  | 'drugs'
  | 'weapons'
  | 'violence'
  | 'cybercrime';

export interface SlangEntry {
  /** The slang term */
  slang: string;
  /** What it actually means */
  meaning: string;
  /** Risk category */
  category: SlangCategory;
  /** Confidence 0‑1 */
  confidence: number;
}

export interface SlangMatch {
  entry: SlangEntry;
  position: number;
}

export interface SlangResult {
  matches: SlangMatch[];
  riskScore: number;
  detected: boolean;
}

// ── Dictionary ──────────────────────────────────────────────────────

const SLANG_DICT: readonly SlangEntry[] = [
  // ── Self-harm ──
  { slang: '자삭', meaning: '자살', category: 'self_harm', confidence: 0.95 },
  { slang: '갈무리', meaning: '자살', category: 'self_harm', confidence: 0.7 },
  { slang: '극단적선택', meaning: '자살', category: 'self_harm', confidence: 0.9 },
  { slang: '극선', meaning: '자살', category: 'self_harm', confidence: 0.85 },
  { slang: '손목긋기', meaning: '자해', category: 'self_harm', confidence: 0.95 },
  { slang: '리스컷', meaning: '자해', category: 'self_harm', confidence: 0.95 },
  { slang: '리컷', meaning: '자해', category: 'self_harm', confidence: 0.9 },
  { slang: '벌컷', meaning: '자해', category: 'self_harm', confidence: 0.8 },
  { slang: '약먹기', meaning: '자살시도', category: 'self_harm', confidence: 0.7 },

  // ── Drugs ──
  { slang: '뽕', meaning: '마약', category: 'drugs', confidence: 0.85 },
  { slang: '아이스', meaning: '필로폰', category: 'drugs', confidence: 0.8 },
  { slang: '떨', meaning: '대마초', category: 'drugs', confidence: 0.8 },
  { slang: '크리스탈', meaning: '필로폰', category: 'drugs', confidence: 0.75 },
  { slang: '작대기', meaning: '필로폰', category: 'drugs', confidence: 0.9 },
  { slang: '빠루', meaning: '마약', category: 'drugs', confidence: 0.7 },
  { slang: '히로뽕', meaning: '필로폰', category: 'drugs', confidence: 0.95 },
  { slang: '캔디', meaning: '마약', category: 'drugs', confidence: 0.65 },
  { slang: '물뽕', meaning: 'GHB', category: 'drugs', confidence: 0.95 },
  { slang: '엑스터시', meaning: 'MDMA', category: 'drugs', confidence: 0.9 },
  { slang: '엑스', meaning: 'MDMA', category: 'drugs', confidence: 0.6 },
  { slang: '초코', meaning: '대마초식품', category: 'drugs', confidence: 0.6 },

  // ── Weapons ──
  { slang: '빵', meaning: '폭탄', category: 'weapons', confidence: 0.5 },
  { slang: '쏘기', meaning: '총기사용', category: 'weapons', confidence: 0.6 },
  { slang: '칼빵', meaning: '칼로찌르기', category: 'weapons', confidence: 0.9 },
  { slang: '화염병', meaning: '화염병', category: 'weapons', confidence: 0.95 },
  { slang: '쇠파이프', meaning: '흉기', category: 'weapons', confidence: 0.8 },

  // ── Cybercrime ──
  { slang: '털다', meaning: '해킹', category: 'cybercrime', confidence: 0.7 },
  { slang: '먹튀', meaning: '사기', category: 'cybercrime', confidence: 0.85 },
  { slang: '보이스피싱', meaning: '전화사기', category: 'cybercrime', confidence: 0.95 },
  { slang: '보이스', meaning: '전화사기', category: 'cybercrime', confidence: 0.5 },
  { slang: '피싱', meaning: '피싱', category: 'cybercrime', confidence: 0.9 },
  { slang: '스미싱', meaning: '문자사기', category: 'cybercrime', confidence: 0.95 },
  { slang: '랜섬', meaning: '랜섬웨어', category: 'cybercrime', confidence: 0.85 },
  { slang: '디디오에스', meaning: 'DDoS', category: 'cybercrime', confidence: 0.9 },
  { slang: '좀비피씨', meaning: '봇넷', category: 'cybercrime', confidence: 0.85 },
  { slang: '크래킹', meaning: '해킹', category: 'cybercrime', confidence: 0.9 },

  // ── Violence ──
  { slang: '패다', meaning: '폭행', category: 'violence', confidence: 0.8 },
  { slang: '찍다', meaning: '협박', category: 'violence', confidence: 0.6 },
  { slang: '삥뜯기', meaning: '갈취', category: 'violence', confidence: 0.9 },
  { slang: '삥', meaning: '갈취', category: 'violence', confidence: 0.75 },
  { slang: '린치', meaning: '집단폭행', category: 'violence', confidence: 0.9 },
  { slang: '왕따시키기', meaning: '집단따돌림', category: 'violence', confidence: 0.85 },
  { slang: '학폭', meaning: '학교폭력', category: 'violence', confidence: 0.9 },
  { slang: '셔틀', meaning: '강제심부름', category: 'violence', confidence: 0.8 },
  { slang: '빠따', meaning: '폭행도구', category: 'violence', confidence: 0.85 },
  { slang: '깔', meaning: '살인', category: 'violence', confidence: 0.6 },
];

// Sort by slang length descending for longest-match-first
const SORTED_SLANG = [...SLANG_DICT].sort((a, b) => b.slang.length - a.slang.length);

// ── SlangDetector ───────────────────────────────────────────────────

export class SlangDetector {
  private entries: readonly SlangEntry[];

  constructor(extraEntries?: SlangEntry[]) {
    if (extraEntries && extraEntries.length > 0) {
      this.entries = [...SORTED_SLANG, ...extraEntries].sort(
        (a, b) => b.slang.length - a.slang.length,
      );
    } else {
      this.entries = SORTED_SLANG;
    }
  }

  detect(text: string): SlangResult {
    const matches: SlangMatch[] = [];
    const matched = new Set<string>();

    for (const entry of this.entries) {
      let idx = text.indexOf(entry.slang);
      while (idx >= 0) {
        if (!matched.has(`${entry.slang}@${idx}`)) {
          matched.add(`${entry.slang}@${idx}`);
          matches.push({ entry, position: idx });
        }
        idx = text.indexOf(entry.slang, idx + 1);
      }
    }

    const riskScore = matches.length === 0
      ? 0
      : Math.min(1.0, matches.reduce((max, m) => Math.max(max, m.entry.confidence), 0));

    return {
      matches,
      riskScore,
      detected: matches.length > 0,
    };
  }
}
