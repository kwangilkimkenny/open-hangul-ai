/**
 * CanvasEditorAdapter tests
 * 어댑터의 페이지 정보 구독 / PDF export / 컨텐트 변경 콜백 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../core/hwpx-to-canvas-editor.js', () => ({
  hwpxToCanvasEditor: vi.fn(doc => ({
    main: [{ value: doc?.sections?.[0]?.elements?.[0]?.runs?.[0]?.text || 'x' }],
  })),
}));

vi.mock('../core/canvas-editor-to-hwpx.js', () => ({
  canvasEditorToHwpx: vi.fn(data => ({
    sections: [{ elements: [{ type: 'paragraph', runs: [{ text: data?.[0]?.value || '' }] }] }],
  })),
}));

vi.mock('./canvas-editor-commands.js', () => ({
  CanvasEditorCommands: class {
    constructor() {}
  },
}));

import { CanvasEditorAdapter } from './canvas-editor-adapter.js';

function makeFakeEditor() {
  return {
    listener: {},
    command: {
      executeMode: vi.fn(),
      getValue: vi.fn(() => ({ data: [{ value: 'hello' }] })),
      executeSetValue: vi.fn(),
      getWordCount: vi.fn(async () => 42),
      getImage: vi.fn(async () => [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',
      ]),
      getOptions: vi.fn(() => ({ width: 794, height: 1123 })),
      print: vi.fn(async () => undefined),
    },
    destroy: vi.fn(),
  };
}

describe('CanvasEditorAdapter', () => {
  let viewer;
  let adapter;

  beforeEach(() => {
    viewer = {};
    adapter = new CanvasEditorAdapter(viewer);
  });

  describe('onPageInfoChange', () => {
    it('emits initial page info on subscribe and on subsequent updates', () => {
      const cb = vi.fn();
      const unsub = adapter.onPageInfoChange(cb);
      expect(cb).toHaveBeenCalledWith({ current: 1, total: 1 });

      adapter._handlePageSizeChange(5);
      expect(cb).toHaveBeenLastCalledWith({ current: 1, total: 5 });

      adapter._handleIntersectionPageNo(2); // canvas-editor uses 0-base
      expect(cb).toHaveBeenLastCalledWith({ current: 3, total: 5 });

      unsub();
      adapter._handlePageSizeChange(10);
      expect(cb).toHaveBeenCalledTimes(3);
    });

    it('returns a noop unsubscriber when callback is not a function', () => {
      const unsub = adapter.onPageInfoChange(null);
      expect(typeof unsub).toBe('function');
      expect(() => unsub()).not.toThrow();
    });

    it('ignores invalid page numbers', () => {
      const cb = vi.fn();
      adapter.onPageInfoChange(cb);
      cb.mockClear();
      adapter._handlePageSizeChange(0);
      adapter._handlePageSizeChange(-1);
      adapter._handlePageSizeChange('bad');
      adapter._handleIntersectionPageNo('bad');
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('getDocument / round-trip', () => {
    it('returns null when editor not mounted', () => {
      expect(adapter.getDocument()).toBeNull();
    });

    it('converts canvas-editor data back to HWPX shape via canvasEditorToHwpx', () => {
      adapter.editor = makeFakeEditor();
      const doc = adapter.getDocument();
      expect(doc.sections[0].elements[0].runs[0].text).toBe('hello');
    });
  });

  describe('exportPDF', () => {
    it('throws when editor is not ready', async () => {
      await expect(adapter.exportPDF()).rejects.toThrow('canvas-editor not ready');
    });

    it('throws when getImage returns no pages', async () => {
      adapter.editor = makeFakeEditor();
      adapter.editor.command.getImage = vi.fn(async () => []);
      await expect(adapter.exportPDF('foo.pdf')).rejects.toThrow('렌더된 페이지가 없습니다');
    });

    it('builds a PDF and triggers save when getImage returns pages', async () => {
      adapter.editor = makeFakeEditor();
      const saveSpy = vi.fn();
      const addImageSpy = vi.fn();
      const addPageSpy = vi.fn();

      vi.doMock('jspdf', () => ({
        jsPDF: class {
          constructor() {
            this.save = saveSpy;
            this.addImage = addImageSpy;
            this.addPage = addPageSpy;
          }
        },
      }));

      // Force re-import so the mock applies
      const { CanvasEditorAdapter: FreshAdapter } = await import('./canvas-editor-adapter.js');
      const a = new FreshAdapter({});
      a.editor = makeFakeEditor();
      a.editor.command.getImage = vi.fn(async () => [
        'data:image/png;base64,AAA',
        'data:image/png;base64,BBB',
      ]);

      await a.exportPDF('out.pdf');

      expect(addImageSpy).toHaveBeenCalledTimes(2);
      expect(addPageSpy).toHaveBeenCalledTimes(1); // page 2 only
      expect(saveSpy).toHaveBeenCalledWith('out.pdf');
      vi.doUnmock('jspdf');
    });
  });

  describe('print', () => {
    it('throws when editor not ready', async () => {
      await expect(adapter.print()).rejects.toThrow('canvas-editor not ready');
    });

    it('delegates to canvas-editor command.print', async () => {
      adapter.editor = makeFakeEditor();
      await adapter.print();
      expect(adapter.editor.command.print).toHaveBeenCalled();
    });
  });

  describe('getWordCount', () => {
    it('returns 0 when editor not mounted', async () => {
      expect(await adapter.getWordCount()).toBe(0);
    });

    it('returns the editor wordcount', async () => {
      adapter.editor = makeFakeEditor();
      expect(await adapter.getWordCount()).toBe(42);
    });

    it('returns 0 if the editor throws', async () => {
      adapter.editor = makeFakeEditor();
      adapter.editor.command.getWordCount = vi.fn(async () => {
        throw new Error('nope');
      });
      expect(await adapter.getWordCount()).toBe(0);
    });
  });

  describe('selection API', () => {
    it('getRangeText returns empty string when editor missing', () => {
      expect(adapter.getRangeText()).toBe('');
    });

    it('getRangeText delegates to canvas-editor command', () => {
      adapter.editor = makeFakeEditor();
      adapter.editor.command.getRangeText = vi.fn(() => '선택된 텍스트');
      expect(adapter.getRangeText()).toBe('선택된 텍스트');
    });

    it('getRangeContext returns null when no selection', () => {
      adapter.editor = makeFakeEditor();
      adapter.editor.command.getRangeContext = vi.fn(() => null);
      expect(adapter.getRangeContext()).toBeNull();
    });

    it('getRangeBoundingRect returns null when collapsed', () => {
      adapter.editor = makeFakeEditor();
      adapter.editor.command.getRangeContext = vi.fn(() => ({
        isCollapsed: true,
        rangeRects: [],
      }));
      expect(adapter.getRangeBoundingRect()).toBeNull();
    });

    it('getRangeBoundingRect projects canvas-editor rects to viewport', () => {
      const fakeCanvas = {
        width: 800,
        height: 1000,
        getBoundingClientRect: () => ({ left: 100, top: 50, width: 400, height: 500 }),
      };
      adapter.container = {
        querySelectorAll: sel => (sel === 'canvas' ? [fakeCanvas, fakeCanvas] : []),
      };
      adapter.editor = makeFakeEditor();
      adapter.editor.command.getRangeContext = vi.fn(() => ({
        isCollapsed: false,
        startPageNo: 0,
        endPageNo: 0,
        rangeRects: [{ x: 200, y: 100, width: 50, height: 20 }],
      }));
      const rect = adapter.getRangeBoundingRect();
      // scaleX = 400/800 = 0.5, scaleY = 500/1000 = 0.5
      expect(rect.left).toBeCloseTo(100 + 200 * 0.5);
      expect(rect.top).toBeCloseTo(50 + 100 * 0.5);
      expect(rect.right).toBeCloseTo(100 + (200 + 50) * 0.5);
      expect(rect.bottom).toBeCloseTo(50 + (100 + 20) * 0.5);
    });

    it('replaceRangeText backspaces when selection exists then inserts elements', () => {
      adapter.editor = makeFakeEditor();
      const back = vi.fn();
      const insert = vi.fn();
      adapter.editor.command.getRange = vi.fn(() => ({ startIndex: 1, endIndex: 5 }));
      adapter.editor.command.executeBackspace = back;
      adapter.editor.command.executeInsertElementList = insert;
      expect(adapter.replaceRangeText('hi')).toBe(true);
      expect(back).toHaveBeenCalledOnce();
      expect(insert).toHaveBeenCalledWith([{ value: 'h' }, { value: 'i' }]);
    });

    it('replaceRangeText skips backspace when caret is collapsed', () => {
      adapter.editor = makeFakeEditor();
      const back = vi.fn();
      const insert = vi.fn();
      adapter.editor.command.getRange = vi.fn(() => ({ startIndex: 3, endIndex: 3 }));
      adapter.editor.command.executeBackspace = back;
      adapter.editor.command.executeInsertElementList = insert;
      expect(adapter.replaceRangeText('x')).toBe(true);
      expect(back).not.toHaveBeenCalled();
      expect(insert).toHaveBeenCalledWith([{ value: 'x' }]);
    });

    it('replaceRangeText returns false when editor not mounted', () => {
      expect(adapter.replaceRangeText('x')).toBe(false);
    });
  });

  describe('destroy', () => {
    it('clears listeners and tears down the editor', () => {
      const cb = vi.fn();
      adapter.onPageInfoChange(cb);
      adapter.editor = makeFakeEditor();
      adapter.destroy();
      expect(adapter.editor).toBeNull();
      expect(adapter._pageInfoListeners.size).toBe(0);
    });
  });
});
