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
 * IndexedDB 가 없는 환경(jsdom / SSR)에서는 모듈 스코프 메모리 Map 으로
 * 폴백한다 — 데이터는 프로세스 종료 시 사라진다.
 *
 * @module font-metrics/persistence
 * @version 1.0.0
 */

const DB_NAME = 'OpenHangulAI';
const DB_VERSION = 1;
const STORE_NAME = 'font-metrics';

/** @type {Map<string, any>} */
const memoryStore = new Map();

/**
 * IndexedDB 사용 가능 여부 검사.
 *
 * jsdom 도 indexedDB 객체를 노출하지만 실제 트랜잭션은 작동 안 한다.
 * 따라서 `open` 함수 존재 + 호출 시 객체 반환까지 확인한다.
 *
 * @returns {boolean}
 */
function hasIndexedDB() {
  try {
    if (typeof globalThis === 'undefined') return false;
    const idb = /** @type {any} */ (globalThis).indexedDB;
    return Boolean(idb && typeof idb.open === 'function');
  } catch (_e) {
    return false;
  }
}

/**
 * IDBRequest → Promise 헬퍼.
 *
 * @template T
 * @param {IDBRequest<T>} req
 * @returns {Promise<T>}
 */
function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IDBRequest failed'));
  });
}

/**
 * DB open + store 보장.
 *
 * @returns {Promise<IDBDatabase|null>}
 */
async function openDB() {
  if (!hasIndexedDB()) return null;
  return await new Promise((resolve) => {
    let req;
    try {
      req = /** @type {any} */ (globalThis).indexedDB.open(DB_NAME, DB_VERSION);
    } catch (_e) {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db && db.objectStoreNames && !db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
    // jsdom 등에서 콜백이 호출되지 않을 수 있어 짧은 타임아웃으로 보호
    setTimeout(() => resolve(req.result || null), 0);
  });
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
 * 캐시에서 메트릭을 읽는다.
 *
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function readMetrics(key) {
  if (memoryStore.has(key)) {
    return memoryStore.get(key);
  }
  const db = await openDB();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const got = await reqToPromise(store.get(key));
    db.close();
    if (got && typeof got === 'object' && 'metrics' in got) {
      return /** @type {any} */ (got).metrics;
    }
    return null;
  } catch (_e) {
    try { db.close(); } catch (__) { /* ignore */ }
    return null;
  }
}

/**
 * 캐시에 메트릭을 저장한다.
 *
 * @param {string} key
 * @param {any} metrics
 * @returns {Promise<boolean>}
 */
export async function writeMetrics(key, metrics) {
  memoryStore.set(key, metrics);
  const db = await openDB();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await reqToPromise(store.put({ key, metrics, savedAt: Date.now() }));
    db.close();
    return true;
  } catch (_e) {
    try { db.close(); } catch (__) { /* ignore */ }
    return false;
  }
}

/**
 * 캐시 전체 삭제(테스트/디버그).
 *
 * @returns {Promise<void>}
 */
export async function clearCache() {
  memoryStore.clear();
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await reqToPromise(store.clear());
    db.close();
  } catch (_e) {
    try { db.close(); } catch (__) { /* ignore */ }
  }
}

/**
 * 메모리 캐시 크기(테스트용).
 *
 * @returns {number}
 */
export function memoryCacheSize() {
  return memoryStore.size;
}

export default {
  buildCacheKey,
  readMetrics,
  writeMetrics,
  clearCache,
  memoryCacheSize,
};
