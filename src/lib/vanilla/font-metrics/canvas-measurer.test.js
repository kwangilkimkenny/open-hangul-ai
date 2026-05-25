import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { measureFontByCanvas, measurementToFontMetrics } from './canvas-measurer.js';

/**
 * jsdom 의 canvas.getContext('2d') 가 반환하는 모킹 컨텍스트에 measureText 가
 * 없으므로, 측정 가능한 모킹 컨텍스트를 주입해 테스트한다.
 */
function installMeasuringCanvas() {
  /** @type {Record<string, {width:number, ascent:number, descent:number}>} */
  const widths = {
    H: { width: 70, ascent: 70, descent: 10 },
    x: { width: 50, ascent: 50, descent: 0 },
    M: { width: 80, ascent: 70, descent: 0 },
    가: { width: 100, ascent: 80, descent: 20 },
    한: { width: 100, ascent: 80, descent: 20 },
    홍: { width: 100, ascent: 80, descent: 20 },
    문: { width: 100, ascent: 80, descent: 20 },
    김: { width: 100, ascent: 80, descent: 20 },
    이: { width: 100, ascent: 80, descent: 20 },
    박: { width: 100, ascent: 80, descent: 20 },
  };

  const mockCtx = {
    font: '',
    textBaseline: 'alphabetic',
    measureText: vi.fn((text) => {
      const w = widths[text];
      if (!w) return { width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 };
      return {
        width: w.width,
        actualBoundingBoxAscent: w.ascent,
        actualBoundingBoxDescent: w.descent,
      };
    }),
  };

  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx);
  return () => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
  };
}

describe('canvas-measurer', () => {
  /** @type {() => void} */
  let restore = () => {};

  beforeEach(() => {
    // OffscreenCanvas 가 jsdom 에 있으면 path 가 그쪽으로 가버리므로 차단
    /** @type {any} */ (globalThis).OffscreenCanvas = undefined;
    restore = installMeasuringCanvas();
  });

  afterEach(() => {
    restore();
  });

  it('returns measured metrics when canvas is available', () => {
    const m = measureFontByCanvas('Noto Sans KR');
    expect(m.measured).toBe(true);
    expect(m.ascent).toBeGreaterThan(0);
    expect(m.descent).toBeLessThan(0);
  });

  it('hangulAdvance averages multiple syllables', () => {
    const m = measureFontByCanvas('맑은 고딕');
    expect(m.hangulAdvance).toBeCloseTo(1.0, 5); // 100 / 100 = 1.0
    expect(m.latinAdvance).toBeCloseTo(0.8, 5);  // 80 / 100
  });

  it('falls back to defaults for empty fontFamily input', () => {
    const m = measureFontByCanvas('');
    expect(m.measured).toBe(false);
    expect(m.hangulAdvance).toBeCloseTo(1.0, 2);
  });

  it('falls back when canvas is unavailable', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
    const m = measureFontByCanvas('Noto Sans KR');
    expect(m.measured).toBe(false);
  });

  it('measurementToFontMetrics produces 1000-em FontMetrics', () => {
    const m = measurementToFontMetrics('Noto Sans KR', {
      ascent: 0.88,
      descent: -0.22,
      capHeight: 0.70,
      xHeight: 0.50,
      hangulAdvance: 1.0,
      latinAdvance: 0.56,
      measured: true,
    });
    expect(m.unitsPerEm).toBe(1000);
    expect(m.ascent).toBe(880);
    expect(m.descent).toBe(-220);
    expect(m.capHeight).toBe(700);
    expect(m.source).toBe('canvas');
    expect(m.familyName).toBe('Noto Sans KR');
  });
});
