/**
 * Comments Panel — 본문 우측 마진에 메모 풍선을 absolute positioning 으로 띄운다.
 *
 * 사용 예:
 *   const panel = new CommentsPanel({ manager, viewerRoot, container });
 *   panel.mount();
 *   panel.render();
 *
 * @module ui/comments-panel
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class CommentsPanel {
  /**
   * @param {Object} opts
   * @param {import('../features/comments-manager.js').CommentsManager} opts.manager
   * @param {HTMLElement} opts.viewerRoot  본문 컨테이너 (마커 검색 기준)
   * @param {HTMLElement} [opts.container] 풍선을 띄울 컨테이너 (기본: viewerRoot.parentElement)
   */
  constructor({ manager, viewerRoot, container } = {}) {
    if (!manager) throw new Error('CommentsPanel: manager required');
    if (!viewerRoot) throw new Error('CommentsPanel: viewerRoot required');
    this.manager = manager;
    this.viewerRoot = viewerRoot;
    this.container = container || viewerRoot.parentElement || viewerRoot;
    this.root = null;
    this.unsubscribe = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('aside');
    root.className = 'hwp-comments-panel';
    root.setAttribute('role', 'complementary');
    root.setAttribute('aria-label', '메모');
    // 우측 마진에 absolute 로 띄움 — viewerRoot 의 부모에 position:relative 보장
    if (this.container && this.container !== document.body) {
      const cs = this.container.style;
      if (!cs.position) cs.position = 'relative';
    }
    root.style.position = 'absolute';
    root.style.top = '0';
    root.style.right = '0';
    root.style.width = '240px';
    root.style.pointerEvents = 'none'; // 풍선 단위로 켬

    this.container.appendChild(root);
    this.root = root;

    // 매니저 변경 구독 → 자동 재렌더
    this.unsubscribe = this.manager.subscribe(() => this.render());

    // 본문 마커 클릭 → 활성 메모 토글
    this._onViewerClick = ev => {
      const marker = ev.target.closest?.('.hwp-memo-marker');
      if (!marker) return;
      const id = marker.getAttribute('data-memo-id');
      if (id) {
        this.manager.setActive(id);
      }
    };
    this.viewerRoot.addEventListener('click', this._onViewerClick);

    return root;
  }

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this._onViewerClick) {
      this.viewerRoot.removeEventListener('click', this._onViewerClick);
      this._onViewerClick = null;
    }
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
    this.root = null;
  }

  /**
   * 풍선들을 다시 그린다.
   */
  render() {
    if (!this.root) return;
    // 이전 강조 제거
    const oldActives = this.viewerRoot.querySelectorAll('.hwp-memo-marker--active');
    oldActives.forEach(el => el.classList.remove('hwp-memo-marker--active'));

    this.root.innerHTML = '';
    const memos = this.manager.getAll();
    const activeId = this.manager.activeId;

    for (const memo of memos) {
      const bubble = this._renderBubble(memo, memo.id === activeId);
      if (bubble) this.root.appendChild(bubble);
    }

    // 활성 메모는 본문 마커 강조
    if (activeId) {
      const marker = this.viewerRoot.querySelector(
        `.hwp-memo-marker[data-memo-id="${CSS.escape(activeId)}"]`
      );
      if (marker) {
        marker.classList.add('hwp-memo-marker--active');
      }
    }
  }

  _renderBubble(memo, isActive) {
    const bubble = document.createElement('div');
    bubble.className = 'hwp-memo-bubble' + (isActive ? ' hwp-memo-bubble--active' : '');
    bubble.setAttribute('data-memo-id', memo.id);
    bubble.style.position = 'absolute';
    bubble.style.pointerEvents = 'auto';
    bubble.style.right = '0';
    bubble.style.width = '220px';
    bubble.style.padding = '8px 10px';
    bubble.style.marginBottom = '6px';
    bubble.style.background = isActive ? '#fff9c4' : '#fffde7';
    bubble.style.border = '1px solid #f0e68c';
    bubble.style.borderRadius = '6px';
    bubble.style.boxShadow = isActive ? '0 2px 6px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.08)';
    bubble.style.fontSize = '12px';
    bubble.style.cursor = 'pointer';

    // 본문 마커의 top 좌표를 풍선의 top 으로 — 시각적으로 같은 라인
    const marker = this.viewerRoot.querySelector(
      `.hwp-memo-marker[data-memo-id="${CSS.escape(memo.id)}"]`
    );
    if (marker && marker.getBoundingClientRect && this.container.getBoundingClientRect) {
      try {
        const mRect = marker.getBoundingClientRect();
        const cRect = this.container.getBoundingClientRect();
        bubble.style.top = `${Math.max(0, mRect.top - cRect.top)}px`;
      } catch (err) {
        logger.debug('CommentsPanel: getBoundingClientRect failed', err);
      }
    }

    const header = document.createElement('div');
    header.className = 'hwp-memo-bubble__header';
    header.style.fontWeight = '600';
    header.style.marginBottom = '4px';
    header.textContent = memo.author || '메모';
    bubble.appendChild(header);

    const body = document.createElement('div');
    body.className = 'hwp-memo-bubble__body';
    body.textContent = memo.text || '';
    bubble.appendChild(body);

    if (memo.resolved) {
      bubble.style.opacity = '0.55';
      const tag = document.createElement('span');
      tag.textContent = '해결됨';
      tag.style.fontSize = '10px';
      tag.style.color = '#666';
      tag.style.marginLeft = '6px';
      header.appendChild(tag);
    }

    bubble.addEventListener('click', () => {
      this.manager.setActive(memo.id);
      const marker = this.viewerRoot.querySelector(
        `.hwp-memo-marker[data-memo-id="${CSS.escape(memo.id)}"]`
      );
      if (marker && typeof marker.scrollIntoView === 'function') {
        marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    return bubble;
  }
}

export default CommentsPanel;
