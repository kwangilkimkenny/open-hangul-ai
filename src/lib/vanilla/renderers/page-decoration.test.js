/**
 * Page Decoration (border + watermark) Tests (★ Phase 2-6)
 */

import { describe, it, expect, vi } from 'vitest';

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

import { applyPageBorder, renderWatermark } from './page-decoration.js';

function makePage() {
  const el = document.createElement('div');
  el.className = 'hwp-page-container';
  return el;
}

describe('applyPageBorder()', () => {
  it('no-op when no pageBorder', () => {
    const page = makePage();
    applyPageBorder(page, {});
    expect(page.style.borderTop).toBe('');
  });

  it('applies four sides to OUTSIDE target by default', () => {
    const page = makePage();
    applyPageBorder(page, {
      pageBorder: {
        position: 'OUTSIDE',
        top: { type: 'SOLID', width: '1px', color: '#000' },
        right: { type: 'SOLID', width: '1px', color: '#000' },
        bottom: { type: 'SOLID', width: '1px', color: '#000' },
        left: { type: 'SOLID', width: '1px', color: '#000' },
      },
    });
    expect(page.style.borderTop).toContain('solid');
    expect(page.style.borderRight).toContain('solid');
    expect(page.style.borderBottom).toContain('solid');
    expect(page.style.borderLeft).toContain('solid');
    expect(page.getAttribute('data-page-border')).toBe('true');
  });

  it('applies to innerBody when position INSIDE', () => {
    const page = makePage();
    const inner = document.createElement('div');
    page.appendChild(inner);
    applyPageBorder(
      page,
      {
        pageBorder: {
          position: 'INSIDE',
          top: { type: 'DASH', width: '2px', color: '#f00' },
        },
      },
      { innerBody: inner }
    );
    expect(inner.style.borderTop).toContain('dashed');
    expect(page.style.borderTop).toBe(''); // outer page not affected
  });

  it('skips sides with type NONE', () => {
    const page = makePage();
    applyPageBorder(page, {
      pageBorder: {
        top: { type: 'NONE', width: '1px', color: '#000' },
        bottom: { type: 'SOLID', width: '1px', color: '#000' },
      },
    });
    expect(page.style.borderTop).toBe('');
    expect(page.style.borderBottom).toContain('solid');
  });

  it('converts DASH/DOT/DOUBLE border types', () => {
    const page = makePage();
    applyPageBorder(page, {
      pageBorder: {
        top: { type: 'DASH', width: '1px', color: '#000' },
        right: { type: 'DOT', width: '1px', color: '#000' },
        bottom: { type: 'DOUBLE', width: '3px', color: '#000' },
      },
    });
    expect(page.style.borderTop).toContain('dashed');
    expect(page.style.borderRight).toContain('dotted');
    expect(page.style.borderBottom).toContain('double');
  });
});

describe('renderWatermark()', () => {
  it('returns null when no watermark', () => {
    expect(renderWatermark({})).toBe(null);
  });

  it('renders text watermark with rotation + opacity', () => {
    const node = renderWatermark({
      watermark: {
        type: 'text',
        text: '대외비',
        rotation: -45,
        opacity: 0.4,
        color: '#999',
        fontSize: 120,
      },
    });
    expect(node).toBeInstanceOf(HTMLDivElement);
    expect(node.className).toBe('hwp-page-watermark');
    expect(node.textContent).toBe('대외비');
    const inner = node.firstChild;
    expect(inner.style.opacity).toBe('0.4');
    expect(inner.style.transform).toContain('rotate(-45deg)');
    expect(inner.style.fontSize).toBe('120px');
  });

  it('renders image watermark from images map', () => {
    const images = new Map([['img1', { url: 'blob:fake-url' }]]);
    const node = renderWatermark(
      { watermark: { type: 'image', imageBinaryItemIDRef: 'img1', opacity: 0.5 } },
      images
    );
    expect(node).toBeInstanceOf(HTMLDivElement);
    const img = node.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.src).toBe('blob:fake-url');
    expect(img.style.opacity).toBe('0.5');
  });

  it('returns null for image watermark when referenced image missing', () => {
    const node = renderWatermark(
      { watermark: { type: 'image', imageBinaryItemIDRef: 'missing' } },
      new Map()
    );
    expect(node).toBe(null);
  });

  it('returns null for text watermark when text is empty', () => {
    const node = renderWatermark({ watermark: { type: 'text', text: '' } });
    expect(node).toBe(null);
  });

  it('also accepts section.background as alias', () => {
    const node = renderWatermark({ background: { type: 'text', text: 'BG' } });
    expect(node).toBeTruthy();
    expect(node.textContent).toBe('BG');
  });

  it('layer is absolute and covers the page', () => {
    const node = renderWatermark({ watermark: { type: 'text', text: 'X' } });
    expect(node.style.position).toBe('absolute');
    expect(node.style.top).toBe('0px');
    expect(node.style.left).toBe('0px');
    expect(node.style.right).toBe('0px');
    expect(node.style.bottom).toBe('0px');
    expect(node.style.pointerEvents).toBe('none');
  });
});
