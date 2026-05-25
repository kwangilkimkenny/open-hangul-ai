/**
 * Autocomplete Popup
 * 입력 중 자동완성 후보 floating 팝업 — `hanja-popup` 패턴을 따른다.
 *
 * - 입력 caret 위치의 화면 rect 와 후보 배열을 받아 absolute 팝업 표시
 * - 키보드: ↑/↓ 이동, Tab/Enter 적용, ESC 취소, 1~9 빠른 선택
 * - 외부 클릭 시 자동 닫기
 *
 * @module autocomplete/autocomplete-popup
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('AutocompletePopup');

const POPUP_CLASS = 'autocomplete-popup';
const ITEM_CLASS = 'autocomplete-popup__item';
const ITEM_ACTIVE = 'autocomplete-popup__item--active';

/**
 * @typedef {Object} AutocompleteCandidate
 * @property {string} word
 * @property {number} [frequency]
 * @property {Array<string>} [sources]
 */

/**
 * @typedef {{ left:number, top:number, right?:number, bottom?:number, width?:number, height?:number }} PopupRect
 * @typedef {(candidate: AutocompleteCandidate | null, reason: 'select'|'cancel') => void} AutocompleteSelectHandler
 */

/**
 * AutocompletePopup — 싱글톤 사용 가능 / 직접 인스턴스화도 가능.
 */
export class AutocompletePopup {
  constructor() {
    /** @type {HTMLDivElement | null} */
    this.popup = null;
    /** @type {Array<AutocompleteCandidate>} */
    this.candidates = [];
    /** @type {number} */
    this.activeIndex = 0;
    /** @type {AutocompleteSelectHandler | null} */
    this.onSelect = null;
    /** @type {string} */
    this.prefix = '';
    /** @type {boolean} */
    this.visible = false;

    this._boundKeyHandler = this._handleKeyDown.bind(this);
    this._boundOutsideClick = this._handleOutsideClick.bind(this);

    this._ensureDom();
    logger.info('[AC] Popup initialized');
  }

  _ensureDom() {
    if (this.popup) return;
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = POPUP_CLASS;
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', '자동완성 후보');
    el.style.position = 'absolute';
    el.style.display = 'none';
    el.style.zIndex = '10000';
    el.style.minWidth = '160px';
    el.style.maxWidth = '320px';
    el.style.maxHeight = '280px';
    el.style.overflowY = 'auto';
    el.style.background = '#ffffff';
    el.style.border = '1px solid rgba(0,0,0,0.15)';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
    el.style.padding = '4px 0';
    el.style.font = '13px/1.4 -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    el.style.color = '#1a1a1a';
    document.body.appendChild(el);
    this.popup = el;
  }

  /**
   * 후보 팝업 표시.
   *
   * @param {Object} options
   * @param {string} options.prefix - 현재 입력된 prefix
   * @param {Array<AutocompleteCandidate>} options.candidates - 후보 배열 (정렬된 상태로 전달)
   * @param {PopupRect} options.rect - caret 위치의 화면 좌표
   * @param {AutocompleteSelectHandler} options.onSelect
   */
  show({ prefix, candidates, rect, onSelect }) {
    this._ensureDom();
    if (!this.popup) return;

    this.prefix = typeof prefix === 'string' ? prefix : '';
    this.candidates = Array.isArray(candidates) ? candidates.slice() : [];
    this.onSelect = typeof onSelect === 'function' ? onSelect : null;
    this.activeIndex = 0;

    this._render();
    this._positionAt(rect);

    this.popup.style.display = 'block';
    this.visible = true;

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this._boundKeyHandler, true);
      document.addEventListener('mousedown', this._boundOutsideClick);
    }

    logger.debug(`[AC] Popup shown: prefix=${this.prefix} (${this.candidates.length} candidates)`);
  }

  /**
   * 팝업 숨김.
   * @param {'select'|'cancel'} [reason='cancel']
   * @param {AutocompleteCandidate | null} [picked=null]
   */
  hide(reason = 'cancel', picked = null) {
    if (!this.visible) return;
    if (this.popup) this.popup.style.display = 'none';
    this.visible = false;

    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._boundKeyHandler, true);
      document.removeEventListener('mousedown', this._boundOutsideClick);
    }

    const cb = this.onSelect;
    this.onSelect = null;
    if (cb) {
      try {
        cb(picked, reason);
      } catch (err) {
        logger.error('[AC] onSelect handler threw:', err);
      }
    }
  }

  /**
   * 활성 후보 적용.
   * @returns {AutocompleteCandidate | null}
   */
  applyActive() {
    if (!this.visible) return null;
    const c = this.candidates[this.activeIndex] || null;
    this.hide('select', c);
    return c;
  }

  /**
   * 후보 목록 갱신 (팝업이 떠 있는 상태에서 prefix 가 길어졌을 때 재렌더).
   * @param {Array<AutocompleteCandidate>} candidates
   * @param {string} [prefix]
   */
  updateCandidates(candidates, prefix) {
    if (typeof prefix === 'string') this.prefix = prefix;
    this.candidates = Array.isArray(candidates) ? candidates.slice() : [];
    this.activeIndex = 0;
    if (this.visible) this._render();
  }

  _render() {
    if (!this.popup) return;
    const popup = this.popup;
    while (popup.firstChild) popup.removeChild(popup.firstChild);

    if (this.candidates.length === 0) {
      const empty = document.createElement('div');
      empty.className = `${ITEM_CLASS} ${ITEM_CLASS}--empty`;
      empty.style.padding = '8px 12px';
      empty.style.color = '#999';
      empty.textContent = '후보 없음';
      popup.appendChild(empty);
      return;
    }

    // 헤더 (현재 prefix 표시)
    const header = document.createElement('div');
    header.className = 'autocomplete-popup__header';
    header.style.padding = '4px 12px';
    header.style.fontSize = '11px';
    header.style.color = '#666';
    header.style.borderBottom = '1px solid rgba(0,0,0,0.08)';
    header.style.marginBottom = '4px';
    header.textContent = `${this.prefix} (${this.candidates.length})`;
    popup.appendChild(header);

    this.candidates.forEach((cand, idx) => {
      const item = document.createElement('div');
      item.className = ITEM_CLASS;
      item.setAttribute('role', 'option');
      item.setAttribute('data-index', String(idx));
      item.style.display = 'flex';
      item.style.alignItems = 'baseline';
      item.style.gap = '10px';
      item.style.padding = '6px 12px';
      item.style.cursor = 'pointer';

      // 단축키 표시 1-9
      if (idx < 9) {
        const num = document.createElement('span');
        num.className = 'autocomplete-popup__num';
        num.style.color = '#999';
        num.style.fontSize = '11px';
        num.style.minWidth = '12px';
        num.textContent = `${idx + 1}.`;
        item.appendChild(num);
      }

      const wordEl = document.createElement('span');
      wordEl.className = 'autocomplete-popup__word';
      wordEl.style.fontSize = '14px';
      wordEl.style.flex = '1';
      // prefix 부분은 시각적으로 약하게 (한글 호환 위해 substring 사용)
      const word = cand.word || '';
      const p = this.prefix || '';
      if (p.length > 0 && word.startsWith(p)) {
        const pre = document.createElement('span');
        pre.style.color = '#999';
        pre.textContent = p;
        const rest = document.createElement('span');
        rest.style.color = '#111';
        rest.style.fontWeight = '600';
        rest.textContent = word.slice(p.length);
        wordEl.appendChild(pre);
        wordEl.appendChild(rest);
      } else {
        wordEl.textContent = word;
      }
      item.appendChild(wordEl);

      if (Number.isFinite(cand.frequency)) {
        const freq = document.createElement('span');
        freq.className = 'autocomplete-popup__freq';
        freq.style.color = '#aaa';
        freq.style.fontSize = '10px';
        freq.textContent = `★${cand.frequency}`;
        item.appendChild(freq);
      }

      if (idx === this.activeIndex) {
        item.classList.add(ITEM_ACTIVE);
        item.style.background = 'rgba(59,130,246,0.12)';
      }

      item.addEventListener('mouseenter', () => this._setActive(idx));
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._setActive(idx);
        this.applyActive();
      });

      popup.appendChild(item);
    });
  }

  _setActive(idx) {
    if (!this.popup) return;
    const max = this.candidates.length - 1;
    if (max < 0) return;
    const next = Math.max(0, Math.min(max, idx));
    if (next === this.activeIndex) return;
    this.activeIndex = next;
    const items = this.popup.querySelectorAll(`.${ITEM_CLASS}`);
    items.forEach((el) => {
      const dataIdx = el.getAttribute('data-index');
      if (dataIdx === null) return;
      const matched = Number(dataIdx) === this.activeIndex;
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

  _handleKeyDown(ev) {
    if (!this.visible) return;
    const key = ev.key;

    if (key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.hide('cancel');
      return;
    }
    if (key === 'Enter' || key === 'Tab') {
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
    if (key === 'Home') {
      ev.preventDefault();
      this._setActive(0);
      return;
    }
    if (key === 'End') {
      ev.preventDefault();
      this._setActive(this.candidates.length - 1);
      return;
    }
    if (/^[1-9]$/.test(key)) {
      const idx = Number(key) - 1;
      if (idx < this.candidates.length) {
        ev.preventDefault();
        ev.stopPropagation();
        this._setActive(idx);
        this.applyActive();
      }
    }
  }

  _handleOutsideClick(ev) {
    if (!this.visible || !this.popup) return;
    if (ev.target instanceof Node && this.popup.contains(ev.target)) return;
    this.hide('cancel');
  }

  /**
   * 인스턴스 파괴 (테스트 cleanup).
   */
  destroy() {
    this.hide('cancel');
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
    }
    this.popup = null;
  }
}

/**
 * 간편 함수 — 모듈 스코프 싱글톤 사용.
 *
 * @param {{ prefix:string, candidates:Array<AutocompleteCandidate>, rect:PopupRect, onSelect:AutocompleteSelectHandler }} options
 * @returns {AutocompletePopup}
 */
let _singleton = null;
export function showAutocompletePopup(options) {
  if (!_singleton) _singleton = new AutocompletePopup();
  _singleton.show(options);
  return _singleton;
}

/**
 * 싱글톤 인스턴스 직접 접근 (controller 에서 update/hide 호출용).
 * @returns {AutocompletePopup}
 */
export function getAutocompletePopup() {
  if (!_singleton) _singleton = new AutocompletePopup();
  return _singleton;
}

export default AutocompletePopup;
