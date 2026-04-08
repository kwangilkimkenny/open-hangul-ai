/**
 * Annotation Manager v2.0
 * 문서 댓글/리뷰 시스템
 *
 * @module features/annotation-manager
 * @version 2.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

let commentIdCounter = 0;
function generateCommentId() {
  return `comment-${Date.now()}-${++commentIdCounter}`;
}

/**
 * 댓글 관리자
 * 문서 모델 앵커 기반 댓글 시스템 (스레딩, resolve/unresolve)
 */
export class AnnotationManager {
  /**
   * @param {Object} viewer - HWPX Viewer 인스턴스
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.comments = [];
    this.onChangeCallback = null;

    logger.info('AnnotationManager v2.0 initialized');
  }

  /**
   * 댓글 추가
   * @param {Object} anchor - 문서 위치 앵커
   * @param {string} text - 댓글 텍스트
   * @param {string} author - 작성자
   * @returns {Object} 생성된 댓글
   */
  addComment(anchor, text, author = '사용자') {
    if (!text?.trim()) throw new Error('댓글 텍스트가 필요합니다');

    const comment = {
      id: generateCommentId(),
      author,
      timestamp: Date.now(),
      text: text.trim(),
      anchor: anchor ? { ...anchor } : null,
      parentId: null,
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
    };

    this.comments.push(comment);
    this._applyHighlight(comment);
    this._notifyChange('add', comment);

    logger.info(`Comment added: ${comment.id} by ${author}`);
    return comment;
  }

  /**
   * 답글 추가
   * @param {string} parentId - 부모 댓글 ID
   * @param {string} text - 답글 텍스트
   * @param {string} author - 작성자
   * @returns {Object} 생성된 답글
   */
  addReply(parentId, text, author = '사용자') {
    const parent = this.comments.find(c => c.id === parentId);
    if (!parent) throw new Error(`부모 댓글을 찾을 수 없습니다: ${parentId}`);
    if (!text?.trim()) throw new Error('답글 텍스트가 필요합니다');

    const reply = {
      id: generateCommentId(),
      author,
      timestamp: Date.now(),
      text: text.trim(),
      anchor: parent.anchor ? { ...parent.anchor } : null,
      parentId,
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
    };

    this.comments.push(reply);
    this._notifyChange('reply', reply);

    logger.info(`Reply added: ${reply.id} to ${parentId}`);
    return reply;
  }

  /**
   * 댓글 수정
   */
  updateComment(commentId, newText) {
    const comment = this.comments.find(c => c.id === commentId);
    if (!comment) return null;

    comment.text = newText.trim();
    comment.editedAt = Date.now();
    this._notifyChange('update', comment);
    return comment;
  }

  /**
   * 댓글 삭제 (답글도 함께 삭제)
   */
  deleteComment(commentId) {
    const idx = this.comments.findIndex(c => c.id === commentId);
    if (idx === -1) return false;

    // 답글도 삭제
    const replyIds = this.comments
      .filter(c => c.parentId === commentId)
      .map(c => c.id);

    this._removeHighlight(commentId);
    this.comments = this.comments.filter(
      c => c.id !== commentId && c.parentId !== commentId
    );

    this._notifyChange('delete', { id: commentId, replyIds });
    logger.info(`Comment deleted: ${commentId} (+${replyIds.length} replies)`);
    return true;
  }

  /**
   * 댓글 해결
   */
  resolveComment(commentId, author = '사용자') {
    const comment = this.comments.find(c => c.id === commentId && !c.parentId);
    if (!comment) return false;

    comment.resolved = true;
    comment.resolvedBy = author;
    comment.resolvedAt = Date.now();
    this._updateHighlight(commentId, true);
    this._notifyChange('resolve', comment);

    logger.info(`Comment resolved: ${commentId} by ${author}`);
    return true;
  }

  /**
   * 댓글 해결 취소
   */
  unresolveComment(commentId) {
    const comment = this.comments.find(c => c.id === commentId && !c.parentId);
    if (!comment) return false;

    comment.resolved = false;
    comment.resolvedBy = null;
    comment.resolvedAt = null;
    this._updateHighlight(commentId, false);
    this._notifyChange('unresolve', comment);

    logger.info(`Comment unresolved: ${commentId}`);
    return true;
  }

  /**
   * 특정 요소의 댓글 조회
   */
  getCommentsByElement(sectionIndex, elementIndex) {
    return this.comments.filter(c =>
      c.anchor &&
      c.anchor.sectionIndex === sectionIndex &&
      c.anchor.elementIndex === elementIndex &&
      !c.parentId
    );
  }

  /**
   * 스레드 형태로 모든 댓글 조회 (부모 + 답글 그룹핑)
   */
  getThreads() {
    const topLevel = this.comments.filter(c => !c.parentId);
    return topLevel.map(parent => ({
      ...parent,
      replies: this.comments
        .filter(c => c.parentId === parent.id)
        .sort((a, b) => a.timestamp - b.timestamp),
    }));
  }

  /**
   * 모든 댓글 조회
   */
  getAllComments() {
    return [...this.comments];
  }

  /**
   * 해결된/미해결 댓글 필터
   */
  getByStatus(resolved) {
    return this.comments.filter(c => !c.parentId && c.resolved === resolved);
  }

  /**
   * 댓글 수 통계
   */
  getStats() {
    const topLevel = this.comments.filter(c => !c.parentId);
    return {
      total: topLevel.length,
      resolved: topLevel.filter(c => c.resolved).length,
      unresolved: topLevel.filter(c => !c.resolved).length,
      replies: this.comments.filter(c => c.parentId).length,
    };
  }

  /**
   * DOM 하이라이트 적용
   */
  _applyHighlight(comment) {
    if (!comment.anchor || !this.viewer.container) return;
    const { sectionIndex, elementIndex } = comment.anchor;
    const pages = this.viewer.container.querySelectorAll('.hwp-page-container, .hwp-page');
    if (!pages[sectionIndex]) return;

    const elements = pages[sectionIndex].querySelectorAll('.hwp-paragraph, .hwp-table');
    const el = elements[elementIndex];
    if (el) {
      el.classList.add('comment-highlight');
      el.setAttribute('data-comment-id', comment.id);
    }
  }

  /**
   * DOM 하이라이트 제거
   */
  _removeHighlight(commentId) {
    if (!this.viewer.container) return;
    const el = this.viewer.container.querySelector(`[data-comment-id="${commentId}"]`);
    if (el) {
      el.classList.remove('comment-highlight', 'comment-resolved');
      el.removeAttribute('data-comment-id');
    }
  }

  /**
   * DOM 하이라이트 상태 업데이트
   */
  _updateHighlight(commentId, resolved) {
    if (!this.viewer.container) return;
    const el = this.viewer.container.querySelector(`[data-comment-id="${commentId}"]`);
    if (el) {
      if (resolved) {
        el.classList.add('comment-resolved');
      } else {
        el.classList.remove('comment-resolved');
      }
    }
  }

  /**
   * 변경 콜백
   */
  onChange(callback) {
    this.onChangeCallback = callback;
  }

  _notifyChange(action, data) {
    if (this.onChangeCallback) {
      this.onChangeCallback({ action, data });
    }
    // 자동저장 트리거
    if (this.viewer.autoSaveManager) {
      this.viewer.autoSaveManager.markDirty();
    }
  }

  /**
   * 내보내기 (JSON)
   */
  exportComments() {
    return JSON.stringify(this.comments);
  }

  /**
   * 가져오기 (JSON)
   */
  importComments(json) {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        this.comments = imported;
        // 하이라이트 다시 적용
        this.comments.filter(c => !c.parentId).forEach(c => this._applyHighlight(c));
        logger.info(`Imported ${imported.length} comments`);
      }
    } catch (err) {
      logger.error('Failed to import comments:', err);
    }
  }

  /**
   * 초기화
   */
  clear() {
    this.comments.forEach(c => this._removeHighlight(c.id));
    this.comments = [];
    this._notifyChange('clear', null);
  }
}
