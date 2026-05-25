/**
 * Autocomplete Controller
 * `<input>` / `<textarea>` / `contenteditable` 에 자동완성 동작을 부착한다.
 *
 * - `compositionstart/end` 로 한글 IME 처리 — 조합 중에는 후보 조회 보류
 * - 디바운스(기본 50ms) — 빠른 연타 시 마지막 입력만 조회
 * - 최소 prefix 길이(기본 2자) 미만이면 팝업 닫음
 * - Tab/Enter 적용, ESC 취소, ↑/↓ 이동 — Popup 자체가 처리
 * - 적용 시 caret 위치 직전의 prefix 를 후보 단어로 치환
 *
 * @module autocomplete/autocomplete-controller
 * @version 1.0.0
 */

import { AutocompletePopup } from './autocomplete-popup.js';
import { WordIndex } from './word-index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('AutocompleteController');

/**
 * @typedef {Object} ControllerOptions
 * @property {WordIndex}    [index]               외부에서 미리 빌드한 인덱스
 * @property {number}       [debounceMs=50]
 * @property {number}       [minPrefix=2]
 * @property {number}       [maxCandidates=10]
 * @property {boolean}      [hangulOnly=false]
 * @property {boolean}      [ignoreCase=false]
 * @property {AutocompletePopup} [popup]          테스트/공유용 popup 인스턴스
 * @property {(picked:string, prefix:string) => void} [onApply]  후보 적용 후 콜백
 */

const DEFAULTS = Object.freeze({
  debounceMs: 50,
  minPrefix: 2,
  maxCandidates: 10,
  hangulOnly: false,
  ignoreCase: false,
});

/**
 * 입력 요소(input/textarea/contenteditable)의 caret 직전 단어 경계 추출.
 *
 * 한글/영문/숫자 조합 토큰(공백·구두점이 아닌 \p{L}\p{N}_ 시퀀스)을 prefix 로 본다.
 *
 * @param {HTMLElement} el
 * @returns {{ prefix:string, range: { start:number, end:number } } | null}
 */
export function getCaretPrefix(el) {
  if (!el) return null;
  const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  if (isInput) {
    /** @type {HTMLInputElement | HTMLTextAreaElement} */
    const input = /** @type {any} */ (el);
    const caret = input.selectionStart ?? input.value.length;
    const text = input.value || '';
    const left = text.slice(0, caret);
    const m = left.match(/[\p{L}\p{N}_]+$/u);
    if (!m) return null;
    const prefix = m[0];
    return { prefix, range: { start: caret - prefix.length, end: caret } };
  }
  // contenteditable / 기타
  const text = el.textContent || '';
  // contenteditable 의 caret offset 은 selection API 로 정확히 구해야 하지만,
  // 테스트 친화성/단순성을 위해 전체 텍스트의 끝을 caret 으로 간주한다.
  const left = text;
  const m = left.match(/[\p{L}\p{N}_]+$/u);
  if (!m) return null;
  const prefix = m[0];
  const end = left.length;
  return { prefix, range: { start: end - prefix.length, end } };
}

/**
 * caret 위치의 화면 rect 추정 — input 류는 element rect 의 우하단을 사용.
 * @param {HTMLElement} el
 * @returns {{ left:number, top:number, bottom:number }}
 */
function getCaretRect(el) {
  try {
    if (typeof el.getBoundingClientRect === 'function') {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, bottom: r.bottom };
    }
  } catch (_e) {
    // ignore
  }
  return { left: 0, top: 0, bottom: 0 };
}

/**
 * Controller — 한 인스턴스로 한 element 를 관리한다.
 */
export class AutocompleteController {
  /**
   * @param {ControllerOptions} [options]
   */
  constructor(options = {}) {
    /** @type {WordIndex} */
    this.index = options.index || new WordIndex({
      hangulOnly: !!options.hangulOnly,
      ignoreCase: !!options.ignoreCase,
    });
    this.debounceMs = Number.isFinite(options.debounceMs) ? Math.max(0, options.debounceMs) : DEFAULTS.debounceMs;
    this.minPrefix = Number.isFinite(options.minPrefix) ? Math.max(1, Math.floor(options.minPrefix)) : DEFAULTS.minPrefix;
    this.maxCandidates = Number.isFinite(options.maxCandidates) ? Math.max(1, Math.floor(options.maxCandidates)) : DEFAULTS.maxCandidates;
    this.hangulOnly = !!options.hangulOnly;
    this.ignoreCase = !!options.ignoreCase;
    /** @type {(picked:string, prefix:string)=>void | undefined} */
    this.onApply = typeof options.onApply === 'function' ? options.onApply : undefined;

    /** @type {AutocompletePopup} */
    this.popup = options.popup || new AutocompletePopup();

    /** @type {HTMLElement | null} */
    this._el = null;
    /** @type {number | null} */
    this._debounceTimer = null;
    /** @type {boolean} */
    this._composing = false;
    /** @type {string} */
    this._lastPrefix = '';

    this._onInput = this._onInput.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onCompStart = this._onCompStart.bind(this);
    this._onCompEnd = this._onCompEnd.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  /**
   * 입력 요소에 자동완성 동작 부착.
   * @param {HTMLElement} el
   * @returns {() => void} detach 함수
   */
  attach(el) {
    if (!el) return () => {};
    if (this._el && this._el !== el) {
      this.detach();
    }
    this._el = el;
    el.addEventListener('input', this._onInput);
    el.addEventListener('keydown', this._onKeyDown);
    el.addEventListener('compositionstart', this._onCompStart);
    el.addEventListener('compositionend', this._onCompEnd);
    el.addEventListener('blur', this._onBlur);
    logger.debug(`[AC-Ctrl] attached to <${el.tagName.toLowerCase()}>`);
    return () => this.detach();
  }

  /**
   * 부착 해제.
   */
  detach() {
    const el = this._el;
    if (!el) return;
    el.removeEventListener('input', this._onInput);
    el.removeEventListener('keydown', this._onKeyDown);
    el.removeEventListener('compositionstart', this._onCompStart);
    el.removeEventListener('compositionend', this._onCompEnd);
    el.removeEventListener('blur', this._onBlur);
    this._el = null;
    this._clearTimer();
    try {
      this.popup.hide('cancel');
    } catch (_e) {
      // ignore
    }
  }

  /**
   * 외부에서 강제 후보 갱신 트리거.
   */
  refresh() {
    this._scheduleQuery();
  }

  /**
   * 외부 호출용 — 후보 적용 (popup 의 onSelect 흐름과 동일).
   * @param {string} word
   */
  applyWord(word) {
    if (typeof word !== 'string' || word.length === 0) return;
    const el = this._el;
    if (!el) return;
    const ctx = getCaretPrefix(el);
    if (!ctx) return;
    this._replacePrefix(el, ctx.range, word);
    this.index.incrementUsage(word);
    if (this.onApply) {
      try {
        this.onApply(word, ctx.prefix);
      } catch (err) {
        logger.warn('[AC-Ctrl] onApply threw:', err);
      }
    }
  }

  /* ─────────────────────────── 이벤트 핸들러 ─────────────────────────── */

  _onCompStart() {
    this._composing = true;
    this.popup.hide('cancel');
  }

  _onCompEnd() {
    this._composing = false;
    this._scheduleQuery();
  }

  _onInput() {
    if (this._composing) return;
    this._scheduleQuery();
  }

  _onKeyDown(ev) {
    // Popup 이 떠 있고 키가 ↑/↓/Enter/Tab/ESC 면 Popup 의 핸들러가 처리한다.
    // 여기서는 hide 만 트리거되는 경우(스페이스 등)에 prefix 가 깨질 때 닫아준다.
    if (!this.popup.visible) return;
    if (ev.key === ' ' || ev.key === 'Spacebar') {
      this.popup.hide('cancel');
    }
  }

  _onBlur() {
    // blur 즉시 닫음 — Popup mousedown 이벤트는 mousedown 단계에서 처리되므로 안전
    setTimeout(() => {
      if (!this._el || document.activeElement !== this._el) {
        try { this.popup.hide('cancel'); } catch (_e) { /* ignore */ }
      }
    }, 0);
  }

  /* ─────────────────────────── 내부 로직 ─────────────────────────── */

  _scheduleQuery() {
    this._clearTimer();
    if (this.debounceMs === 0) {
      this._runQuery();
      return;
    }
    this._debounceTimer = /** @type {any} */ (setTimeout(() => {
      this._debounceTimer = null;
      this._runQuery();
    }, this.debounceMs));
  }

  _clearTimer() {
    if (this._debounceTimer != null) {
      clearTimeout(/** @type {any} */ (this._debounceTimer));
      this._debounceTimer = null;
    }
  }

  _runQuery() {
    const el = this._el;
    if (!el) return;
    const ctx = getCaretPrefix(el);
    if (!ctx) {
      this.popup.hide('cancel');
      return;
    }
    let prefix = ctx.prefix;
    if (this.ignoreCase) prefix = prefix.toLowerCase();
    if (prefix.length < this.minPrefix) {
      this.popup.hide('cancel');
      return;
    }
    if (this.hangulOnly && !/^[가-힣ᄀ-ᇿ㄰-㆏]+$/.test(prefix)) {
      this.popup.hide('cancel');
      return;
    }
    const candidates = this.index.search(prefix, this.maxCandidates)
      // prefix 와 동일한 단어 자체는 제외 (이미 완성된 상태)
      .filter((c) => c.word !== prefix);

    this._lastPrefix = prefix;

    if (candidates.length === 0) {
      this.popup.hide('cancel');
      return;
    }

    const rect = getCaretRect(el);
    if (this.popup.visible) {
      this.popup.updateCandidates(candidates, prefix);
    } else {
      this.popup.show({
        prefix,
        candidates,
        rect,
        onSelect: (picked, reason) => this._onPopupSelect(picked, reason),
      });
    }
  }

  _onPopupSelect(picked, reason) {
    if (reason !== 'select' || !picked || !picked.word) return;
    const el = this._el;
    if (!el) return;
    const ctx = getCaretPrefix(el);
    if (!ctx) return;
    this._replacePrefix(el, ctx.range, picked.word);
    this.index.incrementUsage(picked.word);
    if (this.onApply) {
      try {
        this.onApply(picked.word, ctx.prefix);
      } catch (err) {
        logger.warn('[AC-Ctrl] onApply threw:', err);
      }
    }
  }

  /**
   * caret 직전 prefix 를 새 word 로 치환.
   * @param {HTMLElement} el
   * @param {{ start:number, end:number }} range
   * @param {string} word
   */
  _replacePrefix(el, range, word) {
    const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    if (isInput) {
      const input = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (/** @type {any} */ (el));
      const before = input.value.slice(0, range.start);
      const after = input.value.slice(range.end);
      input.value = before + word + after;
      const caret = (before + word).length;
      try {
        input.setSelectionRange(caret, caret);
      } catch (_e) {
        // jsdom 이 일부 input type 에서 throw 할 수 있음
      }
      // 외부 리스너에게 알림
      try {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (_e) {
        // ignore
      }
      return;
    }
    // contenteditable — 단순화: textContent 끝의 prefix 를 잘라내고 word 부착
    const text = el.textContent || '';
    if (range.end === text.length && text.endsWith(text.slice(range.start, range.end))) {
      el.textContent = text.slice(0, range.start) + word;
    } else {
      // 일반 케이스 — 안전하게 전체 textContent 치환
      const next = text.slice(0, range.start) + word + text.slice(range.end);
      el.textContent = next;
    }
  }
}

/**
 * 헬퍼 — 새 controller 만들고 즉시 attach.
 *
 * @param {HTMLElement} el
 * @param {ControllerOptions} [options]
 * @returns {AutocompleteController}
 */
export function attach(el, options) {
  const c = new AutocompleteController(options);
  c.attach(el);
  return c;
}

export default AutocompleteController;
