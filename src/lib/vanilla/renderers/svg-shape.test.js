import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { renderSVGShape, parseGradientCSS } from './svg-shape.js';

beforeEach(() => vi.clearAllMocks());

describe('parseGradientCSS', () => {
  it('should parse linear-gradient with angle', () => {
    const g = parseGradientCSS('linear-gradient(45deg, #ff0000, #0000ff)');
    expect(g).not.toBeNull();
    expect(g.type).toBe('linear');
    expect(g.angle).toBe(45);
    expect(g.colors).toEqual(['#ff0000', '#0000ff']);
  });

  it('should parse radial-gradient with circle keyword', () => {
    const g = parseGradientCSS('radial-gradient(circle, #ff0000, #00ff00, #0000ff)');
    expect(g).not.toBeNull();
    expect(g.type).toBe('radial');
    expect(g.colors).toEqual(['#ff0000', '#00ff00', '#0000ff']);
  });

  it('should return null for invalid input', () => {
    expect(parseGradientCSS(null)).toBeNull();
    expect(parseGradientCSS('not-a-gradient')).toBeNull();
    expect(parseGradientCSS('')).toBeNull();
  });

  it('should handle gradient with no angle prefix', () => {
    const g = parseGradientCSS('linear-gradient(#fff, #000)');
    expect(g).not.toBeNull();
    expect(g.angle).toBe(0);
    expect(g.colors).toEqual(['#fff', '#000']);
  });
});

describe('renderSVGShape - basic shapes', () => {
  it('should render a rect via SVG with width/height attributes', () => {
    const wrapper = renderSVGShape({ shapeType: 'rect', width: 200, height: 100 });
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper.className).toContain('hwp-shape-svg');

    const svg = wrapper.querySelector('svg');
    expect(svg).not.toBeNull();
    const rect = svg.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect.getAttribute('width')).toBe('200');
    expect(rect.getAttribute('height')).toBe('100');
  });

  it('should render an ellipse', () => {
    const wrapper = renderSVGShape({ shapeType: 'ellipse', width: 80, height: 60 });
    const ellipse = wrapper.querySelector('ellipse');
    expect(ellipse).not.toBeNull();
    expect(ellipse.getAttribute('rx')).toBe('40');
    expect(ellipse.getAttribute('ry')).toBe('30');
  });

  it('should render a polygon', () => {
    const wrapper = renderSVGShape({
      shapeType: 'polygon',
      width: 100,
      height: 100,
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 25, y: 30 },
      ],
    });
    const polygon = wrapper.querySelector('polygon');
    expect(polygon).not.toBeNull();
    expect(polygon.getAttribute('points')).toContain('0,0');
  });

  it('should render a curve as path', () => {
    const wrapper = renderSVGShape({
      shapeType: 'curve',
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 30 },
      ],
    });
    const path = wrapper.querySelector('path');
    expect(path).not.toBeNull();
    expect(path.getAttribute('d')).toContain('C ');
  });

  it('should render an arc as path with A command', () => {
    const wrapper = renderSVGShape({ shapeType: 'arc', width: 100, height: 100 });
    const path = wrapper.querySelector('path');
    expect(path).not.toBeNull();
    expect(path.getAttribute('d')).toContain('A ');
  });
});

describe('renderSVGShape - fill and stroke', () => {
  it('should apply fillColor', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      fillColor: '#ff0000',
    });
    const rect = wrapper.querySelector('rect');
    expect(rect.getAttribute('fill')).toBe('#ff0000');
  });

  it('should apply stroke when strokeColor + strokeWidth given', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      strokeColor: '#0000ff',
      strokeWidth: 2,
    });
    const rect = wrapper.querySelector('rect');
    expect(rect.getAttribute('stroke')).toBe('#0000ff');
    expect(rect.getAttribute('stroke-width')).toBe('2');
  });

  it('should default fill=none for line', () => {
    const wrapper = renderSVGShape({
      shapeType: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 5 },
      ],
    });
    const polyline = wrapper.querySelector('polyline');
    expect(polyline.getAttribute('fill')).toBe('none');
  });
});

describe('renderSVGShape - gradient', () => {
  it('should create a linearGradient in defs and reference it', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      gradientCSS: 'linear-gradient(45deg, #ff0000, #0000ff)',
    });
    const defs = wrapper.querySelector('defs');
    const grad = defs.querySelector('linearGradient');
    expect(grad).not.toBeNull();
    const stops = grad.querySelectorAll('stop');
    expect(stops.length).toBe(2);

    const rect = wrapper.querySelector('rect');
    const fill = rect.getAttribute('fill');
    expect(fill).toMatch(/^url\(#/);
    expect(fill).toContain(grad.getAttribute('id'));
  });

  it('should create a radialGradient when CSS is radial', () => {
    const wrapper = renderSVGShape({
      shapeType: 'ellipse',
      width: 100,
      height: 100,
      gradientCSS: 'radial-gradient(circle, #ffffff, #000000)',
    });
    const grad = wrapper.querySelector('defs radialGradient');
    expect(grad).not.toBeNull();
  });
});

describe('renderSVGShape - shadow and effects', () => {
  it('should apply drop-shadow filter when shape.shadow is set', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      shadow: { color: '#000000', offsetX: 2, offsetY: 2, blur: 3 },
    });
    const filter = wrapper.querySelector('defs filter');
    expect(filter).not.toBeNull();
    const fe = filter.querySelector('feDropShadow');
    expect(fe).not.toBeNull();
    expect(fe.getAttribute('dx')).toBe('2');
    expect(fe.getAttribute('dy')).toBe('2');
    expect(fe.getAttribute('stdDeviation')).toBe('3');
  });

  it('should apply rotation transform on the group', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 50,
      rotation: 45,
    });
    const g = wrapper.querySelector('svg > g');
    expect(g.getAttribute('transform')).toContain('rotate(45');
  });

  it('should apply bevel filter when effect.bevel is set', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      effect: { bevel: true },
    });
    const filter = wrapper.querySelector('defs filter');
    expect(filter).not.toBeNull();
    const spec = filter.querySelector('feSpecularLighting');
    expect(spec).not.toBeNull();
  });
});

describe('renderSVGShape - wrap modes', () => {
  it('BEHIND_TEXT should set z-index -1 and absolute', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      position: { textWrap: 'BEHIND_TEXT', x: 10, y: 20 },
    });
    expect(wrapper.style.position).toBe('absolute');
    expect(wrapper.style.zIndex).toBe('-1');
    expect(wrapper.style.pointerEvents).toBe('none');
    expect(wrapper.style.left).toBe('10px');
  });

  it('IN_FRONT_OF_TEXT should set z-index 10', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      position: { textWrap: 'IN_FRONT_OF_TEXT', x: 5, y: 5 },
    });
    expect(wrapper.style.position).toBe('absolute');
    expect(wrapper.style.zIndex).toBe('10');
  });

  it('SQUARE should set float and shape-outside', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      position: { textWrap: 'SQUARE' },
    });
    expect(wrapper.style.float).toBe('left');
    // jsdom drops the shape-outside CSS value, so verify via data-shape-outside fallback
    expect(wrapper.getAttribute('data-wrap')).toBe('SQUARE');
    expect(wrapper.getAttribute('data-shape-outside')).toContain('rectangle');
  });

  it('TIGHT should set polygon shape-outside when polygon points are present', () => {
    const wrapper = renderSVGShape({
      shapeType: 'polygon',
      width: 60,
      height: 40,
      points: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 30, y: 40 },
      ],
      position: { textWrap: 'TIGHT' },
    });
    expect(wrapper.getAttribute('data-wrap')).toBe('TIGHT');
    expect(wrapper.getAttribute('data-shape-outside')).toContain('polygon');
    expect(wrapper.style.float).toBe('left');
  });

  it('TOP_AND_BOTTOM should set block + clear both', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 50,
      position: { textWrap: 'TOP_AND_BOTTOM' },
    });
    expect(wrapper.style.display).toBe('block');
    expect(wrapper.style.clear).toBe('both');
  });

  it('THROUGH should fall back to SQUARE-like behavior', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      position: { textWrap: 'THROUGH' },
    });
    expect(wrapper.style.float).toBe('left');
  });
});

describe('renderSVGShape - drawText foreignObject', () => {
  it('should embed paragraphs in foreignObject when renderParagraph is provided', () => {
    const renderParagraph = vi.fn(para => {
      const d = document.createElement('div');
      d.textContent = para?.runs?.[0]?.text || '';
      return d;
    });
    const wrapper = renderSVGShape(
      {
        shapeType: 'rect',
        width: 200,
        height: 100,
        drawText: {
          vertAlign: 'CENTER',
          paragraphs: [{ runs: [{ text: 'hello' }] }, { runs: [{ text: 'world' }] }],
        },
      },
      { renderParagraph }
    );

    expect(renderParagraph).toHaveBeenCalledTimes(2);
    const fo = wrapper.querySelector('foreignObject');
    expect(fo).not.toBeNull();
    const text = fo.textContent;
    expect(text).toContain('hello');
    expect(text).toContain('world');
  });

  it('should skip drawText when renderParagraph is missing', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 100,
      height: 100,
      drawText: { paragraphs: [{ runs: [{ text: 'x' }] }] },
    });
    expect(wrapper.querySelector('foreignObject')).toBeNull();
  });
});

describe('renderSVGShape - group children', () => {
  it('should render child shapes inside an SVG <g>', () => {
    const wrapper = renderSVGShape({
      shapeType: 'rect',
      width: 200,
      height: 200,
      children: [
        { shapeType: 'ellipse', width: 50, height: 50, fillColor: '#ff0000' },
        { shapeType: 'rect', width: 30, height: 30, fillColor: '#00ff00' },
      ],
    });
    const groups = wrapper.querySelectorAll('svg > g');
    // 1 main group + 1 children group
    expect(groups.length).toBeGreaterThanOrEqual(2);
    // child ellipse + rect should be in the document
    expect(wrapper.querySelector('ellipse')).not.toBeNull();
    expect(wrapper.querySelectorAll('rect').length).toBeGreaterThanOrEqual(2);
  });
});

describe('renderSVGShape - empty/null safety', () => {
  it('should not throw on null shape', () => {
    expect(() => renderSVGShape(null)).not.toThrow();
    const out = renderSVGShape(null);
    expect(out.className).toContain('hwp-shape-empty');
  });
});
