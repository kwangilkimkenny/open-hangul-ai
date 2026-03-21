import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useDocumentStore } from './documentStore';
import type { HWPXDocument } from '../types/hwpx';

/** Helper to create a minimal mock document */
function createMockDocument(overrides?: Partial<HWPXDocument>): HWPXDocument {
  return {
    sections: [
      {
        id: 'section-0',
        elements: [
          {
            type: 'paragraph' as const,
            runs: [{ text: 'Hello', style: {} }],
          },
        ],
      },
    ],
    images: new Map(),
    ...overrides,
  } as HWPXDocument;
}

/** Helper to create a document with a table for cell-text tests */
function createDocWithTable(): HWPXDocument {
  return {
    sections: [
      {
        id: 'section-0',
        elements: [
          {
            type: 'table' as const,
            rows: [
              {
                cells: [
                  {
                    elements: [
                      {
                        type: 'paragraph' as const,
                        runs: [{ text: 'cell-text', style: {} }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    images: new Map(),
  } as HWPXDocument;
}

describe('useDocumentStore', () => {
  beforeEach(() => {
    act(() => {
      useDocumentStore.getState().reset();
    });
  });

  // 1. Initial state
  it('has correct initial state', () => {
    const state = useDocumentStore.getState();
    expect(state.document).toBeNull();
    expect(state.originalFile).toBeNull();
    expect(state.fileName).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isDirty).toBe(false);
  });

  // 2. setDocument
  it('setDocument stores document and clears error/loading', () => {
    const doc = createMockDocument();

    act(() => {
      useDocumentStore.getState().setLoading(true);
      useDocumentStore.getState().setError('previous error');
      useDocumentStore.getState().setDocument(doc);
    });

    const state = useDocumentStore.getState();
    expect(state.document).toBe(doc);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isDirty).toBe(false);
  });

  // 3. updateDocument sets isDirty
  it('updateDocument sets document and isDirty to true', () => {
    const doc = createMockDocument();

    act(() => {
      useDocumentStore.getState().updateDocument(doc);
    });

    const state = useDocumentStore.getState();
    expect(state.document).toBe(doc);
    expect(state.isDirty).toBe(true);
  });

  // 4. setOriginalFile
  it('setOriginalFile sets file and fileName', () => {
    const file = new File(['content'], 'test-document.hwpx', {
      type: 'application/octet-stream',
    });

    act(() => {
      useDocumentStore.getState().setOriginalFile(file);
    });

    const state = useDocumentStore.getState();
    expect(state.originalFile).toBe(file);
    expect(state.fileName).toBe('test-document.hwpx');
  });

  // 5. setLoading and setError
  it('setLoading and setError work correctly', () => {
    act(() => {
      useDocumentStore.getState().setLoading(true);
    });
    expect(useDocumentStore.getState().isLoading).toBe(true);

    act(() => {
      useDocumentStore.getState().setError('something went wrong');
    });
    const state = useDocumentStore.getState();
    expect(state.error).toBe('something went wrong');
    expect(state.isLoading).toBe(false);
  });

  // 6. reset
  it('reset returns to initial state', () => {
    const doc = createMockDocument();

    act(() => {
      useDocumentStore.getState().setDocument(doc);
      useDocumentStore.getState().setDirty(true);
      useDocumentStore.getState().reset();
    });

    const state = useDocumentStore.getState();
    expect(state.document).toBeNull();
    expect(state.isDirty).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.originalFile).toBeNull();
    expect(state.fileName).toBeNull();
  });

  // 7. getSectionCount
  it('getSectionCount returns correct count', () => {
    expect(useDocumentStore.getState().getSectionCount()).toBe(0);

    const doc = createMockDocument({
      sections: [
        { id: 's0', elements: [] },
        { id: 's1', elements: [] },
      ] as HWPXDocument['sections'],
    });

    act(() => {
      useDocumentStore.getState().setDocument(doc);
    });

    expect(useDocumentStore.getState().getSectionCount()).toBe(2);
  });

  // 8. getSection
  it('getSection returns section or null', () => {
    expect(useDocumentStore.getState().getSection(0)).toBeNull();

    const doc = createMockDocument();
    act(() => {
      useDocumentStore.getState().setDocument(doc);
    });

    const section = useDocumentStore.getState().getSection(0);
    expect(section).not.toBeNull();
    expect(section?.id).toBe('section-0');

    expect(useDocumentStore.getState().getSection(99)).toBeNull();
  });

  // 9. updateCellText
  it('updateCellText updates text at the given path', () => {
    const doc = createDocWithTable();

    act(() => {
      useDocumentStore.getState().setDocument(doc);
      useDocumentStore.getState().updateCellText(
        { section: 0, table: 0, row: 0, cell: 0 },
        'updated-cell-text',
      );
    });

    const state = useDocumentStore.getState();
    expect(state.isDirty).toBe(true);
    // Verify the text was updated in the cloned document
    const table = state.document!.sections[0].elements[0] as any;
    expect(table.rows[0].cells[0].elements[0].runs[0].text).toBe('updated-cell-text');
  });

  // 10. updateParagraphText
  it('updateParagraphText updates text in paragraph', () => {
    const doc = createMockDocument();

    act(() => {
      useDocumentStore.getState().setDocument(doc);
      useDocumentStore.getState().updateParagraphText(0, 0, 'new paragraph text');
    });

    const state = useDocumentStore.getState();
    expect(state.isDirty).toBe(true);
    const para = state.document!.sections[0].elements[0] as any;
    expect(para.runs[0].text).toBe('new paragraph text');
  });
});
