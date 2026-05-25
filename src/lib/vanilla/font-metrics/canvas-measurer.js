/**
 * Canvas Font Measurer
 *
 * TextMetrics API + offscreen `<canvas>` 로 시스템에 설치된 폰트의 메트릭을
 * 측정한다. opentype.js / 카탈로그 모두 매치 실패했을 때의 최후 fallback.
 *
 * **측정 항목**
 *   - 한글 음절(가/한/홍/문/김/이/박)의 평균 advance width
 *   - 라틴 대문자 'M' 의 advance width
 *   - actualBoundingBoxAscent / Descent (대문자 'H' 기준)
 *   - x-height 추정(소문자 'x' 의 actualBoundingBoxAscent)
 *   - cap-height 추정(대문자 'H' 의 actualBoundingBoxAscent)
 *
 * 결과는 모두 em 단위로 정규화(기준 fontSize 100px → 1 em = 100px).
 *
 * Node/jsdom 환경에서는 `document.createElement('canvas').getContext('2d')`
 * 가 null 을 반환할 수 있다. 그 경우 보수적인 기본값을 반환한다.
 *
 * @module font-metrics/canvas-measurer
 * @version 1.0.0
 */

/**
 * @typedef {Object} CanvasMeasurement
 * @property {number} ascent           em 단위 (양수)
 * @property {number} descent          em 단위 (음수)
 * @property {number} capHeight        em 단위
 * @property {number} xHeight          em 단위
 * @property {number} hangulAdvance    em 단위 — 평균 한글 음절 폭
 * @property {number} latinAdvance     em 단위 — 'M' 폭
 * @property {boolean} measured        실제 측정 성공 여부 (false 면 기본값)
 */

const REFERENCE_FONT_SIZE = 100;
const HANGUL_SAMPLES = ['가', '한', '홍', '문', '김', '이', '박'];

/**
 * 환경에서 사용 가능한 2D 컨텍스트를 만든다.
 *
 * 1. `OffscreenCanvas` 지원 시 우선 사용 (메인 스레드 부하 감소).
 * 2. 아니면 `document.createElement('canvas')` 사용.
 * 3. 둘 다 실패 시 null.
 *
 * @returns {CanvasRenderingContext2D|null}
 */
function getCanvasContext() {
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const off = new OffscreenCanvas(256, 256);
      const ctx = off.getContext('2d');
      if (ctx) return /** @type {any} */ (ctx);
    }
  } catch (_e) {
    // OffscreenCanvas 실패 → DOM canvas 시도
  }
  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      if (ctx) return ctx;
    }
  } catch (_e) {
    // ignore
  }
  return null;
}

/**
 * TextMetrics → 안전하게 숫자 꺼내기(없거나 NaN 이면 fallback).
 *
 * @param {TextMetrics} m
 * @param {keyof TextMetrics} key
 * @param {number} fallback
 * @returns {number}
 */
function safeNum(m, key, fallback) {
  const v = /** @type {any} */ (m)[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return fallback;
}

/**
 * 보수적 기본값 — 측정 불가 시 반환.
 *
 * 한국어 sans-serif 평균 메트릭을 그대로 채운다(맑은 고딕 기준).
 *
 * @returns {CanvasMeasurement}
 */
function fallbackMeasurement() {
  return {
    ascent: 0.880,
    descent: -0.220,
    capHeight: 0.700,
    xHeight: 0.500,
    hangulAdvance: 1.000,
    latinAdvance: 0.560,
    measured: false,
  };
}

/**
 * 지정한 fontFamily 에 대해 캔버스 기반 메트릭을 측정한다.
 *
 * @param {string} fontFamily   CSS `font-family` 그대로(따옴표 없이)
 * @param {object} [options]
 * @param {number} [options.fontSize=100]  측정용 px (높을수록 정밀도↑)
 * @param {string} [options.fontWeight='normal']
 * @param {string} [options.fontStyle='normal']
 * @returns {CanvasMeasurement}
 */
export function measureFontByCanvas(fontFamily, options = {}) {
  const fontSize =
    typeof options.fontSize === 'number' && options.fontSize > 0
      ? options.fontSize
      : REFERENCE_FONT_SIZE;
  const fontWeight = options.fontWeight || 'normal';
  const fontStyle = options.fontStyle || 'normal';

  const ctx = getCanvasContext();
  if (!ctx) return fallbackMeasurement();
  if (typeof fontFamily !== 'string' || !fontFamily) return fallbackMeasurement();

  // CSS shorthand: "style weight size family"
  const family = fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily;
  try {
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${family}`;
    ctx.textBaseline = 'alphabetic';
  } catch (_e) {
    return fallbackMeasurement();
  }

  /** @type {TextMetrics|null} */
  let mH = null;
  /** @type {TextMetrics|null} */
  let mX = null;
  /** @type {TextMetrics|null} */
  let mM = null;
  /** @type {Array<TextMetrics>} */
  const hangul = [];
  try {
    mH = ctx.measureText('H');
    mX = ctx.measureText('x');
    mM = ctx.measureText('M');
    for (const s of HANGUL_SAMPLES) {
      hangul.push(ctx.measureText(s));
    }
  } catch (_e) {
    return fallbackMeasurement();
  }

  if (!mH || !mX || !mM) return fallbackMeasurement();

  // jsdom 의 canvas 는 width=0/ ascent=0 인 경우가 많다.
  // 측정값이 모두 0 이면 fallback 처리.
  const widthH = safeNum(mH, 'width', 0);
  if (widthH === 0 && hangul.every((m) => safeNum(m, 'width', 0) === 0)) {
    return fallbackMeasurement();
  }

  const ascent = safeNum(mH, 'actualBoundingBoxAscent', fontSize * 0.7) / fontSize;
  const descent = -safeNum(mH, 'actualBoundingBoxDescent', fontSize * 0.2) / fontSize;
  const capHeight = ascent;
  const xHeight = safeNum(mX, 'actualBoundingBoxAscent', fontSize * 0.5) / fontSize;
  const latinAdvance = safeNum(mM, 'width', fontSize * 0.56) / fontSize;

  let totalH = 0;
  let countH = 0;
  for (const m of hangul) {
    const w = safeNum(m, 'width', 0);
    if (w > 0) {
      totalH += w;
      countH += 1;
    }
  }
  const hangulAdvance = countH > 0 ? totalH / countH / fontSize : 1.0;

  return {
    ascent,
    descent,
    capHeight,
    xHeight,
    hangulAdvance,
    latinAdvance,
    measured: true,
  };
}

/**
 * Canvas 측정 결과를 부분적인 FontMetrics 객체로 변환한다.
 *
 * unitsPerEm 은 1000 으로 가정(em 단위 측정값을 1000 배). 다른 필드는
 * 가능한 범위 내에서 추정.
 *
 * @param {string} fontFamily
 * @param {CanvasMeasurement} [override]   (테스트용) 측정값 직접 주입
 * @returns {import('./metric-extractor.js').FontMetrics}
 */
export function measurementToFontMetrics(fontFamily, override) {
  const m = override || measureFontByCanvas(fontFamily);
  const u = 1000;
  return {
    familyName: fontFamily,
    fullName: fontFamily,
    postScriptName: fontFamily.replace(/\s+/g, '-'),
    unitsPerEm: u,
    ascent: Math.round(m.ascent * u),
    descent: Math.round(m.descent * u),
    lineGap: 0,
    capHeight: Math.round(m.capHeight * u),
    xHeight: Math.round(m.xHeight * u),
    bbox: {
      xMin: 0,
      yMin: Math.round(m.descent * u),
      xMax: u,
      yMax: Math.round(m.ascent * u),
    },
    weight: 400,
    style: 'normal',
    glyphCount: 0,
    hasKerning: false,
    hasLigatures: false,
    source: 'canvas',
  };
}

export default {
  measureFontByCanvas,
  measurementToFontMetrics,
};
