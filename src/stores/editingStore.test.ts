import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// Mock logger before importing the store
vi.mock('../lib/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock documentStore so we can spy on its methods
const mockUpdateCellText = vi.fn();
const mockUpdateParagraphText = vi.fn();
const mockSetDirty = vi.fn();

vi.mock('./documentStore', () => ({
  useDocumentStore: {
    getState: () => ({
      updateCellText: mockUpdateCellText,
      updateParagraphText: mockUpdateParagraphText,
      setDirty: mockSetDirty,
    }),
  },
}));

import { useEditingStore } from './editingStore';
import type { EditingPath } from './editingStore';

describe('useEditingStore', () => {
  beforeEach(() => {
    act(() => {
      useEditingStore.getState().cancelEditing();
    });
    vi.clearAllMocks();
  });

  const cellPath: EditingPath = {
    type: 'cell',
    section: 0,
    table: 1,
    row: 2,
    cell: 3,
  };

  const paragraphPath: EditingPath = {
    type: 'paragraph',
    section: 0,
    element: 1,
  };

  // 1. Initial state
  it('has initial state not editing', () => {
    const state = useEditingStore.getState();
    expect(state.isEditing).toBe(false);
    expect(state.editingPath).toBeNull();
    expect(state.editingContent).toBe('');
    expect(state.originalContent).toBe('');
  });

  // 2. startEditing
  it('startEditing activates editing mode', () => {
    act(() => {
      useEditingStore.getState().startEditing(cellPath, 'hello');
    });

    const state = useEditingStore.getState();
    expect(state.isEditing).toBe(true);
    expect(state.editingPath).toEqual(cellPath);
    expect(state.editingContent).toBe('hello');
    expect(state.originalContent).toBe('hello');
  });

  // 3. updateContent
  it('updateContent changes editingContent', () => {
    act(() => {
      useEditingStore.getState().startEditing(cellPath, 'original');
      useEditingStore.getState().updateContent('modified');
    });

    expect(useEditingStore.getState().editingContent).toBe('modified');
    // originalContent should stay the same
    expect(useEditingStore.getState().originalContent).toBe('original');
  });

  // 4. endEditing resets state
  it('endEditing resets editing state', () => {
    act(() => {
      useEditingStore.getState().startEditing(cellPath, 'text');
      useEditingStore.getState().updateContent('changed');
      useEditingStore.getState().endEditing();
    });

    const state = useEditingStore.getState();
    expect(state.isEditing).toBe(false);
    expect(state.editingPath).toBeNull();
    expect(state.editingContent).toBe('');
  });

  // 5. endEditing with no path does nothing
  it('endEditing with no editing path does nothing', () => {
    act(() => {
      useEditingStore.getState().endEditing();
    });

    expect(mockUpdateCellText).not.toHaveBeenCalled();
    expect(mockUpdateParagraphText).not.toHaveBeenCalled();
  });

  // 6. cancelEditing
  it('cancelEditing resets state without saving', () => {
    act(() => {
      useEditingStore.getState().startEditing(cellPath, 'original');
      useEditingStore.getState().updateContent('changed');
      useEditingStore.getState().cancelEditing();
    });

    const state = useEditingStore.getState();
    expect(state.isEditing).toBe(false);
    expect(state.editingPath).toBeNull();
    expect(mockUpdateCellText).not.toHaveBeenCalled();
  });

  // 7. isEditingAt returns true for matching path
  it('isEditingAt returns true for matching cell path', () => {
    act(() => {
      useEditingStore.getState().startEditing(cellPath, 'text');
    });

    const result = useEditingStore.getState().isEditingAt(cellPath);
    expect(result).toBe(true);
  });

  // 8. isEditingAt returns false for non-matching path
  it('isEditingAt returns false for non-matching path', () => {
    act(() => {
      useEditingStore.getState().startEditing(cellPath, 'text');
    });

    const differentPath: EditingPath = {
      type: 'cell',
      section: 0,
      table: 1,
      row: 2,
      cell: 99,
    };
    expect(useEditingStore.getState().isEditingAt(differentPath)).toBe(false);

    // Different type
    expect(useEditingStore.getState().isEditingAt(paragraphPath)).toBe(false);
  });

  // 9. endEditing with unchanged content does not update document
  it('endEditing with unchanged content does not call document updates', () => {
    act(() => {
      useEditingStore.getState().startEditing(cellPath, 'same-text');
      // Do NOT change content
      useEditingStore.getState().endEditing();
    });

    expect(mockUpdateCellText).not.toHaveBeenCalled();
    expect(mockUpdateParagraphText).not.toHaveBeenCalled();
    expect(mockSetDirty).not.toHaveBeenCalled();
  });

  // 10. endEditing with changed content updates document
  it('endEditing with changed cell content calls updateCellText', () => {
    act(() => {
      useEditingStore.getState().startEditing(cellPath, 'original');
      useEditingStore.getState().updateContent('updated');
      useEditingStore.getState().endEditing();
    });

    expect(mockUpdateCellText).toHaveBeenCalledWith(
      { section: 0, table: 1, row: 2, cell: 3 },
      'updated',
    );
    expect(mockSetDirty).toHaveBeenCalledWith(true);
  });

  it('endEditing with changed paragraph content calls updateParagraphText', () => {
    act(() => {
      useEditingStore.getState().startEditing(paragraphPath, 'original');
      useEditingStore.getState().updateContent('updated');
      useEditingStore.getState().endEditing();
    });

    expect(mockUpdateParagraphText).toHaveBeenCalledWith(0, 1, 'updated');
    expect(mockSetDirty).toHaveBeenCalledWith(true);
  });
});
