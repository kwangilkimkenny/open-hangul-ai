/**
 * Page Header/Footer Renderer
 *
 * 페이지 머리말/꼬리말을 렌더링한다. 파서가 만들어 두는
 * `section.headers` / `section.footers` 데이터(`{ both, odd, even, first }`)와
 * 페이지 번호를 받아 적절한 type(BOTH/ODD/EVEN/FIRST)을 선택한다.
 *
 * 데이터 형식 호환:
 *   - 신규: `{ paragraphs: [...] }`
 *   - 기존 코드 호환: `{ elements: [...] }`
 *
 * 본문 요소(단락/표/이미지/컨테이너)는 외부에서 주입한 렌더러 콜백으로 위임한다.
 *
 * @module renderers/page-header-footer
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { renderParagraph } from './paragraph.js';
import { renderTable } from './table.js';
import { renderImage } from './image.js';
import { renderContainer } from './container.js';

const logger = getLogger();

/**
 * 페이지 번호 + 섹션 헤더/푸터 정의에서 사용할 콘텐츠를 선택한다.
 *
 * @param {Object} pool - section.headers 또는 section.footers
 * @param {number} pageNumber - 1-base 페이지 번호
 * @returns {Object|null} 선택된 헤더/푸터 콘텐츠 또는 null
 */
export function resolveHeaderFooter(pool, pageNumber) {
  if (!pool || typeof pool !== 'object') return null;

  const isFirstPage = pageNumber === 1;
  const isOddPage = pageNumber % 2 === 1;

  // 우선순위: FIRST > ODD/EVEN > BOTH
  if (isFirstPage && pool.first) return pool.first;

  if (isOddPage) {
    if (pool.odd) return pool.odd;
  } else if (pool.even) {
    return pool.even;
  }

  return pool.both || null;
}

/**
 * 헤더/푸터 콘텐츠에서 렌더링할 자식 노드 배열을 정규화한다.
 * `paragraphs` 배열을 우선하고, 없으면 기존 `elements` 형식을 사용한다.
 *
 * @param {Object} content - 헤더/푸터 콘텐츠 객체
 * @returns {Array<Object>} 렌더링할 요소 배열
 */
function normaliseChildren(content) {
  if (!content) return [];
  if (Array.isArray(content.paragraphs) && content.paragraphs.length > 0) {
    return content.paragraphs;
  }
  if (Array.isArray(content.elements) && content.elements.length > 0) {
    return content.elements;
  }
  return [];
}

/**
 * 단일 요소를 DOM으로 렌더링한다.
 * 헤더/푸터에서도 본문과 동일한 렌더러를 재귀적으로 사용한다.
 *
 * @param {Object} element - 파싱된 요소 (paragraph/table/image/container/shape)
 * @param {Map} [images=new Map()] - 이미지 맵
 * @returns {HTMLElement|null}
 */
function renderHeaderFooterElement(element, images = new Map()) {
  if (!element || typeof element !== 'object') return null;

  // paragraphs 배열이 그대로 들어오는 경우(파서 신규 포맷): type이 없을 수 있음
  const type = element.type || 'paragraph';

  try {
    switch (type) {
      case 'paragraph':
        return renderParagraph(element);
      case 'table':
        return renderTable(element, images);
      case 'image':
        return renderImage(element);
      case 'container':
        return renderContainer(element);
      default:
        return renderParagraph(element);
    }
  } catch (err) {
    logger.warn(`⚠️ Failed to render header/footer element (type=${type}):`, err);
    return null;
  }
}

/**
 * 페이지 헤더 영역(DOM)을 생성한다. 콘텐츠가 없으면 null.
 *
 * @param {Object} section - 섹션 객체 (section.headers 사용)
 * @param {number} pageNumber - 페이지 번호
 * @param {Object} [options={}]
 * @param {number} [options.height] - 헤더 영역 픽셀 높이
 * @param {Map} [options.images] - 이미지 맵
 * @returns {HTMLDivElement|null}
 */
export function renderPageHeader(section, pageNumber, options = {}) {
  if (!section || !section.headers) return null;

  const content = resolveHeaderFooter(section.headers, pageNumber);
  const children = normaliseChildren(content);
  if (children.length === 0) return null;

  const headerDiv = document.createElement('div');
  headerDiv.className = 'hwp-page-header';
  headerDiv.setAttribute('data-page-region', 'header');
  headerDiv.style.position = 'absolute';
  headerDiv.style.top = '0';
  headerDiv.style.left = section?.pageSettings?.marginLeft || '40px';
  headerDiv.style.right = section?.pageSettings?.marginRight || '40px';

  const headerHeight = options.height ?? section?.headerMargin ?? 40;
  headerDiv.style.height = typeof headerHeight === 'number' ? `${headerHeight}px` : headerHeight;
  headerDiv.style.overflow = 'hidden';
  headerDiv.style.pointerEvents = 'none';

  children.forEach(child => {
    const node = renderHeaderFooterElement(child, options.images);
    if (node) headerDiv.appendChild(node);
  });

  return headerDiv;
}

/**
 * 페이지 푸터 영역(DOM)을 생성한다. 콘텐츠가 없으면 null.
 *
 * @param {Object} section - 섹션 객체 (section.footers 사용)
 * @param {number} pageNumber - 페이지 번호
 * @param {Object} [options={}]
 * @param {number} [options.height] - 푸터 영역 픽셀 높이
 * @param {Map} [options.images] - 이미지 맵
 * @returns {HTMLDivElement|null}
 */
export function renderPageFooter(section, pageNumber, options = {}) {
  if (!section || !section.footers) return null;

  const content = resolveHeaderFooter(section.footers, pageNumber);
  const children = normaliseChildren(content);
  if (children.length === 0) return null;

  const footerDiv = document.createElement('div');
  footerDiv.className = 'hwp-page-footer';
  footerDiv.setAttribute('data-page-region', 'footer');
  footerDiv.style.position = 'absolute';
  footerDiv.style.bottom = '0';
  footerDiv.style.left = section?.pageSettings?.marginLeft || '40px';
  footerDiv.style.right = section?.pageSettings?.marginRight || '40px';

  const footerHeight = options.height ?? section?.footerMargin ?? 40;
  footerDiv.style.height = typeof footerHeight === 'number' ? `${footerHeight}px` : footerHeight;
  footerDiv.style.overflow = 'hidden';
  footerDiv.style.pointerEvents = 'none';

  children.forEach(child => {
    const node = renderHeaderFooterElement(child, options.images);
    if (node) footerDiv.appendChild(node);
  });

  return footerDiv;
}

/**
 * 본문 영역에서 헤더/푸터가 차지하는 픽셀 높이를 계산한다.
 * `autoPaginateContent`에서 maxContentHeight를 보정하기 위해 사용할 수 있다.
 *
 * @param {Object} section - 섹션 객체
 * @param {number} pageNumber - 페이지 번호
 * @returns {{ header: number, footer: number }}
 */
export function getHeaderFooterReservedHeights(section, pageNumber) {
  const header = resolveHeaderFooter(section?.headers, pageNumber);
  const footer = resolveHeaderFooter(section?.footers, pageNumber);

  const headerHeight =
    header && normaliseChildren(header).length > 0 ? section?.headerMargin || 40 : 0;
  const footerHeight =
    footer && normaliseChildren(footer).length > 0 ? section?.footerMargin || 40 : 0;

  return { header: headerHeight, footer: footerHeight };
}

export default {
  renderPageHeader,
  renderPageFooter,
  resolveHeaderFooter,
  getHeaderFooterReservedHeights,
};
