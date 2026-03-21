/**
 * AI Editor Controller
 * Grammarly 스타일 AI 편집 시스템 통합 컨트롤러
 * 
 * @module features/ai-editor-controller
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { TextSelectionManager } from './text-selection-manager.js';
import { AISuggestionEngine } from './ai-suggestion-engine.js';
import { HighlightOverlay } from '../ui/highlight-overlay.js';
import { SuggestionTooltip } from '../ui/suggestion-tooltip.js';

const logger = getLogger('AIEditorController');

/**
 * AI 편집 컨트롤러
 * 모든 모듈을 통합하여 Grammarly 스타일 편집 시스템 제공
 */
export class AIEditorController {
    constructor(viewer, gptGenerator) {
        this.viewer = viewer;
        this.gptGenerator = gptGenerator;
        
        // 모듈 초기화
        this.selectionManager = new TextSelectionManager(viewer);
        this.suggestionEngine = new AISuggestionEngine(gptGenerator);
        this.highlightOverlay = new HighlightOverlay();
        this.suggestionTooltip = new SuggestionTooltip();
        
        // 상태
        this.enabled = false;
        this.highlightMap = new Map(); // highlightId -> {selectionData, suggestion}
        this.analysisInProgress = false;
        
        logger.info('🎯 AIEditorController initialized');
    }

    /**
     * AI 편집 시스템 활성화
     */
    enable() {
        if (this.enabled) {
            logger.warn('AI Editor already enabled');
            return;
        }

        // 선택 추적 활성화
        this.selectionManager.enableSelectionTracking();

        // 이벤트 리스너 등록
        this._registerEventListeners();

        this.enabled = true;
        logger.info('✅ AI Editor enabled');

        // 상태 표시
        this._showStatusIndicator('AI 편집 활성화');
    }

    /**
     * AI 편집 시스템 비활성화
     */
    disable() {
        if (!this.enabled) return;

        // 선택 추적 비활성화
        this.selectionManager.disableSelectionTracking();

        // 모든 하이라이트 제거
        this.highlightOverlay.removeAllHighlights();
        this.highlightMap.clear();

        this.enabled = false;
        logger.info('⏸️ AI Editor disabled');

        // 상태 표시
        this._showStatusIndicator('AI 편집 비활성화');
    }

    /**
     * 토글
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    /**
     * 이벤트 리스너 등록
     * @private
     */
    _registerEventListeners() {
        // 선택 완료 이벤트
        this.selectionManager.on('selection-made', async (selectionData) => {
            await this._handleSelection(selectionData);
        });

        // 제안 적용 이벤트
        document.addEventListener('apply-suggestion', (e) => {
            this._handleApplySuggestion(e.detail);
        });

        // 제안 무시 이벤트
        document.addEventListener('ignore-suggestion', (e) => {
            this._handleIgnoreSuggestion(e.detail);
        });

        // 상세 보기 이벤트
        document.addEventListener('show-suggestion-details', (e) => {
            this._handleShowDetails(e.detail);
        });

        logger.debug('Event listeners registered');
    }

    /**
     * 선택 처리
     * @private
     */
    async _handleSelection(selectionData) {
        if (!selectionData || !selectionData.canEdit) {
            logger.debug('Selection not editable, skipping');
            return;
        }

        // 이미 분석 중이면 스킵
        if (this.analysisInProgress) {
            logger.debug('Analysis already in progress');
            return;
        }

        logger.info('Processing selection:', selectionData.text.substring(0, 50));

        // 분석 중 표시
        this._showAnalyzingIndicator(selectionData.boundingRect);
        this.analysisInProgress = true;

        try {
            // AI 분석 실행
            const analysis = await this.suggestionEngine.analyzeText(selectionData);

            // 분석 완료
            this._hideAnalyzingIndicator();

            // 제안이 있으면 하이라이트 추가
            if (analysis.suggestions && analysis.suggestions.length > 0) {
                logger.info(`Found ${analysis.suggestions.length} suggestions`);
                this._applyHighlights(selectionData, analysis.suggestions);
            } else {
                logger.debug('No suggestions found');
            }
        } catch (error) {
            logger.error('Selection analysis failed:', error);
            this._hideAnalyzingIndicator();
        } finally {
            this.analysisInProgress = false;
        }
    }

    /**
     * 하이라이트 적용
     * @private
     */
    _applyHighlights(selectionData, suggestions) {
        const { text, range } = selectionData;

        suggestions.forEach((suggestion, index) => {
            const id = `ai-suggestion-${Date.now()}-${index}`;

            // 제안의 원본 텍스트가 선택 범위에 있는지 확인
            const originalPos = text.indexOf(suggestion.original);
            
            if (originalPos === -1) {
                logger.warn(`Original text not found in selection: "${suggestion.original}"`);
                return;
            }

            // 제안 위치의 Range 계산
            const suggestionRange = this._calculateSuggestionRange(
                range,
                suggestion.original,
                originalPos
            );

            if (!suggestionRange) {
                logger.warn('Failed to calculate suggestion range');
                return;
            }

            // 하이라이트 추가
            const overlay = this.highlightOverlay.addHighlight(
                id,
                suggestionRange,
                suggestion.type,
                suggestion
            );

            if (overlay) {
                // 제안 등록
                this.suggestionTooltip.registerSuggestion(id, suggestion);
                
                // 맵에 저장
                this.highlightMap.set(id, {
                    selectionData,
                    suggestion,
                    overlay
                });

                logger.debug(`Highlight added: ${id}`);
            }
        });
    }

    /**
     * 제안 위치의 Range 계산
     * @private
     */
    _calculateSuggestionRange(baseRange, originalText, position) {
        try {
            // 새로운 Range 생성
            const newRange = document.createRange();
            
            // baseRange의 시작 노드에서 position만큼 오프셋
            const startNode = baseRange.startContainer;
            const startOffset = baseRange.startOffset + position;
            const endOffset = startOffset + originalText.length;

            newRange.setStart(startNode, startOffset);
            newRange.setEnd(startNode, endOffset);

            return newRange;
        } catch (error) {
            logger.error('Failed to calculate suggestion range:', error);
            return null;
        }
    }

    /**
     * 제안 적용 처리
     * @private
     */
    _handleApplySuggestion({ id, suggestion }) {
        logger.info(`Applying suggestion: ${id}`);

        const data = this.highlightMap.get(id);
        if (!data) {
            logger.warn(`Suggestion data not found: ${id}`);
            return;
        }

        // 하이라이트 찾기
        const overlay = this.highlightOverlay.getHighlight(id);
        if (!overlay) {
            logger.warn(`Highlight not found: ${id}`);
            return;
        }

        try {
            // 텍스트 교체
            const range = document.createRange();
            range.selectNodeContents(overlay);
            range.deleteContents();
            range.insertNode(document.createTextNode(suggestion.suggestion));

            // 하이라이트 제거
            this.highlightOverlay.removeHighlight(id);
            this.highlightMap.delete(id);
            this.suggestionTooltip.removeSuggestion(id);

            // History에 저장 (Undo/Redo)
            if (window.historyManager) {
                window.historyManager.saveState();
            }

            // AutoSave 트리거
            if (window.autoSaveManager) {
                window.autoSaveManager.markDirty();
            }

            logger.info('Suggestion applied successfully');

            // 성공 메시지
            this._showToast('제안이 적용되었습니다', 'success');
        } catch (error) {
            logger.error('Failed to apply suggestion:', error);
            this._showToast('제안 적용 실패', 'error');
        }
    }

    /**
     * 제안 무시 처리
     * @private
     */
    _handleIgnoreSuggestion({ id }) {
        logger.info(`Ignoring suggestion: ${id}`);

        // 하이라이트 제거
        this.highlightOverlay.removeHighlight(id);
        this.highlightMap.delete(id);
        this.suggestionTooltip.removeSuggestion(id);

        logger.debug('Suggestion ignored');
    }

    /**
     * 상세 보기 처리
     * @private
     */
    _handleShowDetails({ id, suggestion }) {
        logger.debug(`Showing details for: ${id}`);

        // 상세 정보 표시 (향후 구현)
        logger.debug('Suggestion Details:', suggestion);
    }

    /**
     * 분석 중 인디케이터 표시
     * @private
     */
    _showAnalyzingIndicator(rect) {
        let indicator = document.getElementById('ai-analyzing-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'ai-analyzing-indicator';
            indicator.className = 'analyzing-indicator';
            document.body.appendChild(indicator);
        }

        indicator.innerHTML = `
            <div class="analyzing-text">
                <span class="analyzing-spinner"></span>
                AI 분석 중...
            </div>
        `;

        indicator.style.left = `${rect.left}px`;
        indicator.style.top = `${rect.top}px`;
        indicator.style.width = `${rect.width}px`;
        indicator.style.height = `${rect.height}px`;
        indicator.style.display = 'block';
    }

    /**
     * 분석 중 인디케이터 숨기기
     * @private
     */
    _hideAnalyzingIndicator() {
        const indicator = document.getElementById('ai-analyzing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * 상태 인디케이터 표시
     * @private
     */
    _showStatusIndicator(message) {
        // 간단한 토스트 메시지
        if (window.showToast) {
            window.showToast('info', 'AI 편집', message);
        } else {
            logger.info(`[AI Editor] ${message}`);
        }
    }

    /**
     * 토스트 표시
     * @private
     */
    _showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(type, 'AI 편집', message);
        } else {
            logger.info(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 모든 하이라이트 제거
     */
    clearAllHighlights() {
        this.highlightOverlay.removeAllHighlights();
        this.highlightMap.clear();
        this.suggestionTooltip.clearAllSuggestions();
        
        logger.info('All highlights cleared');
    }

    /**
     * 통계 정보 가져오기
     * @returns {Object}
     */
    getStats() {
        const highlightCounts = this.highlightOverlay.getHighlightCountByType();
        const engineStats = this.suggestionEngine.getStats();

        return {
            enabled: this.enabled,
            highlights: {
                total: this.highlightMap.size,
                byType: highlightCounts
            },
            engine: engineStats,
            analysisInProgress: this.analysisInProgress
        };
    }

    /**
     * 디버깅 정보 출력
     */
    debug() {
        logger.debug('='.repeat(80));
        logger.debug('AIEditorController Debug Info');
        logger.debug('='.repeat(80));
        logger.debug('Stats:', this.getStats());
        logger.debug('\nModules:');
        this.selectionManager.debug();
        this.highlightOverlay.debug();
        this.suggestionTooltip.debug();
        this.suggestionEngine.debug();
        logger.debug('='.repeat(80));
    }
}

