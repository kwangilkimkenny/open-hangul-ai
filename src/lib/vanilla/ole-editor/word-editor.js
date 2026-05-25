/**
 * Word 미니 편집기
 * ─────────────────────────────────────────────────────────────────────────────
 * 브라우저 contenteditable 기반 Word OLE 인플레이스 편집기.
 *
 * 특징
 *   - 단락(p) 단위 모델 — `decodeWord(...)` 의 출력 스키마와 호환
 *   - 툴바: Bold / Italic / Underline / 정렬(left/center/right/justify)
 *   - 외부 사진/링크/스크립트 사용 안 함 (단순 텍스트 + 인라인 서식)
 *
 * 보안
 *   - innerHTML 에 외부 HTML 을 그대로 주입하지 않는다 — runs 를 createElement 로 조립.
 *   - paste 이벤트는 텍스트만 채택 (HTML 무시).
 *
 * @module vanilla/ole-editor/word-editor
 */

import { BaseEditor } from '../core/base-editor.js';

const DEFAULT_MODEL = { type: 'word', paragraphs: [{ runs: [{ text: '' }] }] };

const ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify', 'both']);

/**
 * Word 미니 편집기.
 *
 * @example
 *   const editor = new WordEditor({ container, dataModel });
 *   editor.render();
 *   const updated = editor.getDataModel();
 */
export class WordEditor extends BaseEditor {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container
   * @param {{type?:string, paragraphs:Array}} opts.dataModel
   */
  constructor({ container, dataModel }) {
    super({ container, dataModel });
    this.activeStates = { bold: false, italic: false, underline: false };
    this.activeAlign = 'left';
    /** @type {HTMLElement|null} */
    this.editorEl = null;
  }

  /**
   * BaseEditor 훅 — dataModel 정규화.
   * @param {*} m
   */
  _normalizeModel(m) {
    return normalizeWordModel(m);
  }

  // -------------------------------------------------------------------------
  // dataModel access
  // -------------------------------------------------------------------------

  /**
   * 현재 DOM 상태를 dataModel 로 동기화한 뒤 깊은 복사본을 반환한다.
   */
  getDataModel() {
    if (this.editorEl) {
      this.dataModel = this._collectModelFromDom();
    }
    return {
      type: 'word',
      paragraphs: this.dataModel.paragraphs.map(p => ({
        runs: p.runs.map(r => ({ ...r })),
        ...(p.align ? { align: p.align } : {}),
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Toolbar actions
  // -------------------------------------------------------------------------

  toggleBold() {
    return this._applyInlineToggle('bold');
  }
  toggleItalic() {
    return this._applyInlineToggle('italic');
  }
  toggleUnderline() {
    return this._applyInlineToggle('underline');
  }

  /**
   * 현재 캐럿이 위치한 단락의 정렬을 설정한다.
   * @param {'left'|'center'|'right'|'justify'} alignment
   */
  setAlignment(alignment) {
    if (!ALIGN_VALUES.has(alignment)) return;
    const targets = this._getActiveParagraphs();
    if (targets.length === 0) return;
    for (const p of targets) {
      p.style.textAlign = alignment;
      p.dataset.align = alignment;
    }
    this.activeAlign = alignment;
    this.dataModel = this._collectModelFromDom();
    this._markDirty();
  }

  /**
   * 평문/마크다운-스타일 텍스트 입력 시 모델 갱신.
   * 외부에서 텍스트를 강제로 셋업 할 때 사용 (테스트/프로그래매틱).
   *
   * @param {string} text
   */
  setPlainText(text) {
    const lines = String(text || '').split(/\r?\n/);
    this.dataModel = {
      type: 'word',
      paragraphs: lines.map(line => ({ runs: [{ text: line }] })),
    };
    this._markDirty();
    this.render();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  render() {
    this.container.innerHTML = '';
    this.container.classList.add('ole-word-editor');

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'ole-word-editor__toolbar';
    const makeBtn = (label, title, handler, cls = '') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ole-word-editor__btn ${cls}`.trim();
      b.textContent = label;
      b.title = title;
      b.addEventListener('mousedown', e => e.preventDefault()); // keep selection
      b.addEventListener('click', handler);
      return b;
    };
    toolbar.appendChild(makeBtn('B', '굵게 (Ctrl+B)', () => this.toggleBold(), 'is-bold'));
    toolbar.appendChild(makeBtn('I', '기울임 (Ctrl+I)', () => this.toggleItalic(), 'is-italic'));
    toolbar.appendChild(
      makeBtn('U', '밑줄 (Ctrl+U)', () => this.toggleUnderline(), 'is-underline')
    );
    toolbar.appendChild(makeBtn('左', '왼쪽 정렬', () => this.setAlignment('left')));
    toolbar.appendChild(makeBtn('中', '가운데 정렬', () => this.setAlignment('center')));
    toolbar.appendChild(makeBtn('右', '오른쪽 정렬', () => this.setAlignment('right')));
    toolbar.appendChild(makeBtn('☰', '양쪽 정렬', () => this.setAlignment('justify')));
    this.container.appendChild(toolbar);

    // Editable area
    const editor = document.createElement('div');
    editor.className = 'ole-word-editor__surface';
    editor.contentEditable = 'true';
    editor.setAttribute('contenteditable', 'true');
    editor.spellcheck = false;
    this._populateFromModel(editor);
    editor.addEventListener('keydown', this._onKeyDown);
    editor.addEventListener('paste', this._onPaste);
    editor.addEventListener('input', () => {
      this.dataModel = this._collectModelFromDom();
      this._markDirty();
    });
    this.container.appendChild(editor);
    this.editorEl = editor;
  }

  destroy() {
    if (this.editorEl) {
      this.editorEl.removeEventListener('keydown', this._onKeyDown);
      this.editorEl.removeEventListener('paste', this._onPaste);
    }
    this.editorEl = null;
    super.destroy();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  _populateFromModel(editor) {
    editor.innerHTML = '';
    for (const p of this.dataModel.paragraphs) {
      const pEl = document.createElement('p');
      pEl.className = 'ole-word-editor__para';
      if (p.align && ALIGN_VALUES.has(p.align)) {
        pEl.style.textAlign = p.align === 'both' ? 'justify' : p.align;
        pEl.dataset.align = p.align === 'both' ? 'justify' : p.align;
      }
      const runs = p.runs && p.runs.length > 0 ? p.runs : [{ text: '' }];
      for (const r of runs) {
        const span = document.createElement('span');
        span.className = 'ole-word-editor__run';
        if (r.bold) span.style.fontWeight = 'bold';
        if (r.italic) span.style.fontStyle = 'italic';
        if (r.underline) span.style.textDecoration = 'underline';
        span.dataset.bold = r.bold ? '1' : '0';
        span.dataset.italic = r.italic ? '1' : '0';
        span.dataset.underline = r.underline ? '1' : '0';
        span.textContent = r.text || '';
        pEl.appendChild(span);
      }
      editor.appendChild(pEl);
    }
  }

  _collectModelFromDom() {
    const out = { type: 'word', paragraphs: [] };
    if (!this.editorEl) return out;
    const pEls = this.editorEl.querySelectorAll('p');
    if (pEls.length === 0) {
      // 단일 텍스트 노드만 있는 경우 (paste 등)
      out.paragraphs.push({ runs: [{ text: this.editorEl.textContent || '' }] });
      return out;
    }
    for (const p of pEls) {
      const runs = [];
      // contenteditable 이 임의의 span/b/i/u 를 만들 수 있어 fallback 처리.
      for (const node of Array.from(p.childNodes)) {
        const collected = collectRuns(node);
        runs.push(...collected);
      }
      const align = p.dataset.align || (p.style.textAlign || undefined);
      out.paragraphs.push({
        runs: runs.length > 0 ? runs : [{ text: p.textContent || '' }],
        ...(align && ALIGN_VALUES.has(align) ? { align } : {}),
      });
    }
    return out;
  }

  _getActiveParagraphs() {
    if (!this.editorEl) return [];
    const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
    if (!sel || sel.rangeCount === 0) {
      const ps = this.editorEl.querySelectorAll('p');
      return ps.length > 0 ? [ps[0]] : [];
    }
    const range = sel.getRangeAt(0);
    const anchor = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
    let target = anchor;
    while (target && target !== this.editorEl && target.tagName !== 'P') {
      target = target.parentNode;
    }
    if (!target || target === this.editorEl) {
      const ps = this.editorEl.querySelectorAll('p');
      return ps.length > 0 ? [ps[0]] : [];
    }
    return [target];
  }

  _applyInlineToggle(kind) {
    const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
    if (!sel || sel.rangeCount === 0) {
      this.activeStates[kind] = !this.activeStates[kind];
      return this.activeStates[kind];
    }
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      this.activeStates[kind] = !this.activeStates[kind];
      return this.activeStates[kind];
    }
    // selected text 를 새 span 으로 감싼다.
    const text = range.toString();
    if (!text) return this.activeStates[kind];
    const span = document.createElement('span');
    span.className = 'ole-word-editor__run';
    const existing = {
      bold: this.activeStates.bold,
      italic: this.activeStates.italic,
      underline: this.activeStates.underline,
    };
    existing[kind] = !existing[kind];
    if (existing.bold) span.style.fontWeight = 'bold';
    if (existing.italic) span.style.fontStyle = 'italic';
    if (existing.underline) span.style.textDecoration = 'underline';
    span.dataset.bold = existing.bold ? '1' : '0';
    span.dataset.italic = existing.italic ? '1' : '0';
    span.dataset.underline = existing.underline ? '1' : '0';
    span.textContent = text;
    range.deleteContents();
    range.insertNode(span);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
    this.activeStates[kind] = existing[kind];
    this.dataModel = this._collectModelFromDom();
    this._markDirty();
    return this.activeStates[kind];
  }

  _onKeyDown = e => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        this.toggleBold();
      } else if (key === 'i') {
        e.preventDefault();
        this.toggleItalic();
      } else if (key === 'u') {
        e.preventDefault();
        this.toggleUnderline();
      }
    }
  };

  _onPaste = e => {
    // 외부 HTML 차단 — 텍스트만 사용
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    this.dataModel = this._collectModelFromDom();
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectRuns(node, ctx = { bold: false, italic: false, underline: false }) {
  const out = [];
  if (!node) return out;
  if (node.nodeType === 3) {
    const text = node.nodeValue || '';
    if (!text) return out;
    out.push({
      text,
      ...(ctx.bold ? { bold: true } : {}),
      ...(ctx.italic ? { italic: true } : {}),
      ...(ctx.underline ? { underline: true } : {}),
    });
    return out;
  }
  if (node.nodeType !== 1) return out;
  const el = /** @type {HTMLElement} */ (node);
  const localCtx = { ...ctx };
  const tag = el.tagName?.toLowerCase();
  if (tag === 'b' || tag === 'strong') localCtx.bold = true;
  if (tag === 'i' || tag === 'em') localCtx.italic = true;
  if (tag === 'u') localCtx.underline = true;
  if (el.dataset?.bold === '1') localCtx.bold = true;
  if (el.dataset?.italic === '1') localCtx.italic = true;
  if (el.dataset?.underline === '1') localCtx.underline = true;
  if (el.style?.fontWeight && /bold|[6-9]00/.test(el.style.fontWeight)) localCtx.bold = true;
  if (el.style?.fontStyle === 'italic') localCtx.italic = true;
  if (el.style?.textDecoration?.includes('underline')) localCtx.underline = true;
  for (const child of Array.from(el.childNodes)) {
    out.push(...collectRuns(child, localCtx));
  }
  return out;
}

function normalizeWordModel(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.paragraphs)) {
    return JSON.parse(JSON.stringify(DEFAULT_MODEL));
  }
  return {
    type: 'word',
    paragraphs: input.paragraphs.map(p => ({
      runs:
        Array.isArray(p?.runs) && p.runs.length > 0
          ? p.runs.map(r => ({
              text: typeof r?.text === 'string' ? r.text : '',
              ...(r?.bold ? { bold: true } : {}),
              ...(r?.italic ? { italic: true } : {}),
              ...(r?.underline ? { underline: true } : {}),
            }))
          : [{ text: '' }],
      ...(typeof p?.align === 'string' && ALIGN_VALUES.has(p.align) ? { align: p.align } : {}),
    })),
  };
}

export const __test__ = {
  collectRuns,
  normalizeWordModel,
};
