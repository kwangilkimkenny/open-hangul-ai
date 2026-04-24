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
