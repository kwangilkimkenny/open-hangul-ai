/**
 * Suggestion Tooltip
 * AI 제안 툴팁 UI
 * 
 * @module ui/suggestion-tooltip
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('SuggestionTooltip');

/**
 * 제안 툴팁 클래스
 * Grammarly 스타일의 제안 툴팁
 */
export class SuggestionTooltip {
    constructor() {
        this.tooltip = null;
        this.currentSuggestion = null;
        this.currentHighlightId = null;
        this.suggestionRegistry = new Map(); // id -> suggestion data
        
        this.init();
        logger.info('💬 SuggestionTooltip initialized');
    }

    /**
     * 초기화
     */
    init() {
        // 툴팁 DOM 생성
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'ai-suggestion-tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);

        // 하이라이트 클릭 이벤트 리스닝
        document.addEventListener('highlight-click', (e) => {
            this.show(e.detail);
        });

        // 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (!this.tooltip.contains(e.target) && 
                !e.target.closest('.highlight-overlay')) {
                this.hide();
            }
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.tooltip.style.display !== 'none') {
                this.hide();
            }
        });
    }

    /**
     * 제안 등록
     * @param {string} id - 하이라이트 ID
     * @param {Object} suggestion - 제안 데이터
     */
    registerSuggestion(id, suggestion) {
        this.suggestionRegistry.set(id, suggestion);
        logger.debug(`Suggestion registered: ${id}`);
    }

    /**
     * 툴팁 표시
     * @param {Object} detail - 이벤트 상세 정보
     */
    show(detail) {
        const { id, target, overlay, suggestion: providedSuggestion, rect } = detail;
        
        // 제안 데이터 가져오기
        const suggestion = providedSuggestion || this.suggestionRegistry.get(id);
        
        if (!suggestion) {
            logger.warn(`No suggestion found for highlight: ${id}`);
            return;
        }

        this.currentHighlightId = id;
        this.currentSuggestion = suggestion;

        // HTML 구성
        this._renderContent(suggestion);

        // 위치 계산
        const targetRect = rect || target.getBoundingClientRect();
        this._position(targetRect);

        // 표시
        this.tooltip.style.display = 'block';
        
        // 애니메이션
        requestAnimationFrame(() => {
            this.tooltip.classList.add('visible');
        });

        logger.debug(`Tooltip shown for: ${id}`);
    }

    /**
     * 툴팁 내용 렌더링
     * @private
     */
    _renderContent(suggestion) {
        const typeEmoji = this._getTypeEmoji(suggestion.type);
        const typeName = this._getTypeName(suggestion.type);

        this.tooltip.innerHTML = `
            <div class="suggestion-header">
                <div class="suggestion-header-left">
                    <span class="suggestion-badge ${suggestion.type}">
                        ${typeEmoji} ${typeName}
                    </span>
                    <span class="suggestion-category">${suggestion.category}</span>
                </div>
                <button class="suggestion-close" aria-label="닫기">×</button>
            </div>
            
            <div class="suggestion-body">
                <div class="original-text">
                    <strong>원본:</strong> "${this._escapeHtml(suggestion.original)}"
                </div>
                <div class="suggested-text">
                    <strong>제안:</strong> "${this._escapeHtml(suggestion.suggestion)}"
                </div>
                <div class="suggestion-reason">
                    ${this._escapeHtml(suggestion.reason)}
                </div>
            </div>
            
            <div class="suggestion-actions">
                <button class="btn-apply" data-action="apply">
                    ✓ 적용하기
                </button>
                <button class="btn-ignore" data-action="ignore">
                    ✕ 무시
                </button>
                <button class="btn-more" data-action="more">
                    ℹ 자세히
                </button>
            </div>
            
            <div class="suggestion-confidence">
                확신도: 
                <span class="confidence-bar">
                    <span class="confidence-fill" style="width: ${(suggestion.confidence * 100).toFixed(0)}%"></span>
                </span>
                ${(suggestion.confidence * 100).toFixed(0)}%
            </div>
        `;

        // 버튼 이벤트 연결
        this._attachEventListeners();
    }

    /**
     * 이벤트 리스너 연결
     * @private
     */
    _attachEventListeners() {
        // 적용 버튼
        const applyBtn = this.tooltip.querySelector('.btn-apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this._handleApply());
        }

        // 무시 버튼
        const ignoreBtn = this.tooltip.querySelector('.btn-ignore');
        if (ignoreBtn) {
            ignoreBtn.addEventListener('click', () => this._handleIgnore());
        }

        // 자세히 버튼
        const moreBtn = this.tooltip.querySelector('.btn-more');
        if (moreBtn) {
            moreBtn.addEventListener('click', () => this._handleMore());
        }

        // 닫기 버튼
        const closeBtn = this.tooltip.querySelector('.suggestion-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
    }

    /**
     * 적용 처리
     * @private
     */
    _handleApply() {
        if (!this.currentHighlightId || !this.currentSuggestion) return;

        // 커스텀 이벤트 발생
        const event = new CustomEvent('apply-suggestion', {
            detail: {
                id: this.currentHighlightId,
                suggestion: this.currentSuggestion
            },
            bubbles: true
        });

        document.dispatchEvent(event);

        logger.info(`Suggestion applied: ${this.currentHighlightId}`);
        this.hide();
    }

    /**
     * 무시 처리
     * @private
     */
    _handleIgnore() {
        if (!this.currentHighlightId) return;

        // 커스텀 이벤트 발생
        const event = new CustomEvent('ignore-suggestion', {
            detail: {
                id: this.currentHighlightId
            },
            bubbles: true
        });

        document.dispatchEvent(event);

        logger.info(`Suggestion ignored: ${this.currentHighlightId}`);
        this.hide();
    }

    /**
     * 자세히 보기 처리
     * @private
     */
    _handleMore() {
        if (!this.currentSuggestion) return;

        // 상세 정보 표시 (모달 또는 확장된 툴팁)
        const event = new CustomEvent('show-suggestion-details', {
            detail: {
                id: this.currentHighlightId,
                suggestion: this.currentSuggestion
            },
            bubbles: true
        });

        document.dispatchEvent(event);

        logger.debug('Show more details requested');
    }

    /**
     * 툴팁 위치 계산
     * @private
     */
    _position(targetRect) {
        const tooltip = this.tooltip;
        const margin = 8; // px

        // 툴팁 크기 계산 (임시 표시 필요)
        tooltip.style.visibility = 'hidden';
        tooltip.style.display = 'block';
        const tooltipRect = tooltip.getBoundingClientRect();
        tooltip.style.visibility = '';

        let left = targetRect.left;
        let top = targetRect.bottom + margin;

        // 오른쪽 경계 확인
        if (left + tooltipRect.width > window.innerWidth - margin) {
            left = window.innerWidth - tooltipRect.width - margin;
        }

        // 왼쪽 경계 확인
        if (left < margin) {
            left = margin;
        }

        // 아래쪽 공간 부족하면 위로 표시
        if (top + tooltipRect.height > window.innerHeight - margin) {
            top = targetRect.top - tooltipRect.height - margin;
        }

        // 위쪽 공간도 부족하면 화면 중앙
        if (top < margin) {
            top = (window.innerHeight - tooltipRect.height) / 2;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    /**
     * 툴팁 숨기기
     */
    hide() {
        this.tooltip.classList.remove('visible');
        
        // 애니메이션 후 숨기기
        setTimeout(() => {
            this.tooltip.style.display = 'none';
            this.currentHighlightId = null;
            this.currentSuggestion = null;
        }, 200);

        logger.debug('Tooltip hidden');
    }

    /**
     * 타입 이모지 가져오기
     * @private
     */
    _getTypeEmoji(type) {
        const emojis = {
            error: '❌',
            warning: '⚠️',
            suggestion: '💡',
            style: '✨',
            info: 'ℹ️'
        };
        return emojis[type] || '💡';
    }

    /**
     * 타입 이름 가져오기
     * @private
     */
    _getTypeName(type) {
        const names = {
            error: '오류',
            warning: '경고',
            suggestion: '제안',
            style: '스타일',
            info: '정보'
        };
        return names[type] || '제안';
    }

    /**
     * HTML 이스케이프
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 제안 제거
     * @param {string} id - 하이라이트 ID
     */
    removeSuggestion(id) {
        this.suggestionRegistry.delete(id);
        
        if (this.currentHighlightId === id) {
            this.hide();
        }
    }

    /**
     * 모든 제안 제거
     */
    clearAllSuggestions() {
        this.suggestionRegistry.clear();
        this.hide();
        logger.info('All suggestions cleared');
    }

    /**
     * 디버깅 정보 출력
     */
    debug() {
        logger.debug('='.repeat(80));
        logger.debug('💬 SuggestionTooltip Debug Info');
        logger.debug('='.repeat(80));
        logger.debug('Registered Suggestions:', this.suggestionRegistry.size);
        logger.debug('Current Highlight ID:', this.currentHighlightId);
        logger.debug('Current Suggestion:', this.currentSuggestion);
        logger.debug('Tooltip Visible:', this.tooltip.style.display !== 'none');
        logger.debug('='.repeat(80));
    }
}

