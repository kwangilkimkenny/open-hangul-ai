/**
 * Bookmark Jump
 *
 * HWPX 문서 안의 `bookmark` run (parser.js 가 `{type:'bookmark', name, ...}` 형태로 push)
 * 들을 수집해 목록 조회 / 화면 점프를 제공한다.
 *
 * - listBookmarks(doc): 문서 순회로 책갈피 메타데이터를 모은다.
 * - scrollToBookmark(container, name, opts):
 *     `data-bookmark` 가 일치하는 DOM 요소를 찾아 scrollIntoView + 잠시 강조.
 *
 * 렌더러가 `data-bookmark="<name>"` 또는 `id="bookmark-<name>"` 로 마킹한다고 가정한다.
 * 마킹이 없어도 listBookmarks 는 동작한다 (점프는 fallback 으로 paragraphIdx 사용).
 *
 * @module search/bookmark-jump
 * @version 1.0.0
 */

/**
 * @typedef {Object} BookmarkInfo
 * @property {string} name
 * @property {number} sectionIdx
 * @property {number} paragraphIdx
 * @property {number} runIdx
 */

/**
 * 문서 내 책갈피를 모두 모은다.
 *
 * @param {Object} doc
 * @returns {Array<BookmarkInfo>}
 */
export function listBookmarks(doc) {
  /** @type {Array<BookmarkInfo>} */
  const out = [];
  if (!doc || !Array.isArray(doc.sections)) return out;
  for (let s = 0; s < doc.sections.length; s++) {
    const section = doc.sections[s];
    if (!section || !Array.isArray(section.paragraphs)) continue;
    for (let p = 0; p < section.paragraphs.length; p++) {
      const para = section.paragraphs[p];
      if (!para || !Array.isArray(para.runs)) continue;
      for (let r = 0; r < para.runs.length; r++) {
        const run = para.runs[r];
        if (!run || run.type !== 'bookmark') continue;
        if (typeof run.name !== 'string' || run.name.length === 0) continue;
        out.push({ name: run.name, sectionIdx: s, paragraphIdx: p, runIdx: r });
      }
    }
  }
  return out;
}

/**
 * 이름으로 책갈피 1건 조회 (없으면 null).
 *
 * @param {Object} doc
 * @param {string} name
 * @returns {BookmarkInfo|null}
 */
export function findBookmark(doc, name) {
  if (typeof name !== 'string' || !name) return null;
  const list = listBookmarks(doc);
  return list.find(b => b.name === name) || null;
}

/**
 * DOM 컨테이너에서 책갈피 요소를 찾는다.
 *
 * @param {HTMLElement} container
 * @param {string} name
 * @returns {HTMLElement|null}
 */
function findBookmarkElement(container, name) {
  if (!container || !container.querySelector) return null;
  // 우선순위 1: data-bookmark 속성
  let el = container.querySelector(`[data-bookmark="${CSS.escape(name)}"]`);
  if (el) return /** @type {HTMLElement} */ (el);
  // 우선순위 2: id="bookmark-<name>"
  el = container.querySelector(`#${CSS.escape('bookmark-' + name)}`);
  if (el) return /** @type {HTMLElement} */ (el);
  // 우선순위 3: name 속성
  el = container.querySelector(`[name="${CSS.escape(name)}"]`);
  return el instanceof HTMLElement ? el : null;
}

/**
 * 책갈피로 점프 + 일시 강조.
 *
 * @param {HTMLElement} container
 * @param {string} name
 * @param {{ highlightMs?:number, scrollOptions?:ScrollIntoViewOptions }} [opts]
 * @returns {boolean} 점프 성공 여부
 */
export function scrollToBookmark(container, name, opts = {}) {
  if (!container || !(container instanceof HTMLElement)) return false;
  const el = findBookmarkElement(container, name);
  if (!el) return false;
  try {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView(opts.scrollOptions || { behavior: 'smooth', block: 'center' });
    }
  } catch (_e) {
    /* ignore */
  }
  // 임시 강조
  const prevOutline = el.style.outline;
  const prevBg = el.style.backgroundColor;
  el.style.outline = '2px solid #f59e0b';
  el.style.backgroundColor = 'rgba(254, 240, 138, 0.5)';
  const ms = typeof opts.highlightMs === 'number' ? opts.highlightMs : 1200;
  setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.backgroundColor = prevBg;
  }, ms);
  return true;
}

export default { listBookmarks, findBookmark, scrollToBookmark };
