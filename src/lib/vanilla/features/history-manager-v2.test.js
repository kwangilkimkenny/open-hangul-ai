/**
 * HistoryManagerV2 Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

import { HistoryManagerV2 } from './history-manager-v2.js';

describe('HistoryManagerV2', () => {
  let manager;
  let viewer;

  beforeEach(() => {
    viewer = {};
    manager = new HistoryManagerV2(viewer);

    // Set up DOM buttons for _updateUI tests
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // 1. Constructor initializes empty stacks
  it('should initialize with empty stacks', () => {
    expect(manager.undoStack).toEqual([]);
    expect(manager.redoStack).toEqual([]);
    expect(manager.maxHistory).toBe(50);
    expect(manager.isExecuting).toBe(false);
    expect(manager.batchMode).toBe(false);
    expect(manager.onStateChange).toBeNull();
  });

  // 2. execute() runs function and adds to undo stack
  it('should run execute function and add to undo stack', () => {
    const executeFn = vi.fn();
    const undoFn = vi.fn();

    manager.execute(executeFn, undoFn, 'Test Action');

    expect(executeFn).toHaveBeenCalledOnce();
    expect(undoFn).not.toHaveBeenCalled();
    expect(manager.undoStack).toHaveLength(1);
    expect(manager.undoStack[0].actionName).toBe('Test Action');
  });

  // 3. execute() clears redo stack
  it('should clear redo stack on execute', () => {
    const exec1 = vi.fn();
    const undo1 = vi.fn();
    const exec2 = vi.fn();
    const undo2 = vi.fn();

    manager.execute(exec1, undo1, 'Action 1');
    manager.undo(); // Move to redo stack
    expect(manager.redoStack).toHaveLength(1);

    manager.execute(exec2, undo2, 'Action 2');
    expect(manager.redoStack).toHaveLength(0);
  });

  // 4. undo() reverses last action, returns true
  it('should undo last action and return true', () => {
    const executeFn = vi.fn();
    const undoFn = vi.fn();

    manager.execute(executeFn, undoFn, 'Action');
    const result = manager.undo();

    expect(result).toBe(true);
    expect(undoFn).toHaveBeenCalledOnce();
    expect(manager.undoStack).toHaveLength(0);
    expect(manager.redoStack).toHaveLength(1);
  });

  // 5. undo() on empty stack returns false
  it('should return false when undo stack is empty', () => {
    const result = manager.undo();
    expect(result).toBe(false);
  });

  // 6. redo() re-applies action, returns true
  it('should redo action and return true', () => {
    const executeFn = vi.fn();
    const undoFn = vi.fn();

    manager.execute(executeFn, undoFn, 'Action');
    manager.undo();
    const result = manager.redo();

    expect(result).toBe(true);
    expect(executeFn).toHaveBeenCalledTimes(2); // once on execute, once on redo
    expect(manager.undoStack).toHaveLength(1);
    expect(manager.redoStack).toHaveLength(0);
  });

  // 7. redo() on empty stack returns false
  it('should return false when redo stack is empty', () => {
    const result = manager.redo();
    expect(result).toBe(false);
  });

  // 8. Multiple execute -> undo -> redo sequence
  it('should handle multiple execute, undo, redo sequence correctly', () => {
    const actions = [];
    for (let i = 0; i < 3; i++) {
      const execFn = vi.fn(() => actions.push(`exec-${i}`));
      const undoFn = vi.fn(() => actions.push(`undo-${i}`));
      manager.execute(execFn, undoFn, `Action ${i}`);
    }

    expect(manager.undoStack).toHaveLength(3);

    manager.undo(); // undo Action 2
    manager.undo(); // undo Action 1
    expect(manager.undoStack).toHaveLength(1);
    expect(manager.redoStack).toHaveLength(2);

    manager.redo(); // redo Action 1
    expect(manager.undoStack).toHaveLength(2);
    expect(manager.redoStack).toHaveLength(1);
  });

  // 9. Max history limit (51 executes -> stack size stays 50)
  it('should enforce max history limit of 50', () => {
    for (let i = 0; i < 51; i++) {
      manager.execute(vi.fn(), vi.fn(), `Action ${i}`);
    }

    expect(manager.undoStack).toHaveLength(50);
    // The first action should have been removed
    expect(manager.undoStack[0].actionName).toBe('Action 1');
  });

  // 10. clear() empties both stacks
  it('should clear both stacks', () => {
    manager.execute(vi.fn(), vi.fn(), 'A');
    manager.execute(vi.fn(), vi.fn(), 'B');
    manager.undo();

    expect(manager.undoStack.length).toBeGreaterThan(0);
    expect(manager.redoStack.length).toBeGreaterThan(0);

    manager.clear();

    expect(manager.undoStack).toHaveLength(0);
    expect(manager.redoStack).toHaveLength(0);
  });

  // 11. canUndo/canRedo state tracking
  it('should track canUndo and canRedo correctly', () => {
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);

    manager.execute(vi.fn(), vi.fn(), 'A');
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    manager.undo();
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);
  });

  // 12. getStats() returns correct info
  it('should return correct stats', () => {
    manager.execute(vi.fn(), vi.fn(), 'First');
    manager.execute(vi.fn(), vi.fn(), 'Second');
    manager.undo();

    const stats = manager.getStats();
    expect(stats.undoCount).toBe(1);
    expect(stats.redoCount).toBe(1);
    expect(stats.canUndo).toBe(true);
    expect(stats.canRedo).toBe(true);
    expect(stats.lastAction).toBe('First');
  });

  // 13. getHistory() returns action names/timestamps
  it('should return history with action names and timestamps', () => {
    manager.execute(vi.fn(), vi.fn(), 'Alpha');
    manager.execute(vi.fn(), vi.fn(), 'Beta');
    manager.undo();

    const history = manager.getHistory();
    expect(history.undoList).toHaveLength(1);
    expect(history.undoList[0].actionName).toBe('Alpha');
    expect(history.undoList[0].timestamp).toBeTypeOf('number');

    expect(history.redoList).toHaveLength(1);
    expect(history.redoList[0].actionName).toBe('Beta');
    expect(history.redoList[0].timestamp).toBeTypeOf('number');
  });

  // 14. Batch mode: _updateUI not called during batch
  it('should not call _updateUI during batch mode', () => {
    const updateUISpy = vi.spyOn(manager, '_updateUI');

    manager.startBatchUndo();
    expect(manager.batchMode).toBe(true);

    manager.execute(vi.fn(), vi.fn(), 'A');
    // execute always calls _updateUI, but undo/redo skip it in batch mode
    updateUISpy.mockClear();

    manager.undo();
    // During batch mode, _updateUI should NOT be called from undo
    expect(updateUISpy).not.toHaveBeenCalled();
  });

  // 15. Batch mode: endBatchUndo calls _updateUI once
  it('should call _updateUI once when ending batch', () => {
    manager.execute(vi.fn(), vi.fn(), 'A');
    manager.execute(vi.fn(), vi.fn(), 'B');
    manager.execute(vi.fn(), vi.fn(), 'C');

    const updateUISpy = vi.spyOn(manager, '_updateUI');

    manager.startBatchUndo();
    manager.undo();
    manager.undo();
    manager.endBatchUndo();

    // _updateUI should be called exactly once (by endBatchUndo)
    expect(updateUISpy).toHaveBeenCalledOnce();
  });

  // 16. onStateChange callback invoked on state changes
  it('should invoke onStateChange callback on state changes', () => {
    const stateChangeSpy = vi.fn();
    manager.onStateChange = stateChangeSpy;

    manager.execute(vi.fn(), vi.fn(), 'Action');

    expect(stateChangeSpy).toHaveBeenCalledWith({
      canUndo: true,
      canRedo: false,
      undoAction: 'Action',
      redoAction: null,
    });
  });

  // 17. Nested execute during isExecuting skips history push
  it('should skip history push for nested execute during isExecuting', () => {
    const nestedExec = vi.fn();
    const outerExec = vi.fn(() => {
      // This nested execute should run the function but NOT push to history
      manager.execute(nestedExec, vi.fn(), 'Nested');
    });

    manager.execute(outerExec, vi.fn(), 'Outer');

    expect(outerExec).toHaveBeenCalled();
    expect(nestedExec).toHaveBeenCalled();
    // Only the outer action should be in the undo stack
    expect(manager.undoStack).toHaveLength(1);
    expect(manager.undoStack[0].actionName).toBe('Outer');
  });

  // 18. Error in undo function returns false
  it('should return false when undo function throws error', () => {
    const errorUndo = vi.fn(() => { throw new Error('Undo failed'); });
    manager.execute(vi.fn(), errorUndo, 'BadAction');

    const result = manager.undo();
    expect(result).toBe(false);
    // isExecuting should be reset even after error
    expect(manager.isExecuting).toBe(false);
  });

  // 19. Error in redo function returns false
  it('should return false when redo/execute function throws on redo', () => {
    let callCount = 0;
    const errorExec = vi.fn(() => {
      callCount++;
      if (callCount > 1) throw new Error('Redo failed');
    });
    manager.execute(errorExec, vi.fn(), 'BadAction');
    manager.undo();

    const result = manager.redo();
    expect(result).toBe(false);
    expect(manager.isExecuting).toBe(false);
  });

  // 20. _updateUI updates DOM buttons
  it('should update DOM undo/redo buttons', () => {
    const undoBtn = document.createElement('button');
    undoBtn.id = 'undo-btn';
    document.body.appendChild(undoBtn);

    const redoBtn = document.createElement('button');
    redoBtn.id = 'redo-btn';
    document.body.appendChild(redoBtn);

    // Initially both should be disabled after clear
    manager.clear();
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);

    // After execute, undo should be enabled
    manager.execute(vi.fn(), vi.fn(), 'Action');
    expect(undoBtn.disabled).toBe(false);
    expect(redoBtn.disabled).toBe(true);

    // After undo, redo should be enabled
    manager.undo();
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(false);
  });
});
