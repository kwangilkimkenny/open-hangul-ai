/**
 * Range Manager
 * 텍스트 범위 선택 관리 시스템
 * Canvas-editor의 RangeManager를 DOM 기반으로 적용
 *
 * @module range-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Range Manager Class
 * 텍스트 범위 선택, 스타일 적용, 드래그/키보드 선택 지원
 */
export class RangeManager {
    /**
     * RangeManager 생성자
     * @param {Object} viewer - HWPX Viewer 인스턴스
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.positionManager = viewer.getPositionManager();

        // 현재 선택 범위
        this.range = {
            startIndex: -1,
            endIndex: -1,
            isCollapsed: true  // 커서만 있는 상태 (선택 없음)
        };

        // 선택 상태
        this.isSelecting = false;
        this.selectionStartPos = null;

        // 하이라이트 요소들
        this.highlightElements = [];

        // 이벤트 핸들러 바인딩
        this._boundHandlers = {
            mousedown: this._handleMouseDown.bind(this),
            mousemove: this._handleMouseMove.bind(this),
            mouseup: this._handleMouseUp.bind(this),
            keydown: this._handleKeyDown.bind(this)
        };

        logger.info('🎯 RangeManager initialized');
    }

    /**
     * 드래그 및 키보드 선택 활성화
     */
    enableSelection() {
        const container = this.viewer.container;

        // 마우스 이벤트
        container.addEventListener('mousedown', this._boundHandlers.mousedown);
        document.addEventListener('mousemove', this._boundHandlers.mousemove);
        document.addEventListener('mouseup', this._boundHandlers.mouseup);

        // 키보드 이벤트
        container.addEventListener('keydown', this._boundHandlers.keydown);

        // 컨테이너를 focusable하게 만들기
        container.setAttribute('tabindex', '0');

        logger.info('✅ Selection enabled (drag and keyboard)');
    }

    /**
     * 선택 비활성화
     */
    disableSelection() {
        const container = this.viewer.container;

        container.removeEventListener('mousedown', this._boundHandlers.mousedown);
        document.removeEventListener('mousemove', this._boundHandlers.mousemove);
        document.removeEventListener('mouseup', this._boundHandlers.mouseup);
        container.removeEventListener('keydown', this._boundHandlers.keydown);

        logger.info('🚫 Selection disabled');
    }

    /**
     * 마우스 다운 핸들러
     * @private
     */
    _handleMouseDown(e) {
        // 편집 모드가 아니거나 특수 키가 눌렸으면 무시
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        // 테이블 셀 내부는 인라인 에디터가 처리
        if (e.target.closest('.hwp-table td, .hwp-table th')) {
            return;
        }

        if (!this.positionManager || !this.positionManager.isPositionReady()) {
            return;
        }

        const position = this.positionManager.getPositionByXY(e.clientX, e.clientY);
        if (!position) {
            return;
        }

        // 선택 시작
        this.isSelecting = true;
        this.selectionStartPos = position;

        // 범위 초기화 (커서 위치로)
        this.setRange(position.index, position.index);

        // 기존 브라우저 선택 방지
        e.preventDefault();
    }

    /**
     * 마우스 이동 핸들러
     * @private
     */
    _handleMouseMove(e) {
        if (!this.isSelecting || !this.selectionStartPos) {
            return;
        }

        if (!this.positionManager || !this.positionManager.isPositionReady()) {
            return;
        }

        const position = this.positionManager.getPositionByXY(e.clientX, e.clientY);
        if (!position) {
            return;
        }

        // 범위 업데이트
        this.setRange(this.selectionStartPos.index, position.index);
    }

    /**
     * 마우스 업 핸들러
     * @private
     */
    _handleMouseUp(e) {
        if (!this.isSelecting) {
            return;
        }

        this.isSelecting = false;

        // 선택된 텍스트 로그
        const selectedText = this.getSelectedText();
        if (selectedText && selectedText.length > 0) {
            logger.debug(`📝 Selected: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`);
        }
    }

    /**
     * 키보드 핸들러
     * @private
     */
    _handleKeyDown(e) {
        // Shift + Arrow 키로 선택 확장
        if (!e.shiftKey) {
            return;
        }

        if (!this.positionManager || !this.positionManager.isPositionReady()) {
            return;
        }

        let handled = false;
        const currentIndex = this.range.endIndex >= 0 ? this.range.endIndex : 0;

        switch (e.key) {
            case 'ArrowLeft':
                if (currentIndex > 0) {
                    if (this.range.startIndex < 0) {
                        this.setRange(currentIndex, currentIndex - 1);
                    } else {
                        this.setRange(this.range.startIndex, currentIndex - 1);
                    }
                    handled = true;
                }
                break;

            case 'ArrowRight':
                const maxIndex = this.positionManager.getPositionList().length - 1;
                if (currentIndex < maxIndex) {
                    if (this.range.startIndex < 0) {
                        this.setRange(currentIndex, currentIndex + 1);
                    } else {
                        this.setRange(this.range.startIndex, currentIndex + 1);
                    }
                    handled = true;
                }
                break;

            case 'ArrowUp':
                // TODO: 위로 한 줄 선택
                break;

            case 'ArrowDown':
                // TODO: 아래로 한 줄 선택
                break;

            case 'Home':
                // 줄 시작까지 선택
                // TODO: 현재 줄의 시작 찾기
                break;

            case 'End':
                // 줄 끝까지 선택
                // TODO: 현재 줄의 끝 찾기
                break;

            case 'a':
                // Ctrl+Shift+A: 전체 선택
                if (e.ctrlKey || e.metaKey) {
                    this.selectAll();
                    handled = true;
                }
                break;
        }

        if (handled) {
            e.preventDefault();
        }
    }

    /**
     * 범위 설정
     * @param {number} startIndex - 시작 인덱스
     * @param {number} endIndex - 끝 인덱스
     */
    setRange(startIndex, endIndex) {
        // 인덱스 정규화
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);

        this.range = {
            startIndex: start,
            endIndex: end,
            isCollapsed: start === end
        };

        // 시각적 하이라이트 업데이트
        this._updateSelectionHighlight();

        logger.debug(`📍 Range set: [${start}, ${end}] (${end - start + 1} chars)`);
    }

    /**
     * 범위 가져오기
     * @returns {Object} 범위 정보 {startIndex, endIndex, isCollapsed}
     */
    getRange() {
        return { ...this.range };
    }

    /**
     * 선택된 위치들 가져오기
     * @returns {Array} 위치 정보 배열
     */
    getSelectedPositions() {
        if (this.range.isCollapsed || this.range.startIndex < 0) {
            return [];
        }

        return this.positionManager.getPositionsInRange(
            this.range.startIndex,
            this.range.endIndex
        );
    }

    /**
     * 선택된 텍스트 가져오기
     * @returns {string} 선택된 텍스트
     */
    getSelectedText() {
        const positions = this.getSelectedPositions();
        return positions.map(pos => pos.value).join('');
    }

    /**
     * 선택 영역 하이라이트 업데이트
     * @private
     */
    _updateSelectionHighlight() {
        // 기존 하이라이트 제거
        this._clearSelectionHighlight();

        if (this.range.isCollapsed || this.range.startIndex < 0) {
            return;
        }

        const positions = this.getSelectedPositions();
        if (positions.length === 0) {
            return;
        }

        // 각 위치에 하이라이트 오버레이 추가
        positions.forEach(pos => {
            if (!pos.parentElement) {
                return;
            }

            // 하이라이트 요소 생성
            const highlight = document.createElement('span');
            highlight.className = 'hwpx-selection-highlight';
            highlight.style.position = 'absolute';
            highlight.style.backgroundColor = 'rgba(0, 120, 215, 0.3)';
            highlight.style.pointerEvents = 'none';
            highlight.style.zIndex = '10';

            // 위치 설정
            const coord = pos.coordinate;
            const container = this.viewer.container;
            const containerRect = container.getBoundingClientRect();

            highlight.style.left = `${coord.left - containerRect.left + container.scrollLeft}px`;
            highlight.style.top = `${coord.top - containerRect.top + container.scrollTop}px`;
            highlight.style.width = `${coord.width}px`;
            highlight.style.height = `${coord.height}px`;

            container.appendChild(highlight);
            this.highlightElements.push(highlight);
        });
    }

    /**
     * 선택 하이라이트 제거
     * @private
     */
    _clearSelectionHighlight() {
        this.highlightElements.forEach(el => {
            if (el.parentElement) {
                el.parentElement.removeChild(el);
            }
        });
        this.highlightElements = [];
    }

    /**
     * 선택된 요소들 가져오기 (중복 제거)
     * @returns {Array<HTMLElement>} 선택된 요소들
     */
    getSelectedElements() {
        const positions = this.getSelectedPositions();
        const elements = new Set();

        positions.forEach(pos => {
            if (pos.parentElement) {
                elements.add(pos.parentElement);
            }
        });

        return Array.from(elements);
    }

    /**
     * 선택 범위에 스타일 적용
     * @param {Object} style - CSS 스타일 객체
     */
    applyStyle(style) {
        const elements = this.getSelectedElements();

        if (elements.length === 0) {
            logger.warn('⚠️ No elements selected');
            return;
        }

        elements.forEach(element => {
            Object.assign(element.style, style);
        });

        logger.info(`🎨 Applied style to ${elements.length} elements`);
    }

    /**
     * 선택된 텍스트에 포맷 적용 (볼드, 이탤릭 등)
     * @param {string} format - 포맷 타입 ('bold', 'italic', 'underline', 'color')
     * @param {*} value - 포맷 값
     */
    applyFormat(format, value = true) {
        const positions = this.getSelectedPositions();

        if (positions.length === 0) {
            logger.warn('⚠️ No text selected');
            return;
        }

        // 선택된 위치들의 데이터 업데이트
        positions.forEach(pos => {
            // 셀 데이터 업데이트
            if (pos.cellData) {
                this._applyFormatToCellData(pos.cellData, format, value);
            }

            // 단락 데이터 업데이트
            if (pos.paraData) {
                this._applyFormatToParaData(pos.paraData, format, value);
            }
        });

        // DOM 스타일 즉시 반영
        const styleMap = {
            bold: { fontWeight: value ? 'bold' : 'normal' },
            italic: { fontStyle: value ? 'italic' : 'normal' },
            underline: { textDecoration: value ? 'underline' : 'none' },
            strikethrough: { textDecoration: value ? 'line-through' : 'none' },
            color: { color: value },
            backgroundColor: { backgroundColor: value || 'transparent' },
            verticalAlign: { verticalAlign: value }
        };

        if (styleMap[format]) {
            // For text-decoration, we need to handle combining underline and strikethrough
            if (format === 'underline' || format === 'strikethrough') {
                this._applyTextDecoration(format, value);
            } else if (format === 'verticalAlign') {
                // For superscript/subscript, also reduce font size
                const style = { ...styleMap[format] };
                if (value === 'super' || value === 'sub') {
                    style.fontSize = '0.75em';
                } else if (value === 'baseline') {
                    style.fontSize = ''; // Reset to normal
                }
                this.applyStyle(style);
            } else {
                this.applyStyle(styleMap[format]);
            }
        }

        logger.info(`✏️ Applied format "${format}" to ${positions.length} characters`);
    }

    /**
     * 셀 데이터에 포맷 적용
     * @private
     */
    _applyFormatToCellData(cellData, format, value) {
        if (!cellData.elements) return;

        cellData.elements.forEach(element => {
            if (element.type === 'paragraph' && element.runs) {
                element.runs.forEach(run => {
                    if (run.text) {
                        run[format] = value;
                    }
                });
            }
        });
    }

    /**
     * 단락 데이터에 포맷 적용
     * @private
     */
    _applyFormatToParaData(paraData, format, value) {
        if (!paraData.runs) return;

        paraData.runs.forEach(run => {
            if (run.text) {
                run[format] = value;
            }
        });
    }

    /**
     * Text Decoration 적용 (underline과 strikethrough를 올바르게 조합)
     * @private
     */
    _applyTextDecoration(format, value) {
        const positions = this.getSelectedPositions();

        positions.forEach(pos => {
            // 각 위치의 run 데이터에서 현재 underline과 strikethrough 상태 확인
            let run = null;

            if (pos.cellData?.elements?.[0]?.runs) {
                run = pos.cellData.elements[0].runs.find(r => r.text);
            } else if (pos.paraData?.runs) {
                run = pos.paraData.runs.find(r => r.text);
            }

            if (!run) return;

            // 현재 상태
            const hasUnderline = format === 'underline' ? value : run.underline;
            const hasStrikethrough = format === 'strikethrough' ? value : run.strikethrough;

            // textDecoration 조합
            const decorations = [];
            if (hasUnderline) decorations.push('underline');
            if (hasStrikethrough) decorations.push('line-through');

            const textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';

            // DOM에 적용
            this.applyStyle({ textDecoration });
        });
    }

    /**
     * 선택 범위에서 스타일 추출
     * @returns {Object} 스타일 정보
     */
    getSelectionStyle() {
        const elements = this.getSelectedElements();

        if (elements.length === 0) {
            return {};
        }

        // 첫 번째 요소의 스타일 추출
        const firstElement = elements[0];
        const computedStyle = window.getComputedStyle(firstElement);

        return {
            fontFamily: computedStyle.fontFamily,
            fontSize: computedStyle.fontSize,
            fontWeight: computedStyle.fontWeight,
            fontStyle: computedStyle.fontStyle,
            color: computedStyle.color,
            textDecoration: computedStyle.textDecoration,
            backgroundColor: computedStyle.backgroundColor
        };
    }

    /**
     * 전체 선택
     */
    selectAll() {
        if (!this.positionManager || !this.positionManager.isPositionReady()) {
            logger.warn('⚠️ PositionManager not ready');
            return;
        }

        const positions = this.positionManager.getPositionList();
        if (positions.length === 0) {
            return;
        }

        this.setRange(0, positions.length - 1);
        logger.info('✅ Selected all text');
    }

    /**
     * 선택 해제
     */
    clearSelection() {
        this.range = {
            startIndex: -1,
            endIndex: -1,
            isCollapsed: true
        };

        this._clearSelectionHighlight();
        logger.debug('🚫 Selection cleared');
    }

    /**
     * 선택 여부 확인
     * @returns {boolean} 선택 여부
     */
    hasSelection() {
        return !this.range.isCollapsed && this.range.startIndex >= 0;
    }

    /**
     * 선택된 텍스트 복사
     * @returns {Promise<boolean>} 복사 성공 여부
     */
    async copySelection() {
        const text = this.getSelectedText();

        if (!text || text.length === 0) {
            logger.warn('⚠️ No text to copy');
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            logger.info(`📋 Copied ${text.length} characters to clipboard`);
            return true;
        } catch (error) {
            logger.error('❌ Failed to copy to clipboard:', error);
            return false;
        }
    }

    /**
     * 선택된 텍스트 삭제
     */
    deleteSelection() {
        if (!this.hasSelection()) {
            logger.warn('⚠️ No selection to delete');
            return;
        }

        const positions = this.getSelectedPositions();

        // 각 위치의 데이터에서 텍스트 제거
        positions.forEach(pos => {
            if (pos.cellData) {
                this._deleteTextFromCellData(pos.cellData, pos.textOffset);
            }
            if (pos.paraData) {
                this._deleteTextFromParaData(pos.paraData, pos.textOffset);
            }
        });

        // DOM에서 텍스트 제거
        const elements = this.getSelectedElements();
        elements.forEach(element => {
            element.textContent = '';
        });

        this.clearSelection();
        logger.info(`🗑️ Deleted ${positions.length} characters`);
    }

    /**
     * 셀 데이터에서 텍스트 삭제
     * @private
     */
    _deleteTextFromCellData(cellData, offset) {
        if (!cellData.elements) return;

        cellData.elements.forEach(element => {
            if (element.type === 'paragraph' && element.runs) {
                element.runs.forEach(run => {
                    if (run.text && offset < run.text.length) {
                        run.text = run.text.slice(0, offset) + run.text.slice(offset + 1);
                    }
                });
            }
        });
    }

    /**
     * 단락 데이터에서 텍스트 삭제
     * @private
     */
    _deleteTextFromParaData(paraData, offset) {
        if (!paraData.runs) return;

        paraData.runs.forEach(run => {
            if (run.text && offset < run.text.length) {
                run.text = run.text.slice(0, offset) + run.text.slice(offset + 1);
            }
        });
    }

    /**
     * 범위 정보 가져오기
     * @returns {Object} 범위 통계
     */
    getRangeInfo() {
        if (!this.hasSelection()) {
            return {
                hasSelection: false,
                length: 0,
                text: ''
            };
        }

        const text = this.getSelectedText();
        const positions = this.getSelectedPositions();

        return {
            hasSelection: true,
            startIndex: this.range.startIndex,
            endIndex: this.range.endIndex,
            length: text.length,
            text: text,
            characterCount: positions.filter(p => !p.isWhitespace).length,
            whitespaceCount: positions.filter(p => p.isWhitespace).length
        };
    }

    /**
     * 리셋
     */
    reset() {
        this.clearSelection();
        this.isSelecting = false;
        this.selectionStartPos = null;
        logger.info('🔄 RangeManager reset');
    }

    /**
     * 정리
     */
    destroy() {
        this.disableSelection();
        this.reset();
        logger.info('🗑️ RangeManager destroyed');
    }
}

export default RangeManager;
