/**
 * Korean Spell User Dictionary
 * 사용자 정의 사전 — "이 단어는 검사에서 제외" / "이 단어는 옳음(custom)" 두 종류를 관리한다.
 *
 * Storage:
 *   - 브라우저: localStorage 키 `'spell.user-dictionary.v1'`
 *   - SSR/jsdom/Node: 메모리 fallback
 *
 * 모든 API 는 동기 호출(localStorage 가 동기 API 이므로 일관성 유지).
 *
 * @module spell/user-dictionary
 * @version 1.0.0
 */

const STORAGE_KEY = 'spell.user-dictionary.v1';

/**
 * @typedef {Object} UserDictionarySnapshot
 * @property {Array<string>} ignored   검사에서 제외할 어형 목록(중복 제거)
 * @property {Array<string>} custom    사용자가 등록한 사용자 사전(고유 단어). 검사에서 제외도 자동 적용.
 */

/** 모듈 스코프 메모리 캐시 — localStorage 비가용 환경에서 사용. */
let memoryStore = {
  ignored: new Set(),
  custom: new Set(),
};

/**
 * localStorage 가 안전하게 사용 가능한지 검사.
 * @returns {boolean}
 */
function canUseLocalStorage() {
  try {
    if (typeof globalThis === 'undefined') return false;
    const ls = /** @type {any} */ (globalThis).localStorage;
    if (!ls) return false;
    // 실제로 set→get 라운드트립까지 검증해야 함 (일부 jsdom 환경은 setItem 후 getItem 가 undefined 반환)
    const probe = '__spell_probe__';
    ls.setItem(probe, '1');
    const got = ls.getItem(probe);
    ls.removeItem(probe);
    return got === '1';
  } catch (_e) {
    return false;
  }
}

/**
 * 디스크/메모리에서 현재 스냅샷 로드.
 * @returns {UserDictionarySnapshot}
 */
function loadSnapshot() {
  if (canUseLocalStorage()) {
    try {
      const ls = /** @type {any} */ (globalThis).localStorage;
      const raw = ls.getItem(STORAGE_KEY);
      if (!raw) return { ignored: [], custom: [] };
      const parsed = JSON.parse(raw);
      return {
        ignored: Array.isArray(parsed.ignored) ? parsed.ignored.filter((s) => typeof s === 'string') : [],
        custom: Array.isArray(parsed.custom) ? parsed.custom.filter((s) => typeof s === 'string') : [],
      };
    } catch (_e) {
      return { ignored: [], custom: [] };
    }
  }
  return {
    ignored: Array.from(memoryStore.ignored),
    custom: Array.from(memoryStore.custom),
  };
}

/**
 * 스냅샷을 디스크/메모리에 저장.
 * @param {UserDictionarySnapshot} snap
 */
function saveSnapshot(snap) {
  const normalized = {
    ignored: Array.from(new Set(snap.ignored.filter((s) => typeof s === 'string' && s.length > 0))),
    custom: Array.from(new Set(snap.custom.filter((s) => typeof s === 'string' && s.length > 0))),
  };
  if (canUseLocalStorage()) {
    try {
      const ls = /** @type {any} */ (globalThis).localStorage;
      ls.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return;
    } catch (_e) {
      // 디스크 저장 실패 시 메모리로 fallback
    }
  }
  memoryStore = {
    ignored: new Set(normalized.ignored),
    custom: new Set(normalized.custom),
  };
}

/**
 * 사용자 사전에 단어를 추가(정상 어형으로 등록).
 *   - 자동으로 ignored 에도 포함된다 (검사에서 제외).
 * @param {string} word
 * @returns {boolean} 실제로 추가되었으면 true, 이미 있으면 false
 */
export function addWord(word) {
  if (typeof word !== 'string' || word.length === 0) return false;
  const snap = loadSnapshot();
  if (snap.custom.includes(word)) return false; // 이미 존재
  snap.custom.push(word);
  if (!snap.ignored.includes(word)) snap.ignored.push(word);
  saveSnapshot(snap);
  return true;
}

/**
 * 단어를 ignore 목록에만 추가 (사용자 사전엔 안 들어감).
 * @param {string} word
 * @returns {boolean} 추가 여부
 */
export function ignoreWord(word) {
  if (typeof word !== 'string' || word.length === 0) return false;
  const snap = loadSnapshot();
  if (snap.ignored.includes(word)) return false;
  snap.ignored.push(word);
  saveSnapshot(snap);
  return true;
}

/**
 * 무시 목록에서 단어 제거.
 * @param {string} word
 * @returns {boolean}
 */
export function unignoreWord(word) {
  if (typeof word !== 'string' || word.length === 0) return false;
  const snap = loadSnapshot();
  const idx = snap.ignored.indexOf(word);
  if (idx < 0) return false;
  snap.ignored.splice(idx, 1);
  // 사용자 사전에서도 제거
  const cIdx = snap.custom.indexOf(word);
  if (cIdx >= 0) snap.custom.splice(cIdx, 1);
  saveSnapshot(snap);
  return true;
}

/**
 * 해당 단어가 무시 목록(또는 사용자 사전)에 있는지 확인.
 * @param {string} word
 * @returns {boolean}
 */
export function isIgnored(word) {
  if (typeof word !== 'string' || word.length === 0) return false;
  const snap = loadSnapshot();
  return snap.ignored.includes(word) || snap.custom.includes(word);
}

/**
 * 현재 사전의 전체 스냅샷 반환.
 * @returns {UserDictionarySnapshot}
 */
export function listAll() {
  return loadSnapshot();
}

/**
 * 전체 사전 초기화 (테스트/디버깅용).
 */
export function clearAll() {
  if (canUseLocalStorage()) {
    try {
      const ls = /** @type {any} */ (globalThis).localStorage;
      ls.removeItem(STORAGE_KEY);
    } catch (_e) {
      // ignore
    }
  }
  memoryStore = { ignored: new Set(), custom: new Set() };
}

export default {
  addWord,
  ignoreWord,
  unignoreWord,
  isIgnored,
  listAll,
  clearAll,
};
