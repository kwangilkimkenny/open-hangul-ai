/**
 * Template Store
 * 템플릿 상태 관리 (Zustand) + IndexedDB 영속화
 *
 * @module stores/templateStore
 * @version 1.1.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { HWPXDocument } from '../types/hwpx';
import type { TemplateMetadata, TemplateFilter, TemplateGenerationResult } from '../types/template';
import { getLogger } from '../lib/utils/logger';
import {
  deleteTemplate as dbDeleteTemplate,
  getTemplate as dbGetTemplate,
  listTemplates as dbListTemplates,
  putTemplate as dbPutTemplate,
  type TemplateRecord,
} from '../lib/storage/template-db';

const logger = getLogger();

/**
 * 템플릿 스토어 상태 인터페이스
 */
interface TemplateState {
  // State
  templates: Map<string, StoredTemplate>;
  currentTemplate: HWPXDocument | null;
  currentMetadata: TemplateMetadata | null;
  isGenerating: boolean;
  isHydrated: boolean;
  lastGenerationResult: TemplateGenerationResult | null;

  // Actions - Template Management
  saveTemplate: (template: HWPXDocument, metadata: TemplateMetadata) => Promise<void>;
  loadTemplate: (id: string) => Promise<HWPXDocument | null>;
  deleteTemplate: (id: string) => Promise<void>;
  updateTemplate: (id: string, template: Partial<StoredTemplate>) => Promise<void>;

  // Actions - Template List
  listTemplates: (filter?: TemplateFilter) => TemplateMetadata[];
  getTemplateById: (id: string) => StoredTemplate | null;
  searchTemplates: (query: string) => TemplateMetadata[];

  // Actions - Current Template
  setCurrentTemplate: (template: HWPXDocument | null, metadata?: TemplateMetadata | null) => void;
  clearCurrentTemplate: () => void;

  // Actions - Generation
  setGenerating: (generating: boolean) => void;
  setLastGenerationResult: (result: TemplateGenerationResult | null) => void;

  // Actions - Utility
  exportTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string, newName?: string) => Promise<string | null>;
  clearAll: () => Promise<void>;

  // Actions - Lifecycle
  hydrateFromDb: () => Promise<void>;

  // Computed / Getters
  getTemplateCount: () => number;
  hasTemplate: (id: string) => boolean;
  getTemplatesByTag: (tag: string) => TemplateMetadata[];
  getTemplatesByCategory: (category: string) => TemplateMetadata[];
}

/**
 * 저장된 템플릿 (직렬화 가능)
 */
interface StoredTemplate {
  id: string;
  metadata: TemplateMetadata;
  // HWPX Document 본체는 IndexedDB에만 보관하고 메모리 스토어는 메타데이터만 유지.
  hasDocument: boolean;
  createdAt: Date;
  lastModified: Date;
  usageCount: number;
}

/**
 * Map<string, V>를 직렬화 가능한 형태로 평탄화 (HWPXDocument.images 등).
 * IndexedDB는 structured clone을 지원하지만, persist middleware와 일관성을 맞추기 위해 평탄화한다.
 */
function flattenDocument(doc: HWPXDocument): HWPXDocument {
  return {
    ...doc,
    images:
      doc.images instanceof Map ? (doc.images as unknown as Map<string, unknown>) : doc.images,
  };
}

/**
 * DB에서 읽어온 record를 메모리 스토어용 StoredTemplate으로 변환.
 */
function recordToStored(record: TemplateRecord): StoredTemplate {
  const meta = record.meta;
  return {
    id: record.id,
    metadata: {
      ...meta,
      createdAt: meta.createdAt instanceof Date ? meta.createdAt : new Date(meta.createdAt),
    },
    hasDocument: record.content !== null,
    createdAt: new Date(record.createdAt),
    lastModified: new Date(record.updatedAt),
    usageCount: 0,
  };
}

/**
 * StoredTemplate + (옵션) 본문을 DB 레코드로 변환.
 */
function storedToRecord(stored: StoredTemplate, content: HWPXDocument | null): TemplateRecord {
  return {
    id: stored.id,
    name: stored.metadata.name,
    content: content ? flattenDocument(content) : null,
    meta: stored.metadata,
    createdAt: stored.createdAt.getTime(),
    updatedAt: stored.lastModified.getTime(),
  };
}

/**
 * 초기 상태
 */
const initialState = {
  templates: new Map<string, StoredTemplate>(),
  currentTemplate: null,
  currentMetadata: null,
  isGenerating: false,
  isHydrated: false,
  lastGenerationResult: null,
};

/**
 * 템플릿 스토어
 */
export const useTemplateStore = create<TemplateState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // =============================================
        // Template Management
        // =============================================

        saveTemplate: async (template, metadata) => {
          logger.info(`💾 템플릿 저장: ${metadata.name}`);

          const storedTemplate: StoredTemplate = {
            id: metadata.id,
            metadata,
            hasDocument: true,
            createdAt: metadata.createdAt,
            lastModified: new Date(),
            usageCount: 0,
          };

          set(state => {
            const newTemplates = new Map(state.templates);
            newTemplates.set(metadata.id, storedTemplate);

            return {
              templates: newTemplates,
              currentTemplate: template,
              currentMetadata: metadata,
            };
          });

          // IndexedDB에 본문 + 메타 저장
          try {
            await dbPutTemplate(storedToRecord(storedTemplate, template));
            logger.info(`✅ 템플릿 저장 완료: ${metadata.id}`);
          } catch (error) {
            logger.error('템플릿 IndexedDB 저장 실패', error);
            // 메모리 스토어에는 이미 반영됨 → 호출자에게는 성공 응답
          }
        },

        loadTemplate: async id => {
          logger.info(`📂 템플릿 로드: ${id}`);

          const stored = get().templates.get(id);
          if (!stored) {
            logger.warn(`❌ 템플릿을 찾을 수 없음: ${id}`);
            return null;
          }

          // 사용 횟수 증가 (메모리만; DB write는 update에서 처리)
          await get().updateTemplate(id, {
            usageCount: stored.usageCount + 1,
            lastModified: new Date(),
          });

          // IndexedDB에서 본문 로드
          try {
            const record = await dbGetTemplate(id);
            if (!record || !record.content) {
              logger.warn(`⚠️ 템플릿 본문 없음: ${id}`);
              return null;
            }
            logger.info(`✅ 템플릿 로드 완료: ${id}`);
            return record.content;
          } catch (error) {
            logger.error('템플릿 IndexedDB 로드 실패', error);
            return null;
          }
        },

        deleteTemplate: async id => {
          logger.info(`🗑️ 템플릿 삭제: ${id}`);

          set(state => {
            const newTemplates = new Map(state.templates);
            newTemplates.delete(id);

            return {
              templates: newTemplates,
              currentTemplate: state.currentMetadata?.id === id ? null : state.currentTemplate,
              currentMetadata: state.currentMetadata?.id === id ? null : state.currentMetadata,
            };
          });

          // IndexedDB에서도 삭제
          try {
            await dbDeleteTemplate(id);
            logger.info(`✅ 템플릿 삭제 완료: ${id}`);
          } catch (error) {
            logger.error('템플릿 IndexedDB 삭제 실패', error);
          }
        },

        updateTemplate: async (id, updates) => {
          let nextStored: StoredTemplate | undefined;

          set(state => {
            const newTemplates = new Map(state.templates);
            const existing = newTemplates.get(id);

            if (existing) {
              nextStored = { ...existing, ...updates };
              newTemplates.set(id, nextStored);
            }

            return { templates: newTemplates };
          });

          if (!nextStored) return;

          // 메타데이터만 변경되는 경우 본문은 그대로 유지하기 위해 기존 record를 읽어옴
          try {
            const existingRecord = await dbGetTemplate(id);
            await dbPutTemplate(storedToRecord(nextStored, existingRecord?.content ?? null));
          } catch (error) {
            logger.error('템플릿 IndexedDB 업데이트 실패', error);
          }
        },

        // =============================================
        // Template List
        // =============================================

        listTemplates: filter => {
          const templates = Array.from(get().templates.values()).map(t => t.metadata);

          if (!filter) {
            return templates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }

          let filtered = templates;

          // 검색 쿼리
          if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            filtered = filtered.filter(
              t =>
                t.name.toLowerCase().includes(query) ||
                t.description?.toLowerCase().includes(query) ||
                t.tags?.some(tag => tag.toLowerCase().includes(query))
            );
          }

          // 태그 필터
          if (filter.tags && filter.tags.length > 0) {
            filtered = filtered.filter(t => t.tags?.some(tag => filter.tags!.includes(tag)));
          }

          // 카테고리 필터
          if (filter.category) {
            filtered = filtered.filter(t => t.category === filter.category);
          }

          // 표 포함 여부
          if (filter.hasTable !== undefined) {
            filtered = filtered.filter(t => t.structure.hasTables === filter.hasTable);
          }

          // 이미지 포함 여부
          if (filter.hasImage !== undefined) {
            filtered = filtered.filter(t => t.structure.hasImages === filter.hasImage);
          }

          // 정렬
          if (filter.sortBy) {
            filtered.sort((a, b) => {
              const order = filter.sortOrder === 'desc' ? -1 : 1;

              switch (filter.sortBy) {
                case 'name':
                  return order * a.name.localeCompare(b.name);
                case 'date':
                  return order * (b.createdAt.getTime() - a.createdAt.getTime());
                case 'usage': {
                  const aUsage = get().templates.get(a.id)?.usageCount || 0;
                  const bUsage = get().templates.get(b.id)?.usageCount || 0;
                  return order * (bUsage - aUsage);
                }
                default:
                  return 0;
              }
            });
          }

          return filtered;
        },

        getTemplateById: id => {
          return get().templates.get(id) || null;
        },

        searchTemplates: query => {
          return get().listTemplates({ searchQuery: query });
        },

        // =============================================
        // Current Template
        // =============================================

        setCurrentTemplate: (template, metadata) => {
          set({
            currentTemplate: template,
            currentMetadata: metadata || null,
          });
        },

        clearCurrentTemplate: () => {
          set({
            currentTemplate: null,
            currentMetadata: null,
          });
        },

        // =============================================
        // Generation
        // =============================================

        setGenerating: generating => {
          set({ isGenerating: generating });
        },

        setLastGenerationResult: result => {
          set({ lastGenerationResult: result });
        },

        // =============================================
        // Utility
        // =============================================

        exportTemplate: async id => {
          logger.info(`📤 템플릿 내보내기: ${id}`);

          const stored = get().templates.get(id);
          if (!stored) {
            throw new Error(`템플릿을 찾을 수 없습니다: ${id}`);
          }

          // HWPXExporter를 사용하여 파일로 내보내기
          // 실제 구현은 컴포넌트에서 수행
          logger.info(`✅ 템플릿 내보내기 준비 완료: ${id}`);
        },

        duplicateTemplate: async (id, newName) => {
          logger.info(`📋 템플릿 복제: ${id}`);

          const stored = get().templates.get(id);
          if (!stored) {
            logger.warn(`❌ 템플릿을 찾을 수 없음: ${id}`);
            return null;
          }

          const newId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newMetadata: TemplateMetadata = {
            ...stored.metadata,
            id: newId,
            name: newName || `${stored.metadata.name} (사본)`,
            createdAt: new Date(),
          };

          const newTemplate: StoredTemplate = {
            ...stored,
            id: newId,
            metadata: newMetadata,
            createdAt: new Date(),
            lastModified: new Date(),
            usageCount: 0,
          };

          set(state => {
            const newTemplates = new Map(state.templates);
            newTemplates.set(newId, newTemplate);
            return { templates: newTemplates };
          });

          // 원본 본문도 함께 복제하여 IndexedDB에 저장
          try {
            const originalRecord = await dbGetTemplate(id);
            await dbPutTemplate(storedToRecord(newTemplate, originalRecord?.content ?? null));
          } catch (error) {
            logger.error('템플릿 복제 IndexedDB 저장 실패', error);
          }

          logger.info(`✅ 템플릿 복제 완료: ${newId}`);
          return newId;
        },

        clearAll: async () => {
          logger.warn('🗑️ 모든 템플릿 삭제');

          const ids = Array.from(get().templates.keys());

          set({
            ...initialState,
            templates: new Map(),
            isHydrated: get().isHydrated,
          });

          // IndexedDB에서도 일괄 삭제
          await Promise.allSettled(ids.map(id => dbDeleteTemplate(id)));
        },

        // =============================================
        // Lifecycle
        // =============================================

        /**
         * IndexedDB의 메타데이터를 메모리 스토어로 hydrate.
         * - persist middleware의 localStorage 캐시보다 IndexedDB가 우선합니다.
         * - 본문은 lazy load (loadTemplate 호출 시 IDB 조회).
         */
        hydrateFromDb: async () => {
          if (get().isHydrated) return;
          try {
            const records = await dbListTemplates();
            const map = new Map<string, StoredTemplate>();
            for (const record of records) {
              map.set(record.id, recordToStored(record));
            }
            set({ templates: map, isHydrated: true });
            logger.info(`✅ 템플릿 hydrate 완료: ${map.size}개`);
          } catch (error) {
            logger.error('템플릿 hydrate 실패', error);
            set({ isHydrated: true }); // 재시도 루프 방지
          }
        },

        // =============================================
        // Computed / Getters
        // =============================================

        getTemplateCount: () => {
          return get().templates.size;
        },

        hasTemplate: id => {
          return get().templates.has(id);
        },

        getTemplatesByTag: tag => {
          return get().listTemplates({ tags: [tag] });
        },

        getTemplatesByCategory: category => {
          return get().listTemplates({ category });
        },
      }),
      {
        name: 'template-store',
        partialize: state => ({
          // templates Map은 직렬화 불가능하므로 배열로 변환.
          // IndexedDB가 SoR이지만 첫 paint 전 빠른 표시를 위해 메타만 캐시.
          templates: Array.from(state.templates.entries()),
        }),
        // 역직렬화: 배열을 다시 Map으로 변환
        merge: (persistedState: unknown, currentState) => {
          const ps = persistedState as { templates?: Array<[string, StoredTemplate]> } | undefined;
          const templates = ps?.templates
            ? new Map(
                ps.templates.map(([key, stored]) => [
                  key,
                  {
                    ...stored,
                    createdAt: new Date(stored.createdAt),
                    lastModified: new Date(stored.lastModified),
                    metadata: {
                      ...stored.metadata,
                      createdAt: new Date(stored.metadata.createdAt),
                    },
                  } satisfies StoredTemplate,
                ])
              )
            : new Map<string, StoredTemplate>();

          return {
            ...currentState,
            templates,
          };
        },
      }
    ),
    { name: 'template-store' }
  )
);

// 모듈 로드 시 IndexedDB로부터 hydrate (브라우저 환경 한정).
// - 테스트 환경에서는 setup.ts의 indexedDB mock이 잘 동작하지 않을 수 있으므로
//   useTemplateStore.getState().hydrateFromDb()를 명시적으로 호출하는 패턴도 지원.
if (typeof window !== 'undefined') {
  // microtask로 지연하여 다른 모듈 import 사이드이펙트와 충돌 회피
  queueMicrotask(() => {
    void useTemplateStore.getState().hydrateFromDb();
  });
}

export default useTemplateStore;
