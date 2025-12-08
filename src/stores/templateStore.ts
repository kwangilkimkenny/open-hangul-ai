/**
 * Template Store
 * 템플릿 상태 관리 (Zustand)
 * 
 * @module stores/templateStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { HWPXDocument } from '../types/hwpx';
import type {
  TemplateMetadata,
  TemplateFilter,
  TemplateGenerationResult,
} from '../types/template';
import { getLogger } from '../lib/utils/logger';

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
  lastGenerationResult: TemplateGenerationResult | null;
  
  // Actions - Template Management
  saveTemplate: (template: HWPXDocument, metadata: TemplateMetadata) => void;
  loadTemplate: (id: string) => HWPXDocument | null;
  deleteTemplate: (id: string) => void;
  updateTemplate: (id: string, template: Partial<StoredTemplate>) => void;
  
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
  duplicateTemplate: (id: string, newName?: string) => string | null;
  clearAll: () => void;
  
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
  // HWPX Document는 크기가 크므로 별도 저장
  // 실제로는 IndexedDB나 서버에 저장하고 메타데이터만 유지
  hasDocument: boolean;
  createdAt: Date;
  lastModified: Date;
  usageCount: number;
}

/**
 * 초기 상태
 */
const initialState = {
  templates: new Map<string, StoredTemplate>(),
  currentTemplate: null,
  currentMetadata: null,
  isGenerating: false,
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

        saveTemplate: (template, metadata) => {
          logger.info(`💾 템플릿 저장: ${metadata.name}`);

          const storedTemplate: StoredTemplate = {
            id: metadata.id,
            metadata,
            hasDocument: true,
            createdAt: metadata.createdAt,
            lastModified: new Date(),
            usageCount: 0,
          };

          set((state) => {
            const newTemplates = new Map(state.templates);
            newTemplates.set(metadata.id, storedTemplate);
            
            return {
              templates: newTemplates,
              currentTemplate: template,
              currentMetadata: metadata,
            };
          });

          // 실제 문서는 IndexedDB에 저장 (추후 구현)
          // saveToIndexedDB(metadata.id, template);
          
          logger.info(`✅ 템플릿 저장 완료: ${metadata.id}`);
        },

        loadTemplate: (id) => {
          logger.info(`📂 템플릿 로드: ${id}`);

          const stored = get().templates.get(id);
          if (!stored) {
            logger.warn(`❌ 템플릿을 찾을 수 없음: ${id}`);
            return null;
          }

          // 사용 횟수 증가
          get().updateTemplate(id, {
            usageCount: stored.usageCount + 1,
            lastModified: new Date(),
          });

          // 실제 문서는 IndexedDB에서 로드 (추후 구현)
          // const template = await loadFromIndexedDB(id);
          
          logger.info(`✅ 템플릿 로드 완료: ${id}`);
          return null; // 임시: 실제로는 IndexedDB에서 로드한 문서 반환
        },

        deleteTemplate: (id) => {
          logger.info(`🗑️ 템플릿 삭제: ${id}`);

          set((state) => {
            const newTemplates = new Map(state.templates);
            newTemplates.delete(id);
            
            return {
              templates: newTemplates,
              currentTemplate: state.currentMetadata?.id === id ? null : state.currentTemplate,
              currentMetadata: state.currentMetadata?.id === id ? null : state.currentMetadata,
            };
          });

          // IndexedDB에서도 삭제 (추후 구현)
          // deleteFromIndexedDB(id);
          
          logger.info(`✅ 템플릿 삭제 완료: ${id}`);
        },

        updateTemplate: (id, updates) => {
          set((state) => {
            const newTemplates = new Map(state.templates);
            const existing = newTemplates.get(id);
            
            if (existing) {
              newTemplates.set(id, { ...existing, ...updates });
            }
            
            return { templates: newTemplates };
          });
        },

        // =============================================
        // Template List
        // =============================================

        listTemplates: (filter) => {
          const templates = Array.from(get().templates.values()).map(t => t.metadata);

          if (!filter) {
            return templates.sort((a, b) => 
              b.createdAt.getTime() - a.createdAt.getTime()
            );
          }

          let filtered = templates;

          // 검색 쿼리
          if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
              t.name.toLowerCase().includes(query) ||
              t.description?.toLowerCase().includes(query) ||
              t.tags?.some(tag => tag.toLowerCase().includes(query))
            );
          }

          // 태그 필터
          if (filter.tags && filter.tags.length > 0) {
            filtered = filtered.filter(t =>
              t.tags?.some(tag => filter.tags!.includes(tag))
            );
          }

          // 카테고리 필터
          if (filter.category) {
            filtered = filtered.filter(t => t.category === filter.category);
          }

          // 표 포함 여부
          if (filter.hasTable !== undefined) {
            filtered = filtered.filter(t => 
              t.structure.hasTables === filter.hasTable
            );
          }

          // 이미지 포함 여부
          if (filter.hasImage !== undefined) {
            filtered = filtered.filter(t => 
              t.structure.hasImages === filter.hasImage
            );
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
                case 'usage':
                  const aUsage = get().templates.get(a.id)?.usageCount || 0;
                  const bUsage = get().templates.get(b.id)?.usageCount || 0;
                  return order * (bUsage - aUsage);
                default:
                  return 0;
              }
            });
          }

          return filtered;
        },

        getTemplateById: (id) => {
          return get().templates.get(id) || null;
        },

        searchTemplates: (query) => {
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

        setGenerating: (generating) => {
          set({ isGenerating: generating });
        },

        setLastGenerationResult: (result) => {
          set({ lastGenerationResult: result });
        },

        // =============================================
        // Utility
        // =============================================

        exportTemplate: async (id) => {
          logger.info(`📤 템플릿 내보내기: ${id}`);
          
          const stored = get().templates.get(id);
          if (!stored) {
            throw new Error(`템플릿을 찾을 수 없습니다: ${id}`);
          }

          // HWPXExporter를 사용하여 파일로 내보내기
          // 실제 구현은 컴포넌트에서 수행
          logger.info(`✅ 템플릿 내보내기 준비 완료: ${id}`);
        },

        duplicateTemplate: (id, newName) => {
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

          set((state) => {
            const newTemplates = new Map(state.templates);
            newTemplates.set(newId, newTemplate);
            return { templates: newTemplates };
          });

          logger.info(`✅ 템플릿 복제 완료: ${newId}`);
          return newId;
        },

        clearAll: () => {
          logger.warn('🗑️ 모든 템플릿 삭제');
          set({
            ...initialState,
            templates: new Map(),
          });
        },

        // =============================================
        // Computed / Getters
        // =============================================

        getTemplateCount: () => {
          return get().templates.size;
        },

        hasTemplate: (id) => {
          return get().templates.has(id);
        },

        getTemplatesByTag: (tag) => {
          return get().listTemplates({ tags: [tag] });
        },

        getTemplatesByCategory: (category) => {
          return get().listTemplates({ category });
        },
      }),
      {
        name: 'template-store',
        partialize: (state) => ({
          // templates Map은 직렬화 불가능하므로 배열로 변환
          templates: Array.from(state.templates.entries()),
        }),
        // 역직렬화: 배열을 다시 Map으로 변환
        merge: (persistedState: any, currentState) => {
          const templates = persistedState.templates
            ? new Map(persistedState.templates.map((t: [string, StoredTemplate]) => {
                // Date 객체 복원
                const stored = t[1];
                return [
                  t[0],
                  {
                    ...stored,
                    createdAt: new Date(stored.createdAt),
                    lastModified: new Date(stored.lastModified),
                    metadata: {
                      ...stored.metadata,
                      createdAt: new Date(stored.metadata.createdAt),
                    },
                  },
                ];
              }))
            : new Map();

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

export default useTemplateStore;

