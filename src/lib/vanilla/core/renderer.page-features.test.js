/**
 * DocumentRenderer Page Features Tests
 *   ★ Phase 2-1: 헤더/푸터 통합
 *   ★ Phase 2-3: 다단 레이아웃 + colbreak
 *   ★ Phase 2-6: 페이지 테두리 + 워터마크
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
  }),
}));

vi.mock('./constants.js', () => ({
  HWPXConstants: {
    PAGE_WIDTH_A4_PX: 794,
    PAGE_HEIGHT_A4_PX: 1123,
    PAGE_PADDING_DEFAULT: 10,
    ptToPx: pt => pt * (96 / 72),
  },
}));

vi.mock('../utils/numbering.js', () => ({
  toRoman: vi.fn(() => 'I'),
  toLetter: vi.fn(() => 'A'),
}));

vi.mock('../renderers/paragraph.js', () => ({
  renderParagraph: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'mock-paragraph';
    return el;
  }),
  renderParagraphs: vi.fn(),
}));
vi.mock('../renderers/table.js', () => ({
  renderTable: vi.fn(() => {
    const el = document.createElement('div');
    el.appendChild(document.createElement('table'));
    return el;
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
  withErrorBoundary: fn => fn,
  withAsyncErrorBoundary: fn => fn,
  safeDOMOperation: fn => fn(),
}));

import { DocumentRenderer } from './renderer.js';

function makeSection(overrides = {}) {
  return {
    elements: [],
    pageSettings: {},
    headers: { both: null, odd: null, even: null, first: null },
    footers: { both: null, odd: null, even: null, first: null },
    headerMargin: 40,
    footerMargin: 40,
    ...overrides,
  };
}

describe('DocumentRenderer — Phase 2 page features', () => {
  let container;
  let renderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderer = new DocumentRenderer(container, { enableAutoPagination: false });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // ─── 2-1: 헤더/푸터 ──────────────────────────────────────────────
  describe('Phase 2-1: header/footer', () => {
    it('renders header div from section.headers.both.paragraphs', async () => {
      const section = makeSection({
        headers: {
          both: { paragraphs: [{ type: 'paragraph', text: 'Top' }] },
        },
      });
      await renderer.render({ sections: [section] });
      const header = container.querySelector('.hwp-page-header');
      expect(header).toBeTruthy();
      expect(header.getAttribute('data-page-region')).toBe('header');
    });

    it('renders footer div from section.footers.both.paragraphs', async () => {
      const section = makeSection({
        footers: {
          both: { paragraphs: [{ type: 'paragraph', text: 'Bot' }] },
        },
      });
      await renderer.render({ sections: [section] });
      const footer = container.querySelector('.hwp-page-footer');
      expect(footer).toBeTruthy();
      expect(footer.getAttribute('data-page-region')).toBe('footer');
    });

    it('does not render header when section has no header content', async () => {
      const section = makeSection();
      await renderer.render({ sections: [section] });
      expect(container.querySelector('.hwp-page-header')).toBe(null);
    });
  });

  // ─── 2-3: 다단(Multi-column) ────────────────────────────────────
  describe('Phase 2-3: multi-column layout', () => {
    it('applies columnCount + columnGap when colPr is present', async () => {
      const section = makeSection({
        colPr: { colCount: 3, columnGap: 30, columnLine: false, type: 'EQUAL' },
      });
      await renderer.render({ sections: [section] });
      const page = container.querySelector('.hwp-page-container');
      expect(page).toBeTruthy();
      expect(page.style.columnCount).toBe('3');
      expect(page.style.columnGap).toBe('30px');
      expect(page.getAttribute('data-column-count')).toBe('3');
    });

    it('applies columnRule when colPr.columnLine is true', async () => {
      const section = makeSection({
        colPr: { colCount: 2, columnGap: 20, columnLine: true, type: 'EQUAL' },
      });
      await renderer.render({ sections: [section] });
      const page = container.querySelector('.hwp-page-container');
      // jsdom renders shorthand columnRule via columnRuleStyle/Color/Width
      const rule =
        page.style.columnRule ||
        `${page.style.columnRuleWidth} ${page.style.columnRuleStyle} ${page.style.columnRuleColor}`;
      expect(rule.toLowerCase()).toContain('solid');
    });

    it('does NOT apply columns when colCount is 1 or colPr is absent', async () => {
      const section = makeSection();
      await renderer.render({ sections: [section] });
      const page = container.querySelector('.hwp-page-container');
      expect(page.style.columnCount).toBe('');
    });

    it('marks elements with data-colbreak with break-after: column', async () => {
      // Make the paragraph renderer mark the element with data-colbreak
      const { renderParagraph } = await import('../renderers/paragraph.js');
      renderParagraph.mockImplementationOnce(() => {
        const el = document.createElement('div');
        el.className = 'mock-paragraph';
        el.setAttribute('data-colbreak', 'true');
        return el;
      });

      const section = makeSection({
        elements: [{ type: 'paragraph' }],
        colPr: { colCount: 2, columnGap: 20, columnLine: false, type: 'EQUAL' },
      });
      await renderer.render({ sections: [section] });
      const marker = container.querySelector('[data-colbreak="true"]');
      expect(marker).toBeTruthy();
      expect(marker.style.breakAfter).toBe('column');
    });
  });

  // ─── 2-6: 페이지 테두리 + 워터마크 ─────────────────────────────
  describe('Phase 2-6: page border + watermark', () => {
    it('applies border to page container when section.pageBorder is defined', async () => {
      const section = makeSection({
        pageBorder: {
          position: 'OUTSIDE',
          top: { type: 'SOLID', width: '2px', color: '#123456' },
          right: { type: 'SOLID', width: '2px', color: '#123456' },
          bottom: { type: 'SOLID', width: '2px', color: '#123456' },
          left: { type: 'SOLID', width: '2px', color: '#123456' },
        },
      });
      await renderer.render({ sections: [section] });
      const page = container.querySelector('.hwp-page-container');
      expect(page.getAttribute('data-page-border')).toBe('true');
      expect(page.style.borderTop).toContain('solid');
    });

    it('renders watermark layer when section.watermark is defined', async () => {
      const section = makeSection({
        watermark: { type: 'text', text: 'CONFIDENTIAL', opacity: 0.2 },
      });
      await renderer.render({ sections: [section] });
      const watermark = container.querySelector('.hwp-page-watermark');
      expect(watermark).toBeTruthy();
      expect(watermark.textContent).toBe('CONFIDENTIAL');
    });

    it('no watermark, no border when not configured', async () => {
      await renderer.render({ sections: [makeSection()] });
      expect(container.querySelector('.hwp-page-watermark')).toBe(null);
      const page = container.querySelector('.hwp-page-container');
      expect(page.getAttribute('data-page-border')).toBe(null);
    });
  });
});
