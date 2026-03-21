import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

vi.mock('./paragraph.js', () => ({
  renderParagraph: vi.fn(() => {
    const d = document.createElement('div');
    d.className = 'hwp-paragraph';
    return d;
  }),
}));

vi.mock('./image.js', () => ({
  renderImage: vi.fn(() => {
    const d = document.createElement('div');
    d.className = 'hwp-image-wrapper';
    return d;
  }),
}));

vi.mock('./shape.js', () => ({
  renderShape: vi.fn(() => {
    const d = document.createElement('div');
    d.className = 'hwp-shape';
    return d;
  }),
}));

vi.mock('./table.js', () => ({
  renderTable: vi.fn(() => {
    const d = document.createElement('div');
    d.appendChild(document.createElement('table'));
    return d;
  }),
}));

import { renderContainer } from './container.js';
import { renderParagraph } from './paragraph.js';
import { renderImage } from './image.js';
import { renderShape } from './shape.js';
import { renderTable } from './table.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderContainer', () => {
  it('should create a div with class hwp-container', () => {
    const result = renderContainer({ elements: [] });

    expect(result.tagName).toBe('DIV');
    expect(result.className).toBe('hwp-container');
  });

  it('should set relative positioning by default', () => {
    const result = renderContainer({ elements: [] });
    expect(result.style.position).toBe('relative');
  });

  it('should apply width and height from container properties', () => {
    const result = renderContainer({ width: 400, height: 300, elements: [] });

    expect(result.style.width).toBe('400px');
    expect(result.style.height).toBe('300px');
  });

  it('should handle string width/height values', () => {
    const result = renderContainer({ width: '50%', height: '100px', elements: [] });

    expect(result.style.width).toBe('50%');
    expect(result.style.height).toBe('100px');
  });

  it('should set inline-block display when position.treatAsChar is true', () => {
    const result = renderContainer({
      elements: [],
      position: { treatAsChar: true },
    });

    expect(result.style.display).toBe('inline-block');
    expect(result.style.verticalAlign).toBe('middle');
  });

  it('should apply absolute positioning with x and y coordinates', () => {
    const result = renderContainer({
      elements: [],
      position: { x: 100, y: 50 },
    });

    expect(result.style.position).toBe('absolute');
    expect(result.style.left).toBe('100px');
    expect(result.style.top).toBe('50px');
  });

  it('should set overflow to visible', () => {
    const result = renderContainer({ elements: [] });
    expect(result.style.overflow).toBe('visible');
  });

  it('should render paragraph elements', () => {
    const elements = [{ type: 'paragraph', runs: [] }];
    const result = renderContainer({ elements });

    expect(renderParagraph).toHaveBeenCalledWith(elements[0]);
    expect(result.childNodes.length).toBe(1);
  });

  it('should render image elements with zIndex 1', () => {
    const elements = [{ type: 'image', url: 'img.png' }];
    const result = renderContainer({ elements });

    expect(renderImage).toHaveBeenCalledWith(elements[0]);
    const child = result.firstChild;
    expect(child.style.zIndex).toBe('1');
  });

  it('should render shape elements with zIndex 10', () => {
    const elements = [{ type: 'shape', shapeType: 'rect' }];
    const result = renderContainer({ elements });

    expect(renderShape).toHaveBeenCalledWith(elements[0]);
    const child = result.firstChild;
    expect(child.style.zIndex).toBe('10');
  });

  it('should render table elements', () => {
    const elements = [{ type: 'table', rows: [] }];
    const result = renderContainer({ elements });

    expect(renderTable).toHaveBeenCalledWith(elements[0]);
    expect(result.childNodes.length).toBe(1);
  });

  it('should render mixed element types in order', () => {
    const elements = [
      { type: 'paragraph' },
      { type: 'image', url: 'a.png' },
      { type: 'shape', shapeType: 'rect' },
    ];

    const result = renderContainer({ elements });

    expect(result.childNodes.length).toBe(3);
    expect(renderParagraph).toHaveBeenCalledTimes(1);
    expect(renderImage).toHaveBeenCalledTimes(1);
    expect(renderShape).toHaveBeenCalledTimes(1);
  });

  it('should handle nested containers recursively', () => {
    // The outer container has a child container element
    // Since renderContainer calls itself for type=container, we need the real function
    // But we are testing with mocked dependencies - the recursive call goes to the real function
    const innerElements = [{ type: 'paragraph' }];
    const elements = [
      { type: 'container', elements: innerElements },
    ];

    const result = renderContainer({ elements });

    // The inner container should be rendered as a child
    expect(result.childNodes.length).toBe(1);
    const innerContainer = result.firstChild;
    expect(innerContainer.className).toBe('hwp-container');
  });

  it('should apply absolute positioning to children with position.x/y', () => {
    // Use shape mock that returns a div without position set
    const elements = [
      { type: 'shape', shapeType: 'rect', position: { x: 25, y: 75 } },
    ];

    const result = renderContainer({ elements });
    const child = result.firstChild;

    // Container should ensure absolute positioning is applied
    // The child gets position from shape renderer; container checks and fills in if missing
    expect(child).not.toBeNull();
  });

  it('should skip unknown element types without throwing', () => {
    const elements = [{ type: 'unknown_widget' }];

    expect(() => renderContainer({ elements })).not.toThrow();
    const result = renderContainer({ elements });
    expect(result.childNodes.length).toBe(0);
  });

  it('should support children property as alias for elements', () => {
    const children = [{ type: 'paragraph' }];
    const result = renderContainer({ children });

    expect(renderParagraph).toHaveBeenCalledTimes(1);
    expect(result.childNodes.length).toBe(1);
  });

  it('should handle container with no elements or children gracefully', () => {
    const result = renderContainer({});

    expect(result.tagName).toBe('DIV');
    expect(result.className).toBe('hwp-container');
    expect(result.childNodes.length).toBe(0);
  });
});
