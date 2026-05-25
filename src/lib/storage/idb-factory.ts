/**
 * Unified IndexedDB Factory
 *
 * `OpenHangulAI` DB(v1)를 사용하는 모든 모듈을 위한 단일 진입점.
 *
 * **문제 배경**
 *   - 이전: 3개 모듈(`template-db`, `autocomplete/persistence`,
 *     `font-metrics/persistence`)이 동일 DB `OpenHangulAI` 를 각자
 *     `indexedDB.open()` 으로 열고 있어 `onupgradeneeded` 가 마지막
 *     호출자의 스키마만 보고 스토어를 생성하면 다른 모듈의 스토어가
 *     누락될 수 있었다.
 *   - 또한 jsdom/SSR/quota 폴백 로직이 모듈마다 중복 구현되어 있었다.
 *
 * **해결책**
 *   - 모듈 로드 시 `registerStore(name, options)` 를 호출하여 자신이
 *     필요한 스토어 스키마를 팩토리에 등록한다.
 *   - 첫 `openAppDB()` 호출 시 `onupgradeneeded` 에서 등록된 모든
 *     스토어를 일괄 생성한다.
 *   - 사용 불가/실패 시 메모리 폴백 (`Map<storeName, Map<key, value>>`)
 *     을 자동으로 활성화한다.
 *
 * @module lib/storage/idb-factory
 * @version 1.0.0
 */
import { getLogger } from '../utils/logger';

const logger = getLogger();

export const APP_DB_NAME = 'OpenHangulAI';
export const APP_DB_VERSION = 1;

/**
 * 스토어 등록 옵션. `registerStore()` 로 모듈이 자신의 스토어 스키마를
 * 선언할 때 사용한다.
 */
export interface StoreRegistration {
  /** Object store 이름 (전역 유일) */
  name: string;
  /** keyPath (예: 'id', 'word', 'key'). 생략 시 out-of-line key */
  keyPath?: string;
  /** 부가 인덱스 */
  indices?: Array<{ name: string; keyPath: string; unique?: boolean }>;
}

/** 등록된 스토어 스키마. 모듈 로드 순서와 무관. */
const registry: Map<string, StoreRegistration> = new Map();

/** 메모리 폴백: 스토어 이름 → key→value Map */
const memoryStores: Map<string, Map<unknown, unknown>> = new Map();

/** 메모리 폴백 활성 상태 */
let memoryFallbackActive = false;

/** 캐시된 DB Promise (싱글톤) */
let dbPromise: Promise<IDBDatabase | null> | null = null;

/** 테스트용 IDBFactory 오버라이드 */
let indexedDBOverride: IDBFactory | null = null;

/**
 * 모듈 로드 시 자신이 사용할 스토어를 등록한다.
 *
 * - 같은 이름으로 두 번 등록되면 마지막 등록이 우선(개발 편의).
 * - DB가 이미 열려 있는 상태에서 새로 등록해도 즉시 마이그레이션은
 *   되지 않으므로 모든 `registerStore` 호출은 모듈 로드 시점에 해야 한다.
 *
 * @param name    스토어 이름
 * @param options keyPath / indices
 */
export function registerStore(name: string, options: Omit<StoreRegistration, 'name'> = {}): void {
  registry.set(name, { name, keyPath: options.keyPath, indices: options.indices });
}

/**
 * IndexedDB 사용 가능 여부.
 */
export function hasIndexedDB(): boolean {
  return typeof resolveIndexedDB() !== 'undefined';
}

/**
 * 현재 사용할 IDBFactory를 반환. 오버라이드 우선.
 */
function resolveIndexedDB(): IDBFactory | undefined {
  if (indexedDBOverride) return indexedDBOverride;
  try {
    return (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  } catch {
    return undefined;
  }
}

/**
 * 메모리 폴백 활성화 (이미 활성화돼 있으면 재사용).
 */
function activateMemoryFallback(reason: string): void {
  if (!memoryFallbackActive) {
    logger.warn(`idb-factory: 메모리 폴백으로 전환 (${reason})`);
    memoryFallbackActive = true;
  }
}

/**
 * 메모리 스토어를 lazy 하게 생성/반환.
 */
function getMemoryStore(name: string): Map<unknown, unknown> {
  let m = memoryStores.get(name);
  if (!m) {
    m = new Map();
    memoryStores.set(name, m);
  }
  return m;
}

/**
 * `OpenHangulAI` DB 핸들을 싱글톤으로 캐싱하여 반환.
 *
 * - 미지원 환경(jsdom 등)에서는 `null` 을 반환하고 메모리 폴백을 활성.
 * - `onupgradeneeded` 시점에 `registry` 의 모든 스토어를 일괄 생성한다.
 *
 * @returns IDBDatabase 또는 (미지원/실패 시) null
 */
export function openAppDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  const idb = resolveIndexedDB();
  if (!idb) {
    activateMemoryFallback('IndexedDB unavailable');
    return Promise.resolve(null);
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = idb.open(APP_DB_NAME, APP_DB_VERSION);
    } catch (error) {
      logger.warn('idb-factory: open() threw', error);
      activateMemoryFallback('open() threw');
      resolve(null);
      return;
    }

    request.onerror = () => {
      logger.warn('idb-factory: open onerror', request.error);
      activateMemoryFallback('open onerror');
      resolve(null);
    };

    request.onblocked = () => {
      logger.warn('idb-factory: open blocked (다른 탭이 이전 버전 사용 중)');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // 등록된 모든 스토어를 일괄 생성
      for (const reg of registry.values()) {
        if (!db.objectStoreNames.contains(reg.name)) {
          const opts: IDBObjectStoreParameters = reg.keyPath ? { keyPath: reg.keyPath } : {};
          const store = db.createObjectStore(reg.name, opts);
          for (const idx of reg.indices ?? []) {
            try {
              store.createIndex(idx.name, idx.keyPath, { unique: !!idx.unique });
            } catch (e) {
              logger.warn(`idb-factory: createIndex ${reg.name}.${idx.name} 실패`, e);
            }
          }
          logger.info(`idb-factory: store '${reg.name}' 생성`);
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        logger.warn('idb-factory: versionchange 감지, 연결 종료');
        try {
          db.close();
        } catch {
          // ignore
        }
        dbPromise = null;
      };
      resolve(db);
    };
  });

  // 실패 시 다음 호출에서 재시도할 수 있도록 캐시 비우기
  dbPromise.then((db) => {
    if (!db) dbPromise = null;
  });

  return dbPromise;
}

/**
 * 스토어 핸들을 반환. 미지원/실패 시 null 을 반환하여 호출자가
 * 메모리 폴백 경로로 분기할 수 있게 한다.
 *
 * @param name 등록된 스토어 이름
 * @param mode 'readonly' | 'readwrite'
 */
export async function getStore(
  name: string,
  mode: IDBTransactionMode
): Promise<IDBObjectStore | null> {
  if (!registry.has(name)) {
    logger.warn(`idb-factory: 미등록 스토어 요청 '${name}'`);
    return null;
  }
  if (memoryFallbackActive) return null;

  const db = await openAppDB();
  if (!db) return null;

  try {
    const tx = db.transaction(name, mode);
    return tx.objectStore(name);
  } catch (e) {
    logger.warn(`idb-factory: transaction(${name}, ${mode}) 실패`, e);
    return null;
  }
}

/**
 * 메모리 폴백 스토어 접근 (호출자 편의).
 * IDB 가 비활성/없을 때 동일한 키 기반 저장소를 제공한다.
 */
export function getMemoryFallback<K = string, V = unknown>(name: string): Map<K, V> {
  if (!registry.has(name)) {
    logger.warn(`idb-factory: 미등록 메모리 스토어 요청 '${name}'`);
  }
  return getMemoryStore(name) as Map<K, V>;
}

/**
 * 현재 메모리 폴백 모드인지 확인.
 */
export function isMemoryFallbackActive(): boolean {
  return memoryFallbackActive;
}

/**
 * IDBRequest를 Promise로 래핑.
 */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IDBRequest failed'));
  });
}

/**
 * IDBTransaction 완료를 기다리는 헬퍼.
 */
export function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDBTransaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDBTransaction aborted'));
  });
}

/* ──────────────────────────────────────────────────────────────────── *
 * Test helpers (PROD 코드에서 사용 금지)
 * ──────────────────────────────────────────────────────────────────── */

/**
 * 테스트용: 캐시된 DB / 메모리 폴백 / 오버라이드 모두 리셋.
 *
 * `clearRegistry` 가 true 면 등록된 스토어 스키마도 비운다 (보통 false).
 */
export async function __resetAppDB(opts: { clearRegistry?: boolean } = {}): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      if (db) db.close();
    } catch {
      // ignore
    }
    dbPromise = null;
  }
  memoryFallbackActive = false;
  memoryStores.clear();
  if (opts.clearRegistry) registry.clear();
}

/**
 * 테스트용: globalThis.indexedDB 대신 사용할 IDBFactory 주입.
 */
export function __setIndexedDBFactory(factory: IDBFactory | null): void {
  indexedDBOverride = factory;
}

/**
 * 테스트용: 메모리 폴백을 강제 활성화/해제.
 */
export function __setMemoryFallback(enabled: boolean): void {
  memoryFallbackActive = enabled;
  if (!enabled) memoryStores.clear();
}

/**
 * 테스트용: 현재 등록된 스토어 이름 목록.
 */
export function __getRegisteredStores(): string[] {
  return Array.from(registry.keys());
}
