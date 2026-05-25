/**
 * Page Header/Footer Renderer Tests (★ Phase 2-1)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be hoisted before the import-under-test
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

vi.mock('./paragraph.js', () => ({
  renderParagraph: vi.fn(() => {
    const el = document.createElement('p');
    el.className = 'mock-paragraph';
    return el;
  }),
}));
vi.mock('./table.js', () => ({
  renderTable: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'mock-table';
    return el;
  }),
}));
vi.mock('./image.js', () => ({
  renderImage: vi.fn(() => document.createElement('img')),
  clearImageCache: vi.fn(),
  applyImageOptimizations: vi.fn(),
}));
vi.mock('./container.js', () => ({
  renderContainer: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'mock-container';
    return el;
  }),
}));

import {
  renderPageHeader,
  renderPageFooter,
  resolveHeaderFooter,
  getHeaderFooterReservedHeights,
} from './page-header-footer.js';

function makeSection(overrides = {}) {
  return {
    headers: { both: null, odd: null, even: null, first: null },
    footers: { both: null, odd: null, even: null, first: null },
    pageSettings: {},
    headerMargin: 40,
    footerMargin: 40,
    ...overrides,
  };
}

describe('resolveHeaderFooter()', () => {
  it('returns null for empty pool', () => {
    expect(resolveHeaderFooter(null, 1)).toBe(null);
    expect(resolveHeaderFooter({}, 1)).toBe(null);
  });

  it('prefers FIRST on page 1 when defined', () => {
    const pool = { first: { paragraphs: [{ text: 'F' }] }, both: { paragraphs: [{ text: 'B' }] } };
    expect(resolveHeaderFooter(pool, 1).paragraphs[0].text).toBe('F');
  });

  it('falls back to BOTH if no FIRST', () => {
    const pool = { both: { paragraphs: [{ text: 'B' }] } };
    expect(resolveHeaderFooter(pool, 1).paragraphs[0].text).toBe('B');
  });

  it('returns ODD for odd pages (non-first)', () => {
    const pool = {
      odd: { paragraphs: [{ text: 'O' }] },
      even: { paragraphs: [{ text: 'E' }] },
    };
    expect(resolveHeaderFooter(pool, 3).paragraphs[0].text).toBe('O');
  });

  it('returns EVEN for even pages', () => {
    const pool = {
      odd: { paragraphs: [{ text: 'O' }] },
      even: { paragraphs: [{ text: 'E' }] },
    };
    expect(resolveHeaderFooter(pool, 2).paragraphs[0].text).toBe('E');
  });
});

describe('renderPageHeader()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no headers defined', () => {
    expect(renderPageHeader(makeSection(), 1)).toBe(null);
  });

  it('renders BOTH header for odd page (no ODD specific)', () => {
    const section = makeSection({
      headers: { both: { paragraphs: [{ text: 'hello', type: 'paragraph' }] } },
    });
    const node = renderPageHeader(section, 1);
    expect(node).toBeInstanceOf(HTMLDivElement);
    expect(node.className).toBe('hwp-page-header');
    expect(node.querySelector('.mock-paragraph')).toBeTruthy();
  });

  it('selects FIRST header on page 1 if defined', () => {
    const section = makeSection({
      headers: {
        both: { paragraphs: [{ text: 'both', type: 'paragraph' }] },
        first: { paragraphs: [{ text: 'first', type: 'paragraph' }] },
      },
    });
    const node = renderPageHeader(section, 1);
    expect(node).toBeTruthy();
    // Both/First each render 1 paragraph; we ensure exactly 1 (not 2 -> would mean both used)
    expect(node.querySelectorAll('.mock-paragraph').length).toBe(1);
  });

  it('applies pageSettings margin to left/right', () => {
    const section = makeSection({
      headers: { both: { paragraphs: [{ text: 'x', type: 'paragraph' }] } },
      pageSettings: { marginLeft: '60px', marginRight: '70px' },
    });
    const node = renderPageHeader(section, 1);
    expect(node.style.left).toBe('60px');
    expect(node.style.right).toBe('70px');
  });

  it('honours options.height override', () => {
    const section = makeSection({
      headers: { both: { paragraphs: [{ text: 'x' }] } },
    });
    const node = renderPageHeader(section, 1, { height: 88 });
    expect(node.style.height).toBe('88px');
  });

  it('returns null when paragraphs array is empty', () => {
    const section = makeSection({
      headers: { both: { paragraphs: [] } },
    });
    expect(renderPageHeader(section, 1)).toBe(null);
  });

  it('supports legacy `elements` array shape', () => {
    const section = makeSection({
      headers: { both: { elements: [{ type: 'container' }] } },
    });
    const node = renderPageHeader(section, 1);
    expect(node).toBeTruthy();
    expect(node.querySelector('.mock-container')).toBeTruthy();
  });
});

describe('renderPageFooter()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no footers defined', () => {
    expect(renderPageFooter(makeSection(), 1)).toBe(null);
  });

  it('renders footer aligned to bottom', () => {
    const section = makeSection({
      footers: { both: { paragraphs: [{ text: 'foot', type: 'paragraph' }] } },
    });
    const node = renderPageFooter(section, 2);
    expect(node).toBeInstanceOf(HTMLDivElement);
    expect(node.className).toBe('hwp-page-footer');
    expect(node.style.bottom).toBe('0px');
  });

  it('uses EVEN footer on even pages when defined', () => {
    const section = makeSection({
      footers: {
        odd: { paragraphs: [{ text: 'O' }] },
        even: { paragraphs: [{ text: 'E' }, { text: 'E2' }] },
      },
    });
    const node = renderPageFooter(section, 4);
    expect(node.querySelectorAll('.mock-paragraph').length).toBe(2);
  });
});

describe('getHeaderFooterReservedHeights()', () => {
  it('returns zero when nothing defined', () => {
    expect(getHeaderFooterReservedHeights(makeSection(), 1)).toEqual({
      header: 0,
      footer: 0,
    });
  });

  it('returns headerMargin / footerMargin when present', () => {
    const section = makeSection({
      headers: { both: { paragraphs: [{ text: 'h' }] } },
      footers: { both: { paragraphs: [{ text: 'f' }] } },
      headerMargin: 50,
      footerMargin: 60,
    });
    expect(getHeaderFooterReservedHeights(section, 1)).toEqual({ header: 50, footer: 60 });
  });
});
