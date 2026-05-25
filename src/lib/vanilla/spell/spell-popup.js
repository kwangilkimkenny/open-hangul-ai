/**
 * Spell Suggestion Popup
 * 맞춤법 검사기에서 발견한 issue 의 교정 후보를 보여주는 인라인 팝업 UI.
 *
 * 동작:
 *   - 한 issue 에 대해: 교정안 1개 + 액션(적용 / 무시 / 사용자 사전 추가) 제공
 *   - ↑/↓ 로 액션 이동, Enter 로 실행, ESC 로 취소
 *   - 외부 클릭 시 자동 닫힘
 *
 * `hanja-popup.js` 의 패턴을 따른다.
 *
 * @module spell/spell-popup
 * @version 1.0.0
 */

const POPUP_CLASS = 'spell-popup';
const ITEM_CLASS = 'spell-popup__action';
const ITEM_ACTIVE = 'spell-popup__action--active';

/**
 * @typedef {import('./spell-checker.js').SpellIssue} SpellIssue
 * @typedef {{ left:number, top:number, right?:number, bottom?:number, width?:number, height?:number }} PopupRect
 * @typedef {'apply'|'ignore'|'add-to-dict'|'cancel'} SpellAction
 * @typedef {(action: SpellAction, issue: SpellIssue | null) => void} SpellSelectHandler
 */

const ACTIONS = /** @type {const} */ ([
  { key: 'apply', label: '교정 적용', hint: 'Enter' },
  { key: 'ignore', label: '무시 (이번 세션)', hint: 'I' },
  { key: 'add-to-dict', label: '사용자 사전에 추가', hint: 'A' },
  { key: 'cancel', label: '취소', hint: 'Esc' },
]);

/**
 * SpellPopup 클래스 — 싱글톤처럼 써도 되고 직접 인스턴스로 써도 된다.
 */
export class SpellPopup {
  constructor() {
    /** @type {HTMLDivElement | null} */
    this.popup = null;
    /** @type {SpellIssue | null} */
    this.issue = null;
    /** @type {number} */
    this.activeIndex = 0;
    /** @type {SpellSelectHandler | null} */
    this.onSelect = null;
    /** @type {boolean} */
    this.visible = false;

    this._boundKey = this._handleKey.bind(this);
    this._boundOutside = this._handleOutside.bind(this);

    this._ensureDom();
  }

  _ensureDom() {
    if (this.popup) return;
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = POPUP_CLASS;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '맞춤법 교정 제안');
    el.style.position = 'absolute';
    el.style.display = 'none';
    el.style.zIndex = '10001';
    el.style.minWidth = '220px';
    el.style.maxWidth = '360px';
    el.style.background = '#ffffff';
    el.style.border = '1px solid rgba(0,0,0,0.15)';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)';
    el.style.padding = '8px 0';
    el.style.font = '13px/1.4 -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    el.style.color = '#1a1a1a';
    document.body.appendChild(el);
    this.popup = el;
  }

  /**
   * 팝업 표시.
   *
   * @param {{ issue: SpellIssue, rect: PopupRect, onSelect: SpellSelectHandler }} options
   */
  show({ issue, rect, onSelect }) {
    this._ensureDom();
    if (!this.popup || !issue) return;
    this.issue = issue;
    this.onSelect = typeof onSelect === 'function' ? onSelect : null;
    this.activeIndex = 0;

    this._render();
    this._positionAt(rect);
    this.popup.style.display = 'block';
    this.visible = true;

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this._boundKey, true);
      document.addEventListener('mousedown', this._boundOutside);
    }
  }

  /**
   * 팝업 닫기.
   * @param {SpellAction} [action='cancel']
   */
  hide(action = 'cancel') {
    if (!this.visible) return;
    if (this.popup) this.popup.style.display = 'none';
    this.visible = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._boundKey, true);
      document.removeEventListener('mousedown', this._boundOutside);
    }
    const cb = this.onSelect;
    const issue = this.issue;
    this.onSelect = null;
    if (cb) {
      try {
        cb(action, action === 'cancel' ? null : issue);
      } catch (_e) {
        // swallow
      }
    }
  }

  /**
   * 현재 활성 액션 실행.
   * @returns {SpellAction}
   */
  applyActive() {
    const action = ACTIONS[this.activeIndex]?.key || 'cancel';
    this.hide(/** @type {SpellAction} */ (action));
    return /** @type {SpellAction} */ (action);
  }

  _render() {
    if (!this.popup || !this.issue) return;
    const popup = this.popup;
    while (popup.firstChild) popup.removeChild(popup.firstChild);

    // 헤더: 원문 + 화살표 + 교정안
    const header = document.createElement('div');
    header.className = 'spell-popup__header';
    header.style.padding = '6px 12px';
    header.style.borderBottom = '1px solid rgba(0,0,0,0.08)';
    header.style.marginBottom = '6px';

    const wrong = document.createElement('span');
    wrong.style.textDecoration = 'line-through';
    wrong.style.color = '#e11d48';
    wrong.style.marginRight = '6px';
    wrong.textContent = this.issue.text;
    header.appendChild(wrong);

    const arrow = document.createElement('span');
    arrow.style.color = '#999';
    arrow.style.marginRight = '6px';
    arrow.textContent = '→';
    header.appendChild(arrow);

    const right = document.createElement('span');
    right.style.color = '#16a34a';
    right.style.fontWeight = '600';
    right.textContent = this.issue.replacement;
    header.appendChild(right);

    popup.appendChild(header);

    // 힌트
    if (this.issue.hint) {
      const hint = document.createElement('div');
      hint.className = 'spell-popup__hint';
      hint.style.padding = '0 12px 6px';
      hint.style.fontSize = '11px';
      hint.style.color = '#666';
      hint.textContent = this.issue.hint;
      popup.appendChild(hint);
    }

    // 액션 목록
    ACTIONS.forEach((action, idx) => {
      const item = document.createElement('div');
      item.className = ITEM_CLASS;
      item.setAttribute('role', 'button');
      item.setAttribute('data-action', action.key);
      item.setAttribute('data-index', String(idx));
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.gap = '8px';
      item.style.padding = '6px 12px';
      item.style.cursor = 'pointer';

      const label = document.createElement('span');
      label.textContent = action.label;
      item.appendChild(label);

      const hint = document.createElement('span');
      hint.style.color = '#aaa';
      hint.style.fontSize = '10px';
      hint.textContent = action.hint;
      item.appendChild(hint);

      if (idx === this.activeIndex) {
        item.classList.add(ITEM_ACTIVE);
        item.style.background = 'rgba(59,130,246,0.12)';
      }

      item.addEventListener('mouseenter', () => this._setActive(idx));
      item.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this._setActive(idx);
        this.applyActive();
      });
      popup.appendChild(item);
    });
  }

  _setActive(idx) {
    if (!this.popup) return;
    const max = ACTIONS.length - 1;
    const next = Math.max(0, Math.min(max, idx));
    if (next === this.activeIndex) return;
    this.activeIndex = next;
    const items = this.popup.querySelectorAll(`.${ITEM_CLASS}`);
    items.forEach((el) => {
      const di = el.getAttribute('data-index');
      const matched = di !== null && Number(di) === this.activeIndex;
      el.classList.toggle(ITEM_ACTIVE, matched);
      /** @type {HTMLElement} */ (el).style.background = matched ? 'rgba(59,130,246,0.12)' : '';
    });
  }

  _positionAt(rect) {
    if (!this.popup || !rect) return;
    const scrollX = typeof window !== 'undefined' ? window.scrollX || 0 : 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
    const left = Math.max(8, (rect.left ?? 0) + scrollX);
    const top = (rect.bottom ?? (rect.top ?? 0) + 20) + scrollY + 4;
    this.popup.style.left = `${Math.round(left)}px`;
    this.popup.style.top = `${Math.round(top)}px`;
  }

  _handleKey(ev) {
    if (!this.visible) return;
    const key = ev.key;
    if (key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.hide('cancel');
      return;
    }
    if (key === 'Enter') {
      ev.preventDefault();
      ev.stopPropagation();
      this.applyActive();
      return;
    }
    if (key === 'ArrowDown') {
      ev.preventDefault();
      ev.stopPropagation();
      this._setActive(this.activeIndex + 1);
      return;
    }
    if (key === 'ArrowUp') {
      ev.preventDefault();
      ev.stopPropagation();
      this._setActive(this.activeIndex - 1);
      return;
    }
    // 단축키 I (ignore), A (add-to-dict)
    if (key === 'i' || key === 'I') {
      ev.preventDefault();
      ev.stopPropagation();
      this._setActive(1);
      this.applyActive();
      return;
    }
    if (key === 'a' || key === 'A') {
      ev.preventDefault();
      ev.stopPropagation();
      this._setActive(2);
      this.applyActive();
    }
  }

  _handleOutside(ev) {
    if (!this.visible || !this.popup) return;
    if (ev.target instanceof Node && this.popup.contains(ev.target)) return;
    this.hide('cancel');
  }

  destroy() {
    this.hide('cancel');
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
    }
    this.popup = null;
  }
}

/**
 * 싱글톤 헬퍼.
 * @type {SpellPopup | null}
 */
let _singleton = null;

/**
 * @param {{ issue: SpellIssue, rect: PopupRect, onSelect: SpellSelectHandler }} options
 * @returns {SpellPopup}
 */
export function showSpellPopup(options) {
  if (!_singleton) _singleton = new SpellPopup();
  _singleton.show(options);
  return _singleton;
}

/**
 * 단축키 (F7 / Ctrl+;) 바인딩 유틸.
 *
 * @param {HTMLElement | Document} target
 * @param {() => void} handler
 * @returns {() => void}
 */
export function bindSpellShortcut(target, handler) {
  if (!target || typeof handler !== 'function') return () => {};
  const onKey = (/** @type {KeyboardEvent} */ ev) => {
    const isF7 = ev.key === 'F7';
    const isCtrlSemi = (ev.ctrlKey || ev.metaKey) && ev.key === ';';
    if (isF7 || isCtrlSemi) {
      ev.preventDefault();
      try {
        handler();
      } catch (_e) {
        // ignore
      }
    }
  };
  /** @type {any} */ (target).addEventListener('keydown', onKey);
  return () => /** @type {any} */ (target).removeEventListener('keydown', onKey);
}

export default SpellPopup;
