/**
 * Page Decoration Renderer
 *
 * 페이지 테두리(pageBorder)와 워터마크(watermark)를 페이지 컨테이너에 적용한다.
 *
 * 데이터 소스:
 *   - section.pageBorder
 *       {
 *         position: 'OUTSIDE' | 'INSIDE',
 *         top:    { type, width, color },
 *         right:  { type, width, color },
 *         bottom: { type, width, color },
 *         left:   { type, width, color },
 *       }
 *   - section.watermark
 *       {
 *         type: 'image' | 'text',
 *         imageBinaryItemIDRef?: string,
 *         text?: string,
 *         rotation?: number,    // degree (text)
 *         opacity?: number,     // 0..1
 *         fontSize?: number,    // px
 *         color?: string,
 *       }
 *
 * @module renderers/page-decoration
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

const VALID_BORDER_SIDES = ['top', 'right', 'bottom', 'left'];

/**
 * HWPX border type 값을 CSS border-style 값으로 변환한다.
 *
 * @param {string} [type='solid']
 * @returns {string}
 */
function toCssBorderStyle(type) {
  if (!type) return 'solid';
  const t = String(type).toUpperCase();
  switch (t) {
    case 'NONE':
      return 'none';
    case 'SOLID':
      return 'solid';
    case 'DASH':
    case 'DASHED':
      return 'dashed';
    case 'DOT':
    case 'DOTTED':
      return 'dotted';
    case 'DOUBLE':
    case 'DOUBLE_SLIM':
    case 'DOUBLE_THICK':
      return 'double';
    case 'WAVE':
    case 'DOUBLE_WAVE':
      return 'wavy';
    default:
      return 'solid';
  }
}

/**
 * border 측 정보를 CSS 단축 문자열로 변환한다.
 *
 * @param {Object} side - {type, width, color}
 * @returns {string|null}
 */
function sideToCss(side) {
  if (!side) return null;
  const type = (side.type || 'SOLID').toUpperCase();
  if (type === 'NONE') return 'none';

  const widthRaw = side.width ?? '1px';
  const width =
    typeof widthRaw === 'number'
      ? `${widthRaw}px`
      : String(widthRaw).includes('px')
        ? widthRaw
        : `${parseFloat(widthRaw) || 1}px`;
  const color = side.color || '#000000';
  return `${width} ${toCssBorderStyle(type)} ${color}`;
}

/**
 * 페이지 컨테이너에 테두리를 적용한다.
 *
 * @param {HTMLElement} pageDiv - 페이지 요소
 * @param {Object} section - 섹션 객체
 * @param {Object} [options={}]
 * @param {HTMLElement} [options.innerBody] - INSIDE 위치 시 적용할 본문 영역 요소
 */
export function applyPageBorder(pageDiv, section, options = {}) {
  if (!pageDiv || !section?.pageBorder) return;

  const border = section.pageBorder;
  const target =
    String(border.position || 'OUTSIDE').toUpperCase() === 'INSIDE' && options.innerBody
      ? options.innerBody
      : pageDiv;

  let applied = 0;
  VALID_BORDER_SIDES.forEach(side => {
    const css = sideToCss(border[side]);
    if (css && css !== 'none') {
      const prop = `border${side.charAt(0).toUpperCase()}${side.slice(1)}`;
      target.style[prop] = css;
      applied++;
    }
  });

  if (applied > 0) {
    target.setAttribute('data-page-border', 'true');
    logger.debug(`📐 Applied ${applied} page border side(s)`);
  }
}

/**
 * 워터마크 레이어를 생성한다.
 *
 * @param {Object} section - 섹션 객체
 * @param {Map} [images=new Map()] - 이미지 맵
 * @param {Object} [options={}]
 * @returns {HTMLDivElement|null}
 */
export function renderWatermark(section, images = new Map(), options = {}) {
  const watermark = section?.watermark || section?.background;
  if (!watermark) return null;

  const layer = document.createElement('div');
  layer.className = 'hwp-page-watermark';
  layer.setAttribute('data-page-region', 'watermark');
  layer.style.position = 'absolute';
  layer.style.top = '0';
  layer.style.left = '0';
  layer.style.right = '0';
  layer.style.bottom = '0';
  layer.style.pointerEvents = 'none';
  layer.style.overflow = 'hidden';
  layer.style.zIndex = options.zIndex ?? '0';
  layer.style.display = 'flex';
  layer.style.alignItems = 'center';
  layer.style.justifyContent = 'center';

  const type = (watermark.type || (watermark.text ? 'text' : 'image')).toLowerCase();
  const opacity = typeof watermark.opacity === 'number' ? watermark.opacity : 0.3;

  if (type === 'image') {
    const ref =
      watermark.imageBinaryItemIDRef ||
      watermark.binaryItemIDRef ||
      watermark.imageId ||
      watermark.image;
    const data = ref && images && typeof images.get === 'function' ? images.get(ref) : null;
    if (!data || !data.url) {
      logger.debug('🖼️ Watermark image data missing — skipping watermark');
      return null;
    }
    const img = document.createElement('img');
    img.src = data.url;
    img.alt = 'watermark';
    img.style.maxWidth = '70%';
    img.style.maxHeight = '70%';
    img.style.opacity = String(opacity);
    img.style.objectFit = 'contain';
    layer.appendChild(img);
  } else {
    const textNode = document.createElement('div');
    const txt = watermark.text || '';
    if (!txt) {
      return null;
    }
    textNode.textContent = txt;
    textNode.style.fontSize = `${watermark.fontSize || 96}px`;
    textNode.style.color = watermark.color || '#888';
    textNode.style.opacity = String(opacity);
    textNode.style.fontWeight = '700';
    textNode.style.whiteSpace = 'nowrap';
    const rotation = typeof watermark.rotation === 'number' ? watermark.rotation : -30;
    textNode.style.transform = `rotate(${rotation}deg)`;
    textNode.style.transformOrigin = 'center';
    textNode.style.userSelect = 'none';
    layer.appendChild(textNode);
  }

  return layer;
}

export default {
  applyPageBorder,
  renderWatermark,
};
