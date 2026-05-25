/**
 * Search Dialog (floating panel)
 *
 * 페이지 상단에 떠 있는 작은 검색 패널:
 *   - 입력란 (검색어)
 *   - 옵션 토글: 정규식 / 대소문자 / 단어 단위 / 유사문자 / 스타일(only-bold)
 *   - 결과 카운트 (예: 3/12)
 *   - 다음/이전 버튼
 *   - 닫기 버튼
 *
 * 키보드:
 *   - Ctrl+F: open
 *   - F3 / Shift+F3: next / previous
 *   - ESC: close
 *
 * 사용처에서는 onSearch/onNext/onPrev/onClose 콜백을 통해 엔진과 연결한다.
 *
 * @module search/search-dialog
 * @version 1.0.0
 */

const DIALOG_CLASS = 'search-dialog';

/**
 * @typedef {Object} SearchDialogOptions
 * @property {(query:string, opts:Object) => void} [onSearch]
 * @property {(query:string, opts:Object) => void} [onChange]
 * @property {() => void} [onNext]
 * @property {() => void} [onPrev]
 * @property {() => void} [onClose]
 * @property {string} [initialQuery]
 */

/**
 * @typedef {Object} SearchDialogHandle
 * @property {HTMLDivElement} element
 * @property {() => void} open
 * @property {() => void} close
 * @property {(count:number, current:number) => void} setCount
 * @property {(query:string) => void} setQuery
 * @property {() => Object} getOptions
 * @property {() => string} getQuery
 * @property {() => void} destroy
 */

/**
 * 옵션 토글 버튼 생성.
 */
function makeToggle(doc, label, title) {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.title = title;
  btn.dataset.pressed = 'false';
  btn.style.minWidth = '24px';
  btn.style.padding = '2px 6px';
  btn.style.border = '1px solid #d1d5db';
  btn.style.borderRadius = '4px';
  btn.style.background = '#fff';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '12px';
  btn.addEventListener('click', () => {
    const pressed = btn.dataset.pressed === 'true';
    btn.dataset.pressed = pressed ? 'false' : 'true';
    btn.style.background = pressed ? '#fff' : '#dbeafe';
    btn.style.borderColor = pressed ? '#d1d5db' : '#3b82f6';
  });
  return btn;
}

/**
 * Floating 검색 패널을 mount 한다.
 *
 * @param {HTMLElement} mountPoint
 * @param {SearchDialogOptions} [opts]
 * @returns {SearchDialogHandle}
 */
export function mountSearchDialog(mountPoint, opts = {}) {
  if (!mountPoint || !(mountPoint instanceof HTMLElement)) {
    throw new TypeError('mountSearchDialog: mountPoint must be HTMLElement');
  }
  const doc = mountPoint.ownerDocument;
  const root = doc.createElement('div');
  root.className = DIALOG_CLASS;
  root.style.position = 'absolute';
  root.style.top = '8px';
  root.style.right = '12px';
  root.style.zIndex = '50';
  root.style.background = '#fff';
  root.style.border = '1px solid #e5e7eb';
  root.style.borderRadius = '8px';
  root.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
  root.style.padding = '6px 8px';
  root.style.display = 'none';
  root.style.alignItems = 'center';
  root.style.gap = '6px';
  root.style.fontFamily = 'system-ui, sans-serif';
  root.style.fontSize = '13px';

  const input = doc.createElement('input');
  input.type = 'text';
  input.className = `${DIALOG_CLASS}__input`;
  input.placeholder = '검색…';
  input.value = opts.initialQuery || '';
  input.style.width = '160px';
  input.style.padding = '2px 6px';
  input.style.border = '1px solid #d1d5db';
  input.style.borderRadius = '4px';

  const regexBtn = makeToggle(doc, '.*', '정규식');
  regexBtn.dataset.role = 'regex';
  const caseBtn = makeToggle(doc, 'Aa', '대소문자 구분');
  caseBtn.dataset.role = 'case';
  const wordBtn = makeToggle(doc, '⌷', '단어 단위');
  wordBtn.dataset.role = 'word';
  const fuzzyBtn = makeToggle(doc, 'ㄱㅏ', '유사 문자 무시');
  fuzzyBtn.dataset.role = 'fuzzy';
  const styleBtn = makeToggle(doc, 'B', '굵게 스타일만');
  styleBtn.dataset.role = 'style';

  const count = doc.createElement('span');
  count.className = `${DIALOG_CLASS}__count`;
  count.textContent = '0/0';
  count.style.minWidth = '36px';
  count.style.textAlign = 'center';
  count.style.color = '#6b7280';

  const prevBtn = doc.createElement('button');
  prevBtn.type = 'button';
  prevBtn.textContent = '↑';
  prevBtn.title = '이전 (Shift+F3)';
  prevBtn.className = `${DIALOG_CLASS}__prev`;
  prevBtn.style.padding = '2px 6px';
  prevBtn.style.border = '1px solid #d1d5db';
  prevBtn.style.borderRadius = '4px';
  prevBtn.style.background = '#fff';
  prevBtn.style.cursor = 'pointer';

  const nextBtn = doc.createElement('button');
  nextBtn.type = 'button';
  nextBtn.textContent = '↓';
  nextBtn.title = '다음 (F3)';
  nextBtn.className = `${DIALOG_CLASS}__next`;
  nextBtn.style.padding = '2px 6px';
  nextBtn.style.border = '1px solid #d1d5db';
  nextBtn.style.borderRadius = '4px';
  nextBtn.style.background = '#fff';
  nextBtn.style.cursor = 'pointer';

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.title = '닫기 (ESC)';
  closeBtn.className = `${DIALOG_CLASS}__close`;
  closeBtn.style.padding = '2px 6px';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'transparent';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.color = '#6b7280';
  closeBtn.style.fontSize = '16px';

  root.appendChild(input);
  root.appendChild(regexBtn);
  root.appendChild(caseBtn);
  root.appendChild(wordBtn);
  root.appendChild(fuzzyBtn);
  root.appendChild(styleBtn);
  root.appendChild(count);
  root.appendChild(prevBtn);
  root.appendChild(nextBtn);
  root.appendChild(closeBtn);

  if (getComputedStyle(mountPoint).position === 'static') {
    mountPoint.style.position = 'relative';
  }
  mountPoint.appendChild(root);

  const getOptions = () => ({
    regex: regexBtn.dataset.pressed === 'true',
    caseSensitive: caseBtn.dataset.pressed === 'true',
    wholeWord: wordBtn.dataset.pressed === 'true',
    ignoreSimilarChars: fuzzyBtn.dataset.pressed === 'true',
    styleFilter: styleBtn.dataset.pressed === 'true' ? { bold: true } : null,
  });

  const getQuery = () => input.value || '';

  const fireSearch = () => {
    if (typeof opts.onSearch === 'function') {
      opts.onSearch(getQuery(), getOptions());
    }
  };
  const fireChange = () => {
    if (typeof opts.onChange === 'function') {
      opts.onChange(getQuery(), getOptions());
    }
  };

  input.addEventListener('input', fireChange);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (ev.shiftKey && typeof opts.onPrev === 'function') opts.onPrev();
      else if (typeof opts.onNext === 'function') opts.onNext();
      else fireSearch();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
    }
  });
  regexBtn.addEventListener('click', fireChange);
  caseBtn.addEventListener('click', fireChange);
  wordBtn.addEventListener('click', fireChange);
  fuzzyBtn.addEventListener('click', fireChange);
  styleBtn.addEventListener('click', fireChange);

  nextBtn.addEventListener('click', () => {
    if (typeof opts.onNext === 'function') opts.onNext();
  });
  prevBtn.addEventListener('click', () => {
    if (typeof opts.onPrev === 'function') opts.onPrev();
  });
  closeBtn.addEventListener('click', () => close());

  // 글로벌 키 핸들러 (Ctrl+F / F3 / Shift+F3 / ESC)
  const onKey = ev => {
    // Ctrl+F (or Cmd+F)
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'f' || ev.key === 'F')) {
      ev.preventDefault();
      open();
      return;
    }
    // F3
    if (ev.key === 'F3') {
      ev.preventDefault();
      if (ev.shiftKey) {
        if (typeof opts.onPrev === 'function') opts.onPrev();
      } else if (typeof opts.onNext === 'function') opts.onNext();
      return;
    }
    if (ev.key === 'Escape' && root.style.display !== 'none') {
      ev.preventDefault();
      close();
    }
  };
  doc.addEventListener('keydown', onKey);

  function open() {
    root.style.display = 'inline-flex';
    try {
      input.focus();
      input.select();
    } catch (_e) {
      /* jsdom */
    }
  }
  function close() {
    root.style.display = 'none';
    if (typeof opts.onClose === 'function') opts.onClose();
  }
  function setCount(c, current) {
    const cur = c > 0 ? Math.max(1, (current || 0) + 1) : 0;
    count.textContent = `${cur}/${c || 0}`;
  }
  function setQuery(q) {
    input.value = q == null ? '' : String(q);
  }
  function destroy() {
    doc.removeEventListener('keydown', onKey);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  /** @type {SearchDialogHandle} */
  const handle = {
    element: root,
    open,
    close,
    setCount,
    setQuery,
    getOptions,
    getQuery,
    destroy,
  };
  return handle;
}

export default { mountSearchDialog };
