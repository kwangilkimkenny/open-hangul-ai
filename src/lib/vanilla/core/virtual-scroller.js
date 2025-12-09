/**
 * Virtual Scroller
 * 대용량 문서를 위한 가상 스크롤링 구현
 * 보이는 영역만 렌더링하여 성능 향상
 * 
 * @module core/virtual-scroller
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Virtual Scroller 클래스
 * Intersection Observer를 사용하여 뷰포트 내 요소만 렌더링
 */
export class VirtualScroller {
    /**
     * @param {Object} options - 옵션
     * @param {HTMLElement} options.container - 스크롤 컨테이너
     * @param {number} [options.bufferSize=3] - 버퍼 크기 (화면 밖 유지할 항목 수)
     * @param {number} [options.rootMargin='500px'] - Intersection Observer root margin
     * @param {Function} [options.renderItem] - 항목 렌더링 함수
     */
    constructor(options) {
        this.container = options.container;
        this.bufferSize = options.bufferSize || 3;
        this.rootMargin = options.rootMargin || '500px';
        this.renderItem = options.renderItem || this.defaultRenderItem;

        // State
        this.items = [];
        this.renderedItems = new Map(); // index -> element
        this.observers = new Map(); // element -> observer

        // Intersection Observer
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                root: null, // viewport
                rootMargin: this.rootMargin,
                threshold: 0
            }
        );

        logger.debug('VirtualScroller initialized');
    }

    /**
     * 항목 설정
     * @param {Array} items - 렌더링할 항목 배열
     */
    setItems(items) {
        this.items = items;
        this.reset();
        this.createPlaceholders();
    }

    /**
     * 플레이스홀더 생성
     * @private
     */
    createPlaceholders() {
        // 모든 항목에 대한 플레이스홀더 생성
        this.items.forEach((item, index) => {
            const placeholder = document.createElement('div');
            placeholder.className = 'virtual-item-placeholder';
            placeholder.dataset.index = index;
            
            // 예상 높이 설정 (실제 렌더링 전)
            const estimatedHeight = item.estimatedHeight || 800; // 기본 800px
            placeholder.style.minHeight = `${estimatedHeight}px`;
            
            this.container.appendChild(placeholder);
            
            // Observe
            this.observer.observe(placeholder);
        });

        logger.debug(`Created ${this.items.length} placeholders`);
    }

    /**
     * Intersection 핸들러
     * @param {Array<IntersectionObserverEntry>} entries
     * @private
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            const index = parseInt(entry.target.dataset.index);
            
            if (entry.isIntersecting) {
                // 뷰포트 진입 - 렌더링
                this.renderItemAt(index);
            } else {
                // 뷰포트 이탈 - 언렌더링 (버퍼 고려)
                if (!this.isInBuffer(index)) {
                    this.unrenderItemAt(index);
                }
            }
        });
    }

    /**
     * 버퍼 영역 체크
     * @param {number} index
     * @returns {boolean}
     * @private
     */
    isInBuffer(index) {
        // 현재 보이는 항목들 기준으로 버퍼 계산
        const visibleIndices = Array.from(this.renderedItems.keys());
        if (visibleIndices.length === 0) {
            return false;
        }

        const min = Math.min(...visibleIndices);
        const max = Math.max(...visibleIndices);

        return index >= (min - this.bufferSize) && index <= (max + this.bufferSize);
    }

    /**
     * 특정 인덱스 항목 렌더링
     * @param {number} index
     * @private
     */
    renderItemAt(index) {
        if (this.renderedItems.has(index)) {
            return; // 이미 렌더링됨
        }

        const item = this.items[index];
        if (!item) {
            return;
        }

        const placeholder = this.container.querySelector(`[data-index="${index}"]`);
        if (!placeholder) {
            return;
        }

        logger.debug(`Rendering item ${index}`);

        // 항목 렌더링
        const element = this.renderItem(item, index);
        element.dataset.index = index;
        element.className = 'virtual-item';

        // 플레이스홀더 교체
        placeholder.replaceWith(element);

        // 추적
        this.renderedItems.set(index, element);
        
        // 새 요소도 observe
        this.observer.observe(element);
    }

    /**
     * 특정 인덱스 항목 언렌더링
     * @param {number} index
     * @private
     */
    unrenderItemAt(index) {
        const element = this.renderedItems.get(index);
        if (!element) {
            return;
        }

        logger.debug(`Unrendering item ${index}`);

        // 플레이스홀더로 교체
        const placeholder = document.createElement('div');
        placeholder.className = 'virtual-item-placeholder';
        placeholder.dataset.index = index;
        
        // 실제 높이를 플레이스홀더에 적용
        const height = element.offsetHeight;
        placeholder.style.minHeight = `${height}px`;

        element.replaceWith(placeholder);

        // Observe placeholder
        this.observer.observe(placeholder);

        // 추적에서 제거
        this.renderedItems.delete(index);
    }

    /**
     * 기본 렌더링 함수
     * @param {Object} item
     * @param {number} index
     * @returns {HTMLElement}
     * @private
     */
    defaultRenderItem(item, index) {
        const div = document.createElement('div');
        div.textContent = `Item ${index}`;
        return div;
    }

    /**
     * 특정 인덱스로 스크롤
     * @param {number} index
     * @param {ScrollIntoViewOptions} [options]
     */
    scrollToIndex(index, options = { behavior: 'smooth', block: 'start' }) {
        const element = this.renderedItems.get(index) ||
                       this.container.querySelector(`[data-index="${index}"]`);
        
        if (element) {
            element.scrollIntoView(options);
        }
    }

    /**
     * 현재 보이는 항목 인덱스 가져오기
     * @returns {Array<number>}
     */
    getVisibleIndices() {
        return Array.from(this.renderedItems.keys()).sort((a, b) => a - b);
    }

    /**
     * 렌더링된 항목 수
     * @returns {number}
     */
    get renderedCount() {
        return this.renderedItems.size;
    }

    /**
     * 전체 항목 수
     * @returns {number}
     */
    get totalCount() {
        return this.items.length;
    }

    /**
     * 리셋
     */
    reset() {
        // Observer 정리
        this.observer.disconnect();

        // 렌더링된 항목 정리
        this.renderedItems.clear();

        // 컨테이너 비우기
        this.container.innerHTML = '';

        logger.debug('VirtualScroller reset');
    }

    /**
     * 정리
     */
    destroy() {
        this.reset();
        this.observer = null;
        logger.debug('VirtualScroller destroyed');
    }
}

export default VirtualScroller;

