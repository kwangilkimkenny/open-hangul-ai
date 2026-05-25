/**
 * Hanja Popup
 * 한글 → 한자 변환 인라인 후보 팝업 UI
 *
 * - canvas-editor / inline 모드 어디서든 사용 가능한 vanilla 모듈
 * - 한글 선택 영역의 화면 좌표(rect)와 후보 배열을 받아 floating popup을 띄움
 * - 클릭/Enter로 적용, ESC로 취소, ↑/↓로 후보 이동, 1~9 숫자키로 빠른 선택
 *
 * @module hanja/hanja-popup
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

const POPUP_CLASS = 'hanja-popup';
const ITEM_CLASS = 'hanja-popup__item';
const ITEM_ACTIVE = 'hanja-popup__item--active';

/**
 * @typedef {{ hanja:string, meaning:string, frequency:number }} HanjaCandidate
 * @typedef {{ left:number, top:number, right?:number, bottom?:number, width?:number, height?:number }} PopupRect
 * @typedef {(candidate: HanjaCandidate | null, reason: 'select'|'cancel') => void} HanjaSelectHandler
 */

/**
 * HanjaPopup 클래스 — 싱글톤처럼 사용해도 되고 인스턴스를 직접 생성해도 된다.
 */
export class HanjaPopup {
  constructor() {
    /** @type {HTMLDivElement | null} */
    this.popup = null;
    /** @type {Array<HanjaCandidate>} */
    this.candidates = [];
    /** @type {number} */
    this.activeIndex = 0;
    /** @type {HanjaSelectHandler | null} */
    this.onSelect = null;
    /** @type {string} */
    this.sourceText = '';
    /** @type {boolean} */
    this.visible = false;

    this._boundKeyHandler = this._handleKeyDown.bind(this);
    this._boundOutsideClick = this._handleOutsideClick.bind(this);

    this._ensureDom();
    logger.info('[Hanja] Popup initialized');
  }

  /**
   * DOM 컨테이너 생성(이미 있으면 재사용).
   * @private
   */
  _ensureDom() {
    if (this.popup) return;
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = POPUP_CLASS;
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', '한자 변환 후보');
    el.style.position = 'absolute';
    el.style.display = 'none';
    el.style.zIndex = '10000';
    el.style.minWidth = '180px';
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
   * @param {string} options.source - 원본 한글 텍스트
   * @param {Array<HanjaCandidate>} options.candidates - 한자 후보 배열
   * @param {PopupRect} options.rect - 화면 좌표 (선택 영역 위치)
   * @param {HanjaSelectHandler} options.onSelect - 선택/취소 콜백
   */
  show({ source, candidates, rect, onSelect }) {
    this._ensureDom();
    if (!this.popup) return;

    this.sourceText = source || '';
    this.candidates = Array.isArray(candidates) ? candidates.slice() : [];
    this.onSelect = typeof onSelect === 'function' ? onSelect : null;
    this.activeIndex = 0;

    this._render();
    this._positionAt(rect);

    this.popup.style.display = 'block';
    this.visible = true;

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this._boundKeyHandler, true);
      // 캡처 단계가 아닌 일반 click 단계에서 처리 (popup 내부 click은 stopPropagation으로 보호)
      document.addEventListener('mousedown', this._boundOutsideClick);
    }

    logger.debug(`[Hanja] Popup shown: ${this.sourceText} (${this.candidates.length} candidates)`);
  }

  /**
   * 팝업 숨김 및 정리.
   * @param {'select'|'cancel'} [reason='cancel']
   * @param {HanjaCandidate | null} [picked=null]
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
        logger.error('[Hanja] onSelect handler threw:', err);
      }
    }
  }

  /**
   * 현재 활성 후보 선택 적용.
   * @returns {HanjaCandidate | null}
   */
  applyActive() {
    if (!this.visible) return null;
    const c = this.candidates[this.activeIndex] || null;
    this.hide('select', c);
    return c;
  }

  /**
   * 후보 리스트 렌더링.
   * @private
   */
  _render() {
    if (!this.popup) return;
    const popup = this.popup;
    // 안전한 DOM 조작 (innerHTML로 텍스트 주입 회피)
    while (popup.firstChild) popup.removeChild(popup.firstChild);

    if (this.candidates.length === 0) {
      const empty = document.createElement('div');
      empty.className = `${ITEM_CLASS} ${ITEM_CLASS}--empty`;
      empty.style.padding = '8px 12px';
      empty.style.color = '#999';
      empty.textContent = `'${this.sourceText}' 에 대한 한자 후보가 없습니다.`;
      popup.appendChild(empty);
      return;
    }

    // 헤더 (원본 한글 표시)
    const header = document.createElement('div');
    header.className = 'hanja-popup__header';
    header.style.padding = '4px 12px';
    header.style.fontSize = '11px';
    header.style.color = '#666';
    header.style.borderBottom = '1px solid rgba(0,0,0,0.08)';
    header.style.marginBottom = '4px';
    header.textContent = `${this.sourceText} (${this.candidates.length}개 후보)`;
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

      // 단축키 표시 (1-9)
      if (idx < 9) {
        const num = document.createElement('span');
        num.className = 'hanja-popup__num';
        num.style.color = '#999';
        num.style.fontSize = '11px';
        num.style.minWidth = '12px';
        num.textContent = `${idx + 1}.`;
        item.appendChild(num);
      }

      const hj = document.createElement('span');
      hj.className = 'hanja-popup__hanja';
      hj.style.fontSize = '16px';
      hj.style.fontWeight = '600';
      hj.style.minWidth = '24px';
      hj.textContent = cand.hanja;
      item.appendChild(hj);

      const meaning = document.createElement('span');
      meaning.className = 'hanja-popup__meaning';
      meaning.style.color = '#444';
      meaning.style.flex = '1';
      meaning.textContent = cand.meaning || '';
      item.appendChild(meaning);

      const freq = document.createElement('span');
      freq.className = 'hanja-popup__freq';
      freq.style.color = '#aaa';
      freq.style.fontSize = '10px';
      freq.textContent = `★${cand.frequency ?? 0}`;
      item.appendChild(freq);

      if (idx === this.activeIndex) {
        item.classList.add(ITEM_ACTIVE);
        item.style.background = 'rgba(59,130,246,0.12)';
      }

      item.addEventListener('mouseenter', () => this._setActive(idx));
      // mousedown으로 outside-click보다 먼저 발화하여 hide()와의 경합 방지
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._setActive(idx);
        this.applyActive();
      });

      popup.appendChild(item);
    });
  }

  /**
   * 활성 인덱스 변경 + 시각 갱신.
   * @param {number} idx
   * @private
   */
  _setActive(idx) {
    if (!this.popup) return;
    const max = this.candidates.length - 1;
    if (max < 0) return;
    const next = Math.max(0, Math.min(max, idx));
    if (next === this.activeIndex) return;
    this.activeIndex = next;
    const items = this.popup.querySelectorAll(`.${ITEM_CLASS}`);
    items.forEach((el, i) => {
      const isActive = i === this.activeIndex + (this.popup?.querySelector('.hanja-popup__header') ? 1 : 1) - 1; // header offset
      // 실제 후보 항목은 header 다음부터이므로 data-index 기준으로 비교
      const dataIdx = el.getAttribute('data-index');
      if (dataIdx === null) return;
      const matched = Number(dataIdx) === this.activeIndex;
      el.classList.toggle(ITEM_ACTIVE, matched);
      /** @type {HTMLElement} */ (el).style.background = matched ? 'rgba(59,130,246,0.12)' : '';
      void isActive;
    });
  }

  /**
   * 화면 좌표에 팝업 위치 지정.
   * @param {PopupRect} rect
   * @private
   */
  _positionAt(rect) {
    if (!this.popup || !rect) return;
    const scrollX = typeof window !== 'undefined' ? window.scrollX || 0 : 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
    const left = Math.max(8, (rect.left ?? 0) + scrollX);
    // 선택 영역 아래쪽으로 배치 (bottom 이 없으면 top + 20px 으로 fallback)
    const top = (rect.bottom ?? (rect.top ?? 0) + 20) + scrollY + 4;
    this.popup.style.left = `${Math.round(left)}px`;
    this.popup.style.top = `${Math.round(top)}px`;
  }

  /**
   * 키보드 핸들러.
   * @param {KeyboardEvent} ev
   * @private
   */
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
    // 숫자 단축키 1-9
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

  /**
   * 외부 클릭 시 팝업 닫기.
   * @param {MouseEvent} ev
   * @private
   */
  _handleOutsideClick(ev) {
    if (!this.visible || !this.popup) return;
    if (ev.target instanceof Node && this.popup.contains(ev.target)) return;
    this.hide('cancel');
  }

  /**
   * 인스턴스 파괴 (테스트 cleanup용).
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
 * 간편 함수: 팝업 표시.
 * 내부에 모듈-스코프 싱글톤 인스턴스를 유지한다.
 *
 * @param {{ source:string, candidates:Array<HanjaCandidate>, rect:PopupRect, onSelect:HanjaSelectHandler }} options
 * @returns {HanjaPopup} 사용된 팝업 인스턴스
 */
let _singleton = null;
export function showHanjaPopup(options) {
  if (!_singleton) _singleton = new HanjaPopup();
  _singleton.show(options);
  return _singleton;
}

/**
 * 단축키 바인딩 유틸리티.
 *
 * @param {HTMLElement | Document} target - 키 이벤트를 받을 노드 (보통 document)
 * @param {() => void} handler - F9 / Ctrl+H 가 눌렸을 때 실행할 콜백
 * @returns {() => void} dispose 함수
 *
 * @example
 *   const off = bindHanjaShortcut(document, () => {
 *     // 현재 선택 영역을 분석해 showHanjaPopup({...}) 호출
 *   });
 */
export function bindHanjaShortcut(target, handler) {
  if (!target || typeof handler !== 'function') return () => {};
  const onKey = (/** @type {KeyboardEvent} */ ev) => {
    const isF9 = ev.key === 'F9';
    const isCtrlH = (ev.ctrlKey || ev.metaKey) && (ev.key === 'h' || ev.key === 'H');
    if (isF9 || isCtrlH) {
      ev.preventDefault();
      try {
        handler();
      } catch (err) {
        logger.error('[Hanja] shortcut handler error:', err);
      }
    }
  };
  /** @type {any} */ (target).addEventListener('keydown', onKey);
  return () => /** @type {any} */ (target).removeEventListener('keydown', onKey);
}

export default HanjaPopup;
