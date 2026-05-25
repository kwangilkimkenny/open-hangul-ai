/**
 * Autocomplete Persistence
 * MRU(최근 사용 단어) 영속화 — IndexedDB 우선, localStorage / 메모리 fallback.
 *
 * - DB 이름: `OpenHangulAI`
 * - Object Store: `autocomplete-mru`  (keyPath: 'word')
 * - 레코드 형태: `{ word: string, frequency: number, lastUsed: number }`
 *
 * 모든 API 는 비동기(Promise) 로 통일 — fallback 경로에서도 동일 인터페이스를 제공한다.
 *
 * @module autocomplete/persistence
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('AutocompletePersistence');

export const DB_NAME = 'OpenHangulAI';
export const DB_VERSION = 1;
export const STORE_NAME = 'autocomplete-mru';
const LS_KEY = 'autocomplete.mru.v1';

/**
 * @typedef {Object} MruRecord
 * @property {string} word
 * @property {number} frequency
 * @property {number} lastUsed   epoch ms
 */

/**
 * Storage backend 종류.
 * @typedef {'indexeddb' | 'localstorage' | 'memory'} BackendKind
 */

/** 메모리 fallback 저장소. */
const _memory = new Map();

/**
 * IndexedDB 사용 가능 여부.
 * @returns {boolean}
 */
function canUseIndexedDB() {
  try {
    return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
  } catch (_e) {
    return false;
  }
}

/**
 * localStorage 사용 가능 여부 (set→get 라운드트립 검증).
 * @returns {boolean}
 */
function canUseLocalStorage() {
  try {
    if (typeof globalThis === 'undefined') return false;
    const ls = /** @type {any} */ (globalThis).localStorage;
    if (!ls) return false;
    const probe = '__ac_persist_probe__';
    ls.setItem(probe, '1');
    const ok = ls.getItem(probe) === '1';
    ls.removeItem(probe);
    return ok;
  } catch (_e) {
    return false;
  }
}

/** 테스트/디버깅용 강제 백엔드 (null 이면 자동 감지). */
let _forcedBackend = null;

/**
 * 환경에 가장 적합한 backend kind 선택.
 *  - `setForcedBackend('memory')` 로 강제 가능 (테스트용)
 * @returns {BackendKind}
 */
export function detectBackend() {
  if (_forcedBackend) return _forcedBackend;
  if (canUseIndexedDB()) return 'indexeddb';
  if (canUseLocalStorage()) return 'localstorage';
  return 'memory';
}

/**
 * 백엔드를 강제 지정(테스트용). null 로 호출하면 자동 감지로 복귀.
 * @param {BackendKind | null} kind
 */
export function setForcedBackend(kind) {
  if (kind === null || kind === undefined) {
    _forcedBackend = null;
    return;
  }
  if (kind === 'indexeddb' || kind === 'localstorage' || kind === 'memory') {
    _forcedBackend = kind;
  }
}

/** @type {IDBDatabase | null} */
let _db = null;

/**
 * IndexedDB 열기 (필요 시 store 생성).
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) {
      resolve(_db);
      return;
    }
    if (!canUseIndexedDB()) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'word' });
        store.createIndex('lastUsed', 'lastUsed', { unique: false });
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => {
      reject(req.error || new Error('IndexedDB open failed'));
    };
  });
}

/**
 * IndexedDB 트랜잭션 실행 헬퍼.
 * @param {'readonly'|'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest | void} fn
 * @returns {Promise<any>}
 */
async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result;
    const req = fn(store);
    if (req && typeof req === 'object' && 'onsuccess' in req) {
      req.onsuccess = () => {
        result = req.result;
      };
      req.onerror = () => reject(req.error);
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/* ──────────────────────────────────────────────────────────────────── *
 * Public API
 * ──────────────────────────────────────────────────────────────────── */

/**
 * 단일 단어 저장(또는 갱신).
 * @param {MruRecord} record
 * @returns {Promise<void>}
 */
export async function put(record) {
  if (!record || typeof record.word !== 'string' || record.word.length === 0) {
    return;
  }
  const normalized = {
    word: record.word,
    frequency: Number.isFinite(record.frequency) && record.frequency > 0 ? Math.floor(record.frequency) : 1,
    lastUsed: Number.isFinite(record.lastUsed) ? record.lastUsed : Date.now(),
  };

  const backend = detectBackend();
  if (backend === 'indexeddb') {
    try {
      await withStore('readwrite', (store) => store.put(normalized));
      return;
    } catch (err) {
      logger.warn('[AC-Persist] IDB put failed, falling back:', err);
    }
  }
  if (backend !== 'memory' && canUseLocalStorage()) {
    try {
      const all = readLS();
      all[normalized.word] = normalized;
      writeLS(all);
      return;
    } catch (err) {
      logger.warn('[AC-Persist] LS put failed, using memory:', err);
    }
  }
  _memory.set(normalized.word, normalized);
}

/**
 * 여러 단어 일괄 저장.
 * @param {Array<MruRecord>} records
 * @returns {Promise<void>}
 */
export async function putAll(records) {
  if (!Array.isArray(records) || records.length === 0) return;
  // IDB 단일 트랜잭션으로 처리 (성능)
  if (detectBackend() === 'indexeddb') {
    try {
      await withStore('readwrite', (store) => {
        for (const r of records) {
          if (!r || typeof r.word !== 'string' || r.word.length === 0) continue;
          store.put({
            word: r.word,
            frequency: Number.isFinite(r.frequency) && r.frequency > 0 ? Math.floor(r.frequency) : 1,
            lastUsed: Number.isFinite(r.lastUsed) ? r.lastUsed : Date.now(),
          });
        }
      });
      return;
    } catch (err) {
      logger.warn('[AC-Persist] IDB putAll failed:', err);
    }
  }
  for (const r of records) {
    // eslint-disable-next-line no-await-in-loop
    await put(r);
  }
}

/**
 * 단일 단어 조회.
 * @param {string} word
 * @returns {Promise<MruRecord | null>}
 */
export async function get(word) {
  if (typeof word !== 'string' || word.length === 0) return null;
  const backend = detectBackend();
  if (backend === 'indexeddb') {
    try {
      const rec = await withStore('readonly', (store) => store.get(word));
      return rec || null;
    } catch (err) {
      logger.warn('[AC-Persist] IDB get failed:', err);
    }
  }
  if (backend !== 'memory' && canUseLocalStorage()) {
    try {
      const all = readLS();
      return all[word] || null;
    } catch (_e) {
      // continue
    }
  }
  return _memory.get(word) || null;
}

/**
 * 전체 단어 목록 조회.
 * @returns {Promise<Array<MruRecord>>}
 */
export async function getAll() {
  const backend = detectBackend();
  if (backend === 'indexeddb') {
    try {
      const list = await withStore('readonly', (store) => store.getAll());
      return Array.isArray(list) ? list : [];
    } catch (err) {
      logger.warn('[AC-Persist] IDB getAll failed:', err);
    }
  }
  if (backend !== 'memory' && canUseLocalStorage()) {
    try {
      return Object.values(readLS());
    } catch (_e) {
      // continue
    }
  }
  return Array.from(_memory.values());
}

/**
 * 단일 단어 제거.
 * @param {string} word
 * @returns {Promise<void>}
 */
export async function remove(word) {
  if (typeof word !== 'string' || word.length === 0) return;
  const backend = detectBackend();
  if (backend === 'indexeddb') {
    try {
      await withStore('readwrite', (store) => store.delete(word));
      return;
    } catch (err) {
      logger.warn('[AC-Persist] IDB delete failed:', err);
    }
  }
  if (backend !== 'memory' && canUseLocalStorage()) {
    try {
      const all = readLS();
      delete all[word];
      writeLS(all);
      return;
    } catch (_e) {
      // fall through
    }
  }
  _memory.delete(word);
}

/**
 * 전체 삭제 (테스트/리셋용).
 * @returns {Promise<void>}
 */
export async function clear() {
  const backend = detectBackend();
  if (backend === 'indexeddb') {
    try {
      await withStore('readwrite', (store) => store.clear());
    } catch (err) {
      logger.warn('[AC-Persist] IDB clear failed:', err);
    }
  }
  if (canUseLocalStorage()) {
    try {
      /** @type {any} */ (globalThis).localStorage.removeItem(LS_KEY);
    } catch (_e) {
      // ignore
    }
  }
  _memory.clear();
}

/**
 * 최근 사용 단어 N개 (lastUsed desc) — MRU 컷오프 적용.
 * @param {number} [limit=100]
 * @returns {Promise<Array<MruRecord>>}
 */
export async function getMru(limit = 100) {
  const all = await getAll();
  all.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  return all.slice(0, Math.max(0, Math.floor(limit)));
}

/**
 * IDB 가 열려있다면 닫기 (테스트용).
 */
export function close() {
  try {
    if (_db) _db.close();
  } catch (_e) {
    // ignore
  } finally {
    _db = null;
  }
}

/* ──────────────────────────────────────────────────────────────────── *
 * localStorage helpers
 * ──────────────────────────────────────────────────────────────────── */

function readLS() {
  try {
    const ls = /** @type {any} */ (globalThis).localStorage;
    const raw = ls.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function writeLS(obj) {
  try {
    const ls = /** @type {any} */ (globalThis).localStorage;
    ls.setItem(LS_KEY, JSON.stringify(obj));
  } catch (err) {
    logger.warn('[AC-Persist] LS write failed:', err);
  }
}

export default {
  put,
  putAll,
  get,
  getAll,
  remove,
  clear,
  getMru,
  close,
  detectBackend,
  setForcedBackend,
  DB_NAME,
  STORE_NAME,
};
