/**
 * Font Metrics Persistence
 *
 * 추출된 FontMetrics 를 IndexedDB(`OpenHangulAI` DB, `font-metrics` store)에
 * 캐싱한다. 브라우저 재방문 시 동일 폰트는 ms 단위로 즉시 반환 가능하다.
 *
 * 키 포맷: `${familyName}|${variant}|${version}`
 *   - familyName: 정규화된 패밀리 이름
 *   - variant: weight + style (예: "400-normal", "700-italic")
 *   - version: 버전 문자열(없으면 'v1')
 *
 * IndexedDB 가 없는 환경(jsdom / SSR)에서는 `idb-factory` 가 제공하는
 * 공유 메모리 폴백(`getMemoryFallback(STORE_NAME)`)으로 자동 폴백한다.
 *
 * **마이그레이션 노트**
 *   - 1.x: 자체 `openDB()` 로 `OpenHangulAI` DB 를 열고 모듈 내부 `Map`
 *     으로 메모리 폴백을 구현했다.
 *   - 2.x: KK 트랙의 통합 `idb-factory` 로 위임 — DB 핸들/메모리 폴백/
 *     스키마 등록을 모두 팩토리가 관리한다. 외부 API 시그니처는 100%
 *     유지된다.
 *
 * @module font-metrics/persistence
 * @version 2.0.0
 */

import {
  registerStore,
  getStore,
  hasIndexedDB,
  getMemoryFallback,
  promisifyRequest,
  awaitTransaction,
} from '../../storage/idb-factory.ts';

/** Object Store 이름 — idb-factory 의 단일 `OpenHangulAI` DB 내부 스토어 */
export const STORE_NAME = 'font-metrics';

/**
 * jsdom 등 IDB stub 환경에서 `idb-factory.openAppDB()` 가 무한 대기하는
 * 케이스를 보호하기 위한 짧은 타임아웃(ms). 한 번 timeout 으로 실패하면
 * 이후 호출은 메모리 전용으로 전환된다.
 */
const IDB_OP_TIMEOUT_MS = 250;

// 모듈 로드 시 자신의 스토어를 팩토리에 등록한다.
// (다른 모듈의 registerStore 와 동일한 `OpenHangulAI` DB 로 통합되어
//  onupgradeneeded 시 일괄 생성된다.)
registerStore(STORE_NAME, { keyPath: 'key' });

/**
 * IDB 가 한 번이라도 timeout/실패하면 영구히 메모리 전용으로 전환.
 * 테스트 환경(jsdom)에서 stub `indexedDB.open` 이 콜백을 호출하지 않아
 * 무한 대기하는 사고를 막는다.
 */
let _idbDisabled = false;

/**
 * Promise 에 timeout 을 부여한다. 시간 안에 끝나지 않으면 fallback 값을
 * 반환한다(reject 하지 않음 — 호출자가 메모리 경로로 진행할 수 있게).
 *
 * @template T
 * @param {Promise<T>} p
 * @param {T} fallback
 * @returns {Promise<T>}
 */
function withTimeout(p, fallback) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      _idbDisabled = true;
      resolve(fallback);
    }, IDB_OP_TIMEOUT_MS);
    p.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * IDB 가 사용 가능하고 비활성화되지 않았는지 검사.
 *
 * @returns {boolean}
 */
function idbActive() {
  return !_idbDisabled && hasIndexedDB();
}

/**
 * write-through 캐시로 사용하는 공유 메모리 Map.
 * - `idb-factory` 가 등록 스토어별로 lazy 하게 생성/반환한다.
 * - IDB 사용 가능 환경에서도 hot-path 가속을 위해 항상 읽고/쓴다.
 *
 * @returns {Map<string, any>}
 */
function memMap() {
  return /** @type {Map<string, any>} */ (getMemoryFallback(STORE_NAME));
}

/**
 * 캐시 키 빌드.
 *
 * @param {string} familyName
 * @param {string} [variant='400-normal']
 * @param {string} [version='v1']
 * @returns {string}
 */
export function buildCacheKey(familyName, variant = '400-normal', version = 'v1') {
  const norm = (s) =>
    typeof s === 'string' ? s.trim().toLowerCase().replace(/\s+/g, '') : '';
  return `${norm(familyName)}|${variant}|${version}`;
}

/**
 * 캐시에서 메트릭을 읽는다. 우선순위: 메모리 → IDB.
 *
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function readMetrics(key) {
  const mem = memMap();
  if (mem.has(key)) {
    return mem.get(key);
  }
  if (!idbActive()) return null;
  const store = await withTimeout(getStore(STORE_NAME, 'readonly'), null);
  if (!store) return null;
  try {
    const got = await withTimeout(promisifyRequest(store.get(key)), null);
    if (got && typeof got === 'object' && 'metrics' in got) {
      const metrics = /** @type {any} */ (got).metrics;
      // IDB 히트는 메모리에도 채워 다음 호출을 가속
      mem.set(key, metrics);
      return metrics;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * 캐시에 메트릭을 저장한다. 메모리에는 항상, IDB 에는 사용 가능할 때 기록.
 *
 * @param {string} key
 * @param {any} metrics
 * @returns {Promise<boolean>}
 */
export async function writeMetrics(key, metrics) {
  memMap().set(key, metrics);
  if (!idbActive()) return false;
  const store = await withTimeout(getStore(STORE_NAME, 'readwrite'), null);
  if (!store) return false;
  try {
    store.put({ key, metrics, savedAt: Date.now() });
    const ok = await withTimeout(
      awaitTransaction(store.transaction).then(() => true),
      false,
    );
    return ok;
  } catch (_e) {
    return false;
  }
}

/**
 * 캐시 단일 항목 삭제.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function deleteMetrics(key) {
  const mem = memMap();
  mem.delete(key);
  if (!idbActive()) return false;
  const store = await withTimeout(getStore(STORE_NAME, 'readwrite'), null);
  if (!store) return false;
  try {
    store.delete(key);
    const ok = await withTimeout(
      awaitTransaction(store.transaction).then(() => true),
      false,
    );
    return ok;
  } catch (_e) {
    return false;
  }
}

/**
 * 캐시 전체 키 목록(메모리 + IDB 머지).
 *
 * @returns {Promise<Array<string>>}
 */
export async function listMetrics() {
  const set = new Set(memMap().keys());
  if (!idbActive()) return Array.from(set);
  const store = await withTimeout(getStore(STORE_NAME, 'readonly'), null);
  if (!store) return Array.from(set);
  try {
    const keys = await withTimeout(promisifyRequest(store.getAllKeys()), null);
    if (Array.isArray(keys)) {
      for (const k of keys) {
        if (typeof k === 'string') set.add(k);
      }
    }
    return Array.from(set);
  } catch (_e) {
    return Array.from(set);
  }
}

/**
 * 캐시 전체 삭제(테스트/디버그).
 *
 * @returns {Promise<void>}
 */
export async function clearCache() {
  memMap().clear();
  if (!idbActive()) return;
  const store = await withTimeout(getStore(STORE_NAME, 'readwrite'), null);
  if (!store) return;
  try {
    store.clear();
    await withTimeout(awaitTransaction(store.transaction), undefined);
  } catch (_e) {
    /* ignore */
  }
}

/**
 * 메모리 캐시 크기(테스트용).
 *
 * @returns {number}
 */
export function memoryCacheSize() {
  return memMap().size;
}

export default {
  buildCacheKey,
  readMetrics,
  writeMetrics,
  deleteMetrics,
  listMetrics,
  clearCache,
  memoryCacheSize,
};
