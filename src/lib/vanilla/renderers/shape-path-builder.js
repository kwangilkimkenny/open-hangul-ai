/**
 * Shape Path Builder
 * HWPX 도형(shape.type)을 SVG path/native element 속성으로 변환
 *
 * 각 빌더는 도형 정보를 받아 다음 형태를 반환:
 *   {
 *     element: 'rect' | 'ellipse' | 'line' | 'polygon' | 'polyline' | 'path',
 *     attrs: { ... SVG attributes },
 *     viewBox: { width, height }   // 외부 컨테이너 크기 산출용
 *   }
 *
 * 좌표계: 원본 도형 로컬 좌표 (px). points/x0,y0/width,height 기준
 *
 * @module renderers/shape-path-builder
 * @since v3.1
 */

/**
 * 안전한 숫자 변환
 * @param {*} v
 * @param {number} fallback
 * @returns {number}
 */
function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 점 배열 정규화 - [{x,y}] 또는 [[x,y]] 모두 지원
 * @param {Array} points
 * @returns {Array<{x:number,y:number}>}
 */
function normalizePoints(points) {
  if (!Array.isArray(points)) return [];
  return points
    .map(pt => {
      if (!pt) return null;
      if (Array.isArray(pt)) return { x: num(pt[0]), y: num(pt[1]) };
      if (typeof pt === 'object') return { x: num(pt.x), y: num(pt.y) };
      return null;
    })
    .filter(Boolean);
}

/**
 * 사각형(rect) - 둥근 모서리 지원
 * @param {Object} shape
 * @returns {Object} builder result
 */
export function buildRect(shape) {
  const width = Math.max(1, num(shape.width, 100));
  const height = Math.max(1, num(shape.height, 100));

  // borderRadius: HWPX ratio (0-100) 또는 실제 px
  let rx = 0;
  let ry = 0;
  if (shape.borderRadius && shape.borderRadius > 0) {
    const minDim = Math.min(width, height);
    // HWPX ratio (0-100) → minDim * 0.7배수 매핑 (기존 shape.js 동작과 일관)
    rx = (shape.borderRadius / 100) * minDim * 0.7;
    ry = rx;
  } else if (shape.rx !== undefined || shape.ry !== undefined) {
    rx = num(shape.rx, 0);
    ry = num(shape.ry, rx);
  }

  return {
    element: 'rect',
    attrs: {
      x: 0,
      y: 0,
      width,
      height,
      ...(rx > 0 ? { rx } : {}),
      ...(ry > 0 ? { ry } : {}),
    },
    viewBox: { width, height },
  };
}

/**
 * 타원(ellipse) / 원(circle)
 * @param {Object} shape
 * @returns {Object} builder result
 */
export function buildEllipse(shape) {
  const width = Math.max(1, num(shape.width, 100));
  const height = Math.max(1, num(shape.height, 100));
  const rx = width / 2;
  const ry = height / 2;

  return {
    element: 'ellipse',
    attrs: {
      cx: rx,
      cy: ry,
      rx,
      ry,
    },
    viewBox: { width, height },
  };
}

/**
 * 라인(line) - 시작점/끝점 사이 직선
 * @param {Object} shape
 * @returns {Object} builder result
 */
export function buildLine(shape) {
  const x0 = num(shape.x0 ?? shape.start?.x ?? shape.startPoint?.x, 0);
  const y0 = num(shape.y0 ?? shape.start?.y ?? shape.startPoint?.y, 0);
  const x1 = num(shape.x1 ?? shape.end?.x ?? shape.endPoint?.x, 100);
  const y1 = num(shape.y1 ?? shape.end?.y ?? shape.endPoint?.y, 0);

  const minX = Math.min(x0, x1);
  const minY = Math.min(y0, y1);
  const width = Math.max(1, Math.max(x0, x1) - minX);
  const height = Math.max(1, Math.max(y0, y1) - minY);

  return {
    element: 'line',
    attrs: {
      x1: x0 - minX,
      y1: y0 - minY,
      x2: x1 - minX,
      y2: y1 - minY,
    },
    viewBox: { width, height },
    translate: { x: minX, y: minY },
  };
}

/**
 * 폴리곤(polygon) - 닫힌 다각형
 * @param {Object} shape
 * @returns {Object} builder result
 */
export function buildPolygon(shape) {
  const points = normalizePoints(shape.points);
  if (points.length < 2) {
    // 폴백: 사각형
    return buildRect(shape);
  }

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - minX);
  const height = Math.max(1, Math.max(...ys) - minY);

  const ptsAttr = points.map(p => `${p.x - minX},${p.y - minY}`).join(' ');

  return {
    element: 'polygon',
    attrs: {
      points: ptsAttr,
    },
    viewBox: { width, height },
    translate: { x: minX, y: minY },
  };
}

/**
 * 폴리라인(polyline) - 열린 다각선
 * @param {Object} shape
 * @returns {Object} builder result
 */
export function buildPolyline(shape) {
  const result = buildPolygon(shape);
  result.element = 'polyline';
  return result;
}

/**
 * 베지어 곡선(curve) - 점들을 부드러운 베지어로 연결
 * 단순 cardinal-spline 근사: P_i, P_i+1 사이를 P_i + 1/3(P_i+1 - P_i-1), P_i+1 - 1/3(P_i+2 - P_i) 제어점 사용
 *
 * @param {Object} shape
 * @returns {Object} builder result
 */
export function buildCurve(shape) {
  const points = normalizePoints(shape.points);
  if (points.length < 2) return buildRect(shape);
  if (points.length === 2) return buildPolyline(shape);

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - minX);
  const height = Math.max(1, Math.max(...ys) - minY);

  const local = points.map(p => ({ x: p.x - minX, y: p.y - minY }));

  let d = `M ${local[0].x} ${local[0].y}`;

  for (let i = 0; i < local.length - 1; i++) {
    const p0 = local[i - 1] || local[i];
    const p1 = local[i];
    const p2 = local[i + 1];
    const p3 = local[i + 2] || local[i + 1];

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return {
    element: 'path',
    attrs: { d },
    viewBox: { width, height },
    translate: { x: minX, y: minY },
  };
}

/**
 * Freeform - 임의 형태. 점이 충분하면 curve, 적으면 polyline.
 * shape.pathData가 이미 SVG d 형식이면 그대로 사용.
 * @param {Object} shape
 * @returns {Object} builder result
 */
export function buildFreeform(shape) {
  if (typeof shape.pathData === 'string' && shape.pathData.trim()) {
    const width = Math.max(1, num(shape.width, 100));
    const height = Math.max(1, num(shape.height, 100));
    return {
      element: 'path',
      attrs: { d: shape.pathData },
      viewBox: { width, height },
    };
  }
  const points = normalizePoints(shape.points);
  if (points.length >= 3) return buildCurve(shape);
  return buildPolyline(shape);
}

/**
 * 호(arc) - 타원호. shape.startAngle, shape.endAngle 사용 (도 단위).
 * 정보가 없으면 width×height bounding-box 안의 반원으로 폴백.
 * @param {Object} shape
 * @returns {Object} builder result
 */
export function buildArc(shape) {
  const width = Math.max(1, num(shape.width, 100));
  const height = Math.max(1, num(shape.height, 100));
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;

  const startDeg = num(shape.startAngle, 0);
  const endDeg = num(shape.endAngle, 180);

  const toRad = d => (d * Math.PI) / 180;
  const startX = cx + rx * Math.cos(toRad(startDeg));
  const startY = cy + ry * Math.sin(toRad(startDeg));
  const endX = cx + rx * Math.cos(toRad(endDeg));
  const endY = cy + ry * Math.sin(toRad(endDeg));

  const sweep = endDeg > startDeg ? 1 : 0;
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;

  const d = `M ${startX} ${startY} A ${rx} ${ry} 0 ${largeArc} ${sweep} ${endX} ${endY}`;

  return {
    element: 'path',
    attrs: { d },
    viewBox: { width, height },
  };
}

/**
 * 도형 타입에 따라 적절한 빌더 호출
 * @param {Object} shape
 * @returns {Object|null} builder result. 알 수 없는 타입이면 null.
 */
export function buildShapePath(shape) {
  if (!shape) return null;
  const type = (shape.shapeType || shape.type || '').toLowerCase();

  switch (type) {
    case 'rect':
    case 'rectangle':
      return buildRect(shape);
    case 'ellipse':
    case 'circle':
      return buildEllipse(shape);
    case 'line':
      return buildLine(shape);
    case 'polygon':
      return buildPolygon(shape);
    case 'polyline':
      return buildPolyline(shape);
    case 'curve':
      return buildCurve(shape);
    case 'arc':
      return buildArc(shape);
    case 'freeform':
      return buildFreeform(shape);
    default:
      // 미지의 타입 → 사각형 폴백
      return buildRect(shape);
  }
}

export default {
  buildShapePath,
  buildRect,
  buildEllipse,
  buildLine,
  buildPolygon,
  buildPolyline,
  buildCurve,
  buildArc,
  buildFreeform,
};
