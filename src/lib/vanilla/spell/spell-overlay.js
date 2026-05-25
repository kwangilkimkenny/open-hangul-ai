/**
 * Spell Underline Overlay
 * 검사 결과를 페이지 컨테이너 위에 absolute 레이어로 시각화한다.
 *
 * 입력:
 *   - container: HTMLElement (페이지 또는 편집 영역). position:relative 인 것이 권장된다.
 *   - issues: SpellIssue 배열 + 원본 텍스트 노드 매핑
 * 출력:
 *   - 컨테이너 안에 `<div class="spell-overlay">` 가 생성되고,
 *     각 issue 위치에 `<span class="spell-underline spell-underline--<severity>">` 가 absolute 배치된다.
 *
 * jsdom 환경에서는 `Range.getClientRects()` 가 빈 배열을 반환할 수 있으므로,
 * 텍스트 노드의 `getBoundingClientRect()` 를 fallback 으로 사용한다.
 *
 * @module spell/spell-overlay
 * @version 1.0.0
 */

const OVERLAY_CLASS = 'spell-overlay';
const UNDERLINE_CLASS = 'spell-underline';

/**
 * @typedef {import('./spell-checker.js').SpellIssue} SpellIssue
 * @typedef {Object} OverlayTarget
 * @property {Node} textNode  - 검사 대상 텍스트 노드 (요소가 아닌 #text)
 * @property {string} text    - 텍스트 노드의 전체 텍스트
 * @property {Array<SpellIssue>} issues - 텍스트 내 issue 들
 */

/**
 * 색상 매핑.
 */
const COLOR_BY_SEVERITY = {
  error: '#e11d48', // rose-600
  warning: '#f59e0b', // amber-500
  info: '#3b82f6', // blue-500
};

/**
 * 컨테이너 안에 오버레이 root 를 생성(있으면 재사용).
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
  root.style.zIndex = '5';
  container.appendChild(root);
  return /** @type {HTMLDivElement} */ (root);
}

/**
 * Range 의 위치 사각형 목록을 반환. jsdom 등에서 빈 결과면 노드의 bbox 로 fallback.
 *
 * @param {Range} range
 * @param {Node} fallbackNode
 * @returns {Array<{ left:number, top:number, width:number, height:number }>}
 */
function getRectsForRange(range, fallbackNode) {
  /** @type {Array<{left:number,top:number,width:number,height:number}>} */
  const rects = [];
  try {
    const list = range.getClientRects();
    if (list && list.length > 0) {
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (!r) continue;
        if (typeof r.width === 'number' && typeof r.height === 'number') {
          rects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
        }
      }
    }
  } catch (_e) {
    // ignore
  }
  if (rects.length === 0 && fallbackNode) {
    try {
      const parent = fallbackNode.parentElement;
      if (parent && typeof parent.getBoundingClientRect === 'function') {
        const br = parent.getBoundingClientRect();
        rects.push({ left: br.left, top: br.top, width: br.width || 20, height: br.height || 18 });
      }
    } catch (_e) {
      // ignore
    }
  }
  return rects;
}

/**
 * 컨테이너에 대한 오버레이를 (재)그린다.
 *
 * @param {HTMLElement} container
 * @param {Array<OverlayTarget>} targets
 * @returns {{ root: HTMLDivElement, underlines: Array<HTMLSpanElement> }}
 */
export function renderOverlay(container, targets) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new TypeError('renderOverlay: container must be HTMLElement');
  }
  const root = ensureOverlayRoot(container);
  // 기존 underline 제거
  while (root.firstChild) root.removeChild(root.firstChild);

  /** @type {Array<HTMLSpanElement>} */
  const underlines = [];
  if (!Array.isArray(targets) || targets.length === 0) {
    return { root, underlines };
  }

  const containerRect = container.getBoundingClientRect
    ? container.getBoundingClientRect()
    : { left: 0, top: 0, width: 0, height: 0 };

  for (const target of targets) {
    if (!target || !target.textNode || !Array.isArray(target.issues)) continue;
    for (const issue of target.issues) {
      if (!issue || typeof issue.start !== 'number' || typeof issue.end !== 'number') continue;
      let range;
      try {
        range = container.ownerDocument.createRange();
        range.setStart(target.textNode, Math.max(0, issue.start));
        range.setEnd(target.textNode, Math.min(target.textNode.textContent?.length ?? issue.end, issue.end));
      } catch (_e) {
        continue;
      }
      const rects = getRectsForRange(range, target.textNode);
      for (const r of rects) {
        const span = container.ownerDocument.createElement('span');
        span.className = `${UNDERLINE_CLASS} ${UNDERLINE_CLASS}--${issue.severity}`;
        span.setAttribute('data-rule-id', issue.ruleId);
        span.setAttribute('data-text', issue.text);
        span.setAttribute('data-replacement', issue.replacement);
        span.title = issue.hint || issue.text;
        span.style.position = 'absolute';
        span.style.left = `${Math.round(r.left - containerRect.left)}px`;
        // 밑줄을 글자 아래로 배치
        span.style.top = `${Math.round(r.top - containerRect.top + (r.height || 18) - 3)}px`;
        span.style.width = `${Math.round(r.width || 12)}px`;
        span.style.height = '3px';
        span.style.borderRadius = '2px';
        span.style.pointerEvents = 'auto';
        span.style.cursor = 'pointer';
        span.style.background = COLOR_BY_SEVERITY[issue.severity] || '#e11d48';
        span.style.opacity = '0.7';
        root.appendChild(span);
        underlines.push(span);
      }
    }
  }

  return { root, underlines };
}

/**
 * 컨테이너의 모든 underline 제거.
 *
 * @param {HTMLElement} container
 */
export function clearOverlay(container) {
  if (!container || !(container instanceof HTMLElement)) return;
  const root = container.querySelector(`:scope > .${OVERLAY_CLASS}`);
  if (root) {
    while (root.firstChild) root.removeChild(root.firstChild);
  }
}

/**
 * 오버레이 완전 제거(root 노드 자체를 떼어낸다).
 *
 * @param {HTMLElement} container
 */
export function destroyOverlay(container) {
  if (!container || !(container instanceof HTMLElement)) return;
  const root = container.querySelector(`:scope > .${OVERLAY_CLASS}`);
  if (root && root.parentNode) root.parentNode.removeChild(root);
}

/**
 * 클릭 핸들러 부착 — underline 클릭 시 issue 메타데이터를 콜백에 전달.
 *
 * @param {HTMLElement} container
 * @param {(meta:{ ruleId:string, text:string, replacement:string, target:HTMLElement }) => void} handler
 * @returns {() => void} dispose
 */
export function bindUnderlineClick(container, handler) {
  if (!container || !(container instanceof HTMLElement) || typeof handler !== 'function') {
    return () => {};
  }
  const onClick = (/** @type {Event} */ ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.classList.contains(UNDERLINE_CLASS)) return;
    handler({
      ruleId: t.getAttribute('data-rule-id') || '',
      text: t.getAttribute('data-text') || '',
      replacement: t.getAttribute('data-replacement') || '',
      target: t,
    });
  };
  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}

export default {
  renderOverlay,
  clearOverlay,
  destroyOverlay,
  bindUnderlineClick,
};
