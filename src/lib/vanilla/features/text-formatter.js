/**
 * Text Formatter
 * 텍스트 서식 적용 (굵게, 기울임, 밑줄)
 * 
 * @module features/text-formatter
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TextFormatter');

/**
 * 텍스트 서식 관리 클래스
 */
export class TextFormatter {
    constructor(viewer) {
        this.viewer = viewer;
        logger.info('🎨 TextFormatter initialized');
    }

    /**
     * 굵게 토글 (Ctrl+B)
     * @returns {boolean} 성공 여부
     */
    toggleBold() {
        return this._applyFormat('bold');
    }

    /**
     * 기울임 토글 (Ctrl+I)
     * @returns {boolean} 성공 여부
     */
    toggleItalic() {
        return this._applyFormat('italic');
    }

    /**
     * 밑줄 토글 (Ctrl+U)
     * @returns {boolean} 성공 여부
     */
    toggleUnderline() {
        return this._applyFormat('underline');
    }

    /**
     * 서식 적용 (내부 메서드)
     * @param {string} formatType - 'bold' | 'italic' | 'underline'
     * @returns {boolean} 성공 여부
     * @private
     */
    _applyFormat(formatType) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            logger.warn('⚠️ No selection for formatting');
            return false;
        }

        const range = selection.getRangeAt(0);
        if (range.collapsed) {
            logger.warn('⚠️ Selection is collapsed, no text selected');
            return false;
        }

        // 선택된 텍스트가 편집 가능한 영역 내에 있는지 확인
        const editableContainer = this._findEditableContainer(range.commonAncestorContainer);
        if (!editableContainer) {
            logger.warn('⚠️ Selection is not within editable area');
            return false;
        }

        logger.info(`📝 Applying ${formatType} format`);

        try {
            // 1. 현재 서식 상태 확인
            const currentState = this._getFormatState(range, formatType);
            const newState = !currentState;

            // 2. DOM에 서식 적용 (execCommand 사용)
            const command = this._getExecCommand(formatType);
            document.execCommand(command, false, null);

            // 3. 데이터 모델 업데이트 (HWPX 구조)
            this._updateDataModel(editableContainer, formatType, newState);

            // 4. History에 기록 (Undo 지원)
            if (this.viewer.historyManager) {
                const captureState = { formatType, newState, container: editableContainer };
                this.viewer.historyManager.execute(
                    // Do - 이미 실행됨
                    () => { },
                    // Undo
                    () => {
                        document.execCommand(command, false, null);
                        this._updateDataModel(editableContainer, formatType, !newState);
                        return () => {
                            document.execCommand(command, false, null);
                            this._updateDataModel(editableContainer, formatType, newState);
                        };
                    },
                    `${formatType} 서식`
                );
            }

            // 5. 변경 콜백 호출
            if (this.viewer.inlineEditor?.onChangeCallback) {
                this.viewer.inlineEditor.onChangeCallback({ type: 'format', formatType, newState });
            }

            logger.info(`✅ ${formatType} format applied: ${newState}`);
            return true;

        } catch (error) {
            logger.error(`❌ Failed to apply ${formatType}:`, error);
            return false;
        }
    }

    /**
     * 편집 가능한 컨테이너 찾기
     * @private
     */
    _findEditableContainer(node) {
        let current = node;
        while (current && current !== document.body) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                // contentEditable 요소 또는 hp-para, td, th 클래스 확인
                if (current.contentEditable === 'true' ||
                    current.classList?.contains('hp-para') ||
                    current.tagName === 'TD' ||
                    current.tagName === 'TH') {
                    return current;
                }
            }
            current = current.parentNode;
        }
        return null;
    }

    /**
     * 현재 서식 상태 확인
     * @private
     */
    _getFormatState(range, formatType) {
        const parentElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentElement
            : range.commonAncestorContainer;

        if (!parentElement) return false;

        const computedStyle = window.getComputedStyle(parentElement);

        switch (formatType) {
            case 'bold':
                return computedStyle.fontWeight === 'bold' ||
                    parseInt(computedStyle.fontWeight) >= 700;
            case 'italic':
                return computedStyle.fontStyle === 'italic';
            case 'underline':
                return computedStyle.textDecoration.includes('underline');
            default:
                return false;
        }
    }

    /**
     * execCommand 명령어 매핑
     * @private
     */
    _getExecCommand(formatType) {
        const commands = {
            'bold': 'bold',
            'italic': 'italic',
            'underline': 'underline'
        };
        return commands[formatType] || formatType;
    }

    /**
     * 데이터 모델 업데이트 (HWPX 구조)
     * @private
     */
    _updateDataModel(container, formatType, value) {
        // InlineEditor를 통해 현재 편집 중인 데이터 가져오기
        const inlineEditor = this.viewer.inlineEditor;
        if (!inlineEditor || !inlineEditor.cellData) {
            logger.debug('📊 No cell data to update');
            return;
        }

        const cellData = inlineEditor.cellData;

        // 셀 내 모든 runs에 서식 적용
        if (cellData.elements) {
            cellData.elements.forEach(element => {
                if (element.type === 'paragraph' && element.runs) {
                    element.runs.forEach(run => {
                        run[formatType] = value;
                    });
                }
            });
        } else if (cellData.runs) {
            // 직접 runs를 가진 paragraph인 경우
            cellData.runs.forEach(run => {
                run[formatType] = value;
            });
        }

        logger.debug(`📊 Data model updated: ${formatType}=${value}`);
    }

    /**
     * 선택 영역의 현재 서식 상태 조회
     * @returns {Object} { bold, italic, underline }
     */
    getSelectionFormat() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return { bold: false, italic: false, underline: false };
        }

        const range = selection.getRangeAt(0);
        return {
            bold: this._getFormatState(range, 'bold'),
            italic: this._getFormatState(range, 'italic'),
            underline: this._getFormatState(range, 'underline')
        };
    }
}

export default TextFormatter;
