/**
 * Table of Contents (TOC) Generator
 *
 * HWPX 단락의 outlineLevel 또는 headingType 을 기반으로 트리 구조의 TOC 를
 * 생성하고, <nav class="hwp-toc"> HTML 로 렌더링한다. Cross-reference 도 지원.
 *
 * @module features/toc-generator
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * @typedef {Object} TOCEntry
 * @property {number}  level         outlineLevel (1-based)
 * @property {string}  text          단락 텍스트
 * @property {string}  paragraphId   anchor id (= para-<index>)
 * @property {number}  [pageNumber]  페이지 번호 (계산 가능 시)
 * @property {TOCEntry[]} [children] 하위 항목
 */

/**
 * sections[] 를 순회해서 outlineLevel > 0 인 단락만 평탄 배열로 수집한다.
 *
 * @param {Array<{elements: Array<Object>}>} sections
 * @param {Object} [opts]
 * @param {Map<string, number>} [opts.pageMap]  paragraphId → pageNumber
 * @returns {TOCEntry[]} 평탄(flat) 리스트
 */
export function collectHeadings(sections, opts = {}) {
  const out = [];
  if (!Array.isArray(sections)) return out;
  let counter = 0;
  const pageMap = opts.pageMap instanceof Map ? opts.pageMap : null;

  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    if (!sec || !Array.isArray(sec.elements)) continue;
    for (let e = 0; e < sec.elements.length; e++) {
      const el = sec.elements[e];
      if (!el || el.type !== 'paragraph') continue;
      const level = _extractLevel(el);
      if (!level || level < 1) continue;

      const paragraphId = el.id || `para-${s}-${e}`;
      const entry = {
        level,
        text: _extractText(el),
        paragraphId,
      };
      counter++;
      if (pageMap && pageMap.has(paragraphId)) {
        entry.pageNumber = pageMap.get(paragraphId);
      } else if (typeof el.pageNumber === 'number') {
        entry.pageNumber = el.pageNumber;
      }
      out.push(entry);
    }
  }
  logger.debug(`[TOC] collected ${counter} heading(s) from ${sections.length} section(s)`);
  return out;
}

function _extractLevel(para) {
  if (!para) return 0;
  if (Number.isFinite(para.outlineLevel) && para.outlineLevel > 0) return para.outlineLevel;
  if (para.style) {
    if (Number.isFinite(para.style.outlineLevel) && para.style.outlineLevel > 0) {
      return para.style.outlineLevel;
    }
  }
  if (para.paraPr && Number.isFinite(para.paraPr.outlineLevel) && para.paraPr.outlineLevel > 0) {
    return para.paraPr.outlineLevel;
  }
  if (para.headingType) {
    // 'HEADING1' / 'HEADING_1' / 'h1' / '1' → 1
    const m = String(para.headingType).match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  if (para.styleRef && para.styleRef.headingType) {
    const m = String(para.styleRef.headingType).match(/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return 0;
}

function _extractText(para) {
  if (typeof para.text === 'string' && para.text.length > 0) return para.text;
  if (Array.isArray(para.runs)) {
    return para.runs
      .filter(r => r && typeof r.text === 'string')
      .map(r => r.text)
      .join('')
      .trim();
  }
  return '';
}

/**
 * flat heading 목록 → 트리 구조로 변환.
 *
 * @param {TOCEntry[]} flat
 * @returns {TOCEntry[]} 최상위 항목들 (children 재귀 포함)
 */
export function buildTree(flat) {
  if (!Array.isArray(flat) || flat.length === 0) return [];
  const root = [];
  /** @type {TOCEntry[]} */
  const stack = [];

  for (const entry of flat) {
    const node = { ...entry, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return root;
}

/**
 * sections → 평탄 + 트리 한 번에 생성.
 * @param {Array} sections
 * @param {Object} [opts]
 * @returns {{flat: TOCEntry[], tree: TOCEntry[]}}
 */
export function generateTOC(sections, opts = {}) {
  const flat = collectHeadings(sections, opts);
  const tree = buildTree(flat);
  return { flat, tree };
}

/**
 * Cross-reference (bookmark name 또는 paraId 기반) 링크 생성.
 *
 * @param {string} targetRef   bookmark name 또는 para-XXX
 * @param {string} [label]     화면 표시 텍스트 (없으면 targetRef)
 * @returns {HTMLAnchorElement}
 */
export function renderCrossReference(targetRef, label) {
  const a = document.createElement('a');
  a.className = 'hwp-crossref';
  const ref = String(targetRef || '');
  if (ref.startsWith('para-')) {
    a.href = `#${ref}`;
  } else {
    a.href = `#bookmark-${ref}`;
  }
  a.setAttribute('data-ref', ref);
  a.textContent = label || ref;
  return a;
}

/**
 * TOC 트리 → <nav class="hwp-toc"><ol>...</ol></nav> 렌더링.
 *
 * 페이지 번호는 점 채움(leader) 으로 우측 정렬: ' …… 7'
 *
 * @param {TOCEntry[]} tree
 * @param {Object} [opts]
 * @param {string} [opts.title='목차'] 헤더 텍스트 (생략 시 헤더 미생성)
 * @param {boolean} [opts.showPageNumbers=true]
 * @returns {HTMLElement}
 */
export function renderTOC(tree, opts = {}) {
  const nav = document.createElement('nav');
  nav.className = 'hwp-toc';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', '목차');

  if (opts.title) {
    const h = document.createElement('div');
    h.className = 'hwp-toc__title';
    h.textContent = opts.title;
    nav.appendChild(h);
  }

  const list = _renderList(Array.isArray(tree) ? tree : [], opts);
  nav.appendChild(list);
  return nav;
}

function _renderList(nodes, opts) {
  const ol = document.createElement('ol');
  ol.className = 'hwp-toc__list';
  const showPages = opts.showPageNumbers !== false;
  for (const node of nodes) {
    const li = document.createElement('li');
    li.className = `hwp-toc__item hwp-toc__item--lvl${node.level}`;

    const a = document.createElement('a');
    a.className = 'hwp-toc__link';
    a.href = `#${node.paragraphId}`;
    a.setAttribute('data-paragraph-id', node.paragraphId);

    const textSpan = document.createElement('span');
    textSpan.className = 'hwp-toc__text';
    textSpan.textContent = node.text || '(제목 없음)';
    a.appendChild(textSpan);

    if (showPages && Number.isFinite(node.pageNumber)) {
      const leader = document.createElement('span');
      leader.className = 'hwp-toc__leader';
      leader.setAttribute('aria-hidden', 'true');
      leader.textContent = ' ······ ';
      a.appendChild(leader);

      const page = document.createElement('span');
      page.className = 'hwp-toc__page';
      page.textContent = String(node.pageNumber);
      a.appendChild(page);
    }

    li.appendChild(a);
    if (Array.isArray(node.children) && node.children.length > 0) {
      li.appendChild(_renderList(node.children, opts));
    }
    ol.appendChild(li);
  }
  return ol;
}

export default {
  collectHeadings,
  buildTree,
  generateTOC,
  renderTOC,
  renderCrossReference,
};
