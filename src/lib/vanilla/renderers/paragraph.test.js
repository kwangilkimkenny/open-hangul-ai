/**
 * Paragraph Renderer Test Suite
 * Tests for src/lib/vanilla/renderers/paragraph.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

// Mock constants
vi.mock('../core/constants.js', () => ({
  HWPXConstants: {
    ptToPx: (pt) => pt * (96 / 72),
  },
}));

// Mock numbering utils
vi.mock('../utils/numbering.js', () => ({
  toRoman: vi.fn((n) => 'I'),
  toLetter: vi.fn((n) => 'A'),
  toHangulGanada: vi.fn((n) => '\uAC00'),
  toHangulJamo: vi.fn((n) => '\u3131'),
  toCircledHangul: vi.fn((n) => '\u3260'),
  toCircledDecimal: vi.fn((n) => '\u2460'),
  toKoreanHanja: vi.fn((n) => '\u4E00'),
  toChineseHanja: vi.fn((n) => '\u58F9'),
}));

// Mock peer renderers
vi.mock('./shape.js', () => ({
  renderShape: vi.fn(() => document.createElement('div')),
}));
vi.mock('./container.js', () => ({
  renderContainer: vi.fn(() => document.createElement('div')),
}));
vi.mock('./table.js', () => ({
  renderTable: vi.fn(() => {
    const w = document.createElement('div');
    w.appendChild(document.createElement('table'));
    return w;
  }),
}));
vi.mock('./image.js', () => ({
  applyImageOptimizations: vi.fn(),
}));

import { renderParagraph, renderParagraphs } from './paragraph.js';
import { renderShape } from './shape.js';
import { renderContainer } from './container.js';

// ─── Helpers ──────────────────────────────────────────────────

function makePara(runs = [], style = {}, extra = {}) {
  return { runs, style, ...extra };
}

function makeRun(text, style = {}, extra = {}) {
  return { text, style, ...extra };
}

// ─── Tests ────────────────────────────────────────────────────

describe('renderParagraph', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Basic rendering ──────────────────────────────────────

  describe('basic rendering', () => {
    it('should return a div with hwp-paragraph class', () => {
      const el = renderParagraph(makePara());
      expect(el.tagName).toBe('DIV');
      expect(el.className).toBe('hwp-paragraph');
    });

    it('should render a single text run', () => {
      const el = renderParagraph(makePara([makeRun('Hello')]));
      const spans = el.querySelectorAll('.hwp-run');
      expect(spans.length).toBe(1);
      expect(spans[0].textContent).toBe('Hello');
    });

    it('should render multiple text runs in order', () => {
      const el = renderParagraph(makePara([makeRun('A'), makeRun('B'), makeRun('C')]));
      const spans = el.querySelectorAll('.hwp-run');
      expect(spans.length).toBe(3);
      expect(spans[0].textContent).toBe('A');
      expect(spans[1].textContent).toBe('B');
      expect(spans[2].textContent).toBe('C');
    });

    it('should handle empty runs array', () => {
      const el = renderParagraph(makePara([]));
      // Should have a <br> for empty paragraph
      expect(el.querySelector('br')).not.toBeNull();
    });

    it('should handle runs with empty text', () => {
      const el = renderParagraph(makePara([makeRun('')]));
      const span = el.querySelector('.hwp-run');
      expect(span.textContent).toBe('');
    });

    it('should set _paraData reference on the element', () => {
      const para = makePara([makeRun('test')]);
      const el = renderParagraph(para);
      expect(el._paraData).toBe(para);
    });

    it('should set default fontSize 12px on the paragraph div', () => {
      const el = renderParagraph(makePara([makeRun('text')]));
      expect(el.style.fontSize).toBe('12px');
    });
  });

  // ─── Text styles ──────────────────────────────────────────

  describe('text styles', () => {
    it('should apply bold style', () => {
      const el = renderParagraph(makePara([makeRun('Bold', { bold: true })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.fontWeight).toBe('bold');
    });

    it('should apply italic style', () => {
      const el = renderParagraph(makePara([makeRun('Italic', { italic: true })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.fontStyle).toBe('italic');
    });

    it('should apply underline style', () => {
      const el = renderParagraph(makePara([makeRun('Under', { underline: true })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.textDecoration).toContain('underline');
    });

    it('should apply underline with color', () => {
      const el = renderParagraph(makePara([makeRun('Under', { underline: true, underlineColor: '#ff0000' })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.textDecoration).toContain('underline');
      expect(span.style.textDecorationColor).toBe('#ff0000');
    });

    it('should apply text color', () => {
      const el = renderParagraph(makePara([makeRun('Red', { color: '#ff0000' })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.color).toBe('rgb(255, 0, 0)');
    });

    it('should apply fontSize in pt (converted to px)', () => {
      // 10pt => 10 * (96/72) = 13.33px
      const el = renderParagraph(makePara([makeRun('Size', { fontSize: '10pt' })]));
      const span = el.querySelector('.hwp-run');
      const px = parseFloat(span.style.fontSize);
      expect(px).toBeCloseTo(13.33, 1);
    });

    it('should apply fontSizePx directly', () => {
      const el = renderParagraph(makePara([makeRun('Size', { fontSizePx: '16px' })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.fontSize).toBe('16px');
    });

    it('should apply fontFamily', () => {
      const el = renderParagraph(makePara([makeRun('Font', { fontFamily: 'Arial' })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.fontFamily).toBe('Arial');
    });

    it('should apply strikethrough style', () => {
      const el = renderParagraph(makePara([makeRun('Strike', { strikethrough: true })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.textDecoration).toContain('line-through');
    });

    it('should combine underline and strikethrough', () => {
      const el = renderParagraph(makePara([makeRun('Both', { underline: true, strikethrough: true })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.textDecoration).toContain('underline');
      expect(span.style.textDecoration).toContain('line-through');
    });

    it('should apply backgroundColor with padding', () => {
      const el = renderParagraph(makePara([makeRun('Bg', { backgroundColor: '#eee' })]));
      const span = el.querySelector('.hwp-run');
      expect(span.style.backgroundColor).toBe('rgb(238, 238, 238)');
      expect(span.style.padding).toBe('1px 2px');
    });
  });

  // ─── Paragraph alignment ──────────────────────────────────

  describe('paragraph alignment', () => {
    it('should apply left alignment', () => {
      const el = renderParagraph(makePara([makeRun('L')], { textAlign: 'left' }));
      expect(el.style.textAlign).toBe('left');
    });

    it('should apply center alignment', () => {
      const el = renderParagraph(makePara([makeRun('C')], { textAlign: 'center' }));
      expect(el.style.textAlign).toBe('center');
    });

    it('should apply right alignment', () => {
      const el = renderParagraph(makePara([makeRun('R')], { textAlign: 'right' }));
      expect(el.style.textAlign).toBe('right');
    });

    it('should apply justify alignment (without tabs)', () => {
      const el = renderParagraph(makePara([makeRun('J')], { textAlign: 'justify' }));
      expect(el.style.textAlign).toBe('justify');
    });

    it('should prefer paraPr.align over style.textAlign', () => {
      const para = makePara([makeRun('X')], { textAlign: 'left' }, { paraPr: { align: 'center' } });
      const el = renderParagraph(para);
      expect(el.style.textAlign).toBe('center');
    });
  });

  // ─── Line height, margin, indent ─────────────────────────

  describe('line height and spacing', () => {
    it('should apply lineHeight as absolute px with !important', () => {
      const el = renderParagraph(makePara([makeRun('Line', { fontSizePx: '20px' })], { lineHeight: '1.5' }));
      // 20 * 1.5 = 30px
      expect(el.style.getPropertyValue('line-height')).toContain('30');
    });

    it('should apply margin from para.style', () => {
      const el = renderParagraph(makePara([makeRun('M')], { margin: '10px 5px' }));
      expect(el.style.margin).toBe('10px 5px');
    });

    it('should apply padding from para.style', () => {
      const el = renderParagraph(makePara([makeRun('P')], { padding: '8px' }));
      expect(el.style.padding).toBe('8px');
    });

    it('should set default styles for empty paragraphs (spacing)', () => {
      const el = renderParagraph(makePara([], {}));
      // Empty paragraph gets default font size and min-height
      expect(el.style.minHeight).toBe('15px');
    });
  });

  // ─── Line breaks and special characters ───────────────────

  describe('line breaks and special runs', () => {
    it('should render a <br> for linebreak run type', () => {
      const para = makePara([{ type: 'linebreak' }]);
      const el = renderParagraph(para);
      expect(el.querySelector('br')).not.toBeNull();
    });

    it('should add <br> for completely empty paragraph', () => {
      const el = renderParagraph(makePara([]));
      expect(el.querySelector('br')).not.toBeNull();
    });
  });

  // ─── Tab handling ─────────────────────────────────────────

  describe('tab handling', () => {
    it('should render a tab span for tab-type runs', () => {
      const para = makePara([{ type: 'tab', isTab: true, widthPx: 50 }]);
      const el = renderParagraph(para);
      const tab = el.querySelector('.hwp-tab');
      expect(tab).not.toBeNull();
    });

    it('should use flex layout for justify + tabs', () => {
      const para = makePara(
        [makeRun('Title'), { type: 'tab', isTab: true, widthPx: 100 }, makeRun('10')],
        { textAlign: 'justify' }
      );
      const el = renderParagraph(para);
      expect(el.style.display).toBe('flex');
      expect(el.style.alignItems).toBe('baseline');
    });

    it('should set flexShrink=0 on text spans inside flex container', () => {
      const para = makePara(
        [makeRun('Title'), { type: 'tab', isTab: true, widthPx: 100 }, makeRun('10')],
        { textAlign: 'justify' }
      );
      const el = renderParagraph(para);
      const spans = el.querySelectorAll('.hwp-run');
      spans.forEach(s => {
        expect(s.style.flexShrink).toBe('0');
      });
    });

    it('should render tab with leader dots', () => {
      const para = makePara([{ type: 'tab', isTab: true, widthPx: 200, leader: 1 }]);
      const el = renderParagraph(para);
      const tab = el.querySelector('.hwp-tab');
      // Leader type 1 = DOT, uses middle dot character
      expect(tab.textContent).toContain('·');
    });

    it('should fall back to 2em width when no widthPx and no tabStops', () => {
      const para = makePara([{ type: 'tab', isTab: true }]);
      const el = renderParagraph(para);
      const tab = el.querySelector('.hwp-tab');
      expect(tab.style.width).toBe('2em');
    });
  });

  // ─── Korean text rendering ────────────────────────────────

  describe('Korean text', () => {
    it('should render Korean characters correctly via textContent', () => {
      const el = renderParagraph(makePara([makeRun('안녕하세요')]));
      const span = el.querySelector('.hwp-run');
      expect(span.textContent).toBe('안녕하세요');
    });

    it('should handle mixed Korean and English text', () => {
      const el = renderParagraph(makePara([makeRun('Hello 세계')]));
      const span = el.querySelector('.hwp-run');
      expect(span.textContent).toBe('Hello 세계');
    });
  });

  // ─── XSS prevention ──────────────────────────────────────

  describe('XSS prevention', () => {
    it('should not execute script tags in run text', () => {
      const malicious = '<script>alert("xss")</script>';
      const el = renderParagraph(makePara([makeRun(malicious)]));
      const span = el.querySelector('.hwp-run');
      // textContent is used, not innerHTML, so the script tag is literal text
      expect(span.textContent).toBe(malicious);
      expect(el.querySelectorAll('script').length).toBe(0);
    });

    it('should not render HTML in run text', () => {
      const html = '<img src=x onerror=alert(1)>';
      const el = renderParagraph(makePara([makeRun(html)]));
      const span = el.querySelector('.hwp-run');
      expect(span.textContent).toBe(html);
      expect(el.querySelectorAll('img').length).toBe(0);
    });

    it('should escape angle brackets', () => {
      const text = '<b>bold</b>';
      const el = renderParagraph(makePara([makeRun(text)]));
      const span = el.querySelector('.hwp-run');
      expect(span.textContent).toBe(text);
      expect(span.innerHTML).not.toContain('<b>');
    });
  });

  // ─── Background shapes ───────────────────────────────────

  describe('background shapes', () => {
    it('should render background shapes when present', () => {
      const para = makePara([], {}, {
        backgroundShapes: [{ type: 'shape' }],
      });
      const el = renderParagraph(para);
      expect(renderShape).toHaveBeenCalledTimes(1);
    });

    it('should set height=0 for paragraph with only background shapes', () => {
      const para = makePara([], {}, {
        backgroundShapes: [{ type: 'shape' }],
        shapes: [],
      });
      const el = renderParagraph(para);
      expect(el.style.height).toMatch(/^0/);
      expect(el.style.overflow).toBe('visible');
    });
  });

  // ─── Shapes and containers ────────────────────────────────

  describe('inline shapes', () => {
    it('should render treatAsChar shapes via renderShape', () => {
      const para = makePara([], {}, {
        shapes: [{ type: 'shape', treatAsChar: true }],
      });
      const el = renderParagraph(para);
      expect(renderShape).toHaveBeenCalled();
    });

    it('should render treatAsChar containers via renderContainer', () => {
      const para = makePara([], {}, {
        shapes: [{ type: 'container', treatAsChar: true, width: 100 }],
      });
      const el = renderParagraph(para);
      expect(renderContainer).toHaveBeenCalled();
    });
  });

  // ─── Phase 1.1: hyperlink runs ─────────────────────────────
  describe('hyperlink runs', () => {
    it('should render hyperlink runs as <a> with target=_blank for external URLs', () => {
      const para = makePara([
        { text: 'Click', hyperlink: { url: 'https://example.com' } },
      ]);
      const el = renderParagraph(para);
      const a = el.querySelector('a.hwp-hyperlink');
      expect(a).not.toBeNull();
      expect(a.getAttribute('href')).toBe('https://example.com');
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      expect(a.textContent).toBe('Click');
    });

    it('should keep bookmark-fragment links in the same tab (no target=_blank)', () => {
      const para = makePara([
        { text: 'jump', hyperlink: { url: '#bookmark-foo' } },
      ]);
      const el = renderParagraph(para);
      const a = el.querySelector('a.hwp-hyperlink');
      expect(a.getAttribute('href')).toBe('#bookmark-foo');
      expect(a.getAttribute('target')).toBeNull();
    });
  });

  // ─── Phase 1.2: bookmark anchors ───────────────────────────
  describe('bookmark anchors', () => {
    it('should render a bookmark run as a zero-size span with id=bookmark-{name}', () => {
      const para = makePara([
        { type: 'bookmark', name: 'foo' },
        { text: 'after' },
      ]);
      const el = renderParagraph(para);
      const anchor = el.querySelector('#bookmark-foo');
      expect(anchor).not.toBeNull();
      expect(anchor.classList.contains('hwp-bookmark')).toBe(true);
      expect(anchor.getAttribute('data-bookmark')).toBe('foo');
      expect(anchor.style.width).toBe('0px');
    });
  });

  // ─── Phase 1.3: page-number/page-count field markers ──────
  describe('page field markers', () => {
    it('should emit a hwp-field marker for PAGE_NUMBER field runs', () => {
      const para = makePara([
        { type: 'field', fieldType: 'PAGE_NUMBER', text: '{페이지}' },
      ]);
      const el = renderParagraph(para);
      const marker = el.querySelector('.hwp-field[data-field="page-number"]');
      expect(marker).not.toBeNull();
    });

    it('should emit a hwp-field marker for PAGE_COUNT field runs', () => {
      const para = makePara([
        { type: 'field', fieldType: 'PAGE_COUNT', text: '{전체페이지}' },
      ]);
      const el = renderParagraph(para);
      const marker = el.querySelector('.hwp-field[data-field="page-count"]');
      expect(marker).not.toBeNull();
    });
  });

  // ─── Phase 1.7: emphasis mark (symMark) ────────────────────
  describe('emphasis marks (symMark)', () => {
    it('should apply text-emphasis-style when run.style.symMark is set', () => {
      const para = makePara([
        makeRun('강조', { symMark: 'dot', color: '#ff0000' }),
      ]);
      const el = renderParagraph(para);
      const span = el.querySelector('.hwp-run');
      expect(span.style.textEmphasisStyle || span.style.webkitTextEmphasisStyle).toBe('dot');
    });
  });

  // ─── Phase 1.8: outline / shadow ───────────────────────────
  describe('outline and shadow text styles', () => {
    it('should apply webkitTextStroke when run.style.outline is true', () => {
      const para = makePara([
        makeRun('외곽선', { outline: true, color: '#000000' }),
      ]);
      const el = renderParagraph(para);
      const span = el.querySelector('.hwp-run');
      expect(span.style.webkitTextStroke).toContain('1px');
    });

    it('should apply default textShadow when run.style.shadow is true', () => {
      const para = makePara([
        makeRun('그림자', { shadow: true }),
      ]);
      const el = renderParagraph(para);
      const span = el.querySelector('.hwp-run');
      expect(span.style.textShadow).not.toBe('');
    });

    it('should preserve custom textShadowValue when provided', () => {
      const para = makePara([
        makeRun('맞춤그림자', { textShadowValue: '2px 2px 3px #888888' }),
      ]);
      const el = renderParagraph(para);
      const span = el.querySelector('.hwp-run');
      expect(span.style.textShadow).toContain('2px 2px 3px');
    });
  });
});

// ─── renderParagraphs ───────────────────────────────────────

describe('renderParagraphs', () => {
  it('should return a DocumentFragment', () => {
    const frag = renderParagraphs([]);
    expect(frag).toBeInstanceOf(DocumentFragment);
  });

  it('should render all paragraphs and append to fragment', () => {
    const paras = [
      makePara([makeRun('A')]),
      makePara([makeRun('B')]),
      makePara([makeRun('C')]),
    ];
    const frag = renderParagraphs(paras);
    expect(frag.children.length).toBe(3);
  });

  it('should preserve order of paragraphs', () => {
    const paras = [
      makePara([makeRun('First')]),
      makePara([makeRun('Second')]),
    ];
    const frag = renderParagraphs(paras);
    const divs = frag.querySelectorAll('.hwp-paragraph');
    expect(divs[0].querySelector('.hwp-run').textContent).toBe('First');
    expect(divs[1].querySelector('.hwp-run').textContent).toBe('Second');
  });
});
