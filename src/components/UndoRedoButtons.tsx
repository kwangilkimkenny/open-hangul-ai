/**
 * Undo/Redo Buttons Component
 * Example component demonstrating HistoryContext usage
 * ✅ Phase 2 P3: React Context 기반 UI 업데이트
 *
 * @module components/UndoRedoButtons
 * @version 1.0.0
 */

import { memo, useCallback } from 'react';
import { useHistory } from '../contexts/HistoryContext';
import type { HWPXViewerInstance } from '../types/viewer';

/**
 * UndoRedoButtons Props
 */
interface UndoRedoButtonsProps {
  /** HWPX Viewer instance with historyManager */
  viewer: HWPXViewerInstance | null;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Undo/Redo Buttons Component
 * ✅ Phase 2 P3: Uses HistoryContext for reactive updates
 *
 * @example
 * ```tsx
 * <HistoryProvider viewer={viewerInstance}>
 *   <UndoRedoButtons viewer={viewerInstance} />
 * </HistoryProvider>
 * ```
 */
export const UndoRedoButtons = memo(function UndoRedoButtons({ viewer, className = '' }: UndoRedoButtonsProps) {
  // ✅ Use history context
  const history = useHistory();

  // Handler functions
  const handleUndo = useCallback(() => {
    if (viewer?.historyManager) {
      viewer.historyManager.undo();
    }
  }, [viewer]);

  const handleRedo = useCallback(() => {
    if (viewer?.historyManager) {
      viewer.historyManager.redo();
    }
  }, [viewer]);

  return (
    <div className={`history-buttons ${className}`}>
      <button
        className="undo-btn"
        disabled={!history.canUndo}
        onClick={handleUndo}
        title={history.undoAction ? `실행 취소: ${history.undoAction}` : '실행 취소할 항목 없음'}
        aria-label="Undo"
      >
        <span className="icon">↶</span>
        <span className="label">Undo</span>
        {history.undoAction && <span className="action-name"> ({history.undoAction})</span>}
      </button>

      <button
        className="redo-btn"
        disabled={!history.canRedo}
        onClick={handleRedo}
        title={history.redoAction ? `다시 실행: ${history.redoAction}` : '다시 실행할 항목 없음'}
        aria-label="Redo"
      >
        <span className="icon">↷</span>
        <span className="label">Redo</span>
        {history.redoAction && <span className="action-name"> ({history.redoAction})</span>}
      </button>
    </div>
  );
});

/**
 * Compact Undo/Redo Buttons (icons only)
 * ✅ Phase 2 P3: Minimal UI variant
 */
export const UndoRedoButtonsCompact = memo(function UndoRedoButtonsCompact({ viewer, className = '' }: UndoRedoButtonsProps) {
  const history = useHistory();

  const handleUndo = useCallback(() => {
    if (viewer?.historyManager) {
      viewer.historyManager.undo();
    }
  }, [viewer]);

  const handleRedo = useCallback(() => {
    if (viewer?.historyManager) {
      viewer.historyManager.redo();
    }
  }, [viewer]);

  return (
    <div className={`history-buttons-compact ${className}`}>
      <button
        className="undo-btn-compact"
        disabled={!history.canUndo}
        onClick={handleUndo}
        title={history.undoAction ? `실행 취소: ${history.undoAction}` : '실행 취소할 항목 없음'}
        aria-label="Undo"
      >
        ↶
      </button>

      <button
        className="redo-btn-compact"
        disabled={!history.canRedo}
        onClick={handleRedo}
        title={history.redoAction ? `다시 실행: ${history.redoAction}` : '다시 실행할 항목 없음'}
        aria-label="Redo"
      >
        ↷
      </button>
    </div>
  );
});

/**
 * History Status Display
 * ✅ Phase 2 P3: Shows current history state
 */
export function HistoryStatus({ className = '' }: { className?: string }) {
  const history = useHistory();

  return (
    <div className={`history-status ${className}`}>
      <span className="status-item">
        <span className="status-label">Undo:</span>
        <span className={`status-value ${history.canUndo ? 'enabled' : 'disabled'}`}>
          {history.canUndo ? history.undoAction || '가능' : '불가'}
        </span>
      </span>

      <span className="status-item">
        <span className="status-label">Redo:</span>
        <span className={`status-value ${history.canRedo ? 'enabled' : 'disabled'}`}>
          {history.canRedo ? history.redoAction || '가능' : '불가'}
        </span>
      </span>
    </div>
  );
}

export default UndoRedoButtons;
