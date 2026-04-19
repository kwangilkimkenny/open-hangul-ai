/**
 * Clipboard Commands Module
 * 클립보드 관련 명령 (복사, 잘라내기, 붙여넣기)
 *
 * @module command/clipboard-commands
 * @version 1.0.0
 * @author Kwang-il Kim (김광일) <ray.kim@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 클립보드 명령 클래스
 */
export class ClipboardCommands {
    constructor(viewer) {
        this.viewer = viewer;
        this.historyManager = viewer.historyManager;
        this.rangeManager = viewer.rangeManager;
        this.positionManager = viewer.positionManager;
        this.clipboard = ''; // 내부 클립보드 저장소
    }

    /**
     * Copy - 선택된 텍스트 복사
     * @returns {string} 복사된 텍스트
     */
    executeCopy() {
        try {
            if (!this.rangeManager) {
                logger.warn('RangeManager not available');
                return '';
            }

            const selectedText = this.rangeManager.getSelectedText();

            if (!selectedText || selectedText.length === 0) {
                logger.debug('No text selected');
                return '';
            }

            // 내부 클립보드에 저장
            this.clipboard = selectedText;

            // 시스템 클립보드에도 복사 시도
            this._copyToSystemClipboard(selectedText);

            logger.debug(`Copied: "${selectedText}"`);
            return selectedText;

        } catch (error) {
            logger.error('Failed to copy', error);
            return '';
        }
    }

    /**
     * Cut - 선택된 텍스트 잘라내기
     * @returns {string} 잘라낸 텍스트
     */
    executeCut() {
        try {
            if (!this.rangeManager) {
                logger.warn('RangeManager not available');
                return '';
            }

            const range = this.rangeManager.getRange();
            if (!range || range.startIndex === range.endIndex) {
                logger.debug('No text selected');
                return '';
            }

            const selectedText = this.rangeManager.getSelectedText();

            if (!selectedText || selectedText.length === 0) {
                return '';
            }

            // 내부 클립보드에 저장
            this.clipboard = selectedText;

            // 이전 상태 저장
            const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
            const cursor = this.viewer.cursor;
            const oldCursorIndex = cursor ? cursor.getCursorIndex() : -1;

            const execute = () => {
                // 선택 영역 삭제
                this._deleteSelectedRange(range.startIndex, range.endIndex);

                // DOM 업데이트 및 재렌더링
                this.viewer.updateDocument(this.viewer.getDocument());

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서를 선택 시작 위치로 이동
                    if (cursor) {
                        cursor.setCursorPosition(range.startIndex);
                    }

                    // 선택 해제
                    if (this.rangeManager) {
                        this.rangeManager.clearSelection();
                    }
                });

                logger.debug(`Cut: "${selectedText}" (${range.startIndex}-${range.endIndex})`);
            };

            const undo = () => {
                // 이전 문서로 복원
                this.viewer.updateDocument(oldDocument);

                // 위치 정보 재계산
                this.positionManager.computePositions(this.viewer.container).then(() => {
                    // 커서 위치 복원
                    if (cursor && oldCursorIndex >= 0) {
                        cursor.setCursorPosition(oldCursorIndex);
                    }
                });

                logger.debug('Undone cut');
                return execute;
            };

            this.historyManager.execute(execute, undo, 'Cut');

            // 시스템 클립보드에도 복사
            this._copyToSystemClipboard(selectedText);

            return selectedText;

        } catch (error) {
            logger.error('Failed to cut', error);
            return '';
        }
    }

    /**
     * Paste - 텍스트 붙여넣기
     * @param {string} text - 붙여넣을 텍스트
     */
    async executePaste(text = null) {
        try {
            // 텍스트가 제공되지 않으면 시스템 클립보드나 내부 클립보드에서 가져오기
            let pasteText = text;
            if (!pasteText) {
                pasteText = await this._getFromSystemClipboard() || this.clipboard;
            }

            if (!pasteText || pasteText.length === 0) {
                logger.debug('No text to paste');
                return;
            }

            const cursor = this.viewer.cursor;
            if (!cursor) {
                logger.warn('Cursor not available');
                return;
            }

            // 선택 영역이 있으면 먼저 삭제
            const range = this.rangeManager ? this.rangeManager.getRange() : null;
            const hasSelection = range && range.startIndex !== range.endIndex;

            if (hasSelection) {
                // 선택 영역 삭제 후 붙여넣기
                this._pasteWithSelection(pasteText, range);
            } else {
                // 커서 위치에 바로 붙여넣기
                this._pasteAtCursor(pasteText);
            }

        } catch (error) {
            logger.error('Failed to paste', error);
            throw error;
        }
    }

    /**
     * 선택 영역을 삭제하고 텍스트 붙여넣기
     * @private
     */
    _pasteWithSelection(text, range) {
        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
        const cursor = this.viewer.cursor;
        const oldCursorIndex = cursor.getCursorIndex();

        const execute = () => {
            // 선택 영역 삭제
            this._deleteSelectedRange(range.startIndex, range.endIndex);

            // 삭제된 위치에 텍스트 삽입
            const position = this.positionManager.getPositionByIndex(range.startIndex);
            if (position) {
                if (position.cellData) {
                    this._insertTextIntoCell(position.cellData, position, text);
                } else if (position.paraData) {
                    this._insertTextIntoParagraph(position.paraData, position, text);
                }
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 붙여넣은 텍스트 끝으로 이동
                cursor.setCursorPosition(range.startIndex + text.length);

                // 선택 해제
                if (this.rangeManager) {
                    this.rangeManager.clearSelection();
                }
            });

            logger.debug(`Pasted (replace selection): "${text}"`);
        };

        const undo = () => {
            // 이전 문서로 복원
            this.viewer.updateDocument(oldDocument);

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                cursor.setCursorPosition(oldCursorIndex);
            });

            logger.debug('Undone paste');
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Paste');
    }

    /**
     * 커서 위치에 텍스트 붙여넣기
     * @private
     */
    _pasteAtCursor(text) {
        const cursor = this.viewer.cursor;
        const cursorIndex = cursor.getCursorIndex();

        if (cursorIndex < 0) {
            logger.warn('Invalid cursor position');
            return;
        }

        const position = this.positionManager.getPositionByIndex(cursorIndex);
        if (!position) {
            logger.warn('Invalid cursor position');
            return;
        }

        const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

        const execute = () => {
            // 텍스트 삽입
            if (position.cellData) {
                this._insertTextIntoCell(position.cellData, position, text);
            } else if (position.paraData) {
                this._insertTextIntoParagraph(position.paraData, position, text);
            }

            // DOM 업데이트 및 재렌더링
            this.viewer.updateDocument(this.viewer.getDocument());

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서를 붙여넣은 텍스트 끝으로 이동
                cursor.setCursorPosition(cursorIndex + text.length);
            });

            logger.debug(`Pasted at cursor: "${text}"`);
        };

        const undo = () => {
            // 이전 문서로 복원
            this.viewer.updateDocument(oldDocument);

            // 위치 정보 재계산
            this.positionManager.computePositions(this.viewer.container).then(() => {
                // 커서 위치 복원
                cursor.setCursorPosition(cursorIndex);
            });

            logger.debug('Undone paste');
            return execute;
        };

        this.historyManager.execute(execute, undo, 'Paste');
    }

    /**
     * 시스템 클립보드에 복사
     * @private
     */
    async _copyToSystemClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                logger.debug('Text copied to system clipboard');
            } else {
                // Fallback for older browsers
                this._fallbackCopyToClipboard(text);
            }
        } catch (error) {
            logger.warn('Failed to copy to system clipboard', error);
        }
    }

    /**
     * 시스템 클립보드에서 가져오기
     * @private
     */
    async _getFromSystemClipboard() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                logger.debug('Text read from system clipboard');
                return text;
            }
        } catch (error) {
            logger.warn('Failed to read from system clipboard', error);
        }
        return null;
    }

    /**
     * 레거시 클립보드 복사 (fallback)
     * @private
     */
    _fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (successful) {
                logger.debug('Text copied using fallback method');
            }
        } catch (error) {
            logger.warn('Fallback clipboard copy failed', error);
        }
    }

    /**
     * 선택된 범위 삭제 (내부 메서드)
     * @private
     */
    _deleteSelectedRange(startIndex, endIndex) {
        // 범위 내의 모든 위치 가져오기
        for (let i = endIndex - 1; i >= startIndex; i--) {
            const position = this.positionManager.getPositionByIndex(i);
            if (position) {
                if (position.cellData) {
                    this._deleteCharacterFromCell(position.cellData, position);
                } else if (position.paraData) {
                    this._deleteCharacterFromParagraph(position.paraData, position);
                }
            }
        }
    }

    /**
     * 셀에 텍스트 삽입 (내부 메서드)
     * @private
     */
    _insertTextIntoCell(cellData, position, text) {
        if (!cellData.paragraphs) {
            cellData.paragraphs = [];
        }

        if (cellData.paragraphs.length === 0) {
            cellData.paragraphs.push({ runs: [] });
        }

        const para = cellData.paragraphs[position.paraIndex || 0];
        if (!para.runs) {
            para.runs = [];
        }

        const runIndex = position.runIndex || 0;
        const charIndex = position.charIndex || 0;

        if (runIndex >= para.runs.length) {
            para.runs.push({ text: text, formatting: {} });
        } else {
            const run = para.runs[runIndex];
            const beforeText = run.text.substring(0, charIndex);
            const afterText = run.text.substring(charIndex);
            run.text = beforeText + text + afterText;
        }
    }

    /**
     * 단락에 텍스트 삽입 (내부 메서드)
     * @private
     */
    _insertTextIntoParagraph(paraData, position, text) {
        if (!paraData.runs) {
            paraData.runs = [];
        }

        const runIndex = position.runIndex || 0;
        const charIndex = position.charIndex || 0;

        if (runIndex >= paraData.runs.length) {
            paraData.runs.push({ text: text, formatting: {} });
        } else {
            const run = paraData.runs[runIndex];
            const beforeText = run.text.substring(0, charIndex);
            const afterText = run.text.substring(charIndex);
            run.text = beforeText + text + afterText;
        }
    }

    /**
     * 셀에서 문자 삭제 (내부 메서드)
     * @private
     */
    _deleteCharacterFromCell(cellData, position) {
        if (!cellData.paragraphs || cellData.paragraphs.length === 0) {
            return;
        }

        const para = cellData.paragraphs[position.paraIndex || 0];
        if (!para || !para.runs || para.runs.length === 0) {
            return;
        }

        const run = para.runs[position.runIndex || 0];
        if (!run || !run.text) {
            return;
        }

        const charIndex = position.charIndex || 0;
        if (charIndex < run.text.length) {
            run.text = run.text.substring(0, charIndex) + run.text.substring(charIndex + 1);
        }
    }

    /**
     * 단락에서 문자 삭제 (내부 메서드)
     * @private
     */
    _deleteCharacterFromParagraph(paraData, position) {
        if (!paraData.runs || paraData.runs.length === 0) {
            return;
        }

        const run = paraData.runs[position.runIndex || 0];
        if (!run || !run.text) {
            return;
        }

        const charIndex = position.charIndex || 0;
        if (charIndex < run.text.length) {
            run.text = run.text.substring(0, charIndex) + run.text.substring(charIndex + 1);
        }
    }

    /**
     * 내부 클립보드 내용 가져오기
     */
    getClipboardContent() {
        return this.clipboard;
    }

    /**
     * 내부 클립보드 내용 설정
     */
    setClipboardContent(text) {
        this.clipboard = text || '';
    }

    /**
     * 클립보드 비우기
     */
    clearClipboard() {
        this.clipboard = '';
    }

    /**
     * 클립보드에 내용이 있는지 확인
     */
    hasClipboardContent() {
        return this.clipboard.length > 0;
    }

    /**
     * 시스템 클립보드 지원 여부 확인
     */
    isSystemClipboardSupported() {
        return !!(navigator.clipboard && navigator.clipboard.readText && navigator.clipboard.writeText);
    }
}

export default ClipboardCommands;