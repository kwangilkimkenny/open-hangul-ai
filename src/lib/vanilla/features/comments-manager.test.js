/**
 * CommentsManager 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { CommentsManager } from './comments-manager.js';

describe('CommentsManager', () => {
  let mgr;
  let onDirty;
  beforeEach(() => {
    onDirty = vi.fn();
    mgr = new CommentsManager({ onDirty });
  });

  it('loads memos from parsed sections', () => {
    const sections = [
      { memos: [{ id: 'm1', text: 'first', author: 'Alice' }] },
      { memos: [{ id: 'm2', text: 'second' }] },
      {
        /* no memos */
      },
    ];
    mgr.loadFromSections(sections);
    expect(mgr.size()).toBe(2);
    expect(mgr.getById('m1').text).toBe('first');
    expect(mgr.getById('m2').author).toBeUndefined();
  });

  it('add / update / delete / resolve memo + dirty callback', () => {
    const m = mgr.addMemo({ id: 'a', text: 'hi' });
    expect(m.id).toBe('a');
    expect(m.resolved).toBe(false);
    expect(onDirty).toHaveBeenCalledTimes(1);

    mgr.updateMemo('a', { text: 'bye' });
    expect(mgr.getById('a').text).toBe('bye');

    mgr.resolveMemo('a');
    expect(mgr.getById('a').resolved).toBe(true);

    mgr.deleteMemo('a');
    expect(mgr.getById('a')).toBeNull();
    expect(mgr.size()).toBe(0);
  });

  it('setActive + subscribe emits snapshot', () => {
    mgr.addMemo({ id: 'x', text: 't' });
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    mgr.setActive('x');
    expect(listener).toHaveBeenCalled();
    const last = listener.mock.calls.at(-1);
    expect(Array.isArray(last[0])).toBe(true);
    expect(last[1]).toBe('x');
    unsub();
    mgr.setActive(null);
    // 구독 해제 후엔 콜백 횟수가 더 늘지 않음
    const cntAfterUnsub = listener.mock.calls.length;
    mgr.addMemo({ id: 'y', text: 'q' });
    expect(listener.mock.calls.length).toBe(cntAfterUnsub);
  });

  it('CommentsManager.findMarker queries DOM by data-memo-id', () => {
    const root = document.createElement('div');
    const marker = document.createElement('span');
    marker.className = 'hwp-memo-marker';
    marker.setAttribute('data-memo-id', 'mm1');
    root.appendChild(marker);

    const found = CommentsManager.findMarker(root, 'mm1');
    expect(found).toBe(marker);
    expect(CommentsManager.findMarker(root, 'nope')).toBeNull();
  });
});
