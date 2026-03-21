import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

vi.mock('./shape.js', () => ({ renderShape: vi.fn(() => document.createElement('div')) }));
vi.mock('./container.js', () => ({ renderContainer: vi.fn(() => document.createElement('div')) }));

import { renderImage, applyImageOptimizations, clearImageCache } from './image.js';
import { renderShape } from './shape.js';
import { renderContainer } from './container.js';

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback) {
    this._callback = callback;
    this._entries = [];
  }
  observe(target) {
    this._entries.push(target);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IntersectionObserver = MockIntersectionObserver;
});

afterEach(() => {
  clearImageCache();
});

describe('renderImage', () => {
  it('should render a basic image with url', () => {
    const result = renderImage({ url: 'https://example.com/img.png', width: 200, height: 100 });

    expect(result).not.toBeNull();
    expect(result.tagName).toBe('DIV');
    expect(result.className).toContain('hwp-image-wrapper');

    const img = result.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.className).toBe('hwp-image');
  });

  it('should render an image using src as fallback when url is absent', () => {
    const result = renderImage({ src: 'https://example.com/fallback.png', width: 100, height: 50 });

    expect(result).not.toBeNull();
    const img = result.querySelector('img');
    expect(img).not.toBeNull();
    // data-src should be set (lazy loading)
    expect(img.getAttribute('data-src')).toBe('https://example.com/fallback.png');
  });

  it('should return null when neither url nor src is provided', () => {
    const result = renderImage({ width: 100, height: 50 });
    expect(result).toBeNull();
  });

  it('should apply width and height styles to the wrapper', () => {
    const result = renderImage({ url: 'img.png', width: 300, height: 200 });

    expect(result.style.width).toBe('300px');
    expect(result.style.height).toBe('200px');
  });

  it('should render inline image when position.treatAsChar is true', () => {
    const result = renderImage({
      url: 'img.png',
      width: 100,
      height: 80,
      position: { treatAsChar: true },
    });

    expect(result.style.display).toBe('inline-block');
    expect(result.style.verticalAlign).toBe('middle');
  });

  it('should render absolute-positioned image with x and y', () => {
    const result = renderImage({
      url: 'img.png',
      width: 200,
      height: 150,
      position: { x: 50, y: 30 },
    });

    expect(result.style.position).toBe('absolute');
    expect(result.style.left).toBe('50px');
    expect(result.style.top).toBe('30px');
  });

  it('should constrain large images exceeding 680px content area', () => {
    const result = renderImage({ url: 'img.png', width: 900, height: 600 });

    // Width > 680 should set maxWidth constraint
    expect(result.style.maxWidth).toBe('680px');
    expect(result.style.width).toBe('auto');
  });

  it('should apply lazy loading with data-src and placeholder class', () => {
    const result = renderImage({ url: 'https://example.com/lazy.png', width: 200, height: 100 });

    const img = result.querySelector('img');
    expect(img.getAttribute('data-src')).toBe('https://example.com/lazy.png');
    expect(result.classList.contains('hwp-lazy-placeholder')).toBe(true);
  });

  it('should set alt text on the img element', () => {
    const result = renderImage({ url: 'img.png', alt: 'Test image', width: 100, height: 100 });

    const img = result.querySelector('img');
    expect(img.alt).toBe('Test image');
  });

  it('should render children shapes and containers inside the wrapper', () => {
    const children = [
      { type: 'shape', shapeType: 'rect' },
      { type: 'container', elements: [] },
    ];

    const result = renderImage({ url: 'img.png', width: 200, height: 200, children });

    // img + 2 children = 3 child nodes
    expect(result.childNodes.length).toBe(3);
    expect(renderShape).toHaveBeenCalledWith(children[0]);
    expect(renderContainer).toHaveBeenCalledWith(children[1]);
  });

  it('should clear the image cache without errors', () => {
    // Just verify it does not throw
    expect(() => clearImageCache()).not.toThrow();
  });

  it('should set error handler that updates alt text on load failure', () => {
    const result = renderImage({ url: 'img.png', width: 100, height: 100 });
    const img = result.querySelector('img');

    // Simulate error
    img.onerror();

    expect(img.alt).toBe('이미지 로드 실패');
    expect(img.style.backgroundColor).toBe('rgb(255, 235, 238)');
    expect(img.style.opacity).toBe('1');
  });
});

describe('applyImageOptimizations', () => {
  it('should set decoding, transition, and lazy-load attributes on the element', () => {
    const img = document.createElement('img');
    const wrapper = document.createElement('div');

    applyImageOptimizations(img, 'https://example.com/opt.png', wrapper);

    expect(img.decoding).toBe('async');
    expect(img.style.transition).toBe('opacity 0.3s ease');
    // data-src set by lazy loading
    expect(img.getAttribute('data-src')).toBe('https://example.com/opt.png');
  });

  it('should return early when src is falsy', () => {
    const img = document.createElement('img');
    applyImageOptimizations(img, '', null);

    expect(img.decoding).not.toBe('async');
  });

  it('should return early when imgElem is falsy', () => {
    expect(() => applyImageOptimizations(null, 'src.png', null)).not.toThrow();
  });
});
