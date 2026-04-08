import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}));

import { AnnotationManager } from './annotation-manager.js';

function createMockViewer() {
  const container = document.createElement('div');
  // 페이지 구조 생성
  const page = document.createElement('div');
  page.className = 'hwp-page-container';
  const para = document.createElement('div');
  para.className = 'hwp-paragraph';
  page.appendChild(para);
  container.appendChild(page);

  return {
    container,
    autoSaveManager: { markDirty: vi.fn() },
  };
}

describe('AnnotationManager v2.0', () => {
  let mgr;
  let viewer;

  beforeEach(() => {
    viewer = createMockViewer();
    mgr = new AnnotationManager(viewer);
  });

  describe('addComment', () => {
    it('댓글 추가', () => {
      const comment = mgr.addComment(
        { sectionIndex: 0, elementIndex: 0 },
        '테스트 댓글',
        '홍길동'
      );
      expect(comment.id).toBeTruthy();
      expect(comment.text).toBe('테스트 댓글');
      expect(comment.author).toBe('홍길동');
      expect(comment.parentId).toBeNull();
      expect(comment.resolved).toBe(false);
    });

    it('빈 텍스트는 에러', () => {
      expect(() => mgr.addComment({}, '')).toThrow();
      expect(() => mgr.addComment({}, '  ')).toThrow();
    });
  });

  describe('addReply', () => {
    it('답글 추가', () => {
      const parent = mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '부모');
      const reply = mgr.addReply(parent.id, '답글', '김철수');
      expect(reply.parentId).toBe(parent.id);
      expect(reply.text).toBe('답글');
    });

    it('존재하지 않는 부모에 답글 시 에러', () => {
      expect(() => mgr.addReply('nonexistent', '답글')).toThrow();
    });
  });

  describe('deleteComment', () => {
    it('댓글 삭제 시 답글도 함께 삭제', () => {
      const parent = mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '부모');
      mgr.addReply(parent.id, '답글1');
      mgr.addReply(parent.id, '답글2');
      expect(mgr.getAllComments().length).toBe(3);

      mgr.deleteComment(parent.id);
      expect(mgr.getAllComments().length).toBe(0);
    });

    it('존재하지 않는 ID는 false 반환', () => {
      expect(mgr.deleteComment('nonexistent')).toBe(false);
    });
  });

  describe('resolve/unresolve', () => {
    it('댓글 해결', () => {
      const comment = mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '이슈');
      mgr.resolveComment(comment.id, '김철수');
      expect(mgr.getAllComments()[0].resolved).toBe(true);
      expect(mgr.getAllComments()[0].resolvedBy).toBe('김철수');
    });

    it('해결 취소', () => {
      const comment = mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '이슈');
      mgr.resolveComment(comment.id, '김철수');
      mgr.unresolveComment(comment.id);
      expect(mgr.getAllComments()[0].resolved).toBe(false);
      expect(mgr.getAllComments()[0].resolvedBy).toBeNull();
    });
  });

  describe('getThreads', () => {
    it('스레드 형태로 댓글 반환', () => {
      const p1 = mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '댓글1');
      const p2 = mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '댓글2');
      mgr.addReply(p1.id, '답글1-1');
      mgr.addReply(p1.id, '답글1-2');

      const threads = mgr.getThreads();
      expect(threads.length).toBe(2);
      expect(threads[0].replies.length).toBe(2);
      expect(threads[1].replies.length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('통계 반환', () => {
      const c1 = mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '댓글1');
      mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '댓글2');
      mgr.addReply(c1.id, '답글');
      mgr.resolveComment(c1.id);

      const stats = mgr.getStats();
      expect(stats.total).toBe(2);
      expect(stats.resolved).toBe(1);
      expect(stats.unresolved).toBe(1);
      expect(stats.replies).toBe(1);
    });
  });

  describe('export/import', () => {
    it('JSON 직렬화 왕복', () => {
      mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '댓글1', '작성자');
      mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '댓글2', '작성자');
      const json = mgr.exportComments();
      mgr.clear();
      expect(mgr.getAllComments().length).toBe(0);
      mgr.importComments(json);
      expect(mgr.getAllComments().length).toBe(2);
    });
  });

  describe('onChange 콜백', () => {
    it('댓글 추가 시 콜백 호출', () => {
      const cb = vi.fn();
      mgr.onChange(cb);
      mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '테스트');
      expect(cb).toHaveBeenCalledWith({ action: 'add', data: expect.objectContaining({ text: '테스트' }) });
    });

    it('autoSaveManager.markDirty 호출됨', () => {
      mgr.addComment({ sectionIndex: 0, elementIndex: 0 }, '테스트');
      expect(viewer.autoSaveManager.markDirty).toHaveBeenCalled();
    });
  });
});
