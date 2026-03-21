import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UndoRedoButtons } from './UndoRedoButtons';
import type { HistoryState } from '../contexts/HistoryContext';

// Mock the useHistory hook from HistoryContext
let mockHistoryState: HistoryState = {
  canUndo: false,
  canRedo: false,
  undoAction: null,
  redoAction: null,
};

vi.mock('../contexts/HistoryContext', () => ({
  useHistory: () => mockHistoryState,
}));

function createMockViewer(overrides = {}) {
  return {
    container: document.createElement('div'),
    loadFile: vi.fn(),
    getDocument: vi.fn(),
    destroy: vi.fn(),
    historyManager: {
      undo: vi.fn(),
      redo: vi.fn(),
    },
    ...overrides,
  };
}

describe('UndoRedoButtons', () => {
  // 1. Renders undo and redo buttons
  it('renders undo and redo buttons', () => {
    const viewer = createMockViewer();
    render(<UndoRedoButtons viewer={viewer as any} />);

    expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    expect(screen.getByLabelText('Redo')).toBeInTheDocument();
  });

  // 2. Undo button disabled when canUndo is false
  it('undo button is disabled when canUndo is false', () => {
    mockHistoryState = { canUndo: false, canRedo: false, undoAction: null, redoAction: null };
    const viewer = createMockViewer();
    render(<UndoRedoButtons viewer={viewer as any} />);

    expect(screen.getByLabelText('Undo')).toBeDisabled();
  });

  // 3. Redo button disabled when canRedo is false
  it('redo button is disabled when canRedo is false', () => {
    mockHistoryState = { canUndo: false, canRedo: false, undoAction: null, redoAction: null };
    const viewer = createMockViewer();
    render(<UndoRedoButtons viewer={viewer as any} />);

    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  // 4. Undo button click calls handler
  it('undo button click calls historyManager.undo', () => {
    mockHistoryState = { canUndo: true, canRedo: false, undoAction: 'Edit text', redoAction: null };
    const viewer = createMockViewer();
    render(<UndoRedoButtons viewer={viewer as any} />);

    fireEvent.click(screen.getByLabelText('Undo'));
    expect(viewer.historyManager.undo).toHaveBeenCalled();
  });

  // 5. Redo button click calls handler
  it('redo button click calls historyManager.redo', () => {
    mockHistoryState = { canUndo: false, canRedo: true, undoAction: null, redoAction: 'Edit text' };
    const viewer = createMockViewer();
    render(<UndoRedoButtons viewer={viewer as any} />);

    fireEvent.click(screen.getByLabelText('Redo'));
    expect(viewer.historyManager.redo).toHaveBeenCalled();
  });

  // 6. Buttons enabled when actions available
  it('buttons are enabled when undo/redo actions are available', () => {
    mockHistoryState = { canUndo: true, canRedo: true, undoAction: 'Type', redoAction: 'Delete' };
    const viewer = createMockViewer();
    render(<UndoRedoButtons viewer={viewer as any} />);

    expect(screen.getByLabelText('Undo')).not.toBeDisabled();
    expect(screen.getByLabelText('Redo')).not.toBeDisabled();
  });
});
