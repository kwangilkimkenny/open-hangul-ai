/**
 * AI 맞춤법 호출 — 일일 호출 한도 관리(Quota)
 *
 * LLM 기반 맞춤법 검사는 비용·레이트리밋이 동반되므로,
 * 사용자 단위 일일 호출 한도를 둬서 폭주(runaway)를 막는다.
 *
 * 영속화:
 *   - 1순위: localStorage (브라우저). 키: `oha.spell.aiQuota.v1`
 *   - 2순위: 메모리 (테스트/SSR). localStorage 사용 불가 시 fallback.
 *
 * 데이터 구조:
 *   { dateKey: 'YYYY-MM-DD', count: number, limit: number }
 *
 * 날짜가 바뀌면 자동 리셋된다 (호출 시점 기준 로컬 날짜).
 *
 * @module spell/ai-quota
 * @version 1.0.0
 */

const STORAGE_KEY = 'oha.spell.aiQuota.v1';
const DEFAULT_LIMIT = 100;

/** @typedef {{ dateKey:string, count:number, limit:number }} QuotaRecord */

/** 메모리 fallback (localStorage 미사용 환경/테스트용) */
let _memory = /** @type {QuotaRecord|null} */ (null);

/** 외부 강제 주입(테스트용) — 진짜 storage 가 있어도 메모리 모드로 전환 */
let _forceMemory = false;

/**
 * 오늘 날짜 키(YYYY-MM-DD, 로컬 타임존 기준).
 * @returns {string}
 */
function _todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _hasLocalStorage() {
  if (_forceMemory) return false;
  try {
    return typeof window !== 'undefined'
      && !!window.localStorage
      && typeof window.localStorage.getItem === 'function';
  } catch (_e) {
    return false;
  }
}

/**
 * 저장된 quota 레코드 로드 (없으면 null).
 * @returns {QuotaRecord|null}
 */
function _load() {
  if (_hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed
        && typeof parsed === 'object'
        && typeof parsed.dateKey === 'string'
        && Number.isFinite(parsed.count)
        && Number.isFinite(parsed.limit)
      ) {
        return /** @type {QuotaRecord} */ (parsed);
      }
      return null;
    } catch (_e) {
      return null;
    }
  }
  return _memory;
}

/**
 * 저장 (localStorage + 메모리 동시).
 * @param {QuotaRecord} rec
 */
function _save(rec) {
  _memory = { ...rec };
  if (_hasLocalStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    } catch (_e) {
      // quota exceeded / SecurityError 등은 무시
    }
  }
}

/**
 * 오늘 레코드를 보장(없거나 날짜가 다르면 새로 생성).
 * @param {number} [limit]
 * @returns {QuotaRecord}
 */
function _ensureToday(limit = DEFAULT_LIMIT) {
  const today = _todayKey();
  const cur = _load();
  if (!cur || cur.dateKey !== today) {
    const fresh = { dateKey: today, count: 0, limit };
    _save(fresh);
    return fresh;
  }
  // 한도가 외부 설정으로 바뀐 경우 동기화 (사용량 보존)
  if (Number.isFinite(limit) && limit > 0 && cur.limit !== limit) {
    const updated = { ...cur, limit };
    _save(updated);
    return updated;
  }
  return cur;
}

/**
 * 현재 quota 상태 조회.
 * @param {{ limit?:number }} [options]
 * @returns {QuotaRecord}
 */
export function getQuota(options = {}) {
  return _ensureToday(options.limit ?? DEFAULT_LIMIT);
}

/**
 * 현재 남은 호출 횟수.
 * @param {{ limit?:number }} [options]
 * @returns {number}
 */
export function getRemainingQuota(options = {}) {
  const q = _ensureToday(options.limit ?? DEFAULT_LIMIT);
  return Math.max(0, q.limit - q.count);
}

/**
 * 호출 가능 여부 검사. 초과 시 false 반환.
 * @param {{ limit?:number }} [options]
 * @returns {boolean}
 */
export function checkQuota(options = {}) {
  const q = _ensureToday(options.limit ?? DEFAULT_LIMIT);
  return q.count < q.limit;
}

/**
 * 호출 가능 여부 검사 (초과 시 예외 throw).
 *
 * @param {{ limit?:number }} [options]
 * @throws {Error} 한도 초과 시
 */
export function assertQuota(options = {}) {
  const q = _ensureToday(options.limit ?? DEFAULT_LIMIT);
  if (q.count >= q.limit) {
    const err = new Error(
      `AI 맞춤법 일일 호출 한도(${q.limit})를 초과했습니다. 내일 다시 시도하세요.`
    );
    /** @type {any} */ (err).code = 'AI_SPELL_QUOTA_EXCEEDED';
    throw err;
  }
}

/**
 * 호출 1회 사용 기록 (호출 직전/직후에 호출). 호출 가능했을 때만 카운트.
 * 초과 상태에서 호출되면 즉시 예외 throw (assertQuota 와 동등).
 *
 * @param {{ limit?:number, count?:number }} [options]  count 는 멀티콜 합산(기본 1)
 * @returns {QuotaRecord}
 */
export function recordUsage(options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const delta = Number.isFinite(options.count) ? Math.max(1, Math.floor(options.count)) : 1;
  const q = _ensureToday(limit);
  if (q.count + delta > q.limit) {
    const err = new Error(
      `AI 맞춤법 일일 호출 한도(${q.limit})를 초과했습니다.`
    );
    /** @type {any} */ (err).code = 'AI_SPELL_QUOTA_EXCEEDED';
    throw err;
  }
  const next = { ...q, count: q.count + delta };
  _save(next);
  return next;
}

/**
 * 모든 quota 데이터 리셋 (테스트/관리용).
 * @returns {void}
 */
export function resetQuota() {
  _memory = null;
  if (_hasLocalStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      // ignore
    }
  }
}

/**
 * 테스트 헬퍼 — localStorage 강제 우회 (메모리만 사용).
 * @param {boolean} on
 */
export function _setMemoryOnly(on) {
  _forceMemory = !!on;
}

/** 기본 한도 export (다른 모듈에서 참조용). */
export const DEFAULT_DAILY_LIMIT = DEFAULT_LIMIT;

export default {
  getQuota,
  getRemainingQuota,
  checkQuota,
  assertQuota,
  recordUsage,
  resetQuota,
  DEFAULT_DAILY_LIMIT,
};
