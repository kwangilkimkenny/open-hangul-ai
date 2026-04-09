/**
 * Change Tracker
 * 문서 변경 추적 시스템 (Track Changes)
 *
 * @module features/change-tracker
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

let changeIdCounter = 0;
function generateChangeId() {
  return `tc-${Date.now()}-${++changeIdCounter}`;
}

/**
 * 변경 추적 관리자
 * HistoryManagerV2를 프록시 래핑하여 변경 메타데이터를 캡처
 */
export class ChangeTracker {
  /**
   * @param {Object} viewer - HWPX Viewer 인스턴스
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.changes = [];
    this.isTracking = false;
    this.author = '사용자';
    this.maxChanges = 500;
    this.onChangeCallback = null;

    // HistoryManagerV2의 execute를 프록시 래핑
    this._wrapHistoryManager();

    logger.info('ChangeTracker initialized');
  }

  /**
   * HistoryManager.execute()를 래핑하여 변경 메타데이터 캡처
   */
  _wrapHistoryManager() {
    const hm = this.viewer.historyManager;
    if (!hm) {
      logger.warn('HistoryManager not found, ChangeTracker disabled');
      return;
    }

    const originalExecute = hm.execute.bind(hm);
    const tracker = this;

    hm.execute = function (executeFn, undoFn, actionName = 'Edit', metadata = null) {
      // 추적 모드일 때만 변경 기록
      if (tracker.isTracking && metadata) {
        tracker._recordChange(actionName, metadata);
      }
      // 원래 execute 호출
      originalExecute(executeFn, undoFn, actionName, metadata);
    };
  }

  /**
   * 추적 모드 활성화
   * @param {string} author - 작성자 이름
   */
  enable(author = '사용자') {
    this.isTracking = true;
    this.author = author;
    logger.info(`ChangeTracker enabled (author: ${author})`);
  }

  /**
   * 추적 모드 비활성화
   */
  disable() {
    this.isTracking = false;
    logger.info('ChangeTracker disabled');
  }

  /**
   * 변경 기록
   */
  _recordChange(actionName, metadata) {
    const change = {
      id: generateChangeId(),
      type: this._inferChangeType(metadata),
      author: this.author,
      timestamp: Date.now(),
      actionName,
      oldContent: metadata.oldText || null,
      newContent: metadata.newText || null,
      metadata,
      status: 'pending', // pending | accepted | rejected
    };

    this.changes.push(change);

    // 최대 변경 수 제한
    if (this.changes.length > this.maxChanges) {
      this.changes.shift();
    }

    logger.debug(`Change recorded: ${change.type} by ${change.author}`);

    if (this.onChangeCallback) {
      this.onChangeCallback(change);
    }

    // DOM에 변경 표시 마크업 적용
    this._applyChangeMarking(change);

    return change;
  }

  /**
   * 변경 타입 추론
   */
  _inferChangeType(metadata) {
    if (!metadata) return 'modify';
    const { oldText, newText } = metadata;
    if (!oldText && newText) return 'insert';
    if (oldText && !newText) return 'delete';
    if (oldText && newText && oldText !== newText) return 'modify';
    return 'modify';
  }

  /**
   * 변경 수락
   */
  acceptChange(changeId) {
    const idx = this.changes.findIndex(c => c.id === changeId);
    if (idx === -1) return false;

    const change = this.changes[idx];
    change.status = 'accepted';

    // DOM 마크업 제거
    this._removeChangeMarking(changeId);

    logger.info(`Change accepted: ${changeId}`);
    if (this.onChangeCallback) this.onChangeCallback(change);
    return true;
  }

  /**
   * 변경 거부
   */
  rejectChange(changeId) {
    const idx = this.changes.findIndex(c => c.id === changeId);
    if (idx === -1) return false;

    const change = this.changes[idx];

    // 원래 내용으로 복원
    if (change.metadata?.cellData && change.oldContent !== null) {
      const cellData = change.metadata.cellData;
      if (cellData.elements) {
        for (const el of cellData.elements) {
          if (el.type === 'paragraph' && el.runs) {
            el.runs = [{ text: change.oldContent }];
          }
        }
      }
    }

    change.status = 'rejected';
    this._removeChangeMarking(changeId);

    logger.info(`Change rejected: ${changeId}`);
    if (this.onChangeCallback) this.onChangeCallback(change);
    return true;
  }

  /**
   * 모든 변경 수락
   */
  acceptAll() {
    const pending = this.changes.filter(c => c.status === 'pending');
    pending.forEach(c => this.acceptChange(c.id));
    logger.info(`All ${pending.length} changes accepted`);
    return pending.length;
  }

  /**
   * 모든 변경 거부
   */
  rejectAll() {
    const pending = this.changes.filter(c => c.status === 'pending');
    // 역순으로 거부 (최근 변경부터)
    [...pending].reverse().forEach(c => this.rejectChange(c.id));
    logger.info(`All ${pending.length} changes rejected`);
    return pending.length;
  }

  /**
   * DOM에 변경 표시 마크업 적용
   */
  _applyChangeMarking(change) {
    if (!this.viewer.container) return;

    // 셀 데이터에서 해당 DOM 요소 찾기
    const cellData = change.metadata?.cellData;
    if (!cellData) return;

    // 방법 1: cellDataMap (WeakMap)을 통해 DOM 요소 접근
    const editor = this.viewer.inlineEditor;
    let cellEl = editor?.cellDataMap?.get(cellData) || null;

    // 방법 2: WeakMap 실패 시 현재 편집 중인 셀로 폴백
    if (!cellEl && editor?.editingCell) {
      cellEl = editor.editingCell;
    }

    // 방법 3: 마지막으로 포커스된 editable 요소로 폴백
    if (!cellEl) {
      const active = document.activeElement;
      if (active?.closest?.('[contenteditable="true"]')) {
        cellEl = active.closest('.hwp-paragraph, td, th');
      }
    }

    if (!cellEl) return;

    // 변경 타입에 따른 CSS 클래스 적용
    const classMap = {
      insert: 'tc-insert',
      delete: 'tc-delete',
      modify: 'tc-modify',
    };

    const cls = classMap[change.type] || 'tc-modify';
    cellEl.classList.add(cls);
    cellEl.setAttribute('data-tc-id', change.id);
    cellEl.setAttribute('data-tc-author', change.author);
    cellEl.setAttribute('title', `${change.author} — ${new Date(change.timestamp).toLocaleString('ko-KR')}`);
  }

  /**
   * DOM에서 변경 표시 마크업 제거
   */
  _removeChangeMarking(changeId) {
    if (!this.viewer.container) return;
    const marked = this.viewer.container.querySelector(`[data-tc-id="${changeId}"]`);
    if (marked) {
      marked.classList.remove('tc-insert', 'tc-delete', 'tc-modify');
      marked.removeAttribute('data-tc-id');
      marked.removeAttribute('data-tc-author');
      marked.removeAttribute('title');
    }
  }

  /**
   * 변경 목록 조회
   */
  getChanges(statusFilter = null) {
    if (statusFilter) {
      return this.changes.filter(c => c.status === statusFilter);
    }
    return [...this.changes];
  }

  /**
   * 대기 중인 변경 수
   */
  getPendingCount() {
    return this.changes.filter(c => c.status === 'pending').length;
  }

  /**
   * 변경 콜백 등록
   */
  onChange(callback) {
    this.onChangeCallback = callback;
  }

  /**
   * 변경 내역 내보내기
   */
  exportChanges() {
    return JSON.stringify(this.changes.map(c => ({
      ...c,
      metadata: { oldText: c.metadata?.oldText, newText: c.metadata?.newText },
    })));
  }

  /**
   * 변경 내역 가져오기
   */
  importChanges(json) {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        this.changes = imported;
        logger.info(`Imported ${imported.length} changes`);
      }
    } catch (err) {
      logger.error('Failed to import changes:', err);
    }
  }

  /**
   * 초기화
   */
  clear() {
    // DOM 마크업 모두 제거
    this.changes.forEach(c => this._removeChangeMarking(c.id));
    this.changes = [];
    logger.info('ChangeTracker cleared');
  }
}
