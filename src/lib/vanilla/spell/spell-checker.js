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

  for (const rule of getAllRules()) {
    if (catFilter && !catFilter.has(rule.category)) continue;
    if (sevFilter && !sevFilter.has(rule.severity)) continue;
    if (!(rule.pattern instanceof RegExp)) continue;

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

export default {
  checkText,
  applyFix,
  applyAllFixes,
  getStats,
  autoFix,
  hasHangul,
  isHangulSyllable,
};
