/**
 * Search Highlight Overlay
 *
 * 페이지 컨테이너 위에 검색 매치 영역을 absolute 박스로 강조한다.
 * spell/spell-overlay.js 패턴을 따른다.
 *
 * 입력:
 *   - container: HTMLElement (position:relative 권장)
 *   - targets:   Array<{ textNode:Node, matches: Array<{start:number,end:number,id?:string}> }>
 *   - activeId:  string (현재 활성 매치 id — 다른 색)
 *
 * 출력:
 *   - container 안에 `.search-overlay` root 생성
 *   - 각 매치 위치에 `.search-hit` span 배치
 *   - 활성 매치는 `.search-hit--active` 추가
 *
 * @module search/search-highlight
 * @version 1.0.0
 */

const OVERLAY_CLASS = 'search-overlay';
const HIT_CLASS = 'search-hit';
const ACTIVE_CLASS = 'search-hit--active';

const DEFAULT_COLOR = 'rgba(255, 235, 59, 0.45)'; // yellow-300
const ACTIVE_COLOR = 'rgba(255, 152, 0, 0.55)'; // orange-500

/**
 * @typedef {Object} HighlightTarget
 * @property {Node} textNode
 * @property {Array<{start:number, end:number, id?:string}>} matches
 */

/**
 * Ensure overlay root.
 *
 * @param {HTMLElement} container
 * @returns {HTMLDivElement}
 */
function ensureOverlayRoot(container) {
  let root = container.querySelector(`:scope > .${OVERLAY_CLASS}`);
  if (root instanceof HTMLDivElement) return root;
  root = container.ownerDocument.createElement('div');
  root.className = OVERLAY_CLASS;
  root.style.position = 'absolute';
  root.style.left = '0';
  root.style.top = '0';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.pointerEvents = 'none';
  root.style.overflow = 'hidden';
  root.style.zIndex = '6';
  container.appendChild(root);
  return /** @type {HTMLDivElement} */ (root);
}

/**
 * Range bbox 목록 (jsdom fallback 포함).
 *
 * @param {Range} range
 * @param {Node} fallback
 * @returns {Array<{left:number,top:number,width:number,height:number}>}
 */
function rectsForRange(range, fallback) {
  /** @type {Array<{left:number,top:number,width:number,height:number}>} */
  const rects = [];
  try {
    const list = range.getClientRects();
    if (list && list.length) {
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (r && typeof r.width === 'number') {
          rects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
        }
      }
    }
  } catch (_e) {
    /* ignore */
  }
  if (rects.length === 0 && fallback) {
    try {
      const parent = fallback.parentElement;
      if (parent && parent.getBoundingClientRect) {
        const br = parent.getBoundingClientRect();
        rects.push({ left: br.left, top: br.top, width: br.width || 20, height: br.height || 18 });
      }
    } catch (_e) {
      /* ignore */
    }
  }
  return rects;
}

/**
 * 검색 하이라이트를 (재)렌더한다.
 *
 * @param {HTMLElement} container
 * @param {Array<HighlightTarget>} targets
 * @param {string} [activeId]
 * @returns {{ root:HTMLDivElement, hits:Array<HTMLSpanElement> }}
 */
export function renderSearchHighlight(container, targets, activeId) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new TypeError('renderSearchHighlight: container must be HTMLElement');
  }
  const root = ensureOverlayRoot(container);
  while (root.firstChild) root.removeChild(root.firstChild);

  /** @type {Array<HTMLSpanElement>} */
  const hits = [];
  if (!Array.isArray(targets) || targets.length === 0) return { root, hits };

  const cRect = container.getBoundingClientRect
    ? container.getBoundingClientRect()
    : { left: 0, top: 0, width: 0, height: 0 };

  for (const t of targets) {
    if (!t || !t.textNode || !Array.isArray(t.matches)) continue;
    const tlen = t.textNode.textContent ? t.textNode.textContent.length : 0;
    for (const m of t.matches) {
      if (!m || typeof m.start !== 'number' || typeof m.end !== 'number') continue;
      const s = Math.max(0, m.start);
      const e = Math.min(tlen, m.end);
      if (e <= s) continue;
      let range;
      try {
        range = container.ownerDocument.createRange();
        range.setStart(t.textNode, s);
        range.setEnd(t.textNode, e);
      } catch (_e) {
        continue;
      }
      const rects = rectsForRange(range, t.textNode);
      const isActive = m.id && activeId && m.id === activeId;
      for (const r of rects) {
        const span = container.ownerDocument.createElement('span');
        span.className = HIT_CLASS + (isActive ? ` ${ACTIVE_CLASS}` : '');
        if (m.id) span.setAttribute('data-match-id', m.id);
        span.style.position = 'absolute';
        span.style.left = `${Math.round(r.left - cRect.left)}px`;
        span.style.top = `${Math.round(r.top - cRect.top)}px`;
        span.style.width = `${Math.round(r.width || 12)}px`;
        span.style.height = `${Math.round(r.height || 18)}px`;
        span.style.pointerEvents = 'none';
        span.style.borderRadius = '2px';
        span.style.background = isActive ? ACTIVE_COLOR : DEFAULT_COLOR;
        root.appendChild(span);
        hits.push(span);
      }
    }
  }
  return { root, hits };
}

/**
 * 활성 매치를 다른 id 로 갱신 (기존 hit 들의 클래스/색만 변경).
 *
 * @param {HTMLElement} container
 * @param {string} activeId
 */
export function setActiveMatch(container, activeId) {
  if (!container || !(container instanceof HTMLElement)) return;
  const hits = container.querySelectorAll(`.${HIT_CLASS}`);
  hits.forEach(h => {
    if (!(h instanceof HTMLElement)) return;
    const id = h.getAttribute('data-match-id');
    if (id && id === activeId) {
      h.classList.add(ACTIVE_CLASS);
      h.style.background = ACTIVE_COLOR;
    } else {
      h.classList.remove(ACTIVE_CLASS);
      h.style.background = DEFAULT_COLOR;
    }
  });
}

/**
 * 다음/이전 매치 id 계산.
 *
 * @param {Array<string>} ids - 매치 id 순서대로
 * @param {string} currentId
 * @param {1|-1} direction
 * @returns {string|null}
 */
export function nextMatchId(ids, currentId, direction = 1) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  if (!currentId) return ids[direction === 1 ? 0 : ids.length - 1];
  const i = ids.indexOf(currentId);
  if (i === -1) return ids[0];
  const n = (i + direction + ids.length) % ids.length;
  return ids[n];
}

/**
 * Overlay 의 hit 들을 모두 제거 (root 는 유지).
 *
 * @param {HTMLElement} container
 */
export function clearSearchHighlight(container) {
  if (!container || !(container instanceof HTMLElement)) return;
  const root = container.querySelector(`:scope > .${OVERLAY_CLASS}`);
  if (root) while (root.firstChild) root.removeChild(root.firstChild);
}

/**
 * Overlay root 까지 완전히 제거.
 *
 * @param {HTMLElement} container
 */
export function destroySearchHighlight(container) {
  if (!container || !(container instanceof HTMLElement)) return;
  const root = container.querySelector(`:scope > .${OVERLAY_CLASS}`);
  if (root && root.parentNode) root.parentNode.removeChild(root);
}

export default {
  renderSearchHighlight,
  setActiveMatch,
  nextMatchId,
  clearSearchHighlight,
  destroySearchHighlight,
};
