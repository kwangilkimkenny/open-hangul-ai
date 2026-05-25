/**
 * Hanja Converter
 * 한글 -> 한자 변환 엔진
 *
 * - 단어 우선 매칭 (예: '국가' -> '國家')
 * - 단어 사전에 없으면 음절 단위 fallback
 * - 한자 후보가 없는 음절은 원본 한글 유지
 *
 * @module hanja/hanja-converter
 * @version 1.0.0
 */

import {
  getSyllableCandidates,
  getWordCandidates,
  WORD_DICTIONARY,
  isHangulSyllable,
} from './hanja-dictionary.js';

/**
 * @typedef {import('./hanja-dictionary.js').HanjaEntry} HanjaEntry
 */

/**
 * 한글 단어/음절 후보 검색.
 * - 단어 길이가 2 이상이고 WORD_DICTIONARY에 있으면 해당 후보를 우선 반환.
 * - 그 외에는 음절 단위 사전(SYLLABLE_DICTIONARY)에서 첫 글자 후보를 반환.
 *   (UI에서는 한 글자씩 변환을 사용자가 선택하도록 한다.)
 *
 * @param {string} hangul 한글 문자열
 * @returns {Array<HanjaEntry>} 후보 목록 (frequency 내림차순)
 */
export function lookupHanja(hangul) {
  if (!hangul || typeof hangul !== 'string') return [];
  const text = hangul.trim();
  if (!text) return [];

  // 1) 단어 우선 매칭
  if (text.length >= 2) {
    const word = getWordCandidates(text);
    if (word.length > 0) return word.slice();
  }

  // 2) 한 글자(또는 첫 음절) 후보
  const firstChar = text[0];
  return getSyllableCandidates(firstChar).slice();
}

/**
 * 텍스트 내 가장 긴 매칭 단어 탐색 (start 위치 기준).
 * 사전에 등록된 단어 길이 후보를 길이 내림차순으로 시도.
 *
 * @param {string} text
 * @param {number} start
 * @returns {{ match: string, hanja: string } | null}
 */
function findLongestWordMatch(text, start) {
  // 사전 단어 최대 길이는 보통 3-4. 안전하게 6까지 시도.
  const MAX = 6;
  const end = Math.min(text.length, start + MAX);
  for (let len = end - start; len >= 2; len--) {
    const candidate = text.slice(start, start + len);
    const entries = WORD_DICTIONARY.get(candidate);
    if (entries && entries.length > 0) {
      const top = entries[0];
      // 고유어("사랑" 등) 항목은 hanja==한글로 두고 frequency<=1 → 변환 안 함으로 처리
      if (top.hanja && top.hanja !== candidate) {
        return { match: candidate, hanja: top.hanja };
      }
      // 사전에 있지만 변환 대상이 아닌 단어 → null 반환하여 음절 fallback로 넘어가게
      return null;
    }
  }
  return null;
}

/**
 * 텍스트를 한자로 변환.
 *
 * mode:
 *  - 'top1' (default): 단어 우선 매칭 → 음절 fallback, 후보 1순위 자동 선택.
 *  - 'word-only': 단어 사전 매칭만 수행, 못 찾으면 원본 유지.
 *
 * 한자가 아닌 문자(공백, 영문, 숫자 등)와 사전에 없는 한글 음절은 원본 유지.
 *
 * @param {string} text 입력 텍스트
 * @param {'top1'|'word-only'} [mode='top1']
 * @returns {string} 변환 결과
 */
export function convertToHanja(text, mode = 'top1') {
  if (!text || typeof text !== 'string') return '';

  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // 한글 음절이 아니면 그대로
    if (!isHangulSyllable(ch)) {
      out += ch;
      i++;
      continue;
    }

    // 1) 단어 우선 매칭 (greedy longest match)
    const wordMatch = findLongestWordMatch(text, i);
    if (wordMatch) {
      out += wordMatch.hanja;
      i += wordMatch.match.length;
      continue;
    }

    // 2) word-only 모드면 단어 매칭 실패 시 원본 유지
    if (mode === 'word-only') {
      out += ch;
      i++;
      continue;
    }

    // 3) 음절 단위 변환 (top1)
    const candidates = getSyllableCandidates(ch);
    if (candidates.length > 0) {
      out += candidates[0].hanja;
    } else {
      out += ch;
    }
    i++;
  }
  return out;
}

/**
 * 한자(한글) 또는 한글(한자) 형식의 괄호 병기 문자열 생성.
 *
 * @param {string} hangul 원본 한글
 * @param {string} hanja  변환된 한자
 * @param {{ order?: 'hanja-first' | 'hangul-first' }} [opts]
 * @returns {string} 예: "國家(국가)" 또는 "국가(國家)"
 */
export function convertWithParenthesis(hangul, hanja, opts = {}) {
  const order = opts.order || 'hanja-first';
  const hg = (hangul || '').toString();
  const hj = (hanja || '').toString();
  if (!hg && !hj) return '';
  if (!hg) return hj;
  if (!hj || hg === hj) return hg;
  return order === 'hangul-first' ? `${hg}(${hj})` : `${hj}(${hg})`;
}

/**
 * 토큰 단위로 변환 결과를 반환 (UI에서 highlight 등에 활용).
 *
 * @param {string} text
 * @returns {Array<{type:'word'|'syllable'|'literal', source:string, hanja:string, candidates:Array<HanjaEntry>}>}
 */
export function tokenizeConversion(text) {
  /** @type {Array<{type:'word'|'syllable'|'literal', source:string, hanja:string, candidates:Array<HanjaEntry>}>} */
  const tokens = [];
  if (!text) return tokens;

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (!isHangulSyllable(ch)) {
      tokens.push({ type: 'literal', source: ch, hanja: ch, candidates: [] });
      i++;
      continue;
    }
    const wordMatch = findLongestWordMatch(text, i);
    if (wordMatch) {
      const candidates = WORD_DICTIONARY.get(wordMatch.match) || [];
      tokens.push({
        type: 'word',
        source: wordMatch.match,
        hanja: wordMatch.hanja,
        candidates: candidates.slice(),
      });
      i += wordMatch.match.length;
      continue;
    }
    const cands = getSyllableCandidates(ch);
    tokens.push({
      type: 'syllable',
      source: ch,
      hanja: cands[0] ? cands[0].hanja : ch,
      candidates: cands.slice(),
    });
    i++;
  }
  return tokens;
}

/**
 * 음절 후보 가짓수 합계 (대략적 사전 카버리지 지표).
 *
 * @param {string} text
 * @returns {{ converted:number, total:number, ratio:number }}
 */
export function getCoverage(text) {
  let converted = 0;
  let total = 0;
  for (const ch of text || '') {
    if (!isHangulSyllable(ch)) continue;
    total++;
    if (getSyllableCandidates(ch).length > 0) converted++;
  }
  return {
    converted,
    total,
    ratio: total === 0 ? 0 : converted / total,
  };
}

export default {
  lookupHanja,
  convertToHanja,
  convertWithParenthesis,
  tokenizeConversion,
  getCoverage,
};
