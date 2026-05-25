/**
 * CommentsPanel 테스트
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

import { CommentsManager } from '../features/comments-manager.js';
import { CommentsPanel } from './comments-panel.js';

describe('CommentsPanel', () => {
  let viewerRoot, container, mgr;
  beforeEach(() => {
    container = document.createElement('div');
    viewerRoot = document.createElement('div');
    container.appendChild(viewerRoot);
    document.body.appendChild(container);

    // 본문 마커 세 개 시드
    ['a', 'b', 'c'].forEach(id => {
      const m = document.createElement('span');
      m.className = 'hwp-memo-marker';
      m.setAttribute('data-memo-id', id);
      m.textContent = id;
      viewerRoot.appendChild(m);
    });

    mgr = new CommentsManager();
    mgr.loadFromSections([
      {
        memos: [
          { id: 'a', text: 'first', author: 'A' },
          { id: 'b', text: 'second' },
        ],
      },
    ]);
  });

  it('mount + render produces a bubble per memo', () => {
    const panel = new CommentsPanel({ manager: mgr, viewerRoot, container });
    panel.mount();
    panel.render();
    const bubbles = panel.root.querySelectorAll('.hwp-memo-bubble');
    expect(bubbles.length).toBe(2);
    expect(bubbles[0].getAttribute('data-memo-id')).toBe('a');
  });

  it('clicking a body marker activates the matching memo', () => {
    const panel = new CommentsPanel({ manager: mgr, viewerRoot, container });
    panel.mount();
    panel.render();

    const marker = viewerRoot.querySelector('.hwp-memo-marker[data-memo-id="b"]');
    marker.click();

    expect(mgr.activeId).toBe('b');
    panel.render();
    const active = panel.root.querySelector('.hwp-memo-bubble--active');
    expect(active).not.toBeNull();
    expect(active.getAttribute('data-memo-id')).toBe('b');

    panel.unmount();
    expect(panel.root).toBeNull();
  });
});
