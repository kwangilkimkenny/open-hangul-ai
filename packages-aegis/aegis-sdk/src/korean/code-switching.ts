/**
 * AEGIS Korean Defense — Korean-English Code-Switching Detection
 *
 * Detects four evasion patterns:
 *   1. EnglishVerbKoreanNoun   — "make 폭탄"
 *   2. EnglishQuestionKorean   — "how to 해킹"
 *   3. KoreanRequestEnglish    — "알려줘 bomb"
 *   4. RomanizedKorean         — "poktan" → 폭탄
 */

import { isHangulSyllable } from './jamo';

// ── Types ───────────────────────────────────────────────────────────

export type CodeSwitchCategory =
  | 'weapons'
  | 'drugs'
  | 'violence'
  | 'cybercrime'
  | 'illegal'
  | 'self_harm';

export type CodeSwitchPatternType =
  | 'EnglishVerbKoreanNoun'
  | 'EnglishQuestionKorean'
  | 'KoreanRequestEnglish'
  | 'RomanizedKorean';

export interface CodeSwitchMatch {
  patternType: CodeSwitchPatternType;
  matchedText: string;
  category: CodeSwitchCategory;
  confidence: number;
}

export interface CodeSwitchResult {
  matches: CodeSwitchMatch[];
  riskScore: number;
  detected: boolean;
}

// ── Word lists ──────────────────────────────────────────────────────

const ENGLISH_ACTION_VERBS = [
  'make', 'build', 'create', 'hack', 'buy', 'kill', 'get', 'find',
  'sell', 'steal', 'craft', 'brew', 'cook', 'manufacture', 'produce',
  'obtain', 'acquire', 'synthesize', 'assemble', 'smuggle',
];

const ENGLISH_QUESTION_PREFIXES = [
  'how to', 'tell me', 'teach me', 'show me', 'explain how',
  'help me', 'ways to', 'steps to', 'guide to', 'method to',
];

const KOREAN_REQUEST_MARKERS = [
  '알려줘', '가르쳐줘', '만들어줘', '보여줘', '설명해줘',
  '방법', '하는법', '하는방법', '만드는법', '만드는방법',
  '어떻게', '알려주세요', '가르쳐주세요',
];

const KOREAN_HARMFUL_KEYWORDS: ReadonlyMap<string, CodeSwitchCategory> = new Map([
  ['폭탄', 'weapons'], ['폭발물', 'weapons'], ['총기', 'weapons'],
  ['무기', 'weapons'], ['화학무기', 'weapons'], ['핵무기', 'weapons'],
  ['수류탄', 'weapons'], ['화약', 'weapons'],
  ['해킹', 'cybercrime'], ['랜섬웨어', 'cybercrime'], ['피싱', 'cybercrime'],
  ['악성코드', 'cybercrime'], ['디도스', 'cybercrime'],
  ['마약', 'drugs'], ['마리화나', 'drugs'], ['필로폰', 'drugs'],
  ['코카인', 'drugs'], ['헤로인', 'drugs'], ['대마', 'drugs'],
  ['메스암페타민', 'drugs'],
  ['살인', 'violence'], ['살해', 'violence'], ['납치', 'violence'],
  ['폭행', 'violence'], ['감금', 'violence'],
  ['자살', 'self_harm'], ['자해', 'self_harm'],
  ['제조법', 'illegal'], ['제조', 'illegal'], ['밀수', 'illegal'],
  ['사기', 'illegal'], ['위조', 'illegal'],
]);

const ENGLISH_HARMFUL_TERMS: ReadonlyMap<string, CodeSwitchCategory> = new Map([
  ['bomb', 'weapons'], ['explosive', 'weapons'], ['weapon', 'weapons'],
  ['gun', 'weapons'], ['grenade', 'weapons'], ['firearm', 'weapons'],
  ['hack', 'cybercrime'], ['malware', 'cybercrime'], ['ransomware', 'cybercrime'],
  ['phishing', 'cybercrime'], ['ddos', 'cybercrime'], ['exploit', 'cybercrime'],
  ['drug', 'drugs'], ['cocaine', 'drugs'], ['heroin', 'drugs'],
  ['meth', 'drugs'], ['methamphetamine', 'drugs'],
  ['poison', 'violence'], ['kill', 'violence'], ['murder', 'violence'],
]);

// ── Romanized Korean patterns ───────────────────────────────────────

interface RomanizedEntry {
  patterns: RegExp[];
  korean: string;
  category: CodeSwitchCategory;
  confidence: number;
}

const ROMANIZED_KOREAN: RomanizedEntry[] = [
  {
    patterns: [/\bpoktan\b/i, /\bpokt['']?an\b/i],
    korean: '폭탄', category: 'weapons', confidence: 0.85,
  },
  {
    patterns: [/\bchonggi\b/i, /\bchong[-]?gi\b/i],
    korean: '총기', category: 'weapons', confidence: 0.8,
  },
  {
    patterns: [/\bhaeking\b/i, /\bhaek['']?ing\b/i],
    korean: '해킹', category: 'cybercrime', confidence: 0.7,
  },
  {
    patterns: [/\bmayak\b/i, /\bma[-]?yak\b/i],
    korean: '마약', category: 'drugs', confidence: 0.85,
  },
  {
    patterns: [/\bphillopon\b/i, /\bp['']illopon\b/i, /\bpilopon\b/i],
    korean: '필로폰', category: 'drugs', confidence: 0.85,
  },
  {
    patterns: [/\bsalin\b/i, /\bsal[-]?in\b/i],
    korean: '살인', category: 'violence', confidence: 0.8,
  },
  {
    patterns: [/\bjasal\b/i, /\bja[-]?sal\b/i],
    korean: '자살', category: 'self_harm', confidence: 0.8,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

function containsHangul(text: string): boolean {
  for (const ch of text) {
    if (isHangulSyllable(ch)) return true;
  }
  return false;
}

function findKoreanHarmful(text: string): Array<{ word: string; category: CodeSwitchCategory }> {
  const results: Array<{ word: string; category: CodeSwitchCategory }> = [];
  for (const [word, cat] of KOREAN_HARMFUL_KEYWORDS) {
    if (text.includes(word)) {
      results.push({ word, category: cat });
    }
  }
  return results;
}

function findEnglishHarmful(text: string): Array<{ term: string; category: CodeSwitchCategory }> {
  const lower = text.toLowerCase();
  const results: Array<{ term: string; category: CodeSwitchCategory }> = [];
  for (const [term, cat] of ENGLISH_HARMFUL_TERMS) {
    const re = new RegExp(`\\b${term}\\b`, 'i');
    if (re.test(lower)) {
      results.push({ term, category: cat });
    }
  }
  return results;
}

// ── CodeSwitchDetector ──────────────────────────────────────────────

export class CodeSwitchDetector {
  detect(text: string): CodeSwitchResult {
    const matches: CodeSwitchMatch[] = [];
    const lower = text.toLowerCase();

    // ── Pattern 1: English Verb + Korean Noun ──
    for (const verb of ENGLISH_ACTION_VERBS) {
      const re = new RegExp(`\\b${verb}\\b`, 'i');
      if (re.test(text)) {
        const koreanHits = findKoreanHarmful(text);
        for (const hit of koreanHits) {
          matches.push({
            patternType: 'EnglishVerbKoreanNoun',
            matchedText: `${verb} + ${hit.word}`,
            category: hit.category,
            confidence: 0.85,
          });
        }
      }
    }

    // ── Pattern 2: English Question + Korean ──
    for (const prefix of ENGLISH_QUESTION_PREFIXES) {
      if (lower.includes(prefix)) {
        const koreanHits = findKoreanHarmful(text);
        for (const hit of koreanHits) {
          matches.push({
            patternType: 'EnglishQuestionKorean',
            matchedText: `${prefix} + ${hit.word}`,
            category: hit.category,
            confidence: 0.9,
          });
        }
      }
    }

    // ── Pattern 3: Korean Request + English ──
    for (const marker of KOREAN_REQUEST_MARKERS) {
      if (text.includes(marker)) {
        const engHits = findEnglishHarmful(text);
        for (const hit of engHits) {
          matches.push({
            patternType: 'KoreanRequestEnglish',
            matchedText: `${marker} + ${hit.term}`,
            category: hit.category,
            confidence: 0.85,
          });
        }
      }
    }

    // ── Pattern 4: Romanized Korean ──
    for (const entry of ROMANIZED_KOREAN) {
      for (const pat of entry.patterns) {
        const m = text.match(pat);
        if (m) {
          matches.push({
            patternType: 'RomanizedKorean',
            matchedText: `${m[0]} → ${entry.korean}`,
            category: entry.category,
            confidence: entry.confidence,
          });
          break; // one match per entry is enough
        }
      }
    }

    // Deduplicate by matchedText
    const seen = new Set<string>();
    const deduped = matches.filter(m => {
      if (seen.has(m.matchedText)) return false;
      seen.add(m.matchedText);
      return true;
    });

    const riskScore = deduped.length === 0
      ? 0
      : Math.min(1.0, deduped.reduce((max, m) => Math.max(max, m.confidence), 0));

    return {
      matches: deduped,
      riskScore,
      detected: deduped.length > 0,
    };
  }
}
