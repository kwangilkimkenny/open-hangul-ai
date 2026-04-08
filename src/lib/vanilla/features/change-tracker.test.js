import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}));

import { ChangeTracker } from './change-tracker.js';

function createMockViewer() {
  return {
    container: document.createElement('div'),
    historyManager: {
      execute: vi.fn((exec, undo, name, meta) => { exec(); }),
      undo: vi.fn(),
      redo: vi.fn(),
    },
    inlineEditor: { cellDataMap: new WeakMap() },
    autoSaveManager: { markDirty: vi.fn() },
  };
}

describe('ChangeTracker', () => {
  let tracker;
  let viewer;

  beforeEach(() => {
    viewer = createMockViewer();
    tracker = new ChangeTracker(viewer);
  });

  describe('enable/disable', () => {
    it('기본 상태는 비활성', () => {
      expect(tracker.isTracking).toBe(false);
    });

    it('enable()으로 추적 시작', () => {
      tracker.enable('홍길동');
      expect(tracker.isTracking).toBe(true);
      expect(tracker.author).toBe('홍길동');
    });

    it('disable()으로 추적 중지', () => {
      tracker.enable('홍길동');
      tracker.disable();
      expect(tracker.isTracking).toBe(false);
    });
  });

  describe('변경 기록', () => {
    it('추적 모드에서 execute 호출 시 변경이 기록됨', () => {
      tracker.enable('작성자');
      // 래핑된 execute 호출 (metadata 포함)
      viewer.historyManager.execute(
        () => {},
        () => {},
        '텍스트 편집',
        { oldText: '이전', newText: '이후', type: 'text_edit' }
      );

      const changes = tracker.getChanges();
      expect(changes.length).toBe(1);
      expect(changes[0].author).toBe('작성자');
      expect(changes[0].oldContent).toBe('이전');
      expect(changes[0].newContent).toBe('이후');
      expect(changes[0].status).toBe('pending');
    });

    it('추적 비활성 시 변경이 기록되지 않음', () => {
      viewer.historyManager.execute(
        () => {},
        () => {},
        '편집',
        { oldText: 'a', newText: 'b' }
      );
      expect(tracker.getChanges().length).toBe(0);
    });

    it('metadata 없이 호출하면 추적 모드여도 기록 안 됨', () => {
      tracker.enable('작성자');
      viewer.historyManager.execute(() => {}, () => {}, '편집');
      expect(tracker.getChanges().length).toBe(0);
    });
  });

  describe('accept/reject', () => {
    beforeEach(() => {
      tracker.enable('작성자');
      viewer.historyManager.execute(
        () => {},
        () => {},
        '편집',
        { oldText: '이전', newText: '이후' }
      );
    });

    it('acceptChange로 변경 수락', () => {
      const id = tracker.getChanges()[0].id;
      const result = tracker.acceptChange(id);
      expect(result).toBe(true);
      expect(tracker.getChanges()[0].status).toBe('accepted');
    });

    it('rejectChange로 변경 거부', () => {
      const id = tracker.getChanges()[0].id;
      const result = tracker.rejectChange(id);
      expect(result).toBe(true);
      expect(tracker.getChanges()[0].status).toBe('rejected');
    });

    it('존재하지 않는 ID는 false 반환', () => {
      expect(tracker.acceptChange('nonexistent')).toBe(false);
      expect(tracker.rejectChange('nonexistent')).toBe(false);
    });
  });

  describe('acceptAll/rejectAll', () => {
    it('모든 pending 변경을 수락', () => {
      tracker.enable('작성자');
      for (let i = 0; i < 3; i++) {
        viewer.historyManager.execute(() => {}, () => {}, '편집', { oldText: `이전${i}`, newText: `이후${i}` });
      }
      const count = tracker.acceptAll();
      expect(count).toBe(3);
      expect(tracker.getPendingCount()).toBe(0);
    });
  });

  describe('onChange 콜백', () => {
    it('변경 기록 시 콜백 호출됨', () => {
      const callback = vi.fn();
      tracker.onChange(callback);
      tracker.enable('작성자');
      viewer.historyManager.execute(() => {}, () => {}, '편집', { oldText: 'a', newText: 'b' });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('export/import', () => {
    it('변경 내역을 JSON으로 내보내고 가져올 수 있음', () => {
      tracker.enable('작성자');
      viewer.historyManager.execute(() => {}, () => {}, '편집', { oldText: 'a', newText: 'b' });
      const json = tracker.exportChanges();
      tracker.clear();
      expect(tracker.getChanges().length).toBe(0);
      tracker.importChanges(json);
      expect(tracker.getChanges().length).toBe(1);
    });
  });

  describe('clear', () => {
    it('모든 변경 내역 초기화', () => {
      tracker.enable('작성자');
      viewer.historyManager.execute(() => {}, () => {}, '편집', { oldText: 'a', newText: 'b' });
      tracker.clear();
      expect(tracker.getChanges().length).toBe(0);
    });
  });
});
