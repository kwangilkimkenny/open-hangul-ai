/**
 * RGB → CMYK 변환기 단위 테스트.
 * 표준 알고리즘 검증을 위한 대표 색상 12종.
 */

import {
  rgbToCmyk,
  cmykToRgb,
  hexToCmyk,
  parseColorString,
  toPdfLibCmyk,
} from './color-converter.js';

/**
 * 두 CMYK 가 ±tol 범위에서 같은지 비교.
 */
function expectCmykClose(actual, expected, tol = 0.005) {
  expect(actual.c).toBeGreaterThanOrEqual(expected.c - tol);
  expect(actual.c).toBeLessThanOrEqual(expected.c + tol);
  expect(actual.m).toBeGreaterThanOrEqual(expected.m - tol);
  expect(actual.m).toBeLessThanOrEqual(expected.m + tol);
  expect(actual.y).toBeGreaterThanOrEqual(expected.y - tol);
  expect(actual.y).toBeLessThanOrEqual(expected.y + tol);
  expect(actual.k).toBeGreaterThanOrEqual(expected.k - tol);
  expect(actual.k).toBeLessThanOrEqual(expected.k + tol);
}

describe('rgbToCmyk — 표준 알고리즘 검증', () => {
  it('순백 #ffffff → (0,0,0,0)', () => {
    expectCmykClose(rgbToCmyk(255, 255, 255), { c: 0, m: 0, y: 0, k: 0 });
  });

  it('순흑 #000000 → (0,0,0,1)', () => {
    expectCmykClose(rgbToCmyk(0, 0, 0), { c: 0, m: 0, y: 0, k: 1 });
  });

  it('순적 #ff0000 → (0,1,1,0)', () => {
    expectCmykClose(rgbToCmyk(255, 0, 0), { c: 0, m: 1, y: 1, k: 0 });
  });

  it('순녹 #00ff00 → (1,0,1,0)', () => {
    expectCmykClose(rgbToCmyk(0, 255, 0), { c: 1, m: 0, y: 1, k: 0 });
  });

  it('순청 #0000ff → (1,1,0,0)', () => {
    expectCmykClose(rgbToCmyk(0, 0, 255), { c: 1, m: 1, y: 0, k: 0 });
  });

  it('시안 #00ffff → (1,0,0,0)', () => {
    expectCmykClose(rgbToCmyk(0, 255, 255), { c: 1, m: 0, y: 0, k: 0 });
  });

  it('마젠타 #ff00ff → (0,1,0,0)', () => {
    expectCmykClose(rgbToCmyk(255, 0, 255), { c: 0, m: 1, y: 0, k: 0 });
  });

  it('옐로우 #ffff00 → (0,0,1,0)', () => {
    expectCmykClose(rgbToCmyk(255, 255, 0), { c: 0, m: 0, y: 1, k: 0 });
  });

  it('중간 회색 #808080 → 약 (0,0,0,0.5)', () => {
    const r = rgbToCmyk(128, 128, 128);
    expect(r.c).toBeCloseTo(0, 5);
    expect(r.m).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(0, 5);
    expect(r.k).toBeGreaterThan(0.49);
    expect(r.k).toBeLessThan(0.51);
  });

  it('25% 회색 #bfbfbf → K≈0.25', () => {
    const r = rgbToCmyk(191, 191, 191);
    expect(r.c).toBeCloseTo(0, 5);
    expect(r.k).toBeGreaterThan(0.24);
    expect(r.k).toBeLessThan(0.26);
  });

  it('75% 회색 #404040 → K≈0.75', () => {
    const r = rgbToCmyk(64, 64, 64);
    expect(r.k).toBeGreaterThan(0.74);
    expect(r.k).toBeLessThan(0.76);
  });

  it('어두운 빨강 #800000 → C=0, M=Y=1, K≈0.5', () => {
    const r = rgbToCmyk(128, 0, 0);
    expect(r.c).toBeCloseTo(0, 5);
    expect(r.m).toBeCloseTo(1, 5);
    expect(r.y).toBeCloseTo(1, 5);
    expect(r.k).toBeGreaterThan(0.49);
    expect(r.k).toBeLessThan(0.51);
  });

  it('범위 밖 입력은 클램프된다', () => {
    expectCmykClose(rgbToCmyk(-10, 999, NaN), { c: 1, m: 0, y: 1, k: 0 });
  });
});

describe('hexToCmyk / parseColorString', () => {
  it('#FF0000 (대문자) 도 처리', () => {
    expectCmykClose(hexToCmyk('#FF0000'), { c: 0, m: 1, y: 1, k: 0 });
  });

  it('#f00 (3자리 단축형) 도 처리', () => {
    expectCmykClose(hexToCmyk('#f00'), { c: 0, m: 1, y: 1, k: 0 });
  });

  it('rgb(0, 255, 0) → 순녹', () => {
    const rgb = parseColorString('rgb(0, 255, 0)');
    expect(rgb).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('rgba 알파 무시', () => {
    const rgb = parseColorString('rgba(255, 0, 0, 0.5)');
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('잘못된 문자열 → 검정 fallback', () => {
    expect(parseColorString('not-a-color')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColorString('')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('cmykToRgb (역연산)', () => {
  it('CMYK 순흑 → RGB 검정', () => {
    expect(cmykToRgb(0, 0, 0, 1)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('CMYK 빨강 (0,1,1,0) → RGB 빨강', () => {
    expect(cmykToRgb(0, 1, 1, 0)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('순백 라운드트립', () => {
    const c = rgbToCmyk(255, 255, 255);
    const back = cmykToRgb(c.c, c.m, c.y, c.k);
    expect(back).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('toPdfLibCmyk', () => {
  it('튜플로 변환', () => {
    const arr = toPdfLibCmyk({ c: 0.1, m: 0.2, y: 0.3, k: 0.4 });
    expect(arr).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('범위 밖 값은 클램프', () => {
    const arr = toPdfLibCmyk({ c: -1, m: 2, y: 0.5, k: NaN });
    expect(arr).toEqual([0, 1, 0.5, 0]);
  });
});
