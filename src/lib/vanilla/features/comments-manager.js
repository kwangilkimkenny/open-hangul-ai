/**
 * Comments Manager (Memo)
 * HWPX 메모/주석(<hp:memo>) UI 상태 관리자
 *
 * 책임:
 * - 파싱된 section.memos[] 와 본문 마커(.hwp-memo-marker)를 결합
 * - 활성 메모 추적 + 변경 리스너 알림
 * - 메모 추가/수정/삭제/해결(resolve) — 마킹 콜백으로 dirty 처리
 *
 * 본 모듈은 순수 모델/상태 계층이다. DOM 렌더링은 ui/comments-panel.js 가 담당한다.
 *
 * @module features/comments-manager
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 단일 메모 객체 형식
 * @typedef {Object} Memo
 * @property {string} id          메모 식별자
 * @property {string} [author]    작성자
 * @property {string} [createdAt] ISO 날짜
 * @property {string} text        본문
 * @property {string} [anchorId]  본문 내 마커 ID (= run.memoId)
 * @property {boolean} [resolved] 해결됨 여부
 */

export class CommentsManager {
  /**
   * @param {Object} [options]
   * @param {Function} [options.onChange]    변경 콜백(memos[])
   * @param {Function} [options.onDirty]     문서 dirty 표시 콜백
   */
  constructor(options = {}) {
    this.options = options;
    /** @type {Map<string, Memo>} */
    this.memos = new Map();
    /** @type {string|null} */
    this.activeId = null;
    /** @type {Set<Function>} */
    this.listeners = new Set();
  }

  // ────────────────────────────────────────────────────────────
  //  Load from parsed document
  // ────────────────────────────────────────────────────────────

  /**
   * parsed document.sections[i].memos[] 를 평탄화하여 로드한다.
   * @param {Array<{memos?: Memo[]}>} sections
   */
  loadFromSections(sections) {
    this.memos.clear();
    if (!Array.isArray(sections)) return;
    for (const sec of sections) {
      if (!sec || !Array.isArray(sec.memos)) continue;
      for (const memo of sec.memos) {
        if (!memo || !memo.id) continue;
        this.memos.set(String(memo.id), { ...memo });
      }
    }
    this._emit();
  }

  // ────────────────────────────────────────────────────────────
  //  CRUD
  // ────────────────────────────────────────────────────────────

  addMemo(memo) {
    if (!memo || !memo.id) {
      throw new Error('CommentsManager.addMemo: memo.id required');
    }
    const stored = {
      createdAt: new Date().toISOString(),
      resolved: false,
      text: '',
      ...memo,
      id: String(memo.id),
    };
    this.memos.set(stored.id, stored);
    this._markDirty();
    this._emit();
    return stored;
  }

  updateMemo(id, patch) {
    const key = String(id);
    const existing = this.memos.get(key);
    if (!existing) return null;
    const merged = { ...existing, ...patch, id: key };
    this.memos.set(key, merged);
    this._markDirty();
    this._emit();
    return merged;
  }

  deleteMemo(id) {
    const key = String(id);
    const removed = this.memos.delete(key);
    if (removed) {
      if (this.activeId === key) this.activeId = null;
      this._markDirty();
      this._emit();
    }
    return removed;
  }

  resolveMemo(id, resolved = true) {
    return this.updateMemo(id, { resolved: !!resolved });
  }

  // ────────────────────────────────────────────────────────────
  //  Active memo
  // ────────────────────────────────────────────────────────────

  setActive(id) {
    const key = id === null || id === undefined ? null : String(id);
    if (key !== null && !this.memos.has(key)) {
      logger.warn(`CommentsManager.setActive: unknown memo id ${key}`);
      return;
    }
    this.activeId = key;
    this._emit();
  }

  getActive() {
    return this.activeId ? this.memos.get(this.activeId) || null : null;
  }

  // ────────────────────────────────────────────────────────────
  //  Queries
  // ────────────────────────────────────────────────────────────

  getAll() {
    return Array.from(this.memos.values());
  }

  getById(id) {
    if (id === null || id === undefined) return null;
    return this.memos.get(String(id)) || null;
  }

  size() {
    return this.memos.size;
  }

  // ────────────────────────────────────────────────────────────
  //  Subscriptions
  // ────────────────────────────────────────────────────────────

  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    const snapshot = this.getAll();
    for (const fn of this.listeners) {
      try {
        fn(snapshot, this.activeId);
      } catch (err) {
        logger.error('CommentsManager listener error', err);
      }
    }
  }

  _markDirty() {
    if (typeof this.options.onDirty === 'function') {
      try {
        this.options.onDirty();
      } catch (err) {
        logger.error('CommentsManager onDirty error', err);
      }
    }
  }

  /**
   * 본문 마커 DOM 요소를 메모 ID 로 검색한다.
   * @param {HTMLElement} root
   * @param {string} memoId
   * @returns {HTMLElement|null}
   */
  static findMarker(root, memoId) {
    if (!root || !memoId) return null;
    return root.querySelector(`.hwp-memo-marker[data-memo-id="${CSS.escape(String(memoId))}"]`);
  }

  /**
   * 본문 마커로 스크롤 + 강조 클래스 토글.
   * @param {HTMLElement} root
   * @param {string} memoId
   */
  static scrollIntoView(root, memoId) {
    const marker = CommentsManager.findMarker(root, memoId);
    if (!marker) return false;
    if (typeof marker.scrollIntoView === 'function') {
      marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    marker.classList.add('hwp-memo-marker--active');
    return true;
  }
}

export default CommentsManager;
