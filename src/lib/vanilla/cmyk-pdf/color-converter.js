/**
 * RGB → CMYK 색공간 변환기 (출판/인쇄 사전 처리용)
 * -----------------------------------------------------------------------------
 * 본 모듈은 ICC 프로파일을 사용하지 않는 **표준 알고리즘 기반** 변환만 제공한다.
 * 정확한 인쇄 색재현이 필요할 경우 외부 도구(Ghostscript + 사용자 ICC)로
 * 추가 후처리 해야 함을 주의한다.
 *
 * 표준 알고리즘 (sRGB → CMYK, 0~1 범위):
 *   K = 1 - max(R, G, B) / 255
 *   if K === 1:
 *     C = M = Y = 0   (순흑)
 *   else:
 *     C = (1 - R/255 - K) / (1 - K)
 *     M = (1 - G/255 - K) / (1 - K)
 *     Y = (1 - B/255 - K) / (1 - K)
 *
 * 모든 변환 결과는 [0,1] 범위 부동소수점. pdf-lib `cmyk(c,m,y,k)` 와 직접 호환.
 *
 * @module cmyk-pdf/color-converter
 */

/**
 * @typedef {{ c: number, m: number, y: number, k: number }} CmykColor
 *   각 채널 0~1
 *
 * @typedef {{ r: number, g: number, b: number }} RgbColor
 *   각 채널 0~255
 */

/**
 * 0-255 정수 RGB 를 CMYK(0~1) 로 변환한다.
 *
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {CmykColor}
 */
export function rgbToCmyk(r, g, b) {
  // 입력 정규화 (null/NaN/범위 밖 값 방어)
  const rn = clampByte(r);
  const gn = clampByte(g);
  const bn = clampByte(b);

  const rf = rn / 255;
  const gf = gn / 255;
  const bf = bn / 255;

  const k = 1 - Math.max(rf, gf, bf);

  // 순흑 (혹은 매우 어두운 색) 처리 — 0 나눗셈 회피
  if (k >= 1 - EPSILON) {
    return { c: 0, m: 0, y: 0, k: 1 };
  }

  const denom = 1 - k;
  const c = (1 - rf - k) / denom;
  const m = (1 - gf - k) / denom;
  const y = (1 - bf - k) / denom;

  return {
    c: roundTo(clamp01(c), 4),
    m: roundTo(clamp01(m), 4),
    y: roundTo(clamp01(y), 4),
    k: roundTo(clamp01(k), 4),
  };
}

/**
 * CMYK(0~1) → 근사 RGB(0-255). 변환의 역연산 검증/디버깅용.
 *
 * @param {number} c 0~1
 * @param {number} m 0~1
 * @param {number} y 0~1
 * @param {number} k 0~1
 * @returns {RgbColor}
 */
export function cmykToRgb(c, m, y, k) {
  const cc = clamp01(c);
  const mm = clamp01(m);
  const yy = clamp01(y);
  const kk = clamp01(k);
  const r = Math.round(255 * (1 - cc) * (1 - kk));
  const g = Math.round(255 * (1 - mm) * (1 - kk));
  const b = Math.round(255 * (1 - yy) * (1 - kk));
  return { r, g, b };
}

/**
 * `#rrggbb` / `#rgb` / `rgb(...)` 형식의 문자열을 CMYK 로 변환한다.
 * 알파(rgba) 가 포함되어 있어도 알파는 무시한다.
 *
 * @param {string} hex
 * @returns {CmykColor}
 */
export function hexToCmyk(hex) {
  const rgb = parseColorString(hex);
  return rgbToCmyk(rgb.r, rgb.g, rgb.b);
}

/**
 * CSS 색 문자열을 RGB(0-255) 로 파싱한다.
 * 지원: `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb(r, g, b)`, `rgba(r, g, b, a)`.
 * 미지원 형식은 검정으로 fallback.
 *
 * @param {string} input
 * @returns {RgbColor}
 */
export function parseColorString(input) {
  if (typeof input !== 'string') return { r: 0, g: 0, b: 0 };
  const s = input.trim().toLowerCase();
  if (!s) return { r: 0, g: 0, b: 0 };

  if (s.startsWith('#')) {
    const body = s.slice(1);
    if (body.length === 3) {
      return {
        r: parseInt(body[0] + body[0], 16),
        g: parseInt(body[1] + body[1], 16),
        b: parseInt(body[2] + body[2], 16),
      };
    }
    if (body.length === 6 || body.length === 8) {
      return {
        r: parseInt(body.slice(0, 2), 16),
        g: parseInt(body.slice(2, 4), 16),
        b: parseInt(body.slice(4, 6), 16),
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  const m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/);
  if (m) {
    return {
      r: clampByte(Number(m[1])),
      g: clampByte(Number(m[2])),
      b: clampByte(Number(m[3])),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/**
 * CMYK 값을 pdf-lib 의 `cmyk()` 함수 입력 형태로 안전하게 반올림한다.
 *
 * @param {CmykColor} cmykColor
 * @returns {[number, number, number, number]} (c, m, y, k) — pdf-lib `cmyk(...)` 인자
 */
export function toPdfLibCmyk(cmykColor) {
  return [
    clamp01(cmykColor.c),
    clamp01(cmykColor.m),
    clamp01(cmykColor.y),
    clamp01(cmykColor.k),
  ];
}

// ----------------------------------------------------------------------------
// 내부 헬퍼
// ----------------------------------------------------------------------------

const EPSILON = 1e-9;

/**
 * 값을 [0, 255] 정수로 클램프.
 */
function clampByte(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 255) return 255;
  return Math.round(v);
}

/**
 * 값을 [0, 1] 로 클램프.
 */
function clamp01(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * 부동소수점 반올림 헬퍼 (테스트 안정성 + PDF 출력 사이즈 절약).
 */
function roundTo(v, digits) {
  const m = Math.pow(10, digits);
  return Math.round(v * m) / m;
}
