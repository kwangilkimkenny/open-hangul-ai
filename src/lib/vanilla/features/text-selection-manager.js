/**
 * Text Selection Manager
 * 텍스트 선택 감지 및 분석
 * 
 * @module features/text-selection-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TextSelectionManager');

/**
 * 텍스트 선택 관리자
 * Grammarly 스타일의 텍스트 선택 감지 및 분석
 */
export class TextSelectionManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.currentSelection = null;
        this.selectionData = null;
        this.callbacks = new Map();
        this.enabled = false;
        this.debounceTimer = null;
        this.debounceDelay = 300; // ms
        
        logger.info('📝 TextSelectionManager initialized');
    }

    /**
     * 선택 추적 활성화
     */
    enableSelectionTracking() {
        if (this.enabled) {
            logger.warn('Selection tracking already enabled');
            return;
        }

        // 마우스 업 이벤트 (드래그 선택 완료)
        document.addEventListener('mouseup', this._handleMouseUp.bind(this));
        
        // 선택 변경 이벤트
        document.addEventListener('selectionchange', this._handleSelectionChange.bind(this));
        
        // 키보드 선택 (Shift + Arrow)
        document.addEventListener('keyup', this._handleKeyUp.bind(this));

        this.enabled = true;
        logger.info('✅ Selection tracking enabled');
    }

    /**
     * 선택 추적 비활성화
     */
    disableSelectionTracking() {
        if (!this.enabled) return;

        // 이벤트 리스너 제거는 복잡하므로 플래그로 처리
        this.enabled = false;
        logger.info('⏸️ Selection tracking disabled');
    }

    /**
     * 마우스 업 이벤트 처리
     * @private
     */
    _handleMouseUp(e) {
        if (!this.enabled) return;

        // 문서 영역 내에서만 처리
        const renderContainer = document.getElementById('render-container');
        if (!renderContainer || !renderContainer.contains(e.target)) {
            return;
        }

        // 디바운스 처리
        this._debounce(() => {
            this._processSelection(e);
        });
    }

    /**
     * 선택 변경 이벤트 처리
     * @private
     */
    _handleSelectionChange() {
        if (!this.enabled) return;
        
        // 디바운스 처리 (너무 빈번한 호출 방지)
        this._debounce(() => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) {
                this._processSelection();
            }
        });
    }

    /**
     * 키보드 이벤트 처리
     * @private
     */
    _handleKeyUp(e) {
        if (!this.enabled) return;

        // Shift + Arrow 키로 선택한 경우
        if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            this._debounce(() => {
                this._processSelection();
            });
        }
    }

    /**
     * 디바운스 처리
     * @private
     */
    _debounce(callback) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            callback();
            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    /**
     * 선택 처리
     * @private
     */
    _processSelection(event = null) {
        const selectionData = this.analyzeSelection();
        
        if (!selectionData) {
            logger.debug('No valid selection');
            return;
        }

        // 최소 길이 체크 (2글자 이상)
        if (selectionData.text.length < 2) {
            logger.debug('Selection too short:', selectionData.text.length);
            return;
        }

        // 선택 데이터 저장
        this.currentSelection = window.getSelection();
        this.selectionData = selectionData;

        logger.debug('Selection processed:', {
            text: selectionData.text.substring(0, 50),
            length: selectionData.text.length,
            canEdit: selectionData.canEdit
        });

        // 콜백 실행
        this._triggerCallback('selection-made', selectionData);
    }

    /**
     * 선택 영역 분석
     * @returns {Object|null} 선택 데이터
     */
    analyzeSelection() {
        const selection = window.getSelection();
        
        // 선택이 없거나 collapsed 상태면 null 반환
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            return null;
        }

        try {
            const range = selection.getRangeAt(0);
            const text = selection.toString().trim();

            if (!text) return null;

            const selectionData = {
                text: text,
                range: range.cloneRange(), // 복사본 저장
                startNode: selection.anchorNode,
                endNode: selection.focusNode,
                startOffset: selection.anchorOffset,
                endOffset: selection.focusOffset,
                boundingRect: range.getBoundingClientRect(),
                timestamp: Date.now()
            };

            // HWPX 구조와 매핑
            const mappedData = this.mapToHWPXStructure(selectionData);

            return mappedData;
        } catch (error) {
            logger.error('Failed to analyze selection:', error);
            return null;
        }
    }

    /**
     * HWPX 데이터 구조와 매핑
     * @param {Object} selectionData - 선택 데이터
     * @returns {Object} 매핑된 데이터
     */
    mapToHWPXStructure(selectionData) {
        const startElement = this.getElementFromNode(selectionData.startNode);
        
        if (!startElement) {
            return {
                ...selectionData,
                paragraphData: null,
                tableCell: null,
                canEdit: false,
                location: 'unknown'
            };
        }

        // 단락 데이터 찾기
        const paraElement = startElement.closest('.hwp-paragraph');
        const paraData = paraElement?._paraData;

        // 테이블 셀 찾기
        const tableCellElement = startElement.closest('.hwp-table td, .hwp-table th');
        const tableCellData = tableCellElement?._cellData;

        // 테이블 찾기
        const tableElement = startElement.closest('.hwp-table');
        const tableData = tableElement?._tableData;

        // 편집 가능 여부
        const canEdit = this.isEditable(startElement);

        // 위치 파악
        let location = 'paragraph';
        if (tableCellElement) {
            location = 'table-cell';
        } else if (tableElement) {
            location = 'table';
        }

        return {
            ...selectionData,
            paragraphData: paraData,
            tableCell: tableCellData,
            tableCellElement: tableCellElement,
            tableData: tableData,
            canEdit: canEdit,
            location: location,
            startElement: startElement
        };
    }

    /**
     * Node에서 Element 가져오기
     * @private
     */
    getElementFromNode(node) {
        if (!node) return null;
        
        // Text node인 경우 부모 element 반환
        if (node.nodeType === Node.TEXT_NODE) {
            return node.parentElement;
        }
        
        // Element node인 경우 그대로 반환
        if (node.nodeType === Node.ELEMENT_NODE) {
            return node;
        }
        
        return null;
    }

    /**
     * 편집 가능 여부 확인
     * @param {HTMLElement} element - 대상 요소
     * @returns {boolean}
     */
    isEditable(element) {
        if (!element) return false;

        // 편집 불가 영역 체크
        const nonEditableSelectors = [
            '.page-number',
            '.header',
            '.footer',
            '.watermark',
            '.annotation'
        ];

        for (const selector of nonEditableSelectors) {
            if (element.closest(selector)) {
                return false;
            }
        }

        // 편집 가능 영역 체크
        const editableSelectors = [
            '.hwp-paragraph',
            '.hwp-table td',
            '.hwp-table th'
        ];

        for (const selector of editableSelectors) {
            if (element.closest(selector)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 현재 선택 영역 가져오기
     * @returns {Object|null}
     */
    getCurrentSelection() {
        return this.selectionData;
    }

    /**
     * 선택 영역 초기화
     */
    clearSelection() {
        if (this.currentSelection) {
            this.currentSelection.removeAllRanges();
        }
        this.currentSelection = null;
        this.selectionData = null;
        
        logger.debug('Selection cleared');
    }

    /**
     * 이벤트 콜백 등록
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
        
        logger.debug(`Callback registered for event: ${event}`);
    }

    /**
     * 이벤트 콜백 제거
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    off(event, callback) {
        if (!this.callbacks.has(event)) return;
        
        const callbacks = this.callbacks.get(event);
        const index = callbacks.indexOf(callback);
        
        if (index > -1) {
            callbacks.splice(index, 1);
            logger.debug(`Callback removed for event: ${event}`);
        }
    }

    /**
     * 콜백 실행
     * @private
     */
    _triggerCallback(event, data) {
        if (!this.callbacks.has(event)) return;
        
        const callbacks = this.callbacks.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                logger.error(`Callback error for event ${event}:`, error);
            }
        });
    }

    /**
     * 디버깅 정보 출력
     */
    debug() {
        console.log('='.repeat(80));
        console.log('📝 TextSelectionManager Debug Info');
        console.log('='.repeat(80));
        console.log('Enabled:', this.enabled);
        console.log('Current Selection:', this.currentSelection);
        console.log('Selection Data:', this.selectionData);
        console.log('Registered Callbacks:', Array.from(this.callbacks.keys()));
        console.log('='.repeat(80));
    }
}

