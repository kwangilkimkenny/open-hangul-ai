/**
 * History Context
 * React Context for HistoryManager integration
 * ✅ Phase 2 P3: React Context 기반 UI 업데이트
 *
 * @module contexts/HistoryContext
 * @version 1.0.0
 */

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * History state interface
 */
export interface HistoryState {
    /** Undo 가능 여부 */
    canUndo: boolean;
    /** Redo 가능 여부 */
    canRedo: boolean;
    /** 마지막 Undo 액션 이름 */
    undoAction: string | null;
    /** 마지막 Redo 액션 이름 */
    redoAction: string | null;
}

/**
 * Default history state
 */
const defaultState: HistoryState = {
    canUndo: false,
    canRedo: false,
    undoAction: null,
    redoAction: null
};

/**
 * History Context
 */
const HistoryContext = createContext<HistoryState>(defaultState);

/**
 * History Provider Props
 */
interface HistoryProviderProps {
    /** HWPX Viewer instance with historyManager */
    viewer: any;
    /** Child components */
    children: ReactNode;
}

/**
 * History Provider Component
 * ✅ Phase 2 P3: Provides history state to React components
 *
 * @example
 * ```tsx
 * <HistoryProvider viewer={viewerInstance}>
 *   <YourApp />
 * </HistoryProvider>
 * ```
 */
export function HistoryProvider({ viewer, children }: HistoryProviderProps) {
    const [state, setState] = useState<HistoryState>(defaultState);

    useEffect(() => {
        // viewer나 historyManager가 없으면 기본 상태 유지
        if (!viewer || !viewer.historyManager) {
            console.warn('⚠️ HistoryProvider: viewer.historyManager not found');
            return;
        }

        // ✅ HistoryManager에 React 업데이트 콜백 등록
        viewer.historyManager.onStateChange = (newState: HistoryState) => {
            setState(newState);
            console.debug('🔄 History state updated:', newState);
        };

        // 초기 상태 가져오기
        const initialState = {
            canUndo: viewer.historyManager.canUndo(),
            canRedo: viewer.historyManager.canRedo(),
            undoAction: viewer.historyManager.undoStack.length > 0
                ? viewer.historyManager.undoStack[viewer.historyManager.undoStack.length - 1]?.actionName
                : null,
            redoAction: viewer.historyManager.redoStack.length > 0
                ? viewer.historyManager.redoStack[viewer.historyManager.redoStack.length - 1]?.actionName
                : null
        };
        setState(initialState);

        // Cleanup: 콜백 제거
        return () => {
            if (viewer?.historyManager) {
                viewer.historyManager.onStateChange = null;
            }
        };
    }, [viewer]);

    return (
        <HistoryContext.Provider value={state}>
            {children}
        </HistoryContext.Provider>
    );
}

/**
 * useHistory Hook
 * ✅ Phase 2 P3: Access history state in React components
 *
 * @returns Current history state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const history = useHistory();
 *
 *   return (
 *     <button disabled={!history.canUndo}>
 *       Undo {history.undoAction || ''}
 *     </button>
 *   );
 * }
 * ```
 */
export function useHistory(): HistoryState {
    const context = useContext(HistoryContext);

    if (!context) {
        console.warn('⚠️ useHistory must be used within a HistoryProvider');
        return defaultState;
    }

    return context;
}

export default HistoryContext;
