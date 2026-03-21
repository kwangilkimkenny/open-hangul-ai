import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

vi.mock('./paragraph.js', () => ({
  renderParagraph: vi.fn((para) => {
    const d = document.createElement('div');
    d.textContent = para?.runs?.[0]?.text || '';
    return d;
  }),
}));

vi.mock('./table.js', () => ({
  renderTable: vi.fn(() => {
    const w = document.createElement('div');
    w.appendChild(document.createElement('table'));
    return w;
  }),
}));

import { renderShape } from './shape.js';
import { renderParagraph } from './paragraph.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderShape', () => {
  it('should create a div with correct class for rectangle shape', () => {
    const result = renderShape({ shapeType: 'rect', width: 200, height: 100 });

    expect(result.tagName).toBe('DIV');
    expect(result.className).toContain('hwp-shape');
    expect(result.className).toContain('hwp-shape-rect');
  });

  it('should apply borderRadius 50% for ellipse/circle shapes', () => {
    const ellipse = renderShape({ shapeType: 'ellipse', width: 100, height: 100 });
    expect(ellipse.style.borderRadius).toBe('50%');

    const circle = renderShape({ shapeType: 'circle', width: 80, height: 80 });
    expect(circle.style.borderRadius).toBe('50%');
  });

  it('should create an SVG element for line shapes', () => {
    const result = renderShape({ shapeType: 'line', x0: 0, y0: 0, x1: 100, y1: 50 });

    expect(result.tagName).toBe('svg');
    expect(result.getAttribute('class')).toBe('hwp-shape-line');

    const lineElem = result.querySelector('line');
    expect(lineElem).not.toBeNull();
    expect(lineElem.getAttribute('stroke')).toBe('#000000');
  });

  it('should set backgroundColor when fillColor is provided', () => {
    const result = renderShape({ shapeType: 'rect', width: 600, height: 100, fillColor: '#ff0000' });

    expect(result.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('should set border when both strokeColor and strokeWidth are provided', () => {
    const result = renderShape({
      shapeType: 'rect',
      width: 600,
      height: 100,
      strokeColor: '#0000ff',
      strokeWidth: 2,
    });

    expect(result.style.border).toContain('2px');
    expect(result.style.border).toContain('solid');
  });

  it('should set inline-block display for treatAsChar shapes', () => {
    const result = renderShape({
      shapeType: 'rect',
      width: 600,
      height: 50,
      position: { treatAsChar: true },
    });

    // For small shapes (<500), the final enforcement sets display to inline-block
    // For larger shapes, the position branch sets it
    expect(result.style.display).toContain('inline-block');
  });

  it('should set position absolute and zIndex -1 for background shapes', () => {
    const result = renderShape({
      shapeType: 'rect',
      width: 600,
      height: 400,
      isBackground: true,
      position: { x: 10, y: 20 },
    });

    expect(result.style.position).toBe('absolute');
    expect(result.style.zIndex).toBe('-1');
    expect(result.style.left).toBe('10px');
    expect(result.style.top).toBe('20px');
  });

  it('should apply absolute positioning with x and y coordinates', () => {
    const result = renderShape({
      shapeType: 'rect',
      width: 600,
      height: 100,
      position: { x: 150, y: 200 },
    });

    expect(result.style.position).toBe('absolute');
    expect(result.style.left).toBe('150px');
    expect(result.style.top).toBe('200px');
  });

  it('should render paragraphs inside drawText', () => {
    const paras = [
      { runs: [{ text: 'Hello' }] },
      { runs: [{ text: 'World' }] },
    ];

    const result = renderShape({
      shapeType: 'rect',
      width: 600,
      height: 100,
      drawText: { paragraphs: paras },
    });

    expect(renderParagraph).toHaveBeenCalledTimes(2);
    const textContainer = result.querySelector('.hwp-shape-drawtext');
    expect(textContainer).not.toBeNull();
    expect(textContainer.childNodes.length).toBe(2);
  });

  it('should apply width and height with !important via setProperty', () => {
    const result = renderShape({ shapeType: 'rect', width: 300, height: 150 });

    // For shapes < 500px, final enforcement uses setAttribute('style', ...)
    const styleAttr = result.getAttribute('style');
    expect(styleAttr).toContain('width: 300px !important');
    expect(styleAttr).toContain('height: 150px !important');
  });

  it('should calculate borderRadius for rect shapes with borderRadius property', () => {
    const result = renderShape({
      shapeType: 'rect',
      width: 200,
      height: 100,
      borderRadius: 50, // 50% of minDimension * 0.7
    });

    // minDimension = 100, radius = (50/100) * 100 * 0.7 = 35
    const styleAttr = result.getAttribute('style') || '';
    // borderRadius may be in the style attribute or inline
    expect(styleAttr).toContain('border-radius');
  });

  it('should handle null or invalid images parameter gracefully', () => {
    // Pass a non-Map as images
    expect(() => renderShape({ shapeType: 'rect', width: 600, height: 100 }, 'not-a-map')).not.toThrow();
    expect(() => renderShape({ shapeType: 'rect', width: 600, height: 100 }, null)).not.toThrow();
    expect(() => renderShape({ shapeType: 'rect', width: 600, height: 100 }, undefined)).not.toThrow();
  });

  it('should apply stroke color and width to SVG line elements', () => {
    const result = renderShape({
      shapeType: 'line',
      x0: 10, y0: 20, x1: 110, y1: 70,
      strokeColor: '#ff0000',
      strokeWidth: 3,
    });

    const lineElem = result.querySelector('line');
    expect(lineElem.getAttribute('stroke')).toBe('#ff0000');
    expect(lineElem.getAttribute('stroke-width')).toBe('3');
  });
});
