/**
 * SVG Shape Renderer
 * HWPX 도형을 SVG 기반으로 렌더링. 그라데이션/그림자/회전/3D bevel/wrap 모드 지원.
 *
 * 아키텍처:
 *   ┌─ <div.hwp-shape-svg-wrapper>  (position/wrap CSS 적용)
 *   │   └─ <svg>
 *   │        ├─ <defs>                (gradient, filter)
 *   │        ├─ <g transform="rotate()" filter="url(#shadow)">
 *   │        │     └─ <rect|ellipse|line|polygon|polyline|path>
 *   │        └─ <foreignObject>       (drawText 내부 본문)
 *
 * @module renderers/svg-shape
 * @since v3.1
 */

import { buildShapePath } from './shape-path-builder.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('SVGShapeRenderer');
const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

// 고유 ID 카운터 (gradient/filter ID 충돌 방지)
let idCounter = 0;
function uniqueId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * 16진 색상 또는 'rgb(...)' 문자열을 그대로 반환. null/undefined면 null.
 */
function colorOrNull(c) {
  if (!c) return null;
  if (typeof c !== 'string') return null;
  return c;
}

/**
 * CSS gradient 문자열을 파싱해 색상 stop 목록 추출
 * 매우 단순한 파서: 'linear-gradient(45deg, #fff, #000)' 형태만.
 * @param {string} css
 * @returns {{type:'linear'|'radial', angle:number, colors:string[]} | null}
 */
export function parseGradientCSS(css) {
  if (typeof css !== 'string') return null;
  const trimmed = css.trim();

  const linearMatch = trimmed.match(/^linear-gradient\((.+)\)$/i);
  const radialMatch = trimmed.match(/^radial-gradient\((.+)\)$/i);
  const match = linearMatch || radialMatch;
  if (!match) return null;

  const inner = match[1];
  // 콤마 기준 단순 분할 (rgba()는 미지원 가정)
  const parts = inner
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  let angle = 0;
  let colors = parts;
  const angleMatch = parts[0].match(/^(-?\d+(?:\.\d+)?)deg$/i);
  if (angleMatch) {
    angle = parseFloat(angleMatch[1]);
    colors = parts.slice(1);
  } else if (/^(circle|to\s+\w+)/i.test(parts[0])) {
    // radial 'circle' 또는 'to right' 등은 첫 번째 토큰만 흡수
    colors = parts.slice(1);
  }

  if (colors.length === 0) return null;
  return {
    type: linearMatch ? 'linear' : 'radial',
    angle,
    colors,
  };
}

/**
 * SVG <defs> 안에 gradient 정의 생성. ID 반환.
 * @param {SVGDefsElement} defs
 * @param {{type, angle, colors}} grad
 * @returns {string} gradient id
 */
function appendGradient(defs, grad) {
  const id = uniqueId('hwp-grad');
  const elem =
    grad.type === 'radial'
      ? document.createElementNS(SVG_NS, 'radialGradient')
      : document.createElementNS(SVG_NS, 'linearGradient');
  elem.setAttribute('id', id);

  if (grad.type === 'linear') {
    // angle을 SVG x1,y1,x2,y2로 변환 (0deg = 위→아래가 CSS 기준,
    // SVG는 좌→우 기본이지만 여기서는 단순화로 sin/cos 매핑)
    const a = ((grad.angle - 90) * Math.PI) / 180;
    const x1 = 0.5 - Math.cos(a) / 2;
    const y1 = 0.5 - Math.sin(a) / 2;
    const x2 = 0.5 + Math.cos(a) / 2;
    const y2 = 0.5 + Math.sin(a) / 2;
    elem.setAttribute('x1', x1.toFixed(3));
    elem.setAttribute('y1', y1.toFixed(3));
    elem.setAttribute('x2', x2.toFixed(3));
    elem.setAttribute('y2', y2.toFixed(3));
  } else {
    elem.setAttribute('cx', '0.5');
    elem.setAttribute('cy', '0.5');
    elem.setAttribute('r', '0.5');
  }

  grad.colors.forEach((color, idx) => {
    const stop = document.createElementNS(SVG_NS, 'stop');
    const offset =
      grad.colors.length === 1 ? '0%' : `${((idx / (grad.colors.length - 1)) * 100).toFixed(1)}%`;
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    elem.appendChild(stop);
  });

  defs.appendChild(elem);
  return id;
}

/**
 * SVG <defs> 안에 그림자 filter 생성. ID 반환.
 * shadow: { color, offsetX, offsetY, blur }
 */
function appendShadowFilter(defs, shadow) {
  const id = uniqueId('hwp-shadow');
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '-20%');
  filter.setAttribute('y', '-20%');
  filter.setAttribute('width', '140%');
  filter.setAttribute('height', '140%');

  const fe = document.createElementNS(SVG_NS, 'feDropShadow');
  fe.setAttribute('dx', String(shadow.offsetX || 0));
  fe.setAttribute('dy', String(shadow.offsetY || 0));
  fe.setAttribute('stdDeviation', String(shadow.blur || 0));
  if (shadow.color) fe.setAttribute('flood-color', shadow.color);
  if (shadow.opacity !== undefined) fe.setAttribute('flood-opacity', String(shadow.opacity));
  filter.appendChild(fe);

  defs.appendChild(filter);
  return id;
}

/**
 * 단순한 3D bevel filter (specular lighting 근사)
 * 1차 구현: drop-shadow + 밝은 highlight gradient overlay 없음, lighting filter 사용
 */
function appendBevelFilter(defs) {
  const id = uniqueId('hwp-bevel');
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);

  const specular = document.createElementNS(SVG_NS, 'feSpecularLighting');
  specular.setAttribute('result', 'specOut');
  specular.setAttribute('specularExponent', '20');
  specular.setAttribute('lighting-color', '#ffffff');
  specular.setAttribute('surfaceScale', '5');

  const light = document.createElementNS(SVG_NS, 'fePointLight');
  light.setAttribute('x', '-5000');
  light.setAttribute('y', '-10000');
  light.setAttribute('z', '20000');
  specular.appendChild(light);
  filter.appendChild(specular);

  const composite = document.createElementNS(SVG_NS, 'feComposite');
  composite.setAttribute('in', 'specOut');
  composite.setAttribute('in2', 'SourceAlpha');
  composite.setAttribute('operator', 'in');
  composite.setAttribute('result', 'specOut2');
  filter.appendChild(composite);

  const merge = document.createElementNS(SVG_NS, 'feComposite');
  merge.setAttribute('in', 'SourceGraphic');
  merge.setAttribute('in2', 'specOut2');
  merge.setAttribute('operator', 'arithmetic');
  merge.setAttribute('k1', '0');
  merge.setAttribute('k2', '1');
  merge.setAttribute('k3', '1');
  merge.setAttribute('k4', '0');
  filter.appendChild(merge);

  defs.appendChild(filter);
  return id;
}

/**
 * 도형 채움/테두리 속성을 SVG 요소에 적용
 * @param {SVGElement} elem
 * @param {Object} shape
 * @param {SVGDefsElement} defs
 */
function applyFillAndStroke(elem, shape, defs) {
  // ── Fill ───────────────────────────────────────────────────
  // 1순위: 그라데이션
  const gradientCSS = shape.fill?.gradientCSS || shape.style?.gradientCSS || shape.gradientCSS;
  if (gradientCSS) {
    const grad = parseGradientCSS(gradientCSS);
    if (grad) {
      const id = appendGradient(defs, grad);
      elem.setAttribute('fill', `url(#${id})`);
    } else {
      elem.setAttribute('fill', 'none');
    }
  } else {
    const fillColor =
      colorOrNull(shape.fillColor) ||
      colorOrNull(shape.style?.backgroundColor) ||
      colorOrNull(shape.fill?.backgroundColor);
    if (fillColor) {
      elem.setAttribute('fill', fillColor);
    } else {
      // 라인/폴리라인은 fill 기본 none
      const type = (shape.shapeType || shape.type || '').toLowerCase();
      if (type === 'line' || type === 'polyline' || type === 'curve' || type === 'arc') {
        elem.setAttribute('fill', 'none');
      }
    }
  }

  // Opacity
  const opacity = shape.opacity ?? shape.style?.opacity ?? shape.fill?.opacity;
  if (opacity !== undefined && opacity !== null) {
    elem.setAttribute('fill-opacity', String(opacity));
  }

  // ── Stroke ─────────────────────────────────────────────────
  const strokeColor =
    colorOrNull(shape.strokeColor) ||
    colorOrNull(shape.style?.borderColor) ||
    colorOrNull(shape.color);
  const strokeWidthRaw = shape.strokeWidth ?? shape.style?.borderWidth ?? shape.width_stroke;
  let strokeWidth = null;
  if (strokeWidthRaw !== undefined && strokeWidthRaw !== null) {
    const parsed = typeof strokeWidthRaw === 'number' ? strokeWidthRaw : parseFloat(strokeWidthRaw);
    if (Number.isFinite(parsed) && parsed >= 0) strokeWidth = parsed;
  }

  if (strokeColor && strokeWidth) {
    elem.setAttribute('stroke', strokeColor);
    elem.setAttribute('stroke-width', String(strokeWidth));
    const style = shape.style?.borderStyle;
    if (style === 'dashed') elem.setAttribute('stroke-dasharray', '6,3');
    else if (style === 'dotted') elem.setAttribute('stroke-dasharray', '2,2');
  } else if ((shape.shapeType || shape.type) === 'line') {
    // 라인은 색상 기본값
    elem.setAttribute('stroke', strokeColor || '#000000');
    elem.setAttribute('stroke-width', String(strokeWidth || 1));
    elem.setAttribute('stroke-linecap', 'round');
  }
}

/**
 * wrap 모드별 CSS 적용
 * @param {HTMLElement} wrapper
 * @param {Object} shape
 */
function applyWrapMode(wrapper, shape) {
  const wrap = shape.position?.textWrap || (shape.isBackground ? 'BEHIND_TEXT' : null);
  if (!wrap) return;

  // 디버깅 및 테스트용으로 wrap 모드를 data-attribute로도 노출
  wrapper.setAttribute('data-wrap', wrap);

  /**
   * jsdom은 shape-outside 같은 비표준 CSS 속성을 style.cssText에서 제거한다.
   * 실제 브라우저에서는 적용되지만, 테스트/디버깅 호환을 위해 data-shape-outside에도 저장.
   */
  const setShapeOutside = value => {
    wrapper.style.setProperty('shape-outside', value);
    wrapper.setAttribute('data-shape-outside', value);
  };

  switch (wrap) {
    case 'BEHIND_TEXT':
      wrapper.style.position = 'absolute';
      wrapper.style.zIndex = '-1';
      wrapper.style.pointerEvents = 'none';
      break;
    case 'IN_FRONT_OF_TEXT':
      wrapper.style.position = 'absolute';
      wrapper.style.zIndex = '10';
      break;
    case 'SQUARE':
      wrapper.style.float = 'left';
      setShapeOutside(`rectangle(0,0,${shape.width || 100}px,${shape.height || 100}px)`);
      wrapper.style.margin = '4px 8px';
      break;
    case 'TIGHT': {
      const points = Array.isArray(shape.points) ? shape.points : null;
      if (points && points.length >= 3) {
        const minX = Math.min(...points.map(p => p.x));
        const minY = Math.min(...points.map(p => p.y));
        const poly = points.map(p => `${p.x - minX}px ${p.y - minY}px`).join(', ');
        setShapeOutside(`polygon(${poly})`);
      } else {
        setShapeOutside('circle(50%)');
      }
      wrapper.style.float = 'left';
      wrapper.style.margin = '4px 8px';
      break;
    }
    case 'TOP_AND_BOTTOM':
      wrapper.style.display = 'block';
      wrapper.style.clear = 'both';
      wrapper.style.margin = '8px auto';
      break;
    case 'THROUGH':
      // SQUARE에 가깝게 처리 (브라우저가 텍스트를 도형 안쪽으로 흘리진 못함)
      wrapper.style.float = 'left';
      setShapeOutside(`rectangle(0,0,${shape.width || 100}px,${shape.height || 100}px)`);
      wrapper.style.margin = '4px 8px';
      break;
    default:
      // inline 또는 미지의 값
      break;
  }
}

/**
 * 도형 위치(절대좌표) 적용
 * @param {HTMLElement} wrapper
 * @param {Object} shape
 */
function applyPosition(wrapper, shape) {
  if (!shape.position) return;
  const pos = shape.position;
  const wrap = pos.textWrap;
  const MAX_POSITION = 10000;

  const isAbsolute =
    shape.isBackground ||
    wrap === 'BEHIND_TEXT' ||
    wrap === 'IN_FRONT_OF_TEXT' ||
    (wrap !== 'SQUARE' &&
      wrap !== 'TIGHT' &&
      wrap !== 'TOP_AND_BOTTOM' &&
      wrap !== 'THROUGH' &&
      !pos.treatAsChar);

  if (isAbsolute && (pos.x !== undefined || pos.y !== undefined)) {
    wrapper.style.position = wrapper.style.position || 'absolute';

    if (pos.x !== undefined && pos.x !== null) {
      const x = typeof pos.x === 'number' ? pos.x : parseFloat(pos.x);
      if (Number.isFinite(x) && Math.abs(x) < MAX_POSITION) {
        wrapper.style.left = `${x}px`;
      } else {
        wrapper.style.left = '0';
      }
    }
    if (pos.y !== undefined && pos.y !== null) {
      const y = typeof pos.y === 'number' ? pos.y : parseFloat(pos.y);
      if (Number.isFinite(y) && Math.abs(y) < MAX_POSITION) {
        wrapper.style.top = `${y}px`;
      } else {
        wrapper.style.top = '0';
      }
    }
  } else if (pos.treatAsChar) {
    wrapper.style.display = 'inline-block';
    wrapper.style.verticalAlign = 'middle';
  }
}

/**
 * drawText 본문을 <foreignObject>로 SVG 안에 임베드
 * @param {SVGElement} svg
 * @param {Object} shape
 * @param {Function} renderParagraphFn
 * @param {Function} renderTableFn
 * @param {Map} images
 * @returns {SVGForeignObjectElement|null}
 */
function appendForeignObjectText(
  svg,
  shape,
  width,
  height,
  renderParagraphFn,
  renderTableFn,
  images
) {
  if (!shape.drawText || !Array.isArray(shape.drawText.paragraphs)) return null;
  if (typeof renderParagraphFn !== 'function') return null;

  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('x', '0');
  fo.setAttribute('y', '0');
  fo.setAttribute('width', String(width));
  fo.setAttribute('height', String(height));

  const container = document.createElementNS(XHTML_NS, 'div');
  container.setAttribute('class', 'hwp-shape-drawtext');
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.boxSizing = 'border-box';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  const vert = shape.drawText.vertAlign || 'TOP';
  if (vert === 'CENTER') container.style.justifyContent = 'center';
  else if (vert === 'BOTTOM') container.style.justifyContent = 'flex-end';
  else container.style.justifyContent = 'flex-start';

  if (shape.drawText.margin) {
    const m = shape.drawText.margin;
    if (m.right !== undefined) container.style.paddingRight = `${m.right}px`;
    if (m.bottom !== undefined) container.style.paddingBottom = `${m.bottom}px`;
    if (m.left !== undefined) container.style.paddingLeft = `${m.left}px`;
  }

  shape.drawText.paragraphs.forEach(para => {
    para._insideShape = true;
    try {
      const pElem = renderParagraphFn(para);
      // 표 placeholder 치환
      if (typeof renderTableFn === 'function' && pElem.querySelectorAll) {
        const placeholders = pElem.querySelectorAll('.hwp-inline-table-placeholder');
        placeholders.forEach(ph => {
          const td = ph._tableData;
          if (td) {
            const tEl = renderTableFn(td, images);
            tEl.style.width = '100%';
            tEl.style.maxWidth = '100%';
            ph.replaceWith(tEl);
          }
        });
      }
      pElem.style.lineHeight = '1.0';
      pElem.style.margin = '0';
      pElem.style.padding = '0';
      pElem.style.maxWidth = '100%';
      pElem.style.width = '100%';
      if (para.style?.textAlign) {
        pElem.style.setProperty('text-align', para.style.textAlign, 'important');
      }
      container.appendChild(pElem);
    } catch (err) {
      logger.warn('[SVGShape] Failed to render paragraph inside shape:', err);
    }
  });

  fo.appendChild(container);
  svg.appendChild(fo);
  return fo;
}

/**
 * 그룹/컨테이너 도형 처리: children을 <g> 안에 재귀 렌더
 * @param {Object} shape
 * @returns {SVGGElement|null}
 */
function renderGroupChildren(shape, defs) {
  if (!Array.isArray(shape.children) || shape.children.length === 0) return null;
  const g = document.createElementNS(SVG_NS, 'g');
  shape.children.forEach(child => {
    try {
      const childResult = renderShapeToSVGNode(child, defs);
      if (childResult) g.appendChild(childResult);
    } catch (err) {
      logger.warn('[SVGShape] Failed to render child shape:', err);
    }
  });
  return g;
}

/**
 * 도형 하나를 SVG 노드(g)로 변환 (그룹 children 처리용)
 * @param {Object} shape
 * @param {SVGDefsElement} defs
 * @returns {SVGElement|null}
 */
function renderShapeToSVGNode(shape, defs) {
  const path = buildShapePath(shape);
  if (!path) return null;

  const g = document.createElementNS(SVG_NS, 'g');
  const elem = document.createElementNS(SVG_NS, path.element);
  Object.entries(path.attrs).forEach(([k, v]) => elem.setAttribute(k, String(v)));
  applyFillAndStroke(elem, shape, defs);

  // 그림자
  if (shape.shadow) {
    const id = appendShadowFilter(defs, shape.shadow);
    g.setAttribute('filter', `url(#${id})`);
  }
  // 3D bevel
  if (shape.effect?.bevel || shape.bevel) {
    const id = appendBevelFilter(defs);
    const prev = g.getAttribute('filter');
    g.setAttribute('filter', prev ? `${prev} url(#${id})` : `url(#${id})`);
  }
  // 회전
  const rotation = shape.rotation ?? shape.style?.rotation;
  if (rotation) {
    const cx = (path.viewBox?.width || 0) / 2;
    const cy = (path.viewBox?.height || 0) / 2;
    g.setAttribute('transform', `rotate(${rotation} ${cx} ${cy})`);
  }
  g.appendChild(elem);
  return g;
}

/**
 * SVG 기반 도형 렌더링
 * @param {Object} shape - 도형 객체
 * @param {Object} [options]
 * @param {Function} [options.renderParagraph] - paragraph 렌더러
 * @param {Function} [options.renderTable] - 표 렌더러
 * @param {Map} [options.images] - 이미지 맵
 * @returns {HTMLElement} 도형을 감싼 wrapper div
 */
export function renderSVGShape(shape, options = {}) {
  const { renderParagraph: renderParagraphFn, renderTable: renderTableFn, images } = options;

  if (!shape) {
    const empty = document.createElement('div');
    empty.className = 'hwp-shape hwp-shape-empty';
    return empty;
  }

  const shapeType = (shape.shapeType || shape.type || 'unknown').toLowerCase();
  const path = buildShapePath(shape);
  const viewWidth = path?.viewBox?.width || shape.width || 100;
  const viewHeight = path?.viewBox?.height || shape.height || 100;

  // ─── Wrapper <div> ────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.className = `hwp-shape hwp-shape-${shapeType} hwp-shape-svg`;
  if (shape.treatAsChar || shape.position?.treatAsChar) {
    wrapper.setAttribute('data-inline', 'true');
  }
  wrapper.style.textAlign = 'initial';

  // 크기
  if (shape.width) {
    const w = typeof shape.width === 'number' ? `${shape.width}px` : shape.width;
    wrapper.style.setProperty('width', w, 'important');
    wrapper.style.setProperty('max-width', w, 'important');
    wrapper.style.setProperty('box-sizing', 'border-box', 'important');
  }
  if (shape.height) {
    const h = typeof shape.height === 'number' ? `${shape.height}px` : shape.height;
    wrapper.style.setProperty('height', h, 'important');
  }

  // wrap 모드 + 위치
  applyWrapMode(wrapper, shape);
  applyPosition(wrapper, shape);

  // ─── SVG ──────────────────────────────────────────────
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(viewWidth));
  svg.setAttribute('height', String(viewHeight));
  svg.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
  svg.style.display = 'block';
  svg.style.overflow = 'visible';

  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);

  if (path) {
    const mainGroup = document.createElementNS(SVG_NS, 'g');
    const mainElem = document.createElementNS(SVG_NS, path.element);
    Object.entries(path.attrs).forEach(([k, v]) => mainElem.setAttribute(k, String(v)));

    applyFillAndStroke(mainElem, shape, defs);

    // 그림자
    if (shape.shadow) {
      const id = appendShadowFilter(defs, shape.shadow);
      mainGroup.setAttribute('filter', `url(#${id})`);
    }
    // 3D bevel
    if (shape.effect?.bevel || shape.bevel) {
      const id = appendBevelFilter(defs);
      const prev = mainGroup.getAttribute('filter');
      mainGroup.setAttribute('filter', prev ? `${prev} url(#${id})` : `url(#${id})`);
    }
    // 회전
    const rotation = shape.rotation ?? shape.style?.rotation;
    if (rotation) {
      const cx = viewWidth / 2;
      const cy = viewHeight / 2;
      mainGroup.setAttribute('transform', `rotate(${rotation} ${cx} ${cy})`);
    }

    mainGroup.appendChild(mainElem);
    svg.appendChild(mainGroup);
  }

  // 그룹 자식 도형
  const groupNode = renderGroupChildren(shape, defs);
  if (groupNode) svg.appendChild(groupNode);

  // drawText (foreignObject)
  appendForeignObjectText(
    svg,
    shape,
    viewWidth,
    viewHeight,
    renderParagraphFn,
    renderTableFn,
    images
  );

  wrapper.appendChild(svg);
  return wrapper;
}

export default { renderSVGShape, parseGradientCSS };
