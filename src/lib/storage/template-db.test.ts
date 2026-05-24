/**
 * Template IndexedDB Persistence — 단위 테스트
 *
 * fake-indexeddb 미설치 환경에서도 동작하도록, 모듈이 의존하는 IDBFactory에
 * 인메모리 fake를 주입합니다. 핵심 검증은 put/get/list(desc)/delete
 * 라운드트립과 quota/error 시 메모리 폴백 전환입니다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTemplateDb,
  __setIndexedDBFactory,
  __setMemoryFallback,
  deleteTemplate,
  getTemplate,
  listTemplates,
  putTemplate,
  type TemplateRecord,
} from './template-db';
import type { TemplateMetadata } from '../../types/template';

// ------------------------------------------------------------
// 최소한의 인메모리 fake IndexedDB (필요한 API만 구현)
// ------------------------------------------------------------

interface FakeStore {
  data: Map<string, TemplateRecord>;
  keyPath: string;
  indexes: Set<string>;
}

interface FakeDb {
  objectStoreNames: { contains: (name: string) => boolean; add: (name: string) => void };
  _stores: Map<string, FakeStore>;
  createObjectStore: (
    name: string,
    opts: { keyPath: string }
  ) => {
    createIndex: (name: string, _path: string, _opts?: object) => void;
  };
  transaction: (name: string, mode: IDBTransactionMode) => FakeTransaction;
  close: () => void;
  onversionchange: ((this: IDBDatabase, ev: IDBVersionChangeEvent) => unknown) | null;
}

interface FakeTransaction {
  oncomplete: (() => void) | null;
  onerror: ((this: IDBTransaction, ev: Event) => unknown) | null;
  onabort: ((this: IDBTransaction, ev: Event) => unknown) | null;
  error: DOMException | null;
  _pending: Array<() => void>;
  _scheduled: boolean;
  objectStore: (name: string) => FakeObjectStore;
  _flush: () => void;
}

interface FakeObjectStore {
  put: (value: TemplateRecord) => FakeRequest<undefined>;
  get: (key: string) => FakeRequest<TemplateRecord | undefined>;
  getAll: () => FakeRequest<TemplateRecord[]>;
  delete: (key: string) => FakeRequest<undefined>;
}

interface FakeRequest<T> {
  result: T | undefined;
  error: DOMException | null;
  onsuccess: ((this: IDBRequest, ev: Event) => unknown) | null;
  onerror: ((this: IDBRequest, ev: Event) => unknown) | null;
}

function makeRequest<T>(): FakeRequest<T> {
  return {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
  };
}

function makeFakeIndexedDB(opts: { failOpen?: boolean; quotaError?: boolean } = {}) {
  const stores = new Map<string, FakeStore>();

  function makeDb(): FakeDb {
    const objectStoreNames = {
      contains: (name: string) => stores.has(name),
      add: (name: string) =>
        stores.set(name, { data: new Map(), keyPath: 'id', indexes: new Set() }),
    };

    return {
      objectStoreNames,
      _stores: stores,
      onversionchange: null,
      createObjectStore: (name, options) => {
        const store: FakeStore = { data: new Map(), keyPath: options.keyPath, indexes: new Set() };
        stores.set(name, store);
        return {
          createIndex: idxName => {
            store.indexes.add(idxName);
          },
        };
      },
      transaction: (name, _mode) => {
        const tx: FakeTransaction = {
          oncomplete: null,
          onerror: null,
          onabort: null,
          error: null,
          _pending: [],
          _scheduled: false,
          _flush: () => {
            // microtask로 모든 pending 작업 실행 후 oncomplete 호출
            queueMicrotask(() => {
              for (const fn of tx._pending) {
                try {
                  fn();
                } catch {
                  // ignore
                }
              }
              if (tx.error) {
                tx.onerror?.call({} as IDBTransaction, new Event('error'));
              } else {
                tx.oncomplete?.();
              }
            });
          },
          objectStore: _storeName => {
            const store = stores.get(name)!;

            const schedule = <T>(req: FakeRequest<T>, op: () => void) => {
              tx._pending.push(() => {
                try {
                  op();
                  req.onsuccess?.call({} as IDBRequest, new Event('success'));
                } catch (e) {
                  req.error = e as DOMException;
                  req.onerror?.call({} as IDBRequest, new Event('error'));
                }
              });
              if (!tx._scheduled) {
                tx._scheduled = true;
                tx._flush();
              }
              return req;
            };

            return {
              put: value => {
                const req = makeRequest<undefined>();
                if (opts.quotaError) {
                  // 트랜잭션 자체 에러로 설정
                  const err = new DOMException('quota', 'QuotaExceededError');
                  tx.error = err;
                  return schedule(req, () => {
                    throw err;
                  });
                }
                return schedule(req, () => {
                  store.data.set(value.id, value);
                });
              },
              get: key => {
                const req = makeRequest<TemplateRecord | undefined>();
                return schedule(req, () => {
                  req.result = store.data.get(key);
                });
              },
              getAll: () => {
                const req = makeRequest<TemplateRecord[]>();
                return schedule(req, () => {
                  req.result = Array.from(store.data.values());
                });
              },
              delete: key => {
                const req = makeRequest<undefined>();
                return schedule(req, () => {
                  store.data.delete(key);
                });
              },
            };
          },
        };
        return tx;
      },
      close: () => {
        /* no-op */
      },
    };
  }

  return {
    open: (_name: string, _version: number) => {
      const request = {
        result: undefined as unknown,
        error: null as DOMException | null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onupgradeneeded: null as
          | ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown)
          | null,
        onblocked: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
      };

      queueMicrotask(() => {
        if (opts.failOpen) {
          request.error = new DOMException('open failed', 'UnknownError');
          request.onerror?.call(request as unknown as IDBOpenDBRequest, new Event('error'));
          return;
        }
        const db = makeDb();
        request.result = db;
        // upgrade
        if (!db.objectStoreNames.contains('templates')) {
          request.onupgradeneeded?.call(
            request as unknown as IDBOpenDBRequest,
            { target: request } as unknown as IDBVersionChangeEvent
          );
        }
        request.onsuccess?.call(request as unknown as IDBOpenDBRequest, new Event('success'));
      });

      return request as unknown as IDBOpenDBRequest;
    },
    deleteDatabase: () => ({}) as IDBOpenDBRequest,
    cmp: () => 0,
    databases: async () => [],
  } as unknown as IDBFactory;
}

// ------------------------------------------------------------
// 테스트 픽스처
// ------------------------------------------------------------

function makeMeta(id: string, name: string, createdAt = new Date('2026-01-01')): TemplateMetadata {
  return {
    id,
    name,
    originalFileName: `${name}.hwpx`,
    createdAt,
    version: '1.0.0',
    structure: {
      pageCount: 1,
      sectionCount: 1,
      hasTables: false,
      tableCount: 0,
      tableLayouts: [],
      hasTitles: false,
      titleCount: 0,
      titles: [],
      hasImages: false,
      imageCount: 0,
      imagePositions: [],
      hasShapes: false,
      shapeCount: 0,
      shapePositions: [],
      paragraphCount: 0,
      totalTextLength: 0,
      avgParagraphLength: 0,
      pageSettings: [],
    },
    options: {
      keepTitles: true,
      titlePlaceholder: '{{title}}',
      keepTableHeaders: true,
      keepTableStructure: true,
      clearDataCells: true,
      keepImages: false,
      keepShapes: false,
      keepPageSettings: true,
      keepHeaderFooter: false,
      cellPlaceholder: '{{cell}}',
      preserveFormatting: true,
      minTitleConfidence: 70,
      detectFormulas: false,
    },
  };
}

function makeRecord(id: string, name: string, updatedAt: number): TemplateRecord {
  return {
    id,
    name,
    content: null,
    meta: makeMeta(id, name),
    createdAt: updatedAt,
    updatedAt,
  };
}

// ------------------------------------------------------------
// 테스트
// ------------------------------------------------------------

describe('template-db (IndexedDB persistence)', () => {
  beforeEach(async () => {
    await __resetTemplateDb();
    __setIndexedDBFactory(makeFakeIndexedDB());
  });

  afterEach(async () => {
    await __resetTemplateDb();
    __setIndexedDBFactory(null);
    vi.restoreAllMocks();
  });

  describe('put/get round-trip', () => {
    it('저장한 템플릿을 동일 id로 조회할 수 있다', async () => {
      const rec = makeRecord('t1', '첫번째', 1000);
      await putTemplate(rec);
      const fetched = await getTemplate('t1');
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe('t1');
      expect(fetched?.name).toBe('첫번째');
    });

    it('존재하지 않는 id 조회 시 undefined를 반환한다', async () => {
      const fetched = await getTemplate('missing');
      expect(fetched).toBeUndefined();
    });
  });

  describe('list 정렬', () => {
    it('updatedAt 내림차순으로 정렬되어 반환된다', async () => {
      await putTemplate(makeRecord('a', 'A', 1000));
      await putTemplate(makeRecord('b', 'B', 3000));
      await putTemplate(makeRecord('c', 'C', 2000));

      const list = await listTemplates();
      expect(list.map(r => r.id)).toEqual(['b', 'c', 'a']);
    });

    it('비어있을 때 빈 배열을 반환한다', async () => {
      const list = await listTemplates();
      expect(list).toEqual([]);
    });
  });

  describe('delete', () => {
    it('삭제 후 조회 시 undefined를 반환한다', async () => {
      await putTemplate(makeRecord('t1', 'A', 1000));
      await deleteTemplate('t1');
      const fetched = await getTemplate('t1');
      expect(fetched).toBeUndefined();
    });

    it('존재하지 않는 id 삭제도 에러 없이 완료된다', async () => {
      await expect(deleteTemplate('nope')).resolves.toBeUndefined();
    });
  });

  describe('graceful fallback', () => {
    it('IndexedDB가 미지원이면 메모리 폴백으로 동작한다', async () => {
      await __resetTemplateDb();
      // 오버라이드 제거 → globalThis.indexedDB 사용. setup.ts mock은 open 시 reject되지 않지만,
      // 우리 모듈은 onerror를 통해 reject되거나 trans construction에서 실패하므로 fallback 진입.
      // 더 결정적으로, 오버라이드를 명시적 undefined로 다시 설정.
      __setIndexedDBFactory({
        open: () => {
          throw new Error('Not supported');
        },
      } as unknown as IDBFactory);

      await putTemplate(makeRecord('mem1', 'Mem', 5));
      const fetched = await getTemplate('mem1');
      expect(fetched?.id).toBe('mem1');

      const list = await listTemplates();
      expect(list.length).toBe(1);

      await deleteTemplate('mem1');
      expect(await getTemplate('mem1')).toBeUndefined();
    });

    it('명시적으로 폴백 활성화 시 IDB 호출 없이 메모리에만 저장된다', async () => {
      __setMemoryFallback(true);
      await putTemplate(makeRecord('m', 'X', 1));
      const list = await listTemplates();
      expect(list.map(r => r.id)).toContain('m');
    });
  });
});
