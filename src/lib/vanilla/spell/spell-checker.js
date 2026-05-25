/**
 * Korean Spell Checker Engine
 * 정적 룰 카탈로그 기반 한국어 맞춤법·띄어쓰기 검사 엔진.
 *
 * 알고리즘:
 *   1) 규칙 카탈로그(`spell-rules.js`)를 순회하며 입력 텍스트에 패턴 매칭
 *   2) 매칭된 모든 위치를 Issue 객체로 수집 ({ start, end, text, replacement, ... })
 *   3) 동일 위치 중복은 첫 번째(높은 severity) 규칙을 유지
 *   4) 사용자 사전(ignored words)에 등록된 어형은 결과에서 제외
 *   5) `applyAllFixes(text, issues)` 는 뒤에서부터 치환하여 인덱스 무결성 보존
 *
 * 외부 의존성 없음 — 모든 데이터는 정적 룰 + localStorage(있을 때) fallback.
 *
 * @module spell/spell-checker
 * @version 1.0.0
 */

import { getAllRules } from './spell-rules.js';
import { isIgnored } from './user-dictionary.js';
import { createAIDebouncer } from './ai-debounce.js';
import { checkTextWithAI } from './ai-spell-checker.js';
import { assertQuota, recordUsage, checkQuota } from './ai-quota.js';

/**
 * @typedef {Object} SpellIssue
 * @property {string} ruleId
 * @property {number} start          입력 텍스트의 0-based 시작 인덱스 (포함)
 * @property {number} end            입력 텍스트의 0-based 종료 인덱스 (제외)
 * @property {string} text           매칭된 원문 (잘못된 어형)
 * @property {string} replacement    제안 교정안
 * @property {'error'|'warning'|'info'} severity
 * @property {'spelling'|'spacing'|'foreign'|'particle'} category
 * @property {string} hint
 */

/**
 * @typedef {Object} CheckOptions
 * @property {Array<'spelling'|'spacing'|'foreign'|'particle'>} [categories]
 *   제한할 카테고리(미지정 시 모두). 예: ['spelling', 'foreign']
 * @property {Array<'error'|'warning'|'info'>} [severities]
 *   제한할 심각도(미지정 시 모두).
 * @property {boolean} [respectUserDictionary=true]
 *   true 이면 사용자 사전 ignore 목록을 결과에서 제외.
 * @property {Array<string>} [extraIgnored]
 *   호출 단위로 무시할 단어 추가 목록.
 */

/**
 * 한국어 음절 범위 (가–힣).
 * 다른 문자(영문/숫자/기호)에 대한 룰은 별도로 검증을 우회한다.
 */
const HANGUL_SYLLABLE_RE = /[가-힣]/;

/**
 * 텍스트가 한글 음절을 하나라도 포함하는지 검사.
 * (룰 카탈로그가 한글 중심이므로 한글 0개 텍스트는 스킵 가능)
 * @param {string} text
 * @returns {boolean}
 */
export function hasHangul(text) {
  if (typeof text !== 'string' || text.length === 0) return false;
  return HANGUL_SYLLABLE_RE.test(text);
}

/**
 * 자모(낱자) 분해 없이 한글 음절 유효 범위인지 판정.
 * @param {string} ch
 * @returns {boolean}
 */
export function isHangulSyllable(ch) {
  if (typeof ch !== 'string' || ch.length === 0) return false;
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

/**
 * 텍스트에 대해 모든 규칙을 적용하여 이슈 배열을 반환.
 *
 * @param {string} text
 * @param {CheckOptions} [options]
 * @returns {Array<SpellIssue>}
 */
// 핫패스 최적화 — categories/severities 필터 조합별 사전 필터링된 규칙 배열 캐시.
// 키 입력마다 checkText 가 호출되면 120 규칙 × 두 번의 Set 조회를 매번 반복하던 비용 제거.
const _filteredRulesCache = new Map();

function _getFilteredRules(catFilter, sevFilter) {
  const key = `${catFilter ? [...catFilter].sort().join(',') : '*'}|${sevFilter ? [...sevFilter].sort().join(',') : '*'}`;
  let rules = _filteredRulesCache.get(key);
  if (rules) return rules;
  rules = getAllRules().filter(rule => {
    if (!(rule.pattern instanceof RegExp)) return false;
    if (catFilter && !catFilter.has(rule.category)) return false;
    if (sevFilter && !sevFilter.has(rule.severity)) return false;
    return true;
  });
  _filteredRulesCache.set(key, rules);
  return rules;
}

export function checkText(text, options = {}) {
  if (typeof text !== 'string' || text.length === 0) return [];

  const {
    categories,
    severities,
    respectUserDictionary = true,
    extraIgnored = [],
  } = options;

  const catFilter = Array.isArray(categories) && categories.length > 0
    ? new Set(categories)
    : null;
  const sevFilter = Array.isArray(severities) && severities.length > 0
    ? new Set(severities)
    : null;
  const extraIgnoreSet = new Set(extraIgnored.filter((s) => typeof s === 'string'));

  /** @type {Array<SpellIssue>} */
  const issues = [];
  const occupied = new Set(); // 같은 start 위치의 중복 매칭 방지

  for (const rule of _getFilteredRules(catFilter, sevFilter)) {

    // global 플래그가 없는 패턴은 단발성으로만 검사. 카탈로그는 g 플래그를 표준으로 한다.
    // 안전을 위해 매번 lastIndex 를 0으로 리셋한다.
    const re = rule.pattern;
    re.lastIndex = 0;

    let m;
    let safety = 0;
    while ((m = re.exec(text)) !== null) {
      // 빈 매칭 무한 루프 방어
      if (m.index === re.lastIndex) re.lastIndex++;
      safety++;
      if (safety > 10000) break;

      const start = m.index;
      const matched = m[0];
      if (!matched || matched.length === 0) continue;
      const end = start + matched.length;

      // 동일 start 중복 회피
      const key = `${start}:${end}`;
      if (occupied.has(key)) continue;

      // 치환 결과 계산: 캡처 그룹($1)을 사용한 룰은 replace 호출로 정확히 만든다.
      let replacement = rule.replacement;
      if (replacement.includes('$')) {
        replacement = matched.replace(re, rule.replacement);
        // replace 사용 후 re.lastIndex 가 변형될 수 있으므로 다시 진행시킨다.
        re.lastIndex = end;
      }

      // 사용자 사전: 무시 단어인지 체크
      if (respectUserDictionary) {
        if (extraIgnoreSet.has(matched)) continue;
        try {
          if (isIgnored(matched)) continue;
        } catch (_e) {
          // 사전 조회 실패는 무시하고 진행
        }
      } else if (extraIgnoreSet.has(matched)) {
        continue;
      }

      issues.push({
        ruleId: rule.id,
        start,
        end,
        text: matched,
        replacement,
        severity: rule.severity,
        category: rule.category,
        hint: rule.hint,
      });
      occupied.add(key);

      // global 패턴에서 re.lastIndex 가 충분히 진행되지 않은 경우 강제 진행
      if (re.lastIndex <= start) re.lastIndex = start + 1;
    }
  }

  // 위치순 정렬
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return issues;
}

/**
 * 한 텍스트에 대해 단일 이슈만 적용한 새 문자열을 반환.
 *
 * @param {string} text
 * @param {SpellIssue} issue
 * @returns {string}
 */
export function applyFix(text, issue) {
  if (typeof text !== 'string' || !issue) return text;
  if (typeof issue.start !== 'number' || typeof issue.end !== 'number') return text;
  if (issue.start < 0 || issue.end > text.length || issue.start > issue.end) return text;
  return text.slice(0, issue.start) + issue.replacement + text.slice(issue.end);
}

/**
 * 여러 이슈를 한 번에 적용 — 뒤에서부터 치환하여 인덱스 무결성을 유지한다.
 *
 * @param {string} text
 * @param {Array<SpellIssue>} issues
 * @returns {string}
 */
export function applyAllFixes(text, issues) {
  if (typeof text !== 'string' || !Array.isArray(issues) || issues.length === 0) return text;
  // 위치 내림차순 정렬
  const sorted = issues.slice().sort((a, b) => b.start - a.start || b.end - a.end);
  let result = text;
  let prevStart = Infinity;
  let prevEnd = Infinity;
  for (const it of sorted) {
    if (!it || typeof it.start !== 'number' || typeof it.end !== 'number') continue;
    if (it.end > result.length || it.start < 0) continue;
    // 겹치는 이슈는 건너뛴다 (먼저 적용된 더 오른쪽 이슈가 더 우선)
    if (it.end > prevStart) continue;
    result = result.slice(0, it.start) + it.replacement + result.slice(it.end);
    prevStart = it.start;
    prevEnd = it.end;
    void prevEnd;
  }
  return result;
}

/**
 * 이슈 배열에 대한 통계 (대시보드/상태바용).
 *
 * @param {Array<SpellIssue>} issues
 * @returns {{
 *   total:number,
 *   bySeverity: { error:number, warning:number, info:number },
 *   byCategory: { spelling:number, spacing:number, foreign:number, particle:number }
 * }}
 */
export function getStats(issues) {
  const stats = {
    total: Array.isArray(issues) ? issues.length : 0,
    bySeverity: { error: 0, warning: 0, info: 0 },
    byCategory: { spelling: 0, spacing: 0, foreign: 0, particle: 0 },
  };
  if (!Array.isArray(issues)) return stats;
  for (const it of issues) {
    if (!it) continue;
    if (it.severity && stats.bySeverity[it.severity] !== undefined) {
      stats.bySeverity[it.severity]++;
    }
    if (it.category && stats.byCategory[it.category] !== undefined) {
      stats.byCategory[it.category]++;
    }
  }
  return stats;
}

/**
 * 입력 텍스트 + 옵션에서 직접 모든 수정안이 적용된 결과 문자열을 반환.
 * (편의용 — 일반적으로는 호출자가 이슈를 검토 후 selectively 적용한다.)
 *
 * @param {string} text
 * @param {CheckOptions} [options]
 * @returns {{ fixed:string, issues:Array<SpellIssue> }}
 */
export function autoFix(text, options) {
  const issues = checkText(text, options);
  const fixed = applyAllFixes(text, issues);
  return { fixed, issues };
}

/* -------------------------------------------------------------------------- */
/* Hybrid (정규식 + AI) 검사                                                   */
/* -------------------------------------------------------------------------- */

/**
 * AI 결과를 SpellIssue 모양으로 변환.
 * (오버레이/팝업이 기존 필드명을 사용하므로 호환되게 매핑)
 * @param {import('./ai-spell-checker.js').AIIssue} ai
 * @returns {SpellIssue & { aiGenerated:true, reason:string }}
 */
function _aiToSpellIssue(ai) {
  return {
    ruleId: `ai:${ai.severity}:${ai.start}-${ai.end}`,
    start: ai.start,
    end: ai.end,
    text: ai.original,
    replacement: ai.suggestion,
    severity: ai.severity === 'error' ? 'error' : 'warning',
    category: ai.category && ['spelling','spacing','foreign','particle'].includes(ai.category)
      ? ai.category
      : 'spelling',
    hint: ai.reason || 'AI 추천 수정',
    aiGenerated: true,
    reason: ai.reason || 'AI 추천 수정',
  };
}

/** 인스턴스 단위 디바운서 (모듈 전역 공유 — 단일 활성 입력 가정) */
let _sharedDebouncer = null;
function _getDebouncer(options) {
  const delay = options && Number.isFinite(options.aiDelayMs) ? options.aiDelayMs : undefined;
  if (!_sharedDebouncer || (delay !== undefined && _sharedDebouncer._delay !== delay)) {
    _sharedDebouncer = createAIDebouncer({ delay });
    _sharedDebouncer._delay = delay;
  }
  return _sharedDebouncer;
}

/**
 * 두 이슈 배열을 병합. 같은 (start,end) 가 충돌하면 AI 결과 우선.
 * @param {Array<SpellIssue>} ruleIssues
 * @param {Array<SpellIssue & {aiGenerated?:boolean}>} aiIssues
 * @returns {Array<SpellIssue & {aiGenerated?:boolean}>}
 */
export function mergeIssues(ruleIssues, aiIssues) {
  const map = new Map();
  for (const it of Array.isArray(ruleIssues) ? ruleIssues : []) {
    if (!it) continue;
    map.set(`${it.start}:${it.end}`, it);
  }
  for (const it of Array.isArray(aiIssues) ? aiIssues : []) {
    if (!it) continue;
    map.set(`${it.start}:${it.end}`, it); // AI 우선
  }
  return Array.from(map.values()).sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Hybrid 검사: 1차 정규식(동기) + 2차 AI(비동기, 옵션).
 *
 * @param {string} text
 * @param {CheckOptions & {
 *   enableAI?:boolean,
 *   aiOptions?:import('./ai-spell-checker.js').AICheckOptions,
 *   aiDelayMs?:number,
 *   aiLimit?:number,
 * }} [options]
 * @returns {{
 *   ruleIssues: Array<SpellIssue>,
 *   aiPromise: Promise<Array<SpellIssue & {aiGenerated?:boolean}>>,
 *   mergedPromise: Promise<Array<SpellIssue & {aiGenerated?:boolean}>>,
 *   cancel: () => void,
 * }}
 */
export function checkTextHybrid(text, options = {}) {
  const ruleIssues = checkText(text, options);
  const enableAI = !!options.enableAI;

  if (!enableAI || typeof text !== 'string' || text.trim().length === 0) {
    return {
      ruleIssues,
      aiPromise: Promise.resolve([]),
      mergedPromise: Promise.resolve(ruleIssues),
      cancel: () => {},
    };
  }

  const debouncer = _getDebouncer(options);
  const aiLimit = options.aiLimit;

  // Quota 사전 체크 — 초과 시 AI 단계 skip
  if (!checkQuota({ limit: aiLimit })) {
    return {
      ruleIssues,
      aiPromise: Promise.resolve([]),
      mergedPromise: Promise.resolve(ruleIssues),
      cancel: () => {},
    };
  }

  const aiPromise = debouncer.schedule(text, async ({ signal }) => {
    // 호출 직전 마지막 quota 확인
    try {
      assertQuota({ limit: aiLimit });
    } catch (_e) {
      return [];
    }
    let raw;
    try {
      raw = await checkTextWithAI(text, { ...(options.aiOptions || {}), signal });
    } catch (_e) {
      return [];
    }
    // 호출 성공으로 간주되면 사용량 기록 (raw 가 빈 배열이어도 호출은 발생함)
    try { recordUsage({ limit: aiLimit }); } catch (_e) { /* ignore */ }
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map(_aiToSpellIssue);
  }).catch(() => []); // 디바운스 취소/오류는 빈 배열로 흡수

  const mergedPromise = aiPromise.then((aiIssues) => mergeIssues(ruleIssues, aiIssues));

  return {
    ruleIssues,
    aiPromise,
    mergedPromise,
    cancel: () => debouncer.cancel(),
  };
}

export default {
  checkText,
  checkTextHybrid,
  applyFix,
  applyAllFixes,
  getStats,
  autoFix,
  hasHangul,
  isHangulSyllable,
  mergeIssues,
};
