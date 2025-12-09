/**
 * Highlight Overlay
 * 텍스트 하이라이트 오버레이 UI
 * 
 * @module ui/highlight-overlay
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('HighlightOverlay');

/**
 * 하이라이트 오버레이 클래스
 * Grammarly 스타일의 밑줄 하이라이트 제공
 */
export class HighlightOverlay {
    constructor() {
        this.overlays = new Map(); // id -> overlay element
        this.suggestionData = new Map(); // id -> suggestion data
        
        logger.info('🎨 HighlightOverlay initialized');
    }

    /**
     * 하이라이트 추가
     * @param {string} id - 고유 ID
     * @param {Range} range - DOM Range 객체
     * @param {string} type - 하이라이트 타입 (error, warning, suggestion, style)
     * @param {Object} data - 제안 데이터
     * @returns {HTMLElement|null} 생성된 하이라이트 요소
     */
    addHighlight(id, range, type = 'suggestion', data = null) {
        try {
            // 이미 존재하면 제거
            if (this.overlays.has(id)) {
                this.removeHighlight(id);
            }

            // 하이라이트 요소 생성
            const overlay = document.createElement('span');
            overlay.className = `highlight-overlay highlight-${type}`;
            overlay.dataset.highlightId = id;
            overlay.dataset.highlightType = type;
            
            // 스타일 적용
            this._applyStyle(overlay, type);
            
            // Range를 span으로 감싸기
            try {
                range.surroundContents(overlay);
            } catch (e) {
                // Range가 복잡한 경우 (여러 요소에 걸쳐있는 경우)
                // 대체 방법 사용
                logger.warn('Complex range detected, using alternative method');
                return this._addHighlightAlternative(id, range, type, data);
            }
            
            // 이벤트 리스너 추가
            this._attachEventListeners(overlay, id);
            
            // 저장
            this.overlays.set(id, overlay);
            if (data) {
                this.suggestionData.set(id, data);
            }
            
            logger.debug(`Highlight added: ${id} (${type})`);
            
            return overlay;
        } catch (error) {
            logger.error('Failed to add highlight:', error);
            return null;
        }
    }

    /**
     * 복잡한 Range를 위한 대체 하이라이트 방법
     * @private
     */
    _addHighlightAlternative(id, range, type, data) {
        try {
            // 선택 영역의 HTML을 가져와서 span으로 감싸기
            const fragment = range.extractContents();
            const overlay = document.createElement('span');
            overlay.className = `highlight-overlay highlight-${type}`;
            overlay.dataset.highlightId = id;
            overlay.dataset.highlightType = type;
            
            this._applyStyle(overlay, type);
            
            overlay.appendChild(fragment);
            range.insertNode(overlay);
            
            this._attachEventListeners(overlay, id);
            
            this.overlays.set(id, overlay);
            if (data) {
                this.suggestionData.set(id, data);
            }
            
            return overlay;
        } catch (error) {
            logger.error('Alternative highlight method failed:', error);
            return null;
        }
    }

    /**
     * 스타일 적용
     * @private
     */
    _applyStyle(overlay, type) {
        const color = this.getColor(type);
        const borderStyle = this.getBorderStyle(type);
        
        overlay.style.cssText = `
            border-bottom: 2px ${borderStyle} ${color};
            cursor: pointer;
            position: relative;
            display: inline;
            transition: background-color 0.2s ease;
        `;
    }

    /**
     * 이벤트 리스너 추가
     * @private
     */
    _attachEventListeners(overlay, id) {
        // 클릭 이벤트
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleHighlightClick(id, e);
        });
        
        // 호버 효과
        overlay.addEventListener('mouseenter', () => {
            overlay.style.backgroundColor = this.getHoverColor(overlay.dataset.highlightType);
        });
        
        overlay.addEventListener('mouseleave', () => {
            overlay.style.backgroundColor = 'transparent';
        });
    }

    /**
     * 하이라이트 클릭 처리
     * @param {string} id - 하이라이트 ID
     * @param {Event} event - 클릭 이벤트
     */
    handleHighlightClick(id, event) {
        logger.debug(`Highlight clicked: ${id}`);
        
        const overlay = this.overlays.get(id);
        const suggestion = this.suggestionData.get(id);
        
        if (!overlay) {
            logger.warn(`Highlight not found: ${id}`);
            return;
        }
        
        // 커스텀 이벤트 발생
        const customEvent = new CustomEvent('highlight-click', {
            detail: {
                id: id,
                target: event.target,
                overlay: overlay,
                suggestion: suggestion,
                rect: overlay.getBoundingClientRect()
            },
            bubbles: true
        });
        
        document.dispatchEvent(customEvent);
    }

    /**
     * 하이라이트 제거
     * @param {string} id - 하이라이트 ID
     */
    removeHighlight(id) {
        const overlay = this.overlays.get(id);
        
        if (!overlay) {
            logger.debug(`Highlight not found for removal: ${id}`);
            return;
        }
        
        try {
            // 부모 노드 가져오기
            const parent = overlay.parentNode;
            
            if (parent) {
                // overlay의 자식 노드들을 부모로 이동
                while (overlay.firstChild) {
                    parent.insertBefore(overlay.firstChild, overlay);
                }
                
                // overlay 제거
                parent.removeChild(overlay);
                
                // 텍스트 노드 정리 (인접한 텍스트 노드 병합)
                parent.normalize();
            }
            
            // 맵에서 제거
            this.overlays.delete(id);
            this.suggestionData.delete(id);
            
            logger.debug(`Highlight removed: ${id}`);
        } catch (error) {
            logger.error(`Failed to remove highlight ${id}:`, error);
        }
    }

    /**
     * 모든 하이라이트 제거
     */
    removeAllHighlights() {
        const ids = Array.from(this.overlays.keys());
        ids.forEach(id => this.removeHighlight(id));
        
        logger.info('All highlights removed');
    }

    /**
     * 특정 타입의 하이라이트 제거
     * @param {string} type - 하이라이트 타입
     */
    removeHighlightsByType(type) {
        const ids = Array.from(this.overlays.keys());
        ids.forEach(id => {
            const overlay = this.overlays.get(id);
            if (overlay && overlay.dataset.highlightType === type) {
                this.removeHighlight(id);
            }
        });
        
        logger.debug(`Removed all highlights of type: ${type}`);
    }

    /**
     * 하이라이트 가져오기
     * @param {string} id - 하이라이트 ID
     * @returns {HTMLElement|null}
     */
    getHighlight(id) {
        return this.overlays.get(id) || null;
    }

    /**
     * 제안 데이터 가져오기
     * @param {string} id - 하이라이트 ID
     * @returns {Object|null}
     */
    getSuggestionData(id) {
        return this.suggestionData.get(id) || null;
    }

    /**
     * 타입별 색상 가져오기
     * @param {string} type - 하이라이트 타입
     * @returns {string} CSS 색상
     */
    getColor(type) {
        const colors = {
            error: '#f56565',        // 빨강 - 오류
            warning: '#ed8936',      // 주황 - 경고
            suggestion: '#4299e1',   // 파랑 - 제안
            style: '#9f7aea',        // 보라 - 스타일
            info: '#48bb78'          // 초록 - 정보
        };
        
        return colors[type] || colors.suggestion;
    }

    /**
     * 타입별 호버 색상 가져오기
     * @param {string} type - 하이라이트 타입
     * @returns {string} CSS 색상
     */
    getHoverColor(type) {
        const colors = {
            error: 'rgba(245, 101, 101, 0.1)',
            warning: 'rgba(237, 137, 54, 0.1)',
            suggestion: 'rgba(66, 153, 225, 0.1)',
            style: 'rgba(159, 122, 234, 0.1)',
            info: 'rgba(72, 187, 120, 0.1)'
        };
        
        return colors[type] || colors.suggestion;
    }

    /**
     * 타입별 보더 스타일 가져오기
     * @param {string} type - 하이라이트 타입
     * @returns {string} CSS border-style
     */
    getBorderStyle(type) {
        const styles = {
            error: 'wavy',      // 물결 - 오류
            warning: 'wavy',    // 물결 - 경고
            suggestion: 'dotted', // 점선 - 제안
            style: 'dashed',    // 대시 - 스타일
            info: 'solid'       // 실선 - 정보
        };
        
        return styles[type] || styles.suggestion;
    }

    /**
     * 하이라이트 개수 가져오기
     * @returns {number}
     */
    getHighlightCount() {
        return this.overlays.size;
    }

    /**
     * 타입별 하이라이트 개수 가져오기
     * @returns {Object}
     */
    getHighlightCountByType() {
        const counts = {
            error: 0,
            warning: 0,
            suggestion: 0,
            style: 0,
            info: 0
        };
        
        this.overlays.forEach(overlay => {
            const type = overlay.dataset.highlightType;
            if (counts.hasOwnProperty(type)) {
                counts[type]++;
            }
        });
        
        return counts;
    }

    /**
     * 디버깅 정보 출력
     */
    debug() {
        console.log('='.repeat(80));
        console.log('🎨 HighlightOverlay Debug Info');
        console.log('='.repeat(80));
        console.log('Total Highlights:', this.overlays.size);
        console.log('By Type:', this.getHighlightCountByType());
        console.log('Highlight IDs:', Array.from(this.overlays.keys()));
        console.log('='.repeat(80));
    }
}

