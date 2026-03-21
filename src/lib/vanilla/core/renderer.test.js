/**
 * DocumentRenderer Test Suite
 * Tests for src/lib/vanilla/core/renderer.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

// Mock constants
vi.mock('./constants.js', () => ({
  HWPXConstants: {
    PAGE_WIDTH_A4_PX: 794,
    PAGE_HEIGHT_A4_PX: 1123,
    PAGE_PADDING_DEFAULT: 10,
    ptToPx: (pt) => pt * (96 / 72),
  },
}));

// Mock numbering utils
vi.mock('../utils/numbering.js', () => ({
  toRoman: vi.fn((n) => 'I'),
  toLetter: vi.fn((n) => 'A'),
}));

// Mock sub-renderers
vi.mock('../renderers/paragraph.js', () => ({
  renderParagraph: vi.fn(() => document.createElement('div')),
}));
vi.mock('../renderers/table.js', () => ({
  renderTable: vi.fn(() => {
    const w = document.createElement('div');
    w.appendChild(document.createElement('table'));
    return w;
  }),
}));
vi.mock('../renderers/image.js', () => ({
  renderImage: vi.fn(() => document.createElement('div')),
  clearImageCache: vi.fn(),
  applyImageOptimizations: vi.fn(),
}));
vi.mock('../renderers/shape.js', () => ({
  renderShape: vi.fn(() => document.createElement('div')),
}));
vi.mock('../renderers/container.js', () => ({
  renderContainer: vi.fn(() => document.createElement('div')),
}));
vi.mock('../utils/error-boundary.js', () => ({
  withErrorBoundary: (fn) => fn,
  withAsyncErrorBoundary: (fn) => fn,
  safeDOMOperation: (fn) => fn(),
}));

import { DocumentRenderer } from './renderer.js';
import { renderParagraph } from '../renderers/paragraph.js';
import { renderTable } from '../renderers/table.js';
import { renderImage } from '../renderers/image.js';
import { renderShape } from '../renderers/shape.js';
import { renderContainer } from '../renderers/container.js';

// Helper: create a minimal section
function createSection(elements = [], pageSettings = {}) {
  return { elements, pageSettings };
}

// Helper: create a minimal hwpxDoc
function createDoc(sections = [], images = new Map()) {
  return { sections, images };
}

describe('DocumentRenderer', () => {
  let container;
  let renderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderer = new DocumentRenderer(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // ─── Constructor ────────────────────────────────────────────

  describe('constructor', () => {
    it('should store the container reference', () => {
      expect(renderer.container).toBe(container);
    });

    it('should set default options', () => {
      expect(renderer.options.enableAutoPagination).toBe(true);
      expect(renderer.options.enableLazyLoading).toBe(true);
      expect(renderer.options.a4Width).toBe(794);
      expect(renderer.options.a4Height).toBe(1123);
      expect(renderer.options.defaultPadding).toBe(10);
    });

    it('should allow custom options to override defaults', () => {
      const custom = new DocumentRenderer(container, {
        enableAutoPagination: false,
        a4Width: 800,
      });
      expect(custom.options.enableAutoPagination).toBe(false);
      expect(custom.options.a4Width).toBe(800);
      // non-overridden defaults remain
      expect(custom.options.enableLazyLoading).toBe(true);
    });

    it('should initialise pageNumber to 1 and totalPages to 0', () => {
      expect(renderer.pageNumber).toBe(1);
      expect(renderer.totalPages).toBe(0);
    });

    it('should initialise pagination state', () => {
      expect(renderer.isPaginating).toBe(false);
      expect(renderer.paginationQueue).toEqual([]);
      expect(renderer.dirtyPages).toBeInstanceOf(Set);
      expect(renderer.dirtyPages.size).toBe(0);
    });
  });

  // ─── render() ───────────────────────────────────────────────

  describe('render()', () => {
    it('should return 0 for null document', async () => {
      const pages = await renderer.render(null);
      expect(pages).toBe(0);
    });

    it('should return 0 for document with no sections', async () => {
      const pages = await renderer.render({ sections: [] });
      expect(pages).toBe(0);
    });

    it('should return 0 for undefined document', async () => {
      const pages = await renderer.render(undefined);
      expect(pages).toBe(0);
    });

    it('should display empty-document message when sections are missing', async () => {
      await renderer.render({ sections: [] });
      expect(container.innerHTML).toContain('문서 내용이 없습니다');
    });

    it('should clear the container before rendering', async () => {
      container.innerHTML = '<p>old content</p>';
      await renderer.render(createDoc([createSection()]));
      expect(container.querySelector('p')).toBeNull();
    });

    it('should render one page per section', async () => {
      const doc = createDoc([
        createSection([{ type: 'paragraph' }]),
        createSection([{ type: 'paragraph' }]),
      ]);
      // Disable auto pagination to keep page count predictable
      renderer.options.enableAutoPagination = false;
      const pages = await renderer.render(doc);
      expect(pages).toBe(2);
      const pageDivs = container.querySelectorAll('.hwp-page-container');
      expect(pageDivs.length).toBe(2);
    });

    it('should set totalPages after rendering', async () => {
      renderer.options.enableAutoPagination = false;
      await renderer.render(createDoc([createSection(), createSection(), createSection()]));
      expect(renderer.totalPages).toBe(3);
    });

    it('should assign data-page-number attributes', async () => {
      renderer.options.enableAutoPagination = false;
      await renderer.render(createDoc([createSection(), createSection()]));
      const pageDivs = container.querySelectorAll('.hwp-page-container');
      expect(pageDivs[0].getAttribute('data-page-number')).toBe('1');
      expect(pageDivs[1].getAttribute('data-page-number')).toBe('2');
    });

    it('should render a single section with elements', async () => {
      renderer.options.enableAutoPagination = false;
      const doc = createDoc([createSection([{ type: 'paragraph' }, { type: 'paragraph' }])]);
      const pages = await renderer.render(doc);
      expect(pages).toBe(1);
      expect(renderParagraph).toHaveBeenCalledTimes(2);
    });
  });

  // ─── createPageContainer() ──────────────────────────────────

  describe('createPageContainer()', () => {
    it('should create a div with hwp-page-container class', () => {
      const page = renderer.createPageContainer(createSection(), 1);
      expect(page.tagName).toBe('DIV');
      expect(page.className).toBe('hwp-page-container');
    });

    it('should set data-page-number attribute', () => {
      const page = renderer.createPageContainer(createSection(), 5);
      expect(page.getAttribute('data-page-number')).toBe('5');
    });

    it('should set position relative', () => {
      const page = renderer.createPageContainer(createSection(), 1);
      expect(page.style.position).toBe('relative');
    });

    it('should store section reference as _section', () => {
      const section = createSection();
      const page = renderer.createPageContainer(section, 1);
      expect(page._section).toBe(section);
    });
  });

  // ─── renderElements() ──────────────────────────────────────

  describe('renderElements()', () => {
    it('should call renderParagraph for paragraph elements', () => {
      const pageDiv = document.createElement('div');
      const section = createSection([{ type: 'paragraph' }]);
      renderer.renderElements(pageDiv, section, new Map());
      expect(renderParagraph).toHaveBeenCalledTimes(1);
    });

    it('should call renderTable for table elements', () => {
      const pageDiv = document.createElement('div');
      const section = createSection([{ type: 'table', rows: [] }]);
      renderer.renderElements(pageDiv, section, new Map());
      expect(renderTable).toHaveBeenCalledTimes(1);
    });

    it('should call renderImage for image elements', () => {
      const pageDiv = document.createElement('div');
      const section = createSection([{ type: 'image' }]);
      renderer.renderElements(pageDiv, section, new Map());
      expect(renderImage).toHaveBeenCalledTimes(1);
    });

    it('should call renderShape for shape elements', () => {
      const pageDiv = document.createElement('div');
      const section = createSection([{ type: 'shape' }]);
      renderer.renderElements(pageDiv, section, new Map());
      expect(renderShape).toHaveBeenCalledTimes(1);
    });

    it('should call renderContainer for container elements', () => {
      const pageDiv = document.createElement('div');
      const section = createSection([{ type: 'container' }]);
      renderer.renderElements(pageDiv, section, new Map());
      expect(renderContainer).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when section has no elements', () => {
      const pageDiv = document.createElement('div');
      renderer.renderElements(pageDiv, createSection([]), new Map());
      expect(pageDiv.children.length).toBe(0);
    });

    it('should append all rendered elements to pageDiv', () => {
      const pageDiv = document.createElement('div');
      const section = createSection([
        { type: 'paragraph' },
        { type: 'paragraph' },
        { type: 'image' },
      ]);
      renderer.renderElements(pageDiv, section, new Map());
      expect(pageDiv.children.length).toBe(3);
    });

    it('should handle unknown element types gracefully', () => {
      const pageDiv = document.createElement('div');
      const section = createSection([{ type: 'unknown-thing' }]);
      // Should not throw
      expect(() => renderer.renderElements(pageDiv, section, new Map())).not.toThrow();
      // Unknown types produce no child
      expect(pageDiv.children.length).toBe(0);
    });
  });

  // ─── checkPagination() ──────────────────────────────────────

  describe('checkPagination()', () => {
    it('should return false for null pageDiv', () => {
      expect(renderer.checkPagination(null)).toBe(false);
    });

    it('should return false for element without hwp-page-container class', () => {
      const div = document.createElement('div');
      expect(renderer.checkPagination(div)).toBe(false);
    });

    it('should return false when no _section is attached', () => {
      const div = document.createElement('div');
      div.classList.add('hwp-page-container');
      expect(renderer.checkPagination(div)).toBe(false);
    });

    it('should queue pagination if already paginating', () => {
      renderer.isPaginating = true;
      const page = document.createElement('div');
      page.classList.add('hwp-page-container');
      const result = renderer.checkPagination(page);
      expect(result).toBe(false);
      expect(renderer.paginationQueue).toContain(page);
    });

    it('should not duplicate entries in pagination queue', () => {
      renderer.isPaginating = true;
      const page = document.createElement('div');
      page.classList.add('hwp-page-container');
      renderer.checkPagination(page);
      renderer.checkPagination(page);
      expect(renderer.paginationQueue.length).toBe(1);
    });
  });

  // ─── totalPages ─────────────────────────────────────────────

  describe('totalPages', () => {
    it('should reflect the number of rendered pages', async () => {
      renderer.options.enableAutoPagination = false;
      await renderer.render(createDoc([createSection(), createSection()]));
      expect(renderer.totalPages).toBe(2);
    });

    it('should reset on re-render', async () => {
      renderer.options.enableAutoPagination = false;
      await renderer.render(createDoc([createSection(), createSection(), createSection()]));
      expect(renderer.totalPages).toBe(3);
      await renderer.render(createDoc([createSection()]));
      expect(renderer.totalPages).toBe(1);
    });
  });

  // ─── Error handling ─────────────────────────────────────────

  describe('error handling', () => {
    it('should display error message in container on render throw', async () => {
      // Force renderParagraph to throw
      renderParagraph.mockImplementationOnce(() => {
        throw new Error('Test render failure');
      });
      renderer.options.enableAutoPagination = false;
      const doc = createDoc([createSection([{ type: 'paragraph' }])]);
      await expect(renderer.render(doc)).rejects.toThrow('Test render failure');
      expect(container.innerHTML).toContain('렌더링 오류');
    });

    it('should include error details in the DOM', async () => {
      renderParagraph.mockImplementationOnce(() => {
        throw new Error('Detailed failure info');
      });
      renderer.options.enableAutoPagination = false;
      const doc = createDoc([createSection([{ type: 'paragraph' }])]);
      await expect(renderer.render(doc)).rejects.toThrow();
      expect(container.innerHTML).toContain('Detailed failure info');
    });
  });
});
