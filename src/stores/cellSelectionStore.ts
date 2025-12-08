/**
 * Cell Selection Store
 * 셀 선택 상태 관리
 * 
 * @module stores/cellSelectionStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { 
  CellSelection, 
  SelectionMode, 
  CellRole,
  SelectionContext 
} from '../types/cell-selection';
import { makeCellKey } from '../types/cell-selection';
import { getLogger } from '../lib/utils/logger';

const logger = getLogger();

interface CellSelectionState {
  // 상태
  mode: SelectionMode;
  
  // Actions - 모드 제어
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  
  // Actions - 셀 선택
  toggleCell: (selection: Omit<CellSelection, 'role' | 'timestamp'>) => void;
  setCellRole: (key: string, role: CellRole) => void;
  selectMultiple: (selections: CellSelection[]) => void;
  
  // Actions - 대량 작업
  selectAll: (role: CellRole) => void;
  clearSelections: () => void;
  invertSelection: () => void;
  
  // Actions - 자동 감지
  autoDetectHeaders: () => void;
  
  // Queries
  getSelection: (key: string) => CellSelection | undefined;
  getSelectedCells: () => CellSelection[];
  getKeepCells: () => CellSelection[];
  getGenerateCells: () => CellSelection[];
  getCellsByRole: (role: CellRole) => CellSelection[];
  
  // 통계
  getStats: () => {
    total: number;
    keep: number;
    generate: number;
    unselected: number;
  };
  
  // 맥락 생성
  buildContext: () => SelectionContext;
}

export const useCellSelectionStore = create<CellSelectionState>()(
  devtools(
    (set, get) => ({
      // Initial State
      mode: {
        isActive: false,
        selections: new Map(),
        defaultRole: 'keep',
        showTooltips: true,
        highlightRelated: true
      },
      
      // ==========================================
      // 모드 제어
      // ==========================================
      
      enterSelectionMode: () => {
        logger.info('🎯 셀 선택 모드 시작');
        set((state) => ({
          mode: {
            ...state.mode,
            isActive: true,
            selections: new Map()  // 초기화
          }
        }));
      },
      
      exitSelectionMode: () => {
        logger.info('🎯 셀 선택 모드 종료');
        set((state) => ({
          mode: {
            ...state.mode,
            isActive: false,
            selections: new Map()
          }
        }));
      },
      
      // ==========================================
      // 셀 선택
      // ==========================================
      
      toggleCell: (selection) => {
        const key = makeCellKey(
          selection.section,
          selection.table,
          selection.row,
          selection.col
        );
        
        set((state) => {
          const newSelections = new Map(state.mode.selections);
          
          if (newSelections.has(key)) {
            const existing = newSelections.get(key)!;
            
            // 토글 순서: unselected → keep → generate → unselected
            if (existing.role === 'keep') {
              newSelections.set(key, {
                ...existing,
                ...selection,
                role: 'generate',
                timestamp: Date.now()
              });
              logger.debug(`🔄 Cell ${key}: keep → generate`);
            } else if (existing.role === 'generate') {
              newSelections.delete(key);
              logger.debug(`🔄 Cell ${key}: generate → unselected`);
            } else {
              newSelections.set(key, {
                ...existing,
                ...selection,
                role: 'keep',
                timestamp: Date.now()
              });
              logger.debug(`🔄 Cell ${key}: unselected → keep`);
            }
          } else {
            // 새로 선택: keep으로 시작
            newSelections.set(key, {
              ...selection,
              isHeader: selection.isHeader ?? false,
              role: 'keep',
              timestamp: Date.now()
            });
            logger.debug(`✅ Cell ${key} selected as: keep`);
          }
          
          return {
            mode: {
              ...state.mode,
              selections: newSelections
            }
          };
        });
      },
      
      setCellRole: (key, role) => {
        set((state) => {
          const newSelections = new Map(state.mode.selections);
          const existing = newSelections.get(key);
          
          if (existing) {
            newSelections.set(key, {
              ...existing,
              role,
              timestamp: Date.now()
            });
          }
          
          return {
            mode: {
              ...state.mode,
              selections: newSelections
            }
          };
        });
      },
      
      selectMultiple: (selections) => {
        set((state) => {
          const newSelections = new Map(state.mode.selections);
          
          selections.forEach(sel => {
            const key = makeCellKey(sel.section, sel.table, sel.row, sel.col);
            newSelections.set(key, {
              ...sel,
              timestamp: Date.now()
            });
          });
          
          logger.info(`✅ ${selections.length}개 셀 일괄 선택`);
          
          return {
            mode: {
              ...state.mode,
              selections: newSelections
            }
          };
        });
      },
      
      // ==========================================
      // 대량 작업
      // ==========================================
      
      selectAll: (role) => {
        set((state) => {
          const newSelections = new Map(state.mode.selections);
          
          newSelections.forEach((sel, key) => {
            newSelections.set(key, {
              ...sel,
              role,
              timestamp: Date.now()
            });
          });
          
          logger.info(`✅ 모든 셀을 ${role}로 변경`);
          
          return {
            mode: {
              ...state.mode,
              selections: newSelections
            }
          };
        });
      },
      
      clearSelections: () => {
        logger.info('🗑️  모든 선택 초기화');
        set((state) => ({
          mode: {
            ...state.mode,
            selections: new Map()
          }
        }));
      },
      
      invertSelection: () => {
        set((state) => {
          const newSelections = new Map(state.mode.selections);
          
          newSelections.forEach((sel, key) => {
            const newRole = sel.role === 'keep' ? 'generate' : 'keep';
            newSelections.set(key, {
              ...sel,
              role: newRole,
              timestamp: Date.now()
            });
          });
          
          logger.info('🔄 선택 반전 완료');
          
          return {
            mode: {
              ...state.mode,
              selections: newSelections
            }
          };
        });
      },
      
      // ==========================================
      // 자동 감지
      // ==========================================
      
      autoDetectHeaders: () => {
        // 이 기능은 document 접근이 필요하므로
        // 실제 구현은 별도 함수에서 수행
        logger.info('🤖 자동 헤더 감지 시작...');
      },
      
      // ==========================================
      // Queries
      // ==========================================
      
      getSelection: (key) => {
        return get().mode.selections.get(key);
      },
      
      getSelectedCells: () => {
        return Array.from(get().mode.selections.values());
      },
      
      getKeepCells: () => {
        return Array.from(get().mode.selections.values())
          .filter(sel => sel.role === 'keep');
      },
      
      getGenerateCells: () => {
        return Array.from(get().mode.selections.values())
          .filter(sel => sel.role === 'generate');
      },
      
      getCellsByRole: (role) => {
        return Array.from(get().mode.selections.values())
          .filter(sel => sel.role === role);
      },
      
      // ==========================================
      // 통계
      // ==========================================
      
      getStats: () => {
        const selections = Array.from(get().mode.selections.values());
        return {
          total: selections.length,
          keep: selections.filter(s => s.role === 'keep').length,
          generate: selections.filter(s => s.role === 'generate').length,
          unselected: 0  // 선택되지 않은 셀은 Map에 없음
        };
      },
      
      // ==========================================
      // 맥락 생성
      // ==========================================
      
      buildContext: () => {
        const selections = get().getSelectedCells();
        const headers = selections.filter(s => s.role === 'keep');
        
        // 행별 그룹화
        const rowHeaders = new Map<number, CellSelection[]>();
        headers.forEach(h => {
          if (!rowHeaders.has(h.row)) {
            rowHeaders.set(h.row, []);
          }
          rowHeaders.get(h.row)!.push(h);
        });
        
        // 열별 그룹화
        const colHeaders = new Map<number, CellSelection[]>();
        headers.forEach(h => {
          if (!colHeaders.has(h.col)) {
            colHeaders.set(h.col, []);
          }
          colHeaders.get(h.col)!.push(h);
        });
        
        // 패턴 감지
        let pattern: SelectionContext['pattern'] = 'free-form';
        
        // 행-헤더-내용 패턴 (각 행에 헤더 1개 + 내용 여러 개)
        const hasRowPattern = Array.from(rowHeaders.values()).every(
          row => row.length >= 1 && row[0].col === 0
        );
        if (hasRowPattern) pattern = 'row-header-content';
        
        // 열-헤더-내용 패턴
        const hasColPattern = Array.from(colHeaders.values()).every(
          col => col.length >= 1 && col[0].row === 0
        );
        if (hasColPattern) pattern = 'col-header-content';
        
        // 매트릭스 패턴 (행 헤더 + 열 헤더)
        if (hasRowPattern && hasColPattern) pattern = 'matrix';
        
        logger.info(`📊 맥락 패턴: ${pattern}`);
        
        return {
          headers,
          rowHeaders,
          colHeaders,
          pattern
        };
      }
    }),
    { name: 'cell-selection-store' }
  )
);

export default useCellSelectionStore;

