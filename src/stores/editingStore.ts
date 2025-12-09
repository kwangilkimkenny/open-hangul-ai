/**
 * Editing Store
 * 문서 인라인 편집 상태 관리 (Zustand)
 * 
 * @module stores/editingStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useDocumentStore } from './documentStore';
import { getLogger } from '../lib/utils/logger';

const logger = getLogger();

export type EditingType = 'cell' | 'paragraph';

export interface EditingPath {
  type: EditingType;
  section: number;
  element?: number;  // For paragraphs
  table?: number;    // For cells
  row?: number;      // For cells
  cell?: number;     // For cells
}

export interface EditingState {
  // State
  isEditing: boolean;
  editingPath: EditingPath | null;
  editingContent: string;
  originalContent: string;
  
  // Actions
  startEditing: (path: EditingPath, content: string) => void;
  updateContent: (content: string) => void;
  endEditing: () => void;
  cancelEditing: () => void;
  
  // Getters
  isEditingAt: (path: EditingPath) => boolean;
}

export const useEditingStore = create<EditingState>()(
  devtools(
    (set, get) => ({
      // Initial State
      isEditing: false,
      editingPath: null,
      editingContent: '',
      originalContent: '',
      
      // Actions
      startEditing: (path, content) => {
        logger.info('✏️ 편집 시작:', path);
        set({
          isEditing: true,
          editingPath: path,
          editingContent: content,
          originalContent: content,
        });
      },
      
      updateContent: (content) => {
        set({ editingContent: content });
      },
      
      endEditing: () => {
        const { editingPath, editingContent, originalContent } = get();
        
        if (!editingPath) {
          logger.warn('⚠️ 편집 중인 항목이 없습니다.');
          return;
        }
        
        // 내용이 변경되었는지 확인
        if (editingContent !== originalContent) {
          logger.info('💾 편집 완료 - 문서 업데이트:', editingPath);
          
          const documentStore = useDocumentStore.getState();
          
          // 타입에 따라 문서 업데이트
          if (editingPath.type === 'cell') {
            documentStore.updateCellText({
              section: editingPath.section,
              table: editingPath.table!,
              row: editingPath.row!,
              cell: editingPath.cell!,
            }, editingContent);
          } else if (editingPath.type === 'paragraph') {
            documentStore.updateParagraphText(
              editingPath.section,
              editingPath.element!,
              editingContent
            );
          }
          
          // Dirty 상태로 설정 (Auto-save 트리거)
          documentStore.setDirty(true);
        } else {
          logger.info('ℹ️ 편집 완료 - 변경 사항 없음');
        }
        
        // 편집 상태 초기화
        set({
          isEditing: false,
          editingPath: null,
          editingContent: '',
          originalContent: '',
        });
      },
      
      cancelEditing: () => {
        logger.info('❌ 편집 취소');
        set({
          isEditing: false,
          editingPath: null,
          editingContent: '',
          originalContent: '',
        });
      },
      
      // Getters
      isEditingAt: (path) => {
        const { isEditing, editingPath } = get();
        if (!isEditing || !editingPath) return false;
        
        if (path.type !== editingPath.type) return false;
        if (path.section !== editingPath.section) return false;
        
        if (path.type === 'cell') {
          return (
            path.table === editingPath.table &&
            path.row === editingPath.row &&
            path.cell === editingPath.cell
          );
        } else if (path.type === 'paragraph') {
          return path.element === editingPath.element;
        }
        
        return false;
      },
    }),
    { name: 'EditingStore' }
  )
);

