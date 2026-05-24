/**
 * Template IndexedDB Persistence
 * 템플릿 갤러리를 위한 경량 IndexedDB 래퍼.
 *
 * - DB 이름: `OpenHangulAI`, 버전 1
 * - ObjectStore: `templates` (keyPath: `id`)
 * - 브라우저 미지원/quota 초과 시 graceful fallback (메모리 only)
 *
 * raw IndexedDB API만 사용하여 추가 의존성 없이 동작합니다.
 *
 * @module lib/storage/template-db
 * @version 1.0.0
 */

import type { HWPXDocument } from '../../types/hwpx';
import type { TemplateMetadata } from '../../types/template';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export const TEMPLATE_DB_NAME = 'OpenHangulAI';
export const TEMPLATE_DB_VERSION = 1;
export const TEMPLATE_STORE_NAME = 'templates';

/**
 * IndexedDB에 영속화되는 템플릿 레코드.
 *
 * - `content`: 직렬화된 HWPXDocument (Map 등 비-JSON 자료형은 호출자가 평탄화 후 넘김)
 * - `meta`: 가벼운 메타데이터 (목록/필터링 용)
 */
export interface TemplateRecord {
  id: string;
  name: string;
  content: HWPXDocument | null;
  meta: TemplateMetadata;
  createdAt: number;
  updatedAt: number;
}

/**
 * IndexedDB가 사용 불가능할 때 활성화되는 인메모리 폴백 스토리지.
 * 호출 인터페이스를 동일하게 유지하므로 호출자는 분기할 필요 없음.
 */
class MemoryFallbackStore {
  private records = new Map<string, TemplateRecord>();

  async put(record: TemplateRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async get(id: string): Promise<TemplateRecord | undefined> {
    return this.records.get(id);
  }

  async list(): Promise<TemplateRecord[]> {
    return Array.from(this.records.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;
let memoryFallback: MemoryFallbackStore | null = null;
// 테스트에서 주입 가능한 IDBFactory 오버라이드. null이면 globalThis.indexedDB 사용.
let indexedDBOverride: IDBFactory | null = null;

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
 * IndexedDB 지원 여부 (런타임).
 */
function hasIndexedDB(): boolean {
  return typeof resolveIndexedDB() !== 'undefined';
}

/**
 * 메모리 폴백 활성화 (이미 활성화돼 있으면 재사용).
 */
function enableMemoryFallback(reason: string): MemoryFallbackStore {
  if (!memoryFallback) {
    logger.warn(`⚠️ template-db: 메모리 폴백으로 전환 (${reason})`);
    memoryFallback = new MemoryFallbackStore();
  }
  return memoryFallback;
}

/**
 * IndexedDB 핸들을 싱글톤으로 캐싱하여 반환.
 * 미지원/오류 시 거부되고, 상위 호출자는 메모리 폴백으로 대체합니다.
 */
export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  if (!hasIndexedDB()) {
    const err = new Error('IndexedDB not supported');
    return Promise.reject(err);
  }

  const idb = resolveIndexedDB();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = idb.open(TEMPLATE_DB_NAME, TEMPLATE_DB_VERSION);
    } catch (error) {
      // Safari private mode 등에서 throw 가능
      reject(error);
      return;
    }

    request.onerror = () => {
      logger.error('template-db: IndexedDB open 실패', request.error);
      reject(request.error ?? new Error('IndexedDB open failed'));
    };

    request.onblocked = () => {
      logger.warn('template-db: open blocked (다른 탭이 이전 버전 사용 중)');
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(TEMPLATE_STORE_NAME)) {
        const store = db.createObjectStore(TEMPLATE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        logger.info('template-db: object store 생성 완료');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // 다른 탭이 schema upgrade를 요청한 경우 자동 닫기 (멀티탭 호환)
      db.onversionchange = () => {
        logger.warn('template-db: versionchange 감지, 연결 종료');
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
  });

  // 실패 시 다음 호출에서 재시도할 수 있도록 promise 캐시를 비웁니다.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

/**
 * 트랜잭션 헬퍼: IDBRequest를 Promise로 래핑.
 */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IDBRequest failed'));
  });
}

/**
 * 트랜잭션 완료를 기다리는 헬퍼.
 */
function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDBTransaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDBTransaction aborted'));
  });
}

/**
 * 공통 에러 처리: quota 초과 시 메모리 폴백으로 마이그레이션.
 */
function handleQuotaError(error: unknown): MemoryFallbackStore | null {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') {
    return enableMemoryFallback('QuotaExceededError');
  }
  return null;
}

/**
 * 템플릿 1건 저장 (upsert).
 */
export async function putTemplate(record: TemplateRecord): Promise<void> {
  if (memoryFallback) {
    return memoryFallback.put(record);
  }

  try {
    const db = await openDb();
    const tx = db.transaction(TEMPLATE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(TEMPLATE_STORE_NAME);
    store.put(record);
    await awaitTransaction(tx);
  } catch (error) {
    const fallback = handleQuotaError(error);
    if (fallback) {
      return fallback.put(record);
    }
    logger.warn('template-db: putTemplate 실패, 메모리 폴백으로 전환', error);
    return enableMemoryFallback('putTemplate error').put(record);
  }
}

/**
 * 단일 템플릿 조회. 없으면 undefined.
 */
export async function getTemplate(id: string): Promise<TemplateRecord | undefined> {
  if (memoryFallback) {
    return memoryFallback.get(id);
  }

  try {
    const db = await openDb();
    const tx = db.transaction(TEMPLATE_STORE_NAME, 'readonly');
    const store = tx.objectStore(TEMPLATE_STORE_NAME);
    const result = await promisifyRequest<TemplateRecord | undefined>(
      store.get(id) as IDBRequest<TemplateRecord | undefined>
    );
    return result;
  } catch (error) {
    logger.warn('template-db: getTemplate 실패, 메모리 폴백 조회', error);
    return enableMemoryFallback('getTemplate error').get(id);
  }
}

/**
 * 모든 템플릿을 updatedAt 내림차순으로 반환.
 */
export async function listTemplates(): Promise<TemplateRecord[]> {
  if (memoryFallback) {
    return memoryFallback.list();
  }

  try {
    const db = await openDb();
    const tx = db.transaction(TEMPLATE_STORE_NAME, 'readonly');
    const store = tx.objectStore(TEMPLATE_STORE_NAME);
    const records = await promisifyRequest<TemplateRecord[]>(
      store.getAll() as IDBRequest<TemplateRecord[]>
    );
    return (records ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    logger.warn('template-db: listTemplates 실패, 메모리 폴백 조회', error);
    return enableMemoryFallback('listTemplates error').list();
  }
}

/**
 * 템플릿 삭제. 존재하지 않아도 에러를 던지지 않음.
 */
export async function deleteTemplate(id: string): Promise<void> {
  if (memoryFallback) {
    return memoryFallback.delete(id);
  }

  try {
    const db = await openDb();
    const tx = db.transaction(TEMPLATE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(TEMPLATE_STORE_NAME);
    store.delete(id);
    await awaitTransaction(tx);
  } catch (error) {
    logger.warn('template-db: deleteTemplate 실패, 메모리 폴백 삭제', error);
    return enableMemoryFallback('deleteTemplate error').delete(id);
  }
}

/**
 * 테스트/디버깅용: 캐시된 DB 핸들과 메모리 폴백을 모두 비웁니다.
 * 프로덕션 코드에서는 사용하지 마세요.
 */
export async function __resetTemplateDb(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
    dbPromise = null;
  }
  memoryFallback = null;
}

/**
 * 테스트용: 강제로 메모리 폴백을 활성화/비활성화.
 */
export function __setMemoryFallback(enabled: boolean): void {
  memoryFallback = enabled ? new MemoryFallbackStore() : null;
}

/**
 * 테스트용: globalThis.indexedDB 대신 사용할 IDBFactory를 주입.
 * null을 넘기면 다시 globalThis.indexedDB를 사용합니다.
 */
export function __setIndexedDBFactory(factory: IDBFactory | null): void {
  indexedDBOverride = factory;
}
