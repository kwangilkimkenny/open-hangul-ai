/**
 * Template IndexedDB Persistence
 * 템플릿 갤러리를 위한 경량 IndexedDB 래퍼.
 *
 * - DB 이름: `OpenHangulAI`, 버전 1 (idb-factory 통합)
 * - ObjectStore: `templates` (keyPath: `id`, 인덱스 `updatedAt`)
 * - 브라우저 미지원/quota 초과 시 graceful fallback (메모리 only)
 *
 * 외부 API (putTemplate / getTemplate / listTemplates / deleteTemplate)
 * 시그니처는 v1.0.0 과 동일하다.
 *
 * @module lib/storage/template-db
 * @version 1.1.0
 */

import type { HWPXDocument } from '../../types/hwpx';
import type { TemplateMetadata } from '../../types/template';
import { getLogger } from '../utils/logger';
import {
  APP_DB_NAME,
  APP_DB_VERSION,
  __resetAppDB,
  __setIndexedDBFactory as __factorySetIndexedDB,
  __setMemoryFallback as __factorySetMemoryFallback,
  awaitTransaction,
  getMemoryFallback,
  getStore,
  hasIndexedDB,
  isMemoryFallbackActive,
  openAppDB,
  promisifyRequest,
  registerStore,
} from './idb-factory';

const logger = getLogger();

export const TEMPLATE_DB_NAME = APP_DB_NAME;
export const TEMPLATE_DB_VERSION = APP_DB_VERSION;
export const TEMPLATE_STORE_NAME = 'templates';

// 모듈 로드 시점에 자신의 스토어를 팩토리에 등록
registerStore(TEMPLATE_STORE_NAME, {
  keyPath: 'id',
  indices: [{ name: 'updatedAt', keyPath: 'updatedAt', unique: false }],
});

/**
 * IndexedDB에 영속화되는 템플릿 레코드.
 */
export interface TemplateRecord {
  id: string;
  name: string;
  content: HWPXDocument | null;
  meta: TemplateMetadata;
  createdAt: number;
  updatedAt: number;
}

/** 모듈-로컬 강제 폴백 상태(이전 API 호환용) */
let localForcedFallback = false;

/** 메모리 폴백 스토어 헬퍼 */
function memMap(): Map<string, TemplateRecord> {
  return getMemoryFallback<string, TemplateRecord>(TEMPLATE_STORE_NAME);
}

function shouldUseMemory(): boolean {
  return localForcedFallback || isMemoryFallbackActive();
}

/**
 * 이전 호환: 개별 `openDb()` API 유지. 내부적으로 팩토리 위임.
 */
export async function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDB()) {
    throw new Error('IndexedDB not supported');
  }
  const db = await openAppDB();
  if (!db) throw new Error('IndexedDB open failed');
  return db;
}

/**
 * 공통 에러 처리: quota 초과 등은 메모리 폴백으로.
 */
function handleQuotaError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') {
    localForcedFallback = true;
    logger.warn('template-db: QuotaExceededError → 메모리 폴백 전환');
    return true;
  }
  return false;
}

/**
 * 템플릿 1건 저장 (upsert).
 */
export async function putTemplate(record: TemplateRecord): Promise<void> {
  if (shouldUseMemory()) {
    memMap().set(record.id, record);
    return;
  }
  try {
    const store = await getStore(TEMPLATE_STORE_NAME, 'readwrite');
    if (!store) {
      memMap().set(record.id, record);
      return;
    }
    store.put(record);
    await awaitTransaction(store.transaction);
  } catch (error) {
    if (handleQuotaError(error)) {
      memMap().set(record.id, record);
      return;
    }
    logger.warn('template-db: putTemplate 실패, 메모리 폴백', error);
    localForcedFallback = true;
    memMap().set(record.id, record);
  }
}

/**
 * 단일 템플릿 조회. 없으면 undefined.
 */
export async function getTemplate(id: string): Promise<TemplateRecord | undefined> {
  if (shouldUseMemory()) {
    return memMap().get(id);
  }
  try {
    const store = await getStore(TEMPLATE_STORE_NAME, 'readonly');
    if (!store) return memMap().get(id);
    const result = await promisifyRequest<TemplateRecord | undefined>(
      store.get(id) as IDBRequest<TemplateRecord | undefined>
    );
    return result;
  } catch (error) {
    logger.warn('template-db: getTemplate 실패, 메모리 폴백 조회', error);
    localForcedFallback = true;
    return memMap().get(id);
  }
}

/**
 * 모든 템플릿을 updatedAt 내림차순으로 반환.
 */
export async function listTemplates(): Promise<TemplateRecord[]> {
  if (shouldUseMemory()) {
    return Array.from(memMap().values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  try {
    const store = await getStore(TEMPLATE_STORE_NAME, 'readonly');
    if (!store) {
      return Array.from(memMap().values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    const records = await promisifyRequest<TemplateRecord[]>(
      store.getAll() as IDBRequest<TemplateRecord[]>
    );
    return (records ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    logger.warn('template-db: listTemplates 실패, 메모리 폴백 조회', error);
    localForcedFallback = true;
    return Array.from(memMap().values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

/**
 * 템플릿 삭제. 존재하지 않아도 에러 없음.
 */
export async function deleteTemplate(id: string): Promise<void> {
  if (shouldUseMemory()) {
    memMap().delete(id);
    return;
  }
  try {
    const store = await getStore(TEMPLATE_STORE_NAME, 'readwrite');
    if (!store) {
      memMap().delete(id);
      return;
    }
    store.delete(id);
    await awaitTransaction(store.transaction);
  } catch (error) {
    logger.warn('template-db: deleteTemplate 실패, 메모리 폴백', error);
    localForcedFallback = true;
    memMap().delete(id);
  }
}

/* ──────────────────────────────────────────────────────────────────── *
 * Test helpers (이전 API 호환)
 * ──────────────────────────────────────────────────────────────────── */

/**
 * 캐시된 DB / 메모리 폴백 / 강제 폴백 플래그를 모두 비웁니다.
 */
export async function __resetTemplateDb(): Promise<void> {
  localForcedFallback = false;
  await __resetAppDB();
}

/**
 * 강제 메모리 폴백 토글.
 */
export function __setMemoryFallback(enabled: boolean): void {
  localForcedFallback = enabled;
  __factorySetMemoryFallback(enabled);
}

/**
 * 테스트용 IDBFactory 주입. null 이면 globalThis.indexedDB 사용.
 */
export function __setIndexedDBFactory(factory: IDBFactory | null): void {
  __factorySetIndexedDB(factory);
}
